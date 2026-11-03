import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, canWrite, getAdminContext } from '@/lib/admin/permissions'
import { Badge } from '@/components/ui/Badge'
import { carregarMensagens } from '@/lib/suporte/server'
import { PRIORIDADE_LABEL, STATUS_LABEL, type SupportTicket } from '@/lib/suporte/types'
import { prioridadeVariant, statusVariant } from '../ui'
import TicketView from './TicketView'

export const metadata = { title: 'Chamado' }
export const dynamic = 'force-dynamic'

interface EmpresaInfo {
  razao_social: string
  cnpj: string
  tipo: string
  regime_tributario: string | null
  cert_valid_until: string | null
  utm_source: string | null
  created_at: string
}

export default async function ChamadoPage({ params }: { params: { id: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/suporte')) redirect('/admin')

  const admin = createAdminClient()
  const { data: t } = await admin
    .from('support_tickets')
    .select('id, empresa_id, user_id, status, prioridade, assunto, resumo, motivo_escalada, assumido_por, ai_input_tokens, ai_output_tokens, ai_cache_read_tokens, ai_custo_usd, ultima_mensagem_em, ultima_mensagem_autor, resolvido_em, created_at')
    .eq('id', params.id)
    .maybeSingle<SupportTicket>()
  if (!t) notFound()

  const [mensagens, empresaRes, clienteRes, planoRes] = await Promise.all([
    carregarMensagens(admin, t.id, { incluirInterno: true }),
    t.empresa_id
      ? admin.from('empresas').select('razao_social, cnpj, tipo, regime_tributario, cert_valid_until, utm_source, created_at').eq('id', t.empresa_id).maybeSingle<EmpresaInfo>()
      : Promise.resolve({ data: null }),
    admin.auth.admin.getUserById(t.user_id),
    t.empresa_id
      ? admin
          .from('emissoes_mensais')
          .select('competencia, total_emitidas, stripe_subscription_status, planos(nome, emissoes_limite)')
          .eq('empresa_id', t.empresa_id)
          .order('competencia', { ascending: false })
          .limit(1)
          .maybeSingle<{ competencia: string; total_emitidas: number; stripe_subscription_status: string | null; planos: { nome: string; emissoes_limite: number } | null }>()
      : Promise.resolve({ data: null }),
  ])
  const empresa = empresaRes.data
  const plano = planoRes.data
  const clienteEmail = clienteRes.data?.user?.email ?? null

  const podeEscrever = canWrite(ctx, '/admin/suporte')

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <Link href="/admin/suporte" className="text-sm text-text-2 hover:text-text-1">← Chamados</Link>
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-6">
        <h1 className="font-display text-2xl font-extrabold mr-2">{t.assunto ?? 'Chamado'}</h1>
        <Badge variant={statusVariant(t.status)}>{STATUS_LABEL[t.status]}</Badge>
        <Badge variant={prioridadeVariant(t.prioridade)}>{PRIORIDADE_LABEL[t.prioridade]}</Badge>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <TicketView
          ticketId={t.id}
          status={t.status}
          prioridade={t.prioridade}
          assumidoPorMim={t.assumido_por === user.id}
          podeEscrever={podeEscrever}
          mensagens={mensagens.map(({ id, autor, conteudo, anexo_url, created_at, metadata }) => ({
            id, autor, conteudo, anexo_url: anexo_url ?? null, created_at,
            ferramentas: Array.isArray(metadata?.ferramentas) ? (metadata!.ferramentas as string[]) : [],
          }))}
        />

        <aside className="space-y-4">
          {(t.motivo_escalada || t.resumo) && (
            <div className="rounded-xl border border-nota-processando/30 bg-nota-processando/10 p-4 text-sm">
              <p className="font-semibold mb-1">Por que veio para humano</p>
              {t.motivo_escalada && <p className="text-text-1 mb-2">{t.motivo_escalada}</p>}
              {t.resumo && <p className="text-text-2 whitespace-pre-wrap">{t.resumo}</p>}
            </div>
          )}

          <div className="rounded-xl border border-navy-600 bg-navy-700 p-4 text-sm space-y-1">
            <p className="font-semibold mb-2">Cliente</p>
            <p>{empresa?.razao_social ?? 'Sem empresa (conta de desenvolvedor?)'}</p>
            {empresa && <p className="text-text-2">{empresa.tipo} · CNPJ {empresa.cnpj} · {empresa.regime_tributario ?? '—'}</p>}
            <p className="text-text-2 break-all">{clienteEmail ?? t.user_id}</p>
            {empresa && (
              <>
                <p className="text-text-2">
                  Certificado: {empresa.cert_valid_until ? `válido até ${new Date(empresa.cert_valid_until).toLocaleDateString('pt-BR')}` : 'não enviado'}
                </p>
                <p className="text-text-2">Origem: {empresa.utm_source ?? 'direto/desconhecida'} · desde {new Date(empresa.created_at).toLocaleDateString('pt-BR')}</p>
              </>
            )}
            {plano && (
              <p className="text-text-2">
                Plano ({plano.competencia}): {plano.planos?.nome ?? '—'} · {plano.total_emitidas}/{plano.planos?.emissoes_limite ?? '?'} notas · assinatura {plano.stripe_subscription_status ?? 'sem pagamento'}
              </p>
            )}
            {t.empresa_id && (
              <Link href={`/admin/notas?q=${encodeURIComponent(empresa?.cnpj ?? '')}`} className="inline-block mt-2 text-brand-cyan hover:underline">
                Ver notas desta empresa →
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-navy-600 bg-navy-700 p-4 text-xs text-text-2 space-y-1">
            <p className="font-semibold text-sm text-text-1 mb-2">Uso de IA</p>
            <p>Tokens: {t.ai_input_tokens.toLocaleString('pt-BR')} entrada · {t.ai_output_tokens.toLocaleString('pt-BR')} saída · {t.ai_cache_read_tokens.toLocaleString('pt-BR')} cache</p>
            <p>Custo estimado: US$ {Number(t.ai_custo_usd).toFixed(4)}</p>
            <p>Aberto em {new Date(t.created_at).toLocaleString('pt-BR')}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
