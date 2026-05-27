'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Select } from '@/components/ui/Select'
import type { NotaStatus } from '@/lib/types'

const STATUSES: { value: NotaStatus | ''; label: string }[] = [
  { value: '',              label: 'Todas'       },
  { value: 'PROCESSANDO',  label: 'Processando' },
  { value: 'AUTORIZADA',   label: 'Autorizada'  },
  { value: 'REJEITADA',    label: 'Rejeitada'   },
  { value: 'CANCELADA',    label: 'Cancelada'   },
]

function buildMonths(n = 12): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

function formatCompetencia(comp: string) {
  const [year, month] = comp.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]}/${year}`
}

interface Props {
  currentStatus?: string
  currentQ?: string
  currentCompetencia?: string
}

export default function NotasFilterBar({ currentStatus, currentQ, currentCompetencia }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [localQ, setLocalQ] = useState(currentQ ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const months = buildMonths()

  // keep localQ in sync if URL changes externally
  useEffect(() => { setLocalQ(currentQ ?? '') }, [currentQ])

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  function handleQ(val: string) {
    setLocalQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => update('q', val), 400)
  }

  function clearAll() {
    router.push(pathname)
    setLocalQ('')
  }

  const hasFilters = !!(currentStatus || currentQ || currentCompetencia)

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => update('status', value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              (currentStatus ?? '') === value
                ? 'bg-brand-cyan text-navy-900'
                : 'bg-navy-700 border border-navy-600 text-text-2 hover:border-brand-cyan hover:text-text-1'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + Competência + Clear */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={localQ}
          onChange={e => handleQ(e.target.value)}
          placeholder="Buscar por tomador, CNPJ ou RPS"
          className="flex-1 min-w-[200px] bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition"
        />

        <Select
          value={currentCompetencia ?? ''}
          onChange={(v) => update('competencia', v)}
          placeholder="Todas as competências"
          options={[
            { value: '', label: 'Todas as competências' },
            ...months.map(m => ({ value: m, label: formatCompetencia(m) })),
          ]}
          className="min-w-[180px]"
          aria-label="Filtrar por competência"
        />

        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-text-2 hover:text-nota-rejeitada transition underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
