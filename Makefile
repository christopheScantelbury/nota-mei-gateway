.PHONY: dev dev-stack dev-supabase test lint build migrate migrate-local

dev-stack:
	docker compose up -d

dev-supabase:
	npx supabase start

dev: dev-stack dev-supabase
	npm run dev:apps

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
	npx supabase db push

migrate-local:
	npx supabase db reset
