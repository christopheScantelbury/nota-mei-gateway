import CTABanner from '@/components/mdx/CTABanner'

/**
 * CTA específico de migração de concorrente para NotaFácil.
 *
 * Spec: HIST-4.4 + 05-Componentes-React.md.
 *
 * @example
 * <MigrationCTA from="Focus NFe" />
 */
interface Props {
  from: string
  className?: string
}

export default function MigrationCTA({ from, className }: Props) {
  return (
    <CTABanner
      className={className}
      title={`Pronto para migrar do ${from} para o NotaFácil?`}
      description="Trial de 30 dias sem cartão. Migração assistida por nosso time, sem custo. Você emite em paralelo, valida, e só então cancela o atual."
      primaryCta={{
        label: 'Começar agora · trial grátis',
        href: `/cadastro?utm_source=blog&utm_medium=migration_cta&utm_content=${encodeURIComponent(from.toLowerCase().replace(/\s+/g, '_'))}`,
      }}
      secondaryCta={{
        label: 'Falar com nosso time',
        href: '/contato',
      }}
      variant="urgency"
      location="blog_migration_cta"
    />
  )
}
