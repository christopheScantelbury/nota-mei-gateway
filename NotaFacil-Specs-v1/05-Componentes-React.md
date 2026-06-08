# 05 — Componentes React

> Contratos TypeScript de cada componente novo. Devs frontend: a assinatura abaixo
> é a fonte da verdade. Não improvisar props extras sem alinhamento.

---

## Convenções gerais

- **Naming:** `PascalCase` para componentes, `camelCase` para props
- **Pasta:** `components/<dominio>/<NomeComponente>.tsx`
- **Server vs Client:** padrão é Server Component. `'use client'` só quando precisa de state, effects ou event handlers
- **Estilo:** Tailwind utility classes. Sem `styled-components` ou CSS-in-JS novo
- **Imports:** sempre via alias `@/` (`@/components/...`, `@/lib/...`, `@/data/...`)
- **Acessibilidade:** sempre `aria-label`, `role`, `aria-live` onde aplicável

---

## `UrgencyTopBar` — `components/topbar/UrgencyTopBar.tsx`

**Tipo:** Client Component
**Props:** nenhuma (config interna)

```typescript
export function UrgencyTopBar(): JSX.Element | null
```

**Comportamento:**
- Renderiza barra fixa no topo se cookie `nf_topbar_dismissed_v1` ausente
- Troca copy automaticamente após 01/09/2026
- Botão X persiste dismiss por 7 dias

**Exemplo de uso (em `app/layout.tsx`):**
```tsx
import { UrgencyTopBar } from '@/components/topbar/UrgencyTopBar'

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <UrgencyTopBar />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

---

## `PioneerBadge` — `components/badges/PioneerBadge.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface PioneerBadgeProps {
  variant?: 'hero' | 'inline'
  className?: string
}
```

**Padrões:**
- `variant`: `'inline'` (padrão)
- `className`: `''`

**Exemplo:**
```tsx
<PioneerBadge variant="hero" />
<PioneerBadge variant="inline" className="ml-2" />
```

---

## `CountdownSet2026` — `components/countdown/CountdownSet2026.tsx`

**Tipo:** Client Component
**Props:**

```typescript
interface CountdownSet2026Props {
  /** Tamanho do display. 'compact' usa font menor para inline em cards. */
  size?: 'default' | 'compact'
  /** Sobrescrever a data alvo (testes). Padrão: 2026-09-01T00:00:00-03:00 */
  targetDate?: Date
  className?: string
}
```

**Estados visuais:**
- **Pré-vigência:** "92 dias · 14h · 23min"
- **Pós-vigência:** "Obrigatório há X dias — você está atrasado"
- **SSR:** placeholder "Set/2026" (evita hydration mismatch)

**Exemplo:**
```tsx
// No hero card ME/EPP
<div className="mt-4">
  <p className="text-xs text-amber-700 mb-1">Faltam para a obrigatoriedade:</p>
  <CountdownSet2026 size="compact" />
</div>
```

---

## `PricingSection` — `components/pricing/PricingSection.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface PricingSectionProps {
  /** Se true, mostra apenas os 3 cards âncora. Se false, mostra todos os planos. */
  anchorOnly?: boolean
  className?: string
}
```

**Padrões:** `anchorOnly: true`

**Comportamento:**
- Busca planos via `getAnchorPlans()` ou `getAllPlans()` em `@/lib/pricing`
- Renderiza 3 colunas no desktop, accordion vertical no mobile
- Card com `highlight: true` recebe destaque visual

**Exemplo:**
```tsx
// Home
<PricingSection anchorOnly />

// Página /precos
<PricingSection anchorOnly={false} />
```

---

## `PricingCard` — `components/pricing/PricingCard.tsx`

**Tipo:** Server Component
**Props:**

```typescript
import type { PricingPlan } from '@/lib/pricing/types'

interface PricingCardProps {
  plan: PricingPlan
  className?: string
}
```

**Type `PricingPlan`:**
```typescript
// lib/pricing/types.ts
export interface PricingPlan {
  key: string
  persona: 'mei' | 'me' | 'dev'
  name: string
  description: string
  priceLabel: string
  notes: string
  bullets: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  badge?: string
  highlight: boolean
}
```

**Comportamento:**
- Se `highlight: true`: border de 2px destacado, fundo levemente diferente, badge no topo
- Bullets renderizam com ícone de check
- CTAs disparam `trackCtaClick` com `location: 'pricing_card_<persona>'`

---

## `SandboxCTA` — `components/sandbox/SandboxCTA.tsx`

**Tipo:** Server Component (link estático)
**Props:**

```typescript
interface SandboxCTAProps {
  location: CtaLocation  // de @/lib/analytics/events
  variant?: 'primary' | 'inline' | 'minimal'
  className?: string
}
```

**Variantes:**
- `primary`: botão sólido grande "Testar a API no sandbox"
- `inline`: link com ícone ⚡, usado em cards
- `minimal`: texto pequeno com seta

**Exemplo:**
```tsx
// Hero card Dev
<SandboxCTA location="hero_card_dev" variant="inline" />

// Hero do /gateway
<SandboxCTA location="gateway_hero" variant="primary" />
```

---

## `CompetitorTable` — `components/competitor/CompetitorTable.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface CompetitorTableProps {
  /** 'summary' mostra apenas features com highlight: true (~4 linhas). */
  variant?: 'full' | 'summary'
  /** Limitar competitors mostrados (default: todos). */
  competitorsFilter?: string[]
  className?: string
}
```

**Padrões:** `variant: 'full'`

**Exemplo:**
```tsx
// Home (embed)
<CompetitorTable variant="summary" />

// Página /comparativo
<CompetitorTable variant="full" />

// Post de blog vs concorrente específico
<CompetitorTable variant="full" competitorsFilter={['notafacil', 'focus_nfe']} />
```

---

## `VsHero` — `components/blog/VsHero.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface VsHeroProps {
  competitor: 'focus_nfe' | 'enotas' | 'plugnotas' | 'nfeio'
  className?: string
}
```

**Renderização:**
- Logos lado a lado com "vs" no meio
- Data de última atualização
- Badge de pioneirismo do NotaFácil

**Exemplo no MDX:**
```mdx
<VsHero competitor="focus_nfe" />
```

---

## `MigrationCTA` — `components/blog/MigrationCTA.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface MigrationCTAProps {
  /** Nome legível do concorrente de onde o leitor está migrando. */
  from: string
  className?: string
}
```

**Exemplo no MDX:**
```mdx
<MigrationCTA from="Focus NFe" />
```

---

## `Callout` — `components/mdx/Callout.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface CalloutProps {
  type?: 'info' | 'warn' | 'success' | 'danger'
  title?: string
  children: React.ReactNode
  className?: string
}
```

**Padrões:** `type: 'info'`

**Exemplo no MDX:**
```mdx
<Callout type="warn" title="Atenção">
A partir de 01/09/2026, emissões pelo padrão antigo podem ser rejeitadas
em municípios que migrarem para o nacional.
</Callout>
```

---

## `CTABanner` — `components/mdx/CTABanner.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface CTABannerProps {
  title: string
  description?: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  variant?: 'default' | 'urgency'
  className?: string
}
```

**Exemplo:**
```mdx
<CTABanner
  title="Pronto para emitir sua primeira NFS-e Nacional?"
  description="Trial de 30 dias, sem cartão."
  primaryCta={{ label: "Criar conta grátis", href: "/cadastro?utm_source=blog&utm_medium=cta_banner" }}
  secondaryCta={{ label: "Falar com vendas", href: "/contato" }}
  variant="urgency"
/>
```

---

## `CookieBanner` — `components/consent/CookieBanner.tsx`

**Tipo:** Client Component
**Props:** nenhuma

```typescript
export function CookieBanner(): JSX.Element | null
```

**Comportamento:**
- Aparece apenas se cookie `nf_consent` ausente
- 3 botões: "Aceitar todos", "Apenas necessários", "Configurar"
- Persiste escolha em cookie por 12 meses
- Configura Consent Mode v2 do GA4

---

## `HeroPersonaCards` — `components/home/HeroPersonaCards.tsx`

**Tipo:** Server Component (composição de Client em subcomponentes)
**Props:** nenhuma

**Estrutura:**
- 3 cards (MEI, ME/EPP, Dev)
- Card ME/EPP inclui `<CountdownSet2026 />`
- Card Dev inclui `<SandboxCTA variant="inline" />`
- Todos os CTAs disparam tracking

---

## Hooks customizados

### `useFeatureFlag` — `lib/flags/useFeatureFlag.ts`

**Tipo:** Hook Client
**Assinatura:**

```typescript
function useFeatureFlag(key: string): {
  variant: string
  isLoading: boolean
  isControl: boolean
}
```

**Exemplo:**
```tsx
'use client'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'

function HeroHeadline() {
  const { variant, isLoading } = useFeatureFlag('hero_copy_variant')

  if (isLoading) return <h1>Sua NFS-e Nacional pronta antes de setembro/2026</h1>

  if (variant === 'variant_b') {
    return <h1>Antes de setembro, sua empresa precisa emitir NFS-e Nacional.</h1>
  }

  return <h1>Sua NFS-e Nacional pronta antes de setembro/2026</h1>
}
```

---

### `useFirstTouchAttribution` — `lib/attribution/useFirstTouchAttribution.ts`

**Tipo:** Hook Client (efeito colateral)

```typescript
function useFirstTouchAttribution(): void
```

**Comportamento:**
- Roda no primeiro acesso (cookie `nf_first_touch` ausente)
- Captura UTMs da URL atual, document.referrer, location.pathname
- Persiste em cookie por 30 dias (JSON serializado)
- Não retorna nada — efeito puro

**Uso:** chamar em `app/layout.tsx` dentro de um Client Component minúsculo.

---

## Estrutura de pastas final esperada

```
components/
├── badges/
│   └── PioneerBadge.tsx
├── blog/
│   ├── VsHero.tsx
│   └── MigrationCTA.tsx
├── competitor/
│   └── CompetitorTable.tsx
├── consent/
│   └── CookieBanner.tsx
├── countdown/
│   └── CountdownSet2026.tsx
├── header/
│   └── MainNav.tsx
├── home/
│   └── HeroPersonaCards.tsx
├── mdx/
│   ├── Callout.tsx
│   └── CTABanner.tsx
├── pricing/
│   ├── PricingSection.tsx
│   └── PricingCard.tsx
├── sandbox/
│   └── SandboxCTA.tsx
└── topbar/
    └── UrgencyTopBar.tsx

lib/
├── analytics/
│   ├── consent.ts
│   ├── events.ts
│   └── gtag.ts
├── attribution/
│   └── useFirstTouchAttribution.ts
├── brevo/
│   ├── client.ts
│   ├── events.ts
│   └── templates.ts
├── dates/
│   └── countdown.ts
├── flags/
│   ├── index.ts
│   ├── hash.ts
│   └── useFeatureFlag.ts
├── pricing/
│   ├── index.ts
│   └── types.ts
└── seo/
    └── jsonLd.ts

data/
├── competitors.json
└── pricing.ts

content/
└── blog/
    ├── notafacil-vs-focus-nfe.mdx
    └── ...
```

---

## Documentação inline (JSDoc)

Todo componente exportado deve ter JSDoc com pelo menos:
- Descrição de uma linha
- `@example` mostrando uso típico

**Padrão:**
```typescript
/**
 * Barra fixa no topo da página com mensagem de urgência regulatória.
 * Dispensa em cookie por 7 dias. Troca a mensagem após 01/09/2026.
 *
 * @example
 * <UrgencyTopBar />
 */
export function UrgencyTopBar() { /* ... */ }
```

---

## Testes mínimos esperados

Para cada componente com lógica não-trivial, criar um arquivo `*.test.tsx` cobrindo:

- **CountdownSet2026:** estados pré e pós-vigência; cleanup de interval; hydration sem mismatch
- **PricingSection:** renderiza 3 cards; card highlight recebe classe correta
- **CompetitorTable:** variante summary filtra corretamente
- **PioneerBadge:** ambas variantes renderizam
- **UrgencyTopBar:** respeita cookie dismiss; troca mensagem após vigência

Framework: **Vitest** + **Testing Library** (se ainda não estiver no projeto, adicionar).
