import Link from 'next/link'

export default function AmbientesPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-outfit">Ambientes</h1>
        <p className="text-[#8AA0B8]">
          Diferenças entre sandbox e produção — o que muda e o que não muda.
        </p>
      </div>

      {/* Comparison table */}
      <section className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#1E3050]">
                <th className="text-left py-3 pr-6 text-[#8AA0B8] font-medium">Característica</th>
                <th className="text-left py-3 pr-6 font-medium text-[#F0B414]">Sandbox</th>
                <th className="text-left py-3 font-medium text-[#00C85A]">Produção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3050]">
              {[
                {
                  feature: 'Prefixo da chave',
                  sandbox: 'sk_test_',
                  prod: 'sk_live_',
                },
                {
                  feature: 'Base URL',
                  sandbox: 'sandbox.notameigateway.com.br',
                  prod: 'api.notameigateway.com.br',
                },
                {
                  feature: 'Sandbox público (sem conta)',
                  sandbox: 'sk_test_sandbox_demo',
                  prod: '—',
                },
                {
                  feature: 'NFS-e enviada à Receita',
                  sandbox: '❌ simulada',
                  prod: '✅ real',
                },
                {
                  feature: 'Receita Federal',
                  sandbox: 'homologacao.nfse.gov.br',
                  prod: 'nfse.gov.br',
                },
                {
                  feature: 'Certificado A1',
                  sandbox: 'certificado de homologação',
                  prod: 'certificado de produção',
                },
                {
                  feature: 'Cobrança Stripe',
                  sandbox: '❌ não cobrado',
                  prod: '✅ cobrado conforme plano',
                },
                {
                  feature: 'Webhooks entregues',
                  sandbox: '✅ sim (payload fake)',
                  prod: '✅ sim (payload real)',
                },
                {
                  feature: 'Rate limit sandbox demo',
                  sandbox: '20 req/hora por IP',
                  prod: 'conforme plano',
                },
                {
                  feature: 'PDF / XML da nota',
                  sandbox: '❌ não gerado',
                  prod: '✅ disponível',
                },
              ].map((row) => (
                <tr key={row.feature} className="hover:bg-[#142035]/40 transition-colors">
                  <td className="py-3 pr-6 text-[#EEF4FF]">{row.feature}</td>
                  <td className="py-3 pr-6 text-[#F0B414] font-mono text-xs">{row.sandbox}</td>
                  <td className="py-3 text-[#00C85A] font-mono text-xs">{row.prod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sandbox keys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Chaves de sandbox</h2>
        <div className="space-y-3">
          <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <code className="text-[#F0B414] font-mono text-sm font-bold">sk_test_sandbox_demo</code>
              <span className="text-xs bg-[#F0B414]/10 text-[#F0B414] border border-[#F0B414]/20 rounded-full px-2 py-0.5">
                Público
              </span>
            </div>
            <p className="text-sm text-[#8AA0B8]">
              Chave compartilhada, sem cadastro. Limite de 20 req/hora por IP. Dados resetam a cada reinício
              do servidor. Use apenas para explorar a API rapidamente.
              <Link href="/sandbox" className="text-[#00E8FF] hover:underline ml-1">→ Playground</Link>
            </p>
          </div>
          <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <code className="text-[#F0B414] font-mono text-sm font-bold">sk_test_{'<sua-chave>'}</code>
              <span className="text-xs bg-[#00E8FF]/10 text-[#00E8FF] border border-[#00E8FF]/20 rounded-full px-2 py-0.5">
                Sua conta
              </span>
            </div>
            <p className="text-sm text-[#8AA0B8]">
              Gerada no cadastro. Associada à sua conta, isolada de outros MEIs. Usa o ambiente de
              homologação da Receita Federal — certificado de homologação necessário.
            </p>
          </div>
        </div>
      </section>

      {/* Migration */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Migrando para produção</h2>
        <ol className="space-y-3 text-sm text-[#8AA0B8]">
          {[
            'Troque o certificado A1 de homologação pelo certificado de produção em POST /v1/auth/certificate',
            'Substitua todas as ocorrências de sk_test_ por sk_live_ no seu sistema',
            'Atualize a base URL para api.notameigateway.com.br',
            'Ative uma assinatura Stripe (Trial, Starter, Basic, Pro ou Business)',
            'Teste o fluxo completo com uma nota de valor baixo antes de escalar',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#00E8FF]/10 border border-[#00E8FF]/30 flex items-center justify-center text-xs text-[#00E8FF]">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="bg-[#142035] border border-[#00C85A]/20 rounded-lg p-4 text-sm text-[#00C85A]">
          ✓ Veja o checklist completo em <code className="font-mono">docs/deploy-checklist.md</code> no repositório.
        </div>
      </section>
    </div>
  )
}
