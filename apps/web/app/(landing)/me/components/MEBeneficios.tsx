const BENEFICIOS = [
  {
    icone: '🏛️',
    titulo: 'Padrão nacional oficial',
    descricao:
      'Integração direta com a API da Receita Federal (SEFIN Nacional). ' +
      'Aceita em todos os municípios habilitados no NFS-e Nacional.',
  },
  {
    icone: '📊',
    titulo: 'Simples Nacional e Lucro Presumido',
    descricao:
      'Suporte completo aos dois regimes. ISS calculado automaticamente. ' +
      'Retenção na fonte para Lucro Presumido com campo issRetido.',
  },
  {
    icone: '🔐',
    titulo: 'Certificado A1 protegido',
    descricao:
      'Seu certificado digital é armazenado com criptografia no AWS Secrets Manager. ' +
      'Nunca em disco. Nunca exposto.',
  },
  {
    icone: '🌎',
    titulo: 'Qualquer município do Brasil',
    descricao:
      'Funciona para ME prestando serviço em qualquer município ' +
      'já integrado ao NFS-e Nacional — não só Manaus.',
  },
  {
    icone: '⚡',
    titulo: 'Emissão em segundos',
    descricao:
      'Preencha o formulário, confirme e sua nota está a caminho da Receita Federal. ' +
      'Webhook entregue ao seu sistema quando autorizada.',
  },
  {
    icone: '📄',
    titulo: 'PDF e XML disponíveis',
    descricao:
      'Download imediato após autorização. Armazenamento fiscal por 5 anos ' +
      'conforme exigência legal.',
  },
]

export function MEBeneficios() {
  return (
    <section className="px-6 py-20 max-w-6xl mx-auto">
      <h2 className="font-display text-3xl font-bold text-text-1 text-center mb-12">
        Tudo que sua ME precisa para emitir nota
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {BENEFICIOS.map((b) => (
          <div
            key={b.titulo}
            className="rounded-xl border border-navy-600 bg-navy-700 p-6
                       hover:border-brand-cyan/30 transition-colors"
          >
            <span className="text-3xl mb-4 block">{b.icone}</span>
            <h3 className="font-medium text-text-1 mb-2">{b.titulo}</h3>
            <p className="text-text-2 text-sm leading-relaxed">{b.descricao}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
