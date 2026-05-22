'use client'

import type { CadastroMEState } from '../actions'
import { Button } from '@/components/ui/Button'

interface Props {
  state: CadastroMEState
  onChange: (partial: Partial<CadastroMEState>) => void
  onNext: () => void
  onBack: () => void
}

const REGIMES = [
  {
    id: 'SIMPLES_NACIONAL' as const,
    titulo: 'Simples Nacional',
    subtitulo: 'Faturamento até R$ 360.000/ano',
    descricao:
      'ISS recolhido mensalmente via DAS no PGDAS-D. O tomador não retém ISS na fonte.',
    detalhe: 'CNPJ optante pelo Simples Nacional — alíquotas unificadas, regime simplificado.',
    icone: '📋',
    recomendado: true,
  },
  {
    id: 'LUCRO_PRESUMIDO' as const,
    titulo: 'Lucro Presumido',
    subtitulo: 'Faturamento acima de R$ 360.000/ano',
    descricao:
      'ISS recolhido via DAM emitido no sistema Nota Manaus. Tomador pode reter ISS na fonte.',
    detalhe:
      'Para empresas que não se enquadram no Simples — IRPJ, CSLL, PIS/COFINS e ISS separados.',
    icone: '📊',
    recomendado: false,
  },
] as const

export function StepRegime({ state, onChange, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-1">Regime tributário</h2>
        <p className="text-sm text-text-2 mt-1">
          Selecione o regime da sua empresa. Isso determina como o ISS será recolhido.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {REGIMES.map(regime => {
          const selected = state.regimeTributario === regime.id
          return (
            <button
              key={regime.id}
              type="button"
              onClick={() => onChange({ regimeTributario: regime.id })}
              className={`relative w-full text-left rounded-xl border p-5 transition ${
                selected
                  ? 'border-brand-cyan bg-brand-cyan/10'
                  : 'border-navy-600 bg-navy-700 hover:border-brand-cyan/50'
              }`}
            >
              {regime.recomendado && (
                <span className="absolute top-3 right-3 text-[10px] font-bold bg-brand-cyan text-navy-900 rounded-full px-2 py-0.5">
                  Mais comum
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{regime.icone}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-1">{regime.titulo}</span>
                    {selected && (
                      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-brand-cyan shrink-0">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M5 8l2.5 2.5L11 5.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-text-2 mt-0.5">{regime.subtitulo}</p>
                  <p className="text-sm text-text-2 mt-2">{regime.descricao}</p>
                  <p className="text-xs text-text-2/70 mt-1">{regime.detalhe}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-navy-600 bg-navy-700/50 px-4 py-3 text-xs text-text-2">
        💡 Em dúvida? Consulte seu contador. O regime tributário afeta diretamente o cálculo
        e recolhimento do ISS nas notas emitidas.
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Voltar
        </Button>
        <Button type="button" variant="primary" className="flex-1" onClick={onNext}>
          Continuar →
        </Button>
      </div>
    </div>
  )
}
