# QA Empresa — Status consolidado das rodadas

> Visão única de TODAS as rodadas de QA da NotaFácil Empresa. Cada nova rodada
> adiciona um bloco aqui. Use isso pra entender o que já foi visto, fixado,
> validado e ainda pendente.

---

## Rodadas executadas

| Rodada | Data | Tester | Resultado | Deploy final |
|---|---|---|---|---|
| **R1** | 2026-06-03 | Claude Sonnet 4.6 | 14 bugs reportados | `0686f67` + `2cd1a20` |
| **R2** | 2026-06-03 | Claude Sonnet 4.6 | 5 novos + 2 ressalvas + regressão | `bd9ab36` |
| **R2-Verify** | 2026-06-03 | Claude Sonnet 4.6 | 1 confirmado + 3 falsos-positivos + 1 spec + 1 novo | `5f95d6d` |

---

## Tracking bug-por-bug

### Rodada 1 (14 bugs originais)

| ID | Severidade | Status final | Commit fix |
|---|---|---|---|
| **#1** API key exposta no cadastro ME | P0 | ✅ FIXADO | `0686f67` |
| **#2** "nacionala partir" | P1 | ✅ FIXADO | `0686f67` |
| **#3** Topbar sem 7d expiração | P2 | ✅ Side-effect de #9 | `2cd1a20` |
| **#4** Seções ausentes em /me | P1 | ✅ Pricing+Comparativo+Countdown | `0686f67` |
| **#5** "Como funciona" sem 3 toggles em /me | P1 | ❓ Falso-positivo (intencional em /me) | — |
| **#6** SVG dark "Nota" branco em fundo claro externo | P1 | ⚠️ Pendente (decisão de design) | — |
| **#7** Title login errado | P1 | ✅ FIXADO | `0686f67` |
| **#8** Wizard com 4 steps | P1 | ✅ Fechado via #1 | `0686f67` |
| **#9** 2 botões fechar topbar | P2 | ✅ UrgencyBannerME removido | `2cd1a20` |
| **#10** 2 ThemeToggle | P2 | ❓ Falso-positivo (hidden por viewport) | — |
| **#11** aria-expanded quebrado | P1 | ✅ Acessibilidade WCAG | `0686f67` |
| **#12** CNPJ fictício aceito | P1 | ✅ Bloqueio inline + botão disabled | `2cd1a20` + `bd9ab36` |
| **#13** NavigationProgress não achada | P2 | ❓ Falso-positivo (só na transição) | — |
| **#14** BrasilAPI não dispara no Step 1 | P1 | ✅ Auto-fetch com debounce | `0686f67` |

### Rodada 2 (5 novos bugs)

| ID | Severidade | Status final | Commit fix |
|---|---|---|---|
| **N+1** Logo "Nota" invisível em dark | P1 | ✅ FIXADO (LogoAdaptive CSS class refactor) | `5f95d6d` |
| **N+2** UrgencyTopBar não no SSR | P1 | ❓ Falso-positivo (cookie sessão anterior) | — |
| **N+3** CNPJ inválido chama BrasilAPI | P2 | ❓ Falso-positivo (estado residual) | — |
| **N+4** /clientes sem `next` param | P2 | ❓ Falso-positivo (token expirado) | — |
| **N+5** Spec com CNPJs reais | P2 spec | ✅ FIXADO (`99.999.999/0001-91`) | `bd9ab36` + `5f95d6d` |

### Rodada 2-Verify (1 bug novo)

| ID | Severidade | Status final | Commit fix |
|---|---|---|---|
| **Novo** `notafacil-gateway.svg` 404 | P2 | ✅ Alias criado (= notafacil-api.svg) | `5f95d6d` |

---

## Resumo numérico

- **Bugs únicos reportados** (sem contar regressão verify): 14 + 5 + 1 = **20**
- **Fixados em código**: 13
- **Falsos-positivos**: 6 (#5, #10, #13, N+2, N+3, N+4)
- **Pendentes legítimos**: 1 (#6 — SVG dark em fundo claro externo, requer decisão de design)
- **Severidade não-fixada**: 1× P1 (#6)

**Avaliação atual**: 🟡 **Release candidate**. Único pendente é decisão de design pra SVGs em contextos externos (e-mail/PDF).

---

## Cobertura pendente

Blocos 4-14 do prompt original **NÃO** foram testados em nenhuma rodada por falta de pré-requisitos:

- Magic link admin pra contornar OTP
- Cert A1 de homologação pra emissão real
- Webhook público (webhook.site)
- Cartão Stripe teste
- 2ª empresa pra multi-tenant

**Próxima rodada (R3)** deve focar nesses blocos. Sem isso, billing, multi-empresa, emissão real, cancelamento, substituição, e CRM continuam sem cobertura formal.

---

## Lições registradas

1. **Theme-aware logo**: SEMPRE usar Tailwind `dark:` classes renderizando 2 imagens. Não confiar em `useTheme().resolvedTheme` que tem race no primeiro paint (next-themes `defaultTheme="light"`).

2. **SSR + cookies/localStorage**: componentes que dependem de cookies (UrgencyTopBar) devem renderizar o caso comum no SSR e usar useEffect apenas pra ESCONDER. Nunca o oposto.

3. **CNPJ "fictícios"**: gerar CNPJ com DV válido NÃO garante que ele não esteja na Receita. Pra testes consistentes, testar via curl primeiro: `99.999.999/0001-91` (DV-OK + 404).

4. **Estado residual entre sessões de teste**: limpar cookies/localStorage entre rodadas. 3 dos "bugs" da R2 eram artefatos de sessão anterior.

5. **Falsos-positivos não são bugs do tester**: são feedback sobre fragilidade do produto a estado residual. Vale documentar como "comportamento conhecido" se relevante.
