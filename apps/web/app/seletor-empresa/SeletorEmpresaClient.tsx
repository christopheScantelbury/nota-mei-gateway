'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { formatCNPJ } from '@/lib/format'

type Empresa = {
  id: string
  tipo: string
  razao_social: string
  cnpj: string
  regime_tributario: string | null
  trial_me: boolean | null
  emissoes_mensais?: { total_emitidas: number; competencia: string }[]
}

const TIPO_BADGE: Record<string, { label: string; className: string }> = {
  MEI: { label: 'MEI', className: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20' },
  ME:  { label: 'ME',  className: 'bg-upgrade/10 text-upgrade border-upgrade/20' },
  EPP: { label: 'EPP', className: 'bg-upgrade/10 text-upgrade border-upgrade/20' },
}

const REGIME_LABEL: Record<string, string> = {
  SIMPLES_MEI:       'Simples MEI',
  SIMPLES_NACIONAL:  'Simples Nacional',
  LUCRO_PRESUMIDO:   'Lucro Presumido',
}


export function SeletorEmpresaClient({ empresas }: { empresas: Empresa[] }) {
  const router   = useRouter()
  const supabase = createClient()

  const competenciaAtual = new Date().toISOString().slice(0, 7)

  const selecionarEmpresa = async (empresa: Empresa) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id:    user.id,
        empresa_id: empresa.id,
        updated_at: new Date().toISOString(),
      })
    }
    router.push('/home')
  }

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold mb-2">
            Qual empresa você quer acessar?
          </h1>
          <p className="text-text-2 text-sm">
            Você tem {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {empresas.map((empresa) => {
            const badge      = TIPO_BADGE[empresa.tipo] ?? TIPO_BADGE['MEI']
            const emissaoMes = empresa.emissoes_mensais?.find(
              (e) => e.competencia === competenciaAtual
            )
            const notasNoMes = emissaoMes?.total_emitidas ?? 0

            return (
              <button
                key={empresa.id}
                onClick={() => selecionarEmpresa(empresa)}
                className="w-full flex items-center gap-4 rounded-2xl border border-navy-600
                           bg-navy-700 p-5 text-left hover:border-brand-cyan/40
                           hover:bg-navy-600/50 transition-all group"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-navy-600 flex items-center justify-center
                                text-text-1 font-bold text-lg flex-shrink-0">
                  {empresa.razao_social.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-text-1 truncate">{empresa.razao_social}</span>
                    {empresa.trial_me && (
                      <span className="text-xs bg-nota-autorizada/10 text-nota-autorizada
                                       border border-nota-autorizada/20 rounded-full px-2 py-0.5">
                        Trial
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-text-2">
                    <span className={`rounded-full border px-2 py-0.5 ${badge.className}`}>
                      {badge.label}
                    </span>
                    {empresa.regime_tributario && (
                      <span>{REGIME_LABEL[empresa.regime_tributario] ?? empresa.regime_tributario}</span>
                    )}
                    <span>CNPJ {formatCNPJ(empresa.cnpj)}</span>
                  </div>
                </div>

                {/* Notas do mês */}
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-text-1">{notasNoMes}</p>
                  <p className="text-xs text-text-2">notas/mês</p>
                </div>

                <span className="text-text-2 group-hover:text-brand-cyan transition-colors">→</span>
              </button>
            )
          })}
        </div>

        {/* Adicionar empresa */}
        <a
          href="/cadastro"
          className="flex items-center justify-center gap-2 mt-3 rounded-2xl border border-dashed
                     border-navy-600 p-4 text-text-2 hover:border-brand-cyan/30
                     hover:text-text-1 transition-colors"
        >
          <span>+</span>
          <span className="text-sm font-medium">Adicionar outra empresa</span>
        </a>
      </div>
    </main>
  )
}
