# QA NotaFácil Empresa — Prompt completo

> **Como usar**: copie esse arquivo inteiro pra nova sessão Claude (ou outro QA).
> O agente sai executando: cadastro → login → 1ª nota → cancela → substitui →
> CRM → templates → recorrências → configurações → billing. Reporta bugs no
> formato definido no final.

---

## 🔁 ESTADO ATUAL DA QA — leia antes de começar

**Rodadas executadas até agora**:
- **R1** (Sonnet 4.6, 2026-06-03): 14 bugs reportados → 10 fixados +
  3 falsos-positivos + 1 pendente design (#6)
- **R2** (Sonnet 4.6, 2026-06-03): 5 novos + 2 ressalvas → 1 confirmado
  (N+1 logo) + 3 falsos-positivos + 1 spec
- **R2-Verify** (Sonnet 4.6, 2026-06-03): 4 falsos-positivos confirmados
  + 1 novo P2 (notafacil-gateway.svg 404, fixado com alias)
- **Pós-handoff** (sessão 2026-06-03/04): 4 fixes adicionais aplicados
  fora de QA formal (logo dark mode 2ª iteração, topbar flash SSR,
  PricingToggle hrefs dev, Login com senha — feature nova)

Status consolidado em `docs/qa-empresa-status-rodadas.md`.

**Total**: 20 bugs únicos → 13 fixados em QA + 4 fixes pós-handoff =
**17 verificações** que precisam regredir nesta rodada.
**Avaliação atual**: 🟡 release candidate.

### 🆕 Novidades desde a última rodada

**🔐 Login com senha** (commit `61d7d03`, 2026-06-03):
Feature nova grande — `/login` agora tem toggle entre **Código por e-mail**
(magic link OTP, default) e **Senha**. Usuário define senha em
`/configuracoes/senha` (após estar logado via magic link).

Componentes/políticas envolvidos:
- `apps/web/lib/auth/password.ts` — validador puro (8+ chars, minúscula,
  maiúscula, número) + score 0..4 pra barra de força
- `apps/web/components/auth/TurnstileChallenge.tsx` — captcha feature-flag
  via `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Aparece **após 3 tentativas falhas**
  (track `localStorage.nf_login_failed_attempts`)
- `/configuracoes/senha` (rota nova server-protected) com SenhaForm
- Link "Definir / trocar senha" na aba Perfil de `/configuracoes`
- Supabase Auth config aplicada via Management API:
  - `password_min_length: 8` ✅
  - `password_required_characters: minúscula+maiúscula+número` ✅
  - `mailer_notifications_password_changed_enabled: true` ✅ (e-mail PT-BR
    "Sua senha foi alterada — NotaFácil")
  - HIBP (Have I Been Pwned): ❌ feature paga Supabase Pro, não ativada
  - Captcha Turnstile: ⏳ aguardando provisionar (dormente, zero impacto até)

Cadastros (Empresa/MEI/Dev) **NÃO mudaram** — magic link continua o único
caminho de signup. Senha é opt-in pós-login.

**Novos blocos de teste**: Bloco 3-SENHA (login com senha) + Bloco 11.5
(definir/trocar senha em Configurações).

**🟠 UrgencyTopBar SSR-safe** (commit `6cabf05`, 2026-06-03):
Resolveu o "flash laranja" de ~50ms no 1º paint pra usuários que já
dismissaram a barra. Agora cookie é lido no servidor com `next/headers`
+ override CSS `:root{--topbar-height:0px}` no SSR. Regressão na Regressão
Acumulada (item RA-1).

**🔠 LogoAdaptive root cause real** (commit `0c77c73`, 2026-06-03):
Bug N+1 foi DE FATO fixado nesta iteração. A versão anterior (commit
`5f95d6d` da R2-Verify) ainda tinha o problema porque Tailwind JIT não
detecta classes formadas por template strings interpoladas
(`dark:${variable}`). Agora usa 2 wrappers `<span class="contents">` com
classes 100% literais. Regressão obrigatória (item RA-2).

**🔗 PricingToggle hrefs dev** (commit `d32c8c7`, 2026-06-03):
Hrefs dos planos dev tinham `/cadastro/dev&plano=...` (gerava 404).
Corrigido pra `/cadastro/dev?plano=...` em Starter/Basic/Pro/Business
(item RA-3).

**📦 Cadastro Dev simplificado** (commit `26e0ce1`, 2026-06-03):
Fluxo `/cadastro/dev` separado pro dev integrador. NÃO exige CNPJ próprio
porque dev pode ser de uma empresa (não dono dela).

- Migration `20260603000001_api_keys_dev_accounts.sql` aplicada em prod:
  `api_keys.empresa_id` virou NULLABLE + `user_id` adicionado (FK auth.users) +
  CHECK constraint (pelo menos um setado) + RLS policies pra dev ver suas keys.
- API route `POST /api/auth/register-dev` cria auth.user com
  `user_metadata.is_dev_account=true` + api_key `sk_test_` vinculada user_id.
- Antiga rota `/cadastro?produto=gateway` foi REDIRECIONADA pra `/cadastro/dev`
  em 7 lugares (CadastroSeletor, Navbar, docs, sandbox, login, SDKs, etc).

**Bloco de teste já existente**: Bloco 2-Dev (depois do Bloco 2 normal).

### 🎯 Foco da rodada atual (Rodada N+2)

1. **REGRESSÃO ACUMULADA** — 13 fixes da QA + 4 fixes pós-handoff = 17 itens
   pra confirmar (seção "REGRESSÃO ACUMULADA" no fim).

2. **🔐 LOGIN COM SENHA** (feature nova) — Bloco 3-SENHA + Bloco 11.5.
   P0 da rodada porque é fluxo crítico recém-criado tocando auth.

3. **COBERTURA NOVA** — atacar **Blocos 4-14** que ficaram fora nas rodadas
   anteriores.

4. **EXPLORAR NOVOS BUGS** em qualquer área que rodar.

### 🛠️ Pré-requisitos pra cobrir Blocos 4-14

Antes de começar, **confirme com o dev** se você tem acesso a:

- [x] **Magic link admin** (configurado 2026-06-04, commit `0e6d577` +
      próximo). Rota `POST /api/dev/magic-link` aceita `DEV_ADMIN_TOKEN`
      no header e devolve `action_link` da Supabase pronto pra abrir em
      janela anônima → entra direto no `/home`. Comando completo em
      `ACESSOS.local.md` seção **9-ter**. Use pra:
      - `teste-empresa@notafacil.com` (conta ME pra Blocos 4–13)
      - `teste-api@notafacil.com` (conta Dev pra Bloco 2-Dev fluxo feliz)
      - qualquer outro email que vc cadastrar no meio do QA
- [ ] **Cert A1 de homologação** (`certificado_hom.pfx` + senha) pra Bloco 5
      (Emissão) → 6 (cancel/subst) → 7 (listagem com notas reais)
- [ ] **Webhook público** (webhook.site ou endpoint Vercel) pra Bloco 11.4
      (Webhooks no painel) + entrega real
- [ ] **Cartão Stripe teste** (`4242 4242 4242 4242`) pra Bloco 12 (Billing)
- [ ] **2ª empresa vinculada** ao `user_id` da conta teste pra Bloco 13
      (Multi-empresa). Pode pedir pro dev inserir via Supabase SQL
- [ ] **E-mail descartável** (ex: mailinator, tempmail.io) pra testar
      cadastro Dev (Bloco 2-Dev) sem poluir caixa de entrada real
- [ ] **Acesso ao Supabase Dashboard** (somente leitura) pra validar Bloco
      2-Dev.6 (verificar que `auth.users.user_metadata.is_dev_account=true`
      foi setado + `api_keys` linha com `user_id` e `empresa_id=NULL`)

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
- `teste-api@notafacil.com` (senha `TesteApi2026!`) — Dev integrador (Bloco 2-Dev),
  já cadastrado via fluxo novo. Pra testar cadastro novo, use e-mail descartável
  (ex: `qa-dev-{timestamp}@scantelburydevs.com`)
- Pra cadastro ME novo: usar email pessoal + CNPJ válido seu

**CNPJs úteis pra testes** (validados 2026-06-03 via BrasilAPI):
| Cenário | CNPJ | Comportamento esperado |
|---|---|---|
| DV inválido | `12.345.678/0001-00` | Erro "CNPJ inválido" sem chamar rede |
| Válido + 404 Receita | `99.999.999/0001-91` | "CNPJ não encontrado…" |
| Real (autofill) | `34.488.964/0001-42` | BrasilAPI 200 + preenche razão social |

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

### 🔹 BLOCO 2-DEV — Cadastro Dev `/cadastro/dev`

> **Novo fluxo de 2026-06-03**. Diferente do Bloco 2 (ME): dev NÃO precisa
> de CNPJ próprio. Sai com `sk_test_` + sandbox liberado. Cadastro de
> empresa emissora fica pra depois (no painel).

#### 2-Dev.1 Acesso ao fluxo
- [ ] `/cadastro/dev` carrega direto (rota dedicada, não query string)
- [ ] Link da Navbar em `/gateway` (botão "Cadastrar grátis") leva PRA
      `/cadastro/dev` (NÃO mais pra `/cadastro?produto=gateway`)
- [ ] Link da `/sandbox`, `/docs`, `/docs/sdks` (CTA "Criar conta") leva PRA
      `/cadastro/dev`
- [ ] CadastroSeletor opção 3 ("Sou desenvolvedor") leva PRA `/cadastro/dev`
- [ ] Tentar acessar URL antiga `/cadastro?produto=gateway` — pode renderizar
      seletor genérico (não-crítico, mas vale anotar como UX)

#### 2-Dev.2 Form
- [ ] Header: "👨‍💻 Cadastro de Desenvolvedor" + título "Cadastro rápido — sem CNPJ"
- [ ] **3 campos visíveis** (NÃO 5+):
  1. Seu nome (required)
  2. E-mail (required)
  3. Empresa onde você trabalha (**opcional**)
- [ ] Mensagem azul "📧 Vamos enviar um link mágico…" presente
- [ ] Checkbox "Concordo com Termos + Política de Privacidade" obrigatório
- [ ] Botão CTA "Criar conta e gerar API Key" (NÃO "Continuar →")

#### 2-Dev.3 Validações client-side
- [ ] Nome < 2 chars → erro inline "Informe seu nome"
- [ ] E-mail sem @ → erro inline "E-mail inválido"
- [ ] Sem aceitar termos → error banner vermelho "Você precisa aceitar os termos"
- [ ] Envio bem-sucedido com mínimo (nome + e-mail) sem preencher "Empresa"

#### 2-Dev.4 API + sucesso
- [ ] POST `/api/auth/register-dev` com body `{nome, email, empresa_trabalha?}`
- [ ] Resposta 201 com `{user_id, api_key (sk_test_), email_otp_pending: true}`
- [ ] Tela de sucesso mostra:
  - "🎉 Conta criada! Você está em modo sandbox."
  - Bloco com **API key sk_test_** completa (cor cyan, monospace, select-all)
  - Botão "📋 Copiar API Key" funciona (clipboard)
  - Aviso amber "⚠️ Guarde com segurança... só sandbox"
  - CTA "Ver Quickstart →" (link pra `/docs/quickstart`)
  - CTA "Testar no Sandbox" (link pra `/sandbox`)
  - Texto "Já enviamos um link de acesso pro seu e-mail X@Y.com"

#### 2-Dev.5 Edge cases
- [ ] E-mail já cadastrado → erro 409 "E-mail já cadastrado. Vá para Entrar."
- [ ] Sem `NEXT_PUBLIC_API_URL`/Supabase configurado → erro 500 "CREATE_USER_FAILED" (não 200 silencioso)
- [ ] Rede offline → mensagem "Falha de conexão. Tente novamente."
- [ ] Submit duplicado (botão clicado 2× rápido) — botão fica `disabled`+`loading`,
      não faz 2 requests
- [ ] Pular e voltar pra mesma página com browser back → form mantém estado ou
      limpa? (qualquer comportamento OK; só não pode crashar)

#### 2-Dev.6 Migration & schema
> Não dá pra testar via UI. Só via SQL/Supabase Dashboard:
- [ ] `api_keys.empresa_id` é nullable (não causa erro `null violates not-null`)
- [ ] `api_keys.user_id` existe e é FK pra `auth.users(id)`
- [ ] Constraint `api_keys_owner_required` rejeita INSERT com ambos NULL
- [ ] Index `idx_api_keys_user_id` aparece em `\d api_keys`

#### 2-Dev.7 Próximos passos (NÃO testar agora — anote como pendência da UX)
- Após login do dev, o `/home` deveria mostrar "modo sandbox" + CTA "Adicionar
  empresa emissora" → `/cadastro/me`. Esse fluxo ainda NÃO foi implementado
  no painel. Reporte como "gap conhecido" se for cobrir Blocos 4-14.

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

### 🔹 BLOCO 3-SENHA — Login com senha `/login` (FEATURE NOVA)

⚠️ **Pré-requisito:** definir senha na conta de teste ANTES de testar este
bloco. Faça login via magic link → vá em **Configurações → Perfil → "Definir
/ trocar senha"** → defina (ex: `TesteSenh@2026`). Sem isso, todos os testes
abaixo retornam "credenciais inválidas".

#### 3-SENHA.1 — Toggle visível
- [ ] Em `/login` (ou `/login?produto=me`), no topo do form, vê toggle com 2
      abas: **Código por e-mail** (selecionada default) e **Senha**
- [ ] `role="tablist"` no container + `aria-selected` nos botões (WCAG)
- [ ] Aba ativa tem fundo `bg-white dark:bg-navy-700` + sombra leve
- [ ] Clicar entre abas é instantâneo (sem reload)

#### 3-SENHA.2 — Fluxo feliz com senha correta
- [ ] Clicar aba "Senha"
- [ ] Form mostra: input E-mail + input Senha (`type="password"`)
- [ ] `autoComplete="email"` no campo email + `autoComplete="current-password"`
      na senha — gerenciadores de senha (1Password, Bitwarden, Chrome) oferecem
      preenchimento
- [ ] Digitar e-mail + senha corretos → "Entrar" → redireciona pra `/home`
- [ ] Sessão Supabase ativa (verifica em DevTools → Application → Cookies
      `sb-pzjvgtwnstfyangfwdom-auth-token`)

#### 3-SENHA.3 — Segurança contra ataques
- [ ] **Senha errada** (e-mail certo + senha errada): aparece mensagem
      **EXATAMENTE** `"E-mail ou senha incorretos."` — nunca pode vazar
      "senha incorreta" ou "usuário não existe" separadamente
- [ ] **E-mail inexistente** (`naoexiste@fake.com` + qualquer senha): MESMA
      mensagem genérica `"E-mail ou senha incorretos."` (anti user-enumeration)
- [ ] **Política de senha forte aplicada no Supabase** (já não é mais possível
      definir senha fraca em /configuracoes/senha — ver Bloco 11.5)
- [ ] **Rate limit Supabase**: tentar 31 logins falhos em 1h → deveria retornar
      429 (pode pular se for muito custoso testar; confirmar no `auth.config`
      do Supabase Dashboard: `rate_limit_verify=30`)

#### 3-SENHA.4 — Tracking de tentativas falhas
- [ ] Após cada login falho, abrir DevTools → Application → Local Storage
      → key `nf_login_failed_attempts` incrementa: 1, 2, 3, ...
- [ ] Após login com sucesso, a key é REMOVIDA do localStorage
- [ ] (Se Turnstile estiver ativo via env `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
      após **3 falhas**, aparece widget Cloudflare Turnstile no form. Submit
      bloqueado até resolver. Como Turnstile está dormente em prod hoje, **se
      a env var não existe, captcha NÃO deve aparecer (verifica via inspect
      do DOM — não deve ter `iframe` Cloudflare)**

#### 3-SENHA.5 — Esqueci a senha (fallback)
- [ ] No form de senha, abaixo do botão "Entrar", vê texto
      **"Esqueceu a senha?"** com link clicável **"Entrar por código no e-mail"**
- [ ] Clicar volta pro modo Magic Link com o e-mail já preenchido
- [ ] Erro anterior é limpo

#### 3-SENHA.6 — Persistência do modo
- [ ] Trocar entre abas Magic Link ↔ Senha **NÃO** preserva o que foi digitado
      em cada modo (intencional — campos isolados)
- [ ] Recarregar `/login` → sempre volta pra aba **Magic Link** (default)

#### 3-SENHA.7 — Mobile + Dark mode
- [ ] No iPhone 14 Pro Max (430x932), as 2 abas cabem na largura
- [ ] Dark mode: aba ativa fica `bg-navy-700` (não branco)
- [ ] Logo persona muda corretamente conforme `?produto=me/mei/gateway`

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

#### 11.5 Definir / trocar senha (FEATURE NOVA — `/configuracoes/senha`)

##### 11.5.1 Entrada
- [ ] Em `/configuracoes` aba **Perfil**, abaixo do botão "Salvar alterações",
      vê seção **"Segurança"** com link `Definir / trocar senha →`
- [ ] Texto explicativo: "Sua conta usa código por e-mail por padrão. Defina
      uma senha pra ter um login alternativo (útil pra testes)."
- [ ] Clicar leva pra `/configuracoes/senha`

##### 11.5.2 Tela `/configuracoes/senha`
- [ ] Cabeçalho mostra `← Voltar para Configurações`
- [ ] Título: **"Definir senha"** (se nunca definiu) ou **"Trocar senha"**
- [ ] Form com 2 campos: **Nova senha** + **Confirmar nova senha**
- [ ] **NÃO pede senha antiga** (segurança vem da sessão ativa)
- [ ] Aviso textual no fim do form: "ℹ️ Você está autenticado nesta sessão
      — não pedimos a senha antiga. Se você não foi quem iniciou esta troca,
      faça logout em todos os dispositivos."

##### 11.5.3 Barra de força visível
- [ ] Digitar `abc` (3 chars) → barra aparece, **vermelha**, label "Muito
      fraca", lista de erros mostra: "Mínimo 8 caracteres" + "Pelo menos 1
      letra MAIÚSCULA" + "Pelo menos 1 número"
- [ ] Digitar `Abcdefg1` (8 chars + mixed) → barra **verde** (3-4
      segmentos), label "Forte" ou "Muito forte"
- [ ] Sem campo preenchido, barra não aparece
- [ ] Botão "Definir senha" **disabled** até validation.ok=true E
      passwordsMatch=true

##### 11.5.4 Submit com sucesso
- [ ] Senha válida + confirmação igual → "Definir senha" → loading → tela
      de sucesso verde "Senha definida com sucesso ✓" + CTA "entre em /login
      usando {email} + sua senha"
- [ ] Receber e-mail PT-BR no inbox da conta com assunto **"Sua senha foi
      alterada — NotaFácil"**

##### 11.5.5 Validação da política Supabase (segurança real)
Mesmo se você forçasse `validation.ok=true` no DevTools (ex: manipulando
o estado React), o Supabase Auth bloqueia. Pra testar:
- [ ] Abrir DevTools console
- [ ] Executar:
      ```js
      const sb = (await import('/_next/static/chunks/main-app.js')); // ou similar
      // Mais simples: tentar diretamente via fetch da API auth
      await fetch('https://pzjvgtwnstfyangfwdom.supabase.co/auth/v1/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + document.cookie.match(/sb-[a-z0-9]+-auth-token=([^;]+)/)[1],
          'apikey': '<NEXT_PUBLIC_SUPABASE_ANON_KEY>'
        },
        body: JSON.stringify({password: 'abc'})
      }).then(r => r.json())
      ```
- [ ] Resposta deve ser erro: **"Password should be at least 8 characters"**
      ou similar (política aplicada via Management API em 2026-06-03)

##### 11.5.6 Voltar e logar com senha
- [ ] Logout
- [ ] `/login` aba Senha + e-mail + senha recém-definida → entra em `/home` ✓

##### 11.5.7 Tentativa em sessão expirada
- [ ] Em `/configuracoes/senha`, com sessão válida, abrir DevTools →
      Application → deletar cookie `sb-...-auth-token`
- [ ] Tentar submeter → erro "Sessão expirada. Faça login novamente."
- [ ] **NÃO** deve dar erro genérico de network

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

## REGRESSÃO ACUMULADA (R1 + R2 + R2-Verify + Pós-handoff) — checagem obrigatória

Antes de explorar áreas novas, validar que os **17 fixes acumulados** seguem
em pé. Cada item: marca ✅ se está OK, ❌ se voltou (vira bug).

### Pós-handoff (fixes 2026-06-03/04 fora de QA formal)

- [ ] **RA-1 — UrgencyTopBar SSR-safe** (commit `6cabf05`). Limpar cookies
      do navegador. Carregar `/me` pela primeira vez → topbar laranja já
      aparece no SSR (sem flash do tipo "aparece-some"). Clicar X →
      topbar some + `paddingTop` do wrapper vira `0`. Recarregar → topbar
      **NÃO aparece** mesmo por 1 frame (cookie agora é lido server-side
      via `next/headers`). DevTools → Application → Cookies →
      `nf_topbar_dismissed_v1=1` presente, age=7d.

- [ ] **RA-2 — LogoAdaptive dark mode (root cause real)** (commit `0c77c73`).
      Toggle dark mode em `/`, `/mei`, `/me`, `/gateway`. O texto "Nota"
      deve aparecer **legível** (cor clara) em todos os temas e todas
      personas. Inspecionar elemento da logo → vê **2 wrappers
      `<span class="contents">`**, um com `dark:hidden` outro com
      `hidden dark:contents`. NÃO deve ter classes interpoladas
      (`dark:${...}`) — Tailwind JIT não detecta.

- [ ] **RA-3 — PricingToggle hrefs dev** (commit `d32c8c7`). Em `/precos`
      ou `/gateway` clicar aba "Sou dev" → 4 cards (Starter / Basic / Pro /
      Business). Inspecionar `href` dos botões → todos devem ser
      `/cadastro/dev?plano=XXX` (com `?`, não `&`). Clicar Starter →
      URL final `/cadastro/dev?plano=starter` (não 404).

- [ ] **RA-4 — Login com senha implementado** (commit `61d7d03`).
      `/login` tem toggle Magic Link ↔ Senha. Ver Bloco 3-SENHA completo.

### Da Rodada 2 (logo + cadastro dev + gateway alias)

- [ ] **N+1** — logo "Nota" visível em DARK MODE. ⚠️ **SUPERSEDIDO** —
      este item teve fix inicial (`5f95d6d`) e fix real (`0c77c73`). Validar
      via **RA-2 acima** que cobre a versão correta (wrappers `<span class="contents">`,
      não `<Image>` separadas).
- [ ] **N+5** — CNPJ exemplo do prompt `99.999.999/0001-91` retorna 404
      na BrasilAPI (testado 2026-06-03). Se algum dia retornar 200, atualizar
      esse prompt.
- [ ] **Novo R2-Verify** — `GET /brand/notafacil-gateway.svg` retorna **200**
      (era 404). Mesmo SVG do `notafacil-api.svg`. `-dark.svg` idem.
- [ ] **Cadastro Dev novo** — Bloco 2-Dev acima.

### Da Rodada 1

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
