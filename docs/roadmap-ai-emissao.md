# Roadmap — IA para emissão de notas pelo usuário final

> Status: backlog · Última atualização: 2026-05-08
> Objetivo: usar IA para tornar a emissão de NFS-e tão simples quanto
> mandar uma mensagem. Foca no MEI/ME no celular, sem entender de imposto.
> Complemento ao `roadmap-ai-gateway.md` (que foca no dev integrador).

---

## AI-EMIT-01 — Assistente in-app conversacional 🥇

**Valor:** transforma o formulário de emissão num chat natural. Usuário
manda *"emite uma nota de R$ 1.500 pra João Silva, CPF 123.456.789-00,
consultoria de TI"* e a IA conduz a conversa coletando o que faltar,
confirma e emite. Reduz o tempo de emissão de ~2min para ~20s.

**Escopo técnico:**
- Componente `<AssistenteEmissao />` — modal/drawer flutuante com chat
  no dashboard `/notas` (botão "💬 Emitir por chat" ou bolha fixa no
  canto inferior direito)
- Endpoint `POST /v1/ai/chat/emitir` com `jwtMw` — recebe histórico
  da conversa e responde com próxima mensagem ou ação a tomar
- Modelo: **Claude Haiku 4.5** com **tool use**
- Tools expostas ao modelo:
  - `validar_cnpj_cpf(documento)` — usa nosso validador existente
  - `buscar_municipio(nome_ou_cep)` — usa `municipios_nfse`
  - `sugerir_codigo_nbs(descricao)` — reusa `/v1/ai/nbs/sugerir`
  - `mostrar_resumo(dados)` — devolve preview ao usuário
  - `confirmar_emissao(dados)` — valida e chama `/v1/nfse` internamente
  - `consultar_status(nota_id)` — polling do status
- Sessão persistida em Redis (`ai:chat:{user_id}` TTL 30 min)
  para retomar conversa após reload
- **Voice input grátis:** Web Speech API do browser (Chrome/Safari mobile)
  → o ícone de microfone aparece só quando suportado
- Acessibilidade: chat com `role="log" aria-live="polite"` para leitores
  de tela; foco gerenciado entre mensagens

**Esforço:** 5-7 dias
- Backend: cliente tool use + sessão Redis + 6 tools (~3 dias)
- Frontend: componente de chat + voice input + UX de confirmação (~3 dias)
- Telemetria + ajuste de prompts (~1 dia)

**Custo recorrente:** ~5-8 turns × Haiku 4.5 ≈ **$0.01 por nota emitida
via chat**. Para 1.000 notas/mês via chat: **~$10/mês**. Cache do system
prompt + ferramentas via prompt caching ephemeral reduz ~30% adicional.

**Prioridade:** ALTA — entregável rápido, conversão alta esperada
(usuário no celular evita o stepper longo), zero dependência externa.

---

## AI-EMIT-02 — Bot WhatsApp 🥈

**Valor:** levar o NotaFácil para onde o MEI já vive. O usuário manda
mensagem no WhatsApp da empresa e emite a nota sem abrir o app.
Gigantesco em conversão — diferencial competitivo no mercado MEI.

**Escopo técnico:**
- Provider: **Z-API** (nacional, ~R$0,05/conversa) ou **Evolution API**
  (self-hosted Docker, $0 mas overhead operacional)
- Worker novo (`apps/api/cmd/whatsapp/main.go`) ou novo serviço Railway
  pequeno, dedicado a receber webhooks do WhatsApp
- Endpoint `POST /v1/webhooks/whatsapp` recebe mensagens, valida HMAC
  do provider, identifica o usuário pelo `phone` cadastrado em `meis`/
  `empresas`
- Reusa **mesma engine de tool use** do AI-EMIT-01 (compartilha o
  pacote `internal/ai/chat/`) — diferença é só o canal de entrada/saída
- Sessão por número de telefone em Redis (`ai:wa:{phone}` TTL 1h)
- Anexa PDF da nota emitida via mídia (provider hospeda)
- Suporte a áudio: opcionalmente transcreve com Whisper (custo extra
  ~$0.006/min) — começar só com texto, ligar depois se houver demanda
- Onboarding: usuário envia `oi` → bot pede CPF/CNPJ ou e-mail para
  vincular à conta → primeira nota libera

**Esforço:** 7-10 dias
- Provider setup + aprovação Meta de templates (~2-3 dias incluindo
  burocracia)
- Worker + webhook + auth por telefone (~2 dias)
- Reuso da engine + adaptações pra mídia/áudio (~2 dias)
- Testes end-to-end + observabilidade (~1-2 dias)

**Custo recorrente:**
- Z-API: R$50-100/mês para 1.000-2.000 conversas
- IA: ~$10/mês adicional (mesmo cálculo do EMIT-01)
- Total: **~R$60-120/mês para 1.000 notas/mês via WhatsApp**

**Pré-requisitos:**
- AI-EMIT-01 entregue e validado (reuso da engine)
- Conta Z-API ou Evolution self-hosted configurada
- Templates aprovados pela Meta (auto-emissão exige template HSM)
- Política clara de privacidade/LGPD para os dados via WhatsApp

**Prioridade:** MÉDIA — depende de provar valor do EMIT-01 primeiro.
Custo recorrente justifica quando volume e conversão estiverem
comprovados.

---

## AI-EMIT-03 — Recibos rápidos por foto/voz (bônus)

**Valor:** usuário tira foto do contrato/comprovante de Pix, ou grava
áudio de 10s explicando o serviço, e a IA emite a nota.

**Escopo técnico:**
- OCR (visão) ou Whisper (áudio) → extrai dados → joga na engine
  AI-EMIT-01 → emite
- Endpoint `POST /v1/ai/chat/emitir/foto` aceita `multipart/form-data`
- Modelo de visão: Claude Sonnet 4.6 (~$3/MTok) só para extração de
  campos. Ou Haiku 4.5 com vision (mais barato, qualidade ok pra
  documentos limpos)
- Mesmo fluxo de confirmação antes de emitir (não emite direto sem
  mostrar resumo)

**Esforço:** 3-4 dias.
**Custo:** ~$0.02 por foto processada (Claude vision). 100 fotos/mês:
**~$2/mês**.
**Prioridade:** BAIXA (feature wow, mas escopo nicho — começar quando
EMIT-01/02 estiverem maduros).

---

## Ordem de execução recomendada

```
1. AI-EMIT-01 (in-app chat)         → 5-7d  · ~$10/mês  · alta conversão
2. AI-EMIT-02 (WhatsApp bot)        → 7-10d · ~R$100/mês · diferencial mercado
3. AI-EMIT-03 (foto/voz)            → 3-4d  · ~$2/mês   · feature wow
```

**Total entregando 1+2:** ~12-17 dias · ~R$110/mês de custo recorrente
em IA + WhatsApp · transformação total da experiência do MEI.

---

## Pré-requisitos transversais (todos já cobertos)

- ✅ `ANTHROPIC_API_KEY` no Railway (commit `e83dd49`)
- ✅ Pacote `internal/ai` com cliente Haiku 4.5 + cache Redis + prompt
  caching validados pelo classificador NBS
- ✅ API REST de emissão `/v1/nfse` estável e testada
- ✅ Auth Supabase JWT funcionando para o dashboard
- ⏳ Para EMIT-02: criar conta Z-API ou Evolution API + templates Meta

---

## Métricas a instrumentar

- **Conversão:** % de usuários que abriram chat → completaram emissão
- **Tempo médio:** primeira mensagem → nota emitida (vs formulário tradicional)
- **Custo real por nota:** tokens consumidos / notas emitidas via chat
- **Taxa de erro:** chats que terminaram sem emissão (frustração)
- **Reuso:** % de usuários que voltam a usar o chat na 2ª nota
- **Canal preferido:** quando WhatsApp existir, % adoção vs in-app

Telemetria via Prometheus existente + audit log via `internal/audit`
para rastrear cada interação.

---

## Decisões em aberto

1. **Cobrança extra?** Feature de chat é incluída em todos os planos
   ou vira diferencial pago (Pro+)? Recomendo: incluir em todos como
   diferencial competitivo, mas com limite de 50 chats/mês no Free.

2. **Confirmação obrigatória antes de emitir?** Default: sempre
   mostrar resumo + botão "Confirmar emissão". Justificável: emissão
   é ação irreversível com efeito fiscal.

3. **Voice input no in-app:** ligar por padrão ou opt-in nas
   configurações? Recomendo: ligar quando navegador suporta + mostrar
   tooltip "novo" na primeira vez.

4. **WhatsApp: usar mesmo número de suporte ou número dedicado?**
   Dedicado é melhor pra escalabilidade e separação de contextos.
