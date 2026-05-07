export function MECTAFinal() {
  return (
    <section className="px-6 py-24 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-display text-4xl font-extrabold text-text-1 mb-6">
          Prepare sua ME antes de setembro.
        </h2>
        <p className="text-text-2 text-lg mb-8 leading-relaxed">
          Trial gratuito durante o período de lançamento.
          Sem cartão de crédito. Cancele quando quiser.
        </p>
        <a
          href="/cadastro/me"
          className="inline-block rounded-xl bg-brand-cyan px-10 py-4 text-navy-900
                     font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          Cadastrar minha ME gratuitamente
        </a>
        <p className="mt-6 text-xs text-text-2">
          Dúvidas?{' '}
          <a
            href="mailto:suporte@emitirnotafacil.com.br"
            className="text-brand-cyan hover:underline"
          >
            Fale com a gente
          </a>
        </p>
      </div>
    </section>
  )
}
