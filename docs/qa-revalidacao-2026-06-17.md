# Prompt QA — Re-validação 4 bugs corrigidos (2026-06-17)

> Cole o bloco entre `<<<` e `>>>` em uma nova sessão Claude Code.
> Foco: re-validar os 4 bugs que foram corrigidos no commit `36e8e43` +
> rodar CT-P3 que foi skipado por segurança (Chris liberou — sem usuários
> reais ainda).

---

<<<

# Missão

Você é QA do **Nota MEI Gateway** (ScantelburyDevs). Sessão anterior
encontrou 4 bugs (commit `36e8e43`) e fez 1 skip por segurança
(CT-P3). Esta rodada **só re-valida os fixes** + executa CT-P3.

Relatório final em `docs/qa-report-revalidacao-{YYYY-MM-DD}.md`.

# Setup obrigatório

1. `mcp__Claude_in_Chrome__list_connected_browsers` → pedir Chris escolher
2. `mcp__Claude_in_Chrome__select_browser` com deviceId
3. `mcp__Claude_in_Chrome__tabs_context_mcp` createIfEmpty: true

# Contexto importante

- **Sem usuários reais ainda** (Chris confirmou 2026-06-17) — pode mudar
  preço de plano, criar/desativar admins, publicar landing à vontade,
  SEM precisar reverter.
- Magic link admin via `POST /api/dev/magic-link` com Bearer
  `DEV_ADMIN_TOKEN` (ACESSOS.local.md seção 9-ter).
- Limpar cookies entre login MEI ↔ admin:
  ```js
  document.cookie.split(";").forEach(c => {
    const eq = c.indexOf("="), name = (eq > -1 ? c.substr(0, eq) : c).trim()
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.emitirnotafacil.com.br`
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  })
  localStorage.clear(); sessionStorage.clear()
  ```

# Cenários de re-validação

## RV-1 · BUG-001 — Tabela /admin/permissoes refetch após criar admin

**Bug original:** após "+ Adicionar admin" a tabela continuava com a lista
antiga; só atualizava com F5.

**Fix esperado** (`commit 36e8e43`):
- POST `/admin/api/permissoes` agora dispara `refetchAdmins()` no client
- Novo endpoint `GET /admin/api/permissoes` retorna lista fresca

**Reprodução:**
1. Magic link `christophescantelbury@gmail.com` → /home
2. Acessar `/admin/permissoes` (lista 2 admins: christophe super + contato@ admin)
3. Se contato@ JÁ existe: pular criação, vai direto pro CT-A5 simplificado.
   Se NÃO existe: click "+ Adicionar admin"
4. Email: `contato@scantelburydevs.com.br`, Role: `admin`, Notes: "RV-1"
5. Submit

**Esperado:**
- Toast "Admin criado"
- Tabela **imediatamente** mostra a nova row (sem F5 necessário)
- Network tab: 1× POST + 1× GET `/admin/api/permissoes`

**Falha = bug persiste:** tabela ainda precisa de reload manual.

## RV-2 · BUG-002 — Admin recém-criado acessa /admin

**Bug original:** após promover contato@scantelburydevs.com.br pra admin,
ele logava mas `/admin` redirecionava pra `/home` (cache distribuído
entre Edge middleware e Node runtime).

**Fix esperado** (`commit 36e8e43`):
- TTL do cache reduzido pra 30s
- Cache APENAS hits positivos (não-admin sempre consulta banco)
- Promoção reflete na próxima request (sem TTL de 5min)

**Reprodução:**
1. Continuar logado como Christophe super_admin
2. Acessar `/admin/permissoes`, garantir que `contato@scantelburydevs.com.br`
   está `ativo=true role=admin`. Se inativo, reativar pelo botão.
3. Editar grants pra ele: `Ler Notas Fiscais` + `Ler Usuários` (sem write).
   Salvar.
4. **Logout do Christophe + limpar cookies** (JS acima)
5. `POST /api/dev/magic-link` pra contato@scantelburydevs.com.br
6. Abrir o `action_link` retornado → cai logado
7. Acessar `/admin` direto

**Esperado:**
- `/admin` ABRE (dashboard root sempre liberado pra admin ativo)
- Sidebar mostra: Visão Geral, Usuários, Notas Fiscais (NÃO mostra Planos,
  Landing, Permissões)
- Badge sidebar "Admin" (não Super admin)
- Acessar `/admin/notas` → abre
- Acessar `/admin/planos` direto na URL → redirect pra `/home`
- Acessar `/admin/permissoes` direto na URL → redirect pra `/home`

**Falha = bug persiste:** `/admin` redireciona pra `/home`.

## RV-3 · BUG-003 — Preview de landing renderiza CMS (não a página estática)

**Bug original:** click "👁 Preview" abria `/mei?preview=1` que servia a
página estática `app/(landing)/mei/page.tsx` (precedência sobre catch-all),
sem banner amarelo, sem sections do CMS.

**Fix esperado** (`commit 36e8e43`):
- Builder agora abre `/admin/preview/<slug>` (rota dedicada admin-only)
- Sempre lê `draft_data`, sem conflito com rotas estáticas

**Reprodução:**
1. Logar como Christophe super_admin
2. Acessar `/admin/landing/mei`
3. Se já tem sections de outro QA: pode reusar. Senão criar 1 hero:
   ```json
   {
     "title": "RV-3 hero do CMS",
     "subtitle": "Se você vê isto + banner amarelo, fix passou",
     "cta_label": "OK",
     "cta_href": "/cadastro?produto=mei"
   }
   ```
4. Salvar rascunho (NÃO publicar)
5. Click "👁 Preview"

**Esperado:**
- Abre nova aba em `/admin/preview/mei` (não `/mei?preview=1`)
- Banner amarelo no topo: 🚧 **Modo preview** · rascunho não publicado
  de `/mei` · voltar pro editor
- Hero renderiza o JSON do draft ("RV-3 hero do CMS" + subtitle + botão OK)
- Sem nada da página estática hardcoded (sem "Sua nota fiscal de MEI
  emitida em 30 segundos")

**Falha = bug persiste:** continua mostrando página estática `/mei` ou
não mostra banner amarelo.

## RV-4 · BUG-004 — POST /admin/api/landing/assets sem multipart retorna 400

**Bug original:** request sem FormData → 500 com body vazio (cliente
não sabe o que faltou).

**Fix esperado** (`commit 36e8e43`):
- try/catch ao redor do `request.formData()`
- 400 com `{ error: 'INVALID_BODY', message: 'Body deve ser
  multipart/form-data com campo "file"' }`
- Erro sem `file` no FormData: 400 com `{ error: 'NO_FILE', message:
  'Campo "file" obrigatório no FormData' }`

**Reprodução** (via DevTools console na aba `/admin/landing` logado):

```js
// Caso 1: body vazio
const r1 = await fetch('/admin/api/landing/assets', { method: 'POST' })
console.log('caso1', r1.status, await r1.json())

// Caso 2: FormData sem file
const fd = new FormData(); fd.set('pageSlug', 'mei')
const r2 = await fetch('/admin/api/landing/assets', { method: 'POST', body: fd })
console.log('caso2', r2.status, await r2.json())
```

**Esperado:**
- caso1: status `400`, body `{ error: 'INVALID_BODY', message: ... }`
- caso2: status `400`, body `{ error: 'NO_FILE', message: 'Campo "file" obrigatório no FormData' }`

**Falha = bug persiste:** status 500 ou body vazio.

## RV-5 · Bônus — /admin/planos esconde inativos por padrão

**Observação original:** 5 planos legacy inativos poluíam a lista (Starter
EPP, Starter ME, Basic ME, Business ME, Pro ME).

**Fix esperado** (`commit 36e8e43`):
- Padrão: `showInativos=false` → só planos ativos visíveis
- Banner no topo: "N plano(s) inativo(s) ocultos" + toggle "Mostrar inativos"

**Reprodução:**
1. Logar como Christophe super_admin
2. Acessar `/admin/planos`

**Esperado:**
- Tabela mostra **10 planos** ativos (não 15)
- Banner cinza com "5 plano(s) inativo(s) ocultos" + link "Mostrar inativos"
- Click no link → revela os 5 inativos. Texto muda pra "Esconder inativos"
- Click de novo → esconde

## RV-6 · CT-P3 — Editar preço (agora LIBERADO)

**Cenário antes skipado por segurança.** Chris confirmou: **sem usuários
reais ainda**, pode mudar à vontade. Não precisa reverter.

**Reprodução:**
1. Logar como Christophe super_admin
2. `/admin/planos`
3. Clica "Editar" no **Avulso MEI** (R$ 5,99/nota)
4. Mudar Preço mensal pra **R$ 6,99**
5. Salvar

**Esperado:**
- Confirm modal aparece: "Mudar o preço cria um novo Stripe price + migra
  todas as assinaturas ativas. Confirmar mudança de R$ 5.99 → R$ 6.99?"
- Confirmar → toast "Plano salvo"
- Tabela atualiza pra `R$ 6,99/nota`

**Validação via Supabase Dashboard:**
```sql
SELECT campo, valor_antigo, valor_novo, stripe_action, stripe_ref
FROM planos_history
WHERE plano_id = (SELECT id FROM planos WHERE nome='Avulso MEI')
ORDER BY created_at DESC LIMIT 5;
```
- Deve mostrar entry de `preco_mensal_brl` com `stripe_action=price_created`
  e `stripe_ref=price_...` novo

**Validação via Stripe Dashboard:**
- Products → "NotaFácil MEI — Avulso" → 2 prices listados
- 1 ativo (novo, R$ 6,99) + 1 archived (antigo, R$ 5,99)

**Bonus:** mude pra outros 1-2 planos pra exercitar o fluxo. Pode também
testar mudança de descrição_curta isoladamente (sem mudar preço) — não
deve disparar confirm modal e só atualiza Stripe product.

# Formato do relatório

```markdown
# QA Revalidação — {date}

## Resumo
- RV-1 BUG-001: PASS / FAIL
- RV-2 BUG-002: PASS / FAIL
- RV-3 BUG-003: PASS / FAIL
- RV-4 BUG-004: PASS / FAIL
- RV-5 Bônus inativos: PASS / FAIL
- RV-6 CT-P3 preço: PASS / FAIL

## Detalhes dos FAILs
Para cada FAIL, mesma estrutura do relatório anterior:
- Tela, network requests, console errors, screenshot, hipótese.

## Side-effects observados
- planos_history mostra X entries
- Stripe Dashboard mostra Y prices arquivados
- admin_users após criação: contato@ permanece ativo? grants persistem?

## Cleanup
- Que ações foram deixadas (admin contato@ ativo? draft de landing?
  preços alterados? quais valores finais?). Lista honesta — Chris não
  precisa "reverter" mas precisa saber o estado final.
```

# Como começar

1. Setup Chrome MCP (acima)
2. RV-1 → RV-6 em sequência (toda a sessão como Christophe; RV-2 inclui
   logout intermediário)
3. Gerar relatório

# Segurança

Tudo OK pra mexer (Chris liberou):
- ✅ Mudar preços, descrições, status ativo
- ✅ Publicar/rollback landing
- ✅ Criar/desativar admins

Continua proibido:
- ❌ Emitir nota > R$1
- ❌ Cobrar cartão real no Stripe
- ❌ Commitar credentials

>>>
