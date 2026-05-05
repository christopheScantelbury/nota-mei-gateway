/**
 * Feature matrix por plano.
 * Fonte única de verdade para gates no frontend.
 * O backend (BillingGuard) tem sua própria lógica — manter em sincronia.
 */

export type PlanName = 'Trial' | 'Starter' | 'Basic' | 'Pro' | 'Business'

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
}

const PLAN_MATRIX: Record<PlanName, PlanFeatures> = {
  Trial: {
    maxApiKeys:      2,
    maxEmissoes:     3,
    webhooks:        false,
    templates:       false,
    recorrencias:    false,
    csvExport:       false,
    prioritySupport: false,
  },
  Starter: {
    maxApiKeys:      5,
    maxEmissoes:     25,
    webhooks:        true,
    templates:       false,
    recorrencias:    false,
    csvExport:       true,
    prioritySupport: false,
  },
  Basic: {
    maxApiKeys:      5,
    maxEmissoes:     50,
    webhooks:        true,
    templates:       false,
    recorrencias:    false,
    csvExport:       true,
    prioritySupport: false,
  },
  Pro: {
    maxApiKeys:      10,
    maxEmissoes:     100,
    webhooks:        true,
    templates:       true,
    recorrencias:    false,
    csvExport:       true,
    prioritySupport: true,
  },
  Business: {
    maxApiKeys:      10,
    maxEmissoes:     300,
    webhooks:        true,
    templates:       true,
    recorrencias:    true,
    csvExport:       true,
    prioritySupport: true,
  },
}

/** Retorna as features de um plano; default = Trial se desconhecido */
export function getPlanFeatures(planName: string | null | undefined): PlanFeatures {
  return PLAN_MATRIX[(planName as PlanName) ?? 'Trial'] ?? PLAN_MATRIX.Trial
}

/** Verifica se um plano tem acesso a uma feature específica */
export function hasFeature(
  planName: string | null | undefined,
  feature: keyof PlanFeatures,
): boolean {
  return !!getPlanFeatures(planName)[feature]
}

/** Retorna o nome canônico do plano (normaliza capitalização) */
export function normalizePlanName(raw: string | null | undefined): PlanName {
  if (!raw) return 'Trial'
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  return (capitalized in PLAN_MATRIX ? capitalized : 'Trial') as PlanName
}

/** Planos ordenados por tier (útil para UI de upgrade) */
export const PLAN_ORDER: PlanName[] = ['Trial', 'Starter', 'Basic', 'Pro', 'Business']

/** Retorna o próximo plano de upgrade ou null se já for Business */
export function nextPlan(current: string | null | undefined): PlanName | null {
  const idx = PLAN_ORDER.indexOf(normalizePlanName(current))
  return idx === -1 || idx === PLAN_ORDER.length - 1 ? null : PLAN_ORDER[idx + 1]
}
