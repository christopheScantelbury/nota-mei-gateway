# Roadmap Lançamento NotaFácil v1
> Tracker das 22 histórias do pacote `NotaFacil-Specs-v1/`.
> Atualizado a cada PR/commit.

## Legenda
- [ ] pendente
- [x] concluído
- [~] em progresso
- [⚠️] depende de config externa (Brevo painel, Looker, etc.)

---

## Sprint 1 — Tracking + Hero (P0)

- [x] **HIST-7.1** — Auditoria GA4 + consent banner LGPD (`components/consent/CookieBanner`, `lib/analytics/consent.ts`)
- [x] **HIST-7.2** — Eventos de conversão por persona (`lib/analytics/events.ts` + instrumentação no Hero)
- [⚠️] **HIST-7.3** — Dashboard Looker Studio — *config externa, não código*
- [⚠️] **HIST-6.0** — Auditoria Brevo — *doc audit + painel*
- [x] **HIST-1.1** — Top bar urgência regulatória (`UrgencyTopBar` + `(landing)/layout.tsx`)
- [x] **HIST-1.2** — Componente PioneerBadge (`components/badges/PioneerBadge.tsx`)
- [x] **HIST-1.3** — Contagem regressiva Set/2026 (`components/countdown/CountdownSet2026.tsx`)
- [x] **HIST-1.4** — Reescrita copy do hero (textos do `03-Copies-Finais.md`)

## Sprint 2 — Pricing + Sandbox + E-mail

- [x] **HIST-2.1** — PricingSection 3 colunas (`components/pricing/`)
- [x] **HIST-2.2** — Card ME/EPP com plano âncora (destaque visual + badge)
- [x] **HIST-2.3** — Card Dev/Gateway com plano âncora
- [x] **HIST-3.1** — CTA sandbox no card Gateway do hero (adiantado no Sprint 1 junto do hero)
- [x] **HIST-3.2** — Item Sandbox no menu principal (dropdown Gateway API com submenu)
- [x] **HIST-3.3** — Hero /gateway com sandbox como CTA primário + snippet curl com copy
- [x] **HIST-6.1** — Brevo queue + worker Vercel Cron (migration `20260602000001`, lib/brevo/*, hook em /auth/callback)
- [⚠️] **HIST-6.2** — Templates de e-mails de onboarding — *criação no painel Brevo*
- [ ] **HIST-5.0** — Setup do blog em MDX (velite + rotas)

## Sprint 3 — Comparativo + Urgência ME/EPP + Feature flags

- [⚠️] **HIST-6.3** — Campanha urgência ME/EPP T-60→T-1 (migration 004 + automation Brevo)
- [ ] **HIST-4.1** — Componente CompetitorTable
- [ ] **HIST-4.2** — Página /comparativo
- [ ] **HIST-4.3** — Embed do comparativo na home
- [ ] **HIST-4.4** — Template MDX "NotaFácil vs X" + post piloto Focus NFe
- [ ] **HIST-7.4** — Sistema caseiro de feature flags (migration 001)
- [⚠️] **HIST-5.1** — Auditoria SEO baseline — *doc audit*
- [ ] **HIST-5.2** — Schema.org Article nos posts

---

## Marcos críticos
- **30/06/2026** — todos P0 em produção
- **03/07/2026** — disparo T-60 ME/EPP
- **31/08/2026** — comparativo + SEO indexados
- **01/09/2026** — vigência NFS-e Nacional (modo "obrigatório vigente")

## Notas de execução
- Convenção de commits: `feat(scope): HIST-X.Y descrição`
- Arquivos das specs em `NotaFacil-Specs-v1/`
- Decisões fechadas em `08-Decisoes-Fechadas.md` — fonte da verdade
