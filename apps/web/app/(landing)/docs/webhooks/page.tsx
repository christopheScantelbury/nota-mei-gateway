import Link from 'next/link'

function Code({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-[#6473A0] font-mono">{lang}</p>
      <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#8AA0B8] overflow-x-auto whitespace-pre leading-relaxed">
        {children}
      </pre>
    </div>
  )
}

export default function WebhooksPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-outfit">Webhooks</h1>
        <p className="text-[#8AA0B8]">
          Receba notificações em tempo real quando a Receita Federal processar uma NFS-e.
        </p>
      </div>

      {/* Como funciona */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Como funciona</h2>
        <p className="text-sm text-[#8AA0B8] leading-relaxed">
          Ao emitir uma nota com o campo <code className="text-[#00E8FF]">webhook_url</code>, a API entrega
          um <code className="text-[#00E8FF]">POST</code> para a URL configurada assim que a Receita responde.
          O payload inclui uma assinatura HMAC-SHA256 para verificar autenticidade.
        </p>
        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2 text-sm">
          <p className="font-medium">Fluxo:</p>
          <ol className="list-decimal list-inside space-y-1 text-[#8AA0B8]">
            <li>Você envia <code className="text-[#00E8FF]">POST /v1/nfse</code> com <code className="text-[#00E8FF]">webhook_url</code></li>
            <li>API responde <code className="text-[#00C85A]">202</code> imediatamente</li>
            <li>Worker processa em background e consulta a Receita</li>
            <li>Quando autorizada/rejeitada, API entrega <code className="text-[#00E8FF]">POST</code> para sua URL</li>
            <li>Sua aplicação responde <code className="text-[#00C85A]">200</code> para confirmar recebimento</li>
          </ol>
        </div>
      </section>

      {/* Eventos */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Eventos disponíveis</h2>
        <div className="space-y-2">
          {[
            { event: 'nfse.autorizada', color: '#00C85A', desc: 'Nota emitida com sucesso. Contém número NFS-e, código de verificação e URLs de PDF/XML.' },
            { event: 'nfse.rejeitada', color: '#FF3232', desc: 'Nota rejeitada pela Receita. Contém código e descrição do erro.' },
            { event: 'nfse.cancelada', color: '#6473A0', desc: 'Nota cancelada com sucesso após autorização.' },
          ].map((ev) => (
            <div key={ev.event} className="bg-[#142035] border border-[#1E3050] rounded-lg p-4 flex gap-4">
              <code className="shrink-0 text-sm font-mono font-bold" style={{ color: ev.color }}>{ev.event}</code>
              <p className="text-sm text-[#8AA0B8]">{ev.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payload */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Payload</h2>
        <Code lang="JSON — nfse.autorizada">{`{
  "event": "nfse.autorizada",
  "nota_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "AUTORIZADA",
  "numero_nfse": "000123",
  "codigo_verificacao": "ABC12345",
  "pdf_url": "https://api.notameigateway.com.br/v1/nfse/550e.../pdf",
  "xml_url": "https://api.notameigateway.com.br/v1/nfse/550e.../xml",
  "emitida_em": "2026-04-26T14:30:00Z",
  "signature": "sha256=a1b2c3d4e5f6..."
}`}</Code>
        <Code lang="JSON — nfse.rejeitada">{`{
  "event": "nfse.rejeitada",
  "nota_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "REJEITADA",
  "erro_codigo": "E10",
  "erro_descricao": "CNPJ do tomador inválido",
  "signature": "sha256=a1b2c3d4e5f6..."
}`}</Code>
      </section>

      {/* Verificação HMAC */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Verificação da assinatura</h2>
        <p className="text-sm text-[#8AA0B8]">
          Todo payload inclui o header <code className="text-[#00E8FF]">X-Nota-Signature</code> com o HMAC-SHA256
          do body cru. Valide com tempo constante para evitar timing attacks.
        </p>
        <Code lang="Node.js / TypeScript">{`import crypto from 'crypto'

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  // Comparação em tempo constante — evita timing attack
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

app.post('/webhooks/nfse', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-nota-signature'] as string
  if (!verifySignature(req.body.toString(), sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Assinatura inválida' })
  }
  const { event, nota_id, status } = JSON.parse(req.body.toString())
  // processe o evento...
  res.sendStatus(200)
})`}</Code>
        <Code lang="Python">{`import hmac, hashlib

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.post('/webhooks/nfse')
def webhook(request: Request):
    sig = request.headers.get('x-nota-signature', '')
    body = request.body()
    if not verify_signature(body, sig, os.getenv('WEBHOOK_SECRET')):
        return Response(status_code=401)
    payload = json.loads(body)
    # processe o evento...
    return Response(status_code=200)`}</Code>
      </section>

      {/* Retry */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Política de retry</h2>
        <p className="text-sm text-[#8AA0B8]">
          Se o seu endpoint retornar um status diferente de <code className="text-[#00C85A]">2xx</code>,
          ou não responder em 10 segundos, a API tenta novamente com backoff:
        </p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { tentativa: '1ª', delay: 'imediato' },
            { tentativa: '2ª', delay: '1 minuto' },
            { tentativa: '3ª', delay: '5 minutos' },
            { tentativa: '4ª', delay: '30 minutos' },
            { tentativa: '5ª', delay: '2 horas' },
          ].map((r) => (
            <div key={r.tentativa} className="bg-[#142035] border border-[#1E3050] rounded-lg p-3">
              <p className="font-semibold text-[#EEF4FF]">{r.tentativa}</p>
              <p className="text-[#8AA0B8] text-xs mt-0.5">{r.delay}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[#8AA0B8]">
          Após 5 tentativas sem sucesso, o campo <code className="text-[#00E8FF]">webhook_entregue</code> permanece
          <code className="text-[#FF3232]"> false</code>. Você pode reprocessar manualmente consultando{' '}
          <code className="text-[#00E8FF]">GET /v1/nfse/:id</code>.
        </p>
      </section>

      {/* Sandbox */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Testando webhooks no sandbox</h2>
        <p className="text-sm text-[#8AA0B8]">
          Use o endpoint de webhook do próprio sandbox para inspecionar payloads sem infraestrutura:
        </p>
        <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#00E8FF] overflow-x-auto">
          {`"webhook_url": "https://api.notameigateway.com.br/v1/sandbox/webhook"`}
        </pre>
        <p className="text-sm text-[#8AA0B8]">
          Veja os últimos 20 payloads recebidos com{' '}
          <code className="text-[#00E8FF]">GET /v1/sandbox/webhook</code>, ou use o{' '}
          <Link href="/sandbox" className="text-[#00E8FF] hover:underline">playground →</Link>
        </p>
      </section>
    </div>
  )
}
