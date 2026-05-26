'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { fetchCNPJCliente } from '@/lib/brasilapi'
import { maskCNPJ, maskCPF } from '@/lib/format'
import type { Cliente, ClienteInput } from '@/lib/types-cliente'

interface Props {
  initial?: Partial<Cliente>   // undefined = criar; presente = editar
}

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full'

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-text-2">{hint}</p>}
      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}
    </div>
  )
}

export default function ClienteForm({ initial }: Props) {
  const router  = useRouter()
  const isEdit  = !!initial?.id

  const [tipo, setTipo] = useState<'PJ' | 'PF'>(initial?.tipo ?? 'PJ')
  const [documento, setDocumento]       = useState(initial?.documento ?? '')
  const [razaoSocial, setRazaoSocial]   = useState(initial?.razao_social ?? '')
  const [nomeFantasia, setNomeFantasia] = useState(initial?.nome_fantasia ?? '')
  const [email, setEmail]               = useState(initial?.email ?? '')
  const [telefone, setTelefone]         = useState(initial?.telefone ?? '')
  const [municipioIbge, setMunicipioIbge] = useState(initial?.municipio_ibge ?? '')
  const [uf, setUf]               = useState(initial?.uf ?? '')
  const [cep, setCep]             = useState(initial?.cep ?? '')
  const [logradouro, setLogradouro] = useState(initial?.logradouro ?? '')
  const [numero, setNumero]       = useState(initial?.numero ?? '')
  const [complemento, setComplemento] = useState(initial?.complemento ?? '')
  const [bairro, setBairro]       = useState(initial?.bairro ?? '')
  const [ie, setIe]               = useState(initial?.inscricao_estadual ?? '')
  const [im, setIm]               = useState(initial?.inscricao_municipal ?? '')
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '))
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '')

  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  async function handleLookup() {
    const clean = documento.replace(/\D/g, '')
    if (clean.length !== 14) {
      setError('Digite um CNPJ completo (14 dígitos) para buscar')
      return
    }
    setError(null)
    setLookupLoading(true)
    try {
      const data = await fetchCNPJCliente(clean)
      if (!data) {
        setError('CNPJ não encontrado. Você pode preencher manualmente.')
        return
      }
      // Preenche só campos vazios — não sobrescreve o que o user já editou
      if (!razaoSocial)   setRazaoSocial(data.razao_social)
      if (!nomeFantasia && data.nome_fantasia) setNomeFantasia(data.nome_fantasia)
      if (!email && data.email)         setEmail(data.email)
      if (!telefone && data.telefone)   setTelefone(data.telefone)
      if (!municipioIbge && data.municipio_ibge) setMunicipioIbge(data.municipio_ibge)
      if (!uf && data.uf)               setUf(data.uf)
      if (!cep && data.cep)             setCep(data.cep.replace(/\D/g, ''))
      if (!logradouro && data.logradouro) setLogradouro(data.logradouro)
      if (!numero && data.numero)       setNumero(data.numero)
      if (!complemento && data.complemento) setComplemento(data.complemento)
      if (!bairro && data.bairro)       setBairro(data.bairro)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar CNPJ')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!razaoSocial.trim()) {
      setError('Razão social / nome é obrigatório')
      return
    }
    const docClean = documento.replace(/\D/g, '')
    if ((tipo === 'PJ' && docClean.length !== 14) || (tipo === 'PF' && docClean.length !== 11)) {
      setError(tipo === 'PJ' ? 'CNPJ inválido' : 'CPF inválido')
      return
    }

    const tags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const payload: ClienteInput = {
      tipo,
      documento: docClean,
      razao_social: razaoSocial.trim(),
      nome_fantasia: nomeFantasia.trim() || null,
      email:         email.trim() || null,
      telefone:      telefone.trim() || null,
      municipio_ibge: municipioIbge.trim() || null,
      uf:            uf.trim().toUpperCase() || null,
      cep:           cep.replace(/\D/g, '') || null,
      logradouro:    logradouro.trim() || null,
      numero:        numero.trim() || null,
      complemento:   complemento.trim() || null,
      bairro:        bairro.trim() || null,
      inscricao_estadual:  ie.trim() || null,
      inscricao_municipal: im.trim() || null,
      tags,
      observacoes:   observacoes.trim() || null,
    }

    setSubmitting(true)
    try {
      const url    = isEdit ? `/api/clientes/${initial!.id}` : '/api/clientes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'ALREADY_EXISTS' && data.cliente?.id) {
          if (confirm(`Cliente com este documento já existe (${data.cliente.razao_social}). Abrir?`)) {
            router.push(`/clientes/${data.cliente.id}`)
            return
          }
        }
        throw new Error(data.message ?? 'Erro ao salvar cliente')
      }
      const id = data.cliente?.id ?? initial?.id
      router.push(`/clientes/${id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-nota-rejeitada/40 bg-nota-rejeitada/10 px-4 py-3 text-sm text-nota-rejeitada">
          {error}
        </div>
      )}

      {/* Tipo + documento */}
      <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
        <h2 className="font-display font-bold text-lg">Identificação</h2>

        <Field label="Tipo de cliente">
          <div className="inline-flex gap-1 bg-navy-900 border border-navy-600 rounded-lg p-1">
            {(['PJ', 'PF'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); setDocumento('') }}
                disabled={isEdit}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                  tipo === t ? 'bg-brand-cyan text-navy-900' : 'text-text-2 hover:text-text-1'
                } ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {t === 'PJ' ? 'CNPJ (PJ)' : 'CPF (PF)'}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label={tipo === 'PJ' ? 'CNPJ' : 'CPF'}
          hint={tipo === 'PJ' ? 'Digite e clique em "Buscar dados" para preencher o resto automaticamente' : undefined}
        >
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={tipo === 'PJ' ? maskCNPJ(documento) : maskCPF(documento)}
              onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
              placeholder={tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              readOnly={isEdit}
              maxLength={18}
            />
            {tipo === 'PJ' && !isEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={lookupLoading}
                onClick={handleLookup}
                disabled={documento.replace(/\D/g, '').length !== 14}
                className="shrink-0"
              >
                Buscar dados
              </Button>
            )}
          </div>
        </Field>

        <Field label={tipo === 'PJ' ? 'Razão social' : 'Nome completo'}>
          <input className={inputCls} value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} maxLength={255} required />
        </Field>

        {tipo === 'PJ' && (
          <Field label="Nome fantasia">
            <input className={inputCls} value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} maxLength={255} />
          </Field>
        )}
      </section>

      {/* Contato */}
      <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
        <h2 className="font-display font-bold text-lg">Contato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="E-mail">
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} />
          </Field>
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-4">
        <h2 className="font-display font-bold text-lg">Endereço</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="CEP">
            <input className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} maxLength={9} />
          </Field>
          <Field label="UF">
            <input className={inputCls} value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} placeholder="SP" />
          </Field>
          <Field label="Município (IBGE 7-dígitos)" hint="Obrigatório pra emitir NFS-e">
            <input className={inputCls} value={municipioIbge} onChange={(e) => setMunicipioIbge(e.target.value.replace(/\D/g, ''))} maxLength={7} placeholder="3550308" />
          </Field>
        </div>
        <Field label="Logradouro">
          <input className={inputCls} value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
          <Field label="Número">
            <input className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Complemento">
            <input className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
          </Field>
          <Field label="Bairro">
            <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Fiscal + organização (opcional) */}
      <details className="rounded-xl border border-navy-600 bg-navy-700/30">
        <summary className="cursor-pointer px-6 py-4 font-medium text-sm text-text-2 select-none">
          Dados fiscais e organização (opcional)
        </summary>
        <div className="p-6 pt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Inscrição Estadual">
              <input className={inputCls} value={ie} onChange={(e) => setIe(e.target.value)} maxLength={20} />
            </Field>
            <Field label="Inscrição Municipal">
              <input className={inputCls} value={im} onChange={(e) => setIm(e.target.value)} maxLength={20} />
            </Field>
          </div>
          <Field label="Tags" hint="Separadas por vírgula (ex.: vip, recorrente, atrasado)">
            <input className={inputCls} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </Field>
          <Field label="Observações">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
      </details>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
          {isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
