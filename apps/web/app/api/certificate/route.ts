import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

// TODO(production): Use the MEI's actual API key retrieved securely.
// For dev/sandbox this uses INTERNAL_API_SECRET.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Forward the multipart form data directly to the backend
  const formData = await request.formData()

  const apiKey = process.env.INTERNAL_API_SECRET ?? 'sk_test_sandbox_demo'

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_BASE}/v1/auth/certificate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })
  } catch (err) {
    console.error('[api/certificate] backend unreachable', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Serviço temporariamente indisponível' },
      { status: 503 },
    )
  }

  const data = await backendRes.json().catch(() => ({}))
  return NextResponse.json(data, { status: backendRes.status })
}
