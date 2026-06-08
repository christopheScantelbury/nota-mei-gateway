# 07 — Pesquisa de Mercado

> Análise dos concorrentes diretos e racional de ancoragem de preços.
> Fonte dos dados: sites oficiais consultados em 02/06/2026.

---

## 1. Mapeamento dos players

### 1.1. Focus NFe — `focusnfe.com.br`

- **Posicionamento:** API REST para devs e ERPs corporativos, cobertura municipal ampla
- **Modelo:** SaaS B2B com planos mensais (Solo, Start, Growth, Enterprise)
- **Preço de entrada:** R$ 89/mês (Solo) — 100 notas/mês incluídas
- **Excedente:** R$ 0,60–0,75 por nota extra
- **Cobertura:** 3.000+ municípios (declarado), taxa fixa de R$ 199 para integrar município novo em 15 dias

**Forças:**
- Cobertura municipal histórica (legado de integrações com prefeituras ABRASF)
- Suporta NFe + NFCe + NFSe + CTe + MDFe + NFCom (suite completa)
- SDKs maduros para PHP, C#, Ruby
- Reconhecimento no mercado corporate (ERPs como SAP/TOTVS)

**Fraquezas exploráveis:**
- Sem produto dedicado para MEI
- Foco em padrão municipal ABRASF (legado) com adaptação para NFS-e Nacional
- Sem sandbox público — exige cadastro para testar
- Suporte só por ticket (sem chat ao vivo no plano entrada)

**Conclusão:** competidor direto no Gateway/Dev. Mensagem para devs: "REST puro, sandbox público, padrão nacional nativo".

---

### 1.2. eNotas — `enotass.com.br`

- **Posicionamento:** Automação fiscal para PJ digital (infoprodutores, e-commerce)
- **Modelo:** SaaS B2B com 3 tiers
- **Preço de entrada:** R$ 137/mês (Básico) — 50 notas/mês
- **Tiers superiores:** R$ 247 (Plus, 500 notas) · R$ 347 (Pro, ilimitado)
- **Cobertura:** integração nativa com Hotmart, Kiwify, Monetizze, PagSeguro

**Forças:**
- Parceria oficial Hotmart (aceita pagamento via saldo Hotmart)
- Garantia incondicional 30 dias
- Bom marketing para nicho de infoprodutores

**Fraquezas exploráveis:**
- **Declara abertamente que não atende MEI** ("MEI tem regras tributárias específicas que não comportam a estrutura de emissão automatizada em alto volume")
- API REST só nos planos Plus e Pro (entry-level não tem)
- Preço de entrada 73% mais caro que nosso ME Start (R$ 137 vs R$ 79)
- Foco em um nicho (PJ digital), não cobre prestadores de serviço tradicionais

**Conclusão:** competidor direto no ME/EPP, mas com fraqueza estratégica clara (não atende MEI, API só nos planos altos). Nossa ancoragem de R$ 79 vs R$ 137 é uma vantagem de 42% no entry-level.

---

### 1.3. PlugNotas (TecnoSpeed) — `plugnotas.com.br`

- **Posicionamento:** API REST moderna, evolução da linha Delphi corporativa
- **Modelo:** SaaS B2B sob consulta
- **Preço:** não publicado abertamente (modelo "fale com vendas")
- **Diferencial declarado:** equipe de 200+ especialistas em documentos fiscais

**Forças:**
- Marca TecnoSpeed (referência histórica em emissores)
- Suporte especializado para devs
- Cobertura ampla de documentos fiscais

**Fraquezas exploráveis:**
- Preço opaco — gera fricção no funil PLG
- Migração de produto legado (Delphi → REST) cria inconsistências de DX
- Setup mais pesado, processo comercial antes de testar
- Sem sandbox público

**Conclusão:** competidor no Gateway/Dev, mas perde no PLG por causa do preço opaco. Mensagem: "preço transparente, sandbox em 30s".

---

### 1.4. NFe.io — `nfe.io`

- **Posicionamento:** Estabilidade e suporte para empresas grandes/ERPs
- **Modelo:** SaaS B2B com onboarding assistido
- **Preço:** não publicado abertamente
- **Diferencial declarado:** SLA, suporte proativo, monitoramento

**Forças:**
- Reputação de estabilidade
- Onboarding assistido (1–2 meses de monitoramento proativo)
- API e emissão em lote via planilha

**Fraquezas exploráveis:**
- Foco em enterprise — caro e burocrático para PME
- Interface menos amigável (citado em comparativos do próprio mercado)
- Sem produto MEI dedicado

**Conclusão:** competidor periférico — não compete no MEI nem em PLG dev. Mencionar no comparativo por completude.

---

### 1.5. Outros players de menor relevância para nosso TAM

- **Nuvem Fiscal:** API moderna, pay-per-use, player menor — concorrente potencial em DX dev
- **Notazz:** nicho de dropshipping/e-commerce — não compete diretamente
- **SafeNota:** foco em validação prévia — concorrente periférico
- **Notaas (notaas.com.br):** microSaaS recente, posicionamento próximo do nosso — monitorar

---

## 2. Quadro consolidado

| Player | MEI | ME/EPP | Dev | Preço entrada | Sandbox | API REST | Foco |
|---|---|---|---|---|---|---|---|
| **NotaFácil** | ✅ | ✅ | ✅ | R$ 2,90/nota ou R$ 19/mês | ✅ Público | ✅ | NFS-e Nacional nativa |
| Focus NFe | ❌ | Parcial | ✅ | R$ 89/mês | ❌ | ✅ | Corporate/ERP |
| eNotas | ❌ | ✅ | Plus+ | R$ 137/mês | ❌ | Parcial | PJ digital |
| PlugNotas | ❌ | Parcial | ✅ | Sob consulta | ❌ | ✅ | Devs corporate |
| NFe.io | ❌ | ✅ | ✅ | Sob consulta | ❌ | ✅ | Enterprise |

---

## 3. Diferenciais únicos do NotaFácil (a destacar)

### 3.1. NFS-e Nacional nativa desde mai/2026
**O que é:** Construímos o produto direto sobre o padrão federal, sem herança do padrão municipal ABRASF (SOAP/XSD).

**Por que importa:** Concorrentes mantêm camadas de tradução do ABRASF municipal — o que funciona bem hoje mas vira dívida técnica conforme a obrigatoriedade nacional avança. Nossa arquitetura é otimizada para o padrão que será obrigatório.

**Como provar:** print da primeira NFS-e Nacional autorizada em produção (mai/2026), número da nota documentado.

### 3.2. Sandbox público sem cadastro
**O que é:** ambiente `sandbox.emitirnotafacil.com.br` que permite emitir notas de teste via API sem criar conta.

**Por que importa:** Reduz o "time-to-hello-world" do dev de horas (cadastro + e-mail + ativação + chave) para 30 segundos. É a porta PLG.

**Concorrentes:** nenhum dos 4 principais oferece. Todos exigem cadastro antes do primeiro request.

### 3.3. Três personas, uma plataforma
**O que é:** produto MEI (app simples), ME/EPP (interface web + API), Dev (Gateway) no mesmo backend.

**Por que importa:**
- Para o cliente que cresce: começa MEI, vira ME/EPP, integra via API — sem migrar de fornecedor
- Para o contador: gerencia múltiplos clientes (MEI e ME/EPP) na mesma plataforma
- Para o dev de SaaS B2B: integra uma vez, atende seus clientes MEI e ME/EPP

**Concorrentes:** apenas eNotas tenta ME/EPP + Dev (mas API só nos planos altos). Nenhum atende MEI dedicadamente.

### 3.4. Preço-piso agressivo
**Avulso:** R$ 2,90/nota (sem mensalidade). Concorrente mais próximo: R$ 89/mês (Focus). Nossa entrada é 97% mais barata para MEI que emite < 30 notas/mês.

### 3.5. mTLS direto com Receita Federal
**O que é:** conexão mTLS mutuamente autenticada com o serviço federal (`sefaz.fazenda.gov.br`).

**Por que importa:** sem intermediário municipal. Conformidade direta com a fonte autoritativa.

### 3.6. API REST simples (JSON + Bearer)
**O que é:** `POST /v1/nfse` com JSON. Webhook assinado HMAC-SHA256 no callback.

**Por que importa:** dev integra em horas. Concorrentes ainda têm SOAP/XSD em parte dos endpoints (legado ABRASF municipal).

---

## 4. Ancoragem de preços ME/EPP — racional completo

### 4.1. Análise do mercado

| Concorrente | Plano entry | Preço/mês | Notas/mês | Preço/nota | API REST |
|---|---|---|---|---|---|
| Focus NFe | Solo | R$ 89 | 100 | R$ 0,89 | ✅ |
| eNotas | Básico | R$ 137 | 50 | R$ 2,74 | ❌ |
| PlugNotas | Sob consulta | ~R$ 150* | ~100* | ~R$ 1,50* | ✅ |
| **NotaFácil ME Start (proposto)** | **ME Start** | **R$ 79** | **50** | **R$ 1,58** | ✅ |

*Estimativa baseada em depoimentos de mercado (preço opaco).

### 4.2. Por que R$ 79 e não outro número

**Lógica de posicionamento:**

1. **Abaixo do entry-level do mercado** — gera percepção de melhor custo-benefício.
2. **Não absurdamente barato** — R$ 39 ou R$ 49 sinalizariam "produto duvidoso" para tomador ME/EPP (que está acostumado a R$ 100+).
3. **Margem operacional positiva mesmo no Start** — custo unitário estimado ~R$ 0,12/nota (infra Railway + Brevo + suporte amortizado). Com 50 notas mensais a R$ 79, custo total ~R$ 6, margem bruta de R$ 73 (92%).
4. **Espaço para upsell claro** — diferença para Plus (R$ 149) é justificada com 4x as notas + API.
5. **Trial 30 dias sem cartão** — neutraliza barreira de entrada que concorrentes não têm.

### 4.3. Estrutura completa de planos ME/EPP fechada

| Plano | Preço | Franquia | Excedente | Diferenciais |
|---|---|---|---|---|
| **ME Start** | R$ 79/mês | 50 notas | R$ 0,60/nota | Interface web · multi-empresa · suporte humano |
| **ME Plus** | R$ 149/mês | 200 notas | R$ 0,55/nota | + API REST · webhooks HMAC · relatórios |
| **ME Pro** | R$ 289/mês | 1.000 notas | R$ 0,40/nota | + SLA · suporte prioritário · onboarding assistido |

### 4.4. Comparação com eNotas (concorrente direto no segmento)

| | eNotas Básico | NotaFácil ME Start | Vantagem |
|---|---|---|---|
| Preço | R$ 137 | R$ 79 | **-42%** |
| Notas inclusas | 50 | 50 | empate |
| API REST | ❌ | ✅ | maior |
| Multi-empresa | ❌ | ✅ | maior |
| Atende MEI? | ❌ | (não escopo) | — |
| Trial | 30 dias com garantia | 30 dias sem cartão | menor fricção |

### 4.5. Pontos de prova para o discurso comercial

- "Pagando 42% menos que o eNotas Básico, com API REST inclusa desde o plano entrada"
- "Único entry-level do mercado com multi-empresa nativo"
- "Trial sem cartão — o eNotas exige cartão para ativar o teste"

---

## 5. Estrutura completa de preços (todos os produtos)

### MEI
| Plano | Preço | Franquia | Notas |
|---|---|---|---|
| Avulso | R$ 2,90/nota | — | Sem mensalidade |
| MEI Mensal | R$ 19/mês | 30 notas | Trial 30 dias |
| MEI Plus | R$ 39/mês | 100 notas | "Mais popular" |

### ME/EPP (definido em §4.3)
| Plano | Preço | Franquia |
|---|---|---|
| ME Start | R$ 79/mês | 50 notas |
| ME Plus | R$ 149/mês | 200 notas |
| ME Pro | R$ 289/mês | 1.000 notas |

### Dev/Gateway
| Plano | Preço | Notas | Notas |
|---|---|---|---|
| Gateway Start | Grátis · pague por uso | — | R$ 0,89/nota |
| Gateway Growth | R$ 99/mês | 200 inclusas | R$ 0,50/excedente |
| Gateway Scale | R$ 499/mês | 2.000 inclusas | R$ 0,25/excedente |

**Racional Gateway:** preço por uso no Start permite que o dev integre e teste sem compromisso. Growth e Scale são justificados por volume + SLA + suporte.

---

## 6. Mensagens-chave por concorrente (para uso em copies e blog)

### vs Focus NFe
> "Construído nativo no padrão nacional, não adaptado do ABRASF municipal."
> "Sandbox público em 30s — sem cadastro, sem cartão, sem e-mail."
> "Atende MEI também — não só ERPs corporativos."

### vs eNotas
> "Pagando 42% menos no entry-level, com API REST inclusa desde o ME Start."
> "Atende MEI — eles declaram abertamente que não atendem."
> "Multi-empresa nativo no plano entrada — eles só liberam no Plus."

### vs PlugNotas
> "Preço transparente. Você testa a API antes de falar com vendas."
> "Sandbox público para validar antes de qualquer integração."

### vs NFe.io
> "Mesma estabilidade, com preço transparente e onboarding self-service."
> "Sandbox público para devs que querem velocidade antes de SLA."

---

## 7. Watchlist (monitorar mensalmente)

| Player | O que monitorar | Por quê |
|---|---|---|
| Focus NFe | Lançamento de produto MEI ou sandbox público | Replicariam nosso flanco aberto |
| eNotas | Lançamento de plano MEI ou abertura da API no entry | Replicariam vantagens nossas |
| PlugNotas | Publicação de preços | Reduziria fricção competitiva |
| Notaas | Crescimento de tráfego e produto | Posicionamento similar ao nosso |
| Receita Federal | Atualizações no padrão NFS-e Nacional | Impacta roadmap técnico |

**Cadência:** revisar este documento mensalmente. Atualizar `data/competitors.json` quando houver mudança relevante.
