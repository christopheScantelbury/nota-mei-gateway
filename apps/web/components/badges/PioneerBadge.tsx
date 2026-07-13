/**
 * Selo de prova técnica concreta — emissão + cancelamento + substituição
 * NFS-e Nacional v1.01 em produção com cert ICP-Brasil.
 *
 * Refactor 2026-06-22 (pack Manaus §P1-4): trocou "Pioneiros desde mai/2026"
 * (subjetivo, sinaliza "produto novo") por afirmação técnica verificável que
 * o concorrente externo NÃO tem. Recall: nenhum competidor citado em
 * `data/competitors.json` tem NFS-e Nacional nativa hoje.
 *
 * Duas variantes: `hero` (maior) e `inline` (menor).
 */
interface Props {
  variant?: 'hero' | 'inline'
  className?: string
}

export default function PioneerBadge({ variant = 'inline', className = '' }: Props) {
  const sizes = variant === 'hero'
    ? 'text-xs sm:text-sm md:text-base px-3 py-1.5 sm:px-4 sm:py-2'
    : 'text-[11px] sm:text-xs px-3 py-1'

  return (
    <span
      role="img"
      aria-label="NFS-e Nacional v1.01 em produção desde maio de 2026, com cert ICP-Brasil"
      className={[
        'inline-flex items-center gap-1.5 sm:gap-2 rounded-full',
        'bg-gradient-to-r from-amber-100 to-amber-50',
        'border border-amber-300 text-amber-900 font-medium',
        // max-w-full + leading-tight permite quebra controlada em casos extremos
        // mas o texto curto abaixo cabe em 1 linha até em 375px.
        'max-w-full leading-tight',
        sizes,
        className,
      ].join(' ')}
    >
      <span aria-hidden className="shrink-0">🏆</span>
      {/* Texto curto: 56 chars vs 95 do refactor anterior — cabe em 1 linha
          em mobile 375px com text-xs. Mantém a prova técnica (v1.01 em produção)
          sem o detalhe verbose ("cancelamento e substituição validados"). */}
      <span>NFS-e Nacional v1.01 · em produção desde mai/2026</span>
    </span>
  )
}
