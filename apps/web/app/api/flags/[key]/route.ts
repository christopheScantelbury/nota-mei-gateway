import { NextResponse, type NextRequest } from 'next/server'
import { getVariant } from '@/lib/flags'
import { randomUUID } from 'crypto'

// GET /api/flags/{key}
//
// Resolve a variante do feature flag pra sessão do usuário.
// SessionId vem do cookie nf_session_id (criado aqui se ausente, 1 ano).
//
// Fail-safe: retorna 'control' em qualquer erro.

export const dynamic = 'force-dynamic'

const SESSION_COOKIE = 'nf_session_id'

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  const existing = req.cookies.get(SESSION_COOKIE)?.value
  const sessionId = existing ?? randomUUID()

  const variant = await getVariant(params.key, sessionId)

  const res = NextResponse.json({ variant, sessionId })
  if (!existing) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false, // hook client lê via document.cookie
      path: '/',
    })
  }
  return res
}
