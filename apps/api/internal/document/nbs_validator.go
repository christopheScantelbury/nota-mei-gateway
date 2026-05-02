package document

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const (
	// nbsRedisKey is the Redis SET that holds all valid 8-digit NBS codes.
	nbsRedisKey = "nbs:codes"
)

// reNBSWithDots matches the canonical user-facing format: XX.XX.XX.XX
var reNBSWithDots = regexp.MustCompile(`^\d{2}\.\d{2}\.\d{2}\.\d{2}$`)

// reNBSDigits matches the stripped 8-digit form: XXXXXXXX
var reNBSDigits = regexp.MustCompile(`^\d{8}$`)

// ErrInvalidNBS is returned when a code does not exist in the NBS table.
var ErrInvalidNBS = errors.New("código NBS inválido")

// NBSValidator validates NBS codes using Redis as primary cache and the DB
// as fallback. Call Warm once at startup to populate the Redis SET.
type NBSValidator struct {
	rdb *redis.Client
	db  *pgxpool.Pool
}

// NewNBSValidator creates a validator connected to the given Redis URL and DB pool.
func NewNBSValidator(redisURL string, db *pgxpool.Pool) (*NBSValidator, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("nbs_validator: parse redis url: %w", err)
	}
	return &NBSValidator{rdb: redis.NewClient(opt), db: db}, nil
}

// Warm loads all NBS codes from the database into the Redis SET.
// It is idempotent — safe to call at every startup.
func (v *NBSValidator) Warm(ctx context.Context) error {
	rows, err := v.db.Query(ctx, `SELECT codigo FROM codigos_nbs`)
	if err != nil {
		return fmt.Errorf("nbs warm: query: %w", err)
	}
	defer rows.Close()

	var codes []interface{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return fmt.Errorf("nbs warm: scan: %w", err)
		}
		codes = append(codes, c)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("nbs warm: rows: %w", err)
	}
	if len(codes) == 0 {
		return nil
	}
	return v.rdb.SAdd(ctx, nbsRedisKey, codes...).Err()
}

// Validate checks that codigoNBS is a valid, known NBS code.
// Accepts both the dotted form (XX.XX.XX.XX) and the 8-digit form (XXXXXXXX).
// Returns ErrInvalidNBS when the code is unknown.
func (v *NBSValidator) Validate(ctx context.Context, codigoNBS string) error {
	code := normalizeNBS(codigoNBS)
	if code == "" {
		return ErrInvalidNBS
	}

	// Redis lookup (fast path).
	ok, err := v.rdb.SIsMember(ctx, nbsRedisKey, code).Result()
	if err == nil {
		if !ok {
			return ErrInvalidNBS
		}
		return nil
	}

	// DB fallback when Redis is unavailable.
	var exists bool
	dbErr := v.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM codigos_nbs WHERE codigo = $1)`, code,
	).Scan(&exists)
	if dbErr != nil {
		return fmt.Errorf("nbs validate: db fallback: %w", dbErr)
	}
	if !exists {
		return ErrInvalidNBS
	}
	return nil
}

// normalizeNBS strips dots and validates the resulting string.
// Returns "" for any format that is not valid.
func normalizeNBS(code string) string {
	if reNBSWithDots.MatchString(code) {
		return strings.ReplaceAll(code, ".", "")
	}
	if reNBSDigits.MatchString(code) {
		return code
	}
	return ""
}
