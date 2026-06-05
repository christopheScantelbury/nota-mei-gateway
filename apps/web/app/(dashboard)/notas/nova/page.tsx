'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CepMunicipioInput } from '@/components/ui/CepMunicipioInput'
import { validarCNPJ } from '@/lib/cnpj'
import { notify } from '@/lib/notify'
import { maskCNPJ, maskCPF } from '@/lib/format'
import ISSRecolhimentoCard from '@/components/nota/ISSRecolhimentoCard'
import SugestorNBS from '@/components/nota/SugestorNBS'
import NBSServicoPicker from '@/components/nota/NBSServicoPicker'
import ClienteCombobox from '@/components/nota/ClienteCombobox'
import { Button } from '@/components/ui/Button'
import MoneyInput from '@/components/ui/MoneyInput'
import { Select } from '@/components/ui/Select'
import { hasFeature } from '@/lib/plans'
import type { NotaTemplate } from '@/app/api/templates/route'
import type { Cliente, ClienteAutocomplete } from '@/lib/types-cliente'
import type { RegimeTributario } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) =>
    d.split('').slice(0, len).reduce((s, n, i) => s + parseInt(n) * (len + 1 - i), 0)
  const r1 = (calc(9) * 10) % 11
  const r2 = (calc(10) * 10) % 11
  return parseInt(d[9]) === (r1 > 9 ? 0 : r1) && parseInt(d[10]) === (r2 > 9 ? 0 : r2)
}

// ── Field + Label ─────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-1">{label}</label>
      {children}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition'

// ── Main Component ────────────────────────────────────────────────────────────
type TipoDoc = 'PJ' | 'PF'

interface FormErrors {
  codigoNbs?: string
  discriminacao?: string
  valorServico?: string
  tipoPessoa?: string
  documento?: string
  razaoSocial?: string
  emailTomador?: string
  municipioIbge?: string
  competencia?: string
}

export default function NovaNota() {
  const searchParams = useSearchParams()

  // Serviço
  const [codigoNbs, setCodigoNbs] = useState('')
  const [nbsDescricao, setNbsDescricao] = useState('')
  const [discriminacao, setDiscriminacao] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [aliquotaIss, setAliquotaIss] = useState('2.0')
  const [competencia, setCompetencia] = useState(currentMonth())

  // Tomador
  const [tipoPessoa, setTipoPessoa] = useState<TipoDoc>('PJ')
  const [documento, setDocumento] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [emailTomador, setEmailTomador] = useState('')
  const [municipioIbge, setMunicipioIbge] = useState('')

  // Opcionais
  const [webhookUrl, setWebhookUrl] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  // ME-41: ISS retido — only required for Lucro Presumido companies
  // null = not specified (MEI/Simples Nacional), true/false = explicit choice for LP
  const [issRetido, setIssRetido] = useState<boolean | null>(null)

  // Template selector state
  const [templates, setTemplates] = useState<NotaTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  // UI state
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notaId, setNotaId] = useState('')
  const [apiError, setApiError] = useState('')
  // ME-42: regime do usuário para exibir ISSRecolhimentoCard no sucesso
  const [userRegime, setUserRegime] = useState<RegimeTributario | null>(null)

  // Persona da empresa — controla quais campos de imposto aparecem.
  // MEI/SN não escolhem alíquota ISS nem retenção (recolhem via DAS).
  // LP/LR têm controle total por nota.
  // empresaTipo=null significa "ainda não resolvido" — usamos isso pra
  // esconder campos condicionais até o fetch retornar, evitando flash
  // visual (campos de webhook/idempotência aparecendo brevemente pra MEI).
  const [empresaTipo, setEmpresaTipo] = useState<'MEI' | 'ME' | 'EPP' | null>(null)
  const [empresaRegime, setEmpresaRegime] = useState<RegimeTributario | null>(null)
  const [planoNome, setPlanoNome] = useState<string>('Trial')
  const empresaResolved = empresaTipo !== null
  const isMei = empresaTipo === 'MEI'
  const isSimplesNacional = isMei || empresaRegime === 'SIMPLES_NACIONAL'
  const podeUsarClientes = hasFeature(planoNome, 'clientesRead')

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
    // Carrega o regime da empresa pra ajustar a UI
    fetch('/api/empresa/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { tipo?: 'MEI' | 'ME' | 'EPP'; regime_tributario?: RegimeTributario; plano?: string } | null) => {
        if (d?.tipo) setEmpresaTipo(d.tipo)
        if (d?.regime_tributario) setEmpresaRegime(d.regime_tributario)
        if (d?.plano) setPlanoNome(d.plano)
        // MEI/SN: alíquota não é usada — zera pra evitar confusão no payload
        if (d?.tipo === 'MEI' || d?.regime_tributario === 'SIMPLES_NACIONAL') {
          setAliquotaIss('0')
        }
      })
      .catch(() => {/* silent — UI segue como LP padrão */})
  }, [])

  // Preload cliente pelo ?cliente=ID (vem de /clientes/[id] "+ Emitir nota")
  useEffect(() => {
    const clienteId = searchParams.get('cliente')
    if (!clienteId) return
    fetch(`/api/clientes/${clienteId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { cliente?: Cliente } | null) => {
        if (d?.cliente) aplicarCliente({
          id: d.cliente.id,
          tipo: d.cliente.tipo,
          documento: d.cliente.documento,
          razao_social: d.cliente.razao_social,
          email: d.cliente.email,
          municipio_ibge: d.cliente.municipio_ibge,
          total_notas: d.cliente.total_notas,
          ultima_emissao_em: d.cliente.ultima_emissao_em,
        })
      })
      .catch(() => {/* silent */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicarCliente(c: ClienteAutocomplete) {
    setTipoPessoa(c.tipo)
    setDocumento(c.tipo === 'PJ' ? maskCNPJ(c.documento) : maskCPF(c.documento))
    setRazaoSocial(c.razao_social)
    if (c.email) setEmailTomador(c.email)
    if (c.municipio_ibge) setMunicipioIbge(c.municipio_ibge)
  }

  // Load templates (silently — feature only for Pro/Business)
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.ok ? r.json() : { templates: [] })
      .then((d: { templates: NotaTemplate[] }) => {
        setTemplates(d.templates ?? [])
        // If ?template=<id> was passed (from Templates page "Usar →" link), auto-apply
        const preselect = searchParams.get('template')
        if (preselect) {
          const tpl = d.templates.find(t => t.id === preselect)
          if (tpl) applyTemplate(tpl)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyTemplate(tpl: NotaTemplate) {
    setSelectedTemplate(tpl.id)
    setCodigoNbs(tpl.servico.codigo_nbs)
    setNbsDescricao('')
    setDiscriminacao(tpl.servico.discriminacao)
    setValorServico(String(tpl.servico.valor))
    setAliquotaIss(String(tpl.servico.aliquota_iss))
    if (tpl.webhook_url) setWebhookUrl(tpl.webhook_url)
    if (tpl.tomador) {
      setTipoPessoa(tpl.tomador.tipo)
      setDocumento(tpl.tomador.documento)
      setRazaoSocial(tpl.tomador.razao_social)
      setEmailTomador(tpl.tomador.email)
      setMunicipioIbge(tpl.tomador.municipio_ibge)
    }
  }

  function handleTemplateChange(id: string) {
    if (!id) { setSelectedTemplate(''); return }
    const tpl = templates.find(t => t.id === id)
    if (tpl) applyTemplate(tpl)
  }

  // ISS preview
  const issEstimado = (() => {
    const v = parseFloat(valorServico.replace(',', '.'))
    const a = parseFloat(aliquotaIss.replace(',', '.'))
    if (isNaN(v) || isNaN(a) || v <= 0 || a < 0) return null
    return (v * a) / 100
  })()

  // Document formatting
  function handleDocumento(raw: string) {
    setDocumento(tipoPessoa === 'PJ' ? maskCNPJ(raw) : maskCPF(raw))
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!codigoNbs.trim()) errs.codigoNbs = 'Selecione o serviço prestado'
    if (!discriminacao.trim()) errs.discriminacao = 'Discriminação obrigatória'
    const v = parseFloat(valorServico.replace(',', '.'))
    if (isNaN(v) || v <= 0) errs.valorServico = 'Valor deve ser maior que zero'
    if (!competencia) errs.competencia = 'Competência obrigatória'

    const docDigits = documento.replace(/\D/g, '')
    if (tipoPessoa === 'PJ') {
      if (!validarCNPJ(docDigits)) errs.documento = 'CNPJ inválido — verifique os dígitos'
    } else {
      if (!validarCPF(docDigits)) errs.documento = 'CPF inválido — verifique os dígitos'
    }
    if (!razaoSocial.trim()) errs.razaoSocial = 'Nome / razão social obrigatório'
    if (!emailTomador.trim() || !emailTomador.includes('@')) errs.emailTomador = 'E-mail inválido'
    if (!municipioIbge) errs.municipioIbge = 'Município obrigatório'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')
    if (!validate()) return
    if (submitting) return

    setSubmitting(true)
    try {
      const payload = {
        servico: {
          codigo_nbs: codigoNbs.trim(),
          discriminacao: discriminacao.trim(),
          valor: parseFloat(valorServico.replace(',', '.')),
          // MEI/SN: alíquota não se aplica (recolhe ISS via DAS). Envia 0
          // para o backend manter o campo no DPS sem cobrar nada.
          aliquota_iss: isSimplesNacional ? 0 : parseFloat(aliquotaIss.replace(',', '.')),
        },
        tomador: {
          tipo: tipoPessoa,
          documento: documento.replace(/\D/g, ''),
          razao_social: razaoSocial.trim(),
          email: emailTomador.trim(),
          municipio_ibge: municipioIbge,
        },
        competencia,
        ...(webhookUrl.trim() ? { webhook_url: webhookUrl.trim() } : {}),
        ...(issRetido !== null ? { iss_retido: issRetido } : {}),
        idempotency_key: idempotencyKey,
      }

      const res = await fetch('/api/nfse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok || res.status === 202) {
        setNotaId(data.nota_id ?? '')
        if (data.regime_tributario) {
          setUserRegime(data.regime_tributario as RegimeTributario)
        }
        setSubmitted(true)
        notify.success('Nota enviada para processamento', 'Acompanhe o status na lista de notas.')
      } else {
        // Padrão obrigatório: toast flutuante + scroll-to-top automático
        // (lib/notify.ts) — banner inline morria abaixo da dobra em mobile.
        const msg = data.message ?? 'Erro ao emitir a nota. Tente novamente.'

        // Mapeia error code do backend pra (título + CTA acionável). Cada
        // erro recoverable ganha link direto pra tela de fix.
        let title = 'Não foi possível emitir a nota'
        let action: { label: string; onClick: () => void } | undefined
        switch (data.error) {
          case 'PLAN_LIMIT_REACHED':
            title = 'Limite do plano atingido'
            action = { label: 'Ver planos', onClick: () => (window.location.href = '/billing') }
            break
          case 'CERTIFICADO_AUSENTE':
            title = 'Certificado A1 não configurado'
            action = {
              label: 'Configurar agora',
              onClick: () => (window.location.href = '/configuracoes?aba=certificado'),
            }
            break
          case 'INSCRICAO_MUNICIPAL_OBRIGATORIA':
            title = 'Inscrição Municipal obrigatória'
            action = {
              label: 'Cadastrar agora',
              onClick: () => (window.location.href = '/configuracoes?aba=perfil'),
            }
            break
          case 'MUNICIPIO_NAO_HABILITADO':
            title = 'Município não habilitado'
            break
          case 'NO_ACCOUNT':
            title = 'Sessão sem empresa vinculada'
            action = {
              label: 'Fazer login',
              onClick: () => (window.location.href = '/login?produto=me'),
            }
            break
        }
        notify.error(title, msg, action ? { action } : undefined)
        setApiError(msg) // mantém banner inline como fallback acessibilidade
      }
    } catch {
      notify.error(
        'Falha de conexão',
        'Não foi possível alcançar o servidor. Verifique sua internet e tente novamente.',
      )
      setApiError('Falha de conexão — verifique sua internet.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state
  if (submitted) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl">
        <div className="rounded-xl border border-nota-autorizada/40 bg-nota-autorizada/10 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-display text-xl font-bold text-nota-autorizada mb-2">
            Nota enviada para processamento
          </h2>
          <p className="text-text-2 text-sm mb-6">
            A Receita Federal irá processar sua NFS-e em instantes. Você receberá o resultado via webhook.
          </p>
          {/* ME-42: ISS recolhimento card no sucesso */}
          {userRegime && (
            <div className="mt-4 mb-2 text-left">
              <ISSRecolhimentoCard
                regime={userRegime}
                issRetido={issRetido}
                competencia={competencia}
              />
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap mt-4">
            {notaId && (
              <Link
                href={`/notas/${notaId}`}
                className="bg-brand-cyan text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition"
              >
                Ver status da nota →
              </Link>
            )}
            <Link
              href="/notas"
              className="border border-navy-600 text-text-1 font-semibold text-sm px-5 py-2.5 rounded-lg hover:border-brand-cyan transition"
            >
              Ver todas as notas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form
  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      {/* Back */}
      <Link
        href="/notas"
        className="text-sm text-text-2 hover:text-brand-cyan transition mb-4 inline-block"
      >
        ← Voltar para lista
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Emitir NFS-e</h1>
        <p className="text-text-2 mt-1 text-sm">
          {isMei
            ? 'Como MEI, basta informar o serviço, o valor e o tomador. O DAS fixo mensal já cobre os impostos.'
            : isSimplesNacional
            ? 'Como Simples Nacional, basta informar o serviço, o valor e o tomador. O ISS é recolhido via DAS.'
            : 'Preencha os dados abaixo para emitir uma nova nota fiscal.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">

        {/* Template selector — only rendered when user has Pro/Business templates */}
        {templates.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-navy-600 bg-navy-700/50 px-4 py-3">
            <span className="text-sm text-text-2 shrink-0">📄 Usar template:</span>
            <Select
              value={selectedTemplate}
              onChange={handleTemplateChange}
              placeholder="— Selecionar template —"
              options={templates.map(t => ({ value: t.id, label: t.nome }))}
              className="flex-1"
              aria-label="Usar template"
            />
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate('')
                }}
                className="text-xs text-text-2 hover:text-text-1 transition shrink-0"
                title="Limpar template"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* API error banner */}
        {apiError && (
          <div className="rounded-xl border border-nota-rejeitada/40 bg-nota-rejeitada/10 px-4 py-3 text-sm text-nota-rejeitada">
            {apiError}
          </div>
        )}

        {/* Seção 1 — Serviço */}
        <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg">1. Dados do Serviço</h2>

          <Field label="Serviço prestado" error={errors.codigoNbs}>
            <NBSServicoPicker
              value={codigoNbs}
              selectedDescricao={nbsDescricao}
              onSelect={(codigo, descricao) => {
                setCodigoNbs(codigo)
                setNbsDescricao(descricao)
              }}
              error={errors.codigoNbs}
            />
            <p className="text-xs text-text-2">
              Busque pelo nome do serviço. A lista é filtrada conforme a categoria da sua empresa.
            </p>
            <SugestorNBS
              descricao={discriminacao}
              onSelect={(codigo, descricao) => {
                setCodigoNbs(codigo)
                setNbsDescricao(descricao)
              }}
            />
          </Field>

          <Field label="Discriminação do serviço" error={errors.discriminacao}>
            <div className="relative">
              <textarea
                className={`${inputCls} w-full resize-none h-24`}
                placeholder="Descreva o serviço prestado conforme o contrato..."
                maxLength={500}
                value={discriminacao}
                onChange={e => setDiscriminacao(e.target.value)}
              />
              <span className="absolute bottom-2 right-3 text-xs text-text-2">
                {discriminacao.length}/500
              </span>
            </div>
          </Field>

          <div className={`grid grid-cols-1 ${isSimplesNacional ? '' : 'sm:grid-cols-2'} gap-4`}>
            <Field label="Valor do serviço (R$)" error={errors.valorServico}>
              <MoneyInput
                className={inputCls}
                value={valorServico}
                onChange={setValorServico}
              />
            </Field>
            {/* Alíquota ISS — só pra LP/LR. MEI e SN recolhem ISS via DAS, alíquota não se aplica.
                Espera empresaResolved pra evitar flash do campo. */}
            {empresaResolved && !isSimplesNacional && (
              <Field label="Alíquota ISS (%)">
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="2,0"
                  value={aliquotaIss}
                  onChange={e => setAliquotaIss(e.target.value)}
                />
              </Field>
            )}
          </div>

          {/* MEI/SN: nota explicativa sobre o DAS — sem valor fixo (muda anualmente) */}
          {empresaResolved && isSimplesNacional && (
            <div className="flex items-start gap-2 bg-brand-cyan/5 border border-brand-cyan/20 rounded-lg px-4 py-2.5">
              <span className="text-base shrink-0 mt-0.5">💡</span>
              <p className="text-xs text-text-2 leading-relaxed">
                {isMei ? (
                  <>Como <strong className="text-text-1">MEI</strong>, você paga apenas o <strong className="text-text-1">DAS mensal fixo</strong> (gerado pelo PGMEI). ISS por nota não se aplica — não é necessário informar alíquota nem retenção.</>
                ) : (
                  <>Como <strong className="text-text-1">Simples Nacional</strong>, o ISS é recolhido junto com o DAS mensal pela alíquota efetiva do seu anexo. Não é necessário informar alíquota por nota.</>
                )}
              </p>
            </div>
          )}

          {/* ISS preview — só pra LP/LR */}
          {empresaResolved && !isSimplesNacional && issEstimado !== null && (
            <div className="flex items-center gap-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-lg px-4 py-2.5">
              <span className="text-xs text-brand-cyan font-semibold">ISS estimado:</span>
              <span className="text-sm font-mono text-brand-cyan">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(issEstimado)}
              </span>
            </div>
          )}

          <Field label="Competência" error={errors.competencia}>
            <input
              type="month"
              className={inputCls}
              value={competencia}
              onChange={e => setCompetencia(e.target.value)}
            />
          </Field>
        </section>

        {/* Seção 2 — Tomador */}
        <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg">2. Dados do Tomador</h2>

          {/* Cliente combobox — autocomplete a partir do Starter */}
          <ClienteCombobox
            onSelect={aplicarCliente}
            locked={!podeUsarClientes}
          />

          {/* PF / PJ toggle */}
          <div>
            <p className="text-sm font-medium text-text-1 mb-2">Tipo de pessoa</p>
            <div className="flex gap-2">
              {(['PJ', 'PF'] as TipoDoc[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTipoPessoa(t); setDocumento('') }}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                    tipoPessoa === t
                      ? 'bg-brand-cyan text-navy-900'
                      : 'border border-navy-600 text-text-2 hover:border-brand-cyan'
                  }`}
                >
                  {t === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </button>
              ))}
            </div>
          </div>

          <Field label={tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'} error={errors.documento}>
            <input
              type="text"
              className={inputCls}
              placeholder={tipoPessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              value={documento}
              onChange={e => handleDocumento(e.target.value)}
            />
          </Field>

          <Field label={tipoPessoa === 'PJ' ? 'Razão social' : 'Nome completo'} error={errors.razaoSocial}>
            <input
              type="text"
              className={inputCls}
              placeholder={tipoPessoa === 'PJ' ? 'Empresa Cliente LTDA' : 'João da Silva'}
              value={razaoSocial}
              onChange={e => setRazaoSocial(e.target.value)}
            />
          </Field>

          <Field label="E-mail do tomador" error={errors.emailTomador}>
            <input
              type="email"
              className={inputCls}
              placeholder="financeiro@empresa.com"
              value={emailTomador}
              onChange={e => setEmailTomador(e.target.value)}
            />
          </Field>

          <Field label="Município do tomador" error={errors.municipioIbge}>
            <CepMunicipioInput
              value={municipioIbge}
              onChange={(code: string) => setMunicipioIbge(code)}
              error={errors.municipioIbge}
            />
          </Field>
        </section>

        {/* Seção 3 — Configurações opcionais.
            Para MEI a seção é completamente escondida: webhook e chave de
            idempotência são features de integração via API (produto separado
            do Nota Fácil MEI). O ISS retido também não se aplica (recolhe via
            DAS). A idempotency key continua sendo gerada e enviada por
            baixo dos panos pra evitar duplicação em caso de retry de rede.

            empresaResolved evita que a seção apareça brevemente durante o
            carregamento — sem isso, MEI via "Configurações opcionais" piscar
            no fim da página antes de sumir. */}
        {empresaResolved && !isMei && (
          <details className="rounded-xl border border-navy-600 bg-navy-700">
            <summary className="px-6 py-4 font-semibold text-sm cursor-pointer list-none flex justify-between items-center">
              <span>3. Configurações opcionais</span>
              <span className="text-brand-cyan text-lg group-open:rotate-45 transition-transform">+</span>
            </summary>
            <div className="px-6 pb-6 flex flex-col gap-4">
              <Field label="URL de webhook (esta nota)">
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://seu-erp.com/webhooks/nfse"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                />
              </Field>

              {/* ME-41: ISS retido toggle — só faz sentido pra Lucro Presumido/Real. */}
              {!isSimplesNacional && (
                <div className="rounded-lg border border-navy-600 p-4">
                  <p className="text-sm font-semibold text-text-1 mb-1">Retenção de ISS</p>
                  <p className="text-xs text-text-2 mb-3">
                    Marque se o tomador é responsável pela retenção do ISS na fonte (regra do município).
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {([
                      { label: 'Não especificado', value: null },
                      { label: 'ISS retido na fonte', value: true },
                      { label: 'ISS não retido', value: false },
                    ] as const).map(({ label, value }) => (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setIssRetido(value)}
                        className={[
                          'flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition border',
                          issRetido === value
                            ? 'bg-brand-cyan text-navy-900 border-brand-cyan'
                            : 'border-navy-600 text-text-2 hover:border-brand-cyan',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Field label="Chave de idempotência">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={`${inputCls} flex-1 font-mono text-xs`}
                    value={idempotencyKey}
                    onChange={e => setIdempotencyKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIdempotencyKey(crypto.randomUUID())}
                    title="Gerar novo UUID"
                  >
                    ↺
                  </Button>
                </div>
                <p className="text-xs text-text-2">Reenvie com a mesma chave para evitar duplicatas.</p>
              </Field>
            </div>
          </details>
        )}

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
          >
            {submitting ? 'Enviando…' : 'Emitir nota'}
          </Button>
          <Link href="/notas" className="text-sm text-text-2 hover:text-text-1 transition">
            Cancelar
          </Link>
        </div>

      </form>
    </div>
  )
}
