export const metadata = { title: 'API Keys' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import APIKeysManager from '@/components/dashboard/APIKeysManager'

export type APIKey = {
  id: string
  key_prefix: string
  label: string | null
  created_at: string
  revoked_at: string | null
}

export default async function APIKeysPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, key_prefix, label, created_at, revoked_at')
    .eq('mei_id', session.user.id)
    .order('created_at', { ascending: false })
    .returns<APIKey[]>()

  // Fetch plan limits from emissoes_mensais + planos
  const { data: usage } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome, emissoes_limite)')
    .eq('mei_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ planos: { nome: string; emissoes_limite: number } | null }>()

  const planName = usage?.planos?.nome ?? 'Trial'
  const maxKeys  = planName === 'Trial' ? 2 : planName === 'Starter' ? 5 : 10

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-text-1">API Keys</h1>
        <p className="text-text-2 mt-1 text-sm">
          Gerencie suas chaves de acesso à API. Nunca compartilhe chaves de produção.
        </p>
      </div>
      <APIKeysManager
        initialKeys={keys ?? []}
        planName={planName}
        maxKeys={maxKeys}
      />
    </div>
  )
}
