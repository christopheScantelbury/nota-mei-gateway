'use client'

import { useState, useRef, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MunicipioAutocomplete } from '@/components/ui/MunicipioAutocomplete'
import { validarCNPJ } from '@/lib/cnpj'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3
type AppStep = 'wizard' | 'success'

interface FormState {
  cnpj: string
  razaoSocial: string
  email: string
  cep: string
  municipioIBGE: string
  municipioNome: string
  municipioUF: string
  certFile: File | null
  certPassword: string
}

interface ViaCepResponse {
  erro?: boolean
  localidade: string
  uf: string
  ibge: string
  logradouro: string
  bairro: string
}

interface SuccessState {
  meiId: string
  apiKey: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCEP(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

// ── Stepper UI ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Dados do MEI', 'Localização', 'Certificado']
// Step 2 display label shown in header
const STEP2_LABEL = 'CEP'

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <nav aria-label="Etapas do cadastro" className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as WizardStep
        const isCompleted = stepNum < current
        const isCurrent   = stepNum === current
        const isFuture    = stepNum > current

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  isCompleted
                    ? 'bg-brand-cyan border-brand-cyan text-navy-900'
                    : isCurrent
                    ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan'
                    : 'bg-navy-900 border-navy-600 text-text-2',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                    <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={[
                  'text-[10px] font-medium whitespace-nowrap',
                  isFuture ? 'text-text-2' : 'text-text-1',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {i < STEP_LABELS.length - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 mx-2 mb-4 rounded-full transition-colors',
                  isCompleted ? 'bg-brand-cyan' : 'bg-navy-600',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function CadastroPageInner() {
  const searchParams = useSearchParams()
  const produto = searchParams.get('produto') // 'mei' | null (gateway/dev)
  const isMei = produto === 'mei'

  const [appStep, setAppStep]       = useState<AppStep>('wizard')
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<SuccessState | null>(null)
  const [copied, setCopied]         = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError]     = useState<string | null>(null)
  const [showMunicipioSearch, setShowMunicipioSearch] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Per-field validation errors
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const [form, setForm] = useState<FormState>({
    cnpj: '',
    razaoSocial: '',
    email: '',
    cep: '',
    municipioIBGE: '',
    municipioNome: '',
    municipioUF: '',
    certFile: null,
    certPassword: '',
  })

  function setField(field: keyof FormState, value: string | File | null) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    setError(null)
  }

  async function handleCepChange(raw: string) {
    const formatted = formatCEP(raw)
    setForm((prev) => ({ ...prev, cep: formatted, municipioIBGE: '', municipioNome: '', municipioUF: '' }))
    setCepError(null)

    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json() as ViaCepResponse
      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número ou busque o município pelo nome.')
        return
      }
      setForm((prev) => ({
        ...prev,
        municipioIBGE: data.ibge,
        municipioNome: data.localidade,
        municipioUF: data.uf,
      }))
      setShowMunicipioSearch(false)
    } catch {
      setCepError('Não foi possível consultar o CEP. Tente novamente ou busque o município pelo nome.')
    } finally {
      setCepLoading(false)
    }
  }

  // ── Step validation ──────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {}
    const cnpjDigits = form.cnpj.replace(/\D/g, '')

    if (cnpjDigits.length !== 14) {
      errors.cnpj = 'CNPJ deve conter 14 dígitos.'
    } else if (!validarCNPJ(cnpjDigits)) {
      errors.cnpj = 'CNPJ inválido — verifique os dígitos.'
    }
    if (!form.razaoSocial.trim()) {
      errors.razaoSocial = 'Razão Social é obrigatória.'
    }
    if (!form.email.trim()) {
      errors.email = 'E-mail é obrigatório.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'E-mail inválido.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep2(): boolean {
    const code = form.municipioIBGE.replace(/\D/g, '')
    if (code.length !== 7) {
      setFieldErrors({ municipioIBGE: 'Selecione um município da lista ou digite o código IBGE de 7 dígitos.' })
      return false
    }
    setFieldErrors({})
    return true
  }

  function handleNextStep1() {
    if (validateStep1()) setWizardStep(2)
  }

  function handleNextStep2() {
    if (validateStep2()) setWizardStep(3)
  }

  // ── Submit (called from step 3) ──────────────────────────────────────────────

  async function submitForm(skipCert = false) {
    setError(null)
    setLoading(true)

    try {
      // Register MEI
      const regRes = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj:           form.cnpj.replace(/\D/g, ''),
          razao_social:   form.razaoSocial.trim(),
          email:          form.email.trim().toLowerCase(),
          municipio_ibge: form.municipioIBGE,
        }),
      })

      const regData = await regRes.json()
      if (!regRes.ok) {
        const msg =
          regData.message ??
          (regData.fields as { message: string }[] | undefined)
            ?.map((f: { message: string }) => f.message)
            .join('; ') ??
          'Erro ao cadastrar MEI.'
        setError(msg)
        return
      }

      const { mei_id: meiId, api_key: apiKey } = regData as {
        mei_id: string
        api_key: string
      }

      // Upload certificate (optional)
      if (!skipCert && form.certFile && form.certPassword) {
        const certForm = new FormData()
        certForm.append('certificado', form.certFile)
        certForm.append('senha_certificado', form.certPassword)

        const certRes = await fetch(`${API_BASE}/v1/auth/certificate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: certForm,
        })

        if (!certRes.ok) {
          const certData = await certRes.json().catch(() => ({})) as { message?: string }
          setError(
            `MEI cadastrado, mas o upload do certificado falhou: ${certData.message ?? certRes.status}. ` +
              'Faça o upload novamente em Configurações.',
          )
        }
      }

      setSuccess({ meiId, apiKey })
      setAppStep('success')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro de conexão. Verifique sua internet e tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitWithCert(e: FormEvent) {
    e.preventDefault()
    await submitForm(false)
  }

  async function copyKey() {
    if (!success) return
    await navigator.clipboard.writeText(success.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ────────────────────────────────────────────────────────────

  if (appStep === 'success' && success) {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-lg">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-display text-2xl font-extrabold text-text-1 mb-2">
            MEI cadastrado com sucesso!
          </h1>
          <p className="text-text-2 text-sm mb-6">
            Guarde sua API Key com segurança — ela{' '}
            <strong className="text-text-1">não será exibida novamente</strong>.
          </p>

          <div className="bg-navy-900 border border-navy-600 rounded-lg p-4 mb-2">
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-1">
              Sua API Key
            </p>
            <p className="font-mono text-xs text-brand-cyan break-all select-all">
              {success.apiKey}
            </p>
          </div>
          <button
            onClick={copyKey}
            className="w-full text-sm bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 font-semibold px-4 py-2 rounded-lg hover:bg-brand-cyan/20 transition mb-6"
          >
            {copied ? '✅ Copiado!' : '📋 Copiar API Key'}
          </button>

          <div className="border-t border-navy-600 pt-4 flex flex-col gap-2">
            <a
              href="/billing"
              className="block text-center text-sm bg-brand-cyan text-navy-900 font-bold px-4 py-2.5 rounded-lg hover:bg-brand-cyan/90 transition"
            >
              Escolher plano →
            </a>
            <a
              href="/notas"
              className="block text-center text-sm text-text-2 hover:text-text-1 transition py-1"
            >
              Ir para o painel
            </a>
          </div>
        </div>
      </main>
    )
  }

  // ── Wizard shell ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-text-1 leading-tight">
            Cadastrar MEI
          </h1>
          <p className="text-text-2 text-xs mt-0.5">
            {isMei ? 'Nota Fácil MEI' : 'Nota MEI Gateway'}
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={wizardStep} />

        {/* ── Step 1: Dados do MEI ─────────────────────────────────────────── */}
        {wizardStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
                CNPJ
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="XX.XXX.XXX/XXXX-XX"
                value={form.cnpj}
                onChange={(e) => setField('cnpj', formatCNPJ(e.target.value))}
                className={[
                  'w-full bg-navy-900 border rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan transition-colors',
                  fieldErrors.cnpj ? 'border-nota-rejeitada' : 'border-navy-600',
                ].join(' ')}
              />
              {fieldErrors.cnpj && (
                <p className="text-xs text-nota-rejeitada mt-1">{fieldErrors.cnpj}</p>
              )}
            </div>

            <Input
              label="Razão Social"
              type="text"
              placeholder="Nome Empresa ME"
              value={form.razaoSocial}
              onChange={(e) => setField('razaoSocial', e.target.value)}
              error={fieldErrors.razaoSocial}
            />

            <Input
              label="E-mail"
              type="email"
              placeholder="contato@empresa.com"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={fieldErrors.email}
            />
            <div className="bg-brand-cyan/5 border border-brand-cyan/20 rounded-lg px-3 py-2.5 flex gap-2 items-start text-xs text-text-2">
              <span className="shrink-0 mt-0.5">📧</span>
              <span>
                Você receberá um <strong className="text-text-1">link de acesso por e-mail</strong> para entrar na sua conta — sem precisar criar uma senha.
              </span>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              onClick={handleNextStep1}
            >
              Próximo →
            </Button>

            <p className="text-xs text-text-2 text-center">
              Já tem uma conta?{' '}
              <a href={`/login?produto=${isMei ? 'mei' : 'gateway'}`} className="text-brand-cyan hover:underline">
                Fazer login
              </a>
            </p>
          </div>
        )}

        {/* ── Step 2: Localização ──────────────────────────────────────────── */}
        {wizardStep === 2 && (
          <div className="space-y-4">
            {/* CEP input */}
            <div>
              <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
                CEP
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  className={[
                    'w-full bg-navy-900 border rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan transition-colors pr-8',
                    cepError ? 'border-nota-rejeitada' : form.municipioIBGE ? 'border-nota-autorizada' : 'border-navy-600',
                  ].join(' ')}
                />
                {cepLoading && (
                  <span className="absolute right-2.5 text-text-2 text-xs animate-pulse">⟳</span>
                )}
                {form.municipioIBGE && !cepLoading && (
                  <span className="absolute right-2.5 text-nota-autorizada text-sm">✓</span>
                )}
              </div>
              {cepError && <p className="text-xs text-nota-rejeitada mt-1">{cepError}</p>}
            </div>

            {/* Municipality confirmed card */}
            {form.municipioNome && !cepLoading && (
              <div className="bg-nota-autorizada/10 border border-nota-autorizada/30 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-nota-autorizada text-lg">📍</span>
                <div>
                  <p className="text-sm font-bold text-text-1">
                    {form.municipioNome} — {form.municipioUF}
                  </p>
                  <p className="text-xs text-text-2">Município detectado pelo CEP</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, municipioIBGE: '', municipioNome: '', municipioUF: '', cep: '' }))
                    setShowMunicipioSearch(false)
                    setCepError(null)
                  }}
                  className="ml-auto text-xs text-text-2 hover:text-text-1 transition"
                >
                  Trocar
                </button>
              </div>
            )}

            {/* Fallback: search by name */}
            {!form.municipioNome && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowMunicipioSearch((v) => !v)}
                  className="text-xs text-text-2 hover:text-brand-cyan transition underline underline-offset-2"
                >
                  {showMunicipioSearch ? 'Ocultar busca' : 'Não sei meu CEP — buscar município pelo nome'}
                </button>
              </div>
            )}

            {showMunicipioSearch && !form.municipioNome && (
              <MunicipioAutocomplete
                value={form.municipioIBGE}
                onChange={(code, nome) => {
                  setField('municipioIBGE', code)
                  setField('municipioNome', nome)
                  setField('municipioUF', '')
                }}
                error={fieldErrors.municipioIBGE}
              />
            )}

            {fieldErrors.municipioIBGE && !cepError && (
              <p className="text-xs text-nota-rejeitada">{fieldErrors.municipioIBGE}</p>
            )}

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setWizardStep(1)}
              >
                ← Voltar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleNextStep2}
                disabled={cepLoading}
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Certificado A1 ───────────────────────────────────────── */}
        {wizardStep === 3 && (
          <form onSubmit={handleSubmitWithCert} className="space-y-4">
            <p className="text-sm text-text-2">
              <strong className="text-text-1">Certificado A1</strong> — opcional agora,
              obrigatório para emitir notas. Você pode adicionar depois em Configurações.
            </p>

            {/* PFX upload */}
            <div>
              <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
                Certificado A1 (.pfx / .p12)
              </label>
              <div
                className="w-full bg-navy-900 border border-dashed border-navy-600 rounded-lg px-3 py-4 text-center cursor-pointer hover:border-brand-cyan/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {form.certFile ? (
                  <span className="text-sm text-text-1">📎 {form.certFile.name}</span>
                ) : (
                  <span className="text-sm text-text-2">Clique para selecionar o arquivo</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={(e) => setField('certFile', e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Cert password */}
            <Input
              label="Senha do Certificado"
              type="password"
              placeholder="Senha do arquivo .pfx"
              value={form.certPassword}
              onChange={(e) => setField('certPassword', e.target.value)}
              autoComplete="new-password"
            />

            {/* Global error */}
            {error && (
              <div className="bg-nota-rejeitada/10 border border-nota-rejeitada/30 text-nota-rejeitada rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Cadastrando…' : 'Criar conta →'}
              </Button>

              <button
                type="button"
                disabled={loading}
                onClick={() => submitForm(true)}
                className="w-full text-sm text-text-2 hover:text-text-1 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pular por agora
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={loading}
              onClick={() => setWizardStep(2)}
            >
              ← Voltar
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router
export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroPageInner />
    </Suspense>
  )
}
