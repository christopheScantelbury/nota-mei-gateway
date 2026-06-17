'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'

const ALL_PAGES = [
  { path: '/admin/usuarios',   label: 'Usuários' },
  { path: '/admin/notas',      label: 'Notas Fiscais' },
  { path: '/admin/planos',     label: 'Planos' },
  { path: '/admin/landing',    label: 'Landing' },
  // /admin/permissoes intencionalmente NÃO listado — só super_admin acessa
]

interface Grant {
  page_path: string
  can_read: boolean
  can_write: boolean
}

interface AdminRow {
  user_id: string
  role: 'admin' | 'super_admin'
  ativo: boolean
  notes: string | null
  created_at: string
  email: string
  grants: Grant[]
}

interface Props {
  initialAdmins: AdminRow[]
  currentUserId: string
}

export default function PermissoesClient({ initialAdmins, currentUserId }: Props) {
  const router = useRouter()
  const [admins, setAdmins] = useState(initialAdmins)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [pending, startTransition] = useTransition()

  async function refresh() {
    startTransition(() => {
      router.refresh()
    })
  }

  async function toggleAtivo(userId: string, ativo: boolean) {
    const res = await fetch(`/admin/api/permissoes/${userId}/ativo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    })
    if (res.ok) {
      setAdmins((arr) => arr.map((a) => (a.user_id === userId ? { ...a, ativo: !ativo } : a)))
      notify.success(`Admin ${!ativo ? 'reativado' : 'desativado'}`)
    } else {
      notify.error('Erro ao alterar status', (await res.json()).message)
    }
  }

  async function saveGrants(userId: string, newGrants: Grant[]) {
    const res = await fetch(`/admin/api/permissoes/${userId}/grants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grants: newGrants }),
    })
    if (res.ok) {
      setAdmins((arr) =>
        arr.map((a) => (a.user_id === userId ? { ...a, grants: newGrants } : a)),
      )
      notify.success('Permissões salvas')
      setEditingUserId(null)
      refresh()
    } else {
      notify.error('Erro ao salvar permissões', (await res.json()).message)
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowNewModal(true)}
          disabled={pending}
          className="bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
        >
          + Adicionar admin
        </button>
      </div>

      <div className="rounded-xl border border-navy-600 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-700 border-b border-navy-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Páginas liberadas</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-2 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.user_id} className="border-b border-navy-600 last:border-0">
                <td className="px-4 py-3">
                  <p className="text-text-1 font-medium">{a.email}</p>
                  {a.user_id === currentUserId && (
                    <p className="text-xs text-brand-cyan mt-0.5">(você)</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      a.role === 'super_admin'
                        ? 'bg-nota-upgrade/20 text-nota-upgrade'
                        : 'bg-navy-600 text-text-2'
                    }`}
                  >
                    {a.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-2">
                  {a.role === 'super_admin' ? (
                    <span className="text-xs italic">acesso total</span>
                  ) : a.grants.length === 0 ? (
                    <span className="text-xs italic text-nota-rejeitada">sem grants</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {a.grants.map((g) => (
                        <span
                          key={g.page_path}
                          className="text-xs px-2 py-0.5 rounded bg-navy-700 border border-navy-600"
                          title={`R:${g.can_read ? '✓' : '✗'} W:${g.can_write ? '✓' : '✗'}`}
                        >
                          {g.page_path.replace('/admin/', '')}
                          {g.can_write && ' ✏️'}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.ativo ? (
                    <span className="text-xs text-nota-autorizada">● ativo</span>
                  ) : (
                    <span className="text-xs text-nota-cancelada">○ inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {a.role !== 'super_admin' && (
                    <>
                      <button
                        onClick={() => setEditingUserId(a.user_id)}
                        className="text-xs text-brand-cyan hover:underline mr-3"
                      >
                        Editar
                      </button>
                      {a.user_id !== currentUserId && (
                        <button
                          onClick={() => toggleAtivo(a.user_id, a.ativo)}
                          className="text-xs text-text-2 hover:text-text-1"
                        >
                          {a.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUserId && (
        <EditGrantsModal
          admin={admins.find((a) => a.user_id === editingUserId)!}
          onClose={() => setEditingUserId(null)}
          onSave={(g) => saveGrants(editingUserId, g)}
        />
      )}

      {showNewModal && (
        <NewAdminModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            refresh()
          }}
        />
      )}
    </>
  )
}

// ── Edit grants modal ─────────────────────────────────────────────────────
function EditGrantsModal({
  admin,
  onClose,
  onSave,
}: {
  admin: AdminRow
  onClose: () => void
  onSave: (grants: Grant[]) => void
}) {
  const [grants, setGrants] = useState<Grant[]>(admin.grants)

  function setPerm(page: string, kind: 'read' | 'write', value: boolean) {
    setGrants((arr) => {
      const existing = arr.find((g) => g.page_path === page)
      if (existing) {
        return arr.map((g) =>
          g.page_path === page
            ? {
                ...g,
                can_read: kind === 'read' ? value : g.can_read,
                can_write: kind === 'write' ? value : g.can_write,
              }
            : g,
        )
      }
      return [
        ...arr,
        {
          page_path: page,
          can_read: kind === 'read' ? value : false,
          can_write: kind === 'write' ? value : false,
        },
      ]
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-lg w-full">
        <h2 className="font-display text-xl font-extrabold mb-1">{admin.email}</h2>
        <p className="text-xs text-text-2 mb-4">Marque o que esse admin pode fazer em cada área.</p>

        <div className="space-y-2 mb-6">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-xs font-semibold text-text-2 uppercase">
            <span>Página</span>
            <span>Ler</span>
            <span>Escrever</span>
          </div>
          {ALL_PAGES.map((p) => {
            const g = grants.find((g) => g.page_path === p.path)
            return (
              <div
                key={p.path}
                className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 items-center bg-navy-800 rounded-lg border border-navy-600"
              >
                <span className="text-sm">{p.label}</span>
                <input
                  type="checkbox"
                  checked={g?.can_read ?? false}
                  onChange={(e) => setPerm(p.path, 'read', e.target.checked)}
                  className="w-4 h-4 accent-brand-cyan"
                  aria-label={`Ler ${p.label}`}
                />
                <input
                  type="checkbox"
                  checked={g?.can_write ?? false}
                  onChange={(e) => setPerm(p.path, 'write', e.target.checked)}
                  className="w-4 h-4 accent-brand-cyan"
                  aria-label={`Escrever ${p.label}`}
                />
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-2 hover:text-text-1"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(grants.filter((g) => g.can_read || g.can_write))}
            className="bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New admin modal ───────────────────────────────────────────────────────
function NewAdminModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/admin/api/permissoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, notes }),
    })
    if (res.ok) {
      notify.success('Admin criado')
      onCreated()
    } else {
      notify.error('Erro ao criar admin', (await res.json()).message)
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-md w-full"
      >
        <h2 className="font-display text-xl font-extrabold mb-4">Novo admin</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="usuario@empresa.com.br"
              className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-text-2 mt-1">Email deve já estar cadastrado em auth.users.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'super_admin')}
              className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="admin">Admin (precisa de grants)</option>
              <option value="super_admin">Super admin (acesso total)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo do acesso"
              className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? 'Criando…' : 'Criar admin'}
          </button>
        </div>
      </form>
    </div>
  )
}
