import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { razao_social?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'JSON inválido' }, { status: 422 })
  }

  if (!body.razao_social?.trim()) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Razão social é obrigatória' }, { status: 422 })
  }

  const { error } = await supabase
    .from('meis')
    .update({ razao_social: body.razao_social.trim(), updated_at: new Date().toISOString() })
    .eq('id', session.user.id)

  if (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
