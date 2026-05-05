export const metadata = { title: 'Webhooks' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WebhooksConfig from '@/components/dashboard/WebhooksConfig'

type WebhookRow = {
  id: string
  tomador_nome: string | null
  valor_servico: number | null
  webhook_url: string | null
  webhook_entregue: boolean
  webhook_tentativas: number
  status: string
  created_at: string
  emitida_em: string | null
}

export default async function WebhooksPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: rows } = await supabase
    .from('notas_fiscais')
    .select('id, tomador_nome, valor_servico, webhook_url, webhook_entregue, webhook_tentativas, status, created_at, emitida_em')
    .eq('mei_id', session.user.id)
    .not('webhook_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<WebhookRow[]>()

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-text-1">Webhooks</h1>
        <p className="text-text-2 mt-1 text-sm">
          Configure e monitore a entrega de eventos para seu endpoint.
        </p>
      </div>
      <WebhooksConfig deliveries={rows ?? []} />
    </div>
  )
}
