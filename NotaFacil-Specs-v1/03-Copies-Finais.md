# 03 — Copies Finais

> **Todos os textos aprovados pelo analista.** Devs: copiar exatamente como está.
> Marketing: ajustes posteriores via PR no arquivo.

---

## Top bar de urgência (HIST-1.1)

**Pré-vigência (até 31/08/2026):**
```
⏰ NFS-e Nacional obrigatória em Set/2026 — Migre antes da multidão · Saiba mais
```

**Pós-vigência (a partir de 01/09/2026):**
```
NFS-e Nacional vigente desde 01/09/2026 — emita a sua agora · Saiba mais
```

---

## Hero da home (HIST-1.4)

### Versão final aprovada (variante A — controle)

**Eyebrow (acima do H1):**
```
NFS-e Nacional · ABRASF · Receita Federal
```

**Pioneer Badge (logo abaixo do eyebrow):**
```
🏆 Pioneiros · NFS-e Nacional em produção desde mai/2026
```

**H1:**
```
Sua NFS-e Nacional pronta antes de setembro/2026
```

**Subtítulo:**
```
Para MEI, ME/EPP e desenvolvedores. A primeira plataforma a emitir e cancelar NFS-e Nacional em produção. Migre agora — quanto mais perto da vigência, mais lotado fica o caminho.
```

**Texto acima dos 3 cards:**
```
Escolha seu caminho:
```

### Variante B para A/B test futuro (HIST-7.4)

**H1:**
```
Antes de setembro, sua empresa precisa emitir NFS-e Nacional.
```

**Sub:**
```
Pioneiros desde mai/2026, atendendo MEI, ME/EPP e desenvolvedores em uma só plataforma. Trial de 30 dias sem cartão.
```

---

## Cards do hero (3 personas)

### Card MEI
**Tag:** _(nenhuma)_
**Ícone:** 📱
**Título:** `Nota Fácil MEI`
**Descrição:**
```
Sou MEI e quero emitir minha nota em 30 segundos, sem entender de imposto.
```
**CTA:** `Quero usar →` (`/mei`)

### Card ME/EPP
**Tag:** `Obrigatório Set/2026` (substitui o "Novo" atual)
**Ícone:** 🏢
**Título:** `Nota ME / EPP`
**Descrição:**
```
Sou Microempresa. NFS-e Nacional obrigatória em Set/2026.
Simples Nacional e Lucro Presumido — pronto para os dois regimes.
```
**Countdown:** `<CountdownSet2026 />`
**CTA:** `Cadastrar minha ME →` (`/me`)

### Card Dev
**Tag:** _(nenhuma)_
**Ícone:** `</>`
**Título:** `Nota MEI Gateway`
**Descrição:**
```
Sou desenvolvedor e quero integrar emissão de NFS-e ao meu produto via API.
```
**CTA primário:** `Ver a API →` (`/gateway`)
**CTA secundário:**
```
⚡ Testar no navegador em 30s · sem cadastro
```
(`/sandbox`)

---

## Selos de credibilidade (manter os atuais)

```
< 3s     tempo médio de emissão
99.9%    uptime SLA
5.000+   municípios suportados
```

---

## Seção "Como funciona"

**Título:** `Como funciona`
**Toggle:** `📱 Sou MEI / 🏢 Sou ME/EPP / </> Sou dev` (expandir para 3 estados)

Os textos atuais dos passos do MEI e Dev podem ser mantidos. Adicionar:

### Aba ME/EPP

**Passo 01 — Cadastre sua empresa**
```
Informe CNPJ e envie certificado A1. Cadastre quantos CNPJs precisar — multi-empresa
nativo. Em segundos sua conta está pronta para os dois regimes (Simples Nacional e
Lucro Presumido).
```

**Passo 02 — Emita pela interface ou API**
```
Para o time fiscal: emita pela interface web simples. Para o time técnico: integre
via API REST. O mesmo backend, dois caminhos.
```

**Passo 03 — Conformidade automática**
```
Cálculo de ISS, retenções, alíquotas e regimes tributários — tudo automático conforme
o município. PDF e XML chegam por e-mail e ficam disponíveis no painel por 11 anos
(conforme Ajuste SINIEF 2/2025).
```

---

## Seção "Por que escolher o NotaFácil" (HIST-4.3 — embed na home)

**H2:** `Por que escolher o NotaFácil`
**Sub:** `Comparado com as principais alternativas do mercado`

**CTA abaixo da tabela:** `Ver comparativo completo →` (`/comparativo`)

---

## Seção "Planos e preços"

**H2:** `Planos e preços`
**Sub:**
```
Um plano para cada perfil. Comece grátis. Escale conforme cresce.
```

### Card MEI (âncora)
- **Nome:** MEI Mensal
- **Preço:** `R$ 19/mês`
- **Notes:** `30 notas/mês`
- **Descrição curta:** `Para MEI com clientes fixos todo mês.`
- **Bullets:**
  - Sem cartão no trial
  - PDF + XML automáticos
  - Suporte humano
- **CTA primário:** `Começar trial grátis`
- **CTA secundário:** `Ver todos os planos MEI →`

### Card ME/EPP (âncora — destaque visual)
- **Badge superior:** `Obrigatório a partir de Set/2026`
- **Nome:** ME Start
- **Preço:** `R$ 79/mês`
- **Notes:** `50 notas/mês · R$ 0,60 por nota excedente`
- **Descrição curta:** `Para Microempresa que precisa estar pronta para a NFS-e Nacional.`
- **Bullets:**
  - 30 dias grátis · sem cartão
  - Simples Nacional e Lucro Presumido
  - Multi-empresa nativo
- **CTA primário:** `Começar trial grátis`
- **CTA secundário:** `Ver todos os planos ME →`

### Card Dev (âncora)
- **Nome:** Gateway Start
- **Preço:** `Grátis · pague por uso`
- **Notes:** `R$ 0,89 por nota emitida em produção`
- **Descrição curta:** `Para desenvolvedores que integram emissão ao seu produto.`
- **Bullets:**
  - API REST · JSON · Bearer
  - Webhooks HMAC-SHA256
  - SDKs Node/Python/PHP
  - Sandbox público sem cadastro
- **CTA primário:** `Testar no sandbox`
- **CTA secundário:** `Ver planos Gateway →`

**Texto abaixo da grid:**
```
Trial de 30 dias sem cartão. Cancele quando quiser.
```

---

## Página /comparativo (HIST-4.2)

### Hero
**Eyebrow:** `Comparativo · NFS-e Nacional`
**H1:** `Por que migrar para o NotaFácil`
**Sub:**
```
A única plataforma 100% nativa para a NFS-e Nacional, com produto dedicado
para MEI, ME/EPP e desenvolvedores. Compare lado a lado com as principais
alternativas do mercado.
```

### 3 cards de diferencial (após a tabela)

**Card 1:**
- **Título:** `Nativo, não adaptado`
- **Body:**
```
Construímos o NotaFácil em 2025 já pensando na NFS-e Nacional. Nada de SOAP/XSD
herdado do padrão municipal ABRASF. Você fala REST + JSON + Bearer, e nós cuidamos
do resto. Resultado: integração em horas, não em semanas.
```

**Card 2:**
- **Título:** `Sandbox sem cadastro`
- **Body:**
```
Você testa nossa API agora mesmo no navegador, sem criar conta, sem cartão, sem
e-mail. Os concorrentes pedem cadastro completo antes do primeiro request. Nós
mostramos primeiro, conversamos depois.
```

**Card 3:**
- **Título:** `Três personas, uma plataforma`
- **Body:**
```
Único player do mercado com produto dedicado para MEI (app simples), ME/EPP
(interface web + API) e Dev (gateway). Quando seu cliente MEI virar ME, ele já
está em casa.
```

### FAQ /comparativo (6 perguntas)

**Q1: Quanto custa migrar do meu emissor atual para o NotaFácil?**
```
A migração é gratuita. O trial de 30 dias sem cartão dá tempo de validar a integração
em paralelo ao seu sistema atual antes de cancelar o concorrente. Devs: o sandbox sem
cadastro permite testar antes mesmo de criar conta.
```

**Q2: Vocês cobrem todos os municípios?**
```
Sim — todos os municípios que aderiram à NFS-e Nacional, hoje mais de 5.000.
Como somos nativos do padrão nacional (não dependemos de integração caso-a-caso
com prefeituras), novos municípios entram automaticamente quando aderem.
```

**Q3: Diferente do Focus NFe, vocês têm cobertura municipal completa?**
```
Focus NFe e similares construíram cobertura via integrações caso-a-caso com cada
prefeitura. Faz sentido para quem precisa do padrão ABRASF municipal antigo. Nós
focamos exclusivamente no padrão nacional, que será obrigatório para todos a partir
de Set/2026. Para o universo NFS-e Nacional, nossa cobertura é total.
```

**Q4: Posso usar a API e a interface web ao mesmo tempo?**
```
Sim. Diferente do eNotas (cuja API só vem nos planos Plus e Pro), todo plano ME/EPP
e Gateway inclui acesso à API REST. Você usa a interface para emissões manuais e a
API para o que está automatizado.
```

**Q5: Vocês atendem MEI?**
```
Sim — somos o único player do mercado com produto dedicado para MEI. O eNotas
declara abertamente que não atende MEI. Focus NFe e PlugNotas atendem mas com
o mesmo produto corporate, sem interface simplificada para emissão esporádica.
```

**Q6: E se eu precisar emitir NFC-e, NF-e ou CT-e também?**
```
Hoje focamos em NFS-e Nacional. Para NFC-e/NF-e/CT-e (operações com produtos físicos),
recomendamos players especializados como o Focus NFe. Nosso roadmap inclui suporte
a NFC-e em 2027 com a convergência completa do padrão nacional.
```

### CTA final da página
**Título:** `Pronto para migrar?`
**Sub:** `Trial de 30 dias sem cartão. Cancele quando quiser.`
**Botão primário:** `Criar conta gratuita`
**Botão secundário (para devs):** `Testar no sandbox`

---

## Hero do /gateway (HIST-3.3)

**Eyebrow:** `API REST · Sandbox público · SDKs prontos`
**H1:** `Emita NFS-e Nacional em três linhas de curl`
**Sub:**
```
API REST com JSON e Bearer. Webhooks assinados com HMAC-SHA256. SDKs para
Node, Python e PHP. Sandbox público sem cadastro — teste agora antes de
qualquer commit.
```

**CTA primário:** `Testar a API no sandbox` (`/sandbox`)
**CTA secundário:** `Criar conta de desenvolvedor` (`/cadastro?produto=dev`)

**Snippet curl logo abaixo do hero:**
```bash
curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \
  -H "Authorization: Bearer $NF_API_KEY" \
  -H "Content-Type: application/json" \
  -d @nota.json
```

---

## E-mails de onboarding (HIST-6.2)

### E-mail 1 — D+0 — Boas-vindas

**Subject:** `Bem-vindo ao NotaFácil — falta pouco pra sua primeira nota`
**Preheader:** `O próximo passo é enviar seu certificado A1. Demora 2 minutos.`

**Body:**
```
Olá, {{ contact.FIRSTNAME | default: "tudo certo" }} 👋

Cadastro feito. Agora falta um passo simples para você emitir sua primeira NFS-e
Nacional: enviar o certificado digital A1 da sua empresa.

📎 Por que precisamos do A1
O A1 é o que assina sua nota — exigência da Receita Federal. A gente armazena
em memória criptografada via AWS Secrets Manager, nunca em disco.

→ Enviar meu certificado A1 ({{ link_upload_cert }})

Se preferir, fica aqui um vídeo de 2 minutos mostrando como tirar o A1 no site
do seu emissor (Serasa, Certisign ou Soluti).

→ Como tirar meu A1 ({{ link_tutorial_a1 }})

Qualquer dúvida, respondendo esse e-mail você fala direto com o time. Sem chatbot.

Time NotaFácil
https://emitirnotafacil.com.br
```

### E-mail 2 — D+1 condicional — Lembrete certificado

**Trigger:** D+1 após signup E `cert_uploaded = false`

**Subject:** `Faltou o certificado A1 — precisa de ajuda?`
**Preheader:** `Sem o A1, não conseguimos emitir suas notas. Vou te dar uma força.`

**Body:**
```
Oi, {{ contact.FIRSTNAME }}.

Ontem você criou sua conta no NotaFácil mas ainda não enviou o certificado A1.
Isso é o que trava sua primeira emissão.

Se já tem o A1 em mãos, é só fazer upload aqui (leva 30 segundos):
→ Enviar A1 ({{ link_upload_cert }})

Se ainda não tirou o A1, três caminhos comuns:
• Comprar online no Serasa, Certisign ou Soluti (~R$ 200/ano)
• Comprar com seu contador (geralmente mais barato no pacote)
• Aproveitar o A1 que sua empresa já tem se você emite outras notas

→ Tutorial completo de como tirar o A1 ({{ link_tutorial_a1 }})

Travou em alguma parte? Responde aqui que a gente ajuda na hora.

Time NotaFácil
```

### E-mail 3 — D+3 condicional — Tutorial primeira nota

**Trigger:** D+3 após signup E `cert_uploaded = true` E `first_nfse_created = false`

**Subject:** `Vamos emitir sua primeira NFS-e?`
**Preheader:** `Certificado ok. Agora é só preencher 4 campos.`

**Body:**
```
Boa, {{ contact.FIRSTNAME }} — certificado no lugar ✅

Sua conta está pronta para emitir. Demos uma olhada e você ainda não emitiu
a primeira nota. Não tem mistério — bora juntos?

Para emitir, são 4 campos:

1️⃣ Nome ou CNPJ do cliente
2️⃣ Descrição do serviço prestado
3️⃣ Valor
4️⃣ Confirmar e enviar

→ Emitir minha primeira nota agora ({{ link_emit_nfse }})

Se preferir, esse vídeo de 90 segundos mostra todo o fluxo:
→ Como emitir minha primeira NFS-e ({{ link_tutorial_first_nfse }})

Travou em algo? Responde aqui que a gente resolve.

Time NotaFácil
```

### E-mail 4 — Evento — Parabéns primeira autorização

**Trigger:** evento `first_nfse_authorized` recebido

**Subject:** `🎉 Sua primeira NFS-e está no ar`
**Preheader:** `Nota nº {{ event.numero_nota }} autorizada pela Receita Federal.`

**Body:**
```
Saiu, {{ contact.FIRSTNAME }} 🎉

Sua primeira NFS-e Nacional foi autorizada pela Receita Federal:

📄 Nota nº {{ event.numero_nota }}
💰 Valor: R$ {{ event.valor }}
🏛️ Município: {{ event.municipio }}

O PDF e o XML foram enviados para você e para o tomador. Também ficam disponíveis
no seu painel pelos próximos 11 anos.

→ Ver minha nota emitida ({{ link_nota }})

📈 Bônus — uma reflexão de timing
A NFS-e Nacional vira obrigatória para todo prestador de serviço a partir de
Set/2026. Você já está pronto. Seus concorrentes provavelmente ainda não.

Se quiser escalar ou explorar nossa API para integrar com seu sistema, fala com
a gente.

Time NotaFácil
```

---

## E-mails de urgência ME/EPP (HIST-6.3)

> **Segmentação Brevo:** `porte IN ('ME','EPP') AND subscription_status != 'active' AND unsubscribed_urgency = false`

### T-60 — disparo em 03/07/2026

**Subject:** `Faltam 60 dias para a NFS-e Nacional virar obrigatória`
**Preheader:** `Em setembro toda Microempresa precisa emitir pelo padrão nacional.`

**Body:**
```
{{ contact.FIRSTNAME }},

Faltam exatos 60 dias para 01/09/2026 — data em que a NFS-e Nacional se torna
obrigatória para Microempresas que prestam serviço em municípios sem solução própria.

A boa notícia: ainda dá tempo. A migração leva em média 1 semana — entre testes,
treinamento do time e go-live.

A má notícia: quanto mais perto de setembro, mais lotado o caminho. Suporte saturado,
contadores ocupados, decisões apressadas.

→ Começar trial de 30 dias sem cartão ({{ link_signup_me }})

→ Tirar dúvidas com nosso time ({{ link_contato }})

Não quer mais receber esses lembretes?
→ Cancelar inscrição nessa série ({{ link_unsub_urgency }})

Time NotaFácil
```

### T-30 — disparo em 02/08/2026

**Subject:** `30 dias para a obrigatoriedade — você está no controle?`
**Preheader:** `Em 30 dias o cenário muda. Migrar agora ainda é tranquilo.`

**Body:**
```
{{ contact.FIRSTNAME }},

T-30 da NFS-e Nacional obrigatória.

Você está em uma de três situações:

✅ Migrei e estou pronto — ótimo, ignore este e-mail.
🟡 Estou avaliando — esse é o momento de decidir. Em 30 dias os emissores ficam
   abarrotados; quem está pronto não sente, quem não está sente muito.
🔴 Nem comecei — sem pânico, mas precisamos começar essa semana.

Para o time fiscal: interface web simples, sem treinamento longo.
Para o time técnico: API REST com JSON e Bearer, integra em horas.

→ Começar trial de 30 dias sem cartão ({{ link_signup_me }})

→ Falar com vendas ({{ link_contato }})

→ Cancelar inscrição nessa série ({{ link_unsub_urgency }})

Time NotaFácil
```

### T-15 — disparo em 17/08/2026

**Subject:** `15 dias — janela apertada mas viável`
**Preheader:** `Ainda dá. Mas precisa começar hoje.`

**Body:**
```
{{ contact.FIRSTNAME }},

Quinze dias até a NFS-e Nacional virar obrigatória.

Honestamente: 15 dias é o limite saudável para uma migração tranquila. Depois disso
vira corrida.

Se você fizer signup agora:
• Dia 1-3: configuração do certificado A1 e cadastros
• Dia 4-7: validação com seu contador
• Dia 8-12: testes em paralelo ao emissor atual
• Dia 13-15: go-live no NotaFácil, cancelamento do atual

Trial 30 dias, sem cartão — você só paga se permanecer depois do trial.

→ Começar agora ({{ link_signup_me }})

→ Cancelar inscrição nessa série ({{ link_unsub_urgency }})

Time NotaFácil
```

### T-7 — disparo em 25/08/2026

**Subject:** `7 dias — última janela para começar sem aperto`
**Preheader:** `Migrar essa semana ainda é confortável.`

**Body:**
```
{{ contact.FIRSTNAME }},

Sete dias para 01/09/2026.

Vamos direto ao ponto:

• Não dá mais para "estudar a opção" — precisa agir.
• Quem fizer signup hoje (29/08) consegue go-live até o domingo (31/08).
• Depois do dia 1º, você emite por contingência ou enfrenta multa.

Como funciona o trial:
✅ 30 dias grátis · sem cartão
✅ Migração assistida por nosso time (sem custo)
✅ Cancela quando quiser, sem fidelidade

→ Começar trial agora ({{ link_signup_me }})

Time NotaFácil
```

### T-3 — disparo em 29/08/2026

**Subject:** `3 dias — preciso ser sincero com você`
**Preheader:** `Última chance de migrar sem trauma.`

**Body:**
```
{{ contact.FIRSTNAME }},

Três dias.

Vou ser direto: se você não começou sua migração até hoje, segunda-feira (01/09)
você vai estar em uma das duas:

a) Emitindo pelo antigo padrão municipal por contingência (alguns municípios aceitam,
   outros já não). Risco: nota rejeitada.
b) Parado, sem emitir, com cliente esperando.

Nenhuma das duas é boa.

Nosso onboarding express para ME/EPP em janela apertada:
• Ligação de 30 min com nosso time de migração
• Certificado A1 configurado em conjunto
• Primeira emissão no mesmo dia

→ Agendar ligação agora ({{ link_agendamento }})

→ Começar trial direto ({{ link_signup_me }})

Time NotaFácil
```

### T-1 — disparo em 31/08/2026

**Subject:** `Amanhã. Estamos aqui se precisar.`
**Preheader:** `Não vamos te encher, é o último.`

**Body:**
```
{{ contact.FIRSTNAME }},

Amanhã (01/09) começa a obrigatoriedade da NFS-e Nacional.

Não vamos te encher de gatilhos — esse é o último e-mail dessa série.

Se você precisar emitir alguma nota essa semana e seu sistema atual rejeitar,
estamos aqui:

→ Suporte WhatsApp ({{ link_whatsapp }})
→ Onboarding express ({{ link_agendamento }})
→ Cadastro direto ({{ link_signup_me }})

Boa migração.

Time NotaFácil
```

---

## Títulos e meta description dos 5 posts âncora (HIST-5.3)

### Post 1 — Regulatório principal
- **Slug:** `/blog/nfse-nacional-obrigatoria-2026`
- **Title (60 chars):** `NFS-e Nacional obrigatória em 2026: o que muda e prazos`
- **Meta description (160 chars):**
```
Em setembro de 2026 a NFS-e Nacional vira obrigatória. Veja o que muda, quais
empresas são afetadas e como se preparar sem virar refém da última hora.
```

### Post 2 — MEI
- **Slug:** `/blog/como-emitir-nfse-mei`
- **Title:** `Como emitir NFS-e como MEI em 2026 — passo a passo`
- **Meta description:**
```
Tutorial completo de como o MEI emite NFS-e Nacional em 2026. Certificado A1,
cadastro municipal e emissão em 4 campos. Atualizado para o padrão nacional.
```

### Post 3 — ME/EPP
- **Slug:** `/blog/nfse-nacional-me-epp-migracao`
- **Title:** `NFS-e Nacional para ME/EPP: migração e regimes tributários`
- **Meta description:**
```
Como migrar sua Microempresa para a NFS-e Nacional. Simples Nacional e Lucro
Presumido, cálculo de ISS, retenções e o que muda para o seu contador.
```

### Post 4 — Multa/risco
- **Slug:** `/blog/multa-nao-emitir-nfse`
- **Title:** `Multa por não emitir NFS-e: consequências em 2026`
- **Meta description:**
```
O que acontece quem não emitir NFS-e após a obrigatoriedade nacional de Set/2026.
Multas, juros, riscos fiscais e como evitar — guia atualizado.
```

### Post 5 — Técnico (devs)
- **Slug:** `/blog/abandonamos-soap-abrasf-municipal`
- **Title:** `Por que abandonamos SOAP/ABRASF municipal e fomos direto ao nacional`
- **Meta description:**
```
Decisão arquitetural: construímos o NotaFácil 100% no padrão NFS-e Nacional,
sem SOAP/XSD herdado do ABRASF municipal. O racional técnico e os trade-offs.
```

---

## FAQ regulatório /nfse-nacional-2026 (HIST-5.4)

### Q1: O que é a NFS-e Nacional?
```
A NFS-e Nacional é o padrão unificado de Nota Fiscal de Serviço Eletrônica estabelecido
pela Receita Federal em conjunto com a CGSN. Substitui os múltiplos padrões municipais
ABRASF que cada prefeitura mantinha — um único formato XML, uma única API, uma única
forma de assinar e enviar.
```

### Q2: A partir de quando ela é obrigatória?
```
A partir de 01/09/2026, para todo prestador de serviços cuja prefeitura ainda não
tenha solução própria homologada. Em janeiro de 2027, com a convergência total,
o padrão ABRASF municipal é aposentado.
```

### Q3: Eu sou MEI. Isso me afeta?
```
Sim. MEI que presta serviço continua obrigado a emitir NFS-e — apenas o formato
muda. A boa notícia: o padrão nacional é mais simples (poucos campos, sem peculiaridades
municipais) e MEI tem regras tributárias específicas que já vêm aplicadas automaticamente
em plataformas adequadas.
```

### Q4: Sou ME/EPP no Simples Nacional. E para mim?
```
Sua obrigatoriedade é a mesma: 01/09/2026 para municípios sem solução própria.
A diferença para o MEI é que você tem mais campos a preencher (alíquota efetiva
calculada pelo PGDAS, retenções de ISS quando aplicável, descrição detalhada do
serviço). Sistemas adequados para ME/EPP calculam isso automaticamente.
```

### Q5: E quem está no Lucro Presumido?
```
Mesma data, mesmo padrão. Como o ISS no Lucro Presumido geralmente é destacado
(e não inserido na alíquota como no Simples), o cálculo é mais direto. Importante
configurar corretamente o regime no cadastro da empresa para que as alíquotas
e retenções saiam certas desde a primeira nota.
```

### Q6: Posso continuar usando o emissor da minha prefeitura?
```
Depende. Se sua prefeitura aderiu ao padrão nacional (já são mais de 5.000), o
emissor municipal ou foi descontinuado ou já fala o padrão nacional. Se sua
prefeitura ainda não aderiu, você usa o ambiente federal direto (que é o que o
NotaFácil faz por baixo dos panos).
```

### Q7: Qual o custo de não migrar a tempo?
```
Três custos somados:
• Operacional: nota rejeitada significa cliente sem comprovante e fluxo de caixa
  travado.
• Tributário: pode incorrer em descumprimento de obrigação acessória, com multas
  por nota não emitida (varia por município, R$ 50–500 cada).
• Reputacional: cliente que não recebe a nota questiona o profissionalismo.
```

### Q8: Quanto custa migrar?
```
No NotaFácil, R$ 0 para migrar. O trial é de 30 dias sem cartão — você emite em
paralelo ao seu sistema atual, valida, e só então cancela o anterior.
```

### Q9: Quanto tempo leva a migração?
```
Para MEI: 30 minutos (cadastro + upload de A1 + primeira emissão).
Para ME/EPP: 3–7 dias úteis (validação com contador, testes, ajustes de cadastros
de serviços, treinamento).
Para times técnicos integrando via API: 1–3 dias de trabalho de dev (a maioria
gasta menos com nosso SDK).
```

### Q10: O que acontece com as notas antigas?
```
Tudo que foi emitido pelo padrão antigo continua válido — não há retroatividade.
Você só precisa garantir que o XML original seja arquivado por 11 anos (Ajuste
SINIEF 2/2025). A partir de Set/2026, todas as novas emissões usam o padrão nacional.
```

---

## Componentes MDX — copies dos componentes reutilizáveis

### `<MigrationCTA from="Focus NFe" />`
**Renderiza:**
```
Pronto para migrar do {{ from }} para o NotaFácil?

Trial de 30 dias sem cartão. Migração assistida por nosso time, sem custo.
Você emite em paralelo, valida, e só então cancela o atual.

→ Começar agora · trial grátis
→ Falar com nosso time
```

### `<VsHero competitor="focus_nfe" />`
**Renderiza:**
```
{{ Logo NotaFácil }}  vs  {{ Logo Focus NFe }}

Comparativo técnico atualizado em {{ lastUpdated }}.
```

### `<Callout type="info">`
Estilo de destaque com ícone informativo, fundo `bg-sky-50`.

### `<Callout type="warn">`
Estilo de aviso com ícone de atenção, fundo `bg-amber-50`.

### `<Callout type="success">`
Estilo de confirmação com ícone de check, fundo `bg-green-50`.

---

## Página de erro (404 — atualizar se ainda for genérica)

**H1:** `Página não encontrada`
**Sub:**
```
Tudo bem — vamos te recolocar no caminho.
```
**Botões:**
- `Ir para a home` (`/`)
- `Falar com suporte` (`mailto:suporte@emitirnotafacil.com.br`)

---

## Tom de voz — guia rápido para qualquer texto novo

- **Direto, não corporativo.** "Bora" é melhor que "vamos prosseguir".
- **Honesto, não vendedor.** Se algo não dá, diga que não dá.
- **Tecnicamente preciso.** "NFS-e Nacional" (com hífen), não "NFSe Nacional".
- **Empático com a urgência.** Set/2026 é estresse para nosso público — não amplifique pânico, ajude a resolver.
- **Sem "soluções", "robusto", "best-in-class".** Use palavras concretas.
- **Português brasileiro.** "Cadastro", não "registro". "Você", não "tu" ou "vosmecê".
