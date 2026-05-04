'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Recorrencia {
  id: string
  nome: string
  ativo: boolean
  dia_vencimento: number
  proxima_emissao: string
  webhook_url?: string
  servico: unknown
  tomador: unknown
}

interface Props {
  existing?: Recorrencia | null
  onClose: () => void
  onSaved: (rec: Recorrencia) => void
}

export default function RecorrenciaModal({ existing, onClose, onSaved }: Props) {
  const isEdit = !!existing

  const [nome,           setNome]           = useState(existing?.nome ?? '')
  const [dia,            setDia]            = useState(String(existing?.dia_vencimento ?? ''))
  const [proximaEmissao, setProximaEmissao] = useState(existing?.proxima_emissao ?? '')
  const [webhookURL,     setWebhookURL]     = useState(existing?.webhook_url ?? '')
  // Servico fields
  const existingServico = existing?.servico as Record<string, unknown> | null ?? null
  const [codigoNbs,  setCodigoNbs]  = useState((existingServico?.codigo_nbs as string) ?? '')
  const [valor,      setValor]      = useState(String((existingServico?.valor as number) ?? ''))
  const [discriminacao, setDiscriminacao] = useState((existingServico?.discriminacao as string) ?? '')
  // Tomador fields
  const existingTomador = existing?.tomador as Record<string, unknown> | null ?? null
  const [tomadorDoc,   setTomadorDoc]   = useState((existingTomador?.documento as string) ?? '')
  const [tomadorNome,  setTomadorNome]  = useState((existingTomador?.razao_social as string) ?? '')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      nome,
      dia_vencimento: parseInt(dia, 10),
      proxima_emissao: proximaEmissao,
      webhook_url: webhookURL || undefined,
      servico: {
        codigo_nbs: codigoNbs,
        valor: parseFloat(valor),
        discriminacao: discriminacao || undefined,
      },
      tomador: {
        documento: tomadorDoc,
        razao_social: tomadorNome || undefined,
      },
    }

    try {
      const url    = isEdit ? `/api/recorrencias/${existing.id}` : '/api/recorrencias'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar recorrência')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rec-modal-title"
    >
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2
          id="rec-modal-title"
          className="font-display text-xl font-extrabold mb-5"
        >
          {isEdit ? 'Editar recorrência' : 'Nova recorrência'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da recorrência"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Desenvolvimento mensal"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dia do vencimento (1–28)"
              type="number"
              min={1}
              max={28}
              value={dia}
              onChange={e => setDia(e.target.value)}
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

          <fieldset className="rounded-lg border border-navy-600 p-4 space-y-3">
            <legend className="text-xs font-semibold text-text-2 uppercase tracking-wider px-1">
              Serviço
            </legend>
            <Input
              label="Código NBS"
              value={codigoNbs}
              onChange={e => setCodigoNbs(e.target.value)}
              placeholder="Ex: 01.01.01.10"
              required
            />
            <Input
              label="Valor (R$)"
              type="number"
              min={0.01}
              step={0.01}
              value={valor}
              onChange={e => setValor(e.target.value)}
              required
            />
            <Input
              label="Discriminação (opcional)"
              value={discriminacao}
              onChange={e => setDiscriminacao(e.target.value)}
              placeholder="Descrição do serviço prestado"
            />
          </fieldset>

          <fieldset className="rounded-lg border border-navy-600 p-4 space-y-3">
            <legend className="text-xs font-semibold text-text-2 uppercase tracking-wider px-1">
              Tomador
            </legend>
            <Input
              label="CPF / CNPJ"
              value={tomadorDoc}
              onChange={e => setTomadorDoc(e.target.value.replace(/\D/g, ''))}
              placeholder="Apenas números"
              required
            />
            <Input
              label="Razão social / Nome (opcional)"
              value={tomadorNome}
              onChange={e => setTomadorNome(e.target.value)}
            />
          </fieldset>

          <Input
            label="Webhook URL (opcional)"
            type="url"
            value={webhookURL}
            onChange={e => setWebhookURL(e.target.value)}
            placeholder="https://seu-sistema.com/webhooks/notas"
          />

          {error && (
            <p className="text-sm text-nota-rejeitada bg-nota-rejeitada/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose} type="button" disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={loading}>
              {isEdit ? 'Salvar alterações' : 'Criar recorrência'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
