import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Generate a hex string of `bytes` random bytes
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

  let body: { label?: string }
  try { body = await request.json() } catch { body = {} }

  const rawHex  = randomHex(32)            // 64 hex chars
  const rawKey  = `sk_live_${rawHex}`      // 72 chars total
  const prefix  = rawKey.slice(0, 15)      // "sk_live_" + 7 chars
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

  // Return the raw key ONE TIME — never stored again
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
    .eq('mei_id', session.user.id) // tenant isolation

  if (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
