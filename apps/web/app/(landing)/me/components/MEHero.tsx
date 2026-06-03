import CountdownSet2026 from '@/components/countdown/CountdownSet2026'
import PioneerBadge from '@/components/badges/PioneerBadge'

export function MEHero() {
  return (
    <section className="relative px-6 pt-12 pb-20 max-w-5xl mx-auto text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-nota-processando/30
                       bg-nota-processando/10 px-4 py-1.5 text-xs font-medium text-nota-processando mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-nota-processando animate-pulse" />
        Obrigatório para ME e EPP a partir de 01/09/2026
      </span>

      <div className="mb-6 flex justify-center">
        <PioneerBadge variant="hero" />
      </div>

      <h1 className="font-display text-4xl md:text-6xl font-extrabold text-text-1
                     leading-tight mb-6">
        Sua ME precisa emitir{' '}
        <span className="text-brand-cyan">NFS-e nacional</span>
        {' '}a partir de setembro.
      </h1>

      <p className="text-text-2 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
        Plataforma completa para Microempresas emitirem nota fiscal de serviço
        pelo padrão nacional. Simples Nacional e Lucro Presumido.
        Qualquer município habilitado no Brasil.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/cadastro/me"
          className="rounded-xl bg-brand-cyan px-8 py-4 text-navy-900 font-semibold
                     text-base hover:opacity-90 transition-opacity"
        >
          Cadastrar minha ME gratuitamente
        </a>
        <a
          href="#como-funciona"
          className="rounded-xl border border-navy-600 px-8 py-4 text-text-2
                     font-medium text-base hover:border-brand-cyan/50 hover:text-text-1
                     transition-colors"
        >
          Ver como funciona
        </a>
      </div>

      <p className="mt-8 text-xs text-text-2">
        Trial gratuito · Sem cartão de crédito · Cancelamento a qualquer hora
      </p>

      {/* Countdown dinâmico até 01/09/2026 (HIST-1.3) */}
      <div className="mt-10 inline-flex flex-col items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-4">
        <p className="text-xs uppercase tracking-wider font-semibold text-amber-300">
          Faltam para a obrigatoriedade:
        </p>
        <CountdownSet2026 />
      </div>
    </section>
  )
}
