import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/notas/:id/status
 * Lightweight endpoint for the polling hook — returns only the current status.
 * Enforces RLS: user can only query their own notes.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS on notas_fiscais isolates by empresa_id (empresa_id IN empresas WHERE
  // user_id = auth.uid()). Filtering by mei_id here would miss notas emitted via
  // the unified DPS/ME path (mei_id NULL, empresa_id set) — so rely on RLS only.
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('status')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ status: data.status })
}
