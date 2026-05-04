'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MunicipioAutocomplete } from '@/components/ui/MunicipioAutocomplete'
import { validarCNPJ } from '@/lib/cnpj'

// ── Helpers ──────────────────────────────────────────────────────────────────
function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) =>
    d.split('').slice(0, len).reduce((s, n, i) => s + parseInt(n) * (len + 1 - i), 0)
  const r1 = (calc(9) * 10) % 11
  const r2 = (calc(10) * 10) % 11
  return parseInt(d[9]) === (r1 > 9 ? 0 : r1) && parseInt(d[10]) === (r2 > 9 ? 0 : r2)
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Field + Label ─────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-1">{label}</label>
      {children}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition'

// ── Main Component ────────────────────────────────────────────────────────────
type TipoDoc = 'PJ' | 'PF'

interface FormErrors {
  codigoNbs?: string
  discriminacao?: string
  valorServico?: string
  tipoPessoa?: string
  documento?: string
  razaoSocial?: string
  emailTomador?: string
  municipioIbge?: string
  competencia?: string
}

export default function NovaNota() {
  // Serviço
  const [codigoNbs, setCodigoNbs] = useState('')
  const [discriminacao, setDiscriminacao] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [aliquotaIss, setAliquotaIss] = useState('2.0')
  const [competencia, setCompetencia] = useState(currentMonth())

  // Tomador
  const [tipoPessoa, setTipoPessoa] = useState<TipoDoc>('PJ')
  const [documento, setDocumento] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [emailTomador, setEmailTomador] = useState('')
  const [municipioIbge, setMunicipioIbge] = useState('')

  // Opcionais
  const [webhookUrl, setWebhookUrl] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')

  // UI state
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notaId, setNotaId] = useState('')
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [])

  // ISS preview
  const issEstimado = (() => {
    const v = parseFloat(valorServico.replace(',', '.'))
    const a = parseFloat(aliquotaIss.replace(',', '.'))
    if (isNaN(v) || isNaN(a) || v <= 0 || a < 0) return null
    return (v * a) / 100
  })()

  // Document formatting
  function handleDocumento(raw: string) {
    setDocumento(tipoPessoa === 'PJ' ? formatCNPJ(raw) : formatCPF(raw))
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!codigoNbs.trim()) errs.codigoNbs = 'Código NBS obrigatório'
    if (!discriminacao.trim()) errs.discriminacao = 'Discriminação obrigatória'
    const v = parseFloat(valorServico.replace(',', '.'))
    if (isNaN(v) || v <= 0) errs.valorServico = 'Valor deve ser maior que zero'
    if (!competencia) errs.competencia = 'Competência obrigatória'

    const docDigits = documento.replace(/\D/g, '')
    if (tipoPessoa === 'PJ') {
      if (!validarCNPJ(docDigits)) errs.documento = 'CNPJ inválido — verifique os dígitos'
    } else {
      if (!validarCPF(docDigits)) errs.documento = 'CPF inválido — verifique os dígitos'
    }
    if (!razaoSocial.trim()) errs.razaoSocial = 'Nome / razão social obrigatório'
    if (!emailTomador.trim() || !emailTomador.includes('@')) errs.emailTomador = 'E-mail inválido'
    if (!municipioIbge) errs.municipioIbge = 'Município obrigatório'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')
    if (!validate()) return
    if (submitting) return

    setSubmitting(true)
    try {
      const payload = {
        servico: {
          codigo_nbs: codigoNbs.trim(),
          discriminacao: discriminacao.trim(),
          valor: parseFloat(valorServico.replace(',', '.')),
          aliquota_iss: parseFloat(aliquotaIss.replace(',', '.')),
        },
        tomador: {
          tipo: tipoPessoa,
          documento: documento.replace(/\D/g, ''),
          razao_social: razaoSocial.trim(),
          email: emailTomador.trim(),
          municipio_ibge: municipioIbge,
        },
        competencia,
        ...(webhookUrl.trim() ? { webhook_url: webhookUrl.trim() } : {}),
        idempotency_key: idempotencyKey,
      }

      const res = await fetch('/api/nfse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok || res.status === 202) {
        setNotaId(data.nota_id ?? '')
        setSubmitted(true)
      } else {
        const msg = data.message ?? data.error ?? 'Erro ao emitir a nota. Tente novamente.'
        if (data.error === 'PLAN_LIMIT_REACHED') {
          setApiError('Limite do plano atingido. Faça upgrade para continuar emitindo.')
        } else {
          setApiError(msg)
        }
      }
    } catch {
      setApiError('Não foi possível conectar ao servidor. Verifique sua conexão.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state
  if (submitted) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="rounded-xl border border-nota-autorizada/40 bg-nota-autorizada/10 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-display text-xl font-bold text-nota-autorizada mb-2">
            Nota enviada para processamento
          </h2>
          <p className="text-text-2 text-sm mb-6">
            A Receita Federal irá processar sua NFS-e em instantes. Você receberá o resultado via webhook.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {notaId && (
              <Link
                href={`/notas/${notaId}`}
                className="bg-brand-cyan text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition"
              >
                Ver status da nota →
              </Link>
            )}
            <Link
              href="/notas"
              className="border border-navy-600 text-text-1 font-semibold text-sm px-5 py-2.5 rounded-lg hover:border-brand-cyan transition"
            >
              Ver todas as notas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Emitir NFS-e</h1>
        <p className="text-text-2 mt-1 text-sm">Preencha os dados abaixo para emitir uma nova nota fiscal.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">

        {/* API error banner */}
        {apiError && (
          <div className="rounded-xl border border-nota-rejeitada/40 bg-nota-rejeitada/10 px-4 py-3 text-sm text-nota-rejeitada">
            {apiError}
          </div>
        )}

        {/* Seção 1 — Serviço */}
        <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg">1. Dados do Serviço</h2>

          <Field label="Código NBS" error={errors.codigoNbs}>
            <input
              type="text"
              className={inputCls}
              placeholder="Ex: 01.01.01.10"
              value={codigoNbs}
              onChange={e => setCodigoNbs(e.target.value)}
            />
            <p className="text-xs text-text-2">Código Nacional de Bens e Serviços da atividade prestada</p>
          </Field>

          <Field label="Discriminação do serviço" error={errors.discriminacao}>
            <div className="relative">
              <textarea
                className={`${inputCls} w-full resize-none h-24`}
                placeholder="Descreva o serviço prestado conforme o contrato..."
                maxLength={500}
                value={discriminacao}
                onChange={e => setDiscriminacao(e.target.value)}
              />
              <span className="absolute bottom-2 right-3 text-xs text-text-2">
                {discriminacao.length}/500
              </span>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor do serviço (R$)" error={errors.valorServico}>
              <input
                type="number"
                className={inputCls}
                placeholder="0,00"
                min="0.01"
                step="0.01"
                value={valorServico}
                onChange={e => setValorServico(e.target.value)}
              />
            </Field>
            <Field label="Alíquota ISS (%)">
              <input
                type="number"
                className={inputCls}
                min="0"
                max="5"
                step="0.1"
                value={aliquotaIss}
                onChange={e => setAliquotaIss(e.target.value)}
              />
            </Field>
          </div>

          {/* ISS preview */}
          {issEstimado !== null && (
            <div className="flex items-center gap-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-lg px-4 py-2.5">
              <span className="text-xs text-brand-cyan font-semibold">ISS estimado:</span>
              <span className="text-sm font-mono text-brand-cyan">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(issEstimado)}
              </span>
            </div>
          )}

          <Field label="Competência" error={errors.competencia}>
            <input
              type="month"
              className={inputCls}
              value={competencia}
              onChange={e => setCompetencia(e.target.value)}
            />
          </Field>
        </section>

        {/* Seção 2 — Tomador */}
        <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg">2. Dados do Tomador</h2>

          {/* PF / PJ toggle */}
          <div>
            <p className="text-sm font-medium text-text-1 mb-2">Tipo de pessoa</p>
            <div className="flex gap-2">
              {(['PJ', 'PF'] as TipoDoc[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTipoPessoa(t); setDocumento('') }}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                    tipoPessoa === t
                      ? 'bg-brand-cyan text-navy-900'
                      : 'border border-navy-600 text-text-2 hover:border-brand-cyan'
                  }`}
                >
                  {t === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </button>
              ))}
            </div>
          </div>

          <Field label={tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'} error={errors.documento}>
            <input
              type="text"
              className={inputCls}
              placeholder={tipoPessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              value={documento}
              onChange={e => handleDocumento(e.target.value)}
            />
          </Field>

          <Field label={tipoPessoa === 'PJ' ? 'Razão social' : 'Nome completo'} error={errors.razaoSocial}>
            <input
              type="text"
              className={inputCls}
              placeholder={tipoPessoa === 'PJ' ? 'Empresa Cliente LTDA' : 'João da Silva'}
              value={razaoSocial}
              onChange={e => setRazaoSocial(e.target.value)}
            />
          </Field>

          <Field label="E-mail do tomador" error={errors.emailTomador}>
            <input
              type="email"
              className={inputCls}
              placeholder="financeiro@empresa.com"
              value={emailTomador}
              onChange={e => setEmailTomador(e.target.value)}
            />
          </Field>

          <Field label="Município do tomador" error={errors.municipioIbge}>
            <MunicipioAutocomplete
              value={municipioIbge}
              onChange={(code: string) => setMunicipioIbge(code)}
              error={errors.municipioIbge}
            />
          </Field>
        </section>

        {/* Seção 3 — Configurações (collapsible) */}
        <details className="rounded-xl border border-navy-600 bg-navy-700">
          <summary className="px-6 py-4 font-semibold text-sm cursor-pointer list-none flex justify-between items-center">
            <span>3. Configurações opcionais</span>
            <span className="text-brand-cyan text-lg group-open:rotate-45 transition-transform">+</span>
          </summary>
          <div className="px-6 pb-6 flex flex-col gap-4">
            <Field label="URL de webhook (esta nota)">
              <input
                type="url"
                className={inputCls}
                placeholder="https://seu-erp.com/webhooks/nfse"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
              />
            </Field>

            <Field label="Chave de idempotência">
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`${inputCls} flex-1 font-mono text-xs`}
                  value={idempotencyKey}
                  onChange={e => setIdempotencyKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(crypto.randomUUID())}
                  className="border border-navy-600 text-text-2 text-xs px-3 py-2 rounded-lg hover:border-brand-cyan hover:text-brand-cyan transition"
                  title="Gerar novo UUID"
                >
                  ↺
                </button>
              </div>
              <p className="text-xs text-text-2">Reenvie com a mesma chave para evitar duplicatas.</p>
            </Field>
          </div>
        </details>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Spinner />
                Enviando...
              </>
            ) : (
              'Emitir nota'
            )}
          </button>
          <Link href="/notas" className="text-sm text-text-2 hover:text-text-1 transition">
            Cancelar
          </Link>
        </div>

      </form>
    </div>
  )
}
