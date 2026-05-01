import Link from 'next/link'

const STEP_CURL = `curl -X POST https://api.notameigateway.com.br/v1/nfse \\
  -H "Authorization: Bearer sk_live_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "servico": {
      "codigo_nbs": "01.01.01.10",
      "discriminacao": "Desenvolvimento de software",
      "valor": 1500.00,
      "aliquota_iss": 2.0
    },
    "tomador": {
      "tipo": "PJ",
      "documento": "12345678000190",
      "razao_social": "Empresa Cliente LTDA",
      "email": "financeiro@empresa.com"
    },
    "competencia": "2026-04",
    "webhook_url": "https://seu-erp.com/webhooks/nfse"
  }'`

const STATUS_CURL = `curl https://api.notameigateway.com.br/v1/nfse/NOTA_ID \\
  -H "Authorization: Bearer sk_live_SUA_CHAVE"`

const WEBHOOK_VERIFY = `import crypto from 'crypto'

function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// No handler do webhook:
app.post('/webhooks/nfse', (req, res) => {
  const sig = req.headers['x-nota-signature'] as string
  const raw = req.rawBody // body cru (não parseado)

  if (!verifyWebhook(raw, sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Assinatura inválida')
  }

  const { event, nota_id, status } = req.body
  console.log(\`Nota \${nota_id}: \${event} → \${status}\`)
  res.sendStatus(200)
})`

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-5">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#00E8FF]/10 border border-[#00E8FF]/30 flex items-center justify-center text-sm font-bold text-[#00E8FF]">
        {n}
      </div>
      <div className="flex-1 pb-10 border-l border-[#1E3050] pl-6 -ml-0.5 space-y-3">
        <h2 className="text-lg font-semibold -mt-1">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#8AA0B8] overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </pre>
  )
}

export default function QuickstartPage() {
  return (
    <div className="max-w-2xl space-y-2">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold font-outfit">Quickstart</h1>
        <p className="text-[#8AA0B8]">Da API Key à primeira NFS-e em menos de 5 minutos.</p>
      </div>

      <Step n={1} title="Crie sua conta e obtenha a API Key">
        <p className="text-sm text-[#8AA0B8]">
          Acesse o <a href="https://notameigateway.com.br/cadastro" className="text-[#00E8FF] hover:underline">cadastro</a>,
          envie seu certificado A1 e copie a API Key gerada — ela é exibida <strong className="text-[#EEF4FF]">apenas uma vez</strong>.
        </p>
        <div className="bg-[#142035] border border-[#F0B414]/20 rounded-lg p-3 text-sm text-[#F0B414]">
          ⚠️ Guarde sua chave em um gerenciador de segredos (ex.: variável de ambiente). Nunca comite no código.
        </div>
        <p className="text-sm text-[#8AA0B8]">
          Prefira testar primeiro? Use o <Link href="/sandbox" className="text-[#00E8FF] hover:underline">sandbox público</Link> com
          a chave <code className="text-[#00E8FF]">sk_test_sandbox_demo</code> — sem cadastro.
        </p>
      </Step>

      <Step n={2} title="Emita sua primeira nota">
        <p className="text-sm text-[#8AA0B8]">
          Faça um <code className="text-[#00E8FF]">POST /v1/nfse</code>. A API responde com <code className="text-[#00C85A]">202 Accepted</code>
          — o processamento na Receita Federal é assíncrono.
        </p>
        <Code>{STEP_CURL}</Code>
        <p className="text-sm text-[#8AA0B8]">Resposta esperada:</p>
        <Code>{`{
  "nota_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSANDO",
  "mensagem": "Nota enviada para processamento"
}`}</Code>
      </Step>

      <Step n={3} title="Verifique o status">
        <p className="text-sm text-[#8AA0B8]">
          Consulte o status com o <code className="text-[#00E8FF]">nota_id</code> recebido. Em poucos segundos
          (ou minutos, dependendo da Receita) o status muda para <code className="text-[#00C85A]">AUTORIZADA</code>.
        </p>
        <Code>{STATUS_CURL}</Code>
        <p className="text-sm text-[#8AA0B8]">Quando autorizada:</p>
        <Code>{`{
  "id": "550e8400-...",
  "status": "AUTORIZADA",
  "numero_nfse": "000123",
  "codigo_verificacao": "ABC12345",
  "emitida_em": "2026-04-26T14:30:00Z"
}`}</Code>
      </Step>

      <Step n={4} title="Configure um webhook">
        <p className="text-sm text-[#8AA0B8]">
          Em vez de fazer polling, passe um <code className="text-[#00E8FF]">webhook_url</code> na emissão.
          A API entrega o resultado assim que a Receita responde.
          Valide a assinatura HMAC para garantir autenticidade:
        </p>
        <Code>{WEBHOOK_VERIFY}</Code>
        <p className="text-sm text-[#8AA0B8]">
          Veja o guia completo em <Link href="/docs/webhooks" className="text-[#00E8FF] hover:underline">Webhooks →</Link>
        </p>
      </Step>

      <Step n={5} title="Vá para produção">
        <p className="text-sm text-[#8AA0B8]">
          Troque a chave <code className="text-[#F0B414]">sk_test_</code> pela{' '}
          <code className="text-[#00C85A]">sk_live_</code> gerada no cadastro.
          A URL base é a mesma. Veja as diferenças em{' '}
          <Link href="/docs/ambientes" className="text-[#00E8FF] hover:underline">Ambientes →</Link>
        </p>
        <div className="bg-[#142035] border border-[#00C85A]/20 rounded-lg p-3 text-sm text-[#00C85A]">
          ✓ Checklist de produção disponível em <code>docs/deploy-checklist.md</code> no repositório.
        </div>
      </Step>

      {/* Next steps */}
      <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-5 space-y-3 !mt-4">
        <h3 className="font-semibold">Próximos passos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            { href: '/docs/referencia', label: '📖 Referência completa da API' },
            { href: '/docs/webhooks', label: '🔔 Guia de webhooks' },
            { href: '/docs/erros', label: '⚠️ Tratamento de erros' },
            { href: '/sandbox', label: '🧪 Playground sandbox' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 bg-[#0A0F1E] border border-[#1E3050] rounded-lg hover:border-[#00E8FF]/30 hover:text-[#00E8FF] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
