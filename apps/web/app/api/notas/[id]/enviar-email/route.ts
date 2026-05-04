import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email) {
    return NextResponse.json({ message: 'E-mail obrigatório' }, { status: 400 })
  }

  // Verify ownership
  const { data: nota } = await supabase
    .from('notas_fiscais')
    .select('id, status')
    .eq('id', params.id)
    .eq('mei_id', session.user.id)
    .single()

  if (!nota) return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
  if (nota.status !== 'AUTORIZADA') {
    return NextResponse.json(
      { message: 'Apenas notas autorizadas podem ser enviadas por e-mail' },
      { status: 422 }
    )
  }

  // Delegate to the Go API which owns the email service
  const apiRes = await fetch(`${API_BASE}/v1/nfse/${params.id}/email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!apiRes.ok) {
    const apiBody = await apiRes.json().catch(() => ({}))
    return NextResponse.json(
      { message: apiBody?.message ?? 'Falha ao enviar e-mail' },
      { status: apiRes.status }
    )
  }

  return NextResponse.json({ ok: true })
}
