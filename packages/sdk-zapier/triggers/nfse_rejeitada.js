'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/nfse`,
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
    params: {
      status: 'REJEITADA',
      limit: bundle.meta.isLoadingSample ? 3 : 20,
    },
  });

  return (response.data.data || []).map((nota) => ({ id: nota.id, ...nota }));
};

module.exports = {
  key: 'nfse_rejeitada',
  noun: 'NFS-e',

  display: {
    label: 'Nota Fiscal Rejeitada',
    description:
      'Dispara quando uma NFS-e é REJEITADA pela Receita Federal. ' +
      'Use para alertar o time, criar tarefa de correção no ClickUp/Notion, etc.',
  },

  operation: {
    type: 'polling',
    perform,
    sample: {
      id: 'nota-uuid-002',
      status: 'REJEITADA',
      competencia: '2026-04',
      erro_codigo: 'E10',
      erro_descricao: 'CNPJ do tomador inválido',
      created_at: '2026-04-26T14:00:00Z',
    },
  },
};
