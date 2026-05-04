import Link from 'next/link'

interface Step {
  id: string
  label: string
  description: string
  done: boolean
  href: string
  cta: string
}

interface Props {
  hasCert: boolean
  hasNota: boolean
  hasApiKey: boolean
  hasAuthorizedNota: boolean
}

export default function OnboardingChecklist({
  hasCert,
  hasNota,
  hasApiKey,
  hasAuthorizedNota,
}: Props) {
  const steps: Step[] = [
    {
      id: 'cadastro',
      label: 'Cadastro realizado',
      description: 'Sua conta MEI está ativa.',
      done: true,
      href: '#',
      cta: 'Feito',
    },
    {
      id: 'cert',
      label: 'Certificado A1 configurado',
      description: 'Necessário para assinar e enviar NFS-e à Receita Federal.',
      done: hasCert,
      href: '/configuracoes?aba=certificado',
      cta: 'Configurar agora',
    },
    {
      id: 'nota',
      label: 'Primeira nota emitida',
      description: 'Emita uma NFS-e pelo dashboard ou via API.',
      done: hasNota,
      href: '/notas/nova',
      cta: 'Emitir nota',
    },
    {
      id: 'autorizada',
      label: 'Primeira nota autorizada',
      description: 'A Receita Federal retornou a autorização com sucesso.',
      done: hasAuthorizedNota,
      href: '/notas',
      cta: 'Ver notas',
    },
    {
      id: 'apikey',
      label: 'API Key criada',
      description: 'Integre seu sistema e automatize emissões via API REST.',
      done: hasApiKey,
      href: '/configuracoes?aba=api-keys',
      cta: 'Criar API Key',
    },
  ]

  const allDone = steps.every(s => s.done)
  const doneCount = steps.filter(s => s.done).length

  if (allDone) return null // hide once everything is complete

  return (
    <div className="mb-8 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-base font-bold">Configure sua conta</h2>
          <p className="text-text-2 text-xs mt-0.5">
            {doneCount} de {steps.length} etapas concluídas
          </p>
        </div>
        {/* Progress pill */}
        <span className="text-xs font-semibold bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 rounded-full px-2.5 py-0.5">
          {Math.round((doneCount / steps.length) * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-navy-600 overflow-hidden mb-4">
        <div
          className="h-full bg-brand-cyan rounded-full transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={step.id} className="flex items-start gap-3">
            {/* Step number / check */}
            <span
              className={`flex-none mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step.done
                  ? 'bg-nota-autorizada/20 text-nota-autorizada'
                  : 'bg-navy-600 text-text-2'
                }`}
            >
              {step.done ? '✓' : idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-text-2 line-through decoration-text-2/40' : 'text-text-1'}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-text-2 mt-0.5">{step.description}</p>
              )}
            </div>
            {!step.done && step.href !== '#' && (
              <Link
                href={step.href}
                className="shrink-0 text-xs font-semibold text-brand-cyan border border-brand-cyan/30 rounded-lg px-2.5 py-1 hover:bg-brand-cyan/10 transition whitespace-nowrap"
              >
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
