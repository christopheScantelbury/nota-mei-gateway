'use strict';

const { operation } = require('../searches/consultar_nota');

const mockZ = {
  request: jest.fn(),
  errors: { Error: class ZError extends Error {} },
};

const bundle = { authData: { api_key: 'sk_test_abc' }, inputData: {} };

beforeEach(() => jest.clearAllMocks());

test('retorna array com a nota encontrada', async () => {
  const nota = { id: 'nota-uuid-001', status: 'AUTORIZADA', numero_nfse: '000123' };
  mockZ.request.mockResolvedValue({ status: 200, data: nota });

  const result = await operation.perform(mockZ, {
    ...bundle,
    inputData: { nota_id: 'nota-uuid-001' },
  });

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('nota-uuid-001');
  expect(result[0].status).toBe('AUTORIZADA');
  expect(mockZ.request.mock.calls[0][0].url).toContain('nota-uuid-001');
});

test('retorna array vazio quando nota nao encontrada (404)', async () => {
  mockZ.request.mockResolvedValue({ status: 404, data: { error: 'NOT_FOUND' } });

  const result = await operation.perform(mockZ, {
    ...bundle,
    inputData: { nota_id: 'id-inexistente' },
  });

  expect(result).toEqual([]);
});
