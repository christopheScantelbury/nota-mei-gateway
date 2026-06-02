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
- [⚠️] **HIST-7.3** — Dashboard Looker Studio — *placeholder em `docs/audits/looker-dashboard-2026-06.md`*
- [⚠️] **HIST-6.0** — Auditoria Brevo — *placeholder em `docs/audits/brevo-audit-2026-06.md`*
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
- [⚠️] **HIST-6.2** — Templates de e-mails de onboarding — *criação no painel Brevo (lib/brevo/templates.ts já mapeado)*
- [x] **HIST-5.0** — Componentes MDX reutilizáveis (Callout, CTABanner) + estrutura content/blog. Velite instala sob demanda quando 1º post MDX for criado

## Sprint 3 — Comparativo + Urgência ME/EPP + Feature flags

- [⚠️] **HIST-6.3** — Campanha urgência ME/EPP T-60→T-1 — *flags em empresas/meis (`unsubscribed_urgency*`) já criadas na migration 20260602000001; templates 201–206 mapeados em `lib/brevo/templates.ts`; automation no painel Brevo*
- [x] **HIST-4.1** — Componente CompetitorTable (full/summary + competitorsFilter)
- [x] **HIST-4.2** — Página /comparativo com FAQ + 3 cards + JSON-LD WebPage+FAQPage + sitemap
- [x] **HIST-4.3** — Embed CompetitorTable variant=summary na home
- [x] **HIST-4.4** — Post piloto `content/blog/notafacil-vs-focus-nfe.mdx` + componentes VsHero + MigrationCTA + Callout + CompetitorTable competitorsFilter
- [x] **HIST-7.4** — Feature flags: migration `20260602000002_feature_flags.sql` + `lib/flags/{hash,index,useFeatureFlag}.ts` + `/api/flags/[key]` + 2 seeds (`hero_copy_variant`, `sandbox_in_main_nav`)
- [⚠️] **HIST-5.1** — Auditoria SEO baseline — *placeholder em `docs/audits/seo-baseline-2026-06.md`*
- [x] **HIST-5.2** — `lib/seo/jsonLd.ts` (articleJsonLd + webPageJsonLd) — pronto pra plugar em posts

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
- Audits offline em `docs/audits/`:
  - `ga4-audit-2026-06.md` (HIST-7.1)
  - `brevo-audit-2026-06.md` (HIST-6.0)
  - `looker-dashboard-2026-06.md` (HIST-7.3)
  - `seo-baseline-2026-06.md` (HIST-5.1)

## Resumo final

**Em código**: 17 de 22 histórias (~77%) ✅
- Sprint 1: HIST-7.1, 7.2, 1.1, 1.2, 1.3, 1.4 + bônus 3.1
- Sprint 2: HIST-2.1, 2.2, 2.3, 3.2, 3.3, 6.1, 5.0
- Sprint 3: HIST-4.1, 4.2, 4.3, 4.4, 7.4, 5.2

**Dependem de painéis externos** (docs prontos):
- HIST-6.0 (audit Brevo), HIST-6.2 (templates Brevo), HIST-6.3 (régua urgência Brevo),
  HIST-7.3 (Looker), HIST-5.1 (SEO baseline Lighthouse)

## Env vars a configurar no Vercel
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<token GSC>
BREVO_API_KEY=xkeysib-...
CRON_SECRET=<random hex 64>
```
