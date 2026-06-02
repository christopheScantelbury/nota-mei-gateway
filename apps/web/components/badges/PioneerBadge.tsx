/**
 * Selo "Pioneiros · NFS-e Nacional em produção desde mai/2026".
 *
 * Spec: HIST-1.2. Duas variantes: `hero` (maior, pra heroes) e `inline` (menor, pra footers/cards).
 *
 * @example
 * <PioneerBadge variant="hero" />
 * <PioneerBadge variant="inline" className="ml-2" />
 */
interface Props {
  variant?: 'hero' | 'inline'
  className?: string
}

export default function PioneerBadge({ variant = 'inline', className = '' }: Props) {
  const sizes = variant === 'hero'
    ? 'text-sm md:text-base px-4 py-2'
    : 'text-xs px-3 py-1'

  return (
    <span
      role="img"
      aria-label="Selo de pioneirismo: NFS-e Nacional em produção desde maio de 2026"
      className={[
        'inline-flex items-center gap-2 rounded-full',
        'bg-gradient-to-r from-amber-100 to-amber-50',
        'border border-amber-300 text-amber-900 font-medium',
        sizes,
        className,
      ].join(' ')}
    >
      <span aria-hidden>🏆</span>
      <span>Pioneiros · NFS-e Nacional em produção desde mai/2026</span>
    </span>
  )
}
