/**
 * Audit log automático pra server actions admin (#234).
 *
 * Toda ação write em /admin/* deve chamar logAdminAction() pra deixar
 * rastro em admin_audit_log. Append-only via service role (RLS bloqueia
 * inserts diretos do client).
 *
 * Uso típico:
 *   import { logAdminAction } from '@/lib/admin/audit'
 *
 *   await updatePlano(planoId, newData)
 *   await logAdminAction({
 *     action: 'plan_edit',
 *     targetKind: 'plano',
 *     targetId: planoId,
 *     before: oldPlano,
 *     after: newData,
 *   })
 *
 * Erros de log NÃO falham a operação (warn no console). A ação principal
 * é sempre mais importante que o trace.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

export type AdminAction =
  | 'page_access'
  | 'plan_create'
  | 'plan_edit'
  | 'plan_archive'
  | 'plan_resync_stripe'
  | 'user_promote'
  | 'user_demote'
  | 'user_grant_change'
  | 'user_deactivate'
  | 'landing_section_edit'
  | 'landing_publish'
  | 'landing_rollback'
  | 'landing_asset_upload'

export type AdminActionTarget =
  | 'plano'
  | 'admin_user'
  | 'landing_page'
  | 'landing_section'
  | 'landing_asset'
  | 'page'

export interface LogAdminActionInput {
  action: AdminAction
  targetKind?: AdminActionTarget
  targetId?: string
  before?: unknown
  after?: unknown
}

/**
 * Loga uma ação admin. Resolve user_id automaticamente da sessão.
 * Falha silenciosa (warn no console) — não joga.
 */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    const sb = createServerClient()
    const {
      data: { user },
    } = await sb.auth.getUser()
    if (!user) {
      console.warn('[audit] no user in session, skipping log')
      return
    }

    // IP + user_agent vêm dos headers de request.
    const h = headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0].trim() ||
      h.get('x-real-ip') ||
      null
    const ua = h.get('user-agent') || null

    // INSERT via service role (RLS bloqueia client direct).
    const admin = createAdminClient()
    const { error } = await admin.from('admin_audit_log').insert({
      user_id: user.id,
      action: input.action,
      target_kind: input.targetKind ?? null,
      target_id: input.targetId ?? null,
      before_data: input.before ?? null,
      after_data: input.after ?? null,
      ip,
      user_agent: ua,
    })
    if (error) {
      console.warn('[audit] insert failed', {
        action: input.action,
        targetId: input.targetId,
        err: error.message,
      })
    }
  } catch (e) {
    console.warn('[audit] unexpected error', e)
  }
}

/**
 * Helper pra logar acesso a página admin protegida.
 * Use no Server Component da rota /admin/* logo após o gate.
 */
export async function logPageAccess(pathname: string): Promise<void> {
  await logAdminAction({
    action: 'page_access',
    targetKind: 'page',
    targetId: pathname,
  })
}
