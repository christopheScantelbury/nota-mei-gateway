'use client'

import { useState } from 'react'

const stepsMEI = [
  {
    step: '01',
    title: 'Cadastre seu CNPJ',
    desc: 'Informe seu CNPJ e envie o certificado digital A1 uma única vez. Em segundos sua conta está pronta.',
  },
  {
    step: '02',
    title: 'Preencha os dados',
    desc: 'Nome do cliente, serviço prestado e valor. Simples assim — sem XML, sem burocracia.',
  },
  {
    step: '03',
    title: 'Nota emitida',
    desc: 'PDF e XML da NFS-e chegam no seu e-mail e no do tomador em segundos.',
  },
]

const stepsDev = [
  {
    step: '01',
    title: 'Cadastre o MEI',
    desc: 'Crie a conta, faça upload do certificado A1 e receba sua API Key (sk_live_ ou sk_test_) em segundos.',
  },
  {
    step: '02',
    title: 'Emita via POST',
    desc: 'Um POST /v1/nfse com tomador, serviço e webhook_url. A gente assina o XML, manda pra Receita e devolve 202 Accepted.',
  },
  {
    step: '03',
    title: 'Receba via webhook',
    desc: 'Evento nfse.autorizada assinado (HMAC-SHA256) com número da NFS-e, links de PDF e XML direto no seu endpoint.',
  },
]

export default function HowItWorksToggle() {
  const [tab, setTab] = useState<'mei' | 'dev'>('mei')
  const steps = tab === 'mei' ? stepsMEI : stepsDev

  return (
    <>
      {/* Toggle */}
      <div className="flex rounded-xl border border-navy-600 p-1 w-fit mx-auto mb-12 bg-navy-900">
        <button
          onClick={() => setTab('mei')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'mei'
              ? 'bg-brand-cyan text-navy-900'
              : 'text-text-2 hover:text-text-1'
          }`}
        >
          📱 Sou MEI
        </button>
        <button
          onClick={() => setTab('dev')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'dev'
              ? 'bg-brand-cyan text-navy-900'
              : 'text-text-2 hover:text-text-1'
          }`}
        >
          {'</>'} Sou dev
        </button>
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
