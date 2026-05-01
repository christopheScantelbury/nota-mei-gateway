import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHmac } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { NotaMEI } from '../src/client.js'
import { NotaMEIError } from '../src/errors.js'

// ── Test server helpers ───────────────────────────────────────────────────────

type Handler = (req: IncomingMessage, res: ServerResponse) => void

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) })
  res.end(raw)
}

interface TestServer {
  url: string
  setHandler(h: Handler): void
  close(): Promise<void>
}

function createTestServer(): Promise<TestServer> {
  return new Promise((resolve) => {
    let handler: Handler = (_, res) => json(res, 500, { error: 'INTERNAL_ERROR', message: 'no handler set' })
    const server = createServer((req, res) => handler(req, res))
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        setHandler(h: Handler) { handler = h },
        close: () => new Promise<void>((res, rej) => server.close((e) => e ? rej(e) : res())),
      })
    })
  })
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emissaoInput = {
  servico: { codigoNBS: '01.01.01.10', discriminacao: 'Desenvolvimento de software', valor: 3500, aliquotaISS: 2.0 },
  tomador: { cnpj: '12345678000190', razaoSocial: 'Empresa LTDA' },
  competencia: '2026-04',
}

const emissaoResponse = { nota_id: 'nota-uuid-001', status: 'PROCESSANDO', mensagem: 'Nota enviada para processamento' }

const notaDetalheResponse = {
  id: 'nota-uuid-001',
  status: 'AUTORIZADA',
  numero_nfse: '000123',
  valor_servico: 3500,
  tomador_nome: 'Empresa LTDA',
  competencia: '2026-04',
  emitida_em: '2026-04-26T14:30:00Z',
  created_at: '2026-04-26T14:00:00Z',
  protocolo_receita: '202604011234567',
  codigo_verificacao: 'ABC12345',
  tomador_doc: '12345678000190',
  erro_codigo: null,
  erro_descricao: null,
  webhook_url: null,
  webhook_entregue: true,
  webhook_tentativas: 1,
  cancelada_em: null,
  updated_at: '2026-04-26T14:30:00Z',
}

const listaResponse = {
  data: [{ id: 'nota-uuid-001', status: 'AUTORIZADA', competencia: '2026-04', created_at: '2026-04-26T14:00:00Z' }],
  total: 1,
  limit: 20,
  offset: 0,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotaMEI client', () => {
  let srv: TestServer
  let client: NotaMEI

  before(async () => {
    srv = await createTestServer()
    client = new NotaMEI('sk_test_abc123', { baseUrl: srv.url, maxRetries: 0 })
  })

  after(() => srv.close())

  describe('emitir()', () => {
    test('POST /v1/nfse com body correto, retorna NotaResposta', async () => {
      let capturedBody: unknown
      srv.setHandler(async (req, res) => {
        capturedBody = JSON.parse(await readBody(req))
        json(res, 202, emissaoResponse)
      })

      const nota = await client.emitir(emissaoInput)

      assert.equal(nota.id, 'nota-uuid-001')
      assert.equal(nota.status, 'PROCESSANDO')
      assert.equal(nota.mensagem, 'Nota enviada para processamento')

      const body = capturedBody as Record<string, unknown>
      assert.deepEqual((body['servico'] as Record<string, unknown>)['codigo_nbs'], '01.01.01.10')
      assert.deepEqual((body['tomador'] as Record<string, unknown>)['tipo'], 'PJ')
      assert.deepEqual((body['tomador'] as Record<string, unknown>)['documento'], '12345678000190')
    })

    test('infere tipo PF quando cpf fornecido', async () => {
      let capturedBody: unknown
      srv.setHandler(async (req, res) => {
        capturedBody = JSON.parse(await readBody(req))
        json(res, 202, emissaoResponse)
      })

      await client.emitir({
        ...emissaoInput,
        tomador: { cpf: '12345678900', razaoSocial: 'João Silva' },
      })

      const tomador = (capturedBody as Record<string, unknown>)['tomador'] as Record<string, unknown>
      assert.equal(tomador['tipo'], 'PF')
      assert.equal(tomador['documento'], '12345678900')
    })

    test('envia Idempotency-Key quando idempotencyKey fornecida', async () => {
      let capturedHeaders: Record<string, string | string[] | undefined> = {}
      srv.setHandler(async (req, res) => {
        capturedHeaders = req.headers as typeof capturedHeaders
        await readBody(req)
        json(res, 202, emissaoResponse)
      })

      await client.emitir({ ...emissaoInput, idempotencyKey: 'pedido-999' })
      assert.equal(capturedHeaders['idempotency-key'], 'pedido-999')
    })

    test('usa competencia atual quando omitida', async () => {
      let capturedBody: unknown
      srv.setHandler(async (req, res) => {
        capturedBody = JSON.parse(await readBody(req))
        json(res, 202, emissaoResponse)
      })

      await client.emitir({ servico: emissaoInput.servico, tomador: emissaoInput.tomador })

      const body = capturedBody as Record<string, unknown>
      assert.match(String(body['competencia']), /^\d{4}-\d{2}$/)
    })
  })

  describe('consultar()', () => {
    test('GET /v1/nfse/:id retorna NotaDetalhe mapeado', async () => {
      srv.setHandler((req, res) => {
        assert.equal(req.url, '/v1/nfse/nota-uuid-001')
        json(res, 200, notaDetalheResponse)
      })

      const nota = await client.consultar('nota-uuid-001')
      assert.equal(nota.id, 'nota-uuid-001')
      assert.equal(nota.status, 'AUTORIZADA')
      assert.equal(nota.numeroNFSe, '000123')
      assert.equal(nota.protocoloReceita, '202604011234567')
      assert.equal(nota.codigoVerificacao, 'ABC12345')
      assert.equal(nota.webhookEntregue, true)
      assert.equal(nota.updatedAt, '2026-04-26T14:30:00Z')
      assert.equal(nota.erroCodigo, undefined)
    })
  })

  describe('listar()', () => {
    test('GET /v1/nfse sem filtros', async () => {
      srv.setHandler((req, res) => {
        assert.equal(req.url, '/v1/nfse')
        json(res, 200, listaResponse)
      })

      const lista = await client.listar()
      assert.equal(lista.total, 1)
      assert.equal(lista.data.length, 1)
      assert.equal(lista.data[0]?.id, 'nota-uuid-001')
    })

    test('GET /v1/nfse com filtros na query string', async () => {
      srv.setHandler((req, res) => {
        const url = new URL(req.url ?? '', 'http://x')
        assert.equal(url.searchParams.get('limit'), '10')
        assert.equal(url.searchParams.get('offset'), '5')
        assert.equal(url.searchParams.get('status'), 'AUTORIZADA')
        json(res, 200, { ...listaResponse, limit: 10, offset: 5 })
      })

      await client.listar({ limit: 10, offset: 5, status: 'AUTORIZADA' })
    })
  })

  describe('cancelar()', () => {
    test('DELETE /v1/nfse/:id retorna resultado mapeado', async () => {
      srv.setHandler((req, res) => {
        assert.equal(req.method, 'DELETE')
        assert.equal(req.url, '/v1/nfse/nota-uuid-001')
        json(res, 202, { nota_id: 'nota-uuid-001', status: 'CANCELADA', mensagem: 'Nota cancelada com sucesso' })
      })

      const result = await client.cancelar('nota-uuid-001')
      assert.equal(result.notaId, 'nota-uuid-001')
      assert.equal(result.status, 'CANCELADA')
    })
  })

  describe('xml()', () => {
    test('GET /v1/nfse/:id/xml retorna string XML', async () => {
      const xmlContent = '<?xml version="1.0"?><NFS-e><Numero>123</Numero></NFS-e>'
      srv.setHandler((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/xml' })
        res.end(xmlContent)
      })

      const xml = await client.xml('nota-uuid-001')
      assert.equal(xml, xmlContent)
    })
  })

  describe('verifyWebhook()', () => {
    test('retorna true para assinatura válida', () => {
      const body = '{"event":"nfse.autorizada"}'
      const sig = 'sha256=' + createHmac('sha256', 'my-secret').update(body, 'utf8').digest('hex')
      assert.equal(client.verifyWebhook(body, sig, 'my-secret'), true)
    })

    test('retorna false para assinatura inválida', () => {
      assert.equal(client.verifyWebhook('body', 'sha256=invalida', 'secret'), false)
    })
  })

  describe('erros HTTP', () => {
    test('lança NotaMEIError com code e status para 401', async () => {
      srv.setHandler((_, res) => json(res, 401, { error: 'INVALID_API_KEY', message: 'Chave inválida' }))

      await assert.rejects(
        () => client.consultar('x'),
        (err: unknown) => {
          assert.ok(err instanceof NotaMEIError)
          assert.equal(err.code, 'INVALID_API_KEY')
          assert.equal(err.status, 401)
          return true
        },
      )
    })

    test('lança NotaMEIError com fields para 422', async () => {
      srv.setHandler((_, res) =>
        json(res, 422, {
          error: 'VALIDATION_ERROR',
          message: 'campos inválidos',
          fields: [{ field: 'servico.valor', message: 'deve ser positivo' }],
        }),
      )

      await assert.rejects(
        () => client.emitir(emissaoInput),
        (err: unknown) => {
          assert.ok(err instanceof NotaMEIError)
          assert.equal(err.code, 'VALIDATION_ERROR')
          assert.ok(Array.isArray(err.fields))
          assert.equal(err.fields?.[0]?.field, 'servico.valor')
          return true
        },
      )
    })
  })

  describe('billing', () => {
    test('usage() retorna UsageData mapeado', async () => {
      srv.setHandler((req, res) => {
        assert.equal(req.url, '/v1/billing/usage')
        json(res, 200, {
          competencia: '2026-04',
          total_emitidas: 10,
          limite: 50,
          excedentes: 0,
          plano: 'Starter',
          stripe_status: 'active',
          renovacao_em: '2026-05-01T00:00:00Z',
        })
      })

      const usage = await client.billing.usage()
      assert.equal(usage.totalEmitidas, 10)
      assert.equal(usage.plano, 'Starter')
      assert.equal(usage.stripeStatus, 'active')
      assert.equal(usage.renovacaoEm, '2026-05-01T00:00:00Z')
    })

    test('portal() retorna URL string', async () => {
      srv.setHandler((_, res) => json(res, 200, { url: 'https://billing.stripe.com/session/live_xxx' }))
      const url = await client.billing.portal()
      assert.equal(url, 'https://billing.stripe.com/session/live_xxx')
    })

    test('checkout() envia price_id e retorna checkout_url', async () => {
      let capturedBody: unknown
      srv.setHandler(async (req, res) => {
        capturedBody = JSON.parse(await readBody(req))
        json(res, 200, { checkout_url: 'https://checkout.stripe.com/pay/cs_live_xxx' })
      })

      const url = await client.billing.checkout('price_starter', { successUrl: 'https://app.com/ok' })
      assert.equal(url, 'https://checkout.stripe.com/pay/cs_live_xxx')

      const body = capturedBody as Record<string, unknown>
      assert.equal(body['price_id'], 'price_starter')
      assert.equal(body['success_url'], 'https://app.com/ok')
    })
  })
})
