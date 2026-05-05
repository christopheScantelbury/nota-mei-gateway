'use client'

import { useState } from 'react'
import Link from 'next/link'

const MIN_PER_NOTE  = 30   // minutos para emitir manualmente via prefeitura
const NFM_PER_NOTE  = 0.5  // minutos com Nota Fácil MEI (~30 segundos)
const HOURLY_RATE   = 80   // R$/h — taxa conservadora para prestador MEI

function savedDisplay(savedMin: number): string {
  return (savedMin / 60).toFixed(1)
}

export default function TimeSavingsCalculator() {
  const [notas, setNotas] = useState(10)

  const manualMin = notas * MIN_PER_NOTE
  const nfmMin    = notas * NFM_PER_NOTE
  const savedMin  = manualMin - nfmMin
  const savedH    = savedDisplay(savedMin)
  const recovered = Math.round(parseFloat(savedH) * HOURLY_RATE)

  const manualDisplay = manualMin >= 60
    ? `~${Math.round(manualMin / 60)}h`
    : `~${manualMin}min`

  const nfmDisplay = nfmMin < 1 ? '<1min' : `~${Math.ceil(nfmMin)}min`

  return (
    <div className="bg-navy-700 border border-navy-600 rounded-2xl p-8">
      <div className="max-w-xl mx-auto">

        {/* Slider */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-text-1">
              Quantas notas você emite por mês?
            </label>
            <span className="text-brand-cyan font-display font-extrabold text-2xl w-10 text-right">
              {notas}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={notas}
            onChange={e => setNotas(Number(e.target.value))}
            className="w-full accent-brand-cyan cursor-pointer"
          />
          <div className="flex justify-between text-xs text-text-2 mt-1.5">
            <span>1 nota</span>
            <span>50 notas</span>
          </div>
        </div>

        {/* Resultado */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-navy-900 border border-navy-600 rounded-xl p-4 text-center">
            <p className="text-text-2 text-xs mb-3 leading-tight">Hoje (prefeitura)</p>
            <p className="font-display font-extrabold text-xl text-nota-rejeitada">
              {manualDisplay}
            </p>
            <p className="text-text-2 text-[10px] mt-1">por mês</p>
          </div>
          <div className="bg-navy-900 border border-nota-autorizada/30 rounded-xl p-4 text-center">
            <p className="text-text-2 text-xs mb-3 leading-tight">Com Nota Fácil MEI</p>
            <p className="font-display font-extrabold text-xl text-nota-autorizada">
              {nfmDisplay}
            </p>
            <p className="text-text-2 text-[10px] mt-1">por mês</p>
          </div>
          <div className="bg-brand-cyan/10 border border-brand-cyan/30 rounded-xl p-4 text-center">
            <p className="text-text-2 text-xs mb-3 leading-tight">Você economiza</p>
            <p className="font-display font-extrabold text-xl text-brand-cyan">
              {savedH}h
            </p>
            <p className="text-text-2 text-[10px] mt-1">todo mês</p>
          </div>
        </div>

        {/* Valor */}
        <div className="bg-navy-900 border border-navy-600 rounded-xl px-5 py-4 text-center mb-6">
          <p className="text-text-2 text-sm leading-relaxed">
            Isso equivale a{' '}
            <span className="text-text-1 font-bold">R$ {recovered}</span>
            {' '}em horas que você pode cobrar de novos clientes
          </p>
          <p className="text-text-2 text-xs mt-1">
            Base: {notas} nota{notas !== 1 ? 's' : ''} × 30 min economizado cada · R$ {HOURLY_RATE}/h
          </p>
        </div>

        <Link
          href="/cadastro?produto=mei&origem=calculadora"
          className="block w-full text-center bg-brand-cyan text-navy-900 dark:text-[#0A0F1E] font-semibold py-3 rounded-xl text-sm hover:opacity-90 transition"
        >
          Começar grátis e recuperar esse tempo →
        </Link>
      </div>
    </div>
  )
}
