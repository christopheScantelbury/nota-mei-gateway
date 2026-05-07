type Props = {
  empresa: {
    razaoSocial: string
    regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO'
    trialMe: boolean
    certSecretArn: string | null
  }
}

export function EmptyStateME({ empresa }: Props) {
  const certOk  = !!empresa.certSecretArn
  const regime  = empresa.regimeTributario

  const steps = [
    {
      id: 'cert',
      label: 'Certificado A1 cadastrado',
      concluido: certOk,
      href: '/dashboard/configuracoes/certificado',
      cta: 'Cadastrar certificado',
    },
    {
      id: 'nota',
      label: 'Emitir a primeira nota',
      concluido: false,
      href: '/notas/nova',
      cta: 'Emitir nota agora',
    },
    {
      id: 'webhook',
      label: 'Configurar webhook (opcional)',
      concluido: false,
      href: '/dashboard/configuracoes/webhooks',
      cta: 'Configurar',
    },
  ]

  const proximoPasso = steps.find((s) => !s.concluido)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]
                    text-center px-6 py-16">
      <div className="w-20 h-20 rounded-2xl bg-navy-700 border border-navy-600
                      flex items-center justify-center text-4xl mb-8">
        📋
      </div>

      <h2 className="font-display text-2xl font-bold text-text-1 mb-3">
        Bem-vinda, {empresa.razaoSocial.split(' ')[0]}!
      </h2>

      <p className="text-text-2 text-sm max-w-md mb-10 leading-relaxed">
        Sua ME está cadastrada no padrão NFS-e Nacional.
        {regime === 'LUCRO_PRESUMIDO'
          ? ' Regime Lucro Presumido — ISS com retenção na fonte disponível.'
          : ' Regime Simples Nacional — ISS via DAS mensal.'}
        {empresa.trialMe && ' Trial gratuito ativo.'}
      </p>

      <div className="w-full max-w-sm space-y-3 mb-10 text-left">
        {steps.map((step, i) => {
          const isProximo = step === proximoPasso
          return (
            <div
              key={step.id}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3
                          ${step.concluido
                            ? 'border-nota-autorizada/20 bg-nota-autorizada/5'
                            : isProximo
                              ? 'border-brand-cyan/30 bg-brand-cyan/5'
                              : 'border-navy-600 bg-navy-700 opacity-60'
                          }`}
            >
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center
                                justify-center text-xs font-bold
                                ${step.concluido
                                  ? 'bg-nota-autorizada text-navy-900'
                                  : 'bg-navy-600 text-text-2'
                                }`}>
                {step.concluido ? '✓' : i + 1}
              </span>

              <span className={`flex-1 text-sm font-medium
                                ${step.concluido ? 'text-nota-autorizada' : 'text-text-1'}`}>
                {step.label}
              </span>

              {!step.concluido && isProximo && (
                <a
                  href={step.href}
                  className="text-xs text-brand-cyan hover:underline font-medium flex-shrink-0"
                >
                  {step.cta} →
                </a>
              )}
            </div>
          )
        })}
      </div>

      {proximoPasso && (
        <a
          href={proximoPasso.href}
          className="rounded-xl bg-brand-cyan px-8 py-3.5 text-navy-900
                     font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          {proximoPasso.cta}
        </a>
      )}

      {empresa.trialMe && (
        <p className="mt-8 text-xs text-text-2 max-w-xs">
          Você está no trial gratuito. Sem limite de emissões.
          O plano definitivo será comunicado por e-mail antes da ativação.
        </p>
      )}
    </div>
  )
}
