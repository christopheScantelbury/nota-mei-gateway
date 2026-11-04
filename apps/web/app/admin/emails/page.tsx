import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'
import EmailsList, { type EmailRow } from './EmailsList'

export const metadata = { title: 'E-mails' }
export const dynamic = 'force-dynamic'

const FILTROS = ['problemas', 'enviado', 'todos'] as const
type Filtro = (typeof FILTROS)[number]

// Fila de e-mails da API (email_outbox). Destinatário/assunto/corpo ficam
// cifrados no banco — aqui só aparecem tipo, domínio, status e erro.
export default async function EmailsPage({ searchParams }: { searchParams: { f?: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/emails')) redirect('/admin')

  const filtro: Filtro = (FILTROS as readonly string[]).includes(searchParams.f ?? '')
    ? (searchParams.f as Filtro)
    : 'problemas'

  const admin = createAdminClient()
  let q = admin
    .from('email_outbox')
    .select('id, tipo, destino_dominio, status, tentativas, proxima_tentativa_em, ultimo_erro, provedor, nota_id, created_at, enviado_em')
    .order('created_at', { ascending: false })
    .limit(200)
  if (filtro === 'problemas') q = q.in('status', ['pendente', 'falhou'])
  if (filtro === 'enviado') q = q.eq('status', 'enviado')
  const { data } = await q.returns<EmailRow[]>()

  const desde = new Date(Date.now() - 7 * 864e5).toISOString()
  const contar = async (status: string) => {
    const { count } = await admin
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
      .gte('created_at', desde)
    return count ?? 0
  }
  const [enviados, pendentes, falhas] = await Promise.all([contar('enviado'), contar('pendente'), contar('falhou')])

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">E-mails</h1>
      <p className="text-text-2 text-sm mb-6">
        Todo e-mail da API passa por esta fila. Se o envio falha, ele é reenviado sozinho
        (1, 2, 4… até 60 min, 12 tentativas, primeiro pela API do Brevo e depois pelo SMTP).
        Os que esgotarem as tentativas ficam como <strong>falhou</strong> e podem ser reenviados aqui.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl">
        <Resumo label="Enviados (7 dias)" valor={enviados} cls="text-nota-autorizada" />
        <Resumo label="Na fila" valor={pendentes} cls="text-nota-processando" />
        <Resumo label="Falharam" valor={falhas} cls="text-nota-rejeitada" />
      </div>

      <EmailsList
        items={data ?? []}
        filtro={filtro}
        canWrite={ctx.isSuperAdmin || (ctx.grants.get('/admin/emails')?.canWrite ?? false)}
      />
    </div>
  )
}

function Resumo({ label, valor, cls }: { label: string; valor: number; cls: string }) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-700 p-4">
      <p className="text-xs text-text-2">{label}</p>
      <p className={`font-display text-2xl font-extrabold ${cls}`}>{valor}</p>
    </div>
  )
}
