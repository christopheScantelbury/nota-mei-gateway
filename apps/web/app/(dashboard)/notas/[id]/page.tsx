import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import NotaStatusPoller from '@/components/dashboard/NotaStatusPoller'
import NotaTimeline from '@/components/dashboard/NotaTimeline'
import CancelarNotaButton from '@/components/dashboard/CancelarNotaButton'
import type { Nota } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

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

export default async function NotaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/')

  const { data: nota } = await supabase
    .from('notas_fiscais')
    .select('*')
    .eq('id', params.id)
    .eq('mei_id', session.user.id)
    .single<Nota>()

  if (!nota) notFound()

  const canCancel = nota.status === 'AUTORIZADA'
  const hasXML    = nota.status === 'AUTORIZADA' || nota.status === 'CANCELADA'
  const hasPDF    = nota.status === 'AUTORIZADA'

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
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={nota.status} />
          <NotaStatusPoller notaId={nota.id} status={nota.status} />
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

      {/* Webhook info */}
      {nota.webhook_url && (
        <div className="rounded-xl border border-navy-600 overflow-hidden mb-6">
          <div className="bg-navy-700 px-5 py-3 border-b border-navy-600">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
              Webhook
            </h2>
          </div>
          <dl className="divide-y divide-navy-600">
            <div className="flex px-5 py-3 gap-4">
              <dt className="w-44 shrink-0 text-sm text-text-2">URL</dt>
              <dd className="text-sm font-mono truncate">{nota.webhook_url}</dd>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <dt className="w-44 shrink-0 text-sm text-text-2">Entregue</dt>
              <dd className="text-sm">
                {nota.webhook_entregue ? (
                  <span className="text-nota-autorizada">✓ Sim</span>
                ) : (
                  <span className="text-nota-processando">
                    Pendente ({nota.webhook_tentativas} tentativa
                    {nota.webhook_tentativas !== 1 ? 's' : ''})
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

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
