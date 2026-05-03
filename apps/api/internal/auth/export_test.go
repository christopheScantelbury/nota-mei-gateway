package auth

import (
	"context"

	"github.com/google/uuid"
)

// ExportedValidateJWT exposes validateJWT for external package tests.
func ExportedValidateJWT(ctx context.Context, supabaseURL, serviceRoleKey, jwt string) (uuid.UUID, error) {
	return validateJWT(ctx, supabaseURL, serviceRoleKey, jwt)
}
