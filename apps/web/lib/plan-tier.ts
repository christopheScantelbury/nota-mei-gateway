// plan-tier — utilitários pra decidir features liberadas conforme o plano.
//
// Decisão de produto 2026-06-05: trial ME/EPP vê apenas o essencial pra emitir
// notas. Features de integração (API Keys, Webhooks), templates, automações,
// links de emissão são premium e ficam ESCONDIDAS no trial pra reduzir ruído
// e funcionar como gancho de upgrade.
//
// Tiers (subset suficiente — Stripe controla o nome real do plano):
//   - 'trial'   → Trial ME/EPP, MEI Trial. Grátis com cap 5 notas/mês.
//   - 'starter' → planos pagos básicos. Libera Clientes, Templates*, Automações, Links.
//   - 'pro'     → Pro+ libera API Keys, Webhooks.
//   - 'business'+ → mesmas features de Pro (cap maior só).
//
// MEI legacy não tem distinção fina — todos veem o mesmo set (sem API/Webhook
// porque historicamente não foi feature MEI).

export type PlanTier = 'trial' | 'starter' | 'pro' | 'business'

/**
 * Resolve PlanTier a partir do nome do plano vindo do banco (planos.nome).
 * Best-effort case-insensitive — devolve 'trial' como fallback seguro.
 */
export function resolvePlanTier(planName: string | undefined | null): PlanTier {
  const n = (planName ?? '').toLowerCase()
  if (!n || n.includes('trial')) return 'trial'
  if (n.includes('business') || n.includes('enterprise')) return 'business'
  if (n.includes('pro')) return 'pro'
  if (n.includes('basic') || n.includes('starter')) return 'starter'
  // Plano custom desconhecido: tratar como starter (libera básicos, não premium).
  return 'starter'
}

// ── Feature gates por tier ──────────────────────────────────────────────────
//
// Cada feature responde se está liberada no tier informado.

const TIER_ORDER: Record<PlanTier, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  business: 3,
}

function tierAtLeast(current: PlanTier, min: PlanTier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[min]
}

export const features = {
  // Clientes / Templates / Automações / Links — Starter+
  canUseClientes: (t: PlanTier) => tierAtLeast(t, 'starter'),
  canUseTemplates: (t: PlanTier) => tierAtLeast(t, 'starter'),
  canUseAutomacoes: (t: PlanTier) => tierAtLeast(t, 'starter'),
  canUseLinks: (t: PlanTier) => tierAtLeast(t, 'starter'),

  // Integração (API Keys, Webhooks) — Pro+
  canUseAPI: (t: PlanTier) => tierAtLeast(t, 'pro'),
  canUseWebhooks: (t: PlanTier) => tierAtLeast(t, 'pro'),
}
