import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasFeature } from '@/lib/plans'
import { formatBRL, formatCNPJ, formatCPF } from '@/lib/format'
import ClienteDetailActions from '@/components/dashboard/ClienteDetailActions'
import type { Cliente } from '@/lib/types-cliente'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

interface NotaSummary {
  id: string
  numero_rps: number
  numero_nfse: string | null
  status: string
  valor_servico: number | null
  competencia: string | null
  emitida_em: string | null
  created_at: string
}

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Cliente>()

  if (!cliente) notFound()

  const { data: notas } = await supabase
    .from('notas_fiscais')
    .select('id, numero_rps, numero_nfse, status, valor_servico, competencia, emitida_em, created_at')
    .eq('cliente_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<NotaSummary[]>()

  // Plano (pra mostrar/esconder botões de edição)
  const competencia = new Date().toISOString().slice(0, 7)
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', competencia)
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planName = emissao?.planos?.nome ?? 'Trial'
  const canCrud  = hasFeature(planName, 'clientesCrud')
  const documento = cliente.tipo === 'PJ' ? formatCNPJ(cliente.documento) : formatCPF(cliente.documento)

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Back */}
      <Link
        href="/clientes"
        className="text-sm text-text-2 hover:text-brand-cyan transition mb-4 inline-block"
      >
        ← Voltar para clientes
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold truncate">{cliente.razao_social}</h1>
          {cliente.nome_fantasia && (
            <p className="text-text-2 mt-1">{cliente.nome_fantasia}</p>
          )}
          <p className="text-text-2 mt-1 font-mono text-sm">{documento}</p>
        </div>
        <ClienteDetailActions
          cliente={cliente}
          canCrud={canCrud}
        />
      </div>

      {/* Tags */}
      {cliente.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {cliente.tags.map((t) => (
            <span key={t} className="text-xs text-text-2 bg-navy-700 border border-navy-600 rounded-full px-3 py-1">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-navy-600 bg-navy-700 px-4 py-3">
          <p className="text-xs text-text-2 uppercase tracking-wider">Total faturado</p>
          <p className="font-mono text-lg font-semibold mt-1">{formatBRL(cliente.total_emitido_brl)}</p>
        </div>
        <div className="rounded-xl border border-navy-600 bg-navy-700 px-4 py-3">
          <p className="text-xs text-text-2 uppercase tracking-wider">Notas emitidas</p>
          <p className="font-mono text-lg font-semibold mt-1">{cliente.total_notas}</p>
        </div>
        <div className="rounded-xl border border-navy-600 bg-navy-700 px-4 py-3">
          <p className="text-xs text-text-2 uppercase tracking-wider">Primeira emissão</p>
          <p className="text-sm mt-1">{formatDate(cliente.primeira_emissao_em)}</p>
        </div>
        <div className="rounded-xl border border-navy-600 bg-navy-700 px-4 py-3">
          <p className="text-xs text-text-2 uppercase tracking-wider">Última emissão</p>
          <p className="text-sm mt-1">{formatDate(cliente.ultima_emissao_em)}</p>
        </div>
      </div>

      {/* Dados */}
      <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-4">Dados de contato</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <InfoRow label="E-mail"        value={cliente.email} />
          <InfoRow label="Telefone"      value={cliente.telefone} />
          <InfoRow label="Município IBGE" value={cliente.municipio_ibge} mono />
          <InfoRow label="UF"            value={cliente.uf} />
          <InfoRow label="CEP"           value={cliente.cep} />
          <InfoRow label="Bairro"        value={cliente.bairro} />
          <InfoRow label="Logradouro"    value={[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(', ') || null} />
          <InfoRow label="Inscrição Estadual"   value={cliente.inscricao_estadual} />
          <InfoRow label="Inscrição Municipal"  value={cliente.inscricao_municipal} />
        </dl>
      </section>

      {/* Observações (Pro+) */}
      {cliente.observacoes && (
        <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
          <h2 className="font-display font-bold text-lg mb-2">Observações</h2>
          <p className="text-sm text-text-2 whitespace-pre-wrap">{cliente.observacoes}</p>
        </section>
      )}

      {/* Histórico de notas */}
      <section className="rounded-xl border border-navy-600 bg-navy-700/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Histórico de notas</h2>
          {(notas?.length ?? 0) > 0 && (
            <Link href={`/notas?q=${cliente.documento}`} className="text-xs text-brand-cyan hover:underline">
              Ver todas →
            </Link>
          )}
        </div>

        {!notas?.length ? (
          <p className="text-sm text-text-2 text-center py-8">
            Nenhuma nota emitida ainda.{' '}
            <Link href={`/notas/nova?cliente=${cliente.id}`} className="text-brand-cyan hover:underline">
              Emitir primeira →
            </Link>
          </p>
        ) : (
          <div className="divide-y divide-navy-600">
            {notas.map((n) => (
              <Link
                key={n.id}
                href={`/notas/${n.id}`}
                className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-cyan transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono">#{n.numero_rps}{n.numero_nfse && ` · NFS-e ${n.numero_nfse}`}</p>
                  <p className="text-xs text-text-2">
                    {n.competencia ?? '—'} · {formatDate(n.emitida_em ?? n.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono">{formatBRL(n.valor_servico)}</p>
                  <p className="text-xs text-text-2">{n.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className={`text-sm ${mono ? 'font-mono' : ''} ${value ? 'text-text-1' : 'text-text-2 italic'}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}
