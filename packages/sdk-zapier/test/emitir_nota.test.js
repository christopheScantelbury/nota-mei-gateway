'use strict';

const { operation } = require('../creates/emitir_nota');

const mockZ = {
  request: jest.fn(),
  errors: { Error: class ZError extends Error {} },
};

const bundle = {
  authData: { api_key: 'sk_test_abc' },
  inputData: {},
};

beforeEach(() => jest.clearAllMocks());

test('envia body correto para tomador PJ', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'nota-uuid-001', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  const result = await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      tipo: 'PJ',
      cnpj: '12345678000190',
      razao_social: 'Empresa LTDA',
      email: 'fin@empresa.com',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Desenvolvimento de software',
      valor: '3500',
      aliquota_iss: '2.0',
      competencia: '2026-04',
    },
  });

  expect(result.id).toBe('nota-uuid-001');
  expect(result.status).toBe('PROCESSANDO');

  const call = mockZ.request.mock.calls[0][0];
  expect(call.method).toBe('POST');
  expect(call.url).toBe('https://api.notameigateway.com.br/v1/nfse');
  expect(call.body.tomador.tipo).toBe('PJ');
  expect(call.body.tomador.documento).toBe('12345678000190');
  expect(call.body.tomador.razao_social).toBe('Empresa LTDA');
  expect(call.body.servico.codigo_nbs).toBe('01.01.01.10');
  expect(call.body.servico.valor).toBe(3500);
  expect(call.body.competencia).toBe('2026-04');
  expect(call.headers['Authorization']).toBe('Bearer sk_test_abc');
});

test('infere tipo PJ a partir do cnpj', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'x', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      cnpj: '12345678000190',
      razao_social: 'Empresa',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Servico digital ok',
      valor: '1000',
      aliquota_iss: '2',
    },
  });

  const { body } = mockZ.request.mock.calls[0][0];
  expect(body.tomador.tipo).toBe('PJ');
  expect(body.tomador.documento).toBe('12345678000190');
});

test('infere tipo PF a partir do cpf', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'x', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      cpf: '12345678900',
      razao_social: 'João Silva',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Consultoria ok aqui',
      valor: '500',
      aliquota_iss: '2',
    },
  });

  const { body } = mockZ.request.mock.calls[0][0];
  expect(body.tomador.tipo).toBe('PF');
  expect(body.tomador.documento).toBe('12345678900');
});

test('usa competencia do mes atual quando omitida', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'x', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      cnpj: '12345678000190',
      razao_social: 'Empresa',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Servico digital qualquer',
      valor: '100',
      aliquota_iss: '2',
    },
  });

  const { body } = mockZ.request.mock.calls[0][0];
  expect(body.competencia).toMatch(/^\d{4}-\d{2}$/);
});

test('envia Idempotency-Key quando fornecida', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'x', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      cnpj: '12345678000190',
      razao_social: 'Empresa',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Descricao do servico aqui',
      valor: '100',
      aliquota_iss: '2',
      idempotency_key: 'pedido-999',
    },
  });

  expect(mockZ.request.mock.calls[0][0].headers['Idempotency-Key']).toBe('pedido-999');
});

test('remove pontuacao do cnpj', async () => {
  mockZ.request.mockResolvedValue({
    status: 202,
    data: { nota_id: 'x', status: 'PROCESSANDO', mensagem: 'ok' },
  });

  await operation.perform(mockZ, {
    ...bundle,
    inputData: {
      cnpj: '12.345.678/0001-90',
      razao_social: 'Empresa',
      codigo_nbs: '01.01.01.10',
      discriminacao: 'Descricao qualquer aqui',
      valor: '100',
      aliquota_iss: '2',
    },
  });

  const { body } = mockZ.request.mock.calls[0][0];
  expect(body.tomador.documento).toBe('12345678000190');
});
