import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_ORDER, type PlanName } from '@/lib/plans'

/**
 * PATCH /api/admin/usuarios/[id]/plano
 * Body: { plano: PlanName }
 *
 * Altera o plano de um usuário na tabela emissoes_mensais do mês atual.
 * Requer role === 'admin' no JWT do chamador.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // 1. Verifica se o chamador é admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // 2. Valida body
  let body: { plano?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const planName = body.plano as PlanName
  if (!planName || !PLAN_ORDER.includes(planName)) {
    return NextResponse.json(
      { error: `Plano inválido. Valores aceitos: ${PLAN_ORDER.join(', ')}` },
      { status: 422 },
    )
  }

  const targetUserId = params.id
  const competencia = new Date().toISOString().slice(0, 7)

  // 3. Usa admin client para buscar o plano_id pelo nome
  const adminSupabase = createAdminClient()

  const { data: plano, error: planoErr } = await adminSupabase
    .from('planos')
    .select('id')
    .eq('nome', planName)
    .single<{ id: string }>()

  if (planoErr || !plano) {
    return NextResponse.json(
      { error: `Plano "${planName}" não encontrado na tabela planos` },
      { status: 404 },
    )
  }

  // 4. Upsert emissoes_mensais do mês atual com o novo plano
  const { error: upsertErr } = await adminSupabase
    .from('emissoes_mensais')
    .upsert(
      {
        mei_id: targetUserId,
        plano_id: plano.id,
        competencia,
        total_emitidas: 0,
      },
      { onConflict: 'mei_id,competencia', ignoreDuplicates: false },
    )

  if (upsertErr) {
    console.error('[admin/plano] upsert error:', upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plano: planName, competencia })
}
