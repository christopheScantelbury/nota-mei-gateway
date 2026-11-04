// POST /api/interno/email — relay de e-mail usado SÓ pela API Go como último
// fallback (o Railway bloqueia SMTP de saída; a API HTTP do Brevo pode recusar
// por bloqueio de IP). Entrega pelo SMTP do Brevo a partir do Vercel.
//
// Auth: Authorization: Bearer <EMAIL_RELAY_SECRET> (mesmo valor no Railway).
// O remetente é fixo (EMAIL_FROM) — o relay não aceita "from" de fora.
import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { enviarSmtp } from '@/lib/email/smtp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.EMAIL_RELAY_SECRET
  if (!segredo) return false // sem segredo configurado o relay fica fechado
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${segredo}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { to?: unknown; subject?: unknown; html?: unknown }
  try { body = await req.json() } catch { body = {} }
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const subject = typeof body.subject === 'string' ? body.subject.slice(0, 300) : ''
  const html = typeof body.html === 'string' ? body.html : ''
  if (!EMAIL_RE.test(to) || !subject || !html || html.length > 1_000_000) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const host = process.env.SMTP_HOST ?? 'smtp-relay.brevo.com'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) {
    return NextResponse.json({ error: 'SMTP_NAO_CONFIGURADO' }, { status: 503 })
  }
  const from = process.env.EMAIL_FROM ?? 'NotaFácil <noreply@emitirnotafacil.com.br>'

  try {
    const messageId = await enviarSmtp(
      { host, port: Number(process.env.SMTP_PORT ?? 587), user, pass },
      { from, to, subject, html },
    )
    return NextResponse.json({ ok: true, message_id: messageId })
  } catch (e) {
    const msg = (e as Error).message.replace(/AUTH PLAIN \S+/g, 'AUTH PLAIN ***')
    console.error('[email-relay] falha SMTP:', msg)
    return NextResponse.json({ error: 'SMTP_FALHOU', message: msg.slice(0, 300) }, { status: 502 })
  }
}
