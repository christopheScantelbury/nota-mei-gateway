'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const testAuth = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/billing/usage`,
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
  });

  if (response.status === 401) {
    throw new z.errors.Error('API Key inválida ou revogada.', 'AuthenticationError', 401);
  }

  return response.data;
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText:
        'Sua chave sk_live_... (produção) ou sk_test_... (sandbox). ' +
        'Disponível em notameigateway.com.br → API Keys.',
    },
  ],
  test: testAuth,
  connectionLabel: (z, bundle) =>
    `Nota MEI (${bundle.authData.api_key.slice(0, 12)}...)`,
};
