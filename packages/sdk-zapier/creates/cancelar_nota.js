'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/nfse/${encodeURIComponent(bundle.inputData.nota_id)}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
  });
  return response.data;
};

module.exports = {
  key: 'cancelar_nota',
  noun: 'NFS-e',

  display: {
    label: 'Cancelar Nota Fiscal (NFS-e)',
    description: 'Cancela uma NFS-e AUTORIZADA. Notas em PROCESSANDO ou já CANCELADAS não podem ser canceladas.',
  },

  operation: {
    perform,
    inputFields: [
      {
        key: 'nota_id',
        label: 'ID da Nota',
        type: 'string',
        required: true,
        helpText: 'UUID da nota retornado na emissão ou no trigger de autorização.',
      },
    ],
    sample: {
      nota_id: 'nota-uuid-001',
      status: 'CANCELADA',
      mensagem: 'Nota cancelada com sucesso',
    },
  },
};
