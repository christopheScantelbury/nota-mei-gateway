# 01 — Backlog Master

> **Todas as decisões estão tomadas.** Para detalhe técnico, ver `02-Especificacoes-Tecnicas.md`.
> Para copies, ver `03-Copies-Finais.md`. Para schemas, ver `04-Modelos-Dados.md`.

## Sprint 1 — 03/06/2026 a 16/06/2026

**Tema:** Desbloquear medição e atacar o topo da landing.

| ID | Título | Prio | Est | Área | Dep |
|---|---|---|---|---|---|
| HIST-7.1 | Auditoria GA4 e consent banner LGPD | P0 | 2 | marketing-ops, frontend | — |
| HIST-7.2 | Eventos de conversão por persona | P0 | 3 | frontend | 7.1 |
| HIST-7.3 | Dashboard Looker Studio | P0 | 2 | marketing-ops | 7.2 |
| HIST-6.0 | Auditoria da integração Brevo atual | P0 | 2 | backend, marketing-ops | — |
| HIST-1.1 | Top bar de urgência regulatória | P0 | 2 | frontend | 7.2 |
| HIST-1.2 | Componente PioneerBadge | P0 | 2 | frontend | — |
| HIST-1.3 | Contagem regressiva Set/2026 | P0 | 3 | frontend | — |
| HIST-1.4 | Reescrita do copy do hero | P0 | 1 | frontend | — |

**Total:** 17 pts

## Sprint 2 — 17/06/2026 a 30/06/2026

**Tema:** Fechar os P0 da landing e ativar onboarding antes da janela crítica.

| ID | Título | Prio | Est | Área | Dep |
|---|---|---|---|---|---|
| HIST-2.1 | Refatorar PricingSection para 3 colunas | P0 | 5 | frontend | 1.2 |
| HIST-2.2 | Card ME/EPP com plano âncora | P0 | 2 | frontend | 2.1 |
| HIST-2.3 | Card Dev/Gateway com plano âncora | P0 | 1 | frontend | 2.1 |
| HIST-3.1 | CTA sandbox no card Gateway do hero | P0 | 1 | frontend | — |
| HIST-3.2 | Item Sandbox no menu principal | P0 | 1 | frontend | — |
| HIST-3.3 | Hero /gateway com sandbox como CTA primário | P0 | 2 | frontend | 3.1 |
| HIST-6.1 | Webhooks de eventos do app → Brevo | P1 | 5 | backend | 6.0 |
| HIST-6.2 | Templates de e-mails de onboarding | P1 | 3 | frontend, marketing-ops | 6.1 |
| HIST-5.0 | Setup do blog em MDX (início — paralelo) | P1 | 5 | frontend, infra | — |

**Total:** 20 pts (sem 5.0) + 5 pts paralelo

## Sprint 3 — 01/07/2026 a 14/07/2026

**Tema:** Publicar comparativo e ativar régua de urgência ME/EPP.

| ID | Título | Prio | Est | Área | Dep |
|---|---|---|---|---|---|
| HIST-6.3 | Campanha urgência ME/EPP (T-60 → T-1) | P1 | 3 | marketing-ops, backend | 6.1, 6.2 |
| HIST-4.1 | Componente CompetitorTable | P1 | 5 | frontend | — |
| HIST-4.2 | Página /comparativo | P1 | 3 | frontend, seo | 4.1 |
| HIST-4.3 | Embed do comparativo na home | P1 | 2 | frontend | 4.1 |
| HIST-4.4 | Template MDX "NotaFácil vs X" + post piloto | P1 | 3 | frontend, seo | 4.1, 5.0 |
| HIST-7.4 | Sistema caseiro de feature flags | P1 | 5 | backend, frontend | — |
| HIST-5.1 | Auditoria SEO baseline (paralelo) | P1 | 3 | seo | — |
| HIST-5.2 | Schema.org Article nos posts (paralelo) | P1 | 2 | frontend, seo | 5.0 |

**Total:** 21 pts + 5 pts paralelo SEO

## Backlog pós-Sprint 3 (P1 e P2)

| ID | Título | Prio | Est | Janela alvo |
|---|---|---|---|---|
| HIST-5.3 | Templates dos 5 posts âncora (estrutural) | P1 | 5 | Sprint 4 |
| HIST-5.4 | Landing pilar /nfse-nacional-2026 | P1 | 5 | Sprint 4 |
| HIST-6.4 | Painel de métricas de lifecycle | P2 | 3 | Sprint 5+ |

## Resumo por épico

| Épico | Histórias | Total pts |
|---|---|---|
| Hero | 1.1, 1.2, 1.3, 1.4 | 8 |
| Pricing | 2.1, 2.2, 2.3 | 8 |
| Sandbox | 3.1, 3.2, 3.3 | 4 |
| Comparativo | 4.1, 4.2, 4.3, 4.4 | 13 |
| SEO | 5.0, 5.1, 5.2, 5.3, 5.4 | 20 |
| Email | 6.0, 6.1, 6.2, 6.3, 6.4 | 16 |
| Tracking | 7.1, 7.2, 7.3, 7.4 | 12 |
| **Total** | **22 histórias** | **81 pts** |

## Critérios de "Done" globais

Toda história, para ser considerada concluída, precisa cumprir:

- [ ] Código mergeado em `main`
- [ ] Preview deploy revisado no Vercel
- [ ] Critérios de aceite específicos da história marcados
- [ ] Lighthouse mantém score ≥ 90 nas páginas alteradas (Performance, A11y, SEO)
- [ ] Eventos GA4 disparam corretamente (validado em DebugView quando aplicável)
- [ ] Code review de pelo menos 1 outro dev
- [ ] Documentação inline em componentes novos
- [ ] Sem regressão em testes existentes

## Definição de "P0 não-negociável"

P0 significa **não merge na main sem isso pronto**. Não há flexibilização nesta sprint.
P1 pode ter ajuste de escopo se necessário.
P2 fica para janela depois de Set/2026.
