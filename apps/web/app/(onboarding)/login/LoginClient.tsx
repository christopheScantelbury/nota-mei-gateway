'use client'

import { useState, useRef, FormEvent, KeyboardEvent, ClipboardEvent, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'email' | 'otp'

const OTP_LENGTH     = 6
const RESEND_COOLDOWN = 60 // seconds

// ── OTP boxes ─────────────────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (digits: string[]) => void
  disabled?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(idx: number) {
    refs.current[idx]?.focus()
  }

  function handleKey(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[idx]) {
        const next = [...value]; next[idx] = ''; onChange(next)
      } else if (idx > 0) {
        const next = [...value]; next[idx - 1] = ''; onChange(next); focusBox(idx - 1)
      }
    } else if (e.key === 'ArrowLeft'  && idx > 0)              focusBox(idx - 1)
    else if   (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) focusBox(idx + 1)
  }

  function handleChange(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const next = [...value]; next[idx] = digit; onChange(next)
    if (idx < OTP_LENGTH - 1) focusBox(idx + 1)
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    const next = [...value]
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    onChange(next)
    focusBox(Math.min(text.length, OTP_LENGTH - 1))
  }

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Código de verificação">
      {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[idx] ?? ''}
          disabled={disabled}
          aria-label={`Dígito ${idx + 1}`}
          className={[
            'w-11 h-14 text-center text-xl font-bold rounded-lg border transition-all outline-none',
            'bg-white text-gray-900 border-gray-300',
            'focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30',
            'dark:bg-navy-800 dark:text-text-1 dark:border-navy-500 dark:focus:border-brand-cyan',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
            value[idx] ? 'border-brand-cyan bg-brand-cyan/5 dark:bg-brand-cyan/10' : '',
          ].join(' ')}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKey(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </div>
  )
}

// ── Resend button with cooldown ────────────────────────────────────────────────

function ResendButton({ onResend, disabled }: { onResend: () => Promise<void>; disabled?: boolean }) {
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  async function handleResend() {
    setLoading(true)
    await onResend()
    setLoading(false)
    setSeconds(RESEND_COOLDOWN)
  }

  if (seconds > 0) {
    return (
      <p className="text-xs text-text-2 text-center">
        Reenviar código em{' '}
        <span className="font-medium text-text-1 tabular-nums">{seconds}s</span>
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={disabled || loading}
      className="text-xs text-brand-cyan hover:underline disabled:opacity-50 transition mx-auto block"
    >
      {loading ? 'Enviando…' : 'Reenviar código'}
    </button>
  )
}

// ── Main LoginClient ───────────────────────────────────────────────────────────

export default function LoginClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/home'
  const produto      = searchParams.get('produto') // 'mei' | 'me' | null (gateway)
  const isMei        = produto === 'mei'
  const isMe         = produto === 'me'
  const errorParam   = searchParams.get('error')

  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(
    errorParam === 'auth_callback_failed'
      ? 'O link expirou ou é inválido. Solicite um novo código.'
      : null,
  )

  // ── Step 1: enviar OTP ─────────────────────────────────────────────────────

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    })

    setLoading(false)

    if (sbError) {
      setError(
        sbError.message === 'Signups not allowed for otp'
          ? 'E-mail não cadastrado. Faça seu cadastro primeiro.'
          : 'Não foi possível enviar o código. Tente novamente.',
      )
      return
    }

    setOtp(Array(OTP_LENGTH).fill(''))
    setStep('otp')
  }

  async function handleResend() {
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
  }

  // ── Step 2: verificar OTP + redirecionar para o domínio do produto ─────────

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    const token = otp.join('')
    if (token.length < OTP_LENGTH) {
      setError('Digite todos os 6 dígitos.')
      return
    }

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: otpData, error: sbError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    })

    if (sbError) {
      setLoading(false)
      setError('Código incorreto ou expirado. Confira o e-mail ou solicite um novo.')
      setOtp(Array(OTP_LENGTH).fill(''))
      return
    }

    // Sessão estabelecida — redireciona para o destino no mesmo domínio
    const target = next.startsWith('/') ? next : '/home'
    router.replace(target)
  }

  // ── Logo por produto ───────────────────────────────────────────────────────

  const logo = isMei ? (
    <Image src="/brand/notafacil-mei.svg"     alt="Nota Fácil MEI"      width={160} height={44} className="h-9 w-auto" priority />
  ) : isMe ? (
    <Image src="/brand/notafacil-empresa.svg" alt="NotaFácil Empresa"   width={180} height={44} className="h-9 w-auto" priority />
  ) : (
    <Image src="/brand/notafacil-api.svg"     alt="NotaFácil API"       width={160} height={40} className="h-8 w-auto" priority />
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="bg-white dark:bg-navy-700 border border-gray-200 dark:border-navy-600 rounded-2xl shadow-sm p-8 w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href={isMei ? '/mei' : isMe ? '/me' : '/gateway'} className="inline-flex justify-center mb-3">
            {logo}
          </Link>
          <p className="text-text-2 text-sm">
            {step === 'email' ? 'Acesse sua conta' : 'Verifique seu e-mail'}
          </p>
        </div>

        {/* ── STEP 1: e-mail ── */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Enviar código de acesso
            </Button>

            <div className="text-center pt-1">
              <p className="text-xs text-text-2">
                Não tem conta?{' '}
                <Link
                  href={isMei ? '/cadastro?produto=mei' : isMe ? '/cadastro/me' : '/cadastro?produto=gateway'}
                  className="text-brand-cyan hover:underline"
                >
                  Criar conta
                </Link>
              </p>
            </div>
          </form>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="text-center space-y-1 mb-2">
              <p className="text-sm text-text-2">Enviamos um código de 6 dígitos para</p>
              <p className="font-semibold text-text-1 text-sm break-all">{email}</p>
              <p className="text-xs text-text-2 mt-1">Verifique sua caixa de entrada (e o spam).</p>
            </div>

            <OtpInput
              value={otp}
              onChange={(digits) => { setOtp(digits); setError(null) }}
              disabled={loading}
            />

            {error && (
              <p className="text-xs text-nota-rejeitada text-center" role="alert">{error}</p>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={otp.join('').length < OTP_LENGTH}
              className="w-full"
              size="lg"
            >
              Entrar
            </Button>

            <ResendButton onResend={handleResend} disabled={loading} />

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setStep('email'); setError(null); setOtp(Array(OTP_LENGTH).fill('')) }}
              >
                ← Usar outro e-mail
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
