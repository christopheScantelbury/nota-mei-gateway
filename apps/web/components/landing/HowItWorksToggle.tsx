'use client'

import { useState } from 'react'

// Spec: HIST-1.4 + 03-Copies-Finais.md "Seção Como funciona" — 3 abas (MEI / ME-EPP / Dev).

const stepsMEI = [
  { step: '01', title: 'Cadastre seu CNPJ',  desc: 'Informe seu CNPJ e envie o certificado digital A1 uma única vez. Em segundos sua conta está pronta.' },
  { step: '02', title: 'Preencha os dados',  desc: 'Nome do cliente, serviço prestado e valor. Simples assim — sem XML, sem burocracia.' },
  { step: '03', title: 'Nota emitida',       desc: 'PDF e XML da NFS-e chegam no seu e-mail e no do tomador em segundos.' },
]

const stepsME = [
  {
    step: '01',
    title: 'Cadastre sua empresa',
    desc: 'Informe CNPJ e envie certificado A1. Cadastre quantos CNPJs precisar — multi-empresa nativo. Em segundos sua conta está pronta para os dois regimes (Simples Nacional e Lucro Presumido).',
  },
  {
    step: '02',
    title: 'Emita pela interface ou API',
    desc: 'Para o time fiscal: emita pela interface web simples. Para o time técnico: integre via API REST. O mesmo backend, dois caminhos.',
  },
  {
    step: '03',
    title: 'Conformidade automática',
    desc: 'Cálculo de ISS, retenções, alíquotas e regimes tributários — tudo automático conforme o município. PDF e XML chegam por e-mail e ficam disponíveis no painel por 11 anos (Ajuste SINIEF 2/2025).',
  },
]

const stepsDev = [
  { step: '01', title: 'Cadastre o MEI',     desc: 'Crie a conta, faça upload do certificado A1 e receba sua API Key (sk_live_ ou sk_test_) em segundos.' },
  { step: '02', title: 'Emita via POST',     desc: 'Um POST /v1/nfse com tomador, serviço e webhook_url. A gente assina o XML, manda pra Receita e devolve 202 Accepted.' },
  { step: '03', title: 'Receba via webhook', desc: 'Evento nfse.autorizada assinado (HMAC-SHA256) com número da NFS-e, links de PDF e XML direto no seu endpoint.' },
]

type Tab = 'mei' | 'me' | 'dev'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'mei', label: 'Sou MEI',     icon: '📱' },
  { id: 'me',  label: 'Sou ME/EPP',  icon: '🏢' },
  { id: 'dev', label: 'Sou dev',     icon: '</>' },
]

export default function HowItWorksToggle() {
  const [tab, setTab] = useState<Tab>('mei')
  const steps = tab === 'mei' ? stepsMEI : tab === 'me' ? stepsME : stepsDev

  return (
    <>
      {/* Toggle — 3 estados (MEI / ME-EPP / Dev) */}
      <div className="flex flex-wrap rounded-xl border border-navy-600 p-1 w-fit mx-auto mb-12 bg-navy-900 gap-1">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === id
                ? 'bg-brand-cyan text-navy-900'
                : 'text-text-2 hover:text-text-1'
            }`}
          >
            <span className={id === 'dev' ? 'font-mono' : ''}>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map(({ step, title, desc }) => (
          <div key={step} className="bg-navy-700 border border-navy-600 rounded-2xl p-6">
            <span className="text-brand-cyan font-mono text-sm font-bold">{step}</span>
            <h3 className="font-display text-xl font-bold mt-2 mb-3">{title}</h3>
            <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </>
  )
}
