'use client'

/**
 * FeedbackButton (#247) — botão flutuante fixo bottom-right do dashboard.
 *
 * Click abre modal com:
 * - Tipo: bug | sugestao | duvida | elogio
 * - Mensagem (max 2000 chars)
 * - Screenshot opcional (drop file ou capturar tela com getDisplayMedia)
 *
 * Envia pra POST /api/feedback.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import notify from '@/lib/notify'

type Tipo = 'bug' | 'sugestao' | 'duvida' | 'elogio'

const TIPOS: { value: Tipo; label: string; icon: string }[] = [
  { value: 'bug',      label: 'Bug / problema', icon: '🐛' },
  { value: 'sugestao', label: 'Sugestão',       icon: '💡' },
  { value: 'duvida',   label: 'Dúvida',         icon: '❓' },
  { value: 'elogio',   label: 'Elogio',         icon: '💚' },
]

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        className="fixed bottom-4 right-4 z-40 bg-brand-cyan text-navy-900 font-semibold rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-2xl hover:scale-105 transition"
        title="Reportar bug, dúvida ou sugestão"
      >
        💬
      </button>
      {open && <FeedbackModal pathname={pathname} onClose={() => setOpen(false)} />}
    </>
  )
}

function FeedbackModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const [tipo, setTipo] = useState<Tipo>('bug')
  const [mensagem, setMensagem] = useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fecha modal com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleFile(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      notify.error('Imagem muito grande', 'Máximo 3MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify.error('Formato não suportado', 'Use JPG, PNG ou WebP')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setScreenshotDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function captureScreen() {
    try {
      const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      // ImageCapture pra grab frame único — fallback canvas se não suportar
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      track.stop()
      video.remove()
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setScreenshotDataUrl(dataUrl)
    } catch (e) {
      // Usuário cancelou ou navegador não suporta — silent
      if (process.env.NODE_ENV !== 'production') {
        console.warn('captureScreen:', e)
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mensagem.trim().length < 5) {
      notify.error('Mensagem muito curta', 'Pelo menos 5 caracteres')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          mensagem: mensagem.trim(),
          url: pathname,
          screenshotDataUrl,
        }),
      })
      if (res.ok) {
        notify.success('Obrigado!', 'Recebemos seu feedback.')
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        notify.error('Erro ao enviar', data.message ?? `HTTP ${res.status}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={submit}
        className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-auto"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-display text-xl font-extrabold">Enviar feedback</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-2 hover:text-text-1 text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-2 uppercase">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`p-3 rounded-lg border text-sm text-left ${
                    tipo === t.value
                      ? 'border-brand-cyan bg-brand-cyan/10 text-text-1'
                      : 'border-navy-600 text-text-2 hover:border-navy-600/70'
                  }`}
                >
                  <span className="mr-2">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">
              Mensagem
            </label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={2000}
              rows={5}
              required
              placeholder={
                tipo === 'bug'
                  ? 'Descreva o que aconteceu: o que você estava tentando fazer, o que aconteceu e o que esperava.'
                  : tipo === 'sugestao'
                    ? 'Qual feature ou melhoria você gostaria de ver?'
                    : tipo === 'duvida'
                      ? 'Qual sua dúvida? Vou responder por email.'
                      : 'O que você está curtindo na NotaFácil?'
              }
              className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <p className="text-xs text-text-2 mt-1 text-right">
              {mensagem.length} / 2000
            </p>
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-2 uppercase">
              Screenshot (opcional)
            </label>
            {screenshotDataUrl ? (
              <div className="relative">
                <img
                  src={screenshotDataUrl}
                  alt="preview"
                  className="rounded-lg border border-navy-600 max-h-40 mx-auto"
                />
                <button
                  type="button"
                  onClick={() => setScreenshotDataUrl(null)}
                  className="absolute top-1 right-1 bg-navy-900/80 text-text-1 rounded-full w-6 h-6 text-xs"
                  aria-label="Remover screenshot"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 hover:border-navy-600/70"
                >
                  📁 Anexar arquivo
                </button>
                <button
                  type="button"
                  onClick={captureScreen}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 hover:border-navy-600/70"
                >
                  📸 Capturar tela
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-2 hover:text-text-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || mensagem.trim().length < 5}
              className="bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {submitting ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
