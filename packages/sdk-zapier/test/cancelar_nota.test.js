'use strict';

const { operation } = require('../creates/cancelar_nota');

const mockZ = { request: jest.fn() };
const bundle = { authData: { api_key: 'sk_test_abc' }, inputData: {} };

beforeEach(() => jest.clearAllMocks());

test('envia DELETE para o endpoint correto', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'nota-uuid-001', status: 'CANCELADA', mensagem: 'ok' },
  });

  const result = await operation.perform(mockZ, {
    ...bundle,
    inputData: { nota_id: 'nota-uuid-001' },
  });

  expect(result.status).toBe('CANCELADA');
  const call = mockZ.request.mock.calls[0][0];
  expect(call.method).toBe('DELETE');
  expect(call.url).toContain('nota-uuid-001');
  expect(call.headers['Authorization']).toBe('Bearer sk_test_abc');
});
