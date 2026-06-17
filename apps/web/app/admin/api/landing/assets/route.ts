/**
 * POST /admin/api/landing/assets — upload imagem pro Supabase Storage (#244).
 * Aceita multipart com max 5MB.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024  // 5MB

export async function POST(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const pageSlug = formData.get('pageSlug') as string | null
  const altText = (formData.get('altText') as string | null) ?? null
  const kind = (formData.get('kind') as string | null) ?? 'image'

  if (!file) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'INVALID_MIME', message: `Tipo ${file.type} não permitido` }, { status: 422 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'TOO_LARGE', message: 'Máximo 5MB' }, { status: 413 })
  }

  const admin = createAdminClient()

  // Resolve page_id se slug enviado
  let pageId: string | null = null
  if (pageSlug) {
    const { data: page } = await admin
      .from('landing_pages')
      .select('id')
      .eq('slug', pageSlug)
      .maybeSingle<{ id: string }>()
    if (page) pageId = page.id
  }

  // Upload pro bucket
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const storagePath = `${pageSlug ?? 'shared'}/${ts}-${rand}.${ext}`

  const buf = await file.arrayBuffer()
  const { error: upErr } = await admin.storage
    .from('landing-assets')
    .upload(storagePath, buf, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })
  if (upErr) {
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('landing-assets').getPublicUrl(storagePath)

  // Persist metadata
  const { data: asset, error: dbErr } = await admin
    .from('landing_assets')
    .insert({
      page_id: pageId,
      kind,
      storage_path: storagePath,
      public_url: pub.publicUrl,
      alt_text: altText,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select('*')
    .single()

  if (dbErr) {
    // tenta limpar arquivo órfão
    await admin.storage.from('landing-assets').remove([storagePath])
    return NextResponse.json({ error: 'DB_ERROR', message: dbErr.message }, { status: 500 })
  }

  await logAdminAction({
    action: 'landing_asset_upload',
    targetKind: 'landing_asset',
    targetId: asset.id,
    after: { storage_path: storagePath, size_bytes: file.size },
  })

  return NextResponse.json({ ok: true, asset })
}

export async function GET(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isAdmin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const url = new URL(request.url)
  const pageSlug = url.searchParams.get('pageSlug')

  const admin = createAdminClient()
  let query = admin
    .from('landing_assets')
    .select('id, page_id, kind, public_url, alt_text, width, height, size_bytes, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (pageSlug) {
    const { data: p } = await admin.from('landing_pages').select('id').eq('slug', pageSlug).maybeSingle<{ id: string }>()
    if (p) query = query.eq('page_id', p.id)
  }
  const { data } = await query
  return NextResponse.json({ assets: data ?? [] })
}
