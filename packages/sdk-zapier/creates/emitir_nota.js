'use strict';

const BASE_URL = 'https://api.notameigateway.com.br';

const perform = async (z, bundle) => {
  const d = bundle.inputData;

  const tipo = d.tipo || (d.cnpj ? 'PJ' : 'PF');
  const documento = tipo === 'PJ'
    ? String(d.cnpj || '').replace(/\D/g, '')
    : String(d.cpf || '').replace(/\D/g, '');

  const tomador = {
    tipo,
    documento,
    razao_social: d.razao_social,
  };
  if (d.email) tomador.email = d.email;
  if (d.municipio_ibge) tomador.municipio_ibge = d.municipio_ibge;

  const body = {
    servico: {
      codigo_nbs: d.codigo_nbs,
      discriminacao: d.discriminacao,
      valor: parseFloat(d.valor),
      aliquota_iss: parseFloat(d.aliquota_iss),
    },
    tomador,
    competencia: d.competencia || new Date().toISOString().slice(0, 7),
  };
  if (d.webhook_url) body.webhook_url = d.webhook_url;

  const headers = { Authorization: `Bearer ${bundle.authData.api_key}` };
  if (d.idempotency_key) headers['Idempotency-Key'] = d.idempotency_key;

  const response = await z.request({
    url: `${BASE_URL}/v1/nfse`,
    method: 'POST',
    headers,
    body,
  });

  const data = response.data;
  // Normalize: the API returns nota_id; expose as both nota_id and id for convenience.
  return { id: data.nota_id, ...data };
};

module.exports = {
  key: 'emitir_nota',
  noun: 'NFS-e',

  display: {
    label: 'Emitir Nota Fiscal (NFS-e)',
    description:
      'Envia uma NFS-e para processamento via Nota MEI Gateway. ' +
      'O status final (AUTORIZADA ou REJEITADA) chega pelo trigger correspondente.',
  },

  operation: {
    perform,
    inputFields: [
      // ─── Serviço ────────────────────────────────────────────────────────
      {
        key: 'codigo_nbs',
        label: 'Código NBS',
        type: 'string',
        required: true,
        default: '01.01.01.10',
        helpText:
          'Nomenclatura Brasileira de Serviços. Ex: 01.01.01.10 para desenvolvimento de software.',
      },
      {
        key: 'discriminacao',
        label: 'Discriminação do serviço',
        type: 'text',
        required: true,
        helpText: 'Descrição do serviço prestado (mín. 10 caracteres).',
      },
      {
        key: 'valor',
        label: 'Valor (R$)',
        type: 'number',
        required: true,
        helpText: 'Valor total do serviço em reais.',
      },
      {
        key: 'aliquota_iss',
        label: 'Alíquota ISS (%)',
        type: 'number',
        required: true,
        default: '2.0',
        helpText: 'Alíquota do ISS em percentual. Ex: 2.0 = 2%.',
      },
      {
        key: 'competencia',
        label: 'Competência (AAAA-MM)',
        type: 'string',
        required: false,
        helpText: 'Mês de referência da nota. Padrão: mês atual.',
      },
      // ─── Tomador ────────────────────────────────────────────────────────
      {
        key: 'tipo',
        label: 'Tipo do tomador',
        type: 'string',
        required: false,
        choices: ['PJ', 'PF'],
        helpText: 'Pessoa Jurídica (CNPJ) ou Física (CPF). Detectado automaticamente se omitido.',
      },
      {
        key: 'cnpj',
        label: 'CNPJ do tomador',
        type: 'string',
        required: false,
        helpText: '14 dígitos sem pontuação. Obrigatório para PJ.',
      },
      {
        key: 'cpf',
        label: 'CPF do tomador',
        type: 'string',
        required: false,
        helpText: '11 dígitos sem pontuação. Obrigatório para PF.',
      },
      {
        key: 'razao_social',
        label: 'Razão social / Nome',
        type: 'string',
        required: true,
      },
      {
        key: 'email',
        label: 'E-mail do tomador',
        type: 'string',
        required: false,
      },
      {
        key: 'municipio_ibge',
        label: 'Município IBGE (7 dígitos)',
        type: 'string',
        required: false,
        helpText: 'Código IBGE do município do tomador (opcional para tomadores do mesmo município do MEI).',
      },
      // ─── Opcionais ──────────────────────────────────────────────────────
      {
        key: 'webhook_url',
        label: 'URL de callback (webhook)',
        type: 'string',
        required: false,
        helpText: 'URL que receberá o status final da nota (AUTORIZADA/REJEITADA).',
      },
      {
        key: 'idempotency_key',
        label: 'Chave de idempotência',
        type: 'string',
        required: false,
        helpText:
          'Envie o mesmo valor para repetir com segurança sem duplicar a nota. ' +
          'Ex: o ID do pedido na sua ferramenta.',
      },
    ],
    sample: {
      id: 'nota-uuid-001',
      nota_id: 'nota-uuid-001',
      status: 'PROCESSANDO',
      mensagem: 'Nota enviada para processamento',
    },
  },
};
