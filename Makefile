.PHONY: dev dev-stack dev-supabase test lint build \
        migrate migrate-local \
        deploy-staging deploy-prod rollback-api rollback-web \
        openapi-lint openapi-types \
        help

## ── Desenvolvimento local ───────────────────────────────────────────────────

## dev-stack: Sobe Redis + RabbitMQ via Docker Compose
dev-stack:
	docker compose up -d

## dev-supabase: Inicia Supabase local (PostgreSQL 15 + Auth + Studio)
dev-supabase:
	npx supabase start

## dev: Sobe toda a stack local (Docker + Supabase + API Go + Next.js)
dev: dev-stack dev-supabase
	npm run dev:apps

## ── Build e testes ──────────────────────────────────────────────────────────

## test: Roda testes Go (com -race) e testes Next.js em paralelo
test:
	cd apps/api && go test ./... -v -race
	cd apps/web && npm test

## lint: Lint Go (golangci-lint) + ESLint Next.js
lint:
	cd apps/api && golangci-lint run
	cd apps/web && npm run lint

## build: Compila API Go e faz build de produção do Next.js
build:
	cd apps/api && go build ./...
	cd apps/web && npm run build

## ── OpenAPI ─────────────────────────────────────────────────────────────────

## openapi-lint: Valida docs/openapi.yaml com @redocly/cli
openapi-lint:
	npm run openapi:lint

## openapi-types: Gera apps/web/lib/api-types.ts a partir do OpenAPI spec
openapi-types:
	npm run openapi:types

## ── Banco de dados ───────────────────────────────────────────────────────────

## migrate: Aplica migrations em produção (supabase db push)
migrate:
	npx supabase db push

## migrate-local: Recria banco local do zero (supabase db reset + seed)
migrate-local:
	npx supabase db reset

## ── Deploy ──────────────────────────────────────────────────────────────────

## deploy-staging: Deploy manual da API (Railway staging) + Web (Vercel preview)
deploy-staging:
	@echo "▶ Deploy API → Railway (staging)"
	@if [ -z "$$RAILWAY_TOKEN_STAGING" ]; then \
	  echo "RAILWAY_TOKEN_STAGING não definido — configure antes de rodar."; exit 1; \
	fi
	RAILWAY_TOKEN=$$RAILWAY_TOKEN_STAGING railway up --service api-staging
	@echo "▶ Deploy Web → Vercel (preview)"
	vercel --token=$$VERCEL_TOKEN --yes

## deploy-prod: Deploy manual da API (Railway prod) + Web (Vercel produção)
## ATENÇÃO: prefira o merge em main para acionar o CI/CD automático.
deploy-prod:
	@echo "▶ Deploy API → Railway (produção)"
	@if [ -z "$$RAILWAY_TOKEN" ]; then \
	  echo "RAILWAY_TOKEN não definido — configure antes de rodar."; exit 1; \
	fi
	RAILWAY_TOKEN=$$RAILWAY_TOKEN railway up --service api
	@echo "▶ Deploy Web → Vercel (produção)"
	vercel --prod --token=$$VERCEL_TOKEN --yes

## ── Rollback ────────────────────────────────────────────────────────────────

## rollback-api: Reverte o último deploy da API no Railway
## Uso: make rollback-api ENV=production  (ou ENV=staging)
rollback-api:
	@ENV=$${ENV:-production}; \
	if [ "$$ENV" = "staging" ]; then \
	  RAILWAY_TOKEN=$$RAILWAY_TOKEN_STAGING railway rollback; \
	else \
	  RAILWAY_TOKEN=$$RAILWAY_TOKEN railway rollback; \
	fi

## rollback-web: Reverte o último deploy do Web no Vercel
rollback-web:
	@echo "Acesse https://vercel.com/dashboard → seu projeto → Deployments → Promote anterior"
	@echo "Ou via CLI: vercel rollback --token=$$VERCEL_TOKEN"

## ── Ajuda ───────────────────────────────────────────────────────────────────

## help: Lista todos os targets com descrição
help:
	@grep -E '^## ' Makefile | sed 's/^## //'
