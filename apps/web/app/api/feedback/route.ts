/**
 * POST /api/feedback — registra feedback do cliente (#247).
 *
 * Aceita JSON: { tipo, mensagem, url?, screenshotDataUrl? }
 * - screenshotDataUrl: data: URL base64 (jpeg/png/webp), max 3MB
 *
 * Resolve user_id da sessão Supabase + empresa_id da empresa ativa.
 * Salva screenshot no bucket feedback-screenshots se presente.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_TIPOS = ['bug', 'sugestao', 'duvida', 'elogio'] as const
const MAX_MSG = 2000
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024

export async function POST(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: {
    tipo?: string
    mensagem?: string
    url?: string
    screenshotDataUrl?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const tipo = body.tipo as typeof VALID_TIPOS[number]
  if (!VALID_TIPOS.includes(tipo)) {
    return NextResponse.json(
      { error: 'VALIDATION', message: 'tipo inválido (bug/sugestao/duvida/elogio)' },
      { status: 422 },
    )
  }
  const mensagem = (body.mensagem ?? '').trim()
  if (mensagem.length < 5 || mensagem.length > MAX_MSG) {
    return NextResponse.json(
      { error: 'VALIDATION', message: `Mensagem entre 5 e ${MAX_MSG} caracteres` },
      { status: 422 },
    )
  }

  // Resolve empresa_id (best-effort).
  let empresaId: string | null = null
  const { data: empresa } = await sb
    .from('empresas')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle<{ id: string }>()
  if (empresa) empresaId = empresa.id

  // Headers
  const url = body.url ?? request.headers.get('referer') ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  // Upload screenshot (best-effort)
  let screenshotUrl: string | null = null
  if (body.screenshotDataUrl?.startsWith('data:image/')) {
    const match = body.screenshotDataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/)
    if (match) {
      const mimeType = match[1]
      const base64 = match[2]
      const buf = Buffer.from(base64, 'base64')
      if (buf.length <= MAX_SCREENSHOT_BYTES) {
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
        const fname = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await sb.storage
          .from('feedback-screenshots')
          .upload(fname, buf, { contentType: mimeType, cacheControl: '3600' })
        if (!upErr) {
          const { data: pub } = sb.storage.from('feedback-screenshots').getPublicUrl(fname)
          screenshotUrl = pub.publicUrl
        }
      }
    }
  }

  // Insert
  const { data, error } = await sb
    .from('customer_feedback')
    .insert({
      user_id: user.id,
      empresa_id: empresaId,
      tipo,
      mensagem,
      url,
      user_agent: userAgent,
      screenshot_url: screenshotUrl,
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at })
}
