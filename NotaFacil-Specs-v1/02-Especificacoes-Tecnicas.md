# 02 — Especificações Técnicas

> Detalhamento por história. Estrutura de cada bloco:
> **Arquivos** · **Implementação** · **Edge cases** · **Testes** · **Critérios de aceite**

---

## HIST-7.1 — Auditoria GA4 e consent banner LGPD

### Arquivos
- `docs/audits/ga4-audit-2026-06.md` — relatório
- `components/cookie-banner.tsx` (criar se não existir)
- `lib/analytics/gtag.ts` (criar/revisar)
- `app/layout.tsx` (incluir banner)

### Implementação

**Passo 1 — Inventário (escrever no doc):**
- Listar todos os eventos disparados hoje (procurar `gtag(`, `dataLayer.push(`)
- Listar todas as páginas com tag GA4
- Validar GA4 Property ID configurado (`NEXT_PUBLIC_GA_MEASUREMENT_ID`)
- Listar custom dimensions atualmente configuradas no painel GA4

**Passo 2 — Consent banner LGPD:**
- Mostrar na primeira visita, persistir aceite em cookie `nf_consent` (validade 12 meses)
- Botões: "Aceitar todos", "Apenas necessários", "Configurar"
- Antes do aceite: GA4 em modo `consent_mode v2` com `analytics_storage='denied'`
- Após aceite: `gtag('consent', 'update', { analytics_storage: 'granted' })`
- Link discreto para `/privacidade` no footer do banner

**Snippet de referência — `lib/analytics/consent.ts`:**
```typescript
type ConsentState = 'granted' | 'denied'

export function setConsent(state: ConsentState) {
  if (typeof window === 'undefined') return
  window.gtag?.('consent', 'update', {
    analytics_storage: state,
    ad_storage: 'denied', // não usamos ads
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  document.cookie = `nf_consent=${state}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

export function getConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)nf_consent=(granted|denied)/)
  return (match?.[1] as ConsentState) ?? null
}
```

### Edge cases
- Usuário com cookies bloqueados: banner reaparece, GA4 nunca dispara — ok
- Usuário em iframe (SSR de previews): não disparar GA4

### Testes
- Manual: abrir aba anônima, validar banner aparece
- Manual: aceitar, validar em DebugView que eventos chegam
- Manual: rejeitar, validar que GA4 não recebe nada

### AC
- [ ] Doc de auditoria publicado
- [ ] Banner aparece para visitantes novos
- [ ] Aceite persiste em cookie por 12 meses
- [ ] Consent Mode v2 corretamente configurado
- [ ] Eventos só disparam após aceite

---

## HIST-7.2 — Eventos de conversão por persona

### Arquivos
- `lib/analytics/events.ts` — taxonomia central
- Buscar em `components/**/*.tsx` e adicionar trackings nos CTAs

### Implementação

**Função canônica:**
```typescript
// lib/analytics/events.ts
type Persona = 'mei' | 'me' | 'dev' | 'unknown'
type CtaLocation =
  | 'topbar' | 'header' | 'hero_card_mei' | 'hero_card_me' | 'hero_card_dev'
  | 'hero_main_cta' | 'pricing_card_mei' | 'pricing_card_me' | 'pricing_card_dev'
  | 'sandbox_hero' | 'gateway_hero' | 'comparativo' | 'footer' | 'blog_cta'

export function trackCtaClick(params: {
  persona: Persona
  location: CtaLocation
  plan?: string
  experiment_id?: string
  variant?: string
}) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'cta_click', {
    persona: params.persona,
    cta_location: params.location,
    plan: params.plan ?? 'none',
    experiment_id: params.experiment_id ?? 'none',
    variant: params.variant ?? 'none',
  })
}

export function trackPageEngagement(params: {
  persona: Persona
  page_section: string
}) {
  window.gtag?.('event', 'page_engagement', params)
}
```

**Aplicação:** todo `<Link>`/`<button>` que leva a `/cadastro`, `/sandbox`, `/precos`, `/comparativo` chama `trackCtaClick` em `onClick`.

**Custom dimensions a criar no painel GA4:**
- `persona` (event-scoped)
- `cta_location` (event-scoped)
- `plan` (event-scoped)
- `experiment_id` (event-scoped)
- `variant` (event-scoped)

### Edge cases
- SSR: não chamar `window.gtag`. Sempre guardar com `typeof window`.
- `gtag` não carregado ainda: fazer `?.` (optional chaining).

### Testes
- Manual em DebugView: clicar em cada CTA, ver evento chegando com props corretas.

### AC
- [ ] Função `trackCtaClick` centralizada
- [ ] Todos os CTAs principais (≥ 15) chamam a função
- [ ] 5 custom dimensions configuradas no painel
- [ ] DebugView valida ao menos 1 clique por persona

---

## HIST-7.3 — Dashboard Looker Studio

### Implementação

Criar dashboard com seções:
1. **Resumo** — sessões, usuários, taxa de cadastro (últimos 28 dias com comparação aos 28 anteriores)
2. **Funil de conversão por persona** — sankey ou funnel chart
   - hero_view → persona_page_view → pricing_view → cta_click → cadastro_completo
3. **Top sources** — origem do tráfego com conversão por canal
4. **Performance por CTA** — eventos `cta_click` agrupados por `cta_location`

### Compartilhamento
- Acesso para: dev lead, product, marketing
- Comentários habilitados

### AC
- [ ] Link compartilhado por e-mail com stakeholders
- [ ] 4 abas/seções configuradas
- [ ] Atualização automática diária funcionando

---

## HIST-6.0 — Auditoria da integração Brevo

### Entregável
Documento `docs/audits/brevo-audit-2026-06.md` respondendo:
1. SDK em uso (lib npm/pip, versão)
2. API Key onde está armazenada (env var, AWS Secrets?)
3. Eventos enviados hoje (lista completa)
4. Templates ativos no painel Brevo (lista por ID + nome + última edição)
5. Listas/segmentos existentes
6. Webhooks reversos configurados (Brevo → app)
7. Domínio de envio verificado? SPF/DKIM/DMARC configurados?

### AC
- [ ] Documento publicado e revisado
- [ ] Inclui screenshots dos painéis relevantes
- [ ] Lista gaps identificados (o que falta para HIST-6.1 funcionar)

---

## HIST-1.1 — Top bar de urgência regulatória

### Arquivos
- `components/topbar/UrgencyTopBar.tsx` (criar)
- `app/layout.tsx` (incluir antes do header)
- `lib/cookies/topbar.ts` (gerenciar dismiss)

### Implementação

**Componente:**
```tsx
// components/topbar/UrgencyTopBar.tsx
'use client'

import { useState, useEffect } from 'react'
import { trackCtaClick } from '@/lib/analytics/events'

const COOKIE_NAME = 'nf_topbar_dismissed_v1'
const COOKIE_DAYS = 7
const VIGENCIA = new Date('2026-09-01T00:00:00-03:00')

export function UrgencyTopBar() {
  const [visible, setVisible] = useState(false)
  const [isPostVigencia, setIsPostVigencia] = useState(false)

  useEffect(() => {
    const dismissed = document.cookie.includes(`${COOKIE_NAME}=1`)
    setIsPostVigencia(new Date() >= VIGENCIA)
    setVisible(!dismissed)

    if (!dismissed) {
      window.gtag?.('event', 'topbar_view')
    }
  }, [])

  const dismiss = () => {
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * COOKIE_DAYS}; SameSite=Lax`
    setVisible(false)
    window.gtag?.('event', 'topbar_dismiss')
  }

  const onCtaClick = () => {
    trackCtaClick({ persona: 'unknown', location: 'topbar' })
  }

  if (!visible) return null

  const message = isPostVigencia
    ? 'NFS-e Nacional vigente desde 01/09/2026 — emita a sua agora'
    : 'NFS-e Nacional obrigatória em Set/2026 — Migre antes da multidão'

  return (
    <div
      role="region"
      aria-label="Aviso de urgência regulatória"
      className="relative w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm py-2 px-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <span aria-hidden>⏰</span>
        <span>{message}</span>
        <a
          href="/comparativo"
          onClick={onCtaClick}
          className="underline font-semibold hover:no-underline"
        >
          Saiba mais
        </a>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

### Edge cases
- Pré-Set/2026 com dismiss ativo: barra escondida — ok
- Pós-Set/2026: cookie expirado se passou de 7 dias, mostra mensagem nova
- Mobile (< 640px): manter altura ≤ 40px, ajustar font-size para 12px e quebrar layout se necessário

### Testes
- Renderiza com SSR (ver-source mostra HTML)
- Dismiss persiste após reload
- Após `Date.now() >= VIGENCIA`, mensagem muda

### AC
- [ ] Altura ≤ 40px desktop, ≤ 48px mobile
- [ ] Sem CLS no carregamento
- [ ] Cookie persiste 7 dias
- [ ] Eventos `topbar_view`, `topbar_dismiss`, `cta_click` disparam
- [ ] Lighthouse mantém score ≥ 90

---

## HIST-1.2 — Componente PioneerBadge

### Arquivos
- `components/badges/PioneerBadge.tsx`
- `app/page.tsx` (usar no hero)
- `app/me/page.tsx` (usar no hero)
- `app/gateway/page.tsx` (usar no hero)

### Implementação

```tsx
// components/badges/PioneerBadge.tsx
type Variant = 'hero' | 'inline'

interface Props {
  variant?: Variant
  className?: string
}

export function PioneerBadge({ variant = 'inline', className = '' }: Props) {
  const sizes = variant === 'hero'
    ? 'text-sm md:text-base px-4 py-2'
    : 'text-xs px-3 py-1'

  return (
    <span
      role="img"
      aria-label="Selo de pioneirismo"
      className={`
        inline-flex items-center gap-2 rounded-full
        bg-gradient-to-r from-amber-100 to-amber-50
        border border-amber-300 text-amber-900 font-medium
        ${sizes} ${className}
      `}
    >
      <span aria-hidden>🏆</span>
      <span>Pioneiros · NFS-e Nacional em produção desde mai/2026</span>
    </span>
  )
}
```

### AC
- [ ] Componente em `components/badges/`
- [ ] Duas variantes funcionando
- [ ] Usado em /, /me, /gateway

---

## HIST-1.3 — Contagem regressiva Set/2026

### Arquivos
- `components/countdown/CountdownSet2026.tsx`
- `lib/dates/countdown.ts`

### Implementação

```tsx
// components/countdown/CountdownSet2026.tsx
'use client'

import { useState, useEffect } from 'react'

const VIGENCIA = new Date('2026-09-01T00:00:00-03:00')

function computeDiff(now: Date) {
  const diffMs = VIGENCIA.getTime() - now.getTime()
  if (diffMs <= 0) {
    const daysOver = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
    return { isOver: true, daysOver, days: 0, hours: 0, minutes: 0 }
  }
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return { isOver: false, daysOver: 0, days, hours, minutes }
}

export function CountdownSet2026() {
  const [diff, setDiff] = useState(() => computeDiff(new Date()))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const tick = () => setDiff(computeDiff(new Date()))
    tick()
    const interval = setInterval(tick, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // SSR / pré-hidratação: placeholder estável
  if (!mounted) {
    return (
      <div className="inline-flex items-baseline gap-2 font-mono text-amber-900">
        <span>Set/2026</span>
      </div>
    )
  }

  if (diff.isOver) {
    return (
      <div
        aria-live="polite"
        className="inline-flex items-baseline gap-2 font-mono text-red-700"
      >
        <span className="font-bold">Obrigatório há {diff.daysOver} dias</span>
        <span className="text-xs">— você está atrasado</span>
      </div>
    )
  }

  return (
    <div
      aria-live="polite"
      aria-label={`Faltam ${diff.days} dias para a obrigatoriedade`}
      className="inline-flex items-baseline gap-2 font-mono"
    >
      <span className="text-2xl font-bold tabular-nums">{diff.days}</span>
      <span className="text-sm">dias ·</span>
      <span className="text-lg tabular-nums">{diff.hours}h</span>
      <span className="text-lg tabular-nums">{diff.minutes}min</span>
    </div>
  )
}
```

### Edge cases
- Hydration mismatch: resolvido com `mounted` flag + placeholder estável no SSR
- Após 01/09/2026: muda mensagem automaticamente
- Aba inativa muito tempo: ao voltar, recalcula imediatamente (`tick()` chamado no useEffect)
- JS desabilitado: mostra placeholder "Set/2026" — degradação graciosa

### Testes
- Manual: abrir, conferir que números atualizam de minuto em minuto
- Manual: mudar relógio do SO para 02/09/2026 e validar mensagem "Obrigatório há..."
- Console: zero warnings de hydration

### AC
- [ ] Sem hydration warnings
- [ ] Cleanup do interval no unmount
- [ ] aria-live="polite"
- [ ] Funciona sem JS (placeholder)
- [ ] Posicionado no card ME/EPP do hero

---

## HIST-1.4 — Reescrita do copy do hero

### Implementação
Copies finais aprovados estão em `03-Copies-Finais.md` seção "Hero". **Não inventar variações.**

### AC
- [ ] H1, sub e CTAs atualizados conforme copies finais
- [ ] Mobile: H1 não quebra em mais de 3 linhas

---

## HIST-2.1 — Refatorar PricingSection para 3 colunas

### Arquivos
- `components/pricing/PricingSection.tsx` (refatorar)
- `components/pricing/PricingCard.tsx` (criar)
- `data/pricing.ts` (criar/centralizar)

### Implementação

**Dados centralizados:**
```typescript
// data/pricing.ts
export interface AnchorPlan {
  persona: 'mei' | 'me' | 'dev'
  name: string
  price: number
  priceLabel: string  // ex: "R$ 79/mês"
  frequency: 'monthly' | 'per_unit'
  notes: string  // ex: "50 notas/mês"
  badge?: string
  bullets: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  highlight: boolean
}

export const ANCHOR_PLANS: AnchorPlan[] = [
  {
    persona: 'mei',
    name: 'MEI Mensal',
    price: 19,
    priceLabel: 'R$ 19/mês',
    frequency: 'monthly',
    notes: '30 notas/mês',
    bullets: ['Sem cartão no trial', 'PDF + XML automáticos', 'Suporte humano'],
    primaryCta: { label: 'Começar trial grátis', href: '/cadastro?produto=mei&plano=mensal&utm_source=home&utm_medium=pricing&utm_content=mei_card' },
    secondaryCta: { label: 'Ver todos os planos MEI →', href: '/mei#precos' },
    highlight: false,
  },
  {
    persona: 'me',
    name: 'ME Start',
    price: 79,
    priceLabel: 'R$ 79/mês',
    frequency: 'monthly',
    notes: '50 notas/mês',
    badge: 'Obrigatório a partir de Set/2026',
    bullets: ['30 dias grátis · sem cartão', 'Simples Nacional e Lucro Presumido', 'Multi-empresa'],
    primaryCta: { label: 'Começar trial grátis', href: '/cadastro?produto=me&plano=start&utm_source=home&utm_medium=pricing&utm_content=me_card' },
    secondaryCta: { label: 'Ver todos os planos ME →', href: '/me#precos' },
    highlight: true,
  },
  {
    persona: 'dev',
    name: 'Gateway Start',
    price: 0,
    priceLabel: 'Grátis · pague por uso',
    frequency: 'per_unit',
    notes: 'R$ 0,89 por nota emitida',
    bullets: ['API REST · JSON · Bearer', 'Webhooks HMAC-SHA256', 'SDKs Node/Python/PHP', 'Sandbox sem cadastro'],
    primaryCta: { label: 'Testar no sandbox', href: '/sandbox?utm_source=home&utm_medium=pricing&utm_content=dev_card' },
    secondaryCta: { label: 'Ver planos Gateway →', href: '/gateway#precos' },
    highlight: false,
  },
]
```

**Layout:**
```tsx
// components/pricing/PricingSection.tsx
import { ANCHOR_PLANS } from '@/data/pricing'
import { PricingCard } from './PricingCard'

export function PricingSection() {
  return (
    <section id="precos" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <header className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Planos e preços</h2>
          <p className="mt-4 text-gray-600">
            Um plano para cada perfil. Comece grátis. Escale conforme cresce.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ANCHOR_PLANS.map((plan) => (
            <PricingCard key={plan.persona} plan={plan} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Trial de 30 dias sem cartão. Cancele quando quiser.
        </p>
      </div>
    </section>
  )
}
```

### Edge cases
- Mobile (< 768px): empilha em coluna única, card ME/EPP fica no topo (use `order-first` para `highlight: true` no mobile)
- Tablet (768–1024px): 2 colunas + 1 abaixo, ou 3 colunas com scroll horizontal — preferir 3 colunas compactas

### AC
- [ ] Toggle "Sou MEI / Sou dev" removido
- [ ] 3 cards visíveis no desktop
- [ ] Card ME/EPP em destaque visual (border, sombra, badge)
- [ ] Mobile: card ME/EPP aparece primeiro
- [ ] Eventos `pricing_view` (intersection observer) e `pricing_cta_click`

---

## HIST-2.2 — Card ME/EPP com plano âncora

### Implementação
Os dados estão em `ANCHOR_PLANS` (HIST-2.1). Esta história valida que o card de ME/EPP recebe o tratamento de destaque correto:
- Border de 2px na cor de destaque (sugestão: `border-amber-500`)
- Badge "Obrigatório a partir de Set/2026" acima do nome
- Ribbon ou shadow indicando "Recomendado para ME/EPP"
- Botão primário com cor de destaque
- Cor de fundo levemente diferente (`bg-amber-50/30`)

### AC
- [ ] Visualmente destacado vs MEI e Dev
- [ ] Badge presente
- [ ] CTA leva a `/cadastro?produto=me&plano=start&utm_*`

---

## HIST-2.3 — Card Dev/Gateway com plano âncora

### Implementação
Igual aos demais, com bullets técnicos e CTA primário levando ao sandbox (não ao cadastro).

### AC
- [ ] CTA primário leva a `/sandbox`
- [ ] CTA secundário leva a `/gateway#precos`
- [ ] Bullets técnicos visíveis

---

## HIST-3.1 — CTA sandbox no card Gateway do hero

### Arquivos
- `components/home/HeroPersonaCards.tsx` (ajustar card Dev)

### Implementação
Adicionar segundo CTA visível abaixo do "Ver a API →":

```tsx
<a
  href="/sandbox"
  onClick={() => trackCtaClick({ persona: 'dev', location: 'sandbox_hero' })}
  className="mt-2 inline-flex items-center text-sm text-sky-700 hover:text-sky-900 font-medium"
>
  ⚡ Testar no navegador em 30s · sem cadastro
</a>
```

### AC
- [ ] CTA visível no card Dev do hero
- [ ] Evento `cta_click` com `location: 'sandbox_hero'`

---

## HIST-3.2 — Item Sandbox no menu principal

### Arquivos
- `components/header/MainNav.tsx`

### Implementação

Reorganizar menu desktop: transformar "Gateway API" em dropdown com submenu:
- Gateway API (overview)
- Docs
- Sandbox ← NOVO
- SDKs
- Status

Mobile: incluir "Sandbox" como item independente no menu hamburguer.

### AC
- [ ] Submenu funciona com teclado (Tab, Enter, Esc)
- [ ] `aria-expanded` correto
- [ ] Item ativo destacado quando na rota correspondente

---

## HIST-3.3 — Hero do /gateway com sandbox como CTA primário

### Arquivos
- `app/gateway/page.tsx`

### Implementação
Reordenar CTAs:
- **Primário (botão sólido):** "Testar a API no sandbox" → `/sandbox`
- **Secundário (botão outline):** "Criar conta de desenvolvedor" → `/cadastro?produto=dev`

Adicionar bloco de snippet curl logo abaixo do hero:

```tsx
<pre className="mt-8 bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \\
  -H "Authorization: Bearer $NF_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d @nota.json`}
</pre>
<button onClick={copyToClipboard} className="mt-2 text-sm text-sky-400">
  📋 Copiar
</button>
```

### Edge cases
- Browser sem `navigator.clipboard`: fallback usando `document.execCommand('copy')` com textarea temporário

### AC
- [ ] CTA primário leva ao sandbox
- [ ] Snippet curl com botão "Copiar" funcionando
- [ ] Feedback visual após copy (ex: "✓ Copiado")
- [ ] Métrica conversão sandbox/cadastro acompanhada por 14d

---

## HIST-4.1 — Componente CompetitorTable

### Arquivos
- `components/competitor/CompetitorTable.tsx`
- `data/competitors.json`

### Implementação

**Dados (já decididos — ver `07-Pesquisa-Mercado.md`):**
```json
{
  "$schema": "./competitors.schema.json",
  "lastUpdated": "2026-06-02",
  "competitors": ["notafacil", "focus_nfe", "enotas", "plugnotas"],
  "labels": {
    "notafacil": "NotaFácil",
    "focus_nfe": "Focus NFe",
    "enotas": "eNotas",
    "plugnotas": "PlugNotas"
  },
  "features": [
    { "id": "nfse_nacional_native", "label": "NFS-e Nacional nativa desde mai/2026", "values": { "notafacil": "✅", "focus_nfe": "❌", "enotas": "❌", "plugnotas": "❌" }, "highlight": true },
    { "id": "rest_json", "label": "API REST · JSON · Bearer", "values": { "notafacil": "✅", "focus_nfe": "✅", "enotas": "Parcial", "plugnotas": "✅" } },
    { "id": "sandbox_no_signup", "label": "Sandbox público sem cadastro", "values": { "notafacil": "✅", "focus_nfe": "❌", "enotas": "❌", "plugnotas": "❌" }, "highlight": true },
    { "id": "mei_dedicated", "label": "Produto dedicado para MEI", "values": { "notafacil": "✅", "focus_nfe": "❌", "enotas": "❌ (não atende MEI)", "plugnotas": "❌" }, "highlight": true },
    { "id": "me_dedicated", "label": "Produto dedicado para ME/EPP", "values": { "notafacil": "✅", "focus_nfe": "Parcial", "enotas": "✅", "plugnotas": "Parcial" } },
    { "id": "dev_api", "label": "API para desenvolvedores", "values": { "notafacil": "✅", "focus_nfe": "✅", "enotas": "Plano Plus+", "plugnotas": "✅" } },
    { "id": "multi_company", "label": "Multi-empresa", "values": { "notafacil": "✅", "focus_nfe": "✅", "enotas": "Plano Plus+", "plugnotas": "✅" } },
    { "id": "sdks", "label": "SDKs prontos (Node/Python/PHP)", "values": { "notafacil": "✅", "focus_nfe": "Parcial", "enotas": "❌", "plugnotas": "Parcial" } },
    { "id": "entry_price", "label": "Preço de entrada", "values": { "notafacil": "R$ 2,90/nota ou R$ 19/mês", "focus_nfe": "R$ 89/mês", "enotas": "R$ 137/mês", "plugnotas": "Sob consulta" } },
    { "id": "trial_no_card", "label": "Trial sem cartão", "values": { "notafacil": "✅", "focus_nfe": "Limitado", "enotas": "✅", "plugnotas": "Sob consulta" } },
    { "id": "webhooks_hmac", "label": "Webhooks HMAC-SHA256", "values": { "notafacil": "✅", "focus_nfe": "✅", "enotas": "Parcial", "plugnotas": "✅" } },
    { "id": "mtls_receita", "label": "mTLS direto com Receita Federal", "values": { "notafacil": "✅", "focus_nfe": "Intermediado", "enotas": "Intermediado", "plugnotas": "Intermediado" }, "highlight": true }
  ]
}
```

**Componente:**
```tsx
// components/competitor/CompetitorTable.tsx
import competitors from '@/data/competitors.json'

interface Props {
  variant?: 'full' | 'summary'  // summary mostra só features com highlight: true
}

export function CompetitorTable({ variant = 'full' }: Props) {
  const features = variant === 'summary'
    ? competitors.features.filter(f => f.highlight)
    : competitors.features

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label="Comparativo competitivo">
        <caption className="sr-only">
          Comparativo entre {competitors.competitors.length} plataformas de emissão de NFS-e
        </caption>
        <thead>
          <tr>
            <th scope="col" className="text-left p-3 border-b">Funcionalidade</th>
            {competitors.competitors.map((c) => (
              <th
                key={c}
                scope="col"
                className={`p-3 border-b text-center ${c === 'notafacil' ? 'bg-amber-50 font-bold' : ''}`}
              >
                {competitors.labels[c as keyof typeof competitors.labels]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.id} className={f.highlight ? 'bg-amber-50/40' : ''}>
              <th scope="row" className="text-left p-3 border-b font-medium">
                {f.label}
              </th>
              {competitors.competitors.map((c) => (
                <td
                  key={c}
                  className={`p-3 border-b text-center ${c === 'notafacil' ? 'bg-amber-50 font-semibold' : ''}`}
                >
                  {f.values[c as keyof typeof f.values]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-gray-500">
        Atualizado em {competitors.lastUpdated}. Informações coletadas dos sites oficiais dos concorrentes.
      </p>
    </div>
  )
}
```

### Edge cases
- Mobile (< 640px): scroll horizontal habilitado, primeira coluna sticky (use `sticky left-0 bg-white`)

### AC
- [ ] Renderiza no SSR
- [ ] Variante `summary` mostra 4 linhas (apenas `highlight: true`)
- [ ] Variante `full` mostra todas as 12 linhas
- [ ] Lighthouse A11y ≥ 95

---

## HIST-4.2 — Página /comparativo

### Arquivos
- `app/comparativo/page.tsx`
- `app/comparativo/opengraph-image.tsx` (OG dinâmica)

### Implementação

Estrutura da página:
1. **Hero** — H1 "Por que migrar para o NotaFácil", sub destaca pioneirismo + arquitetura nativa
2. **Tabela completa** — `<CompetitorTable variant="full" />`
3. **3 cards de diferencial** — explicação narrativa dos 3 pontos mais fortes
4. **FAQ específico** (6 perguntas — ver `03-Copies-Finais.md`)
5. **CTA final** — "Migrar agora · 30 dias grátis"

**Metadata:**
```tsx
export const metadata: Metadata = {
  title: 'NotaFácil vs concorrentes — Comparativo de emissores de NFS-e Nacional',
  description: 'Compare NotaFácil com Focus NFe, eNotas e PlugNotas. Saiba por que somos a única plataforma nativa para a NFS-e Nacional, com sandbox sem cadastro e atendimento ao MEI.',
  alternates: { canonical: 'https://emitirnotafacil.com.br/comparativo' },
  openGraph: {
    title: 'NotaFácil vs concorrentes — NFS-e Nacional',
    description: 'Comparativo completo. Veja as diferenças.',
    images: ['/og/og-comparativo-1200x630.png'],
  },
}
```

**Schema.org:**
```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Comparativo NotaFácil',
  description: '...',
  about: {
    '@type': 'Product',
    name: 'NotaFácil',
    brand: { '@type': 'Brand', name: 'ScantelburyDevs' },
  },
}
```

### AC
- [ ] `/comparativo` rota funcionando
- [ ] Adicionada ao `sitemap.xml` com priority 0.8
- [ ] PSI ≥ 90 mobile e desktop
- [ ] OG image dedicada
- [ ] Schema.org JSON-LD validado (Schema Validator)

---

## HIST-4.3 — Embed do comparativo na home

### Implementação
Adicionar entre seção "Como funciona" e "Planos e preços":

```tsx
<section className="py-16 bg-slate-50">
  <div className="max-w-5xl mx-auto px-4">
    <header className="text-center mb-8">
      <h2 className="text-3xl font-bold">Por que escolher o NotaFácil</h2>
      <p className="mt-2 text-gray-600">Comparado com as principais alternativas do mercado</p>
    </header>

    <CompetitorTable variant="summary" />

    <div className="text-center mt-8">
      <a href="/comparativo" className="text-amber-700 hover:text-amber-900 font-semibold">
        Ver comparativo completo →
      </a>
    </div>
  </div>
</section>
```

### AC
- [ ] Seção renderiza na home
- [ ] Variante summary (4 linhas highlight)
- [ ] Link para `/comparativo` com tracking

---

## HIST-4.4 — Template MDX "NotaFácil vs X" + post piloto

### Arquivos
- `app/blog/(posts)/notafacil-vs-focus-nfe.mdx` (post piloto)
- `components/blog/VsHero.tsx`
- `components/blog/MigrationCTA.tsx`

### Implementação

Componentes MDX disponíveis em qualquer post:
- `<VsHero competitor="focus_nfe" />` — busca dados em `competitors.json`
- `<CompetitorTable variant="full" />`
- `<MigrationCTA from="Focus NFe" />`

**Post piloto (estrutura mínima):**
```mdx
---
title: "NotaFácil vs Focus NFe — qual API de NFS-e escolher em 2026"
description: "Comparativo técnico entre NotaFácil e Focus NFe para emissão de NFS-e Nacional. Diferenças de arquitetura, preço, sandbox e cobertura."
slug: notafacil-vs-focus-nfe
date: 2026-07-01
author: ScantelburyDevs
tags: [comparativo, nfse-nacional, focus-nfe]
coverImage: /blog/notafacil-vs-focus-nfe.png
---

<VsHero competitor="focus_nfe" />

## Introdução
...

## Arquitetura: nativa nacional vs adaptada
...

## Comparativo completo
<CompetitorTable variant="full" />

## Quando escolher cada um
...

<MigrationCTA from="Focus NFe" />
```

### AC
- [ ] Template MDX funcionando
- [ ] Post piloto publicado em `/blog/notafacil-vs-focus-nfe`
- [ ] Schema.org Article presente
- [ ] Internal linking para `/comparativo` e `/gateway`

---

## HIST-5.0 — Setup do blog em MDX

### Arquivos
- `package.json` (deps)
- `velite.config.ts` (ou contentlayer config)
- `app/blog/page.tsx` (index)
- `app/blog/[slug]/page.tsx` (detail)
- `content/blog/.gitkeep`

### Implementação

**Dependências:**
```bash
npm install velite rehype-pretty-code rehype-slug rehype-autolink-headings remark-gfm
```

**velite.config.ts:**
```typescript
import { defineConfig, defineCollection, s } from 'velite'

const posts = defineCollection({
  name: 'Post',
  pattern: 'blog/**/*.mdx',
  schema: s.object({
    title: s.string().max(99),
    description: s.string().max(180),
    slug: s.path(),
    date: s.isodate(),
    updated: s.isodate().optional(),
    author: s.string().default('NotaFácil'),
    tags: s.array(s.string()).default([]),
    coverImage: s.image().optional(),
    readingTime: s.number().optional(),
    body: s.mdx(),
    metadata: s.metadata(),
  }).transform((data) => ({
    ...data,
    permalink: `/blog/${data.slug}`,
    readingTime: data.readingTime ?? data.metadata.readingTime,
  })),
})

export default defineConfig({
  root: 'content',
  output: { data: '.velite', assets: 'public/static', base: '/static/' },
  collections: { posts },
  mdx: {
    rehypePlugins: [
      ['rehype-slug'],
      ['rehype-pretty-code', { theme: 'github-dark' }],
      ['rehype-autolink-headings'],
    ],
    remarkPlugins: [['remark-gfm']],
  },
})
```

**Componentes MDX disponíveis:**
- `Callout` (info/warn/success)
- `CompetitorTable`
- `CTABanner`
- `Image` (next/image otimizado)

### AC
- [ ] `npm run build` valida frontmatter (erro se faltar campo)
- [ ] Preview deploy do Vercel funciona para PRs em `content/blog/`
- [ ] Posts em SSG (build-time)
- [ ] Sitemap.xml inclui posts automaticamente

---

## HIST-5.1 — Auditoria SEO baseline

### Entregável
`docs/audits/seo-baseline-2026-06.md` com:
1. Lighthouse das rotas principais (/, /mei, /me, /gateway, /precos, /blog, /comparativo)
2. Search Console: cobertura, queries top, CTR
3. Lista de rotas sem canonical
4. Lista de rotas sem og:image
5. robots.txt e sitemap.xml validados
6. Recomendações priorizadas

### AC
- [ ] Documento publicado com prints
- [ ] Issues abertas para cada gap encontrado

---

## HIST-5.2 — Schema.org Article nos posts

### Implementação

Helper em `lib/seo/jsonLd.ts`:

```typescript
import type { Post } from '.velite'

export function articleJsonLd(post: Post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
      url: 'https://scantelburydevs.com.br',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NotaFácil',
      logo: { '@type': 'ImageObject', url: 'https://emitirnotafacil.com.br/brand/notafacil-logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://emitirnotafacil.com.br${post.permalink}` },
    image: post.coverImage,
  }
}
```

Adicionar no template do post via `<script type="application/ld+json">`.

### AC
- [ ] Schema Validator (validator.schema.org) passa sem erros
- [ ] Rich Results Test mostra "Article" elegível

---

## HIST-6.1 — Webhooks de eventos do app → Brevo

### Arquivos
- `lib/brevo/client.ts` (cliente HTTP)
- `lib/brevo/events.ts` (helper de envio com idempotência)
- `db/migrations/00X_brevo_event_queue.sql`
- `workers/brevo-queue-processor.ts` (worker que processa a fila)
- `app/api/internal/brevo/dispatch/route.ts` (endpoint opcional para reprocessar)

### Implementação

**Schema (ver `04-Modelos-Dados.md` para SQL completo):**

Tabela `brevo_event_queue` com `event_id` único, status, retry_count, payload.

**Helper:**
```typescript
// lib/brevo/events.ts
import { db } from '@/db'

type BrevoEventName =
  | 'user_signup' | 'cert_uploaded' | 'first_nfse_created'
  | 'first_nfse_authorized' | 'plan_upgraded'

export async function enqueueBrevoEvent(params: {
  eventName: BrevoEventName
  email: string
  contactId?: number
  properties: Record<string, unknown>
  occurredAt?: Date
  /** Chave de idempotência. Se omitida, deriva de (email, eventName, minute). */
  eventId?: string
}) {
  const occurredAt = params.occurredAt ?? new Date()
  const eventId = params.eventId
    ?? `${params.email}:${params.eventName}:${Math.floor(occurredAt.getTime() / 60000)}`

  await db.query(
    `INSERT INTO brevo_event_queue (event_id, event_name, email, contact_id, properties, occurred_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, params.eventName, params.email, params.contactId, params.properties, occurredAt]
  )
}
```

**Worker:**
```typescript
// workers/brevo-queue-processor.ts
import { db } from '@/db'
import { brevoClient } from '@/lib/brevo/client'

const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 1000

async function processBatch() {
  const { rows } = await db.query(
    `SELECT * FROM brevo_event_queue
     WHERE status IN ('pending','failed') AND retry_count < $1
     ORDER BY occurred_at ASC
     LIMIT 50
     FOR UPDATE SKIP LOCKED`,
    [MAX_RETRIES]
  )

  for (const event of rows) {
    try {
      await brevoClient.trackEvent({
        event_name: event.event_name,
        identifiers: { email_id: event.email },
        contact_properties: event.properties,
        event_properties: { occurred_at: event.occurred_at.toISOString() },
      })
      await db.query(`UPDATE brevo_event_queue SET status='sent', sent_at=NOW() WHERE id=$1`, [event.id])
    } catch (err) {
      const backoff = BACKOFF_BASE_MS * 2 ** event.retry_count
      await db.query(
        `UPDATE brevo_event_queue
         SET status='failed', retry_count=retry_count+1, last_error=$1, next_retry_at=NOW() + INTERVAL '${backoff} milliseconds'
         WHERE id=$2`,
        [String(err), event.id]
      )
    }
  }
}

// Rodar a cada 30s via cron (Railway scheduler ou node-cron)
setInterval(processBatch, 30_000)
```

**Pontos de chamada (call sites):**
- `POST /api/auth/signup` → `enqueueBrevoEvent({ eventName: 'user_signup', ... })`
- `POST /api/certificates/upload` → `enqueueBrevoEvent({ eventName: 'cert_uploaded', ... })`
- `POST /api/nfse/create` (no commit final, antes do return) → `enqueueBrevoEvent({ eventName: 'first_nfse_created', ... })`
- Webhook da Receita autorizando nota → `enqueueBrevoEvent({ eventName: 'first_nfse_authorized', ... })`
- `POST /api/subscriptions/upgrade` → `enqueueBrevoEvent({ eventName: 'plan_upgraded', ... })`

> **Importante:** "first_*" só dispara na primeira vez. Antes de enfileirar, verificar com SELECT no banco se o usuário já tem esse evento histórico.

### Edge cases
- Brevo fora do ar: retry com backoff exponencial (1s, 2s, 4s, 8s, 16s)
- Após 5 tentativas falhas: status = 'dead', notificar via Sentry/log
- Worker crashed mid-process: `FOR UPDATE SKIP LOCKED` garante que outro pegue

### AC
- [ ] Tabela `brevo_event_queue` criada
- [ ] Worker rodando como processo separado no Railway
- [ ] Todos os 5 call sites instrumentados
- [ ] Idempotência testada (chamar 2x → 1 envio só)
- [ ] Dead letter tem alerta no Sentry/logger

---

## HIST-6.2 — Templates de e-mails de onboarding

### Arquivos
- Templates criados no painel Brevo (não no código)
- IDs dos templates registrados em `lib/brevo/templates.ts`

### Implementação

Os 4 e-mails (D+0, D+1 condicional, D+3 condicional, D+5 evento) com copies finais
estão em `03-Copies-Finais.md` seção "E-mails de onboarding".

**No painel Brevo, criar:**
- Automation "Onboarding NotaFácil"
- Trigger: evento `user_signup`
- 4 nós condicionais conforme régua

**No código:**
```typescript
// lib/brevo/templates.ts
export const BREVO_TEMPLATES = {
  ONBOARDING_WELCOME: 101,     // D+0
  ONBOARDING_CERT_REMINDER: 102, // D+1
  ONBOARDING_FIRST_NOTE_TUTORIAL: 103, // D+3
  ONBOARDING_FIRST_AUTH_CONGRATS: 104, // D+5 evento
} as const
```

### AC
- [ ] 4 templates criados no Brevo
- [ ] Automation com triggers e condicionais ativada
- [ ] Variáveis dinâmicas (nome, CNPJ, link) funcionando
- [ ] Teste end-to-end com conta sandbox

---

## HIST-6.3 — Campanha urgência ME/EPP (T-60 → T-1)

### Implementação

Régua de 6 e-mails. Trigger: data calculada relativa a `2026-09-01`.

Segmentação Brevo:
- Lista: contatos com `porte = 'ME' OR porte = 'EPP'`
- Filtro: `subscription_status != 'active'`
- Filtro: `unsubscribed_urgency = false`

**Disparos:**
- T-60 → 03/07/2026
- T-30 → 02/08/2026
- T-15 → 17/08/2026
- T-7 → 25/08/2026
- T-3 → 29/08/2026
- T-1 → 31/08/2026

Copies em `03-Copies-Finais.md` seção "E-mails de urgência ME/EPP".

### AC
- [ ] 6 templates criados no Brevo
- [ ] Régua configurada com triggers de data
- [ ] Botão "Não me envie isso" funcional (atualiza `unsubscribed_urgency = true`)
- [ ] T-60 disparado em 03/07/2026

---

## HIST-7.4 — Sistema caseiro de feature flags

### Arquivos
- `db/migrations/00Y_feature_flags.sql`
- `lib/flags/index.ts`
- `lib/flags/hash.ts`
- `app/api/admin/flags/route.ts`
- `app/admin/flags/page.tsx` (UI simples)
- `components/admin/FlagList.tsx`

### Implementação

**Hash determinístico (sem dependência externa):**
```typescript
// lib/flags/hash.ts
/** djb2 hash → 0..99 bucket */
export function bucket(sessionId: string, flagKey: string): number {
  const input = `${sessionId}:${flagKey}`
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100
}
```

**API server:**
```typescript
// lib/flags/index.ts
import { db } from '@/db'
import { bucket } from './hash'

interface FlagConfig {
  key: string
  enabled: boolean
  rollout_pct: number
  variants: { name: string; weight: number }[]
}

export async function getVariant(flagKey: string, sessionId: string): Promise<string> {
  const { rows } = await db.query<FlagConfig>(
    `SELECT key, enabled, rollout_pct, variants FROM feature_flags WHERE key = $1`,
    [flagKey]
  )
  if (rows.length === 0) return 'control'
  const flag = rows[0]
  if (!flag.enabled) return 'control'

  const userBucket = bucket(sessionId, flagKey)
  if (userBucket >= flag.rollout_pct) return 'control'

  // distribuição por weight (somatório = 100)
  const variantBucket = bucket(`${sessionId}:variant`, flagKey)
  let cumulative = 0
  for (const v of flag.variants) {
    cumulative += v.weight
    if (variantBucket < cumulative) return v.name
  }
  return 'control'
}
```

**Hook client (com sessionId em cookie):**
```typescript
// lib/flags/useFeatureFlag.ts
'use client'
import useSWR from 'swr'

export function useFeatureFlag(key: string): string {
  const { data } = useSWR(`/api/flags/${key}`, (url) => fetch(url).then(r => r.json()))
  return data?.variant ?? 'control'
}
```

**Tracking integrado:**
Toda chamada a `trackCtaClick` em página com flag ativa deve incluir `experiment_id` e `variant`.

### Edge cases
- SSR: usar cookie `nf_session_id` (UUID gerado no primeiro acesso) como input do hash
- Flag não existe: retorna 'control' (não quebra)
- Banco off: retorna 'control' (fail-safe)

### Painel admin (UI mínima)
- Tabela: key, enabled, rollout_pct, variants (JSON)
- Botão toggle on/off por flag
- Edição inline de rollout_pct

### AC
- [ ] Tabela `feature_flags` criada
- [ ] Hash determinístico testado (mesmo sessionId + key → sempre mesmo bucket)
- [ ] Hook `useFeatureFlag` funcional
- [ ] Eventos GA4 incluem `experiment_id` e `variant`
- [ ] Painel admin acessível em `/admin/flags` (autenticado)

---

## Histórias menores (resumo)

### HIST-5.3 — Templates dos 5 posts âncora

Layout MDX padronizado para os 5 temas. Copies dos títulos e meta description em `03-Copies-Finais.md`. Estrutura sugerida:
- Hero com badge regulatório
- Sumário clicável (table of contents)
- Corpo com headings H2/H3
- `<MigrationCTA />` ao final
- Posts relacionados

### HIST-5.4 — Landing pilar /nfse-nacional-2026

Página cornerstone reusando componentes:
- `<CountdownSet2026 />`
- `<CompetitorTable variant="summary" />`
- FAQ regulatório (10 perguntas — copies em `03-Copies-Finais.md`)
- 3 CTAs (1 por persona)
- Internal linking para os 5 posts âncora

### HIST-6.4 — Painel de métricas de lifecycle (P2)

Dashboard interno admin com open rate, CTR e conversão por etapa. Pode usar Brevo Statistics API.

---

## Checklist global de conformidade

Para qualquer PR, validar:

- [ ] Sem `console.log` em produção
- [ ] Sem chaves/secrets hardcoded
- [ ] Imports relativos via `@/` (alias)
- [ ] Componentes client (`'use client'`) só quando necessário
- [ ] Imagens via `next/image` (com `width`, `height`, `alt`)
- [ ] Links externos com `rel="noopener"`
- [ ] Acessibilidade: labels em form fields, alt em imagens, `aria-*` quando aplicável
- [ ] TypeScript strict (sem `any` sem comentário justificando)
