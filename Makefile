.PHONY: dev test lint build migrate migrate-local

dev:
	@echo "→ Iniciando ambiente de desenvolvimento..."
	supabase start &
	cd apps/api && go run ./cmd/server &
	cd apps/web && npm run dev

test:
	cd apps/api && go test ./... -v -race
	cd apps/web && npm test

lint:
	cd apps/api && golangci-lint run
	cd apps/web && npm run lint

build:
	cd apps/api && go build ./...
	cd apps/web && npm run build

migrate:
	supabase db push

migrate-local:
	supabase db reset
