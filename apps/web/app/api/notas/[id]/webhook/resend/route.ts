import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })

  // Verify ownership before resending
  const { data: nota } = await supabase
    .from('notas_fiscais')
    .select('id, webhook_url, webhook_entregue, webhook_tentativas')
    .eq('id', params.id)
    .eq('mei_id', session.user.id)
    .single()

  if (!nota) return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
  if (!nota.webhook_url) return NextResponse.json({ message: 'Nota sem webhook configurado' }, { status: 400 })
  if (nota.webhook_entregue) return NextResponse.json({ message: 'Webhook já entregue' }, { status: 409 })

  // Reset entregue flag and increment tentativas so the worker picks it up
  const { error } = await supabase
    .from('notas_fiscais')
    .update({
      webhook_entregue:   false,
      webhook_tentativas: (nota.webhook_tentativas ?? 0) + 1,
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ message: 'Erro ao agendar reenvio' }, { status: 500 })
  }

  // Return updated counters
  return NextResponse.json({
    entregue:   false,
    tentativas: (nota.webhook_tentativas ?? 0) + 1,
  })
}
