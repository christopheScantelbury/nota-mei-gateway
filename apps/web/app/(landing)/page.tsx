export default function LandingPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <section className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <h1 className="font-display text-5xl font-extrabold text-brand-cyan">
          Nota MEI Gateway
        </h1>
        <p className="text-text-2 text-xl max-w-xl text-center">
          Emissão automatizada de NFS-e para MEI via Receita Federal Nacional.
        </p>
        <a
          href="/cadastro"
          className="bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition"
        >
          Começar gratuitamente
        </a>
      </section>
    </main>
  )
}
