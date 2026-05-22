import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// Proxies GET /v1/nfse/:id/xml forwarding the user's Supabase JWT. Follows any
// presigned-URL redirect server-side and re-serves the XML with an attachment
// disposition, so the browser DOWNLOADS the file instead of opening it as text.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // redirect: 'follow' (default) — if the backend 3xx-redirects to a presigned
  // S3 URL, we fetch the actual XML bytes here and stream them back.
  const backendRes = await fetch(`${API_BASE}/v1/nfse/${params.id}/xml`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

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
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="nfse-${params.id}.xml"`,
    },
  })
}
