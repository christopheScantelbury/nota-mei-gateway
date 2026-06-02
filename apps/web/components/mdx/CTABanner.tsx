'use client'

import Link from 'next/link'
import { trackCtaClick, type CtaLocation } from '@/lib/analytics/events'

/**
 * Banner de CTA reutilizável no blog/MDX.
 *
 * Spec: HIST-5.0 + 05-Componentes-React.md.
 *
 * @example
 * <CTABanner
 *   title="Pronto para emitir sua primeira NFS-e Nacional?"
 *   description="Trial de 30 dias, sem cartão."
 *   primaryCta={{ label: "Criar conta grátis", href: "/cadastro?utm_source=blog&utm_medium=cta_banner" }}
 *   variant="urgency"
 * />
 */
interface CtaProp { label: string; href: string }

interface Props {
  title: string
  description?: string
  primaryCta: CtaProp
  secondaryCta?: CtaProp
  variant?: 'default' | 'urgency'
  className?: string
  /** Default: 'blog_cta_banner'. Override pra location-specific tracking. */
  location?: CtaLocation
}

export default function CTABanner({
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = 'default',
  className = '',
  location = 'blog_cta_banner',
}: Props) {
  const wrapCls = variant === 'urgency'
    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 dark:from-amber-500/10 dark:to-orange-500/10 dark:border-amber-400/30'
    : 'bg-slate-50 border-slate-200 dark:bg-navy-700 dark:border-navy-600'

  const primaryCls = variant === 'urgency'
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : 'bg-brand-cyan hover:opacity-90 text-navy-900'

  return (
    <div className={`my-8 rounded-2xl border p-6 sm:p-8 text-center ${wrapCls} ${className}`}>
      <h3 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-text-1 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm sm:text-base text-slate-600 dark:text-text-2 mb-5">
          {description}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={primaryCta.href}
          onClick={() => trackCtaClick({ persona: 'unknown', location })}
          className={`px-6 py-3 rounded-lg font-semibold text-sm transition ${primaryCls}`}
        >
          {primaryCta.label}
        </Link>
        {secondaryCta && (
          <Link
            href={secondaryCta.href}
            onClick={() => trackCtaClick({ persona: 'unknown', location })}
            className="px-6 py-3 rounded-lg font-semibold text-sm border border-slate-300 dark:border-navy-500 text-slate-700 dark:text-text-1 hover:bg-white dark:hover:bg-navy-600 transition"
          >
            {secondaryCta.label}
          </Link>
        )}
      </div>
    </div>
  )
}
