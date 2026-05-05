'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'form' | 'sent'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [step, setStep]   = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setLoading(true)

    const supabase = createClient()
    // For Magic Link auth, "password recovery" is just a new OTP link.
    // We send a login link so the user can re-enter the dashboard.
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/notas`,
      },
    })

    setLoading(false)
    if (sbError) {
      setError(sbError.message)
      return
    }
    setStep('sent')
  }

  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="font-display text-2xl font-extrabold text-text-1 mb-2">
            Link enviado!
          </h1>
          <p className="text-text-2 text-sm mb-6">
            Enviamos um novo link de acesso para{' '}
            <strong className="text-text-1">{email}</strong>.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="w-full">
              ← Voltar para o login
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex justify-center">
            <Image
              src="/logos/gateway-logo-navbar-dark.svg"
              alt="Nota MEI Gateway"
              width={140}
              height={34}
              className="h-7 w-auto"
              priority
            />
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-text-1 mb-1">
            Novo link de acesso
          </h1>
          <p className="text-text-2 text-sm">
            Informe seu e-mail cadastrado para receber um novo link de acesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail cadastrado"
            type="email"
            placeholder="contato@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            error={error ?? undefined}
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Enviar link de acesso
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs text-text-2 hover:text-brand-cyan transition">
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  )
}
