# Roadmap Nota Fácil MEI + Nota MEI Gateway — Tasks Detalhadas

> **Dois produtos, uma empresa.**
> **Nota Fácil MEI** — para o MEI final. Simples, humano, pelo celular.
> **Nota MEI Gateway** — para devs e SaaS. API-first, técnico, escalável.
> Ambos desenvolvidos e operados pela **ScantelburyDevs** (scantelburydevs.com.br).

**Objetivo geral:** transformar a landing atual (que mistura linguagem de dev e MEI e não converte nem um nem outro) em uma arquitetura de dois funis bem definidos, com identidade e nomes próprios para cada produto.

**Estratégia macro:**
- `/` — porta de entrada neutra com escolha de produto
- `/mei` — landing do **Nota Fácil MEI** (linguagem simples, app, preço acessível)
- `/api` — landing do **Nota MEI Gateway** (técnico, API-first, refinado)
- `/docs` — já existe, mantém

---

## 🚨 P0 — Esta semana (alto impacto, baixo esforço)

### Task 1 — Corrigir contadores quebrados na seção de stats

**Problema:** A página exibe hoje "< 0s tempo médio de emissão", "0.9% uptime SLA", "0+ municípios suportados". Quase certamente é bug do componente animado de contador (CountUp ou similar) que está renderizando o valor inicial em vez do final, ou o `end` está sendo lido como `0`.

**Por que é P0:** Passa imagem de produto inacabado. Em produto fiscal, isso destrói confiança em segundos. É a primeira coisa que o visitante vê depois do hero.

**O que fazer:**
1. Inspecionar o componente de stats. Provavelmente um `useEffect` com IntersectionObserver não está disparando ou os números finais estão como string vazia.
2. Definir os valores reais e fixar como fallback caso a animação não rode:
   - Tempo médio de emissão: `< 3s` (ou o número real medido)
   - Uptime SLA: `99.9%` (não `0.9%`)
   - Municípios suportados: `5.000+` (texto da FAQ confirma)
3. Adicionar testes visuais ou snapshot para essa seção.
4. Garantir que, mesmo com JS desabilitado, os números apareçam (renderizar valor final no SSR e só animar no cliente).

**Critério de aceite:** abrir a home em aba anônima, com cache limpo, e ver os 3 números corretos sem flicker.

---

### Task 2 — Substituir o hero da home por uma escolha de público

**Problema:** O hero atual diz "Emita NFS-e do seu MEI em segundos via API". MEI não fala "via API". Dev não chama o próprio negócio de "seu MEI". A frase tenta agradar os dois e não fisga ninguém.

**Por que é P0:** O hero define se o visitante fica ou sai. Hoje ele confunde os dois públicos.

**O que fazer:**

Reescrever o hero da `/` (raiz) para algo neutro com bifurcação clara:

```
H1: Emissão de NFS-e do MEI, sem complicação.

Subtítulo: Escolha como você quer usar:

[Card 1] 📱 Nota Fácil MEI
"Sou MEI e quero emitir minha nota em 30 segundos,
sem entender de imposto."
[Botão: Quero usar →] → leva para /mei

[Card 2] </> Nota MEI Gateway
"Sou desenvolvedor e quero integrar emissão de NFS-e
ao meu produto via API."
[Botão: Ver a API →] → leva para /api
```

**Detalhes de implementação:**
- Os dois cards devem ter peso visual igual (mesmo tamanho, mesma hierarquia).
- Exibir o **nome do produto** em destaque em cada card (Nota Fácil MEI / Nota MEI Gateway).
- Manter o badge "NFS-e Nacional · ABRASF · Receita Federal" em cima.
- Rodapé discreto: "Desenvolvido por ScantelburyDevs" com link para scantelburydevs.com.br.
- Remover, da home raiz, a logo soup técnica (Supabase, Railway, AWS KMS, etc.) — ela vai pra `/api`.

**Critério de aceite:** um MEI olhando 5 segundos a página entende que existe um caminho pra ele; um dev entende que existe uma API.

---

### Task 3 — Adicionar faixa de urgência sobre obrigatoriedade NFS-e Nacional

**Problema:** O maior gatilho de mercado que existe — a obrigatoriedade da NFS-e para MEI prestador de serviço — não aparece em lugar nenhum.

**Por que é P0:** É de longe o argumento mais persuasivo para o público MEI. "Você precisa fazer isso por lei" converte muito mais que "use nossa ferramenta".

**O que fazer:**

Adicionar uma faixa fina (banner) logo abaixo do hero, em todas as páginas públicas:

```
⚠️ A partir de 2026, todo MEI prestador de serviço é obrigado a emitir
NFS-e pela Receita Federal Nacional. A gente já está pronto.
[Saiba mais →]
```

**Detalhes:**
- Cor de destaque suave (amarelo claro ou âmbar). Não pode parecer popup de spam.
- Link "Saiba mais" leva para um post de blog explicando a obrigatoriedade (próxima task de conteúdo, P2).
- Botão de fechar (X) com persistência em localStorage para não irritar quem já viu.
- **Verificar a data exata** da obrigatoriedade na fonte oficial (Receita Federal / SEBRAE) antes de publicar. Não chutar.

**Critério de aceite:** faixa visível, fechável, com link funcionando.

---

### Task 4 — Mover a seção de stack técnica para `/api`

**Problema:** A home pública mostra "Supabase, Railway, AWS KMS, Stripe, RabbitMQ, Vercel, Prometheus". Isso impressiona dev mas confunde MEI ("o que esses bichos têm a ver com minha nota fiscal?").

**O que fazer:**
- Remover a seção "Infraestrutura de nível enterprise" da `/` raiz.
- Replicar essa seção dentro de `/api`, onde faz sentido como sinal de confiança técnica.
- Na `/mei`, substituir por argumentos em linguagem humana (ver Task 6).

**Critério de aceite:** home raiz não menciona nenhuma stack técnica; `/api` tem a stack visível.

---

## 🟡 P1 — Próximas 2 semanas (impacto alto, esforço médio)

### Task 5 — Criar landing `/mei` — produto Nota Fácil MEI

**Problema:** Não existe uma página com identidade própria falando a língua do MEI hoje. O produto **Nota Fácil MEI** precisa de uma landing independente, com nome, visual e copy próprios.

**O que fazer:**

Criar `/mei` com a seguinte estrutura, na ordem:

**1. Hero**

```
Produto: Nota Fácil MEI — by ScantelburyDevs

H1: Sua nota fiscal de MEI emitida em 30 segundos. Pelo celular.

Subtítulo: Sem precisar entender de imposto, sem prefeitura, sem
dor de cabeça. A gente cuida do resto — você só preenche o nome
do cliente e o valor.

[Botão primário: Emitir minha primeira nota grátis]
[Botão secundário: Ver como funciona (1 min)]

Microcopy: Sem cartão de crédito. Cancele quando quiser.
```

Ao lado do texto: mockup de celular mostrando a tela de "Nova nota" do app, com os 3 campos visíveis.

**2. Faixa de urgência** (mesma da Task 3)

**3. Como funciona — 3 passos**

Cada passo com imagem/ilustração, não código:

1. **Cadastre seu MEI** — "Informe seu CNPJ e envie seu certificado digital. A gente guia você passo a passo."
2. **Emita pelo app ou pelo site** — "Nome do cliente, descrição do serviço, valor. Pronto."
3. **Receba a nota no e-mail** — "PDF e XML chegam automáticos. Você manda pro cliente em um clique."

**4. Por que confiar — 4 selos em linguagem humana**

- 🔒 **Seguro igual banco** — "Seu certificado fica criptografado. Ninguém, nem nossa equipe, acessa."
- ⚖️ **Aprovado pela Receita Federal** — "Conexão direta com o sistema oficial nacional."
- 🇧🇷 **100% brasileiro** — "Seus dados nunca saem do país (LGPD)."
- 💬 **Suporte de gente, em português** — "WhatsApp, e-mail, atendimento humano. Nada de robô."

**5. Preços** (versão MEI — ver Task 7)

**6. FAQ específica do MEI** — perguntas reais:
- Eu sou obrigado a emitir nota como MEI?
- O que é certificado digital A1 e onde consigo?
- Posso emitir nota pra pessoa física?
- E se eu errar uma nota, posso cancelar?
- Vocês declaram meu DAS também? (não, mas explicar)
- Funciona pra MEI de qualquer cidade?

**7. CTA final**

```
Pronto pra parar de perder tempo com nota fiscal?
[Começar grátis — 5 notas no primeiro mês]
```

**Critério de aceite:** página publicada, mobile-first (MEI usa muito celular), tempo de carregamento < 2s, sem nenhum jargão técnico.

---

### Task 6 — Refatorar `/api` — produto Nota MEI Gateway

**Problema:** A landing atual já tem DNA técnico, mas carrega o peso de tentar atender MEI junto. Liberando essa ambiguidade, o **Nota MEI Gateway** pode ter uma identidade limpa e afiada para o público dev.

**O que fazer:**

**Hero novo:**

```
Produto: Nota MEI Gateway — by ScantelburyDevs

H1: A API de NFS-e que seu produto precisa.

Subtítulo: Integre emissão de nota fiscal de MEI ao seu SaaS, ERP
ou marketplace com um POST. Conexão direta com a Receita Federal
Nacional, sem depender de prefeituras.

[Botão: Ler a documentação] [Botão: Criar conta de teste]
```

**Adicionar code snippet visível no hero** (lado direito ou abaixo do texto):

```bash
curl -X POST https://api.notameigateway.com.br/v1/nfse \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tomador": { "cnpj": "12345678000190", "razao_social": "Cliente LTDA" },
    "servico": { "descricao": "Consultoria", "valor": 1500.00 },
    "webhook_url": "https://meusite.com/webhooks/nfse"
  }'
```

Devs decidem em 5 segundos se o produto serve, olhando o snippet. Coloque em destaque.

**Argumento que está faltando:** acrescente em algum lugar visível: *"Construa em uma tarde o que levaria 3 meses lendo manual da ABRASF."*

**Manter / mover pra cá:**
- Seção de segurança (mTLS, AWS KMS, HMAC, hash SHA-256)
- Stack técnica (Supabase, Railway, etc.)
- Os 3 passos atuais (cadastre, emita via API, receba webhook)

**Adicionar:**
- Bloco "SDKs disponíveis" mesmo que seja só link pra repos (Node, Python, PHP, Ruby).
- Bloco "Tempo médio de integração: 1 tarde" com depoimento curto (mesmo que seja beta-tester).
- Status page link (mesmo que ainda esteja em construção).

**Critério de aceite:** dev entra na página e em 30 segundos sabe (a) o que é, (b) como integra, (c) quanto custa, (d) onde está a doc.

---

### Task 7 — Reestruturar tabela de preços em duas trilhas

**Problema:** Hoje a tabela tem 5 planos misturando MEI individual (Starter R$ 29) e API empresarial (Business R$ 249). MEI fatura no máximo ~R$ 6.750/mês — pagar R$ 59–249/mês só pra emitir nota é caro pra ele. Pra dev/SaaS, esses preços estão até baratos. Mesma tabela não serve aos dois.

**O que fazer:**

**Na `/mei`:**

| Plano | Preço | Notas | Pra quem |
|---|---|---|---|
| **Avulso** | R$ 2,90 por nota | sem limite, sem mensalidade | quem emite pouco / esporádico |
| **MEI Mensal** | R$ 19/mês | 30 notas | quem emite todo mês |
| **MEI Plus** | R$ 39/mês | 100 notas | MEI com fluxo regular |
| **Trial** | Grátis 30 dias | 5 notas | experimentar |

**Na `/api`:**

| Plano | Preço | Notas | Pra quem |
|---|---|---|---|
| **Dev** | R$ 59/mês | 200 notas + sandbox | desenvolvedor solo, prototipagem |
| **Pro** | R$ 119/mês | 500 notas | agências e pequenos SaaS |
| **Business** | R$ 249/mês | 2.000 notas | plataformas estabelecidas |
| **Scale** | Sob consulta | 10k+ notas | high volume, SLA dedicado |

**Detalhes:**
- Adicionar coluna "o que está incluso" em cada plano (suporte, webhooks, sandbox, etc).
- Deixar claro o preço do excedente (ex: "R$ 0,20 por nota acima do limite").
- Botão de cada plano leva pro cadastro com o plano pré-selecionado (UTM ou query string).
- Validar os preços com 5–10 MEIs reais antes de publicar. R$ 19/mês pode ainda ser caro pro mercado.

**Critério de aceite:** MEI olhando os preços não vê nada acima de R$ 39; dev olhando os preços vê opções escaláveis.

---

### Task 8 — Adicionar prova social

**Problema:** Zero depoimentos, zero logos de clientes, zero números reais. Em produto fiscal, confiança é tudo.

**O que fazer:**

1. **Recrutar 5–10 beta-testers** (MEIs e devs) e pedir depoimento curto em troca de meses grátis. Foto + nome + cargo + frase de 2 linhas.
2. **Adicionar contador real:** "X notas emitidas até hoje", "Y MEIs ativos". Mesmo que sejam números pequenos, transparência > vazio.
3. **Logos de quem usa** (com permissão): se algum SaaS já está integrando, logo deles na `/api`.
4. **Selos de conformidade:** ABRASF, LGPD, certificações que tiver.
5. **Link pra GitHub** dos SDKs (transparência técnica conta muito pra dev).

**Critério de aceite:** mínimo 3 depoimentos com foto e 1 contador real visível em cada landing.

---

### Task 9 — Variar os CTAs por intenção

**Problema:** "Começar grátis" repete 5+ vezes. Visitante em estágios diferentes do funil precisa de CTAs diferentes.

**O que fazer:**

Mapear CTAs por intenção:
- **Frio (não conhece o produto):** "Ver como funciona (1 min)" → leva pra vídeo/demo
- **Morno (entende mas tem dúvida):** "Falar com a gente no WhatsApp" → conversa humana
- **Quente (pronto pra testar):** "Criar conta grátis" → cadastro
- **Pra dev:** "Ler a documentação" + "Testar no sandbox"
- **Pra empresa grande:** "Falar com vendas" → formulário com qualificação

Distribuir esses CTAs ao longo das páginas em vez de repetir o mesmo botão 5 vezes.

**Critério de aceite:** cada landing tem pelo menos 3 tipos de CTA diferentes em pontos estratégicos (hero, meio, final).

---

## 🟢 P2 — Próximo mês (impacto médio-alto, esforço maior)

### Task 10 — Produzir vídeo de 60 segundos para o MEI

**O que fazer:**

Vídeo curto, vertical (9:16, pra Reels/TikTok/Shorts) e horizontal (16:9, pra landing), mostrando:
1. Problema: MEI suando com prefeitura/contador (3s)
2. Solução: abre o app, digita 3 campos (15s)
3. Resultado: PDF da nota chegando no e-mail (5s)
4. CTA: "Comece grátis em notafacilmei.com.br" (3s)

**Detalhes:**
- Não precisa de produção cara. Tela gravada do celular + voz humana já resolve.
- Versão legendada (muita gente assiste sem som).
- Subir no YouTube (embed na landing) e replicar em Reels/TikTok orgânico.

---

### Task 11 — Conteúdo SEO foco em obrigatoriedade

**Por que:** "Como emitir NFS-e MEI" e variações têm volume de busca alto e crescente. Quem chega via Google está com intenção forte.

**O que fazer:**

Pauta inicial de 6 posts no blog:
1. "MEI é obrigado a emitir nota fiscal? Guia atualizado"
2. "Como emitir NFS-e MEI passo a passo (com e sem programa)"
3. "Certificado digital A1 pra MEI: o que é, como conseguir, quanto custa"
4. "NFS-e Nacional vs sistema da prefeitura: qual mudou pro MEI?"
5. "MEI prestador de serviço: tudo sobre a obrigatoriedade da NFS-e"
6. "Erros mais comuns ao emitir nota como MEI (e como evitar)"

**Detalhes:**
- Cada post 1.500–2.500 palavras, linguagem simples.
- CTA suave no final: "Quer emitir sem entender de nada disso? Conheça o **Nota Fácil MEI**."
- Schema.org de Article + FAQ.
- Imagens originais (prints reais do processo manual vs com a ferramenta).

---

### Task 12 — Conteúdo técnico para devs

**Pautas:**
1. "Como integrar emissão de NFS-e no seu SaaS em 1 tarde"
2. "ABRASF, NFS-e Nacional e municipal: o que muda pro desenvolvedor em 2026"
3. "Webhooks de NFS-e: padrão de retry, idempotência e segurança"
4. "Estudo de caso: como a [SaaS X] integrou NFS-e usando **Nota MEI Gateway**"

Publicar em dev.to, Medium e blog próprio. Cross-post em comunidades (Discords de SaaS BR, fóruns).

---

### Task 13 — Programa de indicação

**Estrutura simples:**
- MEI indica MEI → ambos ganham 1 mês grátis após o indicado virar pagante.
- Dev indica empresa → 20% de comissão recorrente nos primeiros 6 meses.
- Link único de indicação no painel do usuário.

**Implementação:** UTM + tabela de referrals no banco. Stripe coupons para o desconto.

---

### Task 14 — Página `/parceiros` para contadores

**Por que:** Contadores são distribuidores naturais. Cada contador atende 50–200 MEIs. Conquistar 20 contadores = potencial de mil MEIs.

**O que fazer:**
- Página dedicada `/parceiros` com pitch: "Emita NFS-e dos seus clientes MEI sem entrar em 50 prefeituras diferentes."
- Comissão recorrente (10–20%) sobre clientes trazidos.
- Painel multi-tenant (contador vê todos os MEIs sob ele).

---

### Task 15 — Dashboard com métricas (visual de prova social)

Para `/api`, criar um print/mockup de dashboard mostrando:
- Notas emitidas no mês
- Taxa de sucesso (idealmente > 99%)
- Tempo médio de resposta da Receita
- Últimos webhooks entregues

Mesmo que seja screenshot estilizado, transmite "isso é um produto sério, com observabilidade".

---

## Métricas para acompanhar

Definir baseline antes das mudanças e medir depois:

- **Taxa de conversão home → cadastro** (hoje provavelmente < 1%, meta: 3–5%)
- **Taxa de conversão cadastro → primeira nota emitida** (ativação)
- **Taxa de conversão trial → pagante**
- **CAC por canal** (orgânico, pago, indicação)
- **Churn mensal**
- **Tempo médio até primeira nota emitida** (UX da onboarding)

Ferramentas: PostHog ou Plausible (analytics), Stripe (revenue), painel próprio para métricas de produto.

---

## Resumo executivo da ordem de execução

```
Semana 1:
  [P0] Task 1 — Corrigir contadores
  [P0] Task 2 — Hero da home com escolha de público
  [P0] Task 3 — Faixa de urgência da obrigatoriedade
  [P0] Task 4 — Mover stack técnica para /api

Semanas 2-3:
  [P1] Task 5 — Criar /mei completa
  [P1] Task 6 — Refatorar /api
  [P1] Task 7 — Reestruturar preços em duas trilhas
  [P1] Task 8 — Coletar e publicar prova social
  [P1] Task 9 — Variar CTAs por intenção

Mês 2:
  [P2] Task 10 — Vídeo de 60s
  [P2] Task 11 — Conteúdo SEO MEI (6 posts)
  [P2] Task 12 — Conteúdo técnico (4 posts)
  [P2] Task 13 — Programa de indicação
  [P2] Task 14 — Página /parceiros para contadores
  [P2] Task 15 — Dashboard de métricas em /api
```

---

*Documento gerado para os produtos **Nota Fácil MEI** e **Nota MEI Gateway** — desenvolvidos pela [ScantelburyDevs](https://scantelburydevs.com.br).*
