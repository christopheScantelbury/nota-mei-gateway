# QA NotaFácil Empresa — Prompt completo

> **Como usar**: copie esse arquivo inteiro pra nova sessão Claude (ou outro QA).
> O agente sai executando: cadastro → login → 1ª nota → cancela → substitui →
> CRM → templates → recorrências → configurações → billing. Reporta bugs no
> formato definido no final.

---

## 🔁 ESTADO ATUAL DA QA — leia antes de começar

**Rodada 1** rodou em **2026-06-03** pelo Claude Sonnet 4.6. Resultado:
- 14 bugs reportados, **10 fixados**, 1 pendente (#6 SVG dark contexto externo),
  3 falsos-positivos (#5, #10, #13)
- Detalhe bug-por-bug em `docs/qa-empresa-status-rodada-1.md`
- Cobertura limitada aos **Blocos 1-3** (landing /me, cadastro, login até OTP).
  Blocos **4-14 NÃO foram testados** por falta de pré-requisitos (OTP em runtime,
  cert hom, webhook público, Stripe ativo, multi-empresa)

### 🎯 Foco da rodada atual (Rodada N+1)

1. **REGRESSÃO** — confirmar que os 10 bugs marcados como fixados não voltaram.
   Lista no fim deste prompt (seção "Regressão da rodada 1").

2. **COBERTURA NOVA** — atacar **Blocos 4-14** que ficaram fora. Foque aqui o
   tempo, esses blocos são o coração funcional do produto.

3. **EXPLORAR NOVOS BUGS** em qualquer área que rodar.

### 🛠️ Pré-requisitos pra cobrir Blocos 4-14

Antes de começar, **confirme com o dev** se você tem acesso a:

- [ ] **Magic link admin** pra logar como `teste-empresa@notafacil.com` sem
      esperar OTP. Comando curl em `ACESSOS.local.md` (Supabase service_role +
      `auth/v1/admin/generate_link`). Sem isso, Bloco 3 vira o teto.
- [ ] **Cert A1 de homologação** (`certificado_hom.pfx` + senha) pra Bloco 5
      (Emissão) → 6 (cancel/subst) → 7 (listagem com notas reais)
- [ ] **Webhook público** (webhook.site ou endpoint Vercel) pra Bloco 11.4
      (Webhooks no painel) + entrega real
- [ ] **Cartão Stripe teste** (`4242 4242 4242 4242`) pra Bloco 12 (Billing)
- [ ] **2ª empresa vinculada** ao `user_id` da conta teste pra Bloco 13
      (Multi-empresa). Pode pedir pro dev inserir via Supabase SQL

Se algum item faltar, **marque os blocos correspondentes como "PULEI por falta
de pré-requisito"** no relatório de cobertura — não invente fluxos.

### ⚠️ Bug pendente (não reabra)

- **#6**: `notafacil-empresa-dark.svg` tem texto "Nota" em branco. NO SITE
  isso é correto (dark mode = fundo escuro). O bug original era sobre
  visualizar o SVG em contextos externos (e-mail, preview do browser direto
  no arquivo). Aguardando decisão de design.

---

## CONTEXTO

Você é um QA Engineer sênior testando o **NotaFácil Empresa** — o produto carro-chefe de ScantelburyDevs, voltado para Microempresas (ME) e EPP. O lançamento depende disso funcionar PERFEITO. Vamos pegar tudo que estiver quebrado.

**URL produção**: https://www.emitirnotafacil.com.br/me
**Stack**: Next.js 14 (App Router) + Supabase + Go API (Railway) + Stripe + AWS
**Persona**: Microempresa Simples Nacional / Lucro Presumido / Lucro Real

**Contas de teste** (em `ACESSOS.local.md` ou perguntar ao dev):
- `teste-empresa@notafacil.com` (senha `TesteEmp2026!`) — ME Simples Nacional, CNPJ teste
- Pra cadastro novo: usar email pessoal + CNPJ válido seu

---

## SETUP ANTES DE COMEÇAR

1. Abrir Chrome em janela anônima (cookies limpos)
2. Abrir DevTools console aberto (catch erros JS)
3. Testar EM PARALELO em 2 viewports:
   - **Desktop**: 1440x900
   - **Mobile**: iPhone 14 Pro Max (430x932) no DevTools device mode
4. Testar EM PARALELO em 2 temas:
   - **Light** (default)
   - **Dark** (toggle no header)
5. Anotar TUDO que aparecer no console: warnings React, 404s de assets, JS errors
6. Tirar screenshot de QUALQUER comportamento estranho

---

## CENÁRIOS DE TESTE (executar em ordem)

### 🔹 BLOCO 1 — Landing /me (público, sem login)

#### 1.1 Renderização inicial
- [ ] Abrir https://www.emitirnotafacil.com.br/me
- [ ] **Logo "NotaFácil Empresa"** está completo (palavra "Nota" + "Fácil" + "Empresa") nos dois temas?
- [ ] Topbar laranja **NFS-e Nacional obrigatória em Set/2026** aparece no topo?
- [ ] Topbar **dismissable** (clicar X) e mantém dismissed por 7 dias após reload?
- [ ] Navbar com links: MEI · ME / EPP · Gateway API · Preços · Blog · Entrar · Cadastrar grátis
- [ ] Hero com countdown Set/2026 funcionando (atualiza)
- [ ] CTAs primários levam pra `/cadastro/me`?
- [ ] **Console sem erros JS**

#### 1.2 Toggle Light/Dark
- [ ] Clicar no ícone sol/lua no header
- [ ] Mudança aplicada **imediatamente** sem flash
- [ ] Logo troca pra versão correta (texto "Nota" visível em ambos)
- [ ] Background do main, cards, borders adaptam
- [ ] **Toggle persiste após reload** (cookie/localStorage)
- [ ] Fazer scroll, ver se navbar mantém glass effect

#### 1.3 Mobile
- [ ] Hambúrguer abre overlay fullscreen com links
- [ ] Cards de feature stack em 1 coluna
- [ ] Topbar não corta texto (truncate ou wrap)
- [ ] Hero responsive
- [ ] FAQ accordion funcionando

#### 1.4 Outras seções
- [ ] Como funciona — 3 toggles MEI/ME-EPP/Dev
- [ ] Selecionar "ME / EPP" mostra copies certos (Simples Nacional / Lucro Presumido)
- [ ] Pricing 3 cards (MEI / ME / Gateway) — card ME destacado com badge "Obrigatório Set/2026"
- [ ] Comparativo embed (4 colunas: NotaFácil / Focus NFe / eNotas / PlugNotas)
- [ ] CTA final pra `/cadastro/me`
- [ ] Footer com 4 colunas e logo persona

---

### 🔹 BLOCO 2 — Cadastro `/cadastro/me`

#### 2.1 Wizard 3 etapas
- [ ] Step 1: Tipo empresa (ME/EPP) + Regime tributário (Simples/LP/LR)
- [ ] Step 2: CNPJ → busca BrasilAPI automaticamente preenchendo razão social, endereço, CNAEs
- [ ] Step 3: Certificado A1 (PFX) + senha (opcional, pode pular)
- [ ] Voltar entre etapas mantém dados
- [ ] Validações exibem erros inline (CNPJ inválido, e-mail inválido, senha cert obrigatória se enviou arquivo)

#### 2.2 Edge cases
- [ ] CNPJ inválido (`00.000.000/0000-00`) → bloqueia avanço
- [ ] CNPJ válido mas inexistente → BrasilAPI 404, deixa preencher manual?
- [ ] CNPJ já cadastrado no sistema → erro 409 amigável (não 500)
- [ ] E-mail duplicado → erro amigável
- [ ] PFX inválido (arquivo .txt renomeado) → erro amigável
- [ ] PFX com senha errada → erro amigável
- [ ] Pular cert na step 3 → conta criada, redireciona pra confirmação de e-mail

#### 2.3 Sucesso
- [ ] Tela final mostra "Verifique seu e-mail"
- [ ] Não exibe API key (Empresa usa OTP, não API key como Gateway)
- [ ] CTA pra `/login?produto=me`

---

### 🔹 BLOCO 3 — Login `/login?produto=me`

#### 3.1 Fluxo OTP
- [ ] Step pick não aparece (produto já vem na URL)
- [ ] Logo persona empresa aparece
- [ ] Digitar e-mail → "Enviar código de acesso"
- [ ] Receber código 6 dígitos no e-mail (Brevo)
- [ ] Tela OTP com 6 inputs auto-focus
- [ ] Colar código (Cmd+V) preenche os 6 inputs
- [ ] Código errado → erro inline "Código incorreto ou expirado"
- [ ] Código correto → redireciona pra `/home`

#### 3.2 Edge cases
- [ ] E-mail não cadastrado → "E-mail não cadastrado. Faça seu cadastro primeiro."
- [ ] Reenviar antes do cooldown (60s) → desabilitado
- [ ] Clicar "Usar outro e-mail" volta pra step 1 com campo limpo
- [ ] Link "Criar conta" leva pra `/cadastro/me` (não `/cadastro` genérico)

---

### 🔹 BLOCO 4 — Dashboard `/home`

#### 4.1 Hero saudação
- [ ] "Bom dia/tarde/noite, {primeiro nome}"
- [ ] Plano atual exibido (Trial / Starter / etc.)
- [ ] Sidebar com itens: Home · Notas · Clientes · Templates · Recorrências · Links · Webhooks · API Keys · Billing · Configurações

#### 4.2 Onboarding checklist
- [ ] Cadastro realizado ✓
- [ ] Certificado A1 configurado (se enviou no cadastro) ✓
- [ ] Primeira nota emitida ⏳
- [ ] Primeira nota autorizada ⏳
- [ ] **Apenas ME**: API Key criada (não aparece se MEI)
- [ ] Progresso bar coerente com checks
- [ ] Some quando 100%

#### 4.3 Card Uso do mês
- [ ] "X / Y emissões"
- [ ] Barra de progresso com cor (cyan / yellow / red conforme %)
- [ ] **Pills coloridas com breakdown**: autorizadas (verde) · processando (amarelo pulsante) · rejeitadas (vermelho)
- [ ] Alerta visual se >= 80%
- [ ] Link "Ver histórico" leva pra `/billing`

#### 4.4 Card Integração API (ME-only)
- [ ] Mostra "Sua API Key" com prefix mascarado se já criou
- [ ] Mostra CTA "Criar API Key" se nunca criou
- [ ] Link "Gerenciar API Keys" pra `/configuracoes?aba=api-keys`

#### 4.5 Card Certificado A1
- [ ] **Sem cert**: alerta vermelho "Configure seu certificado"
- [ ] **Vencendo em 30d**: alerta amarelo com dias restantes
- [ ] **Vencido**: alerta vermelho "Renove agora"
- [ ] **OK**: card verde com data de validade

#### 4.6 Lista últimas 5 notas
- [ ] Status badge colorido
- [ ] Tomador + competência + valor + data
- [ ] Click vai pra `/notas/[id]`
- [ ] EmptyState se nenhuma nota

---

### 🔹 BLOCO 5 — Emissão de Nota `/notas/nova`

#### 5.1 Setup do form
- [ ] **Subtítulo dinâmico por regime**:
  - SN: "Como Simples Nacional, basta informar o serviço, o valor e o tomador..."
  - LP/LR: "Preencha os dados abaixo..."
- [ ] **Campos visíveis por regime**:
  - SN: SEM alíquota ISS, SEM retenção, SEM ISS estimado, COM disclaimer azul
  - LP/LR: TODOS os campos visíveis incluindo "Retenção de ISS" no opcionais

#### 5.2 Seção Serviço
- [ ] NBSServicoPicker funciona — digitar "desenvolvimento" e ver resultados filtrados pelos CNAEs do CNPJ
- [ ] Header verde "✓ Filtrado pelos CNAEs do seu CNPJ" aparece
- [ ] Botão "📋 Ver lista completa de serviços disponíveis" funciona
- [ ] Sugestor IA aparece quando preenche discriminação?
- [ ] Discriminação: contador 0/500 + valida obrigatório
- [ ] Valor: aceita "200" e mantém como "200.00" no blur (não vira 199.99!)
- [ ] Competência: input month funciona, default mês atual

#### 5.3 Seção Tomador
- [ ] Toggle PJ / PF
- [ ] CNPJ valida com algoritmo (dígito verificador) + máscara automática
- [ ] CPF idem
- [ ] CepMunicipioInput: digitar CEP 8 dígitos → auto-completa UF + município IBGE
- [ ] Se houver autocomplete de cliente já cadastrado, funciona?

#### 5.4 Opcionais (collapsible)
- [ ] Webhook URL aceita HTTPS
- [ ] **Retenção ISS** (só LP/LR): 3 botões (não esp. / retido / não retido)
- [ ] Idempotency key gerado automaticamente + botão regenerar

#### 5.5 Submit
- [ ] Validação client-side bloqueia se campo faltando
- [ ] Loading state no botão
- [ ] Sucesso → tela com "Nota enviada para processamento"
- [ ] Card `ISSRecolhimentoCard` aparece pra ME conforme regime
- [ ] CTAs "Ver status" e "Ver todas as notas"

#### 5.6 Erros
- [ ] Cert vencido → erro 422 amigável
- [ ] CNPJ tomador inválido → erro 422 destacando o campo
- [ ] Limite do plano atingido → erro 402 com CTA "Fazer upgrade"
- [ ] **E0310 (cTribNac inválido)**: NÃO deve acontecer mais — picker já filtra

---

### 🔹 BLOCO 6 — Detalhe da nota `/notas/[id]`

#### 6.1 Status PROCESSANDO
- [ ] Badge amarelo pulsante
- [ ] Mensagem "A Receita Federal está processando..."
- [ ] Auto-refresh ou botão "Atualizar"

#### 6.2 Status AUTORIZADA
- [ ] Badge verde
- [ ] Número NFS-e + Código de verificação
- [ ] Chave de acesso 50 dígitos (não estoura layout)
- [ ] Botões: Download PDF · Download XML · Enviar por e-mail · **Cancelar** · **Substituir**

#### 6.3 Status REJEITADA
- [ ] Badge vermelho
- [ ] Código de erro + descrição
- [ ] CTA "Corrigir e emitir novamente" abre `/notas/nova` com dados pré-preenchidos

#### 6.4 Cancelamento
- [ ] Click "Cancelar" abre modal
- [ ] Pede motivo (1=erro emissão / 2=serviço não prestado / 9=outro)
- [ ] Confirmação dispara evento e101101
- [ ] Status muda pra CANCELADA
- [ ] Timeline registra "Cancelada"

#### 6.5 Substituição
- [ ] Click "Substituir" abre modal
- [ ] Pede código justificativa (01-05 / 99)
- [ ] Abre form de nova nota com dados copiados
- [ ] Emite nova nota com `<subst><chSubstda>` referenciando original
- [ ] Original fica vinculada à nova via `substituida_por`

#### 6.6 Histórico de eventos
- [ ] Timeline mostra: criada · enviada Receita · autorizada/rejeitada · (cancelada/substituida)
- [ ] Cada evento com timestamp

---

### 🔹 BLOCO 7 — Listagem `/notas`

- [ ] Filtros: status · período · cliente · valor min/max
- [ ] Busca por número/CNPJ tomador
- [ ] Paginação (20/página)
- [ ] Export CSV
- [ ] Status badges coloridos
- [ ] Click linha → detalhe
- [ ] Mobile: tabela vira cards
- [ ] EmptyState se sem notas

---

### 🔹 BLOCO 8 — Clientes (CRM)

#### 8.1 Lista `/clientes`
- [ ] Tabela: razão social · CNPJ · e-mail · notas emitidas · ações
- [ ] Busca por nome/CNPJ
- [ ] Filtro por tags
- [ ] "Novo cliente" botão

#### 8.2 Novo `/clientes/novo`
- [ ] PJ / PF toggle
- [ ] CNPJ → "Buscar dados" preenche tudo via BrasilAPI
- [ ] CEP → preenche endereço (ViaCEP) automaticamente
- [ ] Tags com vírgula
- [ ] Observações textarea (max 2000)
- [ ] Submit: 409 se duplicado oferece "Abrir cliente existente"

#### 8.3 Detalhe `/clientes/[id]`
- [ ] Card com dados
- [ ] Histórico de notas do cliente (#rps + StatusBadge pill + valor + chave NFS-e truncada)
- [ ] Click nota → detalhe nota
- [ ] Botão Editar

#### 8.4 Editar `/clientes/[id]/editar`
- [ ] CEP auto-busca endereço (UF, município IBGE, logradouro, bairro)
- [ ] Tipo (PJ/PF) e CNPJ READONLY
- [ ] Salvar redireciona pra detalhe + refresh

---

### 🔹 BLOCO 9 — Templates (Pro+)

- [ ] Lista templates salvos
- [ ] Criar template a partir de nota emitida
- [ ] Editar / Excluir
- [ ] Em `/notas/nova` selecionar template preenche tudo
- [ ] Se plano não inclui → tela PlanGate com upgrade

---

### 🔹 BLOCO 10 — Recorrências (Starter+)

- [ ] CRUD de recorrências (mensal / trimestral / anual)
- [ ] Próxima emissão calculada certo
- [ ] Pausar / Retomar
- [ ] Job real emite no próximo tick

---

### 🔹 BLOCO 11 — Configurações `/configuracoes`

#### 11.1 Aba Dados
- [ ] Mostra CNPJ, razão social (readonly)
- [ ] E-mail editável
- [ ] Município editável via CepMunicipioInput

#### 11.2 Aba Certificado
- [ ] Status atual + validade
- [ ] Upload novo PFX + senha
- [ ] Avisos de vencimento

#### 11.3 Aba API Keys
- [ ] Lista chaves ativas (mascaradas) + revogadas (collapse)
- [ ] Quota X/Y baseada no plano
- [ ] Criar nova: modal escolhe ambiente (live/test) + label
- [ ] Chave nova exibida 1 vez com botão Copiar
- [ ] Revogar com confirmação modal

#### 11.4 Aba Webhooks
- [ ] URL + secret HMAC
- [ ] Eventos selecionáveis (autorizada / rejeitada / cancelada)
- [ ] Log de últimas entregas com status (200/4xx/5xx)
- [ ] Botão "Reenviar" tentativa específica

---

### 🔹 BLOCO 12 — Billing `/billing`

- [ ] Plano atual + ciclo
- [ ] Uso vs limite barra
- [ ] Histórico mensal tabela
- [ ] CTA Customer Portal Stripe (abre nova aba)
- [ ] CTA upgrade abre Checkout Stripe
- [ ] Após pagamento, redireciona com sucesso

---

### 🔹 BLOCO 13 — Multi-empresa (se conta tem mais de 1 CNPJ)

- [ ] Seletor empresa no topo da sidebar
- [ ] Trocar empresa **NUNCA mistura dados** (notas/clientes/etc. filtram corretamente)
- [ ] URL `/seletor-empresa` funciona pra escolher após login se 2+

---

### 🔹 BLOCO 14 — Logout + sessão

- [ ] Botão "Sair" na sidebar
- [ ] Redireciona pra `/login?produto=me`
- [ ] Cookies limpos
- [ ] Tentar acessar `/home` após logout → redireciona pra login

---

## VALIDAÇÕES TRANSVERSAIS

A cada tela visitada, validar:
- [ ] **Sem erro JS** no console
- [ ] **Sem 404** de assets/API (Network tab)
- [ ] **Theme toggle funciona** sem flash em ambos modos
- [ ] **Mobile responsivo** sem overflow horizontal
- [ ] **Navegação SPA** mostra a barra de progresso cyan no topo (NavigationProgress)
- [ ] **Acessibilidade básica**: tab navega, foco visível, aria-labels em botões só-ícone

---

## REPORT FORMAT (uma issue por bug)

```
## [Bloco X.Y] — Título curto do bug

**URL**: https://www.emitirnotafacil.com.br/...
**Persona/conta**: teste-empresa@notafacil.com (ME Simples Nacional)
**Viewport**: Desktop 1440 | Mobile iPhone
**Tema**: Light | Dark

**Passos para reproduzir**:
1. ...
2. ...
3. ...

**Resultado esperado**: ...
**Resultado obtido**: ...

**Screenshot**: anexar
**Console**: copiar TODOS erros JS desde o page load
**Network**: anexar requests com status >= 400

**Severidade**: P0 (bloqueante) / P1 (importante) / P2 (cosmético)
```

---

## BUGS COMUNS A INVESTIGAR ESPECIFICAMENTE

Lista de "armadilhas conhecidas" — verificar essas explicitamente:

1. **Logo "Nota" preto invisível em dark mode** — testar nas 4 personas (default/mei/me/api) nos 2 temas
2. **Layout quebrado em modo claro** — qualquer card branco contra fundo claro? Texto slate-900 contra bg slate-50?
3. **Topbar laranja sobrepondo conteúdo** — `/me`, `/comparativo`, qualquer page
4. **Sandbox crash** `C.slice is not a function` — testar limpar localStorage e voltar
5. **Brevo cron 1/min vs 1/dia** — verificar se queue está processando (admin do Brevo)
6. **R$ 200 → R$ 199,99** — digitar inteiro no campo valor, blur, ver se mantém formato
7. **CNAE filter retorna vazio**: criar CNPJ com CNAE pouco comum → ver fallback
8. **CPF vs CNPJ máscara** — alternar toggle PJ/PF, ver se reseta documento e mantém máscara
9. **Cancelamento sem motivo** — pode submeter? Espera-se que valide
10. **OTP expirado** — esperar 5 min depois de receber código, testar

---

## MAPA DE COBERTURA — O QUE NÃO TESTOU

Tão importante quanto reportar bugs: **mapear honestamente o que NÃO conseguiu cobrir**. A gente usa isso pra expandir o checklist na próxima rodada e construir suíte automatizada (Playwright) depois.

Pra cada um dos 14 blocos do checklist, classifique seu nível de cobertura:

```
## Bloco X.Y — [nome do bloco]
- **Cobertura**: Completa | Parcial | Pulei
- **O que NÃO testei e por quê**: (1 frase por item)
  - Ex: "Não testei substituição porque não consegui produzir uma AUTORIZADA na janela do trial"
  - Ex: "Não testei multi-empresa porque a conta de teste só tem 1 CNPJ"
  - Ex: "Não testei webhook real porque não tenho endpoint público pra receber"
- **Pré-requisitos que faltam pra cobrir**: o que precisa existir (conta, cert, CNPJ, etc.)
- **Risco se NÃO testar**: P0 (pode quebrar lançamento) / P1 / P2
```

### Fluxos que provavelmente vão ser PULADOS sem ajuda
Se você ESPECÍFICAMENTE não conseguir cobrir, registrar:

- [ ] **Emissão real contra Receita Federal** (precisa cert ICP-Brasil + CNPJ ativo)
- [ ] **Webhook entregando em endpoint público** (precisa URL HTTPS recebendo)
- [ ] **Cancelamento de nota AUTORIZADA** (depende de ter autorização sucessful)
- [ ] **Substituição e105102** (depende de ter autorização)
- [ ] **Multi-empresa** (precisa conta com 2+ CNPJs vinculados)
- [ ] **Upgrade Stripe real** (precisa cartão teste)
- [ ] **Customer Portal Stripe** (precisa subscription ativa)
- [ ] **Recorrência disparando** (precisa esperar 24h ou job manual)
- [ ] **Cert vencendo em 30d** (precisa cert real prestes a vencer)
- [ ] **Brevo cron processando queue** (precisa acesso ao painel Brevo)
- [ ] **Conta com plano pago** (precisa Stripe live ou seed manual)
- [ ] **Métricas Looker** (precisa dashboard configurado)
- [ ] **Performance Lighthouse** (precisa rodar lighthouse CLI)
- [ ] **Acessibilidade WCAG** (precisa axe-core, leitor de tela)

### Cenários "pensei mas não rodei"
Liste cenários que **te ocorreram** durante o teste mas você decidiu pular:
- Por falta de tempo
- Por achar irrelevante mas talvez seja
- Por não saber como reproduzir
- Por não ter dados/contexto

Formato:
```
- "O que aconteceria se [X]?" — não testei porque [motivo]
- Ex: "O que acontece se cancelo uma nota substituída?" — não testei pq nunca cheguei na substituição
- Ex: "Trial expirando no meio de emissão?" — não testei pq não sei como forçar trial fim
- Ex: "Sessão Supabase expira no meio do form?" — não testei pq dura 1h
```

### Cenários DE BORDA que provavelmente faltam
Sugira **novos casos de teste** que não estão no checklist mas você acha que valem:
- Concorrência (2 abas abertas emitindo)
- Conexão lenta / offline (Network throttling)
- Volume (50+ notas pra paginar, importação em massa)
- Internacionalização (CNPJ estrangeiro? endereço fora do BR?)
- Refresh durante POST de nota (interrompe a request)
- Voltar do browser durante wizard (perde dados?)
- Copiar/colar em campos formatados (CNPJ com pontos vs sem)
- Acentos/caracteres especiais em razão social, discriminação
- Timezone diferente (visualizar nota emitida no Brasil estando no exterior)
- Latência alta (BrasilAPI demorando 5s+)

---

## REGRESSÃO DA RODADA 1 — checagem rápida obrigatória

Antes de explorar áreas novas, validar que as **10 correções da rodada 1**
seguem em pé. Cada item: marca ✅ se está OK, ❌ se voltou (vira bug).

### P0 fixados

- [ ] **#1** — `/cadastro/me` agora tem 3 steps (Dados / Regime / Certificado);
      tela final mostra "Empresa cadastrada!" + instrução de checar e-mail;
      **NÃO exibe `sk_live_...`** em lugar nenhum
- [ ] **#8** — confirma 3 steps (sem step "API Key" no StepIndicator)

### P1 fixados

- [ ] **#2** — heading `/me`: `document.querySelector('h1').textContent`
      contém "NFS-e nacional a partir de setembro" (com **espaço** entre
      "nacional" e "a")
- [ ] **#4** — `/me` tem na ordem: hero (com PioneerBadge + CountdownSet2026)
      → Beneficios → Como Funciona → **Comparativo summary (4 colunas)** →
      **PricingSection (3 cards)** → FAQ → CTA Final
- [ ] **#7** — `/login?produto=me` tem `document.title` = "Entrar — NotaFácil
      Empresa". Trocar `produto=mei` → "Entrar — Nota Fácil MEI", `produto=gateway`
      → "Entrar — NotaFácil API"
- [ ] **#11** — FAQ na `/me`: clicar pergunta seta `aria-expanded="true"` no
      button + `aria-controls="me-faq-panel-N"`. Panel tem `role="region"` +
      `aria-labelledby`
- [ ] **#12** — `/cadastro/me` Step 1: testar 3 cenários distintos:
      1. CNPJ com DV inválido (`12.345.678/0001-00`) → mensagem **"CNPJ inválido
         — verifique os dígitos."** sem chamada de rede + botão "Continuar"
         **disabled** (validação módulo 11 client-side, Bug N+3 fix)
      2. CNPJ matematicamente válido mas inexistente na Receita:
         **`99.999.999/0001-91`** (testado 2026-06-03 — BrasilAPI retorna 404)
         → mensagem **"CNPJ não encontrado na Receita Federal..."** + botão disabled
      3. CNPJ real (ex: `34.488.964/0001-42`) → autofill OK + botão habilitado

      ⚠️ **CNPJs que NÃO funcionam como "fictícios"** (eu testei):
      - `11.222.333/0001-81` → 200 (Caixa Escolar real)
      - `11.111.111/0001-91` → 200 (Elaine Ap. Pinheiro real)
      - `12.345.678/0001-95` → 200 (existe)
      - `88.888.888/0001-61` → 400 (DV inválido — vai pelo path do cenário 1)
      - `77.777.777/0001-31` → 400 (DV inválido — idem)
      Use `99.999.999/0001-91` que é DV-válido + Receita-inexistente.
- [ ] **#14** — `/cadastro/me` Step 1: digitar CNPJ real (`34.488.964/0001-42`)
      → após 400ms, request pra `brasilapi.com.br/api/cnpj/v1/...` aparece em
      Network → razão social, e-mail, CNAE, CEP preenchem sozinhos (campos
      antes vazios)

### P2 fixados

- [ ] **#3** + **#9** — `/me` SÓ tem 1 botão "Fechar aviso" no DOM (era 2 com
      UrgencyBannerME duplicando). Dismiss da topbar persiste por **7 dias**
      via cookie `nf_topbar_dismissed_v1` (não localStorage `urgency_banner_dismissed`)

### Falsos-positivos confirmados (NÃO reabrir como bug)

- **#5** — `/me` não tem toggle MEI/ME-EPP/Dev em "Como funciona". Está
  intencional: na home `/` o toggle existe; na `/me` o conteúdo é dedicado ME/EPP
- **#10** — 2 `ThemeToggle` no DOM: 1 desktop (`hidden sm:flex`), 1 mobile
  (`sm:hidden`). Só 1 visível por viewport. WCAG 4.1.2 OK
- **#13** — `NavigationProgress` não aparece em `querySelector` no estado idle
  porque só renderiza durante transição SPA. Pra testar: clicar link "Preços"
  no header e observar a barra cyan de 3px no topo durante carregamento

Se algum desses 3 voltar a parecer bug, **antes de reportar**, leia o racional
acima e descreva PORQUE acha que continua sendo bug nesse contexto específico.

---

## FIM

Quando terminar, gerar **relatório consolidado** com:

### Parte 1 — Bugs encontrados
- Total por severidade (P0/P1/P2)
- Top 5 mais críticos com link/screenshot
- Avaliação geral (vai pro lançamento? bloqueador? release candidate?)

### Parte 2 — Mapa de cobertura
- % estimado de cobertura por bloco (1-14)
- Lista PRIORIZADA dos fluxos não cobertos que mais preocupam
- Pré-requisitos que precisamos pra cobrir tudo (contas, cert hom, CNPJs, etc.)

### Parte 3 — Sugestões pro próximo round
- 5-10 novos casos de teste que valem adicionar ao checklist
- Áreas que merecem automação Playwright primeiro (alto risco + alta repetição)
- Dados/ambientes que precisam ser criados antes da próxima rodada

Boa caça 🐛
