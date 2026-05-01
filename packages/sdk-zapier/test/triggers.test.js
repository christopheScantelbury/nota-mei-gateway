'use strict';

const autorizada = require('../triggers/nfse_autorizada');
const rejeitada = require('../triggers/nfse_rejeitada');

const mockZ = { request: jest.fn() };
const bundle = {
  authData: { api_key: 'sk_test_abc' },
  meta: { isLoadingSample: false },
};

beforeEach(() => jest.clearAllMocks());

const mockList = (items) =>
  mockZ.request.mockResolvedValue({ status: 200, data: { data: items, total: items.length } });

test('nfse_autorizada: busca status AUTORIZADA e retorna notas com id', async () => {
  mockList([
    { id: 'nota-1', status: 'AUTORIZADA', competencia: '2026-04', created_at: '2026-04-26T14:00:00Z' },
  ]);

  const result = await autorizada.operation.perform(mockZ, bundle);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('nota-1');
  const { params } = mockZ.request.mock.calls[0][0];
  expect(params.status).toBe('AUTORIZADA');
});

test('nfse_rejeitada: busca status REJEITADA e retorna notas com id', async () => {
  mockList([
    { id: 'nota-2', status: 'REJEITADA', erro_codigo: 'E10', created_at: '2026-04-26T14:00:00Z' },
  ]);

  const result = await rejeitada.operation.perform(mockZ, bundle);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('nota-2');
  const { params } = mockZ.request.mock.calls[0][0];
  expect(params.status).toBe('REJEITADA');
});

test('nfse_autorizada: retorna limit 3 ao carregar sample', async () => {
  mockList([]);

  await autorizada.operation.perform(mockZ, { ...bundle, meta: { isLoadingSample: true } });

  expect(mockZ.request.mock.calls[0][0].params.limit).toBe(3);
});

test('nfse_autorizada: retorna array vazio quando nao ha notas', async () => {
  mockList([]);
  const result = await autorizada.operation.perform(mockZ, bundle);
  expect(result).toEqual([]);
});
