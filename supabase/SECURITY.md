# Segurança — RLS e papéis (Supabase)

## Papéis

| Papel | Uso | RLS |
|--------|-----|-----|
| `anon` | Cliente sem sessão (ex.: landing) | Aplicado |
| `authenticated` | Dashboard com JWT Supabase Auth | Aplicado |
| `service_role` | API Go (chave service_role) | Bypass (usar só no servidor) |

## Políticas (resumo)

- `notas_fiscais`, `api_keys`, `emissoes_mensais`: acesso apenas onde `mei_id = auth.uid()` (ou `meis.id = auth.uid()`).
- `meis`: o utilizador só vê/altera a linha em que `id = auth.uid()` (o UUID do Auth deve coincidir com `meis.id` no cadastro).
- `planos`: `SELECT` público (`USING (true)`).
- `stripe_events`: sem políticas para JWT; só `service_role` tem `GRANT` explícito (deduplicação de webhooks Stripe na API).

## Teste manual de isolamento (MEI A vs MEI B)

1. `supabase start` e `supabase db reset` localmente.
2. Criar dois utilizadores em Auth (Studio ou API) e duas linhas em `meis` com `id` igual ao `auth.users.id` de cada um.
3. Com o JWT do utilizador A no header `Authorization: Bearer <access_token>`, via PostgREST ou SQL como `authenticated`, consultar `notas_fiscais`: não devem aparecer linhas com `mei_id` do utilizador B.
4. Repetir com o JWT de B: não ver dados de A.

Consultas SQL diretas como `postgres` ignoram RLS; o teste tem de ser com o papel `authenticated` (ou cliente Supabase com sessão).

## API Go

Usar sempre `SUPABASE_SERVICE_ROLE_KEY` no servidor para operações que precisam de bypass controlado de RLS. Nunca expor essa chave no Next.js cliente.
