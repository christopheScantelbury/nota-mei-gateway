'use client'

import Link from 'next/link'

const PRAZO = new Date('2026-09-01T00:00:00-03:00')

export function AvisoMigracao() {
  const dias = Math.ceil((PRAZO.getTime() - Date.now()) / 86_400_000)

  // Exibe apenas nos últimos 90 dias antes do prazo
  if (dias > 90 || dias <= 0) return null

  const urgente = dias <= 30

  return (
    <div
      className={`rounded-xl border p-5 flex items-start gap-4 ${
        urgente
          ? 'border-nota-rejeitada/30 bg-nota-rejeitada/5'
          : 'border-nota-processando/30 bg-nota-processando/5'
      }`}
    >
      <span className="text-2xl shrink-0" aria-hidden>⚠️</span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold mb-1 ${urgente ? 'text-nota-rejeitada' : 'text-nota-processando'}`}>
          {urgente
            ? `Prazo crítico: ${dias} dia${dias !== 1 ? 's' : ''} para a obrigatoriedade NFS-e Nacional`
            : `NFS-e Nacional obrigatória em ${dias} dias (01/09/2026)`}
        </p>
        <p className="text-sm text-text-2 mb-3 leading-relaxed">
          A partir de 01/09/2026, MEIs que cresceram para ME ou EPP precisarão
          emitir pelo padrão NFS-e Nacional. Verifique sua situação com seu contador
          e migre antes do prazo para evitar penalidades.
        </p>
        <Link
          href="/configuracoes/migrar"
          className="text-sm font-medium text-brand-cyan hover:underline"
        >
          Entender a migração MEI → ME →
        </Link>
      </div>
    </div>
  )
}
