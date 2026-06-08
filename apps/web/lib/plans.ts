/**
 * Feature matrix por plano.
 * Fonte única de verdade para gates no frontend.
 * O backend (BillingGuard) tem sua própria lógica — manter em sincronia.
 *
 * 2026-06-05: REFATORADO pra reconhecer os 10 planos novos (MEI Premium,
 * ME Business, etc) via substring matching — antes só conhecia Trial/Starter/
 * Basic/Pro/Business literais e bloqueava todo MEI Premium como Trial.
 *
 * Sync com:
 *   - lib/plan-tier.ts (mesma estratégia de resolução)
 *   - apps/api/internal/billing (BillingGuard backend)
 *   - tabela planos no Supabase
 */

// Nomes canônicos aceitos. O resolver é substring-based, então variações
// (lowercase, acentos, "MEI Premium" vs "premium") caem no tier correto.
export type PlanName =
  // Legacy (mantidos pra compat com PLAN_ORDER e admin)
  | 'Trial'
  | 'Starter'
  | 'Basic'
  | 'Pro'
  | 'Business'
  // Catálogo novo (2026-06)
  | 'Trial MEI'
  | 'Avulso MEI'
  | 'MEI Mensal'
  | 'MEI Plus'
  | 'MEI Premium'
  | 'Trial ME'
  | 'ME Start'
  | 'ME Pro'
  | 'ME Business'
  | 'Trial EPP'

export interface PlanFeatures {
  /** Número máximo de API Keys ativas */
  maxApiKeys: number
  /** Limite de emissões/mês */
  maxEmissoes: number
  /** Acesso a webhooks por nota */
  webhooks: boolean
  /** Acesso a templates de nota */
  templates: boolean
  /** Acesso a emissão recorrente (Automação) */
  recorrencias: boolean
  /** Export de CSV na listagem de notas */
  csvExport: boolean
  /** Suporte prioritário */
  prioritySupport: boolean
  /** Leitura da aba Clientes + autocomplete em /notas/nova */
  clientesRead: boolean
  /** CRUD completo de clientes (criar, editar, arquivar, tags, observações) */
  clientesCrud: boolean
}

// Tier interno — feature matrix é indexada por isso, não pelo nome literal.
type PlanTier = 'trial' | 'starter' | 'pro' | 'business'

const TIER_MATRIX: Record<PlanTier, PlanFeatures> = {
  trial: {
    maxApiKeys:      2,
    maxEmissoes:     5,
    webhooks:        false,
    templates:       false,
    recorrencias:    false,
    csvExport:       false,
    prioritySupport: false,
    clientesRead:    false,
    clientesCrud:    false,
  },
  starter: {
    maxApiKeys:      5,
    maxEmissoes:     25,
    webhooks:        true,
    templates:       false,
    recorrencias:    false,
    csvExport:       true,
    prioritySupport: false,
    clientesRead:    true,
    clientesCrud:    false,
  },
  pro: {
    maxApiKeys:      10,
    maxEmissoes:     100,
    webhooks:        true,
    templates:       true,
    recorrencias:    false,
    csvExport:       true,
    prioritySupport: true,
    clientesRead:    true,
    clientesCrud:    true,
  },
  business: {
    maxApiKeys:      10,
    maxEmissoes:     300,
    webhooks:        true,
    templates:       true,
    recorrencias:    true,
    csvExport:       true,
    prioritySupport: true,
    clientesRead:    true,
    clientesCrud:    true,
  },
}

/**
 * Mapeia o nome do plano (vindo do banco) pra um tier interno.
 *
 *   Trial MEI / Trial ME / Trial EPP / "Trial"         → trial
 *   Avulso MEI / MEI Mensal / ME Start / Starter/Basic → starter
 *   MEI Plus / ME Pro / "Pro"                          → pro
 *   MEI Premium / ME Business / "Business"             → business
 *
 * Default seguro: trial (bloqueia features premium quando nome desconhecido).
 */
function resolveTier(raw: string | null | undefined): PlanTier {
  const n = (raw ?? '').toLowerCase().trim()
  if (!n || n.includes('trial')) return 'trial'
  // Top tier: business/enterprise no nome OU MEI Premium (top do catálogo MEI).
  if (n.includes('business') || n.includes('enterprise') || n.includes('premium')) {
    return 'business'
  }
  // Pro tier: 'pro' no nome OU MEI Plus (segundo melhor MEI, libera templates).
  if (n.includes('pro') || n.includes('plus')) return 'pro'
  // Starter tier: básico — libera clientes/webhooks mas não templates/automação.
  if (
    n.includes('starter') ||
    n.includes('basic')   ||
    n.includes('mensal')  ||
    n.includes('start')   ||
    n.includes('avulso')
  ) {
    return 'starter'
  }
  // Plano custom desconhecido → trial (seguro: bloqueia premium).
  return 'trial'
}

/** Retorna as features de um plano; default = Trial se desconhecido */
export function getPlanFeatures(planName: string | null | undefined): PlanFeatures {
  return TIER_MATRIX[resolveTier(planName)]
}

/** Verifica se um plano tem acesso a uma feature específica */
export function hasFeature(
  planName: string | null | undefined,
  feature: keyof PlanFeatures,
): boolean {
  return !!getPlanFeatures(planName)[feature]
}

/**
 * Retorna o nome canônico do plano (normaliza casing).
 * Mantido pra retrocompat com admin/usuarios — não usar em código novo.
 */
export function normalizePlanName(raw: string | null | undefined): PlanName {
  if (!raw) return 'Trial'
  const tier = resolveTier(raw)
  // Mapeia tier → nome legacy (admin UI ainda usa esses).
  switch (tier) {
    case 'trial':    return 'Trial'
    case 'starter':  return 'Starter'
    case 'pro':      return 'Pro'
    case 'business': return 'Business'
  }
}

/** Planos ordenados por tier (legacy — UI admin). */
export const PLAN_ORDER: PlanName[] = ['Trial', 'Starter', 'Basic', 'Pro', 'Business']

/** Catálogo novo completo — pra UI que precise listar planos reais do banco. */
export const PLAN_CATALOG: PlanName[] = [
  'Trial MEI',
  'Avulso MEI',
  'MEI Mensal',
  'MEI Plus',
  'MEI Premium',
  'Trial ME',
  'ME Start',
  'ME Pro',
  'ME Business',
  'Trial EPP',
]

/** Retorna o próximo plano de upgrade ou null se já for Business */
export function nextPlan(current: string | null | undefined): PlanName | null {
  const tier = resolveTier(current)
  switch (tier) {
    case 'trial':    return 'Starter'
    case 'starter':  return 'Pro'
    case 'pro':      return 'Business'
    case 'business': return null
  }
}
