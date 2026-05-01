import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifySignature, parseWebhook } from '../src/webhook.js'
import { NotaMEIError } from '../src/errors.js'

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

describe('verifySignature', () => {
  const secret = 'test-secret'
  const body = JSON.stringify({ event: 'nfse.autorizada', nota_id: 'uuid-123' })

  test('retorna true para assinatura válida', () => {
    const sig = sign(body, secret)
    assert.equal(verifySignature(body, sig, secret), true)
  })

  test('retorna false para assinatura errada', () => {
    assert.equal(verifySignature(body, sign(body, 'outro-secret'), secret), false)
  })

  test('retorna false para body adulterado', () => {
    const sig = sign(body, secret)
    assert.equal(verifySignature(body + ' ', sig, secret), false)
  })

  test('retorna false sem prefixo sha256=', () => {
    const hex = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
    assert.equal(verifySignature(body, hex, secret), false)
  })

  test('retorna false para assinatura com tamanho diferente', () => {
    assert.equal(verifySignature(body, 'sha256=abc', secret), false)
  })
})

describe('parseWebhook', () => {
  const secret = 'parse-secret'

  test('retorna payload mapeado (snake→camel) para assinatura válida', () => {
    // raw body como a API envia (snake_case)
    const raw = JSON.stringify({ event: 'nfse.autorizada', nota_id: 'abc', status: 'AUTORIZADA', signature: '' })
    const sig = sign(raw, secret)
    const result = parseWebhook(raw, sig, secret)
    assert.equal(result.notaId, 'abc')
    assert.equal(result.event, 'nfse.autorizada')
    assert.equal(result.status, 'AUTORIZADA')
  })

  test('lança NotaMEIError FORBIDDEN para assinatura inválida', () => {
    const raw = JSON.stringify({ event: 'nfse.autorizada', nota_id: 'x' })
    assert.throws(
      () => parseWebhook(raw, 'sha256=invalida', secret),
      (err: unknown) => {
        assert.ok(err instanceof NotaMEIError)
        assert.equal(err.code, 'FORBIDDEN')
        assert.equal(err.status, 403)
        return true
      },
    )
  })
})
