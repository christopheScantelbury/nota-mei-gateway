import Link from 'next/link'
import { hasFeature, type PlanFeatures } from '@/lib/plans'

interface PlanGateProps {
  /** Nome do plano atual do usuário */
  planName: string | null | undefined
  /** Feature necessária para acesso */
  feature: keyof PlanFeatures
  /** Emoji para o ícone da tela de upgrade */
  icon?: string
  /** Título da feature bloqueada */
  title?: string
  /** Descrição do que a feature oferece */
  description?: string
  /** Plano mínimo exigido (para mostrar na CTA) */
  requiredPlan?: string
  /** Conteúdo a renderizar quando o acesso é permitido */
  children: React.ReactNode
}

/**
 * Server Component que bloqueia acesso a features não disponíveis no plano atual.
 * Renderiza os `children` se o plano tiver acesso;
 * caso contrário, exibe uma tela de upgrade.
 */
export default function PlanGate({
  planName,
  feature,
  icon = '🔒',
  title = 'Recurso não disponível',
  description = 'Faça upgrade do seu plano para acessar este recurso.',
  requiredPlan = 'Starter',
  children,
}: PlanGateProps) {
  if (hasFeature(planName, feature)) {
    return <>{children}</>
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="rounded-xl border border-nota-upgrade/30 bg-nota-upgrade/5 p-8 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="font-display text-2xl font-extrabold mb-2">{title}</h1>
        <p className="text-text-2 mb-6 text-sm leading-relaxed">
          {description}
          {requiredPlan && (
            <>
              {' '}Este recurso está disponível a partir do plano{' '}
              <span className="text-nota-upgrade font-semibold">{requiredPlan}</span>.
            </>
          )}
        </p>
        <Link
          href="/billing"
          className="inline-block text-sm font-semibold bg-nota-upgrade text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition"
        >
          Ver planos e fazer upgrade →
        </Link>
      </div>
    </div>
  )
}
