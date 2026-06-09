# Skills do projeto Nota MEI Gateway

Skills são markdowns com instruções + padrões que ativam quando Claude detecta um cenário relevante. Cada um cobre uma classe de bug ou pattern recorrente.

| Skill | Quando ativa | Cobre |
|---|---|---|
| [`nota-mei-conventions`](nota-mei-conventions/SKILL.md) | Sempre que mexer no projeto | Estrutura monorepo, Go + Next.js, PT-BR, erros, status fiscais, segurança |
| [`nota-mei-plan-gating`](nota-mei-plan-gating/SKILL.md) | Páginas dashboard com paywall + owner detection (MEI vs Empresa) | Bugs `/templates`, `/billing`, `/api-keys`, `/webhooks` da sessão 2026-06-08 |
| [`nota-mei-stripe`](nota-mei-stripe/SKILL.md) | Checkout, webhook, catalog Stripe | Pacote de 6 bugs do upgrade flow (commits b484884 + 2805523) |
| [`nota-mei-deploy-qa`](nota-mei-deploy-qa/SKILL.md) | Commit/push, deploy manual, QA smoke + UI | Economia Railway+Vercel, workaround api prod sem auto-deploy, fluxo QA |
| [`nota-mei-auth`](nota-mei-auth/SKILL.md) | Magic link, callback, sessão | Bug P0 do callback (commit 0d7a248), first-login linkage ME/EPP |

## Como ativar

Skills ativam automaticamente baseado no `description` do frontmatter. Pra invocar manualmente em uma sessão, mencione o nome:

> "Usa a skill `nota-mei-plan-gating` pra criar a nova página `/automacoes`"

## Como atualizar

Cada SKILL.md tem código de exemplo real do projeto. Quando o padrão mudar (catálogo Stripe novo, refactor de gating, etc.), atualizar a skill correspondente — não deixar exemplo desatualizado virar fonte de bug futuro.

Aprendizados que vierem de QA real → adicionar na seção apropriada do skill.
