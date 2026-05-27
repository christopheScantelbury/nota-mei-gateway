'use client'

import { useState } from 'react'
import { validarCNPJ } from '@/lib/cnpj'
import { CepMunicipioInput } from '@/components/ui/CepMunicipioInput'
import { maskCNPJ } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { LIMITE_RECEITA, fmtMoneyCompact } from '@/lib/tributario'
import type { CadastroMEState } from '../actions'

// ── styles ────────────────────────────────────────────────────────────────────

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full'

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-1">
        {label}
        {required && <span className="text-nota-rejeitada ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-2">{hint}</p>}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  state: CadastroMEState
  onChange: (partial: Partial<CadastroMEState>) => void
  onNext: () => void
}

interface Errors {
  cnpj?: string
  razaoSocial?: string
  email?: string
  municipioIBGE?: string
}

export function StepEmpresa({ state, onChange, onNext }: Props) {
  const [errors, setErrors] = useState<Errors>({})

  function validate(): boolean {
    const errs: Errors = {}

    const digits = state.cnpj.replace(/\D/g, '')
    if (!validarCNPJ(digits)) {
      errs.cnpj = 'CNPJ inválido — verifique os dígitos verificadores'
    }
    if (!state.razaoSocial.trim()) {
      errs.razaoSocial = 'Razão social obrigatória'
    }
    if (!state.email.trim() || !state.email.includes('@')) {
      errs.email = 'E-mail inválido'
    }
    if (!state.municipioIBGE) {
      errs.municipioIBGE = 'Município obrigatório'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (validate()) onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-1">Dados da empresa</h2>
        <p className="text-sm text-text-2 mt-1">
          Informe os dados do CNPJ que será cadastrado na plataforma.
        </p>
      </div>

      {/* Tipo ME / EPP */}
      <Field label="Tipo" required>
        <div className="flex gap-2">
          {(['ME', 'EPP'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ tipo: t })}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition border ${
                state.tipo === t
                  ? 'bg-brand-cyan text-navy-900 border-brand-cyan'
                  : 'border-navy-600 text-text-2 hover:border-brand-cyan'
              }`}
            >
              {t === 'ME' ? 'Microempresa (ME)' : 'Empresa Pequeno Porte (EPP)'}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-2">
          ME: faturamento até {fmtMoneyCompact(LIMITE_RECEITA.ME)}/ano · EPP: até {fmtMoneyCompact(LIMITE_RECEITA.EPP)}/ano
        </p>
      </Field>

      {/* CNPJ */}
      <Field label="CNPJ" required error={errors.cnpj}>
        <input
          type="text"
          className={inputCls}
          placeholder="00.000.000/0001-00"
          value={state.cnpj}
          onChange={e => onChange({ cnpj: maskCNPJ(e.target.value) })}
          inputMode="numeric"
          autoComplete="off"
        />
      </Field>

      {/* Razão Social */}
      <Field label="Razão social" required error={errors.razaoSocial}>
        <input
          type="text"
          className={inputCls}
          placeholder="Empresa Tecnologia LTDA"
          value={state.razaoSocial}
          onChange={e => onChange({ razaoSocial: e.target.value })}
        />
      </Field>

      {/* Nome Fantasia (opcional) */}
      <Field label="Nome fantasia" hint="Opcional — exibido nas notas se diferente da razão social">
        <input
          type="text"
          className={inputCls}
          placeholder="TechEmpresa"
          value={state.nomeFantasia ?? ''}
          onChange={e => onChange({ nomeFantasia: e.target.value })}
        />
      </Field>

      {/* E-mail */}
      <Field label="E-mail da empresa" required error={errors.email} hint="Usado para notificações de notas autorizadas">
        <input
          type="email"
          className={inputCls}
          placeholder="financeiro@empresa.com.br"
          value={state.email}
          onChange={e => onChange({ email: e.target.value })}
        />
      </Field>

      {/* Município */}
      <Field label="Município do prestador" required error={errors.municipioIBGE} hint="Município onde a empresa está registrada">
        <CepMunicipioInput
          value={state.municipioIBGE}
          onChange={(code: string) => onChange({ municipioIBGE: code })}
          error={errors.municipioIBGE}
        />
      </Field>

      {/* Inscrição Municipal (opcional) */}
      <Field label="Inscrição municipal" hint="Opcional — número de cadastro na prefeitura">
        <input
          type="text"
          className={inputCls}
          placeholder="Ex: 1234567"
          value={state.inscricaoMunicipal ?? ''}
          onChange={e => onChange({ inscricaoMunicipal: e.target.value })}
        />
      </Field>

      <Button type="button" variant="primary" onClick={handleNext}>
        Continuar →
      </Button>
    </div>
  )
}
