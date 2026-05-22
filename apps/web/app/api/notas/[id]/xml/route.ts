import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// Proxies GET /v1/nfse/:id/xml forwarding the user's Supabase JWT. The backend
// either 3xx-redirects to a presigned S3 URL (no auth needed once there) or
// streams the XML text directly. We can't link the browser straight at the API
// because <a href> navigations carry no auth header.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const backendRes = await fetch(`${API_BASE}/v1/nfse/${params.id}/xml`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    redirect: 'manual',
  })

  if (backendRes.status >= 300 && backendRes.status < 400) {
    const location = backendRes.headers.get('location')
    if (location) return NextResponse.redirect(location)
  }

  if (!backendRes.ok) {
    const body = await backendRes.json().catch(() => ({}))
    return NextResponse.json(
      { message: (body as { message?: string }).message ?? 'Falha ao obter XML' },
      { status: backendRes.status },
    )
  }

  const buf = await backendRes.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': backendRes.headers.get('content-type') ?? 'application/xml; charset=utf-8',
      'Content-Disposition':
        backendRes.headers.get('content-disposition') ?? `attachment; filename="nfse-${params.id}.xml"`,
    },
  })
}
