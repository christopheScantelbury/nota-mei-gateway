'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Empresa = { id: string; tipo: string; razao_social: string; cnpj: string }

type Step = 1 | 2 | 3

const REGIME_OPTIONS = [
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO',  label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL',       label: 'Lucro Real' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const labels = ['Confirmação', 'Dados ME', 'Concluído']
  return (
    <nav aria-label="Etapas da migração" className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        const done    = n < current
        const active  = n === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                done   ? 'bg-brand-cyan border-brand-cyan text-navy-900'
                       : active ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan'
                       : 'bg-navy-900 border-navy-600 text-text-2',
              ].join(' ')} aria-current={active ? 'step' : undefined}>
                {done ? '✓' : n}
              </div>
              <span className={['text-[10px] font-medium whitespace-nowrap', active ? 'text-text-1' : 'text-text-2'].join(' ')}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={['h-0.5 flex-1 mx-2 mb-4 rounded-full transition-colors', done ? 'bg-brand-cyan' : 'bg-navy-600'].join(' ')} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MigrarMEClient({ empresa }: { empresa: Empresa }) {
  const router = useRouter()
  const [step,     setStep]     = useState<Step>(1)
  const [regime,   setRegime]   = useState('SIMPLES_NACIONAL')
  const [inscricao, setInscricao] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  function formatCNPJ(cnpj: string) {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/v1/auth/migrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empresa_id:          empresa.id,
          para_tipo:           'ME',
          regime_tributario:   regime,
          inscricao_municipal: inscricao || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? 'Erro ao processar migração')
      }

      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-text-1 mb-2">
        Migrar para ME
      </h1>
      <p className="text-text-2 text-sm mb-8">
        Migre seu cadastro MEI para Microempresa (ME). O histórico de notas é preservado.
      </p>

      <StepIndicator current={step} />

      {/* ── Step 1: Confirmação ── */}
      {step === 1 && (
        <div className="bg-navy-700 border border-navy-600 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-text-1">Confirmar dados da empresa</h2>

          <div className="space-y-2">
            <InfoRow label="Razão social" value={empresa.razao_social} />
            <InfoRow label="CNPJ"         value={formatCNPJ(empresa.cnpj)} />
            <InfoRow label="Tipo atual"   value="MEI" />
            <InfoRow label="Novo tipo"    value="ME" highlight />
          </div>

          <div className="rounded-xl border border-nota-processando/30 bg-nota-processando/5 p-4 text-sm text-text-2">
            <p className="font-medium text-nota-processando mb-1">⚠️ O que muda após a migração</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>O tipo da empresa passa de <strong>MEI</strong> para <strong>ME</strong></li>
              <li>O histórico de notas fiscais é <strong>preservado</strong></li>
              <li>O regime tributário será atualizado conforme você indicar</li>
              <li>A migração é <strong>irreversível</strong> via painel — contate o suporte se precisar reverter</li>
            </ul>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full bg-brand-cyan text-navy-900 font-semibold py-3 rounded-xl hover:opacity-90 transition"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ── Step 2: Dados ME ── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="bg-navy-700 border border-navy-600 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-text-1">Dados da Microempresa</h2>

          {/* Regime tributário */}
          <div>
            <label className="block text-sm font-medium text-text-1 mb-2">
              Regime tributário <span className="text-nota-rejeitada">*</span>
            </label>
            <div className="space-y-2">
              {REGIME_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={[
                    'flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors',
                    regime === value
                      ? 'border-brand-cyan/50 bg-brand-cyan/5'
                      : 'border-navy-600 hover:border-brand-cyan/30',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="regime"
                    value={value}
                    checked={regime === value}
                    onChange={() => setRegime(value)}
                    className="accent-brand-cyan"
                  />
                  <span className="text-sm text-text-1">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Inscrição municipal (opcional) */}
          <div>
            <label className="block text-sm font-medium text-text-1 mb-1.5">
              Inscrição municipal <span className="text-text-2 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={inscricao}
              onChange={(e) => setInscricao(e.target.value)}
              placeholder="Ex: 12345-6"
              className="w-full bg-navy-900 border border-navy-600 rounded-xl px-4 py-3
                         text-text-1 text-sm placeholder:text-text-2
                         focus:outline-none focus:border-brand-cyan/50 transition"
            />
          </div>

          {error && (
            <p className="text-nota-rejeitada text-sm">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex-1 border border-navy-600 text-text-2 font-semibold py-3 rounded-xl
                         hover:border-brand-cyan/30 hover:text-text-1 transition disabled:opacity-50"
            >
              ← Voltar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-cyan text-navy-900 font-semibold py-3 rounded-xl
                         hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Migrando…' : 'Confirmar migração'}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: Concluído ── */}
      {step === 3 && (
        <div className="bg-navy-700 border border-nota-autorizada/30 rounded-2xl p-8 text-center space-y-4">
          <span className="text-5xl">✅</span>
          <h2 className="font-display text-xl font-bold text-text-1">
            Migração concluída!
          </h2>
          <p className="text-text-2 text-sm leading-relaxed">
            Sua empresa foi migrada para <strong>ME</strong> com regime{' '}
            <strong>{REGIME_OPTIONS.find(r => r.value === regime)?.label}</strong>.
            O histórico de notas foi preservado.
          </p>
          <button
            onClick={() => router.push('/notas')}
            className="mt-2 bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition"
          >
            Ir para as notas →
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-navy-600 last:border-0">
      <span className="text-xs text-text-2">{label}</span>
      <span className={['text-sm font-medium', highlight ? 'text-brand-cyan' : 'text-text-1'].join(' ')}>
        {value}
      </span>
    </div>
  )
}
