'use strict';

const { notameiRequest, notameiEmitir, notameiConsultar } = require('../src/Api');

const API_KEY = 'sk_test_abc123';
const BASE_URL = 'https://api.notameigateway.com.br';

function makeFetch(status, body) {
  return jest.fn().mockReturnValue({
    getResponseCode: () => status,
    getContentText: () => JSON.stringify(body),
  });
}

describe('notameiRequest', () => {
  test('sends correct method, URL and auth header', () => {
    const fetch = makeFetch(200, { ok: true });
    notameiRequest('get', '/v1/health', API_KEY, null, {}, fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/v1/health');
    expect(opts.method).toBe('get');
    expect(opts.headers.Authorization).toBe('Bearer ' + API_KEY);
    expect(opts.muteHttpExceptions).toBe(true);
  });

  test('serialises body to JSON payload', () => {
    const fetch = makeFetch(202, { nota_id: 'x' });
    const body = { servico: { valor: 100 } };
    notameiRequest('post', '/v1/nfse', API_KEY, body, {}, fetch);

    const [, opts] = fetch.mock.calls[0];
    expect(opts.payload).toBe(JSON.stringify(body));
    expect(opts.contentType).toBe('application/json');
  });

  test('passes extra headers', () => {
    const fetch = makeFetch(202, {});
    notameiRequest('post', '/v1/nfse', API_KEY, {}, { 'Idempotency-Key': 'idem-123' }, fetch);

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Idempotency-Key']).toBe('idem-123');
  });

  test('returns parsed status and data', () => {
    const fetch = makeFetch(404, { message: 'not found' });
    const result = notameiRequest('get', '/v1/nfse/bad', API_KEY, null, {}, fetch);

    expect(result.status).toBe(404);
    expect(result.data.message).toBe('not found');
  });

  test('handles non-JSON response gracefully', () => {
    const fetch = jest.fn().mockReturnValue({
      getResponseCode: () => 500,
      getContentText: () => 'Internal Server Error',
    });
    const result = notameiRequest('get', '/v1/health', API_KEY, null, {}, fetch);

    expect(result.status).toBe(500);
    expect(result.data.raw).toBe('Internal Server Error');
  });

  test('works with node-style response (status/body properties)', () => {
    const fetch = jest.fn().mockReturnValue({
      status: 200,
      body: JSON.stringify({ ok: true }),
    });
    const result = notameiRequest('get', '/v1/health', API_KEY, null, {}, fetch);

    expect(result.status).toBe(200);
    expect(result.data.ok).toBe(true);
  });
});

describe('notameiEmitir', () => {
  const servico = { codigo_nbs: '01.01.01.10', discriminacao: 'Serviço X', valor: 500, aliquota_iss: 2 };
  const tomador = { tipo: 'PJ', documento: '12345678000190', razao_social: 'Empresa' };

  test('posts to /v1/nfse with correct body', () => {
    const fetch = makeFetch(202, { nota_id: 'uuid-1', status: 'PROCESSANDO' });
    const result = notameiEmitir(API_KEY, servico, tomador, '2026-04', 'key-1', fetch);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/v1/nfse');
    expect(opts.method).toBe('post');
    const payload = JSON.parse(opts.payload);
    expect(payload.servico).toEqual(servico);
    expect(payload.tomador).toEqual(tomador);
    expect(payload.competencia).toBe('2026-04');
    expect(opts.headers['Idempotency-Key']).toBe('key-1');
    expect(result.status).toBe(202);
    expect(result.data.nota_id).toBe('uuid-1');
  });

  test('omits Idempotency-Key header when not provided', () => {
    const fetch = makeFetch(202, { nota_id: 'uuid-2' });
    notameiEmitir(API_KEY, servico, tomador, '2026-04', null, fetch);

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('notameiConsultar', () => {
  test('GETs the correct nota URL', () => {
    const fetch = makeFetch(200, { id: 'nota-abc', status: 'AUTORIZADA' });
    const result = notameiConsultar(API_KEY, 'nota-abc', fetch);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/v1/nfse/nota-abc');
    expect(opts.method).toBe('get');
    expect(result.status).toBe(200);
    expect(result.data.status).toBe('AUTORIZADA');
  });

  test('encodes special characters in nota ID', () => {
    const fetch = makeFetch(404, {});
    notameiConsultar(API_KEY, 'health-check-id', fetch);

    const [url] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/v1/nfse/health-check-id');
  });
});
