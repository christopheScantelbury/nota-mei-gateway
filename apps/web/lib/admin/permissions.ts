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

import { createClient as createSupabaseRawClient, type SupabaseClient } from '@supabase/supabase-js'

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

// TTL curto (30s) porque o cache em-memória NÃO é compartilhado entre
// Edge runtime (middleware) e Node runtime (route handlers / server actions).
// Quando o super_admin promove alguém via POST (Node), o invalidate só limpa
// o cache do runtime Node — o Edge continua com o snapshot antigo NO_ACCESS
// até expirar. Bug reportado QA 2026-06-17 (BUG-002).
//
// Estratégia: cache APENAS hits positivos (isAdmin=true). Se um user
// resolve como NO_ACCESS, NÃO cacheia → próxima request consulta banco.
// Custo: 1 query extra por request de não-admin (área /admin é low-volume,
// aceitável). Admins ativos têm cache curto pra reduzir latência.
const TTL_MS = 30 * 1000
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
  // SÓ cacheia hits positivos (ver comentário acima sobre cache distribuído).
  if (!ctx.isAdmin) return
  cache.set(userId, { ctx, expiresAt: Date.now() + TTL_MS })
}

/**
 * Cliente raw com service_role pra bypassar RLS dentro do middleware/layout.
 * Cacheado por singleton.
 *
 * Por quê: o cliente passado (server client com cookies do user) precisa
 * passar pela RLS pra ler admin_users — quando a RLS bloqueia silently
 * (cookie expired, runtime quirk Edge), `adminRes.data` vem null e o user
 * vira NO_ACCESS sem log. Bug reportado no QA RV-2 2026-06-17.
 *
 * Como admin_users é tabela de controle de acesso (não dados sensíveis
 * do user), usar service role pra leitura é seguro — não vaza nada que
 * o user não poderia inferir.
 */
let adminRawClient: SupabaseClient | null = null
function getAdminRawClient(): SupabaseClient | null {
  if (adminRawClient) return adminRawClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  adminRawClient = createSupabaseRawClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminRawClient
}

/**
 * Resolve permissões do user. Cache 30s (apenas hits positivos).
 * Retorna NO_ACCESS pra qualquer falha (defesa em profundidade).
 *
 * Usa service_role pra ler admin_users + grants (bypassa RLS — necessário
 * pq RLS em admin_users pode bloquear silently no middleware Edge).
 * O `supabase` parâmetro ficou como API compat — não usado mais.
 */
export async function getAdminContext(
  userId: string,
  _supabase: SupabaseClient,
): Promise<AdminContext> {
  if (!userId) return NO_ACCESS

  const cached = getCached(userId)
  if (cached) return cached

  const admin = getAdminRawClient()
  if (!admin) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[permissions] SUPABASE_SERVICE_ROLE_KEY ausente — getAdminContext NO_ACCESS')
    }
    return NO_ACCESS
  }

  const [adminRes, grantsRes] = await Promise.all([
    admin
      .from('admin_users')
      .select('role, ativo')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle<{ role: 'admin' | 'super_admin'; ativo: boolean }>(),
    admin
      .from('admin_page_grants')
      .select('page_path, can_read, can_write')
      .eq('user_id', userId)
      .returns<{ page_path: string; can_read: boolean; can_write: boolean }[]>(),
  ])

  if (adminRes.error && process.env.NODE_ENV !== 'production') {
    console.warn('[permissions] admin_users query error:', adminRes.error.message)
  }

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
  // Índice /admin (Visão Geral) é sempre legível por qualquer admin ativo —
  // espelha AdminSidebar.isItemVisible. Sem isto, admin não-super tem grants
  // só pra sub-páginas (/admin/usuarios, /admin/notas) e o gate do middleware
  // o joga pra /home ao acessar /admin raiz (BUG-002, QA RV-2 2026-06-17).
  if (pathname === '/admin') return true
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
