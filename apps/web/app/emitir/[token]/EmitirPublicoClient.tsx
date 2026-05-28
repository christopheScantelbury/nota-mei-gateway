'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { formatBRL, formatCNPJ, formatCPF } from '@/lib/format'

interface Resumo {
  nome:              string
  servico_nbs:       string
  servico_descricao: string
  valor:             number | null
  tomador_nome:      string
  tomador_doc:       string
  competencia:       string | null
  usos:              number
}

interface Props { token: string }

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, '')
  if (d.length === 14) return formatCNPJ(d)
  if (d.length === 11) return formatCPF(d)
  return doc
}

function formatCompetencia(c: string | null): string {
  if (!c) return '—'
  const [year, month] = c.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]} ${year}`
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; resumo: Resumo }
  | { tipo: 'erro';   msg: string; titulo?: string }
  | { tipo: 'emitindo' }
  | { tipo: 'sucesso'; notaId: string; mensagem: string }
  | { tipo: 'falha';   msg: string }

export default function EmitirPublicoClient({ token }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  // Carrega resumo
  useEffect(() => {
    let aborted = false
    fetch(`/api/emitir-publico/${token}`)
      .then(async r => {
        const body = await r.json().catch(() => ({}))
        if (aborted) return
        if (!r.ok) {
          const { titulo, msg } = mapearErro(body.error, body.message)
          setEstado({ tipo: 'erro', msg, titulo })
        } else {
          setEstado({ tipo: 'pronto', resumo: body as Resumo })
        }
      })
      .catch(() => {
        if (!aborted) setEstado({ tipo: 'erro', msg: 'Falha de conexão' })
      })
    return () => { aborted = true }
  }, [token])

  async function emitir() {
    setEstado({ tipo: 'emitindo' })
    try {
      const res = await fetch(`/api/emitir-publico/${token}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const { msg } = mapearErro(body.error, body.message)
        setEstado({ tipo: 'falha', msg })
        return
      }
      setEstado({ tipo: 'sucesso', notaId: body.nota_id, mensagem: body.mensagem })
    } catch {
      setEstado({ tipo: 'falha', msg: 'Falha de conexão' })
    }
  }

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo simples no topo */}
        <div className="text-center mb-6">
          <p className="font-display font-bold text-brand-cyan text-lg">NotaFácil</p>
          <p className="text-xs text-text-2 mt-1">Emissão rápida</p>
        </div>

        <div className="rounded-2xl border border-navy-600 bg-navy-700 p-6 shadow-xl">
          {estado.tipo === 'carregando' && (
            <p className="text-center text-text-2 py-8">Carregando…</p>
          )}

          {estado.tipo === 'erro' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🔒</div>
              <h1 className="font-display font-bold text-lg mb-2">{estado.titulo ?? 'Link inválido ou revogado'}</h1>
              <p className="text-text-2 text-sm whitespace-pre-line">{estado.msg}</p>
            </div>
          )}

          {estado.tipo === 'pronto' && (
            <>
              <h1 className="font-display text-xl font-extrabold mb-1">Confirmar emissão</h1>
              <p className="text-text-2 text-sm mb-5">{estado.resumo.nome}</p>

              <dl className="rounded-xl border border-navy-600 bg-navy-900 divide-y divide-navy-600 mb-5">
                <Row label="Serviço">
                  {estado.resumo.servico_descricao || estado.resumo.servico_nbs}
                </Row>
                <Row label="Valor" highlight>
                  {estado.resumo.valor != null ? formatBRL(estado.resumo.valor) : '—'}
                </Row>
                <Row label="Tomador">
                  <div>{estado.resumo.tomador_nome}</div>
                  <div className="text-xs text-text-2 mt-0.5 font-mono">{formatDoc(estado.resumo.tomador_doc)}</div>
                </Row>
                <Row label="Competência">{formatCompetencia(estado.resumo.competencia)}</Row>
              </dl>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={emitir}
              >
                Emitir agora →
              </Button>
              <p className="text-xs text-text-2 text-center mt-3">
                Ao confirmar, a nota é enviada à Receita Federal. Você receberá o resultado por email.
              </p>
            </>
          )}

          {estado.tipo === 'emitindo' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3 animate-pulse">⚡</div>
              <p className="font-display font-bold text-lg mb-2">Emitindo…</p>
              <p className="text-text-2 text-sm">Enviando os dados para a Receita Federal.</p>
            </div>
          )}

          {estado.tipo === 'sucesso' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">✅</div>
              <h1 className="font-display font-bold text-xl mb-2">Nota em processamento</h1>
              <p className="text-text-2 text-sm leading-relaxed mb-5">{estado.mensagem}</p>
              <p className="text-xs text-text-2 font-mono bg-navy-900 border border-navy-600 rounded px-3 py-1.5 break-all">
                ID: {estado.notaId}
              </p>
            </div>
          )}

          {estado.tipo === 'falha' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h1 className="font-display font-bold text-lg mb-2">Não foi possível emitir</h1>
              <p className="text-text-2 text-sm mb-5">{estado.msg}</p>
              <Button variant="secondary" onClick={() => setEstado({ tipo: 'carregando' })}>
                Tentar de novo
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-text-2 mt-6">
          Este link é confidencial. Não compartilhe.
        </p>
      </div>
    </main>
  )
}

function Row({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 px-4 py-3">
      <dt className="text-xs text-text-2 uppercase tracking-wider shrink-0">{label}</dt>
      <dd className={`text-sm text-right ${highlight ? 'text-brand-cyan font-semibold font-mono' : 'text-text-1'}`}>
        {children}
      </dd>
    </div>
  )
}

function mapearErro(code?: string, serverMsg?: string): { titulo: string; msg: string } {
  switch (code) {
    case 'NOT_FOUND':
      return {
        titulo: 'Link inválido ou revogado',
        msg:    'Este link não existe ou foi desativado pelo emissor.',
      }
    case 'RATE_LIMIT':
      return {
        titulo: 'Aguarde um momento',
        msg:    serverMsg ?? 'Aguarde antes de emitir outra nota com este link.',
      }
    case 'SOURCE_NOT_FOUND':
      return {
        titulo: 'Origem removida',
        msg:    'O template ou automação ligado a este link foi apagado.\n\nVá no painel e gere um link novo.',
      }
    case 'INVALID_SOURCE':
      return {
        titulo: 'Dados incompletos',
        msg:    'O template/automação não tem os dados todos preenchidos (faltam o serviço ou o tomador).\n\nVá no painel, complete os dados e gere um link novo.',
      }
    case 'PLAN_LIMIT_REACHED':
      return {
        titulo: 'Limite do plano atingido',
        msg:    'Esta conta já usou todas as emissões do plano deste mês.',
      }
    default:
      return {
        titulo: 'Erro inesperado',
        msg:    serverMsg ?? 'Tente novamente em alguns segundos.',
      }
  }
}
