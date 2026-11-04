'use client'

/**
 * SupportChat — botão "Ajuda" fixo no canto do dashboard + painel de chat.
 *
 * O assistente virtual (IA) responde na hora; quando ele transfere, a equipe
 * responde neste mesmo chat (e o cliente recebe aviso por e-mail).
 * Substitui o antigo FeedbackButton (#247).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import notify from '@/lib/notify'
import { EVENTO_ABRIR_SUPORTE, linkWhatsAppSuporte } from '@/lib/suporte/abrir'

type Autor = 'cliente' | 'ia' | 'atendente' | 'sistema'
type Status = 'ia' | 'aguardando_humano' | 'aguardando_cliente' | 'resolvido'

interface Msg {
  id: string
  autor: Autor
  conteudo: string
  anexo_url: string | null
  created_at: string
  pendente?: boolean
}

interface Ticket {
  id: string
  status: Status
}

const SUGESTOES = [
  'Minha nota foi rejeitada, o que faço?',
  'Quantas notas ainda posso emitir este mês?',
  'Meu certificado digital está válido?',
]

const VISTO_KEY = 'nf_suporte_visto'

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [carregado, setCarregado] = useState(false)
  const [naoLida, setNaoLida] = useState(false)
  const [textoInicial, setTextoInicial] = useState('')
  const pathname = usePathname()

  // Outros pontos do painel (menu, nota rejeitada, plano) abrem o chat via
  // abrirSuporte() — #258: canal de suporte visível onde o cliente precisa.
  useEffect(() => {
    function onAbrir(e: Event) {
      const msg = (e as CustomEvent<{ mensagem?: string }>).detail?.mensagem
      setTextoInicial(msg ?? '')
      setOpen(true)
    }
    window.addEventListener(EVENTO_ABRIR_SUPORTE, onAbrir)
    return () => window.removeEventListener(EVENTO_ABRIR_SUPORTE, onAbrir)
  }, [])

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/suporte', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { ticket: Ticket | null; mensagens: Msg[] }
      setTicket(data.ticket)
      setMensagens(data.mensagens)
      const ultimaEquipe = [...data.mensagens].reverse().find((m) => m.autor === 'atendente')
      let visto = ''
      try { visto = localStorage.getItem(VISTO_KEY) ?? '' } catch { /* modo privado */ }
      setNaoLida(Boolean(ultimaEquipe && ultimaEquipe.created_at > visto))
    } finally {
      setCarregado(true)
    }
  }, [])

  // Carrega uma vez (badge de resposta nova) e, com atendimento humano em
  // andamento, consulta periodicamente.
  useEffect(() => { void carregar() }, [carregar])
  const humano = ticket?.status === 'aguardando_humano' || ticket?.status === 'aguardando_cliente'
  useEffect(() => {
    if (!humano) return
    const id = setInterval(() => { void carregar() }, open ? 8000 : 60000)
    return () => clearInterval(id)
  }, [humano, open, carregar])

  useEffect(() => {
    if (!open) return
    setNaoLida(false)
    try { localStorage.setItem(VISTO_KEY, new Date().toISOString()) } catch { /* ignore */ }
  }, [open, mensagens])

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir ajuda"
          className="fixed bottom-4 right-4 z-40 bg-brand-cyan text-navy-900 font-semibold rounded-full shadow-lg h-12 pl-4 pr-5 flex items-center gap-2 hover:scale-105 transition"
        >
          <span aria-hidden="true" className="text-lg">💬</span>
          Ajuda
          {naoLida && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-nota-rejeitada border-2 border-navy-900" aria-label="Resposta nova" />
          )}
        </button>
      )}
      {open && (
        <ChatPanel
          ticket={ticket}
          mensagens={mensagens}
          carregado={carregado}
          pathname={pathname}
          textoInicial={textoInicial}
          onClose={() => { setOpen(false); setTextoInicial('') }}
          onAtualizado={(t, m) => { setTicket(t); setMensagens(m) }}
          onOtimista={(m) => setMensagens((prev) => [...prev, m])}
          onDesfazer={(id) => setMensagens((prev) => prev.filter((m) => m.id !== id))}
        />
      )}
    </>
  )
}

function ChatPanel({
  ticket, mensagens, carregado, pathname, textoInicial, onClose, onAtualizado, onOtimista, onDesfazer,
}: {
  ticket: Ticket | null
  mensagens: Msg[]
  carregado: boolean
  pathname: string
  textoInicial: string
  onClose: () => void
  onAtualizado: (t: Ticket | null, m: Msg[]) => void
  onOtimista: (m: Msg) => void
  onDesfazer: (id: string) => void
}) {
  const [texto, setTexto] = useState(textoInicial)
  const [anexo, setAnexo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }) }, [mensagens, enviando])
  useEffect(() => { inputRef.current?.focus() }, [])

  function escolherArquivo(file: File) {
    if (file.size > 3 * 1024 * 1024) return notify.error('Imagem muito grande', 'Máximo 3 MB', { skipScroll: true })
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return notify.error('Formato não suportado', 'Use JPG, PNG ou WebP', { skipScroll: true })
    }
    const reader = new FileReader()
    reader.onload = () => setAnexo(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function enviar(conteudoForcado?: string) {
    const conteudo = (conteudoForcado ?? texto).trim()
    if (!conteudo || enviando) return
    const tempId = `tmp-${Date.now()}`
    onOtimista({ id: tempId, autor: 'cliente', conteudo, anexo_url: anexo, created_at: new Date().toISOString(), pendente: true })
    setTexto('')
    const anexoEnviado = anexo
    setAnexo(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo, anexo: anexoEnviado, pagina: pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onDesfazer(tempId)
        setTexto(conteudo)
        setAnexo(anexoEnviado)
        notify.error('Mensagem não enviada', data.message ?? `Erro ${res.status}`, { skipScroll: true })
        return
      }
      onAtualizado(data.ticket, data.mensagens)
    } catch {
      onDesfazer(tempId)
      setTexto(conteudo)
      notify.error('Sem conexão', 'Tente de novo em instantes.', { skipScroll: true })
    } finally {
      setEnviando(false)
    }
  }

  const status = ticket?.status
  const subtitulo =
    status === 'aguardando_humano' ? 'Um atendente vai responder aqui — avisamos também por e-mail'
    : status === 'aguardando_cliente' ? 'A equipe respondeu — continue por aqui'
    : 'Assistente virtual · responde na hora'
  const esperandoIA = enviando && (!status || status === 'ia' || status === 'resolvido')

  return (
    <div
      role="dialog"
      aria-label="Ajuda NotaFácil"
      className="fixed z-50 inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[400px] sm:h-[min(620px,calc(100vh-2rem))] bg-navy-700 sm:border border-navy-600 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-navy-600 bg-navy-800">
        <div className="min-w-0">
          <p className="font-display font-extrabold text-text-1">Ajuda NotaFácil</p>
          <p className="text-xs text-text-2 truncate">{subtitulo}</p>
          <a
            href={linkWhatsAppSuporte()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-cyan hover:underline"
          >
            Prefere WhatsApp? Fale com a equipe →
          </a>
        </div>
        <button onClick={onClose} className="text-text-2 hover:text-text-1 text-2xl leading-none min-w-[44px] min-h-[44px] -mr-2 -mt-2" aria-label="Fechar ajuda">
          ×
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
        {carregado && mensagens.length === 0 && (
          <div className="text-sm text-text-2 space-y-3">
            <p>Olá! Sou o assistente virtual do NotaFácil. Consigo consultar suas notas, seu plano e seu certificado para te ajudar. Se precisar, chamo alguém da equipe.</p>
            <div className="flex flex-col gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => void enviar(s)}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-navy-600 hover:border-brand-cyan/50 text-text-1"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m) => <Bolha key={m.id} m={m} />)}

        {esperandoIA && (
          <div className="flex items-center gap-2 text-xs text-text-2">
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="w-1.5 h-1.5 rounded-full bg-text-2 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-2 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-2 animate-bounce [animation-delay:300ms]" />
            </span>
            Assistente digitando…
          </div>
        )}

        {status === 'resolvido' && !enviando && (
          <p className="text-center text-xs text-text-2 py-2">
            Este atendimento foi encerrado. Envie uma mensagem para abrir um novo.
          </p>
        )}
        <div ref={fimRef} />
      </div>

      {/* Entrada */}
      <div className="border-t border-navy-600 p-3 bg-navy-800">
        {anexo && (
          <div className="relative inline-block mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anexo} alt="Imagem anexada" className="h-16 rounded border border-navy-600" />
            <button
              onClick={() => setAnexo(null)}
              className="absolute -top-2 -right-2 bg-navy-900 text-text-1 rounded-full w-6 h-6 text-xs border border-navy-600"
              aria-label="Remover imagem"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-10 h-10 rounded-lg border border-navy-600 text-text-2 hover:text-text-1 hover:border-navy-600/70"
            aria-label="Anexar imagem"
            title="Anexar print da tela"
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) escolherArquivo(e.target.files[0]); e.target.value = '' }}
          />
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() }
            }}
            maxLength={4000}
            rows={1}
            placeholder="Escreva sua dúvida…"
            aria-label="Mensagem"
            className="flex-1 resize-none max-h-32 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan/60"
            style={{ height: Math.min(128, 40 + 20 * Math.max(0, texto.split('\n').length - 1)) }}
          />
          <button
            onClick={() => void enviar()}
            disabled={!texto.trim() || enviando}
            className="shrink-0 h-10 px-4 rounded-lg bg-brand-cyan text-navy-900 font-semibold text-sm disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        <p className="text-[11px] text-text-2 mt-2">
          O assistente só consulta os dados da sua conta — ele não altera notas, planos nem cadastro.
        </p>
      </div>
    </div>
  )
}

function Bolha({ m }: { m: Msg }) {
  if (m.autor === 'sistema') {
    return <p className="text-center text-xs text-text-2 px-4">{m.conteudo}</p>
  }
  const doCliente = m.autor === 'cliente'
  const rotulo = m.autor === 'ia' ? 'Assistente virtual' : m.autor === 'atendente' ? 'Equipe NotaFácil' : null
  return (
    <div className={`flex ${doCliente ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${m.pendente ? 'opacity-70' : ''}`}>
        {rotulo && (
          <p className={`text-[11px] mb-1 ${m.autor === 'atendente' ? 'text-nota-upgrade' : 'text-text-2'}`}>{rotulo}</p>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            doCliente
              ? 'bg-brand-cyan text-navy-900 rounded-br-sm'
              : m.autor === 'atendente'
                ? 'bg-nota-upgrade/15 border border-nota-upgrade/30 text-text-1 rounded-bl-sm'
                : 'bg-navy-800 border border-navy-600 text-text-1 rounded-bl-sm'
          }`}
        >
          {m.conteudo}
          {m.anexo_url && (
            <a href={m.anexo_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.anexo_url} alt="Imagem anexada" className="max-h-40 rounded" />
            </a>
          )}
        </div>
        <p className={`text-[10px] text-text-2 mt-0.5 ${doCliente ? 'text-right' : ''}`}>{hora(m.created_at)}</p>
      </div>
    </div>
  )
}
