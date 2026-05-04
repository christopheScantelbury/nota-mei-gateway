import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-navy-900 font-body">
      <h1 className="text-7xl font-extrabold font-display text-brand-cyan m-0">
        404
      </h1>
      <p className="text-text-2 m-0">Página não encontrada</p>
      <Link
        href="/"
        className="mt-4 bg-brand-cyan text-navy-900 font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
