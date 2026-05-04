import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })
  }

  // Proxy the cancellation to the Go API which handles Receita Federal comms.
  const apiRes = await fetch(`${API_BASE}/v1/nfse/${params.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!apiRes.ok) {
    const body = await apiRes.json().catch(() => ({}))
    return NextResponse.json(
      { message: body?.message ?? 'Falha ao cancelar nota na Receita Federal' },
      { status: apiRes.status }
    )
  }

  return NextResponse.json({ ok: true })
}
