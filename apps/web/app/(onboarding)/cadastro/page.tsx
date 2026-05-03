'use client'

import { useState, useRef, FormEvent } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

type Step = 'form' | 'success'

interface FormState {
  cnpj: string
  razaoSocial: string
  email: string
  municipioIBGE: string
  certFile: File | null
  certPassword: string
}

interface SuccessState {
  meiId: string
  apiKey: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CadastroPage() {
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    cnpj: '',
    razaoSocial: '',
    email: '',
    municipioIBGE: '',
    certFile: null,
    certPassword: '',
  })

  function set(field: keyof FormState, value: string | File | null) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cnpjDigits = form.cnpj.replace(/\D/g, '')
    if (cnpjDigits.length !== 14) {
      setError('CNPJ deve conter 14 dígitos.')
      return
    }
    if (!form.razaoSocial.trim()) {
      setError('Razão Social é obrigatória.')
      return
    }
    if (!form.email.trim()) {
      setError('E-mail é obrigatório.')
      return
    }
    if (form.municipioIBGE.replace(/\D/g, '').length !== 7) {
      setError('Código IBGE do município deve ter 7 dígitos.')
      return
    }

    setLoading(true)
    try {
      // ── Step 1: Register MEI ──────────────────────────────────────────────
      const regRes = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: cnpjDigits,
          razao_social: form.razaoSocial.trim(),
          email: form.email.trim().toLowerCase(),
          municipio_ibge: form.municipioIBGE.replace(/\D/g, ''),
        }),
      })

      const regData = await regRes.json()
      if (!regRes.ok) {
        const msg =
          regData.message ??
          (regData.fields as { message: string }[] | undefined)
            ?.map((f) => f.message)
            .join('; ') ??
          'Erro ao cadastrar MEI.'
        setError(msg)
        return
      }

      const { mei_id: meiId, api_key: apiKey } = regData as {
        mei_id: string
        api_key: string
      }

      // ── Step 2: Upload certificate (optional — skip if no file provided) ──
      if (form.certFile && form.certPassword) {
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
          // Non-fatal: user can upload cert later from the dashboard.
          setError(
            `MEI cadastrado, mas o upload do certificado falhou: ${certData.message ?? certRes.status}. ` +
              'Faça o upload novamente em Configurações.',
          )
        }
      }

      setSuccess({ meiId, apiKey })
      setStep('success')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro de conexão. Verifique sua internet e tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function copyKey() {
    if (!success) return
    await navigator.clipboard.writeText(success.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === 'success' && success) {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-lg">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-display text-2xl font-extrabold text-text-1 mb-2">
            MEI cadastrado com sucesso!
          </h1>
          <p className="text-text-2 text-sm mb-6">
            Guarde sua API Key com segurança — ela <strong className="text-text-1">não será exibida novamente</strong>.
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

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan text-sm font-bold">
            1
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-text-1 leading-tight">
              Cadastrar MEI
            </h1>
            <p className="text-text-2 text-xs">Nota MEI Gateway</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CNPJ */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              CNPJ
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="XX.XXX.XXX/XXXX-XX"
              value={form.cnpj}
              onChange={(e) => set('cnpj', formatCNPJ(e.target.value))}
              required
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan"
            />
          </div>

          {/* Razão Social */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              Razão Social
            </label>
            <input
              type="text"
              placeholder="Nome Empresa ME"
              value={form.razaoSocial}
              onChange={(e) => set('razaoSocial', e.target.value)}
              required
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              E-mail
            </label>
            <input
              type="email"
              placeholder="contato@empresa.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan"
            />
          </div>

          {/* Município IBGE */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              Código IBGE do Município
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="3550308 (São Paulo)"
              maxLength={7}
              value={form.municipioIBGE}
              onChange={(e) => set('municipioIBGE', e.target.value.replace(/\D/g, '').slice(0, 7))}
              required
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan"
            />
            <p className="text-xs text-text-2 mt-1">
              Encontre em{' '}
              <a
                href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-cyan hover:underline"
              >
                ibge.gov.br
              </a>
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-navy-600 pt-2">
            <p className="text-xs text-text-2 mb-3">
              <strong className="text-text-1">Certificado A1</strong> — opcional agora, obrigatório
              para emitir notas.
            </p>
          </div>

          {/* Certificate file */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              Certificado A1 (.pfx / .p12)
            </label>
            <div
              className="w-full bg-navy-900 border border-dashed border-navy-600 rounded-lg px-3 py-4 text-center cursor-pointer hover:border-brand-cyan/50 transition"
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
              onChange={(e) => set('certFile', e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Certificate password */}
          <div>
            <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-1">
              Senha do Certificado
            </label>
            <input
              type="password"
              placeholder="Senha do arquivo .pfx"
              value={form.certPassword}
              onChange={(e) => set('certPassword', e.target.value)}
              autoComplete="new-password"
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:border-brand-cyan"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-nota-rejeitada/10 border border-nota-rejeitada/30 text-nota-rejeitada rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-cyan text-navy-900 font-bold text-sm px-4 py-3 rounded-lg hover:bg-brand-cyan/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cadastrando…' : 'Criar conta →'}
          </button>

          <p className="text-xs text-text-2 text-center">
            Já tem uma conta?{' '}
            <a href="/" className="text-brand-cyan hover:underline">
              Fazer login
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}
