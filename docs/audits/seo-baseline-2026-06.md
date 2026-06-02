# Auditoria SEO baseline — 2026-06
> HIST-5.1 do pacote `NotaFacil-Specs-v1`.

## 1. Rotas principais (a rodar Lighthouse)

| Rota | Lighthouse a coletar | Schema.org | OG image |
|---|---|---|---|
| `/` | A medir | OrgStructuredData ✅ | ✅ |
| `/mei` | A medir | SoftwareApp + FAQ ✅ | ✅ |
| `/me` | A medir | ✅ | ✅ |
| `/gateway` | A medir | SoftwareApp + FAQ ✅ | ✅ |
| `/precos` | A medir | — | ✅ |
| `/blog` | A medir | — | ✅ |
| `/comparativo` | A medir | WebPage + FAQPage ✅ (HIST-4.2) | ✅ |
| `/blog/<slug>` | A medir | Article via `articleJsonLd` (HIST-5.2) | ✅ |

## 2. Sitemap.xml + robots.txt

- `app/sitemap.ts` — gera sitemap com priority/changeFrequency por rota.
- `/comparativo` registrado com priority 0.8 ✅ (HIST-4.2)
- Posts do blog incluídos automaticamente via `BLOG_POSTS`
- `app/robots.ts` — verificar se existe e bloqueia `/api/*`, `/admin/*`

## 3. Search Console

- A integrar `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` no Vercel
- Subir property + sitemap

## 4. Gaps & recomendações priorizadas

### P0 (lançamento)
- [ ] Configurar `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` + Bing
- [ ] Verificar que todas as páginas têm `alternates: { canonical }` no `metadata`
- [ ] OG image dedicada para `/comparativo` (`/og/og-comparativo-1200x630.png`)

### P1 (pós-lançamento)
- [ ] `app/robots.ts` valida bloqueio de `/api`, `/admin`
- [ ] Schema BreadcrumbList em posts do blog
- [ ] Lighthouse score ≥ 90 em todas as rotas principais

### P2
- [ ] Internal linking automatizado pelo blog
- [ ] Image alt-text audit
