'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  notaId: string
  defaultEmail?: string
}

export default function EnviarNotaEmail({ notaId, defaultEmail = '' }: Props) {
  const [open,    setOpen]    = useState(false)
  const [email,   setEmail]   = useState(defaultEmail)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/notas/${notaId}/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Erro ${res.status}`)
      }
      toast.success(`NFS-e enviada por e-mail para ${email.trim()}`)
      setOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar e-mail.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 rounded-lg border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan transition"
      >
        ✉ Enviar por e-mail
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-dialog-title"
        >
          <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 id="email-dialog-title" className="font-display text-xl font-extrabold mb-1">
              Enviar NFS-e por e-mail
            </h2>
            <p className="text-sm text-text-2 mb-5">
              O PDF e o XML da nota serão enviados para o endereço informado.
            </p>

            <label className="block text-sm font-medium text-text-2 mb-1" htmlFor="send-email">
              E-mail do destinatário
            </label>
            <input
              id="send-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="financeiro@empresa.com"
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder-text-2/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan mb-5"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={sending}
                className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-navy-600 text-text-2 hover:text-text-1 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !email.trim()}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 hover:opacity-90 transition disabled:opacity-50"
              >
                {sending && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-navy-900/40 border-t-navy-900 animate-spin" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
