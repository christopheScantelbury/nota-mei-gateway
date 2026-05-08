# Roadmap — IA para integração do NotaFácil Gateway

> Status: backlog · Última atualização: 2026-05-08
> Objetivo: usar IA para reduzir o tempo de integração da nossa API REST
> ao sistema do cliente (SaaS, ERP, marketplace, plugin) — de horas para
> minutos. Cada item lista escopo, valor, esforço e custo recorrente.

---

## AI-INT-01 — MCP Server `@notamei/mcp` 🥇

**Valor:** diferencial competitivo único no mercado brasileiro de NFS-e.
Devs que usam Cursor / Claude Code / Windsurf instalam um pacote npm e a
IA deles passa a conhecer nossa API e operar via conversação na IDE.

**Escopo técnico:**
- Pacote npm `@notamei/mcp` que expõe a OpenAPI (`docs/openapi.yaml`)
  como tools MCP (Model Context Protocol)
- Auth via API key (`sk_live_` / `sk_test_`) carregada de env var ou
  argumento da CLI
- Tools mínimas: `emitirNota`, `consultarNota`, `cancelarNota`,
  `listarNotas`, `validarWebhook`
- Doc de instalação em `/docs/mcp` da landing
- Anúncio em comunidades dev (r/programming, X, Hacker News BR)

**Esforço:** 2 dias (pacote + doc + landing).
**Custo recorrente:** **zero** — roda do lado do dev.
**Prioridade:** ALTA (marketing premium + zero custo).

---

## AI-INT-02 — Integration Wizard (gerador de código) 🥈

**Valor:** transforma "li a doc" em "tenho código rodando" em 1 clique.
Reduz drasticamente o tempo até primeira integração bem-sucedida.

**Escopo técnico:**
- Página `/dashboard/integrar` (ou `/docs/wizard`)
- Formulário: linguagem (Node/PHP/Python/Go/.NET) +
  framework (Express, Laravel, Django, Fiber, ASP.NET) +
  cenário (emissão única / lote / com webhook / loja online)
- Endpoint `POST /v1/ai/integration/gerar` com `jwtMw`
- Modelo: **Claude Haiku 4.5** (system prompt cached com a especificação
  da nossa API + padrões idiomáticos por linguagem)
- Output: arquivos prontos para download (zip) ou copy-paste no clipboard:
  - Cliente HTTP configurado com a API key do usuário
  - Função `emitirNota()` tipada
  - Handler de webhook com **verificação HMAC** correta
  - Tratamento dos códigos de erro mais comuns da Receita em PT-BR
  - Exemplo de teste contra sandbox
- Cache Redis por hash(linguagem+framework+cenário) — 30 dias

**Esforço:** 3 dias (handler + UI + prompts por linguagem).
**Custo recorrente:** ~$0.003 por geração não-cacheada · com hit-rate
esperado de 70%, ~$0.001 médio. Para 100 gerações/dia: **~$3/mês**.
**Prioridade:** ALTA (depois do MCP — leva o dev até o "deploy-ready").

---

## AI-INT-03 — Migration Assistant (steal-from-competitor) 🥉

**Valor:** remove o atrito de troca de fornecedor. Dev cola o código que
ele já tem (chamando NFE.io, Focus NFe, NotaZZ, Webmania, etc.) e a IA
traduz para a nossa API mantendo a mesma assinatura de função.

**Escopo técnico:**
- Página `/migrar` na landing /gateway
- Endpoint `POST /v1/ai/integration/migrar` com `jwtMw` (ou anônimo
  com rate-limit IP — para reduzir fricção)
- Modelo: Claude Haiku 4.5 com exemplos few-shot de cada concorrente
  conhecido no system prompt
- Output: código equivalente usando nossa API + comentário diff inline
  apontando o que mudou (auth, formato de payload, tratamento de erro)

**Esforço:** 2 dias.
**Custo recorrente:** ~$0.005 por tradução (~1.5K input + 500 output).
Para 50 migrações/dia: **~$7,50/mês**.
**Prioridade:** MÉDIA (faz sentido depois que tivermos volume e marketing
maduro — alavanca aquisição via troca de fornecedor).

---

## AI-INT-04 — AI Webhook Debugger

**Valor:** reduz tickets de suporte e tempo de troubleshooting. Dentro
do dashboard, em "API Keys → Logs" ou "Notas Fiscais → Detalhes da nota
rejeitada", botão "✨ Explicar" para webhooks que falharam ou erros 4xx
da Receita.

**Escopo técnico:**
- Endpoint `POST /v1/ai/debug/explicar` recebendo o payload da requisição
  + resposta de erro
- Modelo: Claude Haiku 4.5 (system prompt cached com mapeamento de
  códigos de rejeição da Receita já presente em `docs/receita-erros.md`)
- Output: explicação em PT-BR + sugestão de fix concreta (snippet de
  código mostrando o que mudar)
- Botão integrado na UI existente de detalhes da nota
- Cache Redis por hash(código_erro + estrutura_payload) — alto hit-rate
  esperado pois erros se repetem muito

**Esforço:** 1 dia (handler + botão na UI).
**Custo recorrente:** ~$0.002 por explicação · com hit-rate >80% esperado
após bootstrap, ~$0.0004 médio. Para 200 chamadas/dia: **~$2,50/mês**.
**Prioridade:** MÉDIA (implementar depois que tiver volume real de erros
em produção pra justificar — antes disso, pouca utilidade).

---

## Ordem de execução recomendada

```
1. AI-INT-01 (MCP Server)              → 2d · custo zero · alto impacto marketing
2. AI-INT-02 (Integration Wizard)      → 3d · ~$3/mês  · alto impacto conversão
3. AI-INT-04 (Webhook Debugger)        → 1d · ~$2/mês  · médio impacto retenção
4. AI-INT-03 (Migration Assistant)     → 2d · ~$7/mês  · médio impacto aquisição
```

**Total para entregar todos:** ~8 dias de trabalho · ~$12/mês de custo
recorrente em IA · alto impacto em diferenciação no mercado.

---

## Pré-requisitos transversais

- ✅ `ANTHROPIC_API_KEY` já configurada no Railway (commit `e83dd49`)
- ✅ Pacote `internal/ai` com cliente Haiku 4.5 + cache Redis disponível
- ✅ Padrão de prompt caching ephemeral (1h) já validado em
  `internal/ai/nbs_classifier.go` — reusar para os novos endpoints
- ⏳ Adicionar entrada de configuração de plano (Free/Pro/Business) que
  controla quem tem acesso a cada feature de IA — evita abuse

---

## Métricas a instrumentar (todas as features)

- Latência p50/p95 da chamada Anthropic
- Cache hit-rate Redis
- Custo agregado mensal (input + output tokens × preço Haiku 4.5)
- Conversão downstream:
  - MCP: instalações npm, devs ativos
  - Wizard: gerações → primeira nota emitida em produção
  - Migration: traduções → cadastros → ativação
  - Debugger: chamadas → resolução de erro (próxima nota OK)

Telemetria via Prometheus já existente (counters / histogramas) +
audit log via `internal/audit` para rastrear por usuário.
