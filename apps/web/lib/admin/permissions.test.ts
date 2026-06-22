import { describe, it, expect } from 'vitest'
import { canRead, canWrite, type AdminContext } from './permissions'

function ctx(
  over: Omit<Partial<AdminContext>, 'grants'> & {
    grants?: Record<string, { canRead: boolean; canWrite: boolean }>
  } = {},
): AdminContext {
  const grants = new Map<string, { canRead: boolean; canWrite: boolean }>()
  for (const [path, perms] of Object.entries(over.grants ?? {})) {
    grants.set(path, perms)
  }
  return {
    isAdmin: over.isAdmin ?? false,
    isSuperAdmin: over.isSuperAdmin ?? false,
    grants,
  }
}

describe('canRead', () => {
  it('denies non-admin everything', () => {
    expect(canRead(ctx(), '/admin')).toBe(false)
    expect(canRead(ctx(), '/admin/usuarios')).toBe(false)
  })

  it('allows super_admin everything', () => {
    const c = ctx({ isAdmin: true, isSuperAdmin: true })
    expect(canRead(c, '/admin')).toBe(true)
    expect(canRead(c, '/admin/usuarios')).toBe(true)
    expect(canRead(c, '/admin/planos')).toBe(true)
  })

  // BUG-002 (QA RV-2 2026-06-17): admin não-super tinha grants só pra
  // sub-páginas e era jogado pra /home ao acessar o índice /admin.
  it('allows ANY active admin to read the /admin index even without a root grant', () => {
    const c = ctx({
      isAdmin: true,
      grants: {
        '/admin/usuarios': { canRead: true, canWrite: false },
        '/admin/notas': { canRead: true, canWrite: false },
      },
    })
    expect(canRead(c, '/admin')).toBe(true)
  })

  it('respects per-page grants for sub-pages', () => {
    const c = ctx({
      isAdmin: true,
      grants: { '/admin/usuarios': { canRead: true, canWrite: false } },
    })
    expect(canRead(c, '/admin/usuarios')).toBe(true)
    expect(canRead(c, '/admin/usuarios/123')).toBe(true) // prefix match
    expect(canRead(c, '/admin/planos')).toBe(false)
  })

  it('does not leak a sub-page grant into a sibling via partial string match', () => {
    const c = ctx({
      isAdmin: true,
      grants: { '/admin/notas': { canRead: true, canWrite: false } },
    })
    // '/admin/notas-fiscais' must NOT match '/admin/notas'
    expect(canRead(c, '/admin/notas-fiscais')).toBe(false)
  })
})

describe('canWrite', () => {
  it('denies non-admin', () => {
    expect(canWrite(ctx(), '/admin/usuarios')).toBe(false)
  })

  it('allows super_admin everything', () => {
    expect(canWrite(ctx({ isAdmin: true, isSuperAdmin: true }), '/admin/usuarios')).toBe(true)
  })

  it('requires explicit can_write grant for non-super admin', () => {
    const c = ctx({
      isAdmin: true,
      grants: { '/admin/usuarios': { canRead: true, canWrite: false } },
    })
    expect(canWrite(c, '/admin/usuarios')).toBe(false)
  })

  // O índice /admin é só-leitura por design — não há escrita no dashboard raiz.
  it('does NOT grant write on /admin index by default', () => {
    const c = ctx({ isAdmin: true, grants: {} })
    expect(canWrite(c, '/admin')).toBe(false)
  })
})
