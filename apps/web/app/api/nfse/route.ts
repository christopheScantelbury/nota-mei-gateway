import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

// TODO(production): This endpoint should resolve the MEI's actual API key from a secure vault.
// For now it uses INTERNAL_API_SECRET (defaults to sandbox demo key for development).
// In production, store an encrypted copy of the raw key or use a service-account approach.

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

  const apiKey = process.env.INTERNAL_API_SECRET ?? 'sk_test_sandbox_demo'

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_BASE}/v1/nfse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
