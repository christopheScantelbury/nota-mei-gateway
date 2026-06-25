// PorQueNaoGratuito — bloco que trata a objeção central do tráfego pago de
// cidades já obrigadas (Manaus etc.): "o emissor do governo é grátis, por que
// pagar?". Copy fonte: docs/notafacil-plano-ajuste-manaus.docx §4.3.
//
// Resposta: não desmerecer o gov (gera desconfiança); mostrar onde o NotaFácil
// economiza tempo de quem emite com frequência.

interface Props {
  /** Ajusta tom: 'home' fica mais editorial; 'lp' fica mais objetivo. */
  variant?: 'home' | 'lp'
}

const ROWS: ReadonlyArray<readonly [feature: string, gov: string, nf: string]> = [
  ['Custo da emissão',                'Grátis',     'Plano mensal'],
  ['Dados do cliente salvos',         '—',          '✓'],
  ['Emissão em ~30 segundos',         '—',          '✓'],
  ['PDF + XML automáticos por e-mail','—',          '✓'],
  ['Emissão recorrente / em lote',    '—',          '✓'],
  ['API REST para integrar',          '—',          '✓'],
]

export default function PorQueNaoGratuito({ variant = 'home' }: Props) {
  return (
    <section
      aria-labelledby="por-que-nao-gratuito-title"
      className={variant === 'lp' ? 'bg-navy-800/40' : 'bg-navy-900'}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2
          id="por-que-nao-gratuito-title"
          className="font-display text-2xl sm:text-3xl font-extrabold text-text-1 mb-5"
        >
          O emissor público é grátis. Então por que o NotaFácil?
        </h2>

        <p className="text-text-1 leading-relaxed">
          O <strong>Emissor Nacional do governo funciona — e é grátis</strong>. Ele resolve quem
          emite uma nota de vez em quando e topa preencher tudo manualmente a cada emissão.
        </p>
        <p className="text-text-1 leading-relaxed mt-4">
          O <strong className="text-brand-cyan">NotaFácil</strong> é para quem emite com
          frequência e não quer perder tempo: dados do cliente salvos, emissão em 30 segundos,
          PDF e XML automáticos no e-mail, emissão recorrente, e API para integrar ao seu
          sistema. Você paga pelo <em>tempo que economiza</em>, não pela nota em si.
        </p>

        <div className="mt-8 rounded-xl border border-navy-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-700 text-text-2 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Recurso</th>
                <th className="px-4 py-3 text-center">Emissor público</th>
                <th className="px-4 py-3 text-center text-brand-cyan">NotaFácil</th>
              </tr>
            </thead>
            <tbody className="text-text-1">
              {ROWS.map(([feature, gov, nf], i) => (
                <tr
                  key={feature}
                  className={`border-t border-navy-600 ${i % 2 === 1 ? 'bg-navy-900/30' : ''}`}
                >
                  <td className="px-4 py-3">{feature}</td>
                  <td className="px-4 py-3 text-center text-text-2">{gov}</td>
                  <td className="px-4 py-3 text-center font-semibold text-brand-cyan">{nf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
