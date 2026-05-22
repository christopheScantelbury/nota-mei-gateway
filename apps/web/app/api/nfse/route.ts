import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// The dashboard emits notas AS THE LOGGED-IN USER by forwarding their Supabase
// JWT to the backend. The /v1 group uses the hybrid middleware, which accepts
// either an sk_… API key (B2B) or a Supabase JWT (dashboard) and resolves the
// same MEI/empresa context. This guarantees the nota is persisted under the
// user's own empresa_id — NOT a shared/sandbox key (which returns simulated,
// non-persisted notas).

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sessão inválida' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'JSON inválido' }, { status: 422 })
  }

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_BASE}/v1/nfse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[api/nfse] backend unreachable', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Serviço temporariamente indisponível' },
      { status: 503 },
    )
  }

  const data = await backendRes.json()
  return NextResponse.json(data, { status: backendRes.status })
}
