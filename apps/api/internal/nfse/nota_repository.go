package nfse

import (
	"context"
	"errors"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Nota represents a row in the notas_fiscais table.
type Nota struct {
	ID               uuid.UUID
	MeiID            uuid.UUID
	NumeroRPS        int64
	Status           string // PROCESSANDO | AUTORIZADA | REJEITADA | CANCELADA | ERRO_TEMPORARIO
	ProtocoloReceita *string
	NumeroNFSe       *string
	CodVerificacao   *string
	XMLEnviado       *string
	XMLRetorno       *string
	PDFPath          *string
	// XMLS3Key is the S3 object key for the nota XML (STOR-01).
	// For notas created after 2026-05-04 this replaces XMLEnviado/XMLRetorno in DB.
	XMLS3Key *string
	// PDFS3Key is the S3 object key for the nota PDF (STOR-01).
	// For notas created after 2026-05-04 this replaces PDFPath in DB.
	PDFS3Key          *string
	WebhookURL        *string
	WebhookEntregue   bool
	WebhookTentativas int
	IdempotencyKey    *string
	TomadorDoc        *string
	TomadorNome       *string
	ValorServico      *float64
	Competencia       *string
	ErroCodigo        *string
	ErroDescricao     *string
	CanceladaEm       *time.Time
	EmitidaEm         *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// ErrNotaNotFound is returned when a nota does not exist or does not belong to the MEI.
type ErrNotaNotFound struct{}

func (ErrNotaNotFound) Error() string { return "nota fiscal not found" }

// NotaRepository handles all DB operations for the notas_fiscais table.
type NotaRepository struct {
	db *supabase.Client
}

// NewNotaRepository creates a NotaRepository.
func NewNotaRepository(db *supabase.Client) *NotaRepository {
	return &NotaRepository{db: db}
}

// NextNumeroRPS atomically allocates the next RPS sequence number for a MEI.
// Uses a Postgres sequence-per-MEI strategy via a RETURNING clause.
func (r *NotaRepository) NextNumeroRPS(ctx context.Context, meiID uuid.UUID) (int64, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT COALESCE(MAX(numero_rps), 0) + 1
		FROM notas_fiscais
		WHERE mei_id = $1
	`, meiID)
	var n int64
	if err := row.Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// CreateNotaInput carries the data needed to insert a new nota.
type CreateNotaInput struct {
	MeiID          uuid.UUID
	NumeroRPS      int64
	XMLEnviado     string
	WebhookURL     string
	IdempotencyKey string
	TomadorDoc     string
	TomadorNome    string
	ValorServico   float64
	Competencia    string
}

// Create inserts a new nota with status PROCESSANDO and returns it.
func (r *NotaRepository) Create(ctx context.Context, in CreateNotaInput) (*Nota, error) {
	var id uuid.UUID
	err := r.db.Pool().QueryRow(ctx, `
		INSERT INTO notas_fiscais (
			mei_id, numero_rps, status, xml_enviado,
			webhook_url, idempotency_key,
			tomador_doc, tomador_nome, valor_servico, competencia
		) VALUES ($1,$2,'PROCESSANDO',$3,$4,$5,$6,$7,$8,$9)
		RETURNING id
	`,
		in.MeiID, in.NumeroRPS, nullStr(in.XMLEnviado),
		nullStr(in.WebhookURL), nullStr(in.IdempotencyKey),
		nullStr(in.TomadorDoc), nullStr(in.TomadorNome),
		in.ValorServico, nullStr(in.Competencia),
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id, in.MeiID)
}

// FindByID loads a nota by its UUID, restricted to the given MEI.
func (r *NotaRepository) FindByID(ctx context.Context, notaID, meiID uuid.UUID) (*Nota, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT id, mei_id, numero_rps, status,
		       protocolo_receita, numero_nfse, codigo_verificacao,
		       xml_enviado, xml_retorno, pdf_path, xml_s3_key, pdf_s3_key,
		       webhook_url, webhook_entregue, webhook_tentativas,
		       idempotency_key, tomador_doc, tomador_nome,
		       valor_servico, competencia,
		       erro_codigo, erro_descricao,
		       cancelada_em, emitida_em,
		       created_at, updated_at
		FROM notas_fiscais
		WHERE id = $1 AND mei_id = $2
	`, notaID, meiID)
	return scanNota(row)
}

// ListByMEI returns a paginated list of notas for a given MEI, newest first.
func (r *NotaRepository) ListByMEI(ctx context.Context, meiID uuid.UUID, limit, offset int) ([]Nota, int, error) {
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, mei_id, numero_rps, status,
		       protocolo_receita, numero_nfse, codigo_verificacao,
		       xml_enviado, xml_retorno, pdf_path, xml_s3_key, pdf_s3_key,
		       webhook_url, webhook_entregue, webhook_tentativas,
		       idempotency_key, tomador_doc, tomador_nome,
		       valor_servico, competencia,
		       erro_codigo, erro_descricao,
		       cancelada_em, emitida_em,
		       created_at, updated_at
		FROM notas_fiscais
		WHERE mei_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, meiID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var notas []Nota
	for rows.Next() {
		n, err := scanNotaFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		notas = append(notas, *n)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	var total int
	if err := r.db.Pool().QueryRow(ctx, `
		SELECT COUNT(*) FROM notas_fiscais WHERE mei_id = $1
	`, meiID).Scan(&total); err != nil {
		return nil, 0, err
	}

	return notas, total, nil
}

// FindProcessandoSemProtocolo returns PROCESSANDO notas that have no protocol
// and were created longer ago than the age threshold. Ordered oldest first.
func (r *NotaRepository) FindProcessandoSemProtocolo(ctx context.Context, olderThan time.Duration, limit int) ([]Nota, error) {
	threshold := time.Now().UTC().Add(-olderThan)
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, mei_id, numero_rps, status,
		       protocolo_receita, numero_nfse, codigo_verificacao,
		       xml_enviado, xml_retorno, pdf_path, xml_s3_key, pdf_s3_key,
		       webhook_url, webhook_entregue, webhook_tentativas,
		       idempotency_key, tomador_doc, tomador_nome,
		       valor_servico, competencia,
		       erro_codigo, erro_descricao,
		       cancelada_em, emitida_em,
		       created_at, updated_at
		FROM notas_fiscais
		WHERE status = 'PROCESSANDO'
		  AND protocolo_receita IS NULL
		  AND created_at < $1
		ORDER BY created_at ASC
		LIMIT $2
	`, threshold, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notas []Nota
	for rows.Next() {
		n, err := scanNotaFromRows(rows)
		if err != nil {
			return nil, err
		}
		notas = append(notas, *n)
	}
	return notas, rows.Err()
}

// MarcarErroTemporario transitions a PROCESSANDO nota to ERRO_TEMPORARIO.
// Only updates the row if it is still PROCESSANDO (safe for concurrent callers).
func (r *NotaRepository) MarcarErroTemporario(ctx context.Context, notaID uuid.UUID, erroCodigo, erroDescricao string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET status         = 'ERRO_TEMPORARIO',
		    erro_codigo    = $1,
		    erro_descricao = $2,
		    updated_at     = NOW()
		WHERE id = $3
		  AND status = 'PROCESSANDO'
	`, erroCodigo, erroDescricao, notaID)
	return err
}

// SetProtocolo stores the async protocol received from the Receita Federal.
func (r *NotaRepository) SetProtocolo(ctx context.Context, notaID uuid.UUID, protocolo string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET protocolo_receita = $1, updated_at = NOW()
		WHERE id = $2
	`, protocolo, notaID)
	return err
}

// Autorizar marks a nota as AUTORIZADA with the official NFS-e number.
func (r *NotaRepository) Autorizar(ctx context.Context, notaID uuid.UUID, numeroNFSe, codVerificacao, xmlRetorno string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET status = 'AUTORIZADA',
		    numero_nfse = $1,
		    codigo_verificacao = $2,
		    xml_retorno = $3,
		    emitida_em = NOW(),
		    updated_at = NOW()
		WHERE id = $4
	`, numeroNFSe, codVerificacao, xmlRetorno, notaID)
	return err
}

// Rejeitar marks a nota as REJEITADA with error details.
func (r *NotaRepository) Rejeitar(ctx context.Context, notaID uuid.UUID, erroCodigo, erroDescricao string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET status = 'REJEITADA',
		    erro_codigo = $1,
		    erro_descricao = $2,
		    updated_at = NOW()
		WHERE id = $3
	`, erroCodigo, erroDescricao, notaID)
	return err
}

// Cancelar marks a nota as CANCELADA.
func (r *NotaRepository) Cancelar(ctx context.Context, notaID, meiID uuid.UUID) error {
	tag, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET status = 'CANCELADA',
		    cancelada_em = NOW(),
		    updated_at = NOW()
		WHERE id = $1 AND mei_id = $2 AND status = 'AUTORIZADA'
	`, notaID, meiID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotaNotFound{}
	}
	return nil
}

// SetPDFPath updates the Supabase Storage path for the generated PDF.
// Deprecated: prefer SetPDFS3Key for new notas (STOR-01).
func (r *NotaRepository) SetPDFPath(ctx context.Context, notaID uuid.UUID, path string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais SET pdf_path = $1, updated_at = NOW() WHERE id = $2
	`, path, notaID)
	return err
}

// SetXMLS3Key stores the S3 object key for the nota's XML document (STOR-01).
// For notas in PROCESSANDO this is the signed RPS key; after authorisation it
// should be called again with the NFS-e retorno key.
func (r *NotaRepository) SetXMLS3Key(ctx context.Context, notaID uuid.UUID, key string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET xml_s3_key  = $1,
		    xml_enviado = NULL,
		    xml_retorno = NULL,
		    updated_at  = NOW()
		WHERE id = $2
	`, key, notaID)
	return err
}

// SetPDFS3Key stores the S3 object key for the nota's PDF document (STOR-01).
func (r *NotaRepository) SetPDFS3Key(ctx context.Context, notaID uuid.UUID, key string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET pdf_s3_key = $1,
		    pdf_path   = NULL,
		    updated_at = NOW()
		WHERE id = $2
	`, key, notaID)
	return err
}

// MarcarWebhookEntregue marks a nota's webhook as successfully delivered.
func (r *NotaRepository) MarcarWebhookEntregue(ctx context.Context, notaID uuid.UUID) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET webhook_entregue = true,
		    webhook_tentativas = webhook_tentativas + 1,
		    updated_at = NOW()
		WHERE id = $1
	`, notaID)
	return err
}

// IncrementWebhookTentativas increments the delivery attempt counter.
func (r *NotaRepository) IncrementWebhookTentativas(ctx context.Context, notaID uuid.UUID) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE notas_fiscais
		SET webhook_tentativas = webhook_tentativas + 1,
		    updated_at = NOW()
		WHERE id = $1
	`, notaID)
	return err
}

// FindPendingWebhooks returns notas that have a webhook_url but have not been delivered yet.
func (r *NotaRepository) FindPendingWebhooks(ctx context.Context, limit int) ([]Nota, error) {
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, mei_id, numero_rps, status,
		       protocolo_receita, numero_nfse, codigo_verificacao,
		       xml_enviado, xml_retorno, pdf_path, xml_s3_key, pdf_s3_key,
		       webhook_url, webhook_entregue, webhook_tentativas,
		       idempotency_key, tomador_doc, tomador_nome,
		       valor_servico, competencia,
		       erro_codigo, erro_descricao,
		       cancelada_em, emitida_em,
		       created_at, updated_at
		FROM notas_fiscais
		WHERE webhook_url IS NOT NULL
		  AND webhook_entregue = false
		  AND status IN ('AUTORIZADA','REJEITADA','CANCELADA')
		  AND webhook_tentativas < 5
		ORDER BY updated_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notas []Nota
	for rows.Next() {
		n, err := scanNotaFromRows(rows)
		if err != nil {
			return nil, err
		}
		notas = append(notas, *n)
	}
	return notas, rows.Err()
}

// NotaParaConsulta extends Nota with MEI data needed by the status poller.
type NotaParaConsulta struct {
	Nota
	CNPJ          string
	MunicipioIBGE string
	CertSecretARN *string // nullable — MEI might not have a cert yet
}

// FindProcessandoComProtocolo returns PROCESSANDO notas that already have a
// protocolo_receita (i.e. were accepted async by the Receita Federal) and
// are thus ready to be polled for their final status.
func (r *NotaRepository) FindProcessandoComProtocolo(ctx context.Context, limit int) ([]NotaParaConsulta, error) {
	rows, err := r.db.Pool().Query(ctx, `
		SELECT n.id, n.mei_id, n.numero_rps, n.status,
		       n.protocolo_receita, n.numero_nfse, n.codigo_verificacao,
		       n.xml_enviado, n.xml_retorno, n.pdf_path, n.xml_s3_key, n.pdf_s3_key,
		       n.webhook_url, n.webhook_entregue, n.webhook_tentativas,
		       n.idempotency_key, n.tomador_doc, n.tomador_nome,
		       n.valor_servico, n.competencia,
		       n.erro_codigo, n.erro_descricao,
		       n.cancelada_em, n.emitida_em,
		       n.created_at, n.updated_at,
		       m.cnpj, m.municipio_ibge, m.cert_secret_arn
		FROM notas_fiscais n
		JOIN meis m ON m.id = n.mei_id
		WHERE n.status = 'PROCESSANDO'
		  AND n.protocolo_receita IS NOT NULL
		ORDER BY n.updated_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []NotaParaConsulta
	for rows.Next() {
		var nc NotaParaConsulta
		err := rows.Scan(
			&nc.ID, &nc.MeiID, &nc.NumeroRPS, &nc.Status,
			&nc.ProtocoloReceita, &nc.NumeroNFSe, &nc.CodVerificacao,
			&nc.XMLEnviado, &nc.XMLRetorno, &nc.PDFPath, &nc.XMLS3Key, &nc.PDFS3Key,
			&nc.WebhookURL, &nc.WebhookEntregue, &nc.WebhookTentativas,
			&nc.IdempotencyKey, &nc.TomadorDoc, &nc.TomadorNome,
			&nc.ValorServico, &nc.Competencia,
			&nc.ErroCodigo, &nc.ErroDescricao,
			&nc.CanceladaEm, &nc.EmitidaEm,
			&nc.CreatedAt, &nc.UpdatedAt,
			&nc.CNPJ, &nc.MunicipioIBGE, &nc.CertSecretARN,
		)
		if err != nil {
			return nil, err
		}
		out = append(out, nc)
	}
	return out, rows.Err()
}

// ─── scanner helpers ───────────────────────────────────────────────────────

// scanner is satisfied by both pgx.Row and pgx.Rows.
type scanner interface {
	Scan(dest ...any) error
}

func scanNota(row scanner) (*Nota, error) {
	var n Nota
	err := row.Scan(
		&n.ID, &n.MeiID, &n.NumeroRPS, &n.Status,
		&n.ProtocoloReceita, &n.NumeroNFSe, &n.CodVerificacao,
		&n.XMLEnviado, &n.XMLRetorno, &n.PDFPath, &n.XMLS3Key, &n.PDFS3Key,
		&n.WebhookURL, &n.WebhookEntregue, &n.WebhookTentativas,
		&n.IdempotencyKey, &n.TomadorDoc, &n.TomadorNome,
		&n.ValorServico, &n.Competencia,
		&n.ErroCodigo, &n.ErroDescricao,
		&n.CanceladaEm, &n.EmitidaEm,
		&n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotaNotFound{}
		}
		return nil, err
	}
	return &n, nil
}

func scanNotaFromRows(rows scanner) (*Nota, error) {
	return scanNota(rows)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
