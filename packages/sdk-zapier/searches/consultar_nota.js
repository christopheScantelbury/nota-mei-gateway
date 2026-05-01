'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/nfse/${encodeURIComponent(bundle.inputData.nota_id)}`,
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
  });

  if (response.status === 404) return [];
  return [response.data];
};

module.exports = {
  key: 'consultar_nota',
  noun: 'NFS-e',

  display: {
    label: 'Consultar Nota Fiscal (NFS-e)',
    description: 'Busca os detalhes e o status atual de uma NFS-e pelo ID.',
  },

  operation: {
    perform,
    inputFields: [
      {
        key: 'nota_id',
        label: 'ID da Nota',
        type: 'string',
        required: true,
        helpText: 'UUID da nota retornado na emissão.',
      },
    ],
    sample: {
      id: 'nota-uuid-001',
      status: 'AUTORIZADA',
      numero_nfse: '000123',
      valor_servico: 3500.0,
      tomador_nome: 'Empresa LTDA',
      competencia: '2026-04',
      emitida_em: '2026-04-26T14:30:00Z',
      protocolo_receita: '20260401123',
      codigo_verificacao: 'ABC12345',
      tomador_doc: '12345678000190',
      webhook_entregue: true,
    },
  },
};
