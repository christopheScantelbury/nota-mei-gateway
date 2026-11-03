import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, canWrite, getAdminContext } from '@/lib/admin/permissions'
import KnowledgeEditor, { type Entrada } from './KnowledgeEditor'

export const metadata = { title: 'Base de conhecimento da IA' }
export const dynamic = 'force-dynamic'

export default async function ConhecimentoPage() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/suporte')) redirect('/admin')

  const admin = createAdminClient()
  const { data } = await admin
    .from('support_knowledge')
    .select('id, titulo, conteudo, categoria, ativo, ordem, updated_at')
    .order('ativo', { ascending: false })
    .order('ordem', { ascending: true })
    .returns<Entrada[]>()

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link href="/admin/suporte" className="text-sm text-text-2 hover:text-text-1">← Chamados</Link>
      <h1 className="font-display text-3xl font-extrabold mt-2 mb-1">Base de conhecimento da IA</h1>
      <p className="text-text-2 text-sm mb-6">
        O que o atendente virtual sabe sobre o estado atual do NotaFácil: correções publicadas, instabilidades,
        limitações e procedimentos. As entradas ativas entram na próxima resposta da IA — sem deploy.
        <strong className="text-text-1"> Atualize a cada correção, deploy ou incidente.</strong>
      </p>
      <KnowledgeEditor entradas={data ?? []} podeEscrever={canWrite(ctx, '/admin/suporte')} />
    </div>
  )
}
