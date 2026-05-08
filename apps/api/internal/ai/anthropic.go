// Package ai integra com a API Anthropic (Claude Haiku 4.5 por custo-benefício).
// Suporta prompt caching (1h TTL) — reduz ~10x o custo em prompts repetidos.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Modelo padrão. Haiku 4.5 = melhor custo-benefício para classificação curta.
// $1 / MTok input · $5 / MTok output (Anthropic, jan/2026).
const ModelHaiku45 = "claude-haiku-4-5-20251001"

const apiURL = "https://api.anthropic.com/v1/messages"
const apiVersion = "2023-06-01"

// Client é um cliente HTTP minimalista para a Anthropic Messages API.
type Client struct {
	apiKey string
	http   *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 25 * time.Second},
	}
}

// Enabled informa se o cliente tem API key — útil para no-op em dev.
func (c *Client) Enabled() bool { return c != nil && c.apiKey != "" }

// ── Tipos do protocolo Anthropic ────────────────────────────────────────────

type ContentBlock struct {
	Type         string                 `json:"type"`
	Text         string                 `json:"text,omitempty"`
	CacheControl *CacheControl          `json:"cache_control,omitempty"`
	// Os campos abaixo são respostas; ignorados em requests.
	ID    string                 `json:"id,omitempty"`
	Input map[string]interface{} `json:"input,omitempty"`
}

type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
}

type Message struct {
	Role    string         `json:"role"`
	Content []ContentBlock `json:"content"`
}

type Request struct {
	Model         string         `json:"model"`
	MaxTokens     int            `json:"max_tokens"`
	System        []ContentBlock `json:"system,omitempty"`
	Messages      []Message      `json:"messages"`
	Temperature   float64        `json:"temperature,omitempty"`
}

type Response struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	Role       string         `json:"role"`
	Model      string         `json:"model"`
	Content    []ContentBlock `json:"content"`
	StopReason string         `json:"stop_reason"`
	Usage      Usage          `json:"usage"`
}

type Usage struct {
	InputTokens             int `json:"input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	OutputTokens             int `json:"output_tokens"`
}

// Send envia a mensagem e retorna a resposta. Não trata streaming.
func (c *Client) Send(ctx context.Context, req Request) (*Response, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("anthropic: API key não configurada")
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", apiVersion)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("anthropic: status %d: %s", resp.StatusCode, string(respBody))
	}
	var out Response
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("anthropic: decode: %w (body=%s)", err, string(respBody))
	}
	return &out, nil
}

// FirstText retorna o primeiro bloco de texto da resposta (útil para JSON).
func (r *Response) FirstText() string {
	for _, c := range r.Content {
		if c.Type == "text" {
			return c.Text
		}
	}
	return ""
}
