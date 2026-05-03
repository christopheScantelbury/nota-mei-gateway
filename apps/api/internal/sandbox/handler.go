package sandbox

import (
	"fmt"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DemoKey is the pre-shared API key for the public sandbox.
const DemoKey = "sk_test_sandbox_demo"

// fakeNota represents an in-memory sandbox nota.
type fakeNota struct {
	ID                string  `json:"id"`
	Status            string  `json:"status"`
	NumeroNFSe        string  `json:"numero_nfse"`
	CodigoVerificacao string  `json:"codigo_verificacao"`
	ProtocoloReceita  string  `json:"protocolo_receita"`
	ValorServico      float64 `json:"valor_servico"`
	TomadorNome       string  `json:"tomador_nome"`
	TomadorDoc        string  `json:"tomador_doc"`
	Competencia       string  `json:"competencia"`
	WebhookURL        string  `json:"webhook_url,omitempty"`
	WebhookEntregue   bool    `json:"webhook_entregue"`
	EmitidaEm         string  `json:"emitida_em"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

// webhookRecord is a received sandbox webhook payload.
type webhookRecord struct {
	ReceivedAt string         `json:"received_at"`
	Body       map[string]any `json:"body"`
}

// Handler is the sandbox HTTP handler. All NFS-e operations return simulated data.
type Handler struct {
	rl    *IPRateLimiter
	mu    sync.RWMutex
	notas map[string]*fakeNota // keyed by nota ID
	hooks []webhookRecord      // last 20 received webhooks
}

// New creates a Handler with a rate limit of 20 requests per hour per IP.
func New() *Handler {
	return &Handler{
		rl:    NewIPRateLimiter(20, time.Hour),
		notas: make(map[string]*fakeNota),
	}
}

// IsSandboxKey returns true if the Bearer token is the demo key.
func IsSandboxKey(token string) bool {
	return token == "Bearer "+DemoKey
}

// RateLimitMiddleware rejects IPs that exceed 20 req/hour — sandbox keys only.
// Non-sandbox requests pass through without consuming quota.
func (h *Handler) RateLimitMiddleware(c *fiber.Ctx) error {
	if !IsSandboxKey(c.Get("Authorization")) {
		return c.Next()
	}
	ip := c.IP()
	if !h.rl.Allow(ip) {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error":   "RATE_LIMIT_EXCEEDED",
			"message": "Sandbox: limite de 20 requisições/hora por IP atingido.",
		})
	}
	return c.Next()
}

// EmitirNota simulates NFS-e emission and returns a realistic fake response.
func (h *Handler) EmitirNota(c *fiber.Ctx) error {
	var body map[string]any
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "corpo da requisição inválido",
		})
	}

	// Minimal validation — require top-level fields.
	for _, field := range []string{"servico", "tomador", "competencia"} {
		if body[field] == nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":   "VALIDATION_ERROR",
				"message": "campo obrigatório ausente: " + field,
			})
		}
	}

	now := time.Now().UTC()
	notaID := uuid.New().String()
	competencia, _ := body["competencia"].(string)
	webhookURL, _ := body["webhook_url"].(string)

	// Extract tomador info for realistic display.
	tomadorNome := "Empresa Demo LTDA"
	tomadorDoc := "12345678000190"
	if t, ok := body["tomador"].(map[string]any); ok {
		if v, ok := t["razao_social"].(string); ok && v != "" {
			tomadorNome = v
		}
		if v, ok := t["documento"].(string); ok && v != "" {
			tomadorDoc = v
		}
	}
	valorServico := 1000.00
	if s, ok := body["servico"].(map[string]any); ok {
		if v, ok := s["valor"].(float64); ok && v > 0 {
			valorServico = v
		}
	}

	// Simulate ~300ms of async processing delay.
	time.Sleep(300 * time.Millisecond)

	nota := &fakeNota{
		ID:                notaID,
		Status:            "AUTORIZADA",
		NumeroNFSe:        fmt.Sprintf("%06d", rand.IntN(999999)+1),
		CodigoVerificacao: randomCode(8),
		ProtocoloReceita:  fmt.Sprintf("%d%06d", now.Year(), rand.IntN(999999)+1),
		ValorServico:      valorServico,
		TomadorNome:       tomadorNome,
		TomadorDoc:        tomadorDoc,
		Competencia:       competencia,
		WebhookURL:        webhookURL,
		WebhookEntregue:   webhookURL != "",
		EmitidaEm:         now.Format(time.RFC3339),
		CreatedAt:         now.Format(time.RFC3339),
		UpdatedAt:         now.Format(time.RFC3339),
	}

	h.mu.Lock()
	h.notas[notaID] = nota
	h.mu.Unlock()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"nota_id":  notaID,
		"status":   "PROCESSANDO",
		"mensagem": "[SANDBOX] Nota aceita para processamento simulado",
	})
}

// ConsultarNota returns a simulated nota detail.
func (h *Handler) ConsultarNota(c *fiber.Ctx) error {
	id := c.Params("id")

	h.mu.RLock()
	nota, ok := h.notas[id]
	h.mu.RUnlock()

	if !ok {
		// Return a plausible fake if not found (e.g. from a previous session).
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "NOT_FOUND",
			"message": "[SANDBOX] Nota não encontrada (dados resetam a cada reinício)",
		})
	}
	return c.JSON(nota)
}

// ListarNotas returns the in-memory sandbox notas.
func (h *Handler) ListarNotas(c *fiber.Ctx) error {
	h.mu.RLock()
	list := make([]*fakeNota, 0, len(h.notas))
	for _, n := range h.notas {
		list = append(list, n)
	}
	h.mu.RUnlock()

	return c.JSON(fiber.Map{
		"data":   list,
		"total":  len(list),
		"limit":  20,
		"offset": 0,
	})
}

// ReceiveWebhook stores incoming webhook payloads for inspection (last 20).
func (h *Handler) ReceiveWebhook(c *fiber.Ctx) error {
	var body map[string]any
	if err := c.BodyParser(&body); err != nil {
		body = map[string]any{"raw": string(c.Body())}
	}

	record := webhookRecord{
		ReceivedAt: time.Now().UTC().Format(time.RFC3339),
		Body:       body,
	}

	h.mu.Lock()
	h.hooks = append(h.hooks, record)
	if len(h.hooks) > 20 {
		h.hooks = h.hooks[len(h.hooks)-20:]
	}
	h.mu.Unlock()

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"received": true})
}

// ListWebhooks returns received sandbox webhook payloads (for the playground UI).
func (h *Handler) ListWebhooks(c *fiber.Ctx) error {
	h.mu.RLock()
	out := make([]webhookRecord, len(h.hooks))
	copy(out, h.hooks)
	h.mu.RUnlock()

	return c.JSON(fiber.Map{
		"data":  out,
		"total": len(out),
	})
}

// randomCode returns an uppercase alphanumeric string of length n.
func randomCode(n int) string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.IntN(len(chars))]
	}
	return string(b)
}
