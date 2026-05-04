'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'form' | 'sent'

export default function LoginClient() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/home'
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [step, setStep]   = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(
    errorParam === 'auth_callback_failed' ? 'O link de acesso expirou ou é inválido. Solicite um novo.' : null
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false, // only existing MEI accounts can login
      },
    })

    setLoading(false)
    if (sbError) {
      setError(sbError.message === 'Signups not allowed for otp'
        ? 'E-mail não cadastrado. Faça seu cadastro primeiro.'
        : sbError.message)
      return
    }
    setStep('sent')
  }

  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="font-display text-2xl font-extrabold text-text-1 mb-2">
            Verifique seu e-mail
          </h1>
          <p className="text-text-2 text-sm mb-6">
            Enviamos um link de acesso para{' '}
            <strong className="text-text-1">{email}</strong>.{' '}
            Clique no link para entrar — ele expira em 1 hora.
          </p>
          <Button
            variant="ghost"
            className="text-xs text-text-2"
            onClick={() => setStep('form')}
          >
            ← Usar outro e-mail
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="font-display font-extrabold text-2xl text-brand-cyan tracking-tight">
            Nota MEI Gateway
          </span>
          <p className="text-text-2 text-sm mt-1">Entre com Magic Link — sem senha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="contato@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            error={error ?? undefined}
          />

          <Button
            type="submit"
            loading={loading}
            className="w-full"
            size="lg"
          >
            Enviar link de acesso
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-text-2">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-brand-cyan hover:underline">
              Cadastrar MEI
            </Link>
          </p>
          <p className="text-xs text-text-2">
            <Link href="/recuperar-senha" className="text-text-2 hover:text-brand-cyan transition">
              Problemas para entrar?
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
