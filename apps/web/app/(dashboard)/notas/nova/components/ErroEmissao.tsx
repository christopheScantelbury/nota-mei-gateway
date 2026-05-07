type TipoErro =
  | 'api_indisponivel'
  | 'certificado_invalido'
  | 'certificado_expirado'
  | 'timeout_polling'
  | 'erro_desconhecido'

type Props = {
  tipo: TipoErro
  detalhe?: string
  onTentar: () => void
}

const ERROS: Record<TipoErro, {
  icone: string
  titulo: string
  descricao: string
  acao: string
  linkHref?: string
  linkLabel?: string
}> = {
  api_indisponivel: {
    icone: '🔌',
    titulo: 'Serviço temporariamente indisponível',
    descricao:
      'Não conseguimos conectar com o servidor de emissão. ' +
      'Aguarde alguns instantes e tente novamente.',
    acao: 'Tentar novamente',
  },
  certificado_invalido: {
    icone: '🔐',
    titulo: 'Certificado digital inválido',
    descricao:
      'Seu certificado A1 não pôde ser validado. ' +
      'Verifique se a senha está correta ou se o certificado não foi corrompido.',
    acao: 'Atualizar certificado',
    linkHref: '/dashboard/configuracoes/certificado',
    linkLabel: 'Ir para configurações',
  },
  certificado_expirado: {
    icone: '⏰',
    titulo: 'Certificado digital vencido',
    descricao:
      'Seu certificado A1 expirou. Renove junto à sua Autoridade Certificadora ' +
      'e atualize aqui antes de emitir novas notas.',
    acao: 'Renovar certificado',
    linkHref: '/dashboard/configuracoes/certificado',
    linkLabel: 'Atualizar certificado',
  },
  timeout_polling: {
    icone: '⏳',
    titulo: 'Nota em processamento',
    descricao:
      'Sua nota foi enviada para a Receita Federal mas o retorno está ' +
      'demorando mais que o esperado. Verifique o status na lista de notas.',
    acao: 'Ver minhas notas',
    linkHref: '/notas',
    linkLabel: 'Ir para lista',
  },
  erro_desconhecido: {
    icone: '⚠️',
    titulo: 'Erro inesperado',
    descricao:
      'Ocorreu um erro não identificado. Se o problema persistir, ' +
      'entre em contato com nosso suporte.',
    acao: 'Tentar novamente',
    linkHref: 'mailto:suporte@emitirnotafacil.com.br',
    linkLabel: 'Contatar suporte',
  },
}

export function ErroEmissao({ tipo, detalhe, onTentar }: Props) {
  const erro = ERROS[tipo]

  return (
    <div className="flex flex-col items-center text-center px-6 py-12 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-nota-rejeitada/10 border border-nota-rejeitada/20
                      flex items-center justify-center text-3xl mb-6">
        {erro.icone}
      </div>

      <h3 className="font-medium text-text-1 text-lg mb-3">{erro.titulo}</h3>

      <p className="text-text-2 text-sm leading-relaxed mb-2">
        {erro.descricao}
      </p>

      {detalhe && (
        <p className="text-xs text-nota-rejeitada/70 font-mono bg-nota-rejeitada/5
                      border border-nota-rejeitada/10 rounded-lg px-4 py-2 mb-6
                      text-left w-full break-all">
          {detalhe}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
        <button
          onClick={onTentar}
          className="flex-1 rounded-xl border border-navy-600 px-6 py-3
                     text-text-2 text-sm font-medium hover:border-brand-cyan/50
                     hover:text-text-1 transition-colors"
        >
          {erro.acao}
        </button>
        {erro.linkHref && (
          <a
            href={erro.linkHref}
            className="flex-1 rounded-xl bg-brand-cyan px-6 py-3 text-navy-900
                       text-sm font-semibold text-center hover:opacity-90
                       transition-opacity"
          >
            {erro.linkLabel}
          </a>
        )}
      </div>
    </div>
  )
}
