import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import NotaStatusPoller from '@/components/dashboard/NotaStatusPoller'
import NotaTimeline from '@/components/dashboard/NotaTimeline'
import CancelarNotaButton from '@/components/dashboard/CancelarNotaButton'
import WebhookDeliveryLog from '@/components/dashboard/WebhookDeliveryLog'
import EnviarNotaEmail from '@/components/dashboard/EnviarNotaEmail'
import ISSBadge from '@/components/nota/ISSBadge'
import SubstituicaoDeadline from '@/components/nota/SubstituicaoDeadline'
import ISSRecolhimentoCard from '@/components/nota/ISSRecolhimentoCard'
import { AcoesDaNota } from './components/AcoesDaNota'
import type { Nota } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

function formatBRL(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDateFull(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'medium',
  }).format(new Date(iso))
}

export default async function NotaDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { acao?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Determine if ME/EPP or MEI
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, tipo')
    .eq('id', user.id)
    .single()

  // ME/EPP notes are linked by empresa_id; MEI notes by mei_id
  let notaQuery = supabase.from('notas_fiscais').select('*').eq('id', params.id)
  if (empresa) {
    notaQuery = notaQuery.eq('empresa_id', empresa.id)
  } else {
    notaQuery = notaQuery.eq('mei_id', user.id)
  }

  const { data: nota } = await notaQuery.single<Nota>()

  if (!nota) notFound()

  const empresaTipo = empresa?.tipo ?? 'MEI'

  // For ME/EPP, cancellation is handled by AcoesDaNota modal
  const canCancel = nota.status === 'AUTORIZADA' && empresaTipo === 'MEI'
  const hasXML    = nota.status === 'AUTORIZADA' || nota.status === 'CANCELADA'
  const hasPDF    = nota.status === 'AUTORIZADA'
  const abrirModal = (searchParams.acao === 'cancelar' || searchParams.acao === 'substituir')
    ? (searchParams.acao as 'cancelar' | 'substituir')
    : undefined

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      <Link
        href="/notas"
        className="text-sm text-text-2 hover:text-brand-cyan transition mb-6 inline-block"
      >
        ← Voltar para lista
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            Nota #{nota.numero_rps}
          </h1>
          {nota.numero_nfse && (
            <p className="text-text-2 mt-1 text-sm">
              NFS-e nº{' '}
              <span className="font-mono text-text-1">{nota.numero_nfse}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={nota.status} />
          <NotaStatusPoller notaId={nota.id} status={nota.status} />
          {/* ME-42: ISS recolhimento badge */}
          <ISSBadge regime={nota.regime_tributario} issRetido={nota.iss_retido} />
          {/* ME-43: substitution deadline countdown */}
          <SubstituicaoDeadline
            status={nota.status}
            emitidaEm={nota.emitida_em}
            regime={nota.regime_tributario}
          />
        </div>
      </div>

      {/* Error banner */}
      {(nota.status === 'REJEITADA' || nota.status === 'ERRO_TEMPORARIO') &&
        nota.erro_descricao && (
          <div className="mb-6 rounded-lg border border-nota-rejeitada/30 bg-nota-rejeitada/5 p-4">
            <p className="text-sm font-semibold text-nota-rejeitada mb-1">
              {nota.erro_codigo ? `Erro ${nota.erro_codigo}` : 'Rejeitada'}
            </p>
            <p className="text-sm text-text-2">{nota.erro_descricao}</p>
          </div>
        )}

      {/* ME-42: ISS recolhimento card — aparece para notas autorizadas */}
      {nota.status === 'AUTORIZADA' && (
        <div className="mb-6">
          <ISSRecolhimentoCard
            regime={nota.regime_tributario}
            issRetido={nota.iss_retido}
            competencia={nota.competencia}
          />
        </div>
      )}

      {/* Event timeline */}
      <NotaTimeline nota={nota} />

      {/* Details grid */}
      <div className="rounded-xl border border-navy-600 overflow-hidden mb-6">
        <div className="bg-navy-700 px-5 py-3 border-b border-navy-600">
          <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
            Detalhes da nota
          </h2>
        </div>
        <dl className="divide-y divide-navy-600">
          {[
            { label: 'ID',               value: <span className="font-mono text-xs">{nota.id}</span> },
            { label: 'Tomador',          value: nota.tomador_nome ?? '—' },
            { label: 'CPF/CNPJ tomador', value: nota.tomador_doc ?? '—' },
            { label: 'Valor do serviço', value: formatBRL(nota.valor_servico) },
            { label: 'Competência',      value: nota.competencia ?? '—' },
            {
              label: 'Protocolo Receita',
              value: nota.protocolo_receita ?? (
                <span className="text-text-2">Aguardando...</span>
              ),
            },
            { label: 'Código verificação', value: nota.codigo_verificacao ?? '—' },
            { label: 'Criada em',          value: formatDateFull(nota.created_at) },
            { label: 'Emitida em',         value: formatDateFull(nota.emitida_em) },
            { label: 'Cancelada em',       value: formatDateFull(nota.cancelada_em) },
          ]
            .filter(({ value }) => value !== '—')
            .map(({ label, value }) => (
              <div key={label} className="flex px-5 py-3 gap-4">
                <dt className="w-44 shrink-0 text-sm text-text-2">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
        </dl>
      </div>

      {/* Webhook delivery log */}
      {nota.webhook_url && (
        <WebhookDeliveryLog
          notaId={nota.id}
          webhookUrl={nota.webhook_url}
          entregue={nota.webhook_entregue}
          tentativas={nota.webhook_tentativas}
        />
      )}

      {/* ME/EPP actions (cancel / substitute with deadline display) */}
      <AcoesDaNota
        nota={{
          id: nota.id,
          numero_rps: nota.numero_rps,
          status: nota.status,
          emitida_em: nota.emitida_em,
          tomador_tipo: (nota as any).tomador_tipo,
        }}
        empresaTipo={empresaTipo}
        abrirModal={abrirModal}
      />

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {hasXML && (
          <a
            href={`${API_BASE}/v1/nfse/${nota.id}/xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan transition"
          >
            ⬇ Download XML
          </a>
        )}
        {hasPDF && (
          <a
            href={`${API_BASE}/v1/nfse/${nota.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan transition"
          >
            ⬇ Download PDF
          </a>
        )}
        {hasPDF && (
          <EnviarNotaEmail
            notaId={nota.id}
            defaultEmail={nota.tomador_doc ? '' : ''}
          />
        )}
        {canCancel && (
          <CancelarNotaButton
            notaId={nota.id}
            numeroRps={nota.numero_rps}
          />
        )}
      </div>
    </div>
  )
}
