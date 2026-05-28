'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import MoneyInput from '@/components/ui/MoneyInput'
import NBSServicoPicker from '@/components/nota/NBSServicoPicker'
import ClienteCombobox from '@/components/nota/ClienteCombobox'
import { CepMunicipioInput } from '@/components/ui/CepMunicipioInput'
import { maskCNPJ, maskCPF } from '@/lib/format'
import type { ClienteAutocomplete } from '@/lib/types-cliente'

interface Recorrencia {
  id:                     string
  nome:                   string
  ativo:                  boolean
  dia_vencimento:         number
  proxima_emissao:        string
  webhook_url?:           string | null
  servico:                unknown
  tomador:                unknown
  enviar_email_tomador?:  boolean
  email_tomador?:         string | null
}

interface Props {
  existing?: Recorrencia | null
  onClose:  () => void
  onSaved:  (rec: Recorrencia) => void
}

// Calcula a data default da próxima emissão (próximo dia X do mês corrente
// ou seguinte, conforme o dia já tenha passado).
function defaultProximaEmissao(dia: number): string {
  const now = new Date()
  const targetThisMonth = new Date(now.getFullYear(), now.getMonth(), dia)
  const target = targetThisMonth.getTime() > now.getTime()
    ? targetThisMonth
    : new Date(now.getFullYear(), now.getMonth() + 1, dia)
  return target.toISOString().slice(0, 10)
}

export default function RecorrenciaModal({ existing, onClose, onSaved }: Props) {
  const isEdit = !!existing

  // Identidade da automação
  const [nome, setNome] = useState(existing?.nome ?? '')

  // Recorrência
  const [dia, setDia]                       = useState(existing?.dia_vencimento ?? 5)
  const [proximaEmissao, setProximaEmissao] = useState(existing?.proxima_emissao ?? defaultProximaEmissao(existing?.dia_vencimento ?? 5))

  // Serviço (com NBS picker)
  const existingServico = (existing?.servico as Record<string, unknown> | null) ?? null
  const [codigoNbs, setCodigoNbs]       = useState((existingServico?.codigo_nbs as string) ?? '')
  const [nbsDescricao, setNbsDescricao] = useState('')
  const [valor, setValor]               = useState(
    existingServico?.valor != null ? String(existingServico.valor) : '',
  )
  const [discriminacao, setDiscriminacao] = useState((existingServico?.discriminacao as string) ?? '')

  // Tomador (com combobox)
  const existingTomador = (existing?.tomador as Record<string, unknown> | null) ?? null
  const [tomadorTipo, setTomadorTipo] = useState<'PJ' | 'PF'>((existingTomador?.tipo as 'PJ' | 'PF') ?? 'PJ')
  const [tomadorDoc, setTomadorDoc]   = useState((existingTomador?.documento as string) ?? '')
  const [tomadorNome, setTomadorNome] = useState((existingTomador?.razao_social as string) ?? '')
  const [tomadorMuni, setTomadorMuni] = useState((existingTomador?.municipio_ibge as string) ?? '')

  // Email automático (opt-in por automação — default ON)
  const [enviarEmail, setEnviarEmail] = useState(existing?.enviar_email_tomador ?? true)
  const [emailDestino, setEmailDestino] = useState(
    existing?.email_tomador ?? (existingTomador?.email as string) ?? '',
  )

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function aplicarCliente(c: ClienteAutocomplete) {
    setTomadorTipo(c.tipo)
    setTomadorDoc(c.documento)
    setTomadorNome(c.razao_social)
    if (c.municipio_ibge) setTomadorMuni(c.municipio_ibge)
    if (c.email && !emailDestino) setEmailDestino(c.email)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Validações leves
    if (!nome.trim()) { setError('Dê um nome pra automação (ex.: "Consultoria João — mensal")'); return }
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) { setError('Informe um valor maior que zero'); return }
    if (!codigoNbs) { setError('Selecione o serviço prestado'); return }
    const docClean = tomadorDoc.replace(/\D/g, '')
    if (docClean.length !== 11 && docClean.length !== 14) { setError('CPF/CNPJ do tomador inválido'); return }
    if (!tomadorNome.trim()) { setError('Informe o nome/razão social do tomador'); return }
    if (enviarEmail && !emailDestino.includes('@')) { setError('Informe um email válido pro envio'); return }

    setLoading(true)
    const payload = {
      nome:                 nome.trim(),
      dia_vencimento:       dia,
      proxima_emissao:      proximaEmissao,
      servico: {
        codigo_nbs:    codigoNbs,
        valor:         valorNum,
        discriminacao: discriminacao.trim() || nbsDescricao || undefined,
      },
      tomador: {
        tipo:          tomadorTipo,
        documento:     docClean,
        razao_social:  tomadorNome.trim(),
        email:         emailDestino.trim() || undefined,
        municipio_ibge: tomadorMuni || undefined,
      },
      enviar_email_tomador: enviarEmail,
      email_tomador:        enviarEmail ? emailDestino.trim() : null,
    }

    try {
      const url    = isEdit ? `/api/recorrencias/${existing.id}` : '/api/recorrencias'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Erro ${res.status}`)
      }
      const saved = await res.json()
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar automação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center sm:items-center justify-center bg-navy-900/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rec-modal-title"
    >
      <div className="bg-navy-700 border border-navy-600 sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-y-auto h-full sm:h-auto sm:max-h-[92vh]">
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-navy-700/95 backdrop-blur border-b border-navy-600 px-5 py-4 flex items-center justify-between">
          <h2 id="rec-modal-title" className="font-display text-lg sm:text-xl font-extrabold">
            {isEdit ? 'Editar automação' : 'Nova automação'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-2 hover:text-text-1 transition text-2xl leading-none p-1"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Bloco 1 — Identidade */}
          <section className="space-y-3">
            <Input
              label="Nome da automação"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Consultoria mensal João"
              required
              autoFocus
              hint="Como você vai identificar essa regra na lista"
            />
          </section>

          {/* Bloco 2 — Agendamento */}
          <section className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">📅 Quando emitir</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Dia do mês"
                type="number"
                min={1}
                max={28}
                value={dia}
                onChange={e => {
                  const n = parseInt(e.target.value, 10) || 1
                  const clamped = Math.max(1, Math.min(28, n))
                  setDia(clamped)
                  // Recalcula próxima emissão se ainda for a default
                  if (!isEdit) setProximaEmissao(defaultProximaEmissao(clamped))
                }}
                hint="1 a 28 (evita 29-31 que não existem em todo mês)"
                required
              />
              <Input
                label="Próxima emissão"
                type="date"
                value={proximaEmissao}
                onChange={e => setProximaEmissao(e.target.value)}
                required
              />
            </div>
          </section>

          {/* Bloco 3 — Serviço */}
          <section className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">🧾 Serviço</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-1">Serviço prestado</label>
              <NBSServicoPicker
                inline
                value={codigoNbs}
                selectedDescricao={nbsDescricao}
                onSelect={(codigo, descricao) => {
                  setCodigoNbs(codigo)
                  setNbsDescricao(descricao)
                  if (!discriminacao.trim()) setDiscriminacao(descricao)
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-1">Valor (R$)</label>
              <MoneyInput
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-text-1 placeholder:text-text-2/60 focus:outline-none focus:border-brand-cyan transition"
                value={valor}
                onChange={setValor}
              />
            </div>

            <Input
              label="Discriminação"
              value={discriminacao}
              onChange={e => setDiscriminacao(e.target.value)}
              placeholder="Descrição que aparece na nota"
              hint="Preenchida automaticamente quando você escolhe o serviço acima"
            />
          </section>

          {/* Bloco 4 — Tomador */}
          <section className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">👤 Tomador</h3>

            <ClienteCombobox onSelect={aplicarCliente} />

            <div className="flex gap-2">
              {(['PJ', 'PF'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTomadorTipo(t); setTomadorDoc('') }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    tomadorTipo === t
                      ? 'bg-brand-cyan text-navy-900'
                      : 'border border-navy-600 text-text-2 hover:border-brand-cyan'
                  }`}
                >
                  {t === 'PJ' ? 'CNPJ' : 'CPF'}
                </button>
              ))}
            </div>

            <Input
              label={tomadorTipo === 'PJ' ? 'CNPJ' : 'CPF'}
              value={tomadorTipo === 'PJ' ? maskCNPJ(tomadorDoc) : maskCPF(tomadorDoc)}
              onChange={e => setTomadorDoc(e.target.value.replace(/\D/g, ''))}
              placeholder={tomadorTipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              required
            />
            <Input
              label={tomadorTipo === 'PJ' ? 'Razão social' : 'Nome completo'}
              value={tomadorNome}
              onChange={e => setTomadorNome(e.target.value)}
              required
            />
            {/* Município via CEP ou busca por nome — nunca pedir IBGE direto */}
            <CepMunicipioInput
              value={tomadorMuni}
              onChange={(code) => setTomadorMuni(code)}
            />
          </section>

          {/* Bloco 5 — Email automático */}
          <section className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enviarEmail}
                onChange={e => setEnviarEmail(e.target.checked)}
                className="mt-0.5 accent-brand-cyan w-4 h-4 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-text-1">
                  ✉️ Enviar nota por email após emissão
                </p>
                <p className="text-xs text-text-2 mt-0.5">
                  Quando a Receita autorizar, mandamos o PDF e XML pro tomador (e cópia oculta pra você).
                </p>
              </div>
            </label>

            {enviarEmail && (
              <Input
                label="Email do tomador"
                type="email"
                value={emailDestino}
                onChange={e => setEmailDestino(e.target.value)}
                placeholder="financeiro@empresa.com"
                required
              />
            )}
          </section>

          {error && (
            <p className="text-sm text-nota-rejeitada bg-nota-rejeitada/10 border border-nota-rejeitada/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Footer com ações — sticky bottom no mobile */}
          <div className="flex gap-3 pt-2 sticky bottom-0 -mx-5 -mb-5 px-5 pb-5 pt-3 bg-navy-700 border-t border-navy-600 sm:static sm:bg-transparent sm:border-0 sm:m-0 sm:p-0">
            <Button variant="ghost" className="flex-1" onClick={onClose} type="button" disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={loading}>
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
