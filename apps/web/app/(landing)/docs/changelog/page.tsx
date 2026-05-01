type Entry = { date: string; version: string; type: 'feat' | 'fix' | 'break'; items: string[] }

const CHANGELOG: Entry[] = [
  {
    date: '2026-05-01',
    version: '1.1.0',
    type: 'feat',
    items: [
      'Sandbox público sem cadastro (sk_test_sandbox_demo) — testa em 30 segundos',
      'Developer portal com referência interativa Scalar, guias e playground',
      'Spec OpenAPI 3.1 completa em docs/openapi.yaml — fonte de verdade para SDKs',
      'Tipos TypeScript gerados automaticamente via openapi-typescript no CI',
      'Rate limiter in-memory por IP para o sandbox (20 req/hora)',
    ],
  },
  {
    date: '2026-04-30',
    version: '1.0.0',
    type: 'feat',
    items: [
      'POST /v1/nfse — emissão assíncrona de NFS-e via Receita Federal Nacional',
      'GET /v1/nfse — listagem paginada com filtros de status e competência',
      'GET /v1/nfse/:id — consulta de status com todos os detalhes da nota',
      'DELETE /v1/nfse/:id — cancelamento de nota autorizada',
      'GET /v1/nfse/:id/pdf e /xml — download de documentos',
      'GET /v1/billing/usage — consumo do mês com limite do plano',
      'GET /v1/billing/portal — URL do Stripe Customer Portal',
      'POST /v1/billing/checkout — criação de sessão de checkout Stripe',
      'Webhook engine: publicação no RabbitMQ, consumer, HMAC-SHA256, requeuer',
      'Dashboard Next.js: listagem de notas, detalhe, billing com progress bar',
      'Poller de NFS-e: consulta automática de notas PROCESSANDO a cada 30s',
      'Suporte a certificado A1 via AWS Secrets Manager (NoopSigner em dev)',
      'CI com golangci-lint (errcheck, staticcheck, revive, bodyclose, gofmt)',
      'Testes unitários: auth, nfse/adapter, webhook/consumer, document/builder',
      'Testes de integração: handler Fiber (health, auth, NFS-e validation)',
      'k6 load test: smoke/load/spike — p95 < 500ms, error rate < 1%',
      'Deploy checklist em docs/deploy-checklist.md',
    ],
  },
]

const TYPE_LABEL: Record<Entry['type'], { label: string; color: string }> = {
  feat: { label: 'Novo', color: 'bg-[#00C85A]/10 text-[#00C85A] border-[#00C85A]/20' },
  fix: { label: 'Correção', color: 'bg-[#F0B414]/10 text-[#F0B414] border-[#F0B414]/20' },
  break: { label: 'Breaking', color: 'bg-[#FF3232]/10 text-[#FF3232] border-[#FF3232]/20' },
}

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-outfit">Changelog</h1>
        <p className="text-[#8AA0B8]">Histórico de versões e mudanças na API.</p>
      </div>

      <div className="space-y-10">
        {CHANGELOG.map((entry) => {
          const tl = TYPE_LABEL[entry.type]
          return (
            <div key={entry.version} className="flex gap-5">
              <div className="shrink-0 text-right w-28">
                <p className="text-xs text-[#6473A0] font-mono mt-1">{entry.date}</p>
              </div>
              <div className="flex-1 pb-10 border-l border-[#1E3050] pl-6 space-y-3">
                <div className="flex items-center gap-3 -mt-0.5">
                  <h2 className="text-lg font-bold font-outfit">v{entry.version}</h2>
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${tl.color}`}>
                    {tl.label}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[#8AA0B8]">
                      <span className="text-[#1E3050] mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
