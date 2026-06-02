/**
 * Bloco de destaque reutilizável (info/warn/success/danger).
 * Funciona tanto em MDX quanto em TSX.
 *
 * Spec: HIST-5.0 + 05-Componentes-React.md.
 *
 * @example
 * <Callout type="warn" title="Atenção">
 *   A partir de 01/09/2026, emissões pelo padrão antigo podem ser rejeitadas.
 * </Callout>
 */
interface Props {
  type?: 'info' | 'warn' | 'success' | 'danger'
  title?: string
  children: React.ReactNode
  className?: string
}

const STYLE: Record<NonNullable<Props['type']>, { wrap: string; icon: string; emoji: string }> = {
  info:    { wrap: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-500/10 dark:border-sky-400/30 dark:text-sky-100',           icon: 'text-sky-600',    emoji: 'ℹ️' },
  warn:    { wrap: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-100', icon: 'text-amber-700',  emoji: '⚠️' },
  success: { wrap: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-500/10 dark:border-green-400/30 dark:text-green-100', icon: 'text-green-700',  emoji: '✅' },
  danger:  { wrap: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-400/30 dark:text-red-100',           icon: 'text-red-700',    emoji: '🚨' },
}

export default function Callout({ type = 'info', title, children, className = '' }: Props) {
  const s = STYLE[type]
  return (
    <div
      role="note"
      className={`my-6 flex gap-3 rounded-xl border-l-4 p-4 ${s.wrap} ${className}`}
    >
      <span aria-hidden className={`text-xl shrink-0 leading-none ${s.icon}`}>{s.emoji}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
