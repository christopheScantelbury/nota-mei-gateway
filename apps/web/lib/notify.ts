'use client'

// notify — wrapper padrão sobre Sonner usado em TODA tela do projeto.
//
// Decisão de UX (2026-06-05):
// Usuário reportou que ao tentar emitir nota e dar erro, ficava sem feedback
// visual (banner inline morria abaixo do dobra da página em mobile). Padrão
// definido pra todo form/ação assíncrona:
//
//   1. Toast FLUTUANTE no top-center (Sonner já configurada no layout root)
//   2. Em ERRO, scroll automático pro topo da página como fallback
//      (caso o user tenha desabilitado animações ou ad-block esconda toasts)
//   3. Duração: 6s erro (default Sonner), 4s sucesso, 4s info
//   4. NUNCA usar window.alert() — feio + bloqueia thread
//   5. NUNCA usar banner inline `<div role="alert">…` dentro do form
//      (era o padrão antigo; some no scroll do mobile)
//
// Uso típico em qualquer Client Component:
//
//   import { notify } from '@/lib/notify'
//
//   async function onSubmit() {
//     try {
//       const res = await fetch('/v1/nfse', {...})
//       if (!res.ok) {
//         const d = await res.json().catch(() => ({}))
//         notify.error('Falha ao emitir nota', d.message ?? 'Erro inesperado')
//         return
//       }
//       notify.success('Nota enviada', 'Processamento iniciado')
//     } catch {
//       notify.error('Falha de conexão', 'Verifique sua internet e tente novamente')
//     }
//   }

import { toast } from 'sonner'

interface NotifyOptions {
  /** Duração custom em ms. Default: 6s erro, 4s success/info. */
  duration?: number
  /** Pular scroll-to-top automático em erro (raro — quase nunca usar). */
  skipScroll?: boolean
  /** CTA acionável dentro do toast — ex: "Configurar agora → /configuracoes". */
  action?: { label: string; onClick: () => void }
}

function scrollToTop() {
  if (typeof window === 'undefined') return
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    window.scrollTo(0, 0)
  }
}

export const notify = {
  /** Erro — toast vermelho + scroll-to-top automático. */
  error(title: string, message?: string, opts?: NotifyOptions): string | number {
    if (!opts?.skipScroll) scrollToTop()
    return toast.error(title, {
      description: message,
      duration: opts?.duration ?? (opts?.action ? 10000 : undefined),
      action: opts?.action,
    })
  },

  /** Sucesso — toast verde. */
  success(title: string, message?: string, opts?: NotifyOptions): string | number {
    return toast.success(title, {
      description: message,
      duration: opts?.duration ?? 4000,
    })
  },

  /** Informativo — toast neutro. */
  info(title: string, message?: string, opts?: NotifyOptions): string | number {
    return toast.info(title, {
      description: message,
      duration: opts?.duration ?? 4000,
    })
  },

  /** Aviso — toast amarelo. */
  warning(title: string, message?: string, opts?: NotifyOptions): string | number {
    return toast.warning(title, {
      description: message,
      duration: opts?.duration ?? 5000,
    })
  },

  /** Loading — retorna id pra dismiss/update depois (ex: await fetch → resolve). */
  loading(message: string): string | number {
    return toast.loading(message)
  },

  /** Dismiss programático (usar com id retornado por loading/show). */
  dismiss(id?: string | number) {
    toast.dismiss(id)
  },
}

export default notify
