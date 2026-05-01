'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/nfse`,
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
    params: {
      status: 'AUTORIZADA',
      limit: bundle.meta.isLoadingSample ? 3 : 20,
    },
  });

  return (response.data.data || []).map((nota) => ({ id: nota.id, ...nota }));
};

module.exports = {
  key: 'nfse_autorizada',
  noun: 'NFS-e',

  display: {
    label: 'Nota Fiscal Autorizada',
    description:
      'Dispara quando uma NFS-e é AUTORIZADA pela Receita Federal. ' +
      'Use este trigger para enviar o PDF ao cliente, registrar no ERP, etc.',
  },

  operation: {
    type: 'polling',
    perform,
    sample: {
      id: 'nota-uuid-001',
      status: 'AUTORIZADA',
      numero_nfse: '000123',
      valor_servico: 3500.0,
      tomador_nome: 'Empresa LTDA',
      competencia: '2026-04',
      emitida_em: '2026-04-26T14:30:00Z',
      created_at: '2026-04-26T14:00:00Z',
    },
  },
};
