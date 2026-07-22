/**
 * PATCH /admin/api/planos/[id] — editar plano + sync Stripe se preço mudou.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import { syncPlanoChange } from '@/lib/stripe/sync'

interface Ctx { params: { id: string } }

/**
 * Extrai o número de notas prometido numa descrição no formato "até N notas" /
 * "até N NFS-e". Só reconhece a forma com "até" — faixas como "(250–700
 * notas/mês)" dos planos Gateway são legítimas e não devem ser interpretadas
 * como promessa de limite.
 */
function limiteNaDescricao(desc: string | null | undefined): number | null {
  if (!desc) return null
  const m = desc.match(/at[ée]\s+(\d+)\s*(?:NFS-e|notas?)/i)
  return m ? Number(m[1]) : null
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/planos')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { body = {} }

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('planos')
    .select('*')
    .eq('id', params.id)
    .single<{
      id: string
      nome: string
      descricao_curta: string | null
      emissoes_limite: number
      preco_mensal_brl: number | null
      preco_excedente_brl: number | null
      ativo: boolean
      destaque: boolean
      ordem_exibicao: number
      stripe_price_id: string | null
      stripe_product_id: string | null
    }>()

  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // GUARD (2026-07-22): descrição não pode prometer um número de notas diferente
  // do `emissoes_limite`. Foi assim que /me passou a mostrar "até 10 NFS-e" com
  // "30 notas/mês" no mesmo card — limite editado aqui, descrição esquecida.
  const newLimite =
    body.emissoes_limite !== undefined ? Number(body.emissoes_limite) : before.emissoes_limite
  const newDesc =
    body.descricao_curta !== undefined ? (body.descricao_curta as string | null) : before.descricao_curta
  const limitePrometido = limiteNaDescricao(newDesc)
  if (limitePrometido !== null && limitePrometido !== newLimite) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message:
          `A descrição promete "até ${limitePrometido} notas" mas o limite do plano é ${newLimite}. ` +
          'Ajuste um dos dois — ou, de preferência, tire o número da descrição: ' +
          'ele já é exibido no card a partir do limite.',
      },
      { status: 422 },
    )
  }

  // Detecta mudança de preço
  const newPrecoMensal =
    body.preco_mensal_brl !== undefined ? Number(body.preco_mensal_brl) : (before.preco_mensal_brl ?? 0)
  const precoMudou = Number(before.preco_mensal_brl ?? 0) !== newPrecoMensal
  const nomeMudou = body.nome !== undefined && body.nome !== before.nome
  const descMudou = body.descricao_curta !== undefined && body.descricao_curta !== before.descricao_curta

  let stripe: Awaited<ReturnType<typeof syncPlanoChange>> | undefined
  let newPriceId = before.stripe_price_id

  // Stripe sync se preço/nome/descrição mudou
  if (precoMudou || nomeMudou || descMudou) {
    if (!before.stripe_product_id) {
      return NextResponse.json(
        { error: 'NO_STRIPE_PRODUCT', message: 'Plano não tem stripe_product_id — vincular manualmente primeiro' },
        { status: 422 },
      )
    }
    stripe = await syncPlanoChange({
      productId: before.stripe_product_id,
      oldPriceId: precoMudou ? before.stripe_price_id : null,
      newPriceCents: Math.round(newPrecoMensal * 100),
      isRecurring: newPrecoMensal > 0,
      productName: nomeMudou ? String(body.nome) : undefined,
      productDescription: descMudou ? (body.descricao_curta as string | null) : undefined,
      planoId: params.id,
    })
    if (stripe.newPriceId) newPriceId = stripe.newPriceId

    // GUARD (#253): se o preço mudou e precisávamos criar um novo Stripe price
    // recorrente mas a criação FALHOU (newPriceId undefined), ABORTA sem tocar
    // no banco. Sem isto, o banco ficava com preço novo + stripe_price_id
    // velho/null → checkout cobrava valor errado (ou 422 "indisponível") e o
    // admin recebia 200 "ok" achando que deu certo. Foi a causa do ME Pro
    // ficar sem price (embora aquele caso específico tenha vindo da migration).
    if (precoMudou && newPrecoMensal > 0 && !stripe.newPriceId) {
      return NextResponse.json(
        {
          error: 'STRIPE_SYNC_FAILED',
          message:
            'Falha ao criar o novo preço no Stripe — nenhuma alteração foi salva. ' +
            'Tente de novo; se persistir, verifique o Stripe Dashboard. ' +
            (stripe.errors?.join('; ') ?? ''),
        },
        { status: 502 },
      )
    }
  }

  // UPDATE no banco
  const patch: Record<string, unknown> = {}
  if (body.nome !== undefined) patch.nome = body.nome
  if (body.descricao_curta !== undefined) patch.descricao_curta = body.descricao_curta
  if (body.emissoes_limite !== undefined) patch.emissoes_limite = Number(body.emissoes_limite)
  if (body.preco_mensal_brl !== undefined) patch.preco_mensal_brl = Number(body.preco_mensal_brl) || null
  if (body.preco_excedente_brl !== undefined) patch.preco_excedente_brl = Number(body.preco_excedente_brl) || null
  if (body.destaque !== undefined) patch.destaque = !!body.destaque
  if (body.ordem_exibicao !== undefined) patch.ordem_exibicao = Number(body.ordem_exibicao)
  if (body.ativo !== undefined) patch.ativo = !!body.ativo
  if (newPriceId !== before.stripe_price_id) patch.stripe_price_id = newPriceId
  if (stripe) {
    patch.stripe_sync_at = new Date().toISOString()
    patch.stripe_sync_error = stripe.errors ? stripe.errors.join('; ') : null
  }

  const { data: updated, error } = await admin
    .from('planos')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })

  // Audit por campo
  for (const [campo, valor_novo] of Object.entries(patch)) {
    const valor_antigo = (before as Record<string, unknown>)[campo]
    if (valor_antigo === valor_novo) continue
    await admin.from('planos_history').insert({
      plano_id: params.id,
      user_id: user.id,
      campo,
      valor_antigo: valor_antigo == null ? null : String(valor_antigo),
      valor_novo: valor_novo == null ? null : String(valor_novo),
      stripe_action:
        campo === 'stripe_price_id' && stripe?.newPriceId
          ? 'price_created'
          : campo === 'nome' || campo === 'descricao_curta'
            ? 'product_updated'
            : null,
      stripe_ref: campo === 'stripe_price_id' ? String(valor_novo) : null,
    })
  }

  await logAdminAction({
    action: 'plan_edit',
    targetKind: 'plano',
    targetId: params.id,
    before,
    after: updated,
  })

  return NextResponse.json({ ok: true, plano: updated, stripe })
}
