type Rejeicao = {
  codigo: string
  mensagem: string
  acao: string
  codigoReceita: string
}

type Props = {
  rejeicoes: Rejeicao[]
  notaId: string
  onEmitirNova: () => void
}

export function ErroRejeicao({ rejeicoes, notaId, onEmitirNova }: Props) {
  return (
    <div className="px-6 py-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-nota-rejeitada/10 border border-nota-rejeitada/20
                        flex items-center justify-center text-xl flex-shrink-0">
          ✕
        </div>
        <div>
          <h3 className="font-medium text-text-1">Nota rejeitada pela Receita Federal</h3>
          <p className="text-xs text-text-2 font-mono mt-0.5">ID: {notaId}</p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {rejeicoes.map((r, i) => (
          <div
            key={i}
            className="rounded-xl border border-nota-rejeitada/20 bg-nota-rejeitada/5 p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-nota-rejeitada">{r.codigo}</span>
              <span className="text-xs text-text-2 font-mono bg-navy-700
                               rounded px-2 py-0.5 flex-shrink-0">
                {r.codigoReceita}
              </span>
            </div>
            <p className="text-sm text-text-2 mb-2">{r.mensagem}</p>
            <p className="text-xs text-brand-cyan flex items-center gap-1">
              <span>→</span> {r.acao}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onEmitirNova}
          className="flex-1 rounded-xl bg-brand-cyan px-6 py-3 text-navy-900
                     font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Corrigir e emitir novamente
        </button>
        <a
          href="/notas"
          className="flex-1 rounded-xl border border-navy-600 px-6 py-3
                     text-text-2 text-sm font-medium text-center
                     hover:border-navy-600/80 transition-colors"
        >
          Ver lista de notas
        </a>
      </div>
    </div>
  )
}
