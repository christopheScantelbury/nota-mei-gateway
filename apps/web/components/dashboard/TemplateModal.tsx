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
import ClienteCombobox from '@/components/nota/ClienteCombobox'
import MoneyInput from '@/components/ui/MoneyInput'
import { maskCNPJ, maskCPF } from '@/lib/format'
import type { ClienteAutocomplete } from '@/lib/types-cliente'

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
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-2 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
      {hint && !error && <p className="text-[11px] text-text-2">{hint}</p>}
    </div>
  )
}

interface FormState {
  nome:                  string
  descricao:             string
  // Serviço
  codigo_nbs:            string
  discriminacao:         string
  valor:                 string
  aliquota_iss:          string
  // Tomador (opcional — mas necessário pra Links de Emissão / automação)
  tomador_tipo:          'PJ' | 'PF'
  tomador_documento:     string
  tomador_razao_social:  string
  tomador_email:         string
  tomador_municipio_ibge: string
  // Integração
  webhook_url:           string
}

function templateToForm(t: NotaTemplate): FormState {
  return {
    nome:                   t.nome,
    descricao:              t.descricao ?? '',
    codigo_nbs:             t.servico.codigo_nbs,
    discriminacao:          t.servico.discriminacao,
    valor:                  String(t.servico.valor),
    aliquota_iss:           String(t.servico.aliquota_iss),
    tomador_tipo:           (t.tomador?.tipo as 'PJ' | 'PF') ?? 'PJ',
    tomador_documento:      t.tomador?.documento ?? '',
    tomador_razao_social:   t.tomador?.razao_social ?? '',
    tomador_email:          t.tomador?.email ?? '',
    tomador_municipio_ibge: t.tomador?.municipio_ibge ?? '',
    webhook_url:            t.webhook_url ?? '',
  }
}

const emptyForm: FormState = {
  nome: '', descricao: '', codigo_nbs: '', discriminacao: '',
  valor: '', aliquota_iss: '2.0',
  tomador_tipo: 'PJ', tomador_documento: '', tomador_razao_social: '',
  tomador_email: '', tomador_municipio_ibge: '',
  webhook_url: '',
}

export default function TemplateModal({ open, onClose, onSaved, initial }: Props) {
  const isEdit = Boolean(initial)
  const [form, setForm]         = useState<FormState>(emptyForm)
  const [nbsDescricao, setNbsDescricao] = useState('')
  const [errors, setErrors]     = useState<Partial<FormState>>({})
  const [submitting, setSubmit] = useState(false)
  const [apiError, setApiError] = useState('')
  const [isMei, setIsMei] = useState(false)
  const [isSimplesNacional, setIsSimplesNacional] = useState(false)

  // Detecta se o template está pronto pra usar em Link de Emissão
  const tomadorCompleto =
    !!form.tomador_documento.replace(/\D/g, '') &&
    !!form.tomador_razao_social.trim() &&
    !!form.tomador_municipio_ibge

  // Reset form when modal opens / template changes
  useEffect(() => {
    if (open) {
      setForm(initial ? templateToForm(initial) : emptyForm)
      setNbsDescricao('')
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

  function aplicarCliente(c: ClienteAutocomplete) {
    setForm(prev => ({
      ...prev,
      tomador_tipo:           c.tipo,
      tomador_documento:      c.documento,
      tomador_razao_social:   c.razao_social,
      tomador_email:          c.email ?? prev.tomador_email,
      tomador_municipio_ibge: c.municipio_ibge ?? prev.tomador_municipio_ibge,
    }))
  }

  function validate() {
    const errs: Partial<FormState> = {}
    if (!form.nome.trim())          errs.nome = 'Nome obrigatório'
    if (!form.codigo_nbs.trim())    errs.codigo_nbs = 'Selecione o serviço prestado'
    if (!form.discriminacao.trim()) errs.discriminacao = 'Discriminação obrigatória'
    const v = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(v) || v <= 0)         errs.valor = 'Valor deve ser maior que zero'

    // Tomador é opcional — mas SE algum campo preenchido, valida o conjunto
    const algumTomador = form.tomador_documento || form.tomador_razao_social
    if (algumTomador) {
      const docClean = form.tomador_documento.replace(/\D/g, '')
      if (form.tomador_tipo === 'PJ' && docClean.length !== 14) {
        errs.tomador_documento = 'CNPJ deve ter 14 dígitos'
      } else if (form.tomador_tipo === 'PF' && docClean.length !== 11) {
        errs.tomador_documento = 'CPF deve ter 11 dígitos'
      }
      if (!form.tomador_razao_social.trim()) {
        errs.tomador_razao_social = 'Nome obrigatório'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')
    if (!validate() || submitting) return

    setSubmit(true)
    try {
      // Monta tomador SE algum campo preenchido — senão null
      const docClean = form.tomador_documento.replace(/\D/g, '')
      const tomador = docClean.length > 0 && form.tomador_razao_social.trim()
        ? {
            tipo:           form.tomador_tipo,
            documento:      docClean,
            razao_social:   form.tomador_razao_social.trim(),
            email:          form.tomador_email.trim() || undefined,
            municipio_ibge: form.tomador_municipio_ibge.replace(/\D/g, '') || undefined,
          }
        : null

      const payload = {
        nome:        form.nome.trim(),
        descricao:   form.descricao.trim() || null,
        servico: {
          codigo_nbs:    form.codigo_nbs.trim(),
          discriminacao: form.discriminacao.trim(),
          valor:         parseFloat(form.valor.replace(',', '.')),
          aliquota_iss:  isSimplesNacional ? 0 : parseFloat(form.aliquota_iss.replace(',', '.')),
        },
        tomador,
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
      {/* Estrutura: header sticky (top) + corpo scrollável + footer sticky (bottom).
          Isso garante que o usuário sempre vê o botão Salvar mesmo com form longo,
          E que o scroll funciona em qualquer device (touch, mouse wheel). */}
      <DialogContent className="max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden">
        {/* Header — sticky */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-navy-600/60 mb-0">
          <DialogTitle>{isEdit ? 'Editar template' : 'Novo template'}</DialogTitle>
        </DialogHeader>

        {/* Corpo scrollável */}
        <form
          onSubmit={handleSubmit}
          id="template-modal-form"
          className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4"
        >
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

          {/* ── Bloco 1: Serviço ── */}
          <div className="border-t border-navy-600 pt-4">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-3">
              1. Dados do serviço
            </p>

            <div className="space-y-3">
              <Field label="Serviço prestado" error={errors.codigo_nbs}>
                <NBSServicoPicker
                  inline
                  value={form.codigo_nbs}
                  selectedDescricao={nbsDescricao}
                  onSelect={(codigo, descricao) => {
                    setForm(prev => ({
                      ...prev,
                      codigo_nbs: codigo,
                      discriminacao: prev.discriminacao.trim() || descricao,
                    }))
                    setNbsDescricao(descricao)
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
                  <MoneyInput
                    className={inputCls}
                    value={form.valor}
                    onChange={(v) => setForm(prev => ({ ...prev, valor: v }))}
                  />
                </Field>
                {!isSimplesNacional && (
                  <Field label="Alíquota ISS (%)">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputCls}
                      placeholder="2,0"
                      value={form.aliquota_iss}
                      onChange={set('aliquota_iss')}
                    />
                  </Field>
                )}
              </div>
            </div>
          </div>

          {/* ── Bloco 2: Tomador (opcional mas necessário pra Links/Automação) ── */}
          <div className="border-t border-navy-600 pt-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">
                2. Tomador (opcional)
              </p>
              {tomadorCompleto && (
                <span className="text-[10px] font-semibold text-nota-autorizada bg-nota-autorizada/10 border border-nota-autorizada/30 rounded-full px-2 py-0.5 whitespace-nowrap">
                  ✓ Pronto pra Link
                </span>
              )}
            </div>

            <p className="text-[11px] text-text-2 mb-3 leading-relaxed">
              Preencha se quiser usar este template em <strong className="text-text-1">Links de Emissão</strong>{' '}
              ou <strong className="text-text-1">Automações</strong> sem digitar tudo de novo.
              Sem o tomador, o template só serve pra pré-preencher o form de Nova Nota.
            </p>

            <div className="space-y-3">
              <ClienteCombobox onSelect={aplicarCliente} />

              <div className="inline-flex gap-1 bg-navy-900 border border-navy-600 rounded-lg p-1">
                {(['PJ', 'PF'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, tomador_tipo: t, tomador_documento: '' }))}
                    className={`px-3 py-1 text-xs font-semibold rounded transition ${
                      form.tomador_tipo === t
                        ? 'bg-brand-cyan text-navy-900'
                        : 'text-text-2 hover:text-text-1'
                    }`}
                  >
                    {t === 'PJ' ? 'CNPJ (PJ)' : 'CPF (PF)'}
                  </button>
                ))}
              </div>

              <Field label={form.tomador_tipo === 'PJ' ? 'CNPJ' : 'CPF'} error={errors.tomador_documento}>
                <input
                  type="text"
                  className={inputCls}
                  placeholder={form.tomador_tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  value={form.tomador_tipo === 'PJ' ? maskCNPJ(form.tomador_documento) : maskCPF(form.tomador_documento)}
                  onChange={e => setForm(prev => ({ ...prev, tomador_documento: e.target.value.replace(/\D/g, '') }))}
                  maxLength={18}
                />
              </Field>

              <Field
                label={form.tomador_tipo === 'PJ' ? 'Razão social' : 'Nome completo'}
                error={errors.tomador_razao_social}
              >
                <input
                  type="text"
                  className={inputCls}
                  value={form.tomador_razao_social}
                  onChange={set('tomador_razao_social')}
                  maxLength={255}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Município (IBGE)" hint="7 dígitos. Ex: 3550308">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputCls}
                    placeholder="3550308"
                    value={form.tomador_municipio_ibge}
                    onChange={e => setForm(prev => ({ ...prev, tomador_municipio_ibge: e.target.value.replace(/\D/g, '') }))}
                    maxLength={7}
                  />
                </Field>
                <Field label="Email (opcional)">
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="cliente@empresa.com"
                    value={form.tomador_email}
                    onChange={set('tomador_email')}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Webhook só aparece para ME/EPP */}
          {!isMei && (
            <div className="border-t border-navy-600 pt-4">
              <Field label="URL de webhook (opcional)">
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://seu-erp.com/webhooks/nfse"
                  value={form.webhook_url}
                  onChange={set('webhook_url')}
                />
              </Field>
            </div>
          )}

        </form>

        {/* Footer sticky — botões sempre visíveis */}
        <div className="shrink-0 px-6 py-4 border-t border-navy-600/60 flex gap-3 bg-navy-700">
          <Button
            type="submit"
            form="template-modal-form"
            variant="primary"
            className="flex-1"
            loading={submitting}
          >
            {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar template'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
