import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

/**
 * Dashboard certificate-upload proxy.
 *
 * Authentication: the Go backend's /v1/auth/certificate endpoint accepts BOTH
 * `sk_…` API keys (B2B) and Supabase JWTs (dashboard) via the hybrid auth
 * middleware. We forward the user's session access_token so the user does not
 * need to know or paste their API key.
 *
 * Body: multipart/form-data with `certificado` and `senha_certificado` fields.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Forward the multipart form data exactly as received so field names
  // stay in sync with the backend (`certificado` + `senha_certificado`).
  const formData = await request.formData()

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_BASE}/v1/auth/certificate`, {
      method: 'POST',
      headers: {
        // The hybrid middleware on the Go side detects this is a JWT (no `sk_`
        // prefix) and resolves the empresa/MEI from auth.users(id).
        Authorization: `Bearer ${session.access_token}`,
      },
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
