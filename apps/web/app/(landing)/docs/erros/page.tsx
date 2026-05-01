export default function ErrosPage() {
  const errors = [
    {
      code: 'INVALID_API_KEY',
      http: 401,
      desc: 'API Key ausente, malformada ou revogada.',
      fix: 'Verifique o header Authorization: Bearer sk_live_<chave>. Confirme que a chave não foi revogada no dashboard.',
    },
    {
      code: 'PLAN_LIMIT_REACHED',
      http: 402,
      desc: 'Limite de emissões do plano atual atingido para o mês corrente.',
      fix: 'Faça upgrade do plano em GET /v1/billing/portal ou aguarde a renovação mensal.',
    },
    {
      code: 'FORBIDDEN',
      http: 403,
      desc: 'A API Key não tem permissão para acessar o recurso (ex.: nota de outro MEI).',
      fix: 'Cada MEI só acessa suas próprias notas. Verifique se está usando a chave correta.',
    },
    {
      code: 'NOT_FOUND',
      http: 404,
      desc: 'Recurso não encontrado.',
      fix: 'Confirme o ID da nota. Notas de outros MEIs retornam 404 (não 403) por isolamento.',
    },
    {
      code: 'ALREADY_CANCELLED',
      http: 409,
      desc: 'Tentativa de cancelar uma nota que já foi cancelada.',
      fix: 'Verifique o status atual com GET /v1/nfse/:id antes de cancelar.',
    },
    {
      code: 'VALIDATION_ERROR',
      http: 422,
      desc: 'Campos obrigatórios ausentes ou com formato inválido.',
      fix: 'Verifique o campo "fields" no payload de erro — ele lista cada campo problemático.',
    },
    {
      code: 'RECEITA_REJECTION',
      http: 422,
      desc: 'A Receita Federal rejeitou a NFS-e. Contém o código e descrição do erro da Receita.',
      fix: 'Veja a tabela de erros da Receita em docs/receita-erros.md. Corrija os dados e reenvie.',
    },
    {
      code: 'INTERNAL_ERROR',
      http: 500,
      desc: 'Erro inesperado no servidor.',
      fix: 'Aguarde e tente novamente. Se persistir, abra um issue com o request_id retornado.',
    },
  ]

  const receita = [
    { codigo: 'E001', desc: 'CNPJ do prestador não habilitado para NFS-e Nacional' },
    { codigo: 'E002', desc: 'Certificado digital inválido ou expirado' },
    { codigo: 'E010', desc: 'CNPJ do tomador inválido ou não encontrado' },
    { codigo: 'E011', desc: 'CPF do tomador inválido' },
    { codigo: 'E020', desc: 'Código NBS inválido ou não autorizado para o prestador' },
    { codigo: 'E021', desc: 'Discriminação do serviço muito curta (mínimo 10 caracteres)' },
    { codigo: 'E030', desc: 'Valor do serviço menor que o mínimo permitido' },
    { codigo: 'E031', desc: 'Alíquota ISS fora do intervalo permitido pelo município' },
    { codigo: 'E040', desc: 'Competência inválida ou fora do período permitido' },
    { codigo: 'E055', desc: 'Número RPS duplicado para este prestador' },
    { codigo: 'E077', desc: 'Nota já cancelada — não é possível cancelar novamente' },
    { codigo: 'E099', desc: 'Erro interno da Receita Federal — tente novamente' },
  ]

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-outfit">Erros</h1>
        <p className="text-[#8AA0B8]">
          Todos os erros retornam JSON no formato padrão com o campo{' '}
          <code className="text-[#00E8FF]">request_id</code> para rastreabilidade.
        </p>
      </div>

      {/* Formato padrão */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Formato do erro</h2>
        <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#8AA0B8] overflow-x-auto">
{`{
  "error":      "VALIDATION_ERROR",     // código de erro
  "message":    "campos inválidos",     // mensagem em português
  "fields": [                           // apenas em VALIDATION_ERROR
    { "field": "tomador.documento", "message": "CNPJ deve ter 14 dígitos" }
  ],
  "request_id": "uuid"                  // para suporte
}`}
        </pre>
      </section>

      {/* Tabela de erros da API */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Códigos da API</h2>
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e.code} className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-[#FF3232] font-mono text-sm font-bold">{e.code}</code>
                <span className="text-xs bg-[#1E3050] text-[#8AA0B8] rounded px-2 py-0.5 font-mono">
                  HTTP {e.http}
                </span>
              </div>
              <p className="text-sm text-[#EEF4FF]">{e.desc}</p>
              <p className="text-sm text-[#8AA0B8]">
                <span className="text-[#00C85A] font-medium">Como resolver: </span>{e.fix}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Erros da Receita Federal */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Erros da Receita Federal</h2>
        <p className="text-sm text-[#8AA0B8]">
          Quando a Receita rejeita uma NFS-e, o campo <code className="text-[#00E8FF]">erro_codigo</code> no
          webhook (e em <code className="text-[#00E8FF]">GET /v1/nfse/:id</code>) contém o código abaixo.
          Lista completa em <code className="font-mono text-[#8AA0B8]">docs/receita-erros.md</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#1E3050]">
                <th className="text-left py-2 pr-6 text-[#8AA0B8] font-medium w-24">Código</th>
                <th className="text-left py-2 text-[#8AA0B8] font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3050]">
              {receita.map((r) => (
                <tr key={r.codigo} className="hover:bg-[#142035]/40 transition-colors">
                  <td className="py-2.5 pr-6">
                    <code className="text-[#FF3232] font-mono">{r.codigo}</code>
                  </td>
                  <td className="py-2.5 text-[#8AA0B8]">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
