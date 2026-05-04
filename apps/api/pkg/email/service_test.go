package email_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/rs/zerolog"
)

// captureServer saves the raw JSON payload of the last request.
func captureServer(t *testing.T) (srv *httptest.Server, payload *map[string]any) {
	t.Helper()
	var captured map[string]any
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/emails" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Errorf("failed to decode body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"email-abc"}`))
	}))
	return srv, &captured
}

// TestSendBoasVindas_PostsCorrectJSON verifies that SendBoasVindas makes a
// POST to /emails with the expected JSON fields.
func TestSendBoasVindas_PostsCorrectJSON(t *testing.T) {
	srv, payload := captureServer(t)
	defer srv.Close()

	c := email.NewWithBase("test-key", "Test <test@example.com>", srv.URL, srv.Client())
	svc := email.NewService(c, zerolog.Nop())

	err := svc.SendBoasVindas(context.Background(), "mei@example.com", "MEI Ltda", "12345678000195", "sk_live_abc123")
	if err != nil {
		t.Fatalf("SendBoasVindas returned error: %v", err)
	}

	if *payload == nil {
		t.Fatal("no payload captured")
	}
	p := *payload

	if to, ok := p["to"].([]any); !ok || len(to) == 0 || to[0] != "mei@example.com" {
		t.Errorf("unexpected to: %v", p["to"])
	}
	subj, _ := p["subject"].(string)
	if subj == "" {
		t.Error("subject is empty")
	}
	html, _ := p["html"].(string)
	if html == "" {
		t.Error("html is empty")
	}
	from, _ := p["from"].(string)
	if from != "Test <test@example.com>" {
		t.Errorf("unexpected from: %s", from)
	}
}

// TestSendBoasVindas_DevMode verifies that an empty apiKey skips the HTTP
// call and returns no error.
func TestSendBoasVindas_DevMode(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"should-not-reach"}`))
	}))
	defer srv.Close()

	// Empty apiKey → dev-noop mode.
	c := email.NewWithBase("", "noop@example.com", srv.URL, srv.Client())
	svc := email.NewService(c, zerolog.Nop())

	err := svc.SendBoasVindas(context.Background(), "mei@example.com", "MEI Ltda", "12345678000195", "sk_live_abc")
	if err != nil {
		t.Fatalf("expected no error in dev mode, got: %v", err)
	}
	if called {
		t.Error("HTTP server was called in dev-noop mode")
	}
}

// TestSend_HTTPError verifies that a non-2xx response from Resend is
// propagated as an error.
func TestSend_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"name":"unauthorized","message":"API key is invalid"}`))
	}))
	defer srv.Close()

	c := email.NewWithBase("bad-key", "from@example.com", srv.URL, srv.Client())
	svc := email.NewService(c, zerolog.Nop())

	err := svc.SendBoasVindas(context.Background(), "user@example.com", "MEI", "12345678000195", "sk_live_x")
	if err == nil {
		t.Fatal("expected error for HTTP 401, got nil")
	}
}
