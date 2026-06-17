import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'
import PlanosClient from './PlanosClient'

export const metadata = { title: 'Planos' }

export interface PlanoRow {
  id: string
  nome: string
  tipo_empresa: string | null
  emissoes_limite: number
  preco_mensal_brl: number | null
  preco_excedente_brl: number | null
  descricao_curta: string | null
  destaque: boolean
  ordem_exibicao: number
  ativo: boolean
  stripe_price_id: string | null
  stripe_product_id: string | null
  stripe_sync_at: string | null
  stripe_sync_error: string | null
}

export default async function PlanosPage() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/planos')) redirect('/admin')

  const admin = createAdminClient()
  const { data: planos } = await admin
    .from('planos')
    .select('*')
    .order('tipo_empresa', { ascending: true })
    .order('ordem_exibicao', { ascending: true })
    .returns<PlanoRow[]>()

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Planos</h1>
      <p className="text-text-2 text-sm mb-6">
        Catálogo sincronizado com Stripe. Mudança de preço cria novo price +
        migra assinaturas ativas.
      </p>

      <PlanosClient
        initialPlanos={planos ?? []}
        canWrite={ctx.isSuperAdmin || (ctx.grants.get('/admin/planos')?.canWrite ?? false)}
      />
    </div>
  )
}
