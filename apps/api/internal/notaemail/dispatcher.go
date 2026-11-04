// Package notaemail envia a NFS-e autorizada ao e-mail do tomador (#274).
//
// A nota é marcada na criação (notas_fiscais.auto_email_tomador +
// auto_email_destino) — pela emissão do dashboard (opção marcada por padrão),
// pela API (enviar_email_tomador=true) ou por uma recorrência com a opção de
// e-mail ligada. O Dispatcher roda em loop e envia assim que a nota estiver
// AUTORIZADA, não importa por qual caminho ela chegou lá (resposta síncrona,
// poller ou reconciliação).
//
// Concorrência: cada nota é "reservada" com UPDATE ... FOR UPDATE SKIP LOCKED
// gravando auto_email_enviado_em antes do envio, então várias réplicas da API
// nunca mandam o mesmo e-mail duas vezes. Se o envio falha, a reserva é
// desfeita e a nota volta para a fila (até a janela de 3 dias acabar).
package notaemail

import (
	"context"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

// DB é o subconjunto de *pgxpool.Pool usado aqui.
type DB interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Sender é o subconjunto de *email.Service usado aqui.
type Sender interface {
	Enabled() bool
	SendNotaParaTomador(ctx context.Context, toEmail string, p email.NotaTomadorParams) error
}

// Dispatcher envia os e-mails pendentes periodicamente.
type Dispatcher struct {
	db       DB
	sender   Sender
	interval time.Duration
	lote     int
	log      zerolog.Logger

	// Pausa após falha de envio (provedor fora do ar / chave inválida):
	// 1, 2, 4… até 30 min, para não martelar o provedor nem inundar o log.
	falhas   int
	pausaAte time.Time
	agora    func() time.Time
}

// New cria o Dispatcher (intervalo padrão de 1 minuto, lote de 20 notas).
func New(db DB, sender Sender, logger zerolog.Logger) *Dispatcher {
	return &Dispatcher{
		db:       db,
		sender:   sender,
		interval: time.Minute,
		lote:     20,
		log:      logger.With().Str("component", "nota_email_dispatcher").Logger(),
		agora:    time.Now,
	}
}

// Run bloqueia até ctx ser cancelado. Chamar em goroutine.
func (d *Dispatcher) Run(ctx context.Context) {
	if d.sender == nil || !d.sender.Enabled() {
		d.log.Warn().Msg("e-mail não configurado — envio automático da nota ao tomador desligado")
		return
	}
	d.log.Info().Dur("interval", d.interval).Msg("envio automático de notas ao tomador iniciado")
	t := time.NewTicker(d.interval)
	defer t.Stop()
	for {
		d.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

type pendente struct {
	id          uuid.UUID
	destino     string
	chave       string
	valor       *float64
	tomadorNome string
	prestador   string
}

// Tick reserva e envia um lote de e-mails pendentes. Devolve quantos saíram.
func (d *Dispatcher) Tick(ctx context.Context) int {
	if d.agora().Before(d.pausaAte) {
		return 0
	}
	rows, err := d.db.Query(ctx, `
		WITH alvo AS (
			SELECT id FROM notas_fiscais
			WHERE auto_email_tomador
			  AND auto_email_enviado_em IS NULL
			  AND status = 'AUTORIZADA'
			  AND COALESCE(numero_nfse, '') <> ''
			  AND COALESCE(auto_email_destino, '') <> ''
			  AND COALESCE(emitida_em, updated_at) > now() - interval '3 days'
			ORDER BY updated_at
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE notas_fiscais n
		   SET auto_email_enviado_em = now()
		  FROM alvo
		 WHERE n.id = alvo.id
		RETURNING n.id, n.auto_email_destino, n.numero_nfse, n.valor_servico,
		          COALESCE(n.tomador_nome, ''),
		          COALESCE((SELECT razao_social FROM empresas WHERE id = n.empresa_id), '')
	`, d.lote)
	if err != nil {
		d.log.Error().Err(err).Msg("falha ao buscar notas para envio ao tomador")
		return 0
	}
	var lote []pendente
	for rows.Next() {
		var p pendente
		if err := rows.Scan(&p.id, &p.destino, &p.chave, &p.valor, &p.tomadorNome, &p.prestador); err != nil {
			d.log.Error().Err(err).Msg("falha ao ler nota para envio ao tomador")
			continue
		}
		lote = append(lote, p)
	}
	rows.Close()

	enviados := 0
	for i, p := range lote {
		params := email.NotaTomadorParams{
			TomadorNome:   p.tomadorNome,
			PrestadorNome: p.prestador,
			ChaveAcesso:   p.chave,
		}
		if p.valor != nil {
			params.ValorServico = email.FormatBRL(*p.valor)
		}
		if len(p.chave) == 50 {
			params.ConsultaURL = "https://www.nfse.gov.br/consultapublica?chaveAcesso=" + p.chave
		}
		if err := d.sender.SendNotaParaTomador(ctx, p.destino, params); err != nil {
			// Desfaz a reserva desta e das restantes do lote: voltam para a
			// fila e saem quando o provedor normalizar.
			ids := make([]uuid.UUID, 0, len(lote)-i)
			for _, r := range lote[i:] {
				ids = append(ids, r.id)
			}
			if _, uerr := d.db.Exec(ctx,
				`UPDATE notas_fiscais SET auto_email_enviado_em = NULL WHERE id = ANY($1)`, ids); uerr != nil {
				d.log.Error().Err(uerr).Msg("falha ao devolver notas para a fila de e-mail")
			}
			d.falhas++
			pausa := time.Minute << min(d.falhas-1, 5)
			if pausa > 30*time.Minute {
				pausa = 30 * time.Minute
			}
			d.pausaAte = d.agora().Add(pausa)
			d.log.Error().Err(err).Str("nota_id", p.id.String()).Int("pendentes", len(ids)).
				Dur("pausa", pausa).Msg("envio automático da nota ao tomador falhou")
			return enviados
		}
		d.falhas = 0
		enviados++
		d.log.Info().Str("nota_id", p.id.String()).Msg("nota enviada ao tomador por e-mail")
	}
	return enviados
}
