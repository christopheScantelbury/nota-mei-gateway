# Nota MEI Gateway — Auditoria FE & Tasks Reais

> **ScantelburyDevs** · Auditoria: 04/05/2026 · Branch `main`
> Substitui a análise anterior (que foi feita sem inspecionar o código autenticado).

---

## 1. Sumário executivo

A análise inicial listou **18 tasks** assumindo que dashboard, login, billing, certificado, API keys, webhooks, docs e legais não existiam. **Auditoria do código fonte mostrou que 11 dessas tasks já estão implementadas** — a análise anterior provavelmente foi feita inspecionando o site Vercel sem login (não enxerga rotas autenticadas) e sem ter as env vars do Supabase configuradas no Vercel.

**Resultado:**

| Categoria | Qtd | Issues |
|---|---|---|
| ✅ Já implementado — fechar issue | 11 | #127, #128, #129, #130, #133, #134, #135, #136, #137, #139, #141 |
| ⚠️ Parcial — manter com escopo reduzido | 5 | #131, #132, #138, #142, #143 |
| 🟢 Gap real — manter como estava | 1 | #140 |
| ❓ Decisão de produto necessária | 1 | #144 |

**Pontos pendentes operacionais (CLAUDE.md §13)** continuam bloqueando a validação real:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` ainda em branco no Vercel
- DNS `api.emitirnotafacil.com.br` não apontando

Sem isso, qualquer auditoria visual no Vercel produção vai parecer quebrada — é o que provavelmente induziu o erro de avaliação inicial.

---

## 2. Inventário do que existe (`apps/web/`)

### Rotas implementadas

```
✅ /                                    260 linhas
✅ /precos                              375 linhas
✅ /sandbox                             313 linhas — runDemo, tabs cURL/Node/Python, DEMO_KEY
✅ /privacidade                         161 linhas
✅ /termos                              162 linhas
✅ /docs                                125 linhas (índice)
✅ /docs/quickstart                     170 linhas
✅ /docs/webhooks                       179 linhas
✅ /docs/erros                          145 linhas
✅ /docs/ambientes                      145 linhas
✅ /docs/changelog                       86 linhas (1.0.0 + 1.1.0)
✅ /docs/referencia                     route.ts — Scalar UI via CDN, dark theme, 3 servidores

✅ /login                               via Magic Link (Supabase OTP) — 124 linhas client
✅ /recuperar-senha                     100 linhas
✅ /cadastro                            516 linhas — wizard 3 steps + MunicipioAutocomplete

✅ /home                                357 linhas — dashboard inicial com cards de resumo
✅ /notas                               246 linhas — listagem + filtros + StatusPoller
✅ /notas/[id]                          172 linhas — detalhe + cancelar + email
✅ /notas/nova                          527 linhas — emissão manual via UI
✅ /billing                             288 linhas — UsageChart + InvoiceList + CheckoutModal
✅ /billing/sucesso                      69 linhas
✅ /billing/cancelado                    57 linhas
✅ /templates                           108 linhas — modelos de nota
✅ /recorrencias                         75 linhas — automação
✅ /configuracoes                        47 linhas — abas: perfil, certificado, api-keys, webhook
```

### Componentes do design system

```
components/
├── dashboard/
│   ├── Sidebar.tsx                     — 5 nav items + badges PRO/BUSINESS + mobile hamburguer
│   ├── ConfiguracoesTabs.tsx           — 4 abas (perfil/certificado/api-keys/webhook)
│   ├── NotasFilterBar.tsx              — filtros de status + período
│   ├── NotaStatusPoller.tsx            — atualização automática PROCESSANDO
│   ├── NotaTimeline.tsx                — histórico de tentativas
│   ├── CancelarNotaButton.tsx          — modal de confirmação + Sonner toast
│   ├── ExportCSVButton.tsx             — exportar listagem
│   ├── EnviarNotaEmail.tsx             — reenvio por e-mail
│   ├── CheckoutModal.tsx               — Stripe Checkout
│   ├── InvoiceList.tsx                 — histórico de faturas
│   ├── UsageChart.tsx                  — barra de progresso + gráfico
│   ├── WebhookDeliveryLog.tsx          — histórico de entregas + retry
│   ├── OnboardingChecklist.tsx         — UX de primeiros passos
│   ├── PrimeiraNotaCelebration.tsx     — celebração da 1ª nota
│   ├── RecorrenciaModal.tsx            — config automação
│   └── TemplateModal.tsx               — config templates
├── landing/
│   ├── Navbar.tsx
│   ├── HeroSection.tsx                 — animado com framer-motion + reduced-motion
│   ├── SocialProof.tsx                 — 3 counters animados (2s, 99.9%, 5000+) + 7 logos infra + 4 cards segurança
│   └── AnimatedSection.tsx
├── nota/                               (vazio — convenção do CLAUDE.md, não usado)
└── ui/
    ├── Badge.tsx, Button.tsx, Card.tsx, Dialog.tsx
    ├── Input.tsx, Skeleton.tsx, Spinner.tsx, Tooltip.tsx
    ├── StatusBadge.tsx (+ stories)
    └── MunicipioAutocomplete.tsx
```

### API routes Next.js (proxy / BFF)

```
app/api/
├── billing/invoices         GET   — proxy Stripe
├── billing/portal           GET   — link Customer Portal
├── certificate              POST  — upload cert A1
├── keys                     GET/POST/DELETE — CRUD API Keys
├── nfse                     POST  — emissão (proxy)
├── notas/[id]/enviar-email  POST
├── notas/[id]/webhook/resend POST
├── profile                  PATCH — atualiza razão social
├── recorrencias/[id]        PUT/DELETE
└── templates / [id]         GET/POST/PUT/DELETE
```

### Toasts e feedback

- **Sonner** já usado em `CancelarNotaButton`, `EnviarNotaEmail`, `WebhookDeliveryLog`
- Componente `Toast` interno em `ConfiguracoesTabs` (success/error inline)

### Acessibilidade já implementada

- `lang="pt-BR"` no root layout
- `<main id="main-content" tabIndex={-1}>` (skip link target)
- `aria-current="page"` na sidebar
- `aria-label="Menu principal"` na nav
- Reduced-motion handling no Hero
- `sitemap.ts` em `app/`
- Metadata OpenGraph + Twitter card na landing

---

## 3. Gaps reais encontrados

### 🟢 Reais — manter issue

#### **#140 — FE-14 Página `/status`** — válido
**Não existe** rota `/status`. Único item da lista que é greenfield real.

### ⚠️ Parciais — refinar issue

#### **#131 — FE-05 API Keys** — refinar escopo
**O que existe:** CRUD via aba `/configuracoes`, criação com label, exibição UMA vez, revogação com confirm.
**Gaps:**
- [ ] Coluna `last_used_at` no banco + na UI
- [ ] Distinção visual entre `sk_live_` e `sk_test_` (hoje é só uma key por ambiente)
- [ ] Limite de keys exibido por plano (atualmente sem cap visível)

#### **#132 — FE-06 Webhooks** — refinar escopo
**O que existe:** URL padrão (TODO: localStorage), botão "Enviar payload de teste" funcional, `WebhookDeliveryLog` com histórico e retry.
**Gaps:**
- [ ] Persistir `webhook_url_padrao` no banco (coluna em `meis`) — TODO já no código (`ConfiguracoesTabs.tsx:411`)
- [ ] Endpoint backend para enviar teste assinado com HMAC (hoje envia direto do browser sem assinatura)
- [ ] Exibir o `WEBHOOK_HMAC_SECRET` mascarado + botão "Regenerar"
- [ ] Política de retry (5 tentativas + backoff) documentada na UI

#### **#138 — FE-12 Sandbox** — refinar escopo
**O que existe:** runDemo, fetchNota, 3 tabs de linguagem, DEMO_KEY copiável, rate limit info estática.
**Gaps:**
- [ ] Editor JSON editável (hoje payload é hardcoded no código)
- [ ] Histórico das últimas 10 chamadas (hoje só a última via `response`)
- [ ] Painel "Últimos webhooks recebidos" com polling em `GET /v1/sandbox/webhook`
- [ ] Feedback de rate limit usando header `X-RateLimit-Remaining`

#### **#142 — FE-16 A11y/SEO** — refinar escopo
**O que existe:** `lang="pt-BR"`, sitemap, metadata OG/Twitter, skip link target, reduced-motion.
**Gaps:**
- [ ] Rodar Lighthouse e atingir ≥ 90 (não medido)
- [ ] Schema.org JSON-LD `SoftwareApplication` na landing
- [ ] Auditar contraste de `--text-2: #8AA0B8` sobre `--navy-700: #142035` (suspeito de < 4.5:1)
- [ ] Confirmar `alt` em todos os ícones decorativos vs informativos
- [ ] `canonical` em todas as páginas (hoje só na landing)

#### **#143 — FE-17 Notificações** — refinar escopo
**O que existe:** Sonner para toasts transientes, componente `Toast` inline em algumas abas.
**Gaps:**
- [ ] Bell icon no header com badge de contagem
- [ ] Persistência server-side (tabela `notificacoes` + endpoint)
- [ ] Eventos: certificado expirando, limite 80%/100%, webhook falhou repetidamente
- [ ] "Marcar como lida" individual e em massa

### ❓ Discutir antes de implementar

#### **#144 — FE-18 Dark Mode**
A identidade visual definida no CLAUDE.md §7 é dark-first (`--navy-900` como background base, `--text-1: #EEF4FF` para títulos). Adicionar light mode é **mudança de identidade visual**, não polimento.

**Decisão necessária do produto:** queremos light mode ou mantemos dark-only como diferencial estético? Se mantivermos dark-only, fechar #144 como "wontfix".

### ❌ Já implementado — fechar issue

| Issue | Tarefa | Comentário |
|---|---|---|
| **#127** | FE-01 Login | ✅ Existe via Magic Link Supabase (arquitetura definida no CLAUDE.md §2 — não é email+senha) |
| **#128** | FE-02 Wizard cadastro | ✅ Os 3 steps existem com validação, MunicipioAutocomplete, exibição da API Key uma vez |
| **#129** | FE-03 Dashboard estrutura | ✅ Sidebar (5 itens), layout com auth, mobile hamburguer, header com razão social |
| **#130** | FE-04 Listagem NFS-e | ✅ Tabela + filtros + drawer detalhe + StatusPoller + cancelar + ExportCSV |
| **#133** | FE-07 Plano e Billing | ✅ Card plano + UsageChart + InvoiceList + CheckoutModal + portal Stripe |
| **#134** | FE-08 Certificado A1 | ✅ Aba em `/configuracoes` com `daysUntil`, alerta de expiração, upload |
| **#135** | FE-09 Docs Referência | ✅ Scalar API Reference via CDN, 3 servers, dark theme com brand tokens |
| **#136** | FE-10 Changelog | ✅ Versões 1.0.0 e 1.1.0 documentadas com badges feat/fix/break |
| **#137** | FE-11 Docs Ambientes | ✅ 145 linhas de documentação |
| **#139** | FE-13 Landing métricas | ✅ Counters animados (2s, 99.9%, 5000+), useInView, reduced-motion |
| **#141** | FE-15 Privacidade/Termos | ✅ Ambas as páginas existem com conteúdo LGPD/legal |

---

## 4. Roadmap revisado

### Sprint Z (resgate operacional — fora deste board, ver CLAUDE.md §13)
1. Configurar `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` no Vercel
2. CNAME `api.emitirnotafacil.com.br` → `api-production-73b1.up.railway.app`
3. `supabase db push` aplicando migrations no projeto produção

### Sprint 1 (gaps reais identificados — 7 issues, ~18 pts)

| Issue | Tarefa | Pts |
|---|---|---|
| #131 | FE-05 API Keys — `last_used_at` + split live/test + plan limit | 3 |
| #132 | FE-06 Webhooks — persistência + endpoint de teste assinado + secret display | 3 |
| #138 | FE-12 Sandbox — editor JSON + histórico + polling webhooks | 5 |
| #140 | FE-14 Página `/status` (greenfield) | 3 |
| #142 | FE-16 A11y/SEO — Lighthouse + JSON-LD + auditoria de contraste | 2 |
| #143 | FE-17 Notificações persistentes (bell icon + tabela `notificacoes`) | 3 |
| #144 | FE-18 Dark mode — **decisão de produto antes** | — |

---

## 5. Como aplicar

```bash
# Fechar issues já resolvidas
for n in 127 128 129 130 133 134 135 136 137 139 141; do
  gh issue close $n --reason "completed" \
    --comment "Auditoria 04/05/2026 confirmou implementação completa em apps/web/. Detalhes em nota-mei-tasks.md."
done

# Atualizar issues parciais com novo escopo (ver seção 3)
# As issues #131, #132, #138, #142, #143 ganham comentário de refinamento
```

---

*Auditoria executada em 04/05/2026 sobre `apps/web/app/` e `apps/web/components/`.*
