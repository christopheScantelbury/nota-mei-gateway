export const metadata = { title: 'Usuários' }

import { createAdminClient } from '@/lib/supabase/admin'
import ChangePlanButton from './ChangePlanButton'
import { PLAN_ORDER } from '@/lib/plans'

type UserRow = {
  id: string
  email: string
  created_at: string
  app_metadata: { role?: string }
  razao_social: string | null
  cnpj: string | null
  plano: string | null
  total_emitidas: number
  emissoes_limite: number | null
}

export default async function AdminUsuariosPage() {
  const supabase = createAdminClient()

  // Lista todos os auth users
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 200 })
  const users = authData?.users ?? []

  // Busca meis + emissoes_mensais do mês atual para todos os usuários
  const competencia = new Date().toISOString().slice(0, 7)

  const { data: meis } = await supabase
    .from('meis')
    .select('id, razao_social, cnpj')
    .returns<{ id: string; razao_social: string; cnpj: string }[]>()

  const { data: emissoes } = await supabase
    .from('emissoes_mensais')
    .select('mei_id, total_emitidas, planos(nome, emissoes_limite)')
    .eq('competencia', competencia)
    .returns<{
      mei_id: string
      total_emitidas: number
      planos: { nome: string; emissoes_limite: number } | null
    }[]>()

  // Monta mapa por id
  const meiMap = Object.fromEntries((meis ?? []).map((m) => [m.id, m]))
  const emissaoMap = Object.fromEntries((emissoes ?? []).map((e) => [e.mei_id, e]))

  const rows: UserRow[] = users.map((u) => {
    const mei = meiMap[u.id]
    const em = emissaoMap[u.id]
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      app_metadata: u.app_metadata as { role?: string },
      razao_social: mei?.razao_social ?? null,
      cnpj: mei?.cnpj ?? null,
      plano: em?.planos?.nome ?? null,
      total_emitidas: em?.total_emitidas ?? 0,
      emissoes_limite: em?.planos?.emissoes_limite ?? null,
    }
  })

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-text-1">Usuários</h1>
          <p className="text-text-2 mt-1 text-sm">{rows.length} usuários cadastrados</p>
        </div>
      </div>

      <div className="rounded-xl border border-navy-600 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-700 border-b border-navy-600 text-xs text-text-2 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Email / Razão Social</th>
                <th className="px-4 py-3 text-left">CNPJ</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Uso ({competencia})</th>
                <th className="px-4 py-3 text-left">Cadastro</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isAdmin = u.app_metadata?.role === 'admin'
                const pct = u.emissoes_limite
                  ? Math.min(100, Math.round((u.total_emitidas / u.emissoes_limite) * 100))
                  : 0
                return (
                  <tr key={u.id} className="border-b border-navy-600 last:border-0 hover:bg-navy-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-1 truncate max-w-[200px]">{u.email}</div>
                      {u.razao_social && (
                        <div className="text-xs text-text-2 truncate max-w-[200px]">{u.razao_social}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-2">{u.cnpj ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        u.plano === 'Business' ? 'bg-nota-upgrade/10 text-nota-upgrade' :
                        u.plano === 'Pro'      ? 'bg-brand-cyan/10 text-brand-cyan' :
                        u.plano === 'Basic'    ? 'bg-nota-autorizada/10 text-nota-autorizada' :
                        u.plano === 'Starter'  ? 'bg-nota-processando/10 text-nota-processando' :
                                                  'bg-navy-600 text-text-2',
                      ].join(' ')}>
                        {u.plano ?? 'Sem plano'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.emissoes_limite ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-navy-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 90 ? 'bg-nota-rejeitada' : pct >= 70 ? 'bg-nota-processando' : 'bg-nota-autorizada'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-2">{u.total_emitidas}/{u.emissoes_limite}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-2">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <span className="text-xs font-bold text-nota-upgrade">ADMIN</span>
                      ) : (
                        <span className="text-xs text-text-2">user</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isAdmin && (
                        <ChangePlanButton
                          userId={u.id}
                          currentPlan={u.plano ?? 'Trial'}
                          plans={PLAN_ORDER}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
