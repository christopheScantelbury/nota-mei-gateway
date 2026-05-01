// Package auth implements API key generation, hashing and Bearer token middleware.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

const (
	// PrefixLive is the prefix for production API keys.
	PrefixLive = "sk_live_"
	// PrefixTest is the prefix for sandbox API keys.
	PrefixTest = "sk_test_"
)

// GenerateKey creates a new 64-hex-char API key with the given prefix.
// Returns the plaintext key (shown once to the user) and its SHA-256 hash for storage.
func GenerateKey(live bool) (key, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	prefix := PrefixTest
	if live {
		prefix = PrefixLive
	}
	key = prefix + hex.EncodeToString(buf)
	hash = HashKey(key)
	return
}

// HashKey returns the lowercase hex-encoded SHA-256 hash of a raw API key.
func HashKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// IsLive reports whether the key carries the live prefix.
func IsLive(key string) bool {
	return len(key) >= len(PrefixLive) && key[:len(PrefixLive)] == PrefixLive
}

// PrefixOf returns "sk_live_" or "sk_test_" from a raw key.
func PrefixOf(key string) string {
	if IsLive(key) {
		return PrefixLive
	}
	return PrefixTest
}

// ErrInvalidKey is returned when API key validation fails.
type ErrInvalidKey struct{ Reason string }

// Error implements the error interface.
func (e ErrInvalidKey) Error() string {
	return fmt.Sprintf("invalid API key: %s", e.Reason)
}
