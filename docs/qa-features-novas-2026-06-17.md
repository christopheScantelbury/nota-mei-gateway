# Prompt QA — Features Novas (sessão maratona 2026-06-17)

> Cole o bloco entre `<<<` e `>>>` em uma nova sessão Claude Code.
> Foco: testar as 21 features novas via Chrome MCP. Smoke das telas
> antigas (sidebar, /home, /notas, /billing) está em `qa-agent-prompt.md`.

---

<<<

# Missão

Você é QA do projeto **Nota MEI Gateway** (ScantelburyDevs). Sua missão
é **testar via browser** as 21 features novas implementadas em
2026-06-17 (commits `900dcc1` até `7ea16e4`) usando Chrome MCP.

Gera relatório `docs/qa-report-features-novas-{YYYY-MM-DD}.md` com bugs
encontrados no formato definido no fim.

# Setup inicial (obrigatório)

1. **Listar browsers conectados:** `mcp__Claude_in_Chrome__list_connected_browsers`
2. Pedir ao usuário escolher (não escolha por conta própria)
3. `mcp__Claude_in_Chrome__select_browser` com deviceId
4. `mcp__Claude_in_Chrome__tabs_context_mcp` com `createIfEmpty: true`

# Credenciais

- **Super admin Christophe:** `christophescantelbury@gmail.com`
  (seedado em migration `20260622000001_admin_v2`)
- **ME Business Scantelbury:** `contato@scantelburydevs.com.br`
- Magic link admin: `POST /api/dev/magic-link` com Bearer
  `DEV_ADMIN_TOKEN` (do `ACESSOS.local.md` seção 9-ter). Action_link
  retornado já está no formato `/auth/callback?token_hash=...&type=
  magiclink&next=/home` (fix do callback 2026-06-08).

**Limpeza de sessão entre logins:** via DevTools JS, limpar cookies +
localStorage do domínio. Pattern usado anteriormente:

```js
document.cookie.split(";").forEach(c => {
  const eq = c.indexOf("="), name = (eq > -1 ? c.substr(0, eq) : c).trim()
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.emitirnotafacil.com.br`
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
})
localStorage.clear(); sessionStorage.clear()
```

# Cenários — Fase 1: Admin v2 permissões per-tela (#230-234)

## CT-A1 · Login super admin + smoke admin

- Magic link `christophescantelbury@gmail.com` → cai em /home
- Acessar https://www.emitirnotafacil.com.br/admin
- Esperado: dashboard admin com sidebar mostrando: Visão Geral,
  Usuários, Notas Fiscais, **Planos** (novo), **Landing** (novo),
  **Permissões** (novo)
- Badge "Super admin" abaixo do logo do sidebar
- Validar console: zero erros vermelhos

## CT-A2 · /admin/permissoes — listar admins

- Acessar `/admin/permissoes`
- Esperado: tabela com 1 row (Christophe, role super_admin, status ativo)
- Coluna "Páginas liberadas" para super_admin diz "acesso total"

## CT-A3 · Criar novo admin

- Botão "+ Adicionar admin"
- Email: `contato@scantelburydevs.com.br`
- Role: `admin` (não super)
- Submit
- Esperado: nova row aparece. Status ativo. "sem grants" em vermelho.

## CT-A4 · Editar grants do novo admin

- Clica "Editar" na row do contato@
- Modal abre com matriz: 4 páginas × can_read × can_write
- Marca: `/admin/usuarios` can_read ON; `/admin/notas` can_read+can_write ON
- Salva
- Esperado: toast "Permissões salvas". Tags aparecem na coluna (com ✏️ pra
  who tem write).

## CT-A5 · Testar grant aplicado (logar como admin não-super)

- Logout/limpar cookies
- Magic link `contato@scantelburydevs.com.br`
- Acessar `/admin` → deve abrir (dashboard root sempre liberado)
- Sidebar deve mostrar APENAS: Visão Geral, Usuários, Notas Fiscais
  (NÃO mostrar Planos, Landing, Permissões)
- Tentar `/admin/planos` direto na URL → redirect pra /home
- Tentar `/admin/permissoes` direto na URL → redirect pra /home

## CT-A6 · Voltar como super admin + desativar admin

- Limpar + magic link christophe
- /admin/permissoes → clica "Desativar" na row do contato@
- Esperado: row marca como "inativo"
- Logar como contato@ → /admin redireciona pra /home (não é mais admin)

# Cenários — Fase 2: Planos sync Stripe (#235-238)

## CT-P1 · Lista de planos

- Como super_admin, /admin/planos
- Esperado: 10 planos listados (Trial MEI, Avulso MEI, MEI Mensal, MEI
  Plus ★, MEI Premium, Trial ME, ME Start, ME Pro ★, ME Business, Trial EPP)
- Badge ★ destaque em MEI Plus + ME Pro
- Coluna preço: formato `R$ X,XX/mês` ou `R$ X,XX/nota` ou "grátis"
- Coluna status: ● ativo (verde) em todos

## CT-P2 · Editar descrição (sem mudar preço) — NÃO cria Stripe price

- Editar "MEI Plus"
- Mudar descrição_curta de "Emissão de até 15 NFS-e por mês" pra
  "Emissão de até 15 NFS-e por mês — plano popular"
- Salvar (preço não mudou → SEM confirm modal)
- Esperado: toast "Plano salvo". Stripe atualizou só product description.
- SQL via Supabase Dashboard:
  ```sql
  SELECT campo, valor_antigo, valor_novo, stripe_action
  FROM planos_history WHERE plano_id = (SELECT id FROM planos WHERE nome='MEI Plus')
  ORDER BY created_at DESC LIMIT 5
  ```
  - Deve mostrar entry de `descricao_curta` com `stripe_action=product_updated`

## CT-P3 · Editar preço — CRIA novo Stripe price + migra subs

**✅ LIBERADO pelo Chris 2026-06-17:** ainda não há usuários reais
assinantes. Pode mudar o preço à vontade — não precisa reverter ao final
nem se preocupar com cobrança incorreta. Salva o último valor que ficar
bonito pra você.

- Editar "Avulso MEI" (price atual R$5,99/nota)
- Mudar pra R$6,99 (ou qualquer outro)
- Salvar — esperado confirm modal: "Mudar o preço cria um novo Stripe
  price + migra todas as assinaturas ativas. Confirmar?"
- Confirmar
- SQL planos_history → entry com `stripe_action=price_created` +
  novo `stripe_ref` (sk_live_price_...).
- Stripe Dashboard → Products → "NotaFácil MEI — Avulso" → 2 prices
  (1 novo ativo + 1 antigo arquivado)
- Resultado deve ser: migrated=0 (sem subs ativas), errors=null. Pode
  validar mudando 2-3 planos em sequência pra exercitar bem o fluxo.

## CT-P4 · Toggle ativo/inativo

- Editar "Trial EPP" (que está sem stripe_price_id por design)
- Mudar `ativo` de true → false
- Salvar (sem confirm de preço)
- Esperado: row mostra "○ inativo"
- Reverter ativo=true após validar

# Cenários — Fase 3: Landing CMS (#239-244)

## CT-L1 · Lista de páginas CMS

- Como super_admin, /admin/landing
- Esperado: grid com 6 cards (home, mei, me, gateway, comparativo, precos)
- Cada card: status "○ rascunho" (nada publicado ainda)

## CT-L2 · Builder de página + criar primeira section

- Click em card "mei" → /admin/landing/mei
- Header: "/mei" + botões (Preview, Salvar*, Publicar)
- Sidebar esquerda: "Sections" vazia
- Click "+ Adicionar section" → escolher "Hero (título + CTA)"
- Sidebar atualiza com section #1 hero
- Editor central abre com JSON `{}`
- Editar JSON:
  ```json
  {
    "title": "Nota Fácil MEI",
    "subtitle": "Emissão NFS-e em 3 cliques",
    "cta_label": "Começar grátis",
    "cta_href": "/cadastro?produto=mei"
  }
  ```
- Indicador "*" no botão Salvar (dirty)
- Click Salvar → toast "Rascunho salvo"

## CT-L3 · Preview do draft

- Click "👁 Preview" → abre nova aba `/mei?preview=1`
- Esperado: Navbar + banner amarelo "Modo preview — você está vendo
  o rascunho não publicado de /mei" + hero renderizada
- Fechar tab

## CT-L4 · Publicar

- Voltar pro builder /admin/landing/mei
- Click "✨ Publicar" → confirm "Publicar /mei? Isso copia o draft pra
  versão pública."
- Confirmar
- Esperado: toast "Publicado! ✨". Em /admin/landing card "mei" marca
  ● publicada.
- Abrir `/mei` (sem preview) → hero renderizada da live_data

## CT-L5 · Adicionar mais sections + reorder

- Adicionar section "FAQ" com:
  ```json
  {
    "title": "Perguntas frequentes",
    "items": [
      { "q": "Preciso de cert digital?", "a": "Sim, A1 do MEI." },
      { "q": "Funciona offline?", "a": "Não, precisa internet." }
    ]
  }
  ```
- Adicionar section "CTA final" com title e cta_label/href
- Sidebar mostra 3 sections (1 hero, 2 faq, 3 cta)
- Click ↑ no FAQ pra mover pra posição 1
- Toggle visible OFF no CTA (cinza + line-through)
- Salvar + Publicar

## CT-L6 · Rollback

- /admin/landing/mei (com 3 sections publicadas)
- Click "↶ Rollback" → confirm
- Esperado: live_data volta pra versão anterior (só hero estava live)
- Recarregar /mei → mostra só o hero (CTA + FAQ sumiram da live)

## CT-L7 · Upload de imagem

- Voltar pro builder
- Adicionar section "custom_html" com JSON apontando pra placeholder
- (Pra MVP, upload é via API. Validar com curl:)
  ```bash
  curl -X POST https://www.emitirnotafacil.com.br/admin/api/landing/assets \
    -H "Cookie: <cookie da sessão atual>" \
    -F "file=@/path/to/test.png" \
    -F "pageSlug=mei" \
    -F "altText=Teste"
  ```
- Esperado: { ok: true, asset: { id, public_url } }
- public_url deve ser `https://pzjvgtwnstfyangfwdom.supabase.co/storage/v1/object/public/landing-assets/mei/<ts>-<rand>.png`
- GET no public_url retorna a imagem

# Cenários — Hard Launch (#222-229)

## CT-H1 · Magic link real no email (#222)

- Logout
- /login → digitar `christophescantelbury@gmail.com` → enviar
- Aguardar email NotaFácil chegar (1-2 min)
- Validar visual: navy background, cyan accent, código OTP grande +
  botão "Entrar no NotaFácil"
- Click no botão → cai logado em /home (não em /login?error=)
- Se cair em error, BUG P0 — reabrir issue #222

## CT-H2 · Webhook downgrade ao cancelar (#225)

- Logar como user com plano pago
- Stripe Dashboard → Subscriptions → cancelar imediatamente
- Aguardar ~30s
- SQL:
  ```sql
  SELECT planos.nome, em.stripe_subscription_status, em.plano_id
  FROM emissoes_mensais em JOIN planos ON planos.id = em.plano_id
  WHERE em.empresa_id = '<X>' AND em.competencia = '2026-06'
  ```
  - `stripe_subscription_status` = canceled
  - `plano_id` = Trial do tipo (MEI Trial OU Trial ME)
  - `planos.nome` mostra "Trial …"

## CT-H3 · DANFSE fallback PDF próprio (#224)

- Logar como Christophe (tem notas autorizadas)
- /notas → click na nota #122 ou outra AUTORIZADA
- Click "Baixar PDF" → abre PDF no browser
- Esperado: PDF válido com header NotaFácil + dados da nota
  (não erro 502, não redirect pra Receita)

# Formato do relatório

```markdown
# QA Report Features Novas — {date}

## Resumo
- Cenários executados: X de 19 (A1-A6, P1-P4, L1-L7, H1-H3)
- Pass: X · Fail: X · Blocked: X
- Severidades: Bloqueador X · Crítico X · Médio X · Cosmético X

## Bugs

### BUG-001 — {título}
- Severidade: 🔴 Bloqueador
- Tela: /admin/permissoes
- Cenário: CT-A4
- Reproduzir:
  1. …
- Esperado: …
- Atual: …
- Screenshot: caminho
- Console errors: …
- Network 4xx/5xx: …

## Testes aprovados
- ✅ CT-A1 …

## Pendências operacionais não testáveis via browser
- ⏳ #226 load test k6 (requer execução com k6 instalado)
- ⏳ #227 alertas Grafana (criar no Dashboard)
- ⏳ #228 mobile QA real (iPhone físico ou DevTools 375x667)
- ⏳ #238 webhooks Stripe externos (registrar no Dashboard)
```

# Segurança

- NUNCA emitir nota > R$1
- NUNCA deletar dados de outros usuários
- LIMPAR cookies entre login MEI ↔ ME ↔ admin
- NUNCA commitar credentials
- NÃO confirmar pagamento real no Stripe Checkout (cartão 4242 é teste)

**OK pra mexer livre:**
- ✅ Mudar preços de planos (Chris confirmou 2026-06-17 — sem usuários reais)
- ✅ Editar/publicar/rollback landing pages
- ✅ Criar/desativar admins de teste

# Como começar

1. Setup Chrome MCP (acima)
2. Rodar CT-A1 → A6 (Admin v2)
3. CT-P1 → P4 (Planos) — pode mudar preços livres (Chris liberou)
4. CT-L1 → L7 (Landing) — pode publicar tudo, rollback no fim
5. CT-H1, H2, H3 (Hard launch)
6. Gerar relatório final

>>>

---

## Como usar

Cola o bloco entre `<<<` e `>>>` numa nova sessão Claude Code.

## Pré-requisitos

- Chrome MCP extension instalada e conectada
- Acesso ao `ACESSOS.local.md`
- Conta `christophescantelbury@gmail.com` cadastrada e ATIVA como super_admin
- API key Stripe LIVE configurada
- Migrations `20260622000001_admin_v2`, `_planos_admin`, `_landing_cms` aplicadas em prod
