'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { validatePassword, passwordStrengthLabel } from '@/lib/auth/password'

interface SenhaFormProps {
  hasPassword: boolean
  userEmail: string
}

export default function SenhaForm({ hasPassword, userEmail }: SenhaFormProps) {
  const [newPassword, setNewPassword]     = useState('')
  const [confirm, setConfirm]             = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)

  const validation = validatePassword(newPassword)
  const strength   = passwordStrengthLabel(validation.score)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm
  const canSubmit = validation.ok && passwordsMatch && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: sbError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (sbError) {
      // Supabase só rejeita se a sessão expirou ou política do projeto for
      // mais estrita que a nossa. Mensagem amigável genérica.
      setError(
        sbError.message.includes('session')
          ? 'Sessão expirada. Faça login novamente.'
          : 'Não foi possível atualizar a senha. Tente novamente.',
      )
      return
    }

    setSuccess(true)
    setNewPassword('')
    setConfirm('')
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/configuracoes" className="text-xs text-text-2 hover:text-brand-cyan">
          ← Voltar para Configurações
        </Link>
      </div>

      <div className="bg-white dark:bg-navy-700 border border-gray-200 dark:border-navy-600 rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-display font-extrabold text-text-1 mb-2">
          {hasPassword ? 'Trocar senha' : 'Definir senha'}
        </h1>
        <p className="text-text-2 text-sm mb-6">
          {hasPassword
            ? 'Defina uma nova senha. Você pode continuar usando o login por código no e-mail também.'
            : 'Sua conta hoje usa só código por e-mail. Defina uma senha pra ter um login alternativo (útil pra testes e acesso rápido).'}
        </p>

        {success ? (
          <div
            role="status"
            className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-800 dark:text-emerald-300"
          >
            <p className="font-semibold mb-1">Senha {hasPassword ? 'atualizada' : 'definida'} com sucesso ✓</p>
            <p>
              A partir de agora você pode entrar em <Link href="/login" className="underline">/login</Link> usando{' '}
              <strong className="break-all">{userEmail}</strong> + sua senha.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />

            {/* Barra de força */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < validation.score ? strength.color : 'bg-gray-200 dark:bg-navy-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-2">Força: <span className="font-semibold text-text-1">{strength.label}</span></p>
                {validation.errors.length > 0 && (
                  <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                    {validation.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              error={
                confirm.length > 0 && !passwordsMatch
                  ? 'As senhas não coincidem'
                  : undefined
              }
            />

            {error && (
              <p className="text-sm text-nota-rejeitada" role="alert">{error}</p>
            )}

            <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full" size="lg">
              {hasPassword ? 'Trocar senha' : 'Definir senha'}
            </Button>

            <p className="text-xs text-text-2">
              ℹ️ Você está autenticado nesta sessão — não pedimos a senha antiga.
              Se você não foi quem iniciou esta troca, faça logout em todos os dispositivos.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
