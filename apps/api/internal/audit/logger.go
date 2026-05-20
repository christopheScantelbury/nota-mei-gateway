package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type AuditLogger struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *AuditLogger {
	return &AuditLogger{db: db}
}

type LogEntry struct {
	UserID    string
	EmpresaID string
	Produto   string // MEI_DASHBOARD | ME_DASHBOARD | API_GATEWAY | ADMIN
	Acao      string
	Metadata  map[string]any
	IPOrigem  string
}

// auditTimeout is the maximum time the async goroutine may wait for a DB
// connection and execute the INSERT. Without a deadline, a saturated connection
// pool would leave audit goroutines hanging indefinitely, slowly leaking goroutines
// and memory. 5 s is generous — a healthy Supabase pooler responds in < 100 ms.
const auditTimeout = 5 * time.Second

// Log writes an audit entry asynchronously. Errors are logged but never
// propagate to the caller — audit failures must not break business flows.
func (a *AuditLogger) Log(_ context.Context, e LogEntry) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), auditTimeout)
		defer cancel()

		meta, _ := json.Marshal(e.Metadata)
		_, err := a.db.Exec(ctx,
			`INSERT INTO audit_log (user_id, empresa_id, produto, acao, metadata, ip_origem)
			 VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, $3, $4, $5, $6)`,
			e.UserID, e.EmpresaID, e.Produto, e.Acao, meta, e.IPOrigem,
		)
		if err != nil {
			log.Error().Err(err).Str("acao", e.Acao).Msg("audit log failed")
		}
	}()
}
