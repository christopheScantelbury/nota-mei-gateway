# Prompt QA — Validação Completa por Perfil (2026-06-17)

> Cole o bloco entre `<<<` e `>>>` em uma nova sessão Claude Code.
>
> Cobre **TUDO** que foi implementado na sessão maratona 2026-06-17:
> Admin v2 (#230-234), Planos sync (#235-238), Landing CMS (#239-244),
> Observabilidade (#245), Feedback (#246-247), 4 bugs do QA anterior
> (commit `36e8e43`), sidebar fixes (`949d36a`), Avulso preço por nota +
> landing SSR (`7d8986e`).
>
> Estrutura: 5 perfis testados em sequência (Super Admin → Admin não-super
> → MEI Premium → ME Business → Trial). Tempo estimado: 2h-2h30.

---

<<<

# Missão

QA completo do **Nota MEI Gateway** (ScantelburyDevs) cobrindo 5 perfis
de usuário em produção via Chrome MCP. Gera relatório final em
`docs/qa-validacao-completa-report-{YYYY-MM-DD}.md`.

# Setup obrigatório

1. `mcp__Claude_in_Chrome__list_connected_browsers` → pedir o Chris escolher
2. `mcp__Claude_in_Chrome__select_browser` com deviceId
3. `mcp__Claude_in_Chrome__tabs_context_mcp` `createIfEmpty: true`

# Contexto importante

- **Sem usuários reais ainda** (Chris confirmou) — pode mudar preço,
  publicar landing, criar admins SEM precisar reverter.
- **Magic link admin** via `POST /api/dev/magic-link` com Bearer
  `DEV_ADMIN_TOKEN` (`ACESSOS.local.md` seção 9-ter).
- **Limpar sessão entre perfis** via DevTools JS:
  ```js
  document.cookie.split(";").forEach(c => {
    const eq = c.indexOf("="), name = (eq > -1 ? c.substr(0, eq) : c).trim()
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.emitirnotafacil.com.br`
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  })
  localStorage.clear(); sessionStorage.clear()
  ```

# Credenciais

| Perfil | Email | Role no banco |
|---|---|---|
| Super admin | `christophescantelbury@gmail.com` | super_admin (seed) + MEI Premium |
| ME/EPP | `contato@scantelburydevs.com.br` | ME Business |
| Outros perfis serão criados durante o QA |

---

# 🔵 PERFIL 1 — Super Admin (Christophe / MEI Premium)

**Login:** magic link de `christophescantelbury@gmail.com` → cai em /home.

## 1.1 · Sidebar — link Admin visível + label "Emissão via WhatsApp"

**Reproduzir:**
- Acessar `/home`
- Observar sidebar esquerda (lg+) ou drawer mobile

**Esperado:**
- Items dashboard: Notas Fiscais, Clientes, Modelos de Nota, Notas Recorrentes,
  **💬 Emissão via WhatsApp** (renomeado de "Links de Cobrança"),
  Plano e Pagamento, Minha empresa
- Separador horizontal
- 🛡️ **Painel Admin** em cor cyan/upgrade abaixo (commit `949d36a`)

**Falha possível:** link Admin sumido → `isAdmin` ainda usando legado
`app_metadata.role` em vez de `getAdminContext`.

## 1.2 · Botão Feedback 💬 (flutuante bottom-right)

- Esperado: botão circular cyan 💬 fixed bottom-right em todas as páginas
  do dashboard (#247)
- Click → modal "Enviar feedback"
- Selecionar tipo "Sugestão" → mensagem "QA test feedback" → "Enviar"
- Esperado: toast "Obrigado! Recebemos seu feedback."
- SQL Supabase:
  ```sql
  SELECT id, tipo, mensagem, url, screenshot_url, status, created_at
  FROM customer_feedback
  WHERE user_id = '5a7353a4-add4-48a0-9843-718eb4f72680'
  ORDER BY created_at DESC LIMIT 3;
  ```
  - Última row: tipo='sugestao', mensagem='QA test feedback', status='open'

## 1.3 · /admin/permissoes — refetch tabela (BUG-001 fix)

- Acessar `/admin/permissoes`
- Esperado: tabela mostra `christophescantelbury@gmail.com` super_admin.
  Outras rows existentes (contato@scantelburydevs.com.br pode ou não estar).

**Criar admin não-super pra testar:**
- Click "+ Adicionar admin"
- Email: `contato@scantelburydevs.com.br` (existente no banco)
- Role: `admin`
- Notas: "QA validacao completa"
- Submit
- **Esperado (fix BUG-001):** tabela atualiza imediatamente com nova row,
  SEM F5 necessário. Status "sem grants" em vermelho na coluna.

**Editar grants:**
- Click "Editar" na row de contato@
- Modal abre com matriz Página × Read × Write
- Marcar: `/admin/usuarios` Ler ON, `/admin/notas` Ler ON + Escrever ON
- Salvar
- Esperado: toast "Permissões salvas". Tags `usuarios` + `notas ✏️` aparecem na coluna.

**Verificar audit_log:**
```sql
SELECT action, target_id, after_data, created_at
FROM admin_audit_log
WHERE user_id = '5a7353a4-add4-48a0-9843-718eb4f72680'
ORDER BY created_at DESC LIMIT 5;
```
- Deve mostrar entries: user_promote (criação) + user_grant_change (edit)

## 1.4 · /admin/planos — Avulso MEI preço por nota (commit `7d8986e`)

- Acessar `/admin/planos`
- Esperado: lista mostra 10 planos ativos. Banner "5 inativos ocultos" +
  toggle (fix do bônus QA anterior)
- Click "Editar" no **Avulso MEI**
- **NOVO campo esperado** (fix `7d8986e`): "Preço por nota (R$) — avulso
  ou excedente" preenchido com 5.99
- Mudar pra 6,99
- Salvar (sem confirm modal — preço mensal não mudou)
- Esperado: toast "Plano salvo". Coluna preço da listagem mostra "R$ 6,99/nota"
- SQL planos_history:
  ```sql
  SELECT campo, valor_antigo, valor_novo, stripe_action
  FROM planos_history
  WHERE plano_id = (SELECT id FROM planos WHERE nome='Avulso MEI')
  ORDER BY created_at DESC LIMIT 5;
  ```
  - Entry de `preco_excedente_brl` com `valor_antigo=5.99` → `valor_novo=6.99`
  - stripe_action = NULL (não criou Stripe price)

## 1.5 · /admin/planos — Mudança de preço mensal (Stripe sync)

- Editar MEI Mensal (atual R$ 19,90/mês)
- Mudar **preço mensal** pra R$ 22,90
- Salvar — esperado confirm modal: "Mudar o preço mensal cria um novo
  Stripe price + migra assinaturas..."
- Confirmar
- SQL planos_history:
  - Entry `preco_mensal_brl` com `stripe_action=price_created` + `stripe_ref=price_...`
- Stripe Dashboard → "NotaFácil MEI — Mensal" → 2 prices (novo R$22,90 ativo + antigo R$19,90 archived)

## 1.6 · Landing /mei lê do banco (commit `7d8986e`)

- Abrir nova aba `https://www.emitirnotafacil.com.br/mei#precos`
- Esperado:
  - **Avulso**: card mostra "R$ 6,99 /nota" (novo valor editado em 1.4)
  - **MEI Mensal**: card mostra "R$ 22,90 /mês" (novo valor editado em 1.5)
  - Demais planos com valores atuais do banco
- Se cache do Next.js segurar versões antigas, pode demorar até ~30s. F5
  + Ctrl+Shift+R forçam reload.

**Falha possível:** valores antigos persistem (15/19,90/39,90) → SSR não
está buscando do banco; verificar import em `app/(landing)/mei/page.tsx`.

## 1.7 · /admin/landing — builder + preview + publish + rollback

- Acessar `/admin/landing`
- Esperado: grid 6 cards (`home`, `mei`, `me`, `gateway`, `comparativo`, `precos`)
- Click "gateway"
- **Adicionar section** "Hero":
  ```json
  {
    "title": "QA Validação Completa",
    "subtitle": "Hero criado durante QA 2026-06-17",
    "cta_label": "Testar",
    "cta_href": "/sandbox"
  }
  ```
- Salvar rascunho → toast "Rascunho salvo"
- Click "👁 Preview"
- **Esperado (fix BUG-003 commit `36e8e43`):** abre nova aba `/admin/preview/gateway`
  com banner amarelo no topo: "🚧 Modo preview · rascunho não publicado
  de /gateway"
- Hero renderiza JSON do draft
- Voltar pro builder
- Click "✨ Publicar" → confirm → toast "Publicado! ✨"
- Card "gateway" em `/admin/landing` agora mostra "● publicada"
- Click "↶ Rollback" → confirm → toast "Rollback feito"

## 1.8 · Upload asset landing (fix BUG-004 commit `36e8e43`)

DevTools console na aba `/admin/landing`:

```js
// Caso 1: body vazio → deve retornar 400 com JSON (NÃO 500 vazio)
const r1 = await fetch('/admin/api/landing/assets', { method: 'POST' })
console.log('caso1', r1.status, await r1.json())

// Caso 2: FormData sem 'file'
const fd = new FormData(); fd.set('pageSlug', 'gateway')
const r2 = await fetch('/admin/api/landing/assets', { method: 'POST', body: fd })
console.log('caso2', r2.status, await r2.json())
```

**Esperado:**
- caso1: status `400`, body `{ error: 'INVALID_BODY', message: 'Body deve ser multipart/form-data com campo "file"' }`
- caso2: status `400`, body `{ error: 'NO_FILE', message: 'Campo "file" obrigatório no FormData' }`

## 1.9 · Error tracking in-house (#245)

- DevTools console → propositalmente lance um error:
  ```js
  throw new Error('QA_TEST_ERROR_2026_06_17')
  ```
- Aguardar ~5s
- SQL:
  ```sql
  SELECT fingerprint, message, source, occurrence_count, last_seen_at
  FROM error_log
  WHERE message LIKE '%QA_TEST_ERROR%'
  ORDER BY last_seen_at DESC LIMIT 3;
  ```
- Esperado: 1 row, source='web-client', occurrence_count=1
- Lance o MESMO error 2x mais → mesma row, `occurrence_count` vira 3
  (dedupe via fingerprint funciona)

## 1.10 · Acesso direto às telas admin restritas

- Como super_admin, acessar:
  - `/admin/usuarios` → abre (lista usuários cadastrados)
  - `/admin/notas` → abre (lista notas com filtros)
- Verifica console: zero erros vermelhos

---

# 🟣 PERFIL 2 — Admin não-super (contato@scantelburydevs.com.br)

Admin criado no 1.3, com grants pra `/admin/usuarios` (R) + `/admin/notas` (R+W).

**Login:** logout do Christophe + limpar cookies. Magic link admin para
`contato@scantelburydevs.com.br`. Cai em /home.

## 2.1 · Sidebar — link Admin aparece (fix `949d36a`)

- Esperado: dashboard normal + link 🛡️ Painel Admin (porque é admin ativo)

## 2.2 · /admin acessível, sidebar admin restrita

- Click no link Admin → abre `/admin` (dashboard root sempre liberado pra admin ativo)
- Sidebar admin mostra APENAS:
  - Visão Geral
  - Usuários
  - Notas Fiscais
  - (NÃO mostra: Planos, Landing, Permissões)
- Badge sidebar mostra "Admin" (não "Super admin")

**Fix BUG-002 validado** (commit `36e8e43`): admin recém-criado consegue
acessar /admin imediatamente (cache distribuído resolvido).

## 2.3 · Bloqueio direto via URL

- Tentar `/admin/planos` direto na URL → redirect pra `/home`
- Tentar `/admin/landing` direto na URL → redirect pra `/home`
- Tentar `/admin/permissoes` direto na URL → redirect pra `/home` (super_admin only)

## 2.4 · Pode usar grants — /admin/notas (R+W)

- Acessar `/admin/notas` → abre
- Esperado: filtros funcionam, click em nota mostra detalhe
- (Não testar ações destrutivas — apenas confirmar render OK)

## 2.5 · Dashboard normal continua funcional

- Voltar pra `/home` (sair de /admin)
- Sidebar agora mostra menus do tipo da empresa
- Esperado: ME/EPP (Notas, Clientes, Modelos, Recorrências, **Emissão via
  WhatsApp**, **Chaves de API**, **Notificações automáticas** — features ME),
  Plano e Pagamento, Minha empresa, + link 🛡️ Painel Admin

---

# 🟢 PERFIL 3 — MEI Premium (Alef / Christophe)

Voltar pra `christophescantelbury@gmail.com` (logout + limpar + magic link).

## 3.1 · Sidebar MEI

- Sidebar mostra:
  - Notas Fiscais
  - Clientes
  - Modelos de Nota
  - Notas Recorrentes
  - 💬 **Emissão via WhatsApp** (renomeado)
  - Plano e Pagamento
  - Minha empresa
  - 🛡️ Painel Admin (porque é super_admin)
- NÃO mostra: Chaves de API, Notificações automáticas (features ME/EPP only)

## 3.2 · /home mostra Plano "MEI Premium"

- "Bom dia, Alef" + "Plano MEI Premium" + uso 0/100
- (Cota pode ter rejeitadas históricas — observação não-bug)

## 3.3 · /billing — 4 cards MEI

- Acessar `/billing`
- Esperado: 4 cards (Avulso, Mensal, Plus, **Premium [Atual]**)
- Avulso mostra "R$ 6,99/nota" (refletindo edição do 1.4)
- Mensal mostra "R$ 22,90/mês" (refletindo edição do 1.5)
- Premium destacado como Atual

## 3.4 · Emissão de nota R$ 1 (smoke test do core)

- `/notas/nova`
- Tomador: CNPJ `00000000000191` (Banco do Brasil)
- Serviço: NBS `01010110` Desenvolvimento de software, valor R$ 1,00
- Discriminação: "QA validacao 2026-06-17"
- Submit
- Esperado: redirect `/notas/{id}` com status PROCESSANDO ou AUTORIZADA
- Aguardar até 30s. Se AUTORIZADA → cancelar pra limpar
- ⚠️ NUNCA mais que R$1

---

# 🟠 PERFIL 4 — ME Business (Scantelbury)

Logout + limpar cookies. Magic link de `contato@scantelburydevs.com.br`
→ /home como ME (não como admin agora — vamos focar no perfil dashboard).

Pra desfazer o role admin temporariamente, ou simplesmente ignorar o link
Admin no sidebar e validar o dashboard ME.

## 4.1 · Logo NotaFácil Empresa + sidebar ME

- Esperado: Logo "NotaFácil Empresa" (laranja) no topo
- Sidebar mostra: Notas Fiscais, Clientes, Modelos de Nota, Notas Recorrentes,
  💬 **Emissão via WhatsApp**, **Chaves de API**, **Notificações automáticas**,
  Plano e Pagamento, Minha empresa (+ Painel Admin)

## 4.2 · /api-keys + /webhooks (features ME/EPP only)

- `/api-keys` → "Plano ME Business · 1/10 chaves", 1 sk_live_ ativo, tab Sandbox
- `/webhooks` → endpoint config + toggle `nfse.autorizada`

## 4.3 · /billing — 3 cards ME

- Acessar `/billing`
- Esperado: 3 cards (Start R$ 59,99/10, Pro R$ 149,90/50, **Business R$ 299,90/300 [Atual]**)

## 4.4 · Botão Feedback + envio

- Click no botão 💬
- Tipo "Bug" + mensagem "Teste bug ME" + capturar screenshot (se possível)
- Enviar → toast
- SQL:
  ```sql
  SELECT tipo, mensagem, empresa_id, screenshot_url FROM customer_feedback
  WHERE user_id = '4b41813c-3493-49c4-83f0-770aca31b8a6'
  ORDER BY created_at DESC LIMIT 1;
  ```
- Esperado: row com `empresa_id` = `293aa44e-...` (ID da Scantelbury), `screenshot_url` não-null se enviou imagem

---

# 🔴 PERFIL 5 — Trial (novo cadastro)

Logout + limpar cookies.

## 5.1 · Cadastro MEI novo

- Abrir `/cadastro?produto=mei`
- CNPJ MEI válido qualquer (pode usar gerador online de CNPJ válido tipo
  https://www.4devs.com.br/gerador_de_cnpj — ⚠️ confirmar que é MEI real
  consultando no portal MEI gov.br). Se não tem MEI disponível, **PULAR
  este perfil** e marcar como "blocked: sem CNPJ MEI de teste".
- Email único tipo `teste-trial-{timestamp}@example.com`
- Razão social
- Município
- Pular cert A1 ("Configurar depois")
- Concluir cadastro

## 5.2 · Trial vê cards "locked"

- `/home` → "Plano Trial MEI" (ou similar) + uso 0/5
- Sidebar mostra todos os menus com badge "Starter" (visualmente locked)

## 5.3 · /clientes paywall

- Click no menu "Clientes" → esperado: tela paywall "Aba de Clientes disponível
  a partir do Starter" com CTA "Ver planos e fazer upgrade"

## 5.4 · /templates paywall

- Click no menu "Modelos de Nota" → paywall "Templates disponíveis no plano Pro"
- ⚠️ Confirmar que NÃO há regressão do BUG do MEI Premium (template paywall
  só pra trial, não pra premium)

## 5.5 · Fluxo upgrade

- `/billing` → 4 cards MEI
- Click "Assinar agora" no MEI Plus
- Modal "Confirmar assinatura" abre
- Confirmar → redireciona pra `checkout.stripe.com`
- ⚠️ **NÃO completar pagamento** (cartão 4242 é teste mas processa via webhook)
- Fechar tab Stripe

---

# Magic Link real no email (validação cross-perfil)

- Em janela anônima, abrir `/login` → digitar `christophescantelbury@gmail.com`
- Aguardar email real chegar (até 2 min)
- Validar visual: navy background, cyan accent, logo + Outfit + DM Mono no código
- Click "Entrar no NotaFácil" → cai logado em `/home` (NÃO em `/login?error=`)

# Formato do relatório

```markdown
# QA Validação Completa — {date}

## Resumo
- Perfis testados: 5 de 5 (super_admin, admin, MEI Premium, ME Business, Trial)
- Cenários: X de Y
- Pass: X · Fail: X · Blocked: X

## Bugs (formato padrão)
### BUG-XXX — título
- Severidade: 🔴/🟠/🟡/🟢
- Perfil: super_admin / admin / MEI / ME / Trial
- Cenário: 1.X / 2.X / etc
- Reproduzir, Esperado, Atual, Screenshot, Network, Console

## Side-effects observados
- Planos editados (valores finais)
- Sections de landing publicadas
- Admins criados/grants concedidos
- error_log entries

## Estado final do banco (cleanup awareness)
- customer_feedback: X rows criadas
- planos: quais valores finais ficaram
- admin_users: quais admins ativos
- landing_pages: quais foram publicadas
```

# Segurança

Tudo OK pra mexer (Chris liberou — sem usuários reais):
- ✅ Mudar preços, descrições, status
- ✅ Publicar/rollback landing
- ✅ Criar/desativar admins
- ✅ Cadastrar conta trial nova com email tipo `teste-…@example.com`

Proibido:
- ❌ Emitir nota > R$1
- ❌ Cobrar cartão real no Stripe
- ❌ Commitar credentials
- ❌ Deletar dados das 2 contas core (Christophe / Scantelbury)

>>>
