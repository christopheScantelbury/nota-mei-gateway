# Backlog — Atividades futuras (IA + Mobile)

> Última atualização: 2026-05-08
> Lista mestre de atividades de IA não-iniciadas. Cada item está em
> formato pickup-ready: id, escopo, dependências, esforço, custo,
> critério de aceite e branch sugerida.
>
> Detalhes técnicos completos:
> - [`roadmap-ai-gateway.md`](roadmap-ai-gateway.md) — features para devs
> - [`roadmap-ai-emissao.md`](roadmap-ai-emissao.md) — features para o usuário final

---

## Status global

| Já entregue | Em backlog |
|---|---|
| ✅ AI-NBS-01 — classificador NBS (commits `e83dd49` + `84dd95e`) | 7 atividades · ~20-25 dias de trabalho · ~R$130/mês de custo recorrente quando tudo ligado |

---

## 🥇 Próxima a pegar

### `AI-EMIT-01` — Assistente in-app conversacional
- **Por quê pegar primeiro:** alta conversão MEI mobile, zero custo extra de provider, reusa toda a engine que já temos
- **Esforço:** 5-7 dias
- **Custo recorrente:** ~$10/mês para 1.000 emissões
- **Dependências:** nenhuma (todos pré-requisitos cobertos)
- **Branch sugerida:** `feat/ai-emit-01-chat`
- **Critério de aceite:**
  - [ ] Botão "💬 Emitir por chat" visível em `/notas`
  - [ ] Modal de chat abre, recebe input de texto e (se browser suportar) voz
  - [ ] IA usa pelo menos as 6 tools listadas (validar_cnpj, buscar_municipio, sugerir_codigo_nbs, mostrar_resumo, confirmar_emissao, consultar_status)
  - [ ] Sessão persiste em Redis por 30min (reload não perde contexto)
  - [ ] Emissão final passa pelo mesmo handler `/v1/nfse` da emissão tradicional
  - [ ] Telemetria: counter de chats iniciados, taxa de conclusão, tempo médio
  - [ ] Detalhes técnicos: [`roadmap-ai-emissao.md` § AI-EMIT-01](roadmap-ai-emissao.md)

---

## 🥈 Sequência recomendada (depois do EMIT-01)

### `AI-INT-01` — MCP Server `@notamei/mcp`
- **Esforço:** 2 dias
- **Custo recorrente:** **zero** (roda do lado do dev)
- **Dependências:** nenhuma
- **Branch sugerida:** `feat/ai-int-01-mcp`
- **Critério de aceite:**
  - [ ] Pacote npm `@notamei/mcp` publicado
  - [ ] Tools mínimas: emitirNota, consultarNota, cancelarNota, listarNotas, validarWebhook
  - [ ] Auth via API key da nossa plataforma (env var ou flag CLI)
  - [ ] Doc de instalação em `/docs/mcp` com exemplo Cursor + Claude Code
  - [ ] Detalhes: [`roadmap-ai-gateway.md` § AI-INT-01](roadmap-ai-gateway.md)

### `AI-INT-02` — Integration Wizard
- **Esforço:** 3 dias
- **Custo recorrente:** ~$3/mês
- **Dependências:** nenhuma
- **Branch sugerida:** `feat/ai-int-02-wizard`
- **Critério de aceite:**
  - [ ] Página `/dashboard/integrar` com seletor linguagem/framework/cenário
  - [ ] Endpoint `POST /v1/ai/integration/gerar` com `jwtMw`
  - [ ] Output: zip com cliente HTTP + emitirNota tipada + handler webhook + tratamento erro + teste sandbox
  - [ ] Cache Redis 30 dias por (linguagem+framework+cenário)
  - [ ] Detalhes: [`roadmap-ai-gateway.md` § AI-INT-02](roadmap-ai-gateway.md)

---

## 🥉 Quando houver volume

### `AI-EMIT-02` — Bot WhatsApp
- **Esforço:** 7-10 dias
- **Custo recorrente:** ~R$100/mês (Z-API + IA) para 1.000 conversas
- **Dependências:** AI-EMIT-01 entregue (reusa engine), conta Z-API/Evolution, templates Meta aprovados
- **Branch sugerida:** `feat/ai-emit-02-whatsapp`
- **Critério de aceite:**
  - [ ] Worker dedicado em `apps/api/cmd/whatsapp/`
  - [ ] Webhook `/v1/webhooks/whatsapp` com verificação HMAC do provider
  - [ ] Identificação por número de telefone do `meis`/`empresas`
  - [ ] Reuso da engine de tool use do EMIT-01
  - [ ] Sessão Redis `ai:wa:{phone}` TTL 1h
  - [ ] PDF anexado via mídia
  - [ ] Detalhes: [`roadmap-ai-emissao.md` § AI-EMIT-02](roadmap-ai-emissao.md)

### `AI-INT-04` — Webhook Debugger
- **Esforço:** 1 dia
- **Custo recorrente:** ~$2/mês
- **Dependências:** volume real de erros em produção
- **Branch sugerida:** `feat/ai-int-04-debug`
- **Critério de aceite:**
  - [ ] Botão "✨ Explicar" em detalhes de nota rejeitada/webhook falho
  - [ ] Endpoint `POST /v1/ai/debug/explicar`
  - [ ] Resposta com explicação PT-BR + snippet de código sugerindo fix
  - [ ] Cache Redis por hash(código_erro + estrutura_payload)
  - [ ] Detalhes: [`roadmap-ai-gateway.md` § AI-INT-04](roadmap-ai-gateway.md)

---

## 🟢 Backlog distante (feature wow)

### `AI-INT-03` — Migration Assistant
- **Esforço:** 2 dias
- **Custo recorrente:** ~$7/mês
- **Dependências:** marketing maduro (alavanca aquisição via troca de fornecedor)
- **Branch sugerida:** `feat/ai-int-03-migrate`
- **Pegar quando:** o produto tiver visibilidade pra atrair migrações de NFE.io / Focus NFe / NotaZZ
- **Detalhes:** [`roadmap-ai-gateway.md` § AI-INT-03](roadmap-ai-gateway.md)

### `AI-EMIT-03` — Recibos por foto/voz
- **Esforço:** 3-4 dias
- **Custo recorrente:** ~$2/mês
- **Dependências:** EMIT-01 maduro, demanda real comprovada
- **Branch sugerida:** `feat/ai-emit-03-foto`
- **Pegar quando:** EMIT-01 tiver volume e usuários pedirem
- **Detalhes:** [`roadmap-ai-emissao.md` § AI-EMIT-03](roadmap-ai-emissao.md)

---

## Resumo executivo

```
┌─────────────────────────────────────────────────────────────────┐
│  Ordem ideal                                                    │
│                                                                 │
│  1. AI-EMIT-01  (in-app chat)        5-7d   ~$10/mês  🔴 ALTA  │
│  2. AI-INT-01   (MCP server)         2d     ~$0       🔴 ALTA  │
│  3. AI-INT-02   (integration wizard) 3d     ~$3/mês   🔴 ALTA  │
│  4. AI-EMIT-02  (whatsapp bot)       7-10d  ~R$100/mês 🟡 MÉDIA │
│  5. AI-INT-04   (webhook debugger)   1d     ~$2/mês   🟡 MÉDIA │
│  6. AI-INT-03   (migration helper)   2d     ~$7/mês   🟢 BAIXA │
│  7. AI-EMIT-03  (foto/voz)           3-4d   ~$2/mês   🟢 BAIXA │
│                                                                 │
│  Total:  ~23-29 dias de trabalho                                │
│  Custo:  ~R$130/mês com TUDO ligado em volume real              │
└─────────────────────────────────────────────────────────────────┘
```

## Como pegar uma atividade

1. Cria branch a partir de `main`: `git checkout -b feat/ai-XXX-yy`
2. Lê o roadmap detalhado correspondente (links em cada item)
3. Implementa seguindo o critério de aceite (checklist acima)
4. Não esquece dos pré-requisitos transversais já cobertos:
   - `internal/ai/anthropic.go` — cliente Haiku 4.5 reutilizável
   - prompt caching ephemeral (1h)
   - cache Redis padrão `ai:<feature>:<hash>`
   - audit log via `internal/audit`
5. Telemetria: counter Prometheus + custo agregado mensal
6. PR pra `main` referenciando o ID da atividade no título
