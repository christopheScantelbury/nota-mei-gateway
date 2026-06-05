import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/profile
//
// Atualiza dados editáveis do perfil. Suporta tanto MEI legacy (meis table)
// quanto ME/EPP (empresas table). Aplica update em qualquer tabela onde o
// usuário tem row — auth.uid() bate via id (MEI legacy) ou user_id (ME/EPP).
//
// Body aceito (todos opcionais, pelo menos um obrigatório):
//   { razao_social, inscricao_municipal }
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { razao_social?: string; inscricao_municipal?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'JSON inválido' }, { status: 422 })
  }

  // Monta o patch dinâmico — só inclui campos efetivamente enviados.
  const patch: Record<string, string | null> = {}

  if (body.razao_social !== undefined) {
    const v = body.razao_social.trim()
    if (!v) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Razão social não pode ser vazia' },
        { status: 422 },
      )
    }
    patch.razao_social = v
  }

  if (body.inscricao_municipal !== undefined) {
    const v = body.inscricao_municipal.trim()
    // IM vazia = limpar campo (null no banco). 1-15 dígitos/caracteres
    // alfanuméricos é o range comum pra IM municipal.
    if (v && !/^[\dA-Za-z./-]{1,30}$/.test(v)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Inscrição Municipal inválida — use apenas dígitos, letras, ponto, barra ou hífen.',
        },
        { status: 422 },
      )
    }
    patch.inscricao_municipal = v || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Nenhum campo enviado pra atualização.' },
      { status: 422 },
    )
  }

  const nowISO = new Date().toISOString()

  // 1. Tenta atualizar em `empresas` (ME/EPP novo path) via user_id
  const { data: empUpdated, error: empErr } = await supabase
    .from('empresas')
    .update({ ...patch, updated_at: nowISO })
    .eq('user_id', user.id)
    .select('id')

  if (empErr) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: empErr.message },
      { status: 500 },
    )
  }

  // 2. Tenta atualizar em `meis` (MEI legacy ARCH-03) onde id = auth.uid
  //    Mesmo se #1 já atualizou (caso de MEI com mirror), atualizamos
  //    o `meis` pro dashboard MEI ler. razao_social vai pros 2; IM só
  //    faz sentido no empresas (meis não tem essa coluna no schema).
  const meiPatch: Record<string, string | null> = {}
  if (patch.razao_social !== undefined) meiPatch.razao_social = patch.razao_social
  meiPatch.updated_at = nowISO

  if (Object.keys(meiPatch).length > 1) { // > 1 porque updated_at sempre
    await supabase.from('meis').update(meiPatch).eq('id', user.id)
    // não falha se nada bater — caso ME/EPP puro sem meis mirror
  }

  return NextResponse.json({
    ok: true,
    updated: Object.keys(patch),
    empresas_updated: (empUpdated ?? []).length,
  })
}
