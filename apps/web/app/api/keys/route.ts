import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST /api/keys — create a new API key
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { label?: string; env?: 'live' | 'test' }
  try { body = await request.json() } catch { body = {} }

  const env     = body.env === 'test' ? 'test' : 'live'
  const rawHex  = randomHex(32)
  const rawKey  = `sk_${env}_${rawHex}`
  const prefix  = `sk_${env}_`
  const hash    = await sha256Hex(rawKey)

  const { error } = await supabase
    .from('api_keys')
    .insert({
      mei_id:     session.user.id,
      key_hash:   hash,
      key_prefix: prefix,
      label:      body.label?.trim() || null,
    })

  if (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ key: rawKey, prefix }, { status: 201 })
}

// DELETE /api/keys?id=<keyId> — revoke a key
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'id obrigatório' }, { status: 422 })

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('mei_id', session.user.id)

  if (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
