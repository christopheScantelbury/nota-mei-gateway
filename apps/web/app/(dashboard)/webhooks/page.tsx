export const metadata = { title: 'Webhooks' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WebhooksConfig from '@/components/dashboard/WebhooksConfig'
import PlanGate from '@/components/dashboard/PlanGate'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Webhooks são feature de integração (produto Gateway/ME). MEI usa o
  // dashboard sem integração externa — bloqueia acesso direto via URL.
  //
  // Detecção robusta: checa as duas tabelas em paralelo (ver comentário em
  // /api-keys/page.tsx). RLS pode bloquear a query empresas, então meis
  // serve como fallback confiável pra MEI legacy.
  const [{ data: meiRow }, { data: empresaRow }] = await Promise.all([
    supabase.from('meis').select('id').eq('id', user.id).maybeSingle<{ id: string }>(),
    supabase.from('empresas').select('tipo').eq('user_id', user.id).maybeSingle<{ tipo: 'MEI' | 'ME' | 'EPP' }>(),
  ])
  if (meiRow || empresaRow?.tipo === 'MEI') redirect('/home')

  // Fetch plan info for gate — RLS enforces isolation for both MEI and ME/EPP
  const { data: usage } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planName = usage?.planos?.nome ?? 'Trial'

  const { data: rows } = await supabase
    .from('notas_fiscais')
    .select('id, tomador_nome, valor_servico, webhook_url, webhook_entregue, webhook_tentativas, status, created_at, emitida_em')
    .not('webhook_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<WebhookRow[]>()

  return (
    <PlanGate
      planName={planName}
      feature="webhooks"
      icon="🔗"
      title="Webhooks disponíveis a partir do Starter"
      description="Receba notificações em tempo real no seu sistema quando uma nota for autorizada, rejeitada ou cancelada."
      requiredPlan="Starter"
    >
      <div className="p-4 sm:p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-text-1">Webhooks</h1>
          <p className="text-text-2 mt-1 text-sm">
            Configure e monitore a entrega de eventos para seu endpoint.
          </p>
        </div>
        <WebhooksConfig deliveries={rows ?? []} />
      </div>
    </PlanGate>
  )
}
