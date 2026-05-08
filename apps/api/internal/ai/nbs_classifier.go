package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// SugestaoNBS representa um código NBS sugerido pelo classificador.
type SugestaoNBS struct {
	Codigo    string `json:"codigo"`
	Descricao string `json:"descricao"`
	Confianca string `json:"confianca"` // alta | media | baixa
	Motivo    string `json:"motivo"`    // 1 frase explicando a escolha
}

// NBSClassifier classifica descrições livres em códigos NBS-Nacional.
// Estratégia de custo: pré-filtra candidatos no Postgres via similarity
// (pg_trgm) e envia apenas a top-K para o modelo, reduzindo input tokens.
// Resultado é cacheado no Redis por 30 dias por hash da descrição normalizada.
type NBSClassifier struct {
	db    *pgxpool.Pool
	redis *redis.Client
	llm   *Client
}

func NewNBSClassifier(db *pgxpool.Pool, rdb *redis.Client, llm *Client) *NBSClassifier {
	return &NBSClassifier{db: db, redis: rdb, llm: llm}
}

const (
	candidateLimit = 20            // candidatos enviados ao modelo
	cacheTTL       = 30 * 24 * time.Hour
)

// Sugerir retorna até 3 sugestões de NBS para a descrição informada.
func (n *NBSClassifier) Sugerir(ctx context.Context, descricao string) ([]SugestaoNBS, error) {
	desc := strings.TrimSpace(descricao)
	if len(desc) < 3 {
		return nil, fmt.Errorf("descrição muito curta (mínimo 3 caracteres)")
	}
	if len(desc) > 500 {
		desc = desc[:500]
	}

	// 1. Cache lookup
	cacheKey := "ai:nbs:" + hashKey(desc)
	if n.redis != nil {
		if cached, err := n.redis.Get(ctx, cacheKey).Bytes(); err == nil {
			var out []SugestaoNBS
			if json.Unmarshal(cached, &out) == nil {
				log.Ctx(ctx).Debug().Str("descricao", desc).Msg("nbs: cache hit")
				return out, nil
			}
		}
	}

	// 2. Pré-filtra candidatos no DB (similaridade trigram + LIKE fallback).
	candidates, err := n.fetchCandidates(ctx, desc)
	if err != nil {
		return nil, fmt.Errorf("buscar candidatos: %w", err)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("nenhum código NBS candidato encontrado")
	}

	// 3. Chama o modelo para escolher os top 3 entre os candidatos.
	sugestoes, err := n.askModel(ctx, desc, candidates)
	if err != nil {
		return nil, err
	}

	// 4. Valida que os códigos retornados realmente existem nos candidatos.
	valid := make(map[string]string, len(candidates))
	for _, c := range candidates {
		valid[c.Codigo] = c.Descricao
	}
	out := make([]SugestaoNBS, 0, len(sugestoes))
	for _, s := range sugestoes {
		if descTrue, ok := valid[s.Codigo]; ok {
			s.Descricao = descTrue // canonicaliza com a descrição oficial
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("modelo retornou códigos inválidos")
	}

	// 5. Persiste no cache (best-effort).
	if n.redis != nil {
		if data, err := json.Marshal(out); err == nil {
			_ = n.redis.Set(ctx, cacheKey, data, cacheTTL).Err()
		}
	}
	return out, nil
}

type candidato struct {
	Codigo    string
	Descricao string
}

func (n *NBSClassifier) fetchCandidates(ctx context.Context, desc string) ([]candidato, error) {
	// Tenta similaridade trigram primeiro (precisa da extensão pg_trgm).
	// Cai pra ILIKE em palavras se trigram não existir / baixar score.
	rows, err := n.db.Query(ctx, `
		SELECT codigo, descricao
		  FROM codigos_nbs
		 WHERE descricao ILIKE '%' || $1 || '%'
			OR descricao ILIKE ANY (
			       SELECT '%' || w || '%'
			         FROM regexp_split_to_table(lower($1), '\s+') AS w
			        WHERE length(w) >= 4
			   )
		 LIMIT $2
	`, desc, candidateLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []candidato
	for rows.Next() {
		var c candidato
		if err := rows.Scan(&c.Codigo, &c.Descricao); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if len(out) > 0 {
		return out, nil
	}

	// Fallback: traz uma amostra aleatória para o modelo decidir.
	rows2, err := n.db.Query(ctx, `SELECT codigo, descricao FROM codigos_nbs LIMIT $1`, candidateLimit)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var c candidato
		if err := rows2.Scan(&c.Codigo, &c.Descricao); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

const systemPrompt = `Você é um assistente fiscal brasileiro especializado em NBS-Nacional (Nomenclatura Brasileira de Serviços) para emissão de NFS-e.

Sua tarefa: dada uma descrição livre de um serviço prestado, escolher os 3 códigos NBS mais adequados a partir de uma lista de candidatos pré-filtrada.

Regras:
- Retorne EXATAMENTE 3 sugestões em ordem decrescente de confiança.
- Use APENAS códigos da lista de candidatos fornecida.
- Cada sugestão deve ter: codigo (string), confianca ("alta"|"media"|"baixa"), motivo (1 frase clara em PT-BR).
- Responda APENAS com JSON puro (sem markdown, sem texto adicional).

Formato exato da resposta:
{"sugestoes":[{"codigo":"01020100","confianca":"alta","motivo":"..."},{"codigo":"...","confianca":"media","motivo":"..."},{"codigo":"...","confianca":"baixa","motivo":"..."}]}`

func (n *NBSClassifier) askModel(ctx context.Context, desc string, cand []candidato) ([]SugestaoNBS, error) {
	if !n.llm.Enabled() {
		return nil, fmt.Errorf("classificador IA indisponível (sem ANTHROPIC_API_KEY)")
	}

	var b strings.Builder
	b.WriteString("Descrição do serviço:\n")
	b.WriteString(desc)
	b.WriteString("\n\nCandidatos NBS:\n")
	for _, c := range cand {
		b.WriteString(fmt.Sprintf("- %s — %s\n", c.Codigo, c.Descricao))
	}
	b.WriteString("\nResponda em JSON conforme o formato especificado.")

	resp, err := n.llm.Send(ctx, Request{
		Model:     ModelHaiku45,
		MaxTokens: 600,
		Temperature: 0,
		System: []ContentBlock{{
			Type:         "text",
			Text:         systemPrompt,
			CacheControl: &CacheControl{Type: "ephemeral"}, // cache do system prompt (1h)
		}},
		Messages: []Message{{
			Role:    "user",
			Content: []ContentBlock{{Type: "text", Text: b.String()}},
		}},
	})
	if err != nil {
		return nil, err
	}

	log.Ctx(ctx).Info().
		Int("input_tokens", resp.Usage.InputTokens).
		Int("cache_read", resp.Usage.CacheReadInputTokens).
		Int("output_tokens", resp.Usage.OutputTokens).
		Msg("nbs: anthropic call")

	text := strings.TrimSpace(resp.FirstText())
	// Remove possíveis fences ```json
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var parsed struct {
		Sugestoes []SugestaoNBS `json:"sugestoes"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, fmt.Errorf("parse JSON do modelo: %w (body=%s)", err, text)
	}
	return parsed.Sugestoes, nil
}

func hashKey(s string) string {
	norm := strings.ToLower(strings.Join(strings.Fields(s), " "))
	h := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(h[:16])
}
