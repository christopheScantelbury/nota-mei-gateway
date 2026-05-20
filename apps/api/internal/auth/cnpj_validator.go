package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const (
	cnpjCacheTTL    = 24 * time.Hour
	cnpjAPITimeout  = 5 * time.Second
	cnpjCachePrefix = "cnpj:validate:"

	// Cache sentinel values stored in Redis.
	cacheValMEI     = "MEI"
	cacheValNotMEI  = "NOT_MEI"
	cacheValInvalid = "INVALID"
)

// ErrInvalidCNPJ is returned when the CNPJ fails the check-digit algorithm.
var ErrInvalidCNPJ = errors.New("CNPJ inválido")

// ErrNotMEI is returned when the CNPJ belongs to a company that is not a MEI.
var ErrNotMEI = errors.New("CNPJ não pertence a um MEI")

// CNPJValidator validates CNPJ check digits and confirms the company is a MEI
// via the public Receita Federal API. Results are cached in Redis for 24 h.
type CNPJValidator struct {
	rdb    *redis.Client
	client *http.Client
	apiURL string // base URL, e.g. "https://publica.cnpj.ws"
}

// NewCNPJValidator creates a validator connected to the given Redis URL.
// Prefer NewCNPJValidatorWithClient when a shared *redis.Client already exists.
func NewCNPJValidator(redisURL string) (*CNPJValidator, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("cnpj_validator: parse redis url: %w", err)
	}
	return &CNPJValidator{
		rdb:    redis.NewClient(opt),
		client: &http.Client{Timeout: cnpjAPITimeout},
		apiURL: "https://publica.cnpj.ws",
	}, nil
}

// NewCNPJValidatorWithClient creates a validator using the provided Redis client.
// Use this to share a single connection pool across multiple components.
func NewCNPJValidatorWithClient(rdb *redis.Client) *CNPJValidator {
	return &CNPJValidator{
		rdb:    rdb,
		client: &http.Client{Timeout: cnpjAPITimeout},
		apiURL: "https://publica.cnpj.ws",
	}
}

// Validate checks the CNPJ check digits and then confirms it is a MEI via
// the Receita Federal API. Returns ErrInvalidCNPJ or ErrNotMEI on rejection.
// On API timeout the check is skipped (fail-open) to avoid blocking legitimate
// registrations when the RF service is unavailable.
func (v *CNPJValidator) Validate(ctx context.Context, cnpj string) error {
	if !checkDigits(cnpj) {
		return ErrInvalidCNPJ
	}

	// Check Redis cache.
	cacheKey := cnpjCachePrefix + cnpj
	cached, err := v.rdb.Get(ctx, cacheKey).Result()
	if err == nil {
		return sentinelToError(cached)
	}

	// Call Receita Federal API.
	result, err := v.fetchPorte(ctx, cnpj)
	if err != nil {
		// Fail-open on timeout / RF unavailable — log and allow.
		log.Ctx(ctx).Warn().Err(err).Str("cnpj", cnpj).
			Msg("cnpj_validator: RF API unavailable, skipping MEI check")
		return nil
	}

	// Cache and return.
	_ = v.rdb.Set(ctx, cacheKey, result, cnpjCacheTTL).Err()
	return sentinelToError(result)
}

// rfResponse is the subset of the cnpj.ws response we need.
//
// publica.cnpj.ws returns MEI status in two places depending on the endpoint:
//   - simples.mei == "S"  → primary indicator (root CNPJ endpoint)
//   - porte.descricao == "MEI" → some establishment-level responses
//
// We check both to be resilient against API format variations.
type rfResponse struct {
	Porte struct {
		Descricao string `json:"descricao"`
	} `json:"porte"`
	Simples struct {
		MEI string `json:"mei"` // "S" = MEI, "N" = não MEI
	} `json:"simples"`
}

// fetchPorte calls publica.cnpj.ws and returns a cache sentinel value.
func (v *CNPJValidator) fetchPorte(ctx context.Context, cnpj string) (string, error) {
	url := v.apiURL + "/cnpj/" + cnpj
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "NotaMEIGateway/1.0")

	resp, err := v.client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return "", fmt.Errorf("RF API returned HTTP %d", resp.StatusCode)
	}
	if resp.StatusCode == http.StatusNotFound {
		return cacheValInvalid, nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return "", err
	}

	var r rfResponse
	if err := json.Unmarshal(body, &r); err != nil {
		return "", fmt.Errorf("cnpj_validator: unmarshal: %w", err)
	}

	if r.Simples.MEI == "S" || r.Porte.Descricao == "MEI" {
		return cacheValMEI, nil
	}
	return cacheValNotMEI, nil
}

// sentinelToError converts a Redis cache sentinel value back to an error.
func sentinelToError(sentinel string) error {
	switch sentinel {
	case cacheValMEI:
		return nil
	case cacheValInvalid:
		return ErrInvalidCNPJ
	default: // cacheValNotMEI or unknown
		return ErrNotMEI
	}
}

// checkDigits validates the two CNPJ check digits.
// cnpj must be exactly 14 ASCII digit characters.
func checkDigits(cnpj string) bool {
	if len(cnpj) != 14 {
		return false
	}
	for _, c := range cnpj {
		if c < '0' || c > '9' {
			return false
		}
	}
	// All-same-digit CNPJs are structurally invalid.
	allSame := true
	for i := 1; i < 14; i++ {
		if cnpj[i] != cnpj[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}
	return calcDigit(cnpj, 12) == int(cnpj[12]-'0') &&
		calcDigit(cnpj, 13) == int(cnpj[13]-'0')
}

// calcDigit computes the CNPJ check digit at position pos (12 or 13).
func calcDigit(cnpj string, pos int) int {
	weights := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	if pos == 13 {
		weights = []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	}
	sum := 0
	for i := 0; i < pos; i++ {
		sum += int(cnpj[i]-'0') * weights[i]
	}
	rem := sum % 11
	if rem < 2 {
		return 0
	}
	return 11 - rem
}
