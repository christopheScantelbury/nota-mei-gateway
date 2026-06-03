'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface SuccessState {
  userId: string
  apiKey: string
  email: string
}

export default function CadastroDevClient() {
  const [nome, setNome]                 = useState('')
  const [email, setEmail]               = useState('')
  const [empresaTrabalha, setEmpresaTrabalha] = useState('')
  const [aceiteTermos, setAceiteTermos] = useState(false)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'nome'|'email', string>>>({})
  const [success, setSuccess]   = useState<SuccessState | null>(null)
  const [copied, setCopied]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Validações client-side
    const errs: typeof fieldErrors = {}
    if (!nome.trim() || nome.trim().length < 2) errs.nome = 'Informe seu nome'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'E-mail inválido'
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }

    if (!aceiteTermos) {
      setError('Você precisa aceitar os termos de uso pra continuar.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          empresa_trabalha: empresaTrabalha.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('E-mail já cadastrado. Vá para Entrar.')
        } else if (data.field === 'email') {
          setFieldErrors({ email: data.message })
        } else if (data.field === 'nome') {
          setFieldErrors({ nome: data.message })
        } else {
          setError(data.message ?? 'Erro ao cadastrar. Tente novamente.')
        }
        return
      }

      setSuccess({
        userId: data.user_id,
        apiKey: data.api_key,
        email: email.trim().toLowerCase(),
      })
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function copyKey() {
    if (!success) return
    try {
      await navigator.clipboard.writeText(success.apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  // ── Success: API Key + próximos passos ────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 sm:p-8 w-full max-w-lg space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h1 className="font-display text-2xl font-extrabold text-text-1 mb-2">
              Conta criada! Você está em modo sandbox.
            </h1>
            <p className="text-text-2 text-sm">
              Pode brincar com a API agora — sem precisar cadastrar empresa.
              Quando for emitir notas reais em produção, você adiciona empresas
              emissoras no painel.
            </p>
          </div>

          <div className="bg-navy-900 border border-navy-600 rounded-lg p-3 sm:p-4">
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-1">
              Sua API Key (sandbox)
            </p>
            <p className="font-mono text-[11px] sm:text-xs text-brand-cyan break-all select-all">
              {success.apiKey}
            </p>
          </div>
          <Button variant="outline" fullWidth onClick={copyKey}>
            {copied ? '✅ Copiado!' : '📋 Copiar API Key'}
          </Button>

          <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 text-xs text-amber-200">
            <p className="font-semibold mb-1">⚠️ Guarde com segurança</p>
            <p>Esta chave não será exibida novamente. Use só em <strong>sandbox</strong>: não emite notas reais.</p>
          </div>

          <div className="border-t border-navy-600 pt-4 flex flex-col gap-2">
            <Link
              href="/docs/quickstart"
              className="block text-center text-sm bg-brand-cyan text-navy-900 font-bold px-4 py-2.5 rounded-lg hover:bg-brand-cyan/90 transition"
            >
              Ver Quickstart →
            </Link>
            <Link
              href="/sandbox"
              className="block text-center text-sm border border-navy-600 text-text-1 font-semibold px-4 py-2.5 rounded-lg hover:border-brand-cyan transition"
            >
              Testar no Sandbox
            </Link>
            <p className="text-center text-xs text-text-2 mt-2">
              Já enviamos um link de acesso pro seu e-mail{' '}
              <strong className="text-text-1">{success.email}</strong>.
            </p>
          </div>
        </div>
      </main>
    )
  }

  // ── Form de cadastro ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 sm:p-8 w-full max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <span className="inline-block text-xs font-semibold bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 rounded-full px-3 py-1 mb-3">
            👨‍💻 Cadastro de Desenvolvedor
          </span>
          <h1 className="font-display text-2xl font-extrabold text-text-1 leading-tight">
            Cadastro rápido — sem CNPJ
          </h1>
          <p className="text-text-2 text-sm mt-2 leading-relaxed">
            Você é dev integrando a API de NFS-e? Recebe sua chave de sandbox
            em segundos. As empresas emissoras você cadastra depois, quando
            for pra produção.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Seu nome"
            type="text"
            placeholder="Christophe Scantelbury"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={fieldErrors.nome}
            required
            autoFocus
            autoComplete="name"
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="dev@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
            autoComplete="email"
          />

          <Input
            label="Empresa onde você trabalha (opcional)"
            type="text"
            placeholder="Acme Inc"
            value={empresaTrabalha}
            onChange={(e) => setEmpresaTrabalha(e.target.value)}
            autoComplete="organization"
          />

          <div className="bg-brand-cyan/5 border border-brand-cyan/20 rounded-lg p-3 flex items-start gap-2">
            <span aria-hidden className="shrink-0 mt-0.5">📧</span>
            <p className="text-xs text-text-2 leading-relaxed">
              Vamos enviar um <strong className="text-text-1">link mágico</strong> pro seu e-mail
              pra confirmar a conta e fazer login. Sem senha pra decorar.
            </p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={aceiteTermos}
              onChange={(e) => setAceiteTermos(e.target.checked)}
              className="mt-1 accent-brand-cyan"
            />
            <span className="text-xs text-text-2 leading-relaxed">
              Concordo com os{' '}
              <Link href="/termos" target="_blank" className="text-brand-cyan hover:underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" className="text-brand-cyan hover:underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          {error && (
            <div className="bg-nota-rejeitada/10 border border-nota-rejeitada/30 text-nota-rejeitada rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Criando conta…' : 'Criar conta e gerar API Key'}
          </Button>

          <p className="text-xs text-text-2 text-center pt-1">
            Já tem conta?{' '}
            <Link href="/login?produto=gateway" className="text-brand-cyan hover:underline">
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
