const PASSOS = [
  {
    numero: '01',
    titulo: 'Cadastre sua ME',
    descricao:
      'Informe o CNPJ, regime tributário e faça upload do certificado digital A1. ' +
      'Leva menos de 2 minutos.',
  },
  {
    numero: '02',
    titulo: 'Preencha os dados da nota',
    descricao:
      'Informe o tomador, valor do serviço, código NBS e competência. ' +
      'O ISS é calculado automaticamente conforme o regime.',
  },
  {
    numero: '03',
    titulo: 'Enviamos à Receita Federal',
    descricao:
      'Seu DPS é assinado digitalmente, enviado ao SEFIN Nacional e ' +
      'o retorno é processado automaticamente.',
  },
  {
    numero: '04',
    titulo: 'Nota autorizada em instantes',
    descricao:
      'Você recebe o número da NFS-e, código de verificação, PDF e XML. ' +
      'Webhook entregue ao seu sistema se configurado.',
  },
]

export function MEComoFunciona() {
  return (
    <section className="px-6 py-20 max-w-4xl mx-auto" id="como-funciona">
      <h2 className="font-display text-3xl font-bold text-text-1 text-center mb-12">
        Como funciona
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {PASSOS.map((p) => (
          <div
            key={p.numero}
            className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex gap-4"
          >
            <span className="font-mono text-2xl font-bold text-brand-cyan/40 flex-shrink-0 leading-none mt-0.5">
              {p.numero}
            </span>
            <div>
              <h3 className="font-medium text-text-1 mb-2">{p.titulo}</h3>
              <p className="text-text-2 text-sm leading-relaxed">{p.descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
