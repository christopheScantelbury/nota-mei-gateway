import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })

  const res = await fetch(`${API_BASE}/v1/recorrencias/${params.id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}

export async function PUT(req: Request, { params }: Ctx) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })

  const payload = await req.json()
  const res = await fetch(`${API_BASE}/v1/recorrencias/${params.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })

  const res = await fetch(`${API_BASE}/v1/recorrencias/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.status })
}
