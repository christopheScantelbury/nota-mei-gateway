/**
 * POST /admin/api/planos/[id]/resync — força resync Stripe (nome+desc do banco
 * → Stripe product).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import { updateProduct } from '@/lib/stripe/sync'

interface Ctx { params: { id: string } }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/planos')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const admin = createAdminClient()
  const { data: p } = await admin
    .from('planos')
    .select('id, nome, descricao_curta, stripe_product_id, ativo')
    .eq('id', params.id)
    .single<{ id: string; nome: string; descricao_curta: string | null; stripe_product_id: string | null; ativo: boolean }>()

  if (!p) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (!p.stripe_product_id) {
    return NextResponse.json({ error: 'NO_STRIPE_PRODUCT' }, { status: 422 })
  }

  try {
    await updateProduct(p.stripe_product_id, {
      name: p.nome,
      description: p.descricao_curta,
      active: p.ativo,
    })
    await admin
      .from('planos')
      .update({ stripe_sync_at: new Date().toISOString(), stripe_sync_error: null })
      .eq('id', params.id)

    await logAdminAction({
      action: 'plan_resync_stripe',
      targetKind: 'plano',
      targetId: params.id,
      after: { stripe_product_id: p.stripe_product_id },
    })

    return NextResponse.json({ ok: true, productUpdated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin
      .from('planos')
      .update({ stripe_sync_at: new Date().toISOString(), stripe_sync_error: msg })
      .eq('id', params.id)
    return NextResponse.json({ error: 'STRIPE_ERROR', message: msg }, { status: 500 })
  }
}
