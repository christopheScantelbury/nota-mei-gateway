'use client'

import type { Nota } from '@/lib/types'

interface Props {
  notas: Pick<Nota, 'id' | 'numero_rps' | 'tomador_nome' | 'tomador_doc' | 'valor_servico' | 'competencia' | 'status' | 'emitida_em' | 'created_at'>[]
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function ExportCSVButton({ notas }: Props) {
  function handleExport() {
    const headers = ['ID', 'RPS', 'Tomador', 'Documento', 'Valor', 'Competência', 'Status', 'Emitida em']
    const rows = notas.map(n => [
      n.id,
      n.numero_rps,
      n.tomador_nome ?? '',
      n.tomador_doc ?? '',
      n.valor_servico ?? '',
      n.competencia ?? '',
      n.status,
      n.emitida_em ?? n.created_at,
    ].map(escapeCSV).join(','))

    // UTF-8 BOM for Excel compatibility
    const bom = '﻿'
    const csv = bom + [headers.join(','), ...rows].join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 border border-navy-600 text-text-2 text-sm font-semibold px-3 py-2 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Exportar CSV
    </button>
  )
}
