'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Empresa = {
  id: string
  tipo: string
  razao_social: string
}

const TIPO_BADGE: Record<string, string> = {
  MEI: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20',
  ME:  'bg-upgrade/10 text-upgrade border-upgrade/20',
  EPP: 'bg-upgrade/10 text-upgrade border-upgrade/20',
}

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold
                       ${TIPO_BADGE[tipo] ?? TIPO_BADGE['MEI']}`}>
      {tipo}
    </span>
  )
}

export function EmpresaSwitcher({
  empresaAtiva,
  todasEmpresas,
}: {
  empresaAtiva: Empresa
  todasEmpresas: Empresa[]
}) {
  const [aberto, setAberto] = useState(false)
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!aberto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  // Single empresa — show just the name, no dropdown
  if (todasEmpresas.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-text-1 text-sm truncate max-w-[160px]">
          {empresaAtiva.razao_social.split(' ').slice(0, 2).join(' ')}
        </span>
        <TipoBadge tipo={empresaAtiva.tipo} />
      </div>
    )
  }

  const selecionarEmpresa = async (empresa: Empresa) => {
    setAberto(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id:    user.id,
        empresa_id: empresa.id,
        updated_at: new Date().toISOString(),
      })
    }
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 text-sm hover:text-text-1 transition-colors"
        aria-expanded={aberto}
        aria-haspopup="listbox"
      >
        <span className="font-medium text-text-1 truncate max-w-[140px]">
          {empresaAtiva.razao_social.split(' ').slice(0, 2).join(' ')}
        </span>
        <TipoBadge tipo={empresaAtiva.tipo} />
        <span className="text-text-2 text-xs">▾</span>
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute top-8 left-0 z-30 w-64 rounded-xl border border-navy-600
                     bg-navy-700 shadow-2xl overflow-hidden"
        >
          {todasEmpresas.map((e) => (
            <button
              key={e.id}
              role="option"
              aria-selected={e.id === empresaAtiva.id}
              onClick={() => selecionarEmpresa(e)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left
                          hover:bg-navy-600 transition-colors
                          ${e.id === empresaAtiva.id ? 'bg-navy-600/60' : ''}`}
            >
              <TipoBadge tipo={e.tipo} />
              <span className="flex-1 truncate text-text-1">{e.razao_social}</span>
              {e.id === empresaAtiva.id && (
                <span className="text-brand-cyan text-xs shrink-0">✓</span>
              )}
            </button>
          ))}
          <div className="border-t border-navy-600">
            <a
              href="/cadastro"
              className="flex items-center gap-2 px-4 py-3 text-sm text-text-2
                         hover:text-text-1 hover:bg-navy-600 transition-colors"
            >
              <span>+</span> Adicionar empresa
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
