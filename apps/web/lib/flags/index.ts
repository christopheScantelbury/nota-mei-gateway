// Feature flags caseiras — server-side API.
//
// Spec: HIST-7.4 + D-05.

import { createClient } from '@supabase/supabase-js'
import { bucket } from './hash'

interface FlagConfig {
  key: string
  enabled: boolean
  rollout_pct: number
  variants: { name: string; weight: number }[]
}

let cached: { rows: FlagConfig[]; at: number } | null = null
const CACHE_MS = 30_000 // 30s

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function loadAll(): Promise<FlagConfig[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rows
  try {
    const sb = service()
    const { data } = await sb
      .from('feature_flags')
      .select('key, enabled, rollout_pct, variants')
      .eq('enabled', true)
      .returns<FlagConfig[]>()
    cached = { rows: data ?? [], at: Date.now() }
    return cached.rows
  } catch {
    return cached?.rows ?? []
  }
}

/**
 * Resolve a variante de um flag para uma sessão. Fail-safe: retorna 'control'
 * em qualquer erro (banco off, flag não existe, etc.).
 */
export async function getVariant(flagKey: string, sessionId: string): Promise<string> {
  const flags = await loadAll()
  const flag = flags.find(f => f.key === flagKey)
  if (!flag || !flag.enabled) return 'control'

  const userBucket = bucket(sessionId, flagKey)
  if (userBucket >= flag.rollout_pct) return 'control'

  const variantBucket = bucket(`${sessionId}:variant`, flagKey)
  let cumulative = 0
  for (const v of flag.variants) {
    cumulative += v.weight
    if (variantBucket < cumulative) return v.name
  }
  return 'control'
}
