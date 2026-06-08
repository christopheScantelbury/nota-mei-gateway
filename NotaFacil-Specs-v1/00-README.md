# NotaFácil — Pacote de Especificações Técnicas

**Origem:** Plano de Marketing v1.0 (29/05/2026)
**Versão:** 1.0 · 02/06/2026
**Status:** Todas as decisões fechadas. Pronto para desenvolvimento.

---

## Como usar este pacote

Cada arquivo cobre um aspecto específico. Lendo na ordem proposta abaixo, você passa
do contexto geral para as especificações de implementação:

| # | Arquivo | Para quem | O que tem |
|---|---|---|---|
| 00 | `README.md` | Todos | Este arquivo |
| 01 | `01-Backlog-Master.md` | PM / Tech Lead | Lista das 22 histórias com prioridade, estimativa, sprint, dependências |
| 02 | `02-Especificacoes-Tecnicas.md` | Devs | Detalhe técnico de cada história — arquivos, snippets, edge cases, testes |
| 03 | `03-Copies-Finais.md` | Devs | **Todos os textos** prontos para colar no código (hero, CTAs, e-mails, blog) |
| 04 | `04-Modelos-Dados.md` | Devs backend | Schemas SQL para feature flags, fila Brevo, log de e-mails, planos |
| 05 | `05-Componentes-React.md` | Devs frontend | Assinatura TS/Props de cada componente novo, com exemplos de uso |
| 06 | `06-Eventos-Analytics.md` | Devs + Marketing | Taxonomia GA4 completa: eventos, props, custom dimensions, funnels |
| 07 | `07-Pesquisa-Mercado.md` | Marketing / Vendas | Análise de concorrentes e racional de ancoragem de preços |
| 08 | `08-Decisoes-Fechadas.md` | Todos | Log oficial de decisões — fonte da verdade quando houver dúvida |

## Stack assumida

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, hospedado no Vercel
- **Backend:** Node.js/TypeScript no Railway
- **DB:** PostgreSQL (Railway)
- **E-mail:** Brevo (já integrado, a auditar)
- **Analytics:** GA4 (a configurar consent banner)
- **Blog/CMS:** MDX no monorepo Next.js, engine `contentlayer2` ou `velite`

Se algum desses estiver diferente, **adapte os snippets** — a lógica e o contrato dos componentes permanecem válidos.

## Convenções

- **Padrão de commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branch:** `feat/HIST-X.Y-descricao-curta`
- **PRs:** título com o ID da história, body com checklist de AC copiado do backlog
- **Code review:** mínimo 1 aprovação antes do merge

## Ordem de implementação

Seguir rigorosamente:

1. **Sprint 1 (03–16/06):** HIST-7.1, 7.2, 7.3, 6.0, 1.1, 1.2, 1.3, 1.4
2. **Sprint 2 (17–30/06):** 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 6.1, 6.2
3. **Sprint 3 (01–14/07):** 6.3, 4.1, 4.2, 4.3, 4.4, 7.4
4. **Paralelo a partir do Sprint 2:** 5.0, 5.1, 5.2, 5.3, 5.4

A ordem dentro do sprint respeita dependências técnicas — não inverter.

## Marcos críticos

- **30/06/2026:** todos os P0 em produção (hero, preços, sandbox, tracking) — janela de Set/2026
- **03/07/2026:** régua T-60 ME/EPP disparada
- **31/08/2026:** comparativo e SEO indexados
- **01/09/2026:** vigência da NFS-e Nacional — modo "obrigatório vigente"

## Dúvidas

Tudo que precisar de decisão **já está em `08-Decisoes-Fechadas.md`**. Se aparecer algo
não coberto, escalar imediatamente para o tech lead — não bloquear desenvolvimento por isso.
