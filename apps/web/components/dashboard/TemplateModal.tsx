'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import type { NotaTemplate } from '@/app/api/templates/route'
import { Button } from '@/components/ui/Button'
import NBSServicoPicker from '@/components/nota/NBSServicoPicker'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (template: NotaTemplate) => void
  initial?: NotaTemplate | null
}

const inputCls =
  'w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-2 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

interface FormState {
  nome: string
  descricao: string
  codigo_nbs: string
  discriminacao: string
  valor: string
  aliquota_iss: string
  webhook_url: string
}

function templateToForm(t: NotaTemplate): FormState {
  return {
    nome:          t.nome,
    descricao:     t.descricao ?? '',
    codigo_nbs:    t.servico.codigo_nbs,
    discriminacao: t.servico.discriminacao,
    valor:         String(t.servico.valor),
    aliquota_iss:  String(t.servico.aliquota_iss),
    webhook_url:   t.webhook_url ?? '',
  }
}

const emptyForm: FormState = {
  nome: '', descricao: '', codigo_nbs: '', discriminacao: '',
  valor: '', aliquota_iss: '2.0', webhook_url: '',
}

export default function TemplateModal({ open, onClose, onSaved, initial }: Props) {
  const isEdit = Boolean(initial)
  const [form, setForm]         = useState<FormState>(emptyForm)
  const [nbsDescricao, setNbsDescricao] = useState('')
  const [errors, setErrors]     = useState<Partial<FormState>>({})
  const [submitting, setSubmit] = useState(false)
  const [apiError, setApiError] = useState('')
  // Persona do usuário — MEI recolhe ISS via DAS e raramente usa webhook,
  // então escondemos esses campos por padrão.
  const [isMei, setIsMei] = useState(false)
  const [isSimplesNacional, setIsSimplesNacional] = useState(false)

  // Reset form when modal opens / template changes
  useEffect(() => {
    if (open) {
      setForm(initial ? templateToForm(initial) : emptyForm)
      setNbsDescricao('')  // template não persiste descrição NBS
      setErrors({})
      setApiError('')
      setSubmit(false)
    }
  }, [open, initial])

  // Carrega tipo da empresa pra esconder campos irrelevantes pra MEI
  useEffect(() => {
    if (!open) return
    fetch('/api/empresa/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { isMei?: boolean; isSimplesNacional?: boolean } | null) => {
        if (d?.isMei) setIsMei(true)
        if (d?.isSimplesNacional) setIsSimplesNacional(true)
      })
      .catch(() => { /* silent */ })
  }, [open])

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  function validate() {
    const errs: Partial<FormState> = {}
    if (!form.nome.trim())          errs.nome = 'Nome obrigatório'
    if (!form.codigo_nbs.trim())    errs.codigo_nbs = 'Código NBS obrigatório'
    if (!form.discriminacao.trim()) errs.discriminacao = 'Discriminação obrigatória'
    const v = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(v) || v <= 0)         errs.valor = 'Valor deve ser maior que zero'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')
    if (!validate() || submitting) return

    setSubmit(true)
    try {
      const payload = {
        nome:        form.nome.trim(),
        descricao:   form.descricao.trim() || null,
        servico: {
          codigo_nbs:    form.codigo_nbs.trim(),
          discriminacao: form.discriminacao.trim(),
          valor:         parseFloat(form.valor.replace(',', '.')),
          // MEI/SN recolhe ISS via DAS — força 0 pra não confundir
          aliquota_iss:  isSimplesNacional ? 0 : parseFloat(form.aliquota_iss.replace(',', '.')),
        },
        // MEI raramente usa webhook — pula campo
        webhook_url: isMei ? null : (form.webhook_url.trim() || null),
      }

      const url    = isEdit ? `/api/templates/${initial!.id}` : '/api/templates'
      const method = isEdit ? 'PUT' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { template?: NotaTemplate; error?: string }

      if (!res.ok) {
        setApiError(data.error ?? 'Erro ao salvar template')
        return
      }

      onSaved(data.template!)
      onClose()
    } catch {
      setApiError('Não foi possível conectar ao servidor')
    } finally {
      setSubmit(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar template' : 'Novo template'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {apiError && (
            <p className="text-xs text-nota-rejeitada bg-nota-rejeitada/10 border border-nota-rejeitada/30 rounded-lg px-3 py-2">
              {apiError}
            </p>
          )}

          <Field label="Nome do template" error={errors.nome}>
            <input
              type="text"
              className={inputCls}
              placeholder="Ex: Consultoria mensal"
              value={form.nome}
              onChange={set('nome')}
              maxLength={100}
            />
          </Field>

          <Field label="Descrição (opcional)">
            <input
              type="text"
              className={inputCls}
              placeholder="Nota curta para identificação"
              value={form.descricao}
              onChange={set('descricao')}
              maxLength={200}
            />
          </Field>

          <div className="border-t border-navy-600 pt-4">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-3">
              Dados do serviço
            </p>

            <div className="space-y-3">
              <Field label="Serviço prestado" error={errors.codigo_nbs}>
                <NBSServicoPicker
                  value={form.codigo_nbs}
                  selectedDescricao={nbsDescricao}
                  onSelect={(codigo, descricao) => {
                    setForm(prev => ({ ...prev, codigo_nbs: codigo }))
                    setNbsDescricao(descricao)
                    // Pré-preenche a discriminação com a descrição NBS se ainda
                    // estiver vazia — usuário pode editar depois.
                    setForm(prev => ({
                      ...prev,
                      codigo_nbs: codigo,
                      discriminacao: prev.discriminacao.trim() || descricao,
                    }))
                  }}
                  error={errors.codigo_nbs}
                />
              </Field>

              <Field label="Discriminação" error={errors.discriminacao}>
                <textarea
                  className={`${inputCls} resize-none h-20`}
                  placeholder="Descreva o serviço prestado..."
                  maxLength={500}
                  value={form.discriminacao}
                  onChange={set('discriminacao')}
                />
              </Field>

              <div className={`grid gap-3 ${isSimplesNacional ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <Field label="Valor padrão (R$)" error={errors.valor}>
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    value={form.valor}
                    onChange={set('valor')}
                  />
                </Field>
                {/* MEI/Simples Nacional recolhem ISS via DAS — campo escondido */}
                {!isSimplesNacional && (
                  <Field label="Alíquota ISS (%)">
                    <input
                      type="number"
                      className={inputCls}
                      min="0"
                      max="5"
                      step="0.1"
                      value={form.aliquota_iss}
                      onChange={set('aliquota_iss')}
                    />
                  </Field>
                )}
              </div>
            </div>
          </div>

          {/* Webhook só aparece para ME/EPP — MEI tipicamente não integra ERP */}
          {!isMei && (
            <Field label="URL de webhook (opcional)">
              <input
                type="url"
                className={inputCls}
                placeholder="https://seu-erp.com/webhooks/nfse"
                value={form.webhook_url}
                onChange={set('webhook_url')}
              />
            </Field>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1" loading={submitting}>
              {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar template'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
