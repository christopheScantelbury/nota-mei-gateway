---
name: nota-mei-plan-gating
description: Bloquear/liberar features por plano + detectar MEI vs Empresa ME/EPP. Use SEMPRE que criar/editar página `apps/web/app/(dashboard)/**/page.tsx` que precisa de paywall, OU que precisa diferenciar MEI legacy de Empresa ME/EPP no banco. Cobre causa raiz dos bugs `/templates`, `/billing`, `/api-keys`, `/webhooks` da sessão 2026-06-08.
---

# Plan gating + owner detection

## ⚠️ Anti-pattern (causa bug toda vez)

```ts
// ❌ NÃO FAÇA isso — matriz literal de planos ad-hoc
const PRO_PLANS = ['pro', 'business']
if (PRO_PLANS.includes(planoNome.toLowerCase())) { ... }

// ❌ Idem com switch
switch (planoNome) {
  case 'Trial': return false
  case 'Starter': return true
  ...
}
```

**Por quê quebra:** o catálogo tem **10 planos** (`MEI Premium`, `MEI Plus`, `MEI Mensal`, `Avulso MEI`, `Trial MEI`, `ME Business`, `ME Pro`, `ME Start`, `Trial ME`, `Trial EPP`). Hardcode em `['pro','business']` ou `'Starter'` literal faz `"MEI Premium"` cair em fallback Trial → bloqueia o **plano mais caro** que deveria liberar tudo.

## ✅ Pattern correto — sempre `hasFeature()`

```ts
// apps/web/lib/plans.ts é fonte ÚNICA da feature matrix
import { hasFeature } from '@/lib/plans'

if (hasFeature(planoNome, 'templates')) {
  // libera
}
```

A função `resolveTier()` interna faz **substring matching** case-insensitive:

| Nome plano → Tier | Features liberadas |
|---|---|
| contém `trial` → **trial** | (nada) |
| contém `starter`/`basic`/`mensal`/`start`/`avulso` → **starter** | clientes, webhooks, csv |
| contém `pro`/`plus` → **pro** | + templates, clientesCrud |
| contém `business`/`enterprise`/`premium` → **business** | + recorrências |

Features disponíveis: `maxApiKeys`, `maxEmissoes`, `webhooks`, `templates`, `recorrencias`, `csvExport`, `prioritySupport`, `clientesRead`, `clientesCrud`.

## Padrão Server Component com PlanGate

```tsx
import PlanGate from '@/components/dashboard/PlanGate'

export default async function MyFeaturePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const competencia = new Date().toISOString().slice(0, 7)
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', competencia)
    .maybeSingle<{ planos: { nome: string } | null }>()
  const planName = emissao?.planos?.nome ?? 'Trial'

  return (
    <PlanGate
      planName={planName}
      feature="templates"           // ← chave da feature na matrix
      icon="📄"
      title="Modelos disponíveis no plano Pro"
      description="Crie modelos pra acelerar suas emissões."
      requiredPlan="Pro"
    >
      <YourActualContent />
    </PlanGate>
  )
}
```

`PlanGate` chama `hasFeature(planName, feature)` internamente. Se passar, renderiza children; se não, mostra paywall + CTA `/billing#planos`.

## Sidebar — badge "Starter/Pro" só pra quem NÃO tem acesso

```tsx
// Em components/dashboard/Sidebar.tsx — pattern atual
{badge && !accessible && (
  <span className="...text-nota-upgrade/80 bg-nota-upgrade/5">
    {badge}
  </span>
)}
```

Badge aparece **só quando bloqueado** (gancho de upgrade). MEI Premium / ME Business veem o item limpo sem ruído visual.

## Owner detection (MEI vs Empresa ME/EPP)

ARCH-03 invariant: pra MEI legacy, `meis.id == empresas.id == auth.users.id`. Empresa com `tipo='MEI'` aponta pro mesmo ID. **MAS** a RLS de `empresas` pode bloquear queries dependendo do contexto.

### ✅ Pattern robusto — busca paralela

```ts
// Próximo a checkout, billing, api-keys, webhooks etc.
const [{ data: meiRow }, { data: empresaRow }] = await Promise.all([
  supabase.from('meis')
    .select('id, email, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle<{ id: string; email: string; stripe_customer_id: string | null }>(),
  supabase.from('empresas')
    .select('id, email, tipo, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; email: string; tipo: string; stripe_customer_id: string | null }>(),
])

// Determina dono. Empresa não-MEI vence (ME/EPP path); fallback MEI.
const isEmpresa = !!empresaRow && empresaRow.tipo !== 'MEI'
const owner = isEmpresa
  ? { kind: 'empresa', id: empresaRow.id, tipo: empresaRow.tipo, /* ... */ }
  : { kind: 'mei', id: meiRow?.id ?? empresaRow?.id ?? user.id, tipo: 'MEI', /* ... */ }
```

### ❌ Anti-pattern — só uma tabela

```ts
// Só consulta empresas — quebra se RLS bloqueia ou se user é MEI legacy puro
const { data: empresa } = await supabase
  .from('empresas')
  .select('tipo')
  .eq('user_id', user.id)
  .maybeSingle()
if (empresa?.tipo === 'MEI') redirect('/home')  // ← nunca dispara se empresa=null
```

Foi exatamente o bug de `/api-keys` e `/webhooks` (commit `b639905` consertou).

## Redirect MEI em features ME-only

```ts
// /api-keys, /webhooks são features ME/EPP — bloquear MEI
const [{ data: meiRow }, { data: empresaRow }] = await Promise.all([
  supabase.from('meis').select('id').eq('id', user.id).maybeSingle<{ id: string }>(),
  supabase.from('empresas').select('tipo').eq('user_id', user.id).maybeSingle<{ tipo: 'MEI' | 'ME' | 'EPP' }>(),
])
if (meiRow || empresaRow?.tipo === 'MEI') redirect('/home')
```

## Catálogo de planos para UI de assinatura

Em `/billing/page.tsx` mostre planos conforme o tipo do owner:

```ts
const PLANOS_MEI = [
  { key: 'avulso',  name: 'Avulso MEI',  limit: 0,   price: 'R$ 5,99/nota'  },
  { key: 'mensal',  name: 'MEI Mensal',  limit: 5,   price: 'R$ 19,90/mês'  },
  { key: 'plus',    name: 'MEI Plus',    limit: 15,  price: 'R$ 39,90/mês'  },
  { key: 'premium', name: 'MEI Premium', limit: 100, price: 'R$ 79,90/mês'  },
]
const PLANOS_EMPRESA = [
  { key: 'start',    name: 'ME Start',    limit: 10,  price: 'R$ 59,99/mês'  },
  { key: 'pro',      name: 'ME Pro',      limit: 50,  price: 'R$ 149,90/mês' },
  { key: 'business', name: 'ME Business', limit: 300, price: 'R$ 299,90/mês' },
]
const planosDisponiveis = isMEI ? PLANOS_MEI : PLANOS_EMPRESA
```

Slugs (`key`) batem com `slugToPlanoNome()` no `/api/billing/checkout/route.ts` E no `slugToPlanoNome()` Go (`apps/api/internal/billing/repository.go`). **MANTER OS DOIS EM SYNC.**

## Checklist pra adicionar uma página dashboard nova com gating

- [ ] Buscar `planos.nome` de `emissoes_mensais` por `competencia`
- [ ] Usar `hasFeature(planName, 'feature')` — nunca matriz literal
- [ ] `feature` precisa estar em `lib/plans.ts::PlanFeatures` (se for nova, adicionar lá primeiro)
- [ ] Wrap content em `<PlanGate planName feature icon title description requiredPlan>`
- [ ] Sidebar `NAV_ITEMS` se for novo item de menu (`minTier`, `tipos`)
- [ ] Se page tem listagem cross-owner: filter `OR (mei_id, empresa_id)` na query
- [ ] Se page tem redirect MEI→home: usar pattern paralelo `meis.id || empresas.user_id`
