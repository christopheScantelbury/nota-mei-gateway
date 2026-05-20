'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { CepMunicipioInput } from '@/components/ui/CepMunicipioInput'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4
type AppStep = 'wizard' | 'success'

interface FormState {
  // Step 1 — company data
  cnpj: string
  razaoSocial: string
  email: string
  // Step 2 — regime / CEP
  tipo: 'ME' | 'EPP'
  regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | ''
  cnae: string
  cep: string
  municipioIBGE: string
  municipioNome: string
  municipioUF: string
  inscricaoMunicipal: string
  // Step 3 — cert A1 (optional)
  certFile: File | null
  certPassword: string
}

interface SuccessState {
  empresaId: string
  apiKey: string
  tipo: string
  regime: string
}

function formatCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCNAE(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 7)
  if (d.length <= 4) return d
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Stepper UI ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Dados', 'Regime', 'Certificado', 'API Key']

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <nav aria-label="Etapas do cadastro ME/EPP" className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as WizardStep
        const isCompleted = stepNum < current
        const isCurrent   = stepNum === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  isCompleted
                    ? 'bg-brand-cyan border-brand-cyan text-navy-900'
                    : isCurrent
                    ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan'
                    : 'bg-white border-gray-200 text-gray-400',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                    <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : stepNum}
              </div>
              <span className={`text-xs whitespace-nowrap ${isCurrent ? 'text-brand-cyan font-medium' : isCompleted ? 'text-text-1' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-brand-cyan' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, hint, error, children }: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-1">{label}</label>
      {hint && <p className="text-xs text-text-2">{hint}</p>}
      {children}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

const inputCls =
  'bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-cyan transition'

// ── Main Component ────────────────────────────────────────────────────────────

export default function CadastroMEPage() {
  const [appStep, setAppStep]     = useState<AppStep>('wizard')
  const [step, setStep]           = useState<WizardStep>(1)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError]   = useState('')
  const [success, setSuccess]     = useState<SuccessState | null>(null)
  const [certUploading, setCertUploading] = useState(false)
  const [certUploaded, setCertUploaded]   = useState(false)
  const [certError, setCertError]         = useState('')
  const [copied, setCopied]       = useState(false)

  const [form, setForm] = useState<FormState>({
    cnpj: '', razaoSocial: '', email: '',
    tipo: 'ME', regimeTributario: '',
    cnae: '', cep: '', municipioIBGE: '', municipioNome: '', municipioUF: '',
    inscricaoMunicipal: '',
    certFile: null, certPassword: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'form', string>>>({})
  const certFileRef = useRef<HTMLInputElement>(null)

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }

  // ── Validation per step ───────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errs: typeof errors = {}
    const cnpjDigits = form.cnpj.replace(/\D/g, '')
    if (cnpjDigits.length !== 14) errs.cnpj = 'CNPJ deve conter 14 dígitos'
    if (!form.razaoSocial.trim())  errs.razaoSocial = 'Razão social obrigatória'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'E-mail inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: typeof errors = {}
    if (!form.regimeTributario) errs.regimeTributario = 'Selecione o regime tributário'
    if (!form.municipioIBGE)    errs.cep = 'CEP / município obrigatório'
    const cnaeDigits = form.cnae.replace(/\D/g, '')
    if (cnaeDigits.length !== 7) errs.cnae = 'CNAE deve conter 7 dígitos'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Step transitions ──────────────────────────────────────────────────────

  function nextStep1() {
    if (validateStep1()) setStep(2)
  }

  async function submitRegistration() {
    if (!validateStep2()) return
    setSubmitting(true)
    setApiError('')

    try {
      const body = {
        tipo: form.tipo,
        regime_tributario: form.regimeTributario,
        cnpj: form.cnpj.replace(/\D/g, ''),
        razao_social: form.razaoSocial,
        email: form.email,
        municipio_ibge: form.municipioIBGE,
        cnae: form.cnae.replace(/\D/g, ''),
        cep: form.cep.replace(/\D/g, ''),
        inscricao_municipal: form.inscricaoMunicipal || undefined,
      }

      const res = await fetch(`${API_BASE}/v1/auth/register/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setApiError('CNPJ ou e-mail já cadastrado. Tente fazer login.')
        } else if (data.message) {
          setApiError(data.message)
        } else {
          setApiError('Erro ao cadastrar empresa. Tente novamente.')
        }
        setSubmitting(false)
        return
      }

      setSuccess({
        empresaId: data.empresa_id,
        apiKey: data.api_key,
        tipo: data.tipo,
        regime: data.regime_tributario,
      })
      setStep(3)
    } catch {
      setApiError('Falha de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function uploadCert() {
    if (!form.certFile || !success) return
    setCertUploading(true)
    setCertError('')

    try {
      const fd = new FormData()
      fd.append('cert', form.certFile)
      fd.append('password', form.certPassword)

      const res = await fetch(`${API_BASE}/v1/auth/certificate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${success.apiKey}` },
        body: fd,
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setCertError(d.message ?? 'Erro ao enviar certificado. Verifique a senha e tente novamente.')
        setCertUploading(false)
        return
      }

      setCertUploaded(true)
    } catch {
      setCertError('Falha ao enviar certificado. Tente novamente.')
    } finally {
      setCertUploading(false)
    }
  }

  function copyKey() {
    if (!success) return
    navigator.clipboard.writeText(success.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const REGIME_LABELS: Record<string, string> = {
    SIMPLES_NACIONAL: 'Simples Nacional',
    LUCRO_PRESUMIDO:  'Lucro Presumido',
    LUCRO_REAL:       'Lucro Real',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl font-bold text-brand-cyan">Nota MEI Gateway</span>
          <span className="text-xs bg-brand-cyan/10 text-brand-cyan px-2 py-0.5 rounded-full font-semibold">ME/EPP</span>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Dados da empresa ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-text-1">Dados da empresa</h2>
              <p className="text-text-2 text-sm mt-1">Informações básicas do CNPJ registrado na Receita Federal.</p>
            </div>

            <Field label="CNPJ" error={errors.cnpj}>
              <input
                className={inputCls}
                placeholder="00.000.000/0001-00"
                value={form.cnpj}
                onChange={e => setField('cnpj', formatCNPJ(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>

            <Field label="Razão Social" error={errors.razaoSocial}>
              <input
                className={inputCls}
                placeholder="Empresa XYZ LTDA"
                value={form.razaoSocial}
                onChange={e => setField('razaoSocial', e.target.value)}
                autoComplete="organization"
              />
            </Field>

            <Field label="E-mail" error={errors.email}>
              <input
                className={inputCls}
                type="email"
                placeholder="financeiro@empresa.com.br"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                autoComplete="email"
              />
            </Field>

            <button
              onClick={nextStep1}
              className="w-full bg-brand-cyan text-navy-900 font-bold py-3 rounded-xl text-sm hover:opacity-90 transition"
            >
              Continuar →
            </button>

            <p className="text-center text-xs text-text-2">
              Já possui conta?{' '}
              <Link href="/login" className="text-brand-cyan hover:underline">Entrar</Link>
            </p>
          </div>
        )}

        {/* ── Step 2: Regime tributário ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-text-1">Regime e localização</h2>
              <p className="text-text-2 text-sm mt-1">Defina o porte, regime tributário e localização da empresa.</p>
            </div>

            {/* Tipo ME / EPP */}
            <Field label="Porte da empresa" error={errors.tipo}>
              <div className="flex gap-3">
                {(['ME', 'EPP'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField('tipo', t)}
                    className={[
                      'flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition',
                      form.tipo === t
                        ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                        : 'border-gray-200 text-gray-500 hover:border-brand-cyan/50',
                    ].join(' ')}
                  >
                    {t === 'ME' ? 'ME — Micro Empresa' : 'EPP — Empresa de Pequeno Porte'}
                  </button>
                ))}
              </div>
            </Field>

            {/* Regime tributário */}
            <Field label="Regime tributário" error={errors.regimeTributario}>
              <div className="flex flex-col gap-2">
                {(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'] as const).map(r => (
                  <label
                    key={r}
                    className={[
                      'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition',
                      form.regimeTributario === r
                        ? 'border-brand-cyan bg-brand-cyan/5'
                        : 'border-gray-200 hover:border-brand-cyan/40',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="regime"
                      value={r}
                      checked={form.regimeTributario === r}
                      onChange={() => setField('regimeTributario', r)}
                      className="mt-0.5 accent-brand-cyan"
                    />
                    <div>
                      <p className="text-sm font-semibold text-text-1">{REGIME_LABELS[r]}</p>
                      <p className="text-xs text-text-2">
                        {r === 'SIMPLES_NACIONAL' && 'ISS recolhido via DAS — sem retenção na fonte'}
                        {r === 'LUCRO_PRESUMIDO' && 'ISS pode ser retido pelo tomador (Art. 6 LC 116/2003)'}
                        {r === 'LUCRO_REAL' && 'ISS calculado sobre o lucro real apurado'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            {/* CNAE */}
            <Field
              label="CNAE Principal"
              hint="Código Nacional de Atividades Econômicas — ex: 6201-5/01"
              error={errors.cnae}
            >
              <input
                className={inputCls}
                placeholder="6201-5/01"
                value={form.cnae}
                onChange={e => setField('cnae', formatCNAE(e.target.value))}
                inputMode="numeric"
              />
            </Field>

            {/* CEP + município */}
            <Field
              label="CEP da sede"
              hint="O município será preenchido automaticamente"
              error={errors.cep}
            >
              <CepMunicipioInput
                value={form.municipioIBGE}
                onChange={(code, nome, uf) => {
                  setField('municipioIBGE', code)
                  setField('municipioNome', nome)
                  setField('municipioUF', uf ?? '')
                  setErrors(e => ({ ...e, cep: undefined }))
                }}
              />
              {form.municipioNome && (
                <p className="text-xs text-nota-autorizada mt-1">
                  ✓ {form.municipioNome} — {form.municipioUF}
                </p>
              )}
            </Field>

            {/* Inscrição municipal (optional) */}
            <Field label="Inscrição Municipal (opcional)">
              <input
                className={inputCls}
                placeholder="Número na prefeitura"
                value={form.inscricaoMunicipal}
                onChange={e => setField('inscricaoMunicipal', e.target.value)}
              />
            </Field>

            {apiError && (
              <div className="bg-nota-rejeitada/10 border border-nota-rejeitada/30 rounded-xl p-3 text-sm text-nota-rejeitada">
                {apiError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-200 text-text-2 font-semibold py-3 rounded-xl text-sm hover:border-brand-cyan/50 transition"
              >
                ← Voltar
              </button>
              <button
                onClick={submitRegistration}
                disabled={submitting}
                className="flex-1 bg-brand-cyan text-navy-900 font-bold py-3 rounded-xl text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Spinner />}
                {submitting ? 'Cadastrando...' : 'Cadastrar empresa'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Certificado A1 ── */}
        {step === 3 && success && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-text-1">Certificado A1</h2>
              <p className="text-text-2 text-sm mt-1">
                Faça upload do certificado digital A1 (.pfx) para assinar as NFS-e.
                Você pode pular esta etapa e configurar depois.
              </p>
            </div>

            {certUploaded ? (
              <div className="bg-nota-autorizada/10 border border-nota-autorizada/30 rounded-xl p-4 text-sm text-nota-autorizada font-medium text-center">
                ✓ Certificado enviado com sucesso!
              </div>
            ) : (
              <>
                <Field label="Arquivo .pfx" error={certError}>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand-cyan/50 transition overflow-hidden"
                    onClick={() => certFileRef.current?.click()}
                  >
                    {form.certFile ? (
                      // truncate keeps long file names from overflowing the dashed box.
                      <p
                        className="text-sm text-text-1 font-medium truncate"
                        title={form.certFile.name}
                      >
                        {form.certFile.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-text-2">Clique para selecionar o arquivo .pfx</p>
                        <p className="text-xs text-text-2 mt-1">Máximo 5 MB</p>
                      </>
                    )}
                    <input
                      ref={certFileRef}
                      type="file"
                      accept=".pfx,.p12"
                      className="hidden"
                      onChange={e => setField('certFile', e.target.files?.[0] ?? null)}
                    />
                  </div>
                </Field>

                <Field label="Senha do certificado">
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="Senha do arquivo .pfx"
                    value={form.certPassword}
                    onChange={e => setField('certPassword', e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>

                <button
                  onClick={uploadCert}
                  disabled={!form.certFile || certUploading}
                  className="w-full bg-brand-cyan text-navy-900 font-bold py-3 rounded-xl text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {certUploading && <Spinner />}
                  {certUploading ? 'Enviando...' : 'Enviar certificado'}
                </button>
              </>
            )}

            <button
              onClick={() => setStep(4)}
              className="w-full border border-gray-200 text-text-2 font-semibold py-3 rounded-xl text-sm hover:border-brand-cyan/50 transition"
            >
              {certUploaded ? 'Continuar →' : 'Pular por agora →'}
            </button>
          </div>
        )}

        {/* ── Step 4: API Key ── */}
        {step === 4 && success && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-nota-autorizada/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-nota-autorizada" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-text-1">Empresa cadastrada!</h2>
              <p className="text-text-2 text-sm mt-1">
                {success.tipo} · {REGIME_LABELS[success.regime] ?? success.regime}
              </p>
            </div>

            {/* Trial notice */}
            <div className="bg-brand-cyan/5 border border-brand-cyan/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-brand-cyan mb-1">✦ Período trial ativo</p>
              <p className="text-xs text-text-2">
                Você tem acesso completo durante o período de avaliação. O plano comercial estará disponível em breve.
              </p>
            </div>

            {/* API Key */}
            <div>
              <p className="text-sm font-semibold text-text-1 mb-2">Sua API Key</p>
              <div className="bg-navy-900 rounded-xl p-4 flex items-center gap-3 border border-navy-600">
                <code className="flex-1 text-xs text-brand-cyan font-mono break-all select-all">
                  {success.apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="shrink-0 text-xs bg-navy-700 hover:bg-navy-600 text-text-2 px-3 py-1.5 rounded-lg transition"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-nota-rejeitada mt-2 font-medium">
                ⚠ Guarde esta chave agora — ela não será exibida novamente.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL?.replace('api.', '')}/docs`}
                className="block w-full text-center border border-gray-200 text-text-2 font-semibold py-3 rounded-xl text-sm hover:border-brand-cyan/50 transition"
              >
                Ver documentação →
              </a>
              <Link
                href="/login"
                className="block w-full text-center bg-brand-cyan text-navy-900 font-bold py-3 rounded-xl text-sm hover:opacity-90 transition"
              >
                Ir para o dashboard
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
