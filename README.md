# Nota MEI Gateway

API REST em Go (Fiber) para emissão de NFS-e para MEI, com dashboard Next.js, Supabase, Railway, Vercel e Stripe — [ScantelburyDevs](https://scantelburydevs.com.br).

## Pré-requisitos

- [Go](https://go.dev/dl/) 1.25+ (API)
- [Node.js](https://nodejs.org/) 20+
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- `golangci-lint` (opcional localmente; o CI instala)


## Setup local

1. Clonar o repositório e instalar dependências Node na raiz:

   ```bash
   npm ci
   ```

2. Copiar variáveis de ambiente (preenche chaves reais onde aplicável):

   ```bash
   cp .env.example .env
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   Exporta as variáveis antes de subir a API (ex.: `set -a && source .env && set +a` em bash, ou carrega com a tua ferramenta preferida).

3. Subir Redis e RabbitMQ e aplicar o schema local:

   ```bash
   make dev-stack
   make dev-supabase
   supabase db reset
   ```

   - Studio: `http://127.0.0.1:54323`
   - Postgres (pooler local típico): porta `54322` (ajusta `DATABASE_URL` no `.env` se o CLI mostrar outra)
   - RabbitMQ management: `http://127.0.0.1:15672` (user/pass `guest`/`guest`)

4. Arrancar API + web em paralelo:

   ```bash
   make dev
   ```

   Equivale a `make dev-stack`, `supabase start` e `npm run dev:apps` (API em `:8080` e Next em `:3000`).

   Só Next (sem Docker / Go): `npm run dev` na raiz (Turbo, workspace `apps/web`).

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `make dev-stack` | Só Redis + RabbitMQ (Docker) |
| `make dev-supabase` | Só Supabase local |
| `make dev` | Stack + Supabase + API + web |
| `make test` | Testes API + web |
| `make lint` | Lint API + web |
| `make build` | Build API + web |
| `make migrate` | `supabase db push` (projeto remoto após `supabase link`) |
| `make migrate-local` | `supabase db reset` (migrations + seed) |

## Monorepo

- `apps/api` — serviço Go (Railway)
- `apps/web` — Next.js 14 (Vercel)
- `supabase/` — migrations e `SECURITY.md` (RLS)

Variáveis da API: ver `.env.example` e `apps/api/.env.example`. Painel Railway: comentários em `apps/api/railway.toml`.

Dashboard (Vercel): define no painel Vercel as variáveis `NEXT_PUBLIC_*` listadas em `apps/web/.env.local.example` (não commits com secrets).

## Documentação

- `CLAUDE.md` — manifesto técnico e ordem de execução dos épicos
- `docs/architecture.md` — visão de arquitetura

## Licença

Proprietário — ScantelburyDevs.
