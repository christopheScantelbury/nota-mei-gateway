'use client'

import { useState } from 'react'
import { StepEmpresa } from './steps/StepEmpresa'
import { StepRegime } from './steps/StepRegime'
import { StepCertificado } from './steps/StepCertificado'
import { StepAPIKey } from './steps/StepAPIKey'
import { cadastrarME } from './actions'
import type { CadastroMEState } from './actions'

// ── Stepper progress bar ──────────────────────────────────────────────────────

const STEPS = ['Dados da empresa', 'Regime tributário', 'Certificado A1', 'API Key']

function StepperProgress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => {
          const done    = i < current
          const active  = i === current
          const future  = i > current

          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className={`absolute left-0 right-1/2 top-3.5 h-0.5 -translate-y-px ${
                    done ? 'bg-brand-cyan' : 'bg-navy-600'
                  }`}
                  style={{ right: '50%', left: '-50%' }}
                />
              )}
              {/* Step circle */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                  done
                    ? 'bg-brand-cyan border-brand-cyan text-navy-900'
                    : active
                    ? 'bg-navy-900 border-brand-cyan text-brand-cyan'
                    : 'bg-navy-700 border-navy-600 text-text-2'
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {/* Label */}
              <span
                className={`mt-1.5 text-[10px] font-medium text-center leading-tight hidden sm:block ${
                  active ? 'text-text-1' : future ? 'text-text-2/50' : 'text-text-2'
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const INITIAL_STATE: CadastroMEState = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  tipo: 'ME',
  email: '',
  municipioIBGE: '',
  inscricaoMunicipal: '',
  regimeTributario: 'SIMPLES_NACIONAL',
  certFile: undefined,
  certPassword: '',
}

export function CadastroMEStepper() {
  const [step, setStep]     = useState(0)
  const [state, setState]   = useState<CadastroMEState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  // Result state (step 3 → step 4)
  const [resultApiKey, setResultApiKey]     = useState('')
  const [resultEmpresaId, setResultEmpresaId] = useState('')

  const update = (partial: Partial<CadastroMEState>) =>
    setState(prev => ({ ...prev, ...partial }))

  async function handleSubmit() {
    setApiError('')
    setLoading(true)
    try {
      const result = await cadastrarME(state)
      if (result.ok && result.apiKey && result.empresaId) {
        setResultApiKey(result.apiKey)
        setResultEmpresaId(result.empresaId)
        setStep(3)
      } else {
        setApiError(result.error ?? 'Erro ao cadastrar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <StepperProgress current={step} />

      {apiError && step === 2 && (
        <div className="rounded-xl border border-nota-rejeitada/40 bg-nota-rejeitada/10 px-4 py-3 text-sm text-nota-rejeitada mb-6">
          {apiError}
        </div>
      )}

      {step === 0 && (
        <StepEmpresa
          state={state}
          onChange={update}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <StepRegime
          state={state}
          onChange={update}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <StepCertificado
          state={state}
          onChange={update}
          onSubmit={handleSubmit}
          onBack={() => setStep(1)}
          loading={loading}
        />
      )}
      {step === 3 && (
        <StepAPIKey
          apiKey={resultApiKey}
          empresaId={resultEmpresaId}
        />
      )}
    </div>
  )
}
