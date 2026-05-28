'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

interface LinkRow {
  id:                 string
  token:              string
  nome:               string
  template_id:        string | null
  recorrencia_id:     string | null
  usos:               number
  ultima_emissao_em:  string | null
  ultima_nota_id:     string | null
  ativo:              boolean
  revogado_em:        string | null
  created_at:         string
  nota_templates?:    { nome: string } | null
  nota_recorrencias?: { nome: string } | null
}

interface Props { initial: LinkRow[] }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

export default function LinksList({ initial }: Props) {
  const [list, setList] = useState<LinkRow[]>(initial)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function urlFor(token: string): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/emitir/${token}`
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token))
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
      toast.success('Link copiado')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  // Abre WhatsApp com mensagem pré-formatada — usuário escolhe pra quem mandar
  // (geralmente pra si próprio, contato "Você mesmo"/Saved Messages).
  // Métrica de validação: % de usuários que clicam aqui.
  function shareWhatsApp(link: LinkRow) {
    const url  = urlFor(link.token)
    const text = `🧾 Meu atalho pra emitir NFS-e: ${link.nome}\n\n${url}\n\n_Salva esse contato pra emitir com 1 toque toda vez._`
    const wa   = `https://wa.me/?text=${encodeURIComponent(text)}`
    // Abre em nova aba — preserva o dashboard aberto
    window.open(wa, '_blank', 'noopener,noreferrer')
  }

  async function revoke(link: LinkRow) {
    if (!confirm(`Revogar o link "${link.nome}"?\n\nQuem tiver o URL não poderá mais emitir notas.`)) return
    try {
      const res = await fetch(`/api/emissao-links/${link.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error()
      setList(prev => prev.map(l => l.id === link.id ? { ...l, ativo: false, revogado_em: new Date().toISOString() } : l))
      toast.success('Link revogado')
    } catch {
      toast.error('Falha ao revogar')
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Links de Emissão</h1>
          <p className="text-text-2 text-sm mt-1">
            Salve no celular e emita notas sem precisar abrir o sistema.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          + Novo link
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-600 px-6 py-16 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="font-display text-lg font-bold mb-2">Nenhum link criado ainda</p>
          <p className="text-text-2 text-sm mb-6 max-w-md mx-auto">
            Cada link é um atalho pra emitir uma nota específica.
            Salve nos favoritos do celular ou crie um atalho na home screen.
          </p>
          <Button variant="primary" onClick={() => setCreating(true)}>
            Criar primeiro link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(link => {
            const origem = link.template_id
              ? `Template: ${link.nota_templates?.nome ?? '—'}`
              : `Automação: ${link.nota_recorrencias?.nome ?? '—'}`
            return (
              <div
                key={link.id}
                className={`rounded-xl border bg-navy-700/50 p-4 ${
                  link.ativo ? 'border-navy-600' : 'border-navy-600/40 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{link.nome}</p>
                    <p className="text-xs text-text-2 mt-0.5 truncate">{origem}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                    link.ativo
                      ? 'border-nota-autorizada/40 text-nota-autorizada bg-nota-autorizada/10'
                      : 'border-navy-600 text-text-2'
                  }`}>
                    {link.ativo ? 'Ativo' : 'Revogado'}
                  </span>
                </div>

                {link.ativo && (
                  <>
                    <div className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                      <code className="text-xs font-mono text-brand-cyan flex-1 truncate">
                        {urlFor(link.token)}
                      </code>
                      <button
                        onClick={() => copy(link.token)}
                        className="text-xs text-brand-cyan hover:underline shrink-0"
                      >
                        {copied === link.token ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>

                    {/* Ações rápidas de compartilhamento */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        onClick={() => shareWhatsApp(link)}
                        className="inline-flex items-center gap-1.5 text-xs bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 rounded-lg px-3 py-1.5 hover:bg-[#25D366]/20 transition"
                        aria-label="Compartilhar via WhatsApp"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                        </svg>
                        Salvar no WhatsApp
                      </button>
                      <a
                        href={urlFor(link.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-navy-900 text-text-2 border border-navy-600 rounded-lg px-3 py-1.5 hover:border-brand-cyan hover:text-brand-cyan transition"
                      >
                        🔗 Abrir
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-2">
                      <div className="flex items-center gap-3">
                        <span>{link.usos} {link.usos === 1 ? 'emissão' : 'emissões'}</span>
                        <span>· Última: {formatDate(link.ultima_emissao_em)}</span>
                      </div>
                      <div className="flex gap-2">
                        {link.ultima_nota_id && (
                          <Link
                            href={`/notas/${link.ultima_nota_id}`}
                            className="text-brand-cyan hover:underline"
                          >
                            Última nota →
                          </Link>
                        )}
                        <button
                          onClick={() => revoke(link)}
                          className="text-nota-rejeitada hover:underline"
                        >
                          Revogar
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {!link.ativo && link.revogado_em && (
                  <p className="text-xs text-text-2">
                    Revogado em {formatDate(link.revogado_em)} · {link.usos} emissão(ões) total
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <CreateLinkModal
          onClose={() => setCreating(false)}
          onCreated={(novo) => {
            setList(prev => [novo, ...prev])
            setCreating(false)
            toast.success('Link criado! Use o botão "Copiar" pra compartilhar com você mesmo.')
          }}
        />
      )}
    </>
  )
}

// ── Modal de criação ──────────────────────────────────────────

interface SourceOption {
  value: string
  label: string
  tipo:  'template' | 'recorrencia'
}

function CreateLinkModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (link: LinkRow) => void
}) {
  const [nome, setNome]       = useState('')
  const [origem, setOrigem]   = useState('')
  const [options, setOptions] = useState<SourceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Carrega templates + recorrencias disponíveis
  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.ok ? r.json() : { templates: [] }),
      fetch('/api/recorrencias').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([tplData, recData]) => {
      const tpls: SourceOption[] = (tplData.templates ?? []).map((t: { id: string; nome: string }) => ({
        value: `t:${t.id}`,
        label: `📄 ${t.nome}`,
        tipo:  'template' as const,
      }))
      const recs: SourceOption[] = (recData.data ?? []).map((r: { id: string; nome: string }) => ({
        value: `r:${r.id}`,
        label: `🔄 ${r.nome}`,
        tipo:  'recorrencia' as const,
      }))
      setOptions([...tpls, ...recs])
    })
  }, [])

  async function handleSubmit() {
    setError(null)
    if (!nome.trim()) { setError('Dê um nome ao link'); return }
    if (!origem) { setError('Escolha o template ou automação de origem'); return }

    const [tipo, id] = origem.split(':')
    const payload = {
      nome:           nome.trim(),
      template_id:    tipo === 't' ? id : undefined,
      recorrencia_id: tipo === 'r' ? id : undefined,
    }

    setLoading(true)
    try {
      const res = await fetch('/api/emissao-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'Erro ao criar link')
        setLoading(false)
        return
      }
      // O body do POST não traz nota_templates/recorrencias join. Hidrata com o label.
      const opt = options.find(o => o.value === origem)
      onCreated({
        ...(body as LinkRow),
        ultima_emissao_em: null,
        ultima_nota_id:    null,
        revogado_em:       null,
        nota_templates:    tipo === 't' ? { nome: opt?.label.replace('📄 ', '') ?? '' } : null,
        nota_recorrencias: tipo === 'r' ? { nome: opt?.label.replace('🔄 ', '') ?? '' } : null,
      })
    } catch {
      setError('Falha de conexão')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-navy-700 border border-navy-600 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="font-display text-lg font-extrabold mb-1">Novo link de emissão</h2>
        <p className="text-text-2 text-xs mb-5 leading-relaxed">
          Cada link cria um atalho pra emitir uma nota específica. Os dados (serviço, valor, tomador)
          vêm de um <strong className="text-text-1">template</strong> ou <strong className="text-text-1">automação</strong> que
          você já criou — quando alguém acessar o link, emite igualzinho.
        </p>

        <div className="space-y-4">
          <Input
            label="Nome do link"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex.: Consultoria João — atalho"
            hint="Identifica o link na lista. Não aparece pro tomador."
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-1">
              Qual template ou automação usar?
            </label>
            <p className="text-xs text-text-2 -mt-0.5 mb-1">
              📄 = template &nbsp;·&nbsp; 🔄 = automação. O link copia os dados desse modelo.
            </p>
            <Select
              value={origem}
              onChange={setOrigem}
              placeholder={options.length === 0 ? 'Crie um template ou automação primeiro' : '— Escolher —'}
              options={options.length === 0 ? [] : options.map(o => ({ value: o.value, label: o.label }))}
              disabled={options.length === 0}
              inline
            />
            {options.length === 0 ? (
              <p className="text-xs text-text-2 mt-1">
                Você ainda não tem nenhum criado. Vá em{' '}
                <Link href="/templates" className="text-brand-cyan hover:underline">Templates</Link> ou{' '}
                <Link href="/recorrencias" className="text-brand-cyan hover:underline">Automações</Link> primeiro.
              </p>
            ) : (
              <p className="text-xs text-text-2 mt-1">
                A lista mostra todos os seus templates e automações ativos.
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-nota-rejeitada bg-nota-rejeitada/10 border border-nota-rejeitada/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading} type="button">
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit} loading={loading} disabled={options.length === 0}>
              Criar link
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
