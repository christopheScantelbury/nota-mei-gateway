/**
 * Resolução de permissões admin per-tela (#231).
 *
 * Hoje:  middleware checa `app_metadata.role === 'admin'` (tudo-ou-nada).
 * Novo:  consulta admin_users + admin_page_grants do banco.
 *
 * Modelo:
 *   - super_admin → acesso total (ignora grants)
 *   - admin       → precisa de grant pra cada page_path com can_read=true
 *   - sem registro em admin_users → não é admin
 *
 * Cache: Map em memória com TTL 5min por user_id. Reseta no cold start
 * do Edge (aceitável; equivale a logout forçado a cada deploy). Pra
 * usuários frequentes, hit cache evita query.
 *
 * Server actions write usam `assertCanWrite()` que sempre consulta o
 * banco (não usa cache) — defesa em profundidade.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminContext = {
  isAdmin: boolean
  isSuperAdmin: boolean
  /** Map de page_path → permissions. Vazio pra super_admin (todos liberados). */
  grants: Map<string, { canRead: boolean; canWrite: boolean }>
}

const NO_ACCESS: AdminContext = {
  isAdmin: false,
  isSuperAdmin: false,
  grants: new Map(),
}

const TTL_MS = 5 * 60 * 1000  // 5min — igual BillingGuard pattern
type CacheEntry = { ctx: AdminContext; expiresAt: number }
const cache = new Map<string, CacheEntry>()

function getCached(userId: string): AdminContext | null {
  const e = cache.get(userId)
  if (!e) return null
  if (e.expiresAt < Date.now()) {
    cache.delete(userId)
    return null
  }
  return e.ctx
}

function setCached(userId: string, ctx: AdminContext): void {
  cache.set(userId, { ctx, expiresAt: Date.now() + TTL_MS })
}

/**
 * Resolve permissões do user. Cache 5min.
 * Retorna NO_ACCESS pra qualquer falha (defesa em profundidade).
 */
export async function getAdminContext(
  userId: string,
  supabase: SupabaseClient,
): Promise<AdminContext> {
  if (!userId) return NO_ACCESS

  const cached = getCached(userId)
  if (cached) return cached

  // Resolve em paralelo: registro de admin + grants.
  const [adminRes, grantsRes] = await Promise.all([
    supabase
      .from('admin_users')
      .select('role, ativo')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle<{ role: 'admin' | 'super_admin'; ativo: boolean }>(),
    supabase
      .from('admin_page_grants')
      .select('page_path, can_read, can_write')
      .eq('user_id', userId)
      .returns<{ page_path: string; can_read: boolean; can_write: boolean }[]>(),
  ])

  if (!adminRes.data || !adminRes.data.ativo) {
    setCached(userId, NO_ACCESS)
    return NO_ACCESS
  }

  const isSuperAdmin = adminRes.data.role === 'super_admin'
  const grants = new Map<string, { canRead: boolean; canWrite: boolean }>()
  for (const g of grantsRes.data ?? []) {
    grants.set(g.page_path, { canRead: g.can_read, canWrite: g.can_write })
  }

  const ctx: AdminContext = { isAdmin: true, isSuperAdmin, grants }
  setCached(userId, ctx)
  return ctx
}

/**
 * Verifica se o context tem leitura na page_path. Super_admin sempre true.
 * Match exato OU prefix match (ex: grant /admin/usuarios libera
 * /admin/usuarios/123).
 */
export function canRead(ctx: AdminContext, pathname: string): boolean {
  if (!ctx.isAdmin) return false
  if (ctx.isSuperAdmin) return true
  return checkGrant(ctx.grants, pathname, 'canRead')
}

/**
 * Verifica se o context tem escrita na page_path. Super_admin sempre true.
 * Use em server actions que mutam dados.
 */
export function canWrite(ctx: AdminContext, pathname: string): boolean {
  if (!ctx.isAdmin) return false
  if (ctx.isSuperAdmin) return true
  return checkGrant(ctx.grants, pathname, 'canWrite')
}

function checkGrant(
  grants: Map<string, { canRead: boolean; canWrite: boolean }>,
  pathname: string,
  kind: 'canRead' | 'canWrite',
): boolean {
  let result = false
  grants.forEach((perms, path) => {
    if ((pathname === path || pathname.startsWith(path + '/')) && perms[kind]) {
      result = true
    }
  })
  return result
}

/**
 * Invalida cache de um user (chame após mudança de grants ou role).
 */
export function invalidateAdminCache(userId: string): void {
  cache.delete(userId)
}
