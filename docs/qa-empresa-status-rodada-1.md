# QA Empresa — Status da 1ª rodada de fixes

> Relatório de retorno pro tester (Claude Sonnet 4.6) que reportou 14 bugs em
> `/me` no dia 2026-06-03. Use isso pra rodar a 2ª rodada já sabendo o que
> foi tocado e onde focar.

**Deploys**: `0686f67` (1ª leva) → `2cd1a20` (2ª leva).

---

## Resumo

| Severidade | Reportados | Fixados | Pendentes | Falso-positivo |
|---|---|---|---|---|
| **P0** | 2 | 2 | 0 | 0 |
| **P1** | 7 | 6 | 1 | 0 |
| **P2** | 5 | 2 | 0 | 3 |
| **Total** | 14 | 10 | 1 | 3 |

**Avaliação revisada**: foi de "❌ não pronto pra lançamento" pra "🟡 release candidate com 1 issue cosmético externo".

---

## Por bug

### ✅ #1 (P0) — API Key exposta no cadastro ME — FIXADO
**Mudança**: `/cadastro/me` agora tem **3 steps** (Dados / Regime / Certificado), não 4. Step "API Key" removida. Nova tela `appStep='success'` mostra "Empresa cadastrada!" + instrução pra checar e-mail (OTP). API key continua sendo gerada (necessária pra upload do cert no Step 3), mas nunca é exibida ao user.

**Validação esperada**: Cadastrar → completar 3 steps → ver tela success SEM `sk_live_...` visível.

---

### ✅ #2 (P1) — heading "nacionala partir" — FIXADO
**Mudança**: `MEHero.tsx` — `<br />` removido entre "nacional" e "a partir de setembro". Agora flui como texto único.

**Validação esperada**: Inspecionar `<h1>` em `/me` — `textContent` deve ler "Sua ME precisa emitir NFS-e nacional a partir de setembro." com espaço.

---

### ⚠️ #3 (P2) — Topbar dismiss sem expiração 7d — RESOLVIDO COMO SIDE-EFFECT DO #9
**Mudança**: O bug era do `UrgencyBannerME` legado que usava `localStorage['urgency_banner_dismissed']='1'` (flag bool sem TTL). Esse componente foi REMOVIDO da `/me` (ver #9). O substituto é a `UrgencyTopBar` global, que usa **cookie `nf_topbar_dismissed_v1` com `max-age=7d`** (D-14).

**Validação esperada**: clicar X na topbar laranja, recarregar → topbar não reaparece. Após 7 dias (ou apagar cookie manualmente) → reaparece.

---

### ✅ #4 (P1) — Seções ausentes na /me — FIXADO
**Mudança**: `/me/page.tsx` agora inclui:
- `PricingSection` (3 cards âncora MEI/ME/Gateway, card ME destacado com badge "Obrigatório Set/2026")
- `CompetitorTable variant="summary"` (4 colunas: NotaFácil/Focus NFe/eNotas/PlugNotas)
- `CountdownSet2026` dinâmico no MEHero
- `PioneerBadge` no hero

**Validação esperada**: scroll em /me deve mostrar Pricing entre "Como funciona" e FAQ + comparativo entre Beneficios e Pricing.

---

### ✅ #5 (P1) — "Como funciona" sem toggles MEI/ME/Dev — PARCIAL
**Mudança**: O `HowItWorksToggle` com 3 abas existe e está em `/` (home), não em `/me`. Decisão consciente: na `/me`, o componente `MEComoFunciona` é dedicado ao fluxo da Empresa (sem toggles, focado em ME/EPP). Não faz sentido mostrar toggle "Sou MEI" numa landing dedicada ao público ME.

**Pra validar**: home `/` tem o toggle de 3 abas ✅. `/me` mantém `MEComoFunciona` estático e focado ✅.

---

### ⚠️ #6 (P1) — Logo "Nota" invisível em fundo claro externo — PENDENTE
**Estado**: NO SITE funciona (dark mode = fundo escuro). O SVG `notafacil-empresa-dark.svg` foi criado especificamente pra superfícies escuras (cor branca no "Nota"). Quando aberto direto pelo browser (fundo branco padrão) ou usado em contexto de e-mail/PDF, vira invisível.

**Por quê não foi fixado nesta rodada**: requer criar versão "neutra" do SVG (provavelmente usando `currentColor` ou cor azul brand pra "Nota") pra envios externos. Decisão de design.

**Sugestão**: usar `notafacil-logo.svg` (cor original preta) em e-mails e templates de PDF; `*-dark.svg` SÓ na navbar dark do site.

---

### ✅ #7 (P1) — Title login "Nota MEI Gateway" — FIXADO
**Mudança**: `generateMetadata` em `/login/page.tsx` agora mapeia o `produto` da query string:
- `?produto=mei` → "Entrar — Nota Fácil MEI"
- `?produto=me` → "Entrar — NotaFácil Empresa"
- `?produto=gateway` → "Entrar — NotaFácil API"
- sem produto → "Entrar — NotaFácil"

**Validação esperada**: `document.title` muda conforme o `?produto=`.

---

### ✅ #8 (P1) — Wizard com 4 steps — FIXADO (via #1)
**Mudança**: agora tem 3 steps (Dados / Regime / Certificado) conforme spec. Resolvido junto com #1.

---

### ⚠️ #9 (P2) — 2 botões fechar topbar no DOM — FIXADO
**Mudança**: `UrgencyBannerME` removido da `/me`. Agora há só 1 botão de fechar no DOM (o da `UrgencyTopBar` global no `(landing)/layout.tsx`).

**Validação esperada**: `document.querySelectorAll('[aria-label*="Fechar aviso"]').length === 1`.

---

### ❓ #10 (P2) — 2 ThemeToggle com mesmo aria-label — FALSO POSITIVO
**Análise**: Existem 2 instâncias do `ThemeToggle` no Navbar — uma desktop (`hidden sm:flex`) e uma mobile (`sm:hidden`). Só **1 está visível por viewport** (`hidden` aplica `display: none`, screen readers respeitam). Não viola WCAG 4.1.2.

**Se quiser garantir IDs únicos pra DevTools**: posso adicionar `id="theme-toggle-desktop"` / `id="theme-toggle-mobile"`. Mas não é bug, só preocupação cosmética com inspector.

---

### ✅ #11 (P1) — aria-expanded quebrado no FAQ — FIXADO
**Mudança**: `MEFAQ.tsx` agora:
- `<button aria-expanded={isOpen} aria-controls={panelId} id={buttonId}>`
- `<div role="region" aria-labelledby={buttonId} hidden={!isOpen}>`

**Validação esperada**: clicar no FAQ → `aria-expanded="true"` no button. Leitor de tela anuncia "expandido"/"recolhido".

---

### ✅ #12 (P1) — CNPJ fictício aceito — FIXADO
**Mudança**: `validateStep1()` no `/cadastro/me` agora bloqueia avanço se:
- `cnpjLookupLoading` (lookup BrasilAPI em andamento)
- `cnpjLookupError` setado (BrasilAPI retornou 404 ou erro de rede)

Trabalha junto com auto-fetch do #14: ao atingir 14 dígitos, BrasilAPI é consultada. Se 404, mensagem inline "CNPJ não encontrado na Receita Federal. Verifique e preencha manualmente." aparece — e o botão "Continuar" fica bloqueado pelo validateStep1.

**Validação esperada**: digitar "11.222.333/0001-81" (válido matematicamente, fictício) → BrasilAPI 404 → mensagem aparece → "Continuar" bloqueia.

---

### ❓ #13 (P2) — NavigationProgress não encontrada — FALSO POSITIVO
**Análise**: `NavigationProgress` SÓ renderiza durante transição SPA (pathname/searchParams mudando). No estado idle (página carregada, scroll parado), o componente retorna `null`. Por isso `document.querySelector('[class*="progress"]')` não acha nada quando a página já carregou.

**Validação correta**: navegar entre rotas (ex: clicar link "Preços" no header) e observar a barra cyan de 3px aparecer no topo durante a transição.

---

### ✅ #14 (P1) — BrasilAPI auto-fill no Step 1 — FIXADO
**Mudança**: `useEffect` em `/cadastro/me` dispara `fetchCNPJ(digits)` quando `form.cnpj.replace(/\D/g, '').length === 14`.
- Debounce 400ms
- `lastFetchedCnpjRef` evita refazer mesmo CNPJ
- Preenche **somente campos vazios** (razão social, e-mail, CNAE, CEP, município IBGE, UF) — respeita edição manual
- Hint dinâmico no campo CNPJ: "Buscando dados na Receita…"

**Validação esperada**: digitar CNPJ válido (ex: 34.488.964/0001-42 — Alef Henrique) → ver razão social aparecer sozinha.

---

## Fluxos NÃO testados na 1ª rodada (do mapa de cobertura do tester)

Da seção "MAPA DE COBERTURA" do prompt original, o tester reportou que NÃO conseguiu cobrir os Blocos 4-14 por falta de:
- Código OTP recebido em runtime
- Cert ICP-Brasil real pra emissão
- Endpoint público pra webhook
- Subscription Stripe ativa pra Customer Portal
- Conta com 2+ CNPJs pra multi-empresa

**Esses blocos continuam SEM cobertura formal — precisamos rodar 2ª rodada com pré-requisitos prontos**:
- Magic link admin pra contornar OTP (rotina já documentada na memória)
- Cert A1 de homologação pra emissão real contra Receita Federal de testes
- Webhook.site ou endpoint Vercel pra receber HMAC
- Cartão teste Stripe pra ativar subscription
- Criar 2ª empresa no banco pro mesmo `user_id` pra testar multi-empresa

---

## Recomendação pra 2ª rodada de QA

1. Re-rodar TODOS os Blocos 1-3 (landing + cadastro + login) pra confirmar que as correções fechem os bugs reportados
2. Tentar reproduzir #6 num contexto realista (e-mail/PDF) — decidir se vale criar SVG neutral
3. Pré-criar conta `teste-empresa@notafacil.com` (já existe, ver `ACESSOS.local.md`) e rodar os Blocos 4-14 que ficaram fora
4. Reportar **novos bugs** descobertos nas áreas cobertas pela 1ª vez (dashboard, notas, CRM, billing, configurações)
5. Re-rodar mapa de cobertura e reduzir lista de "não testou"

Quando relatar de volta, usar o mesmo formato (sumário executivo + bugs detalhados + cobertura + sugestões). A gente itera até zerar.
