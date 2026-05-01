'use strict';

var NOTAMEI_BASE_URL = 'https://api.notameigateway.com.br';

/**
 * Low-level HTTP request against the Nota MEI API.
 * Uses UrlFetchApp in Apps Script; accepts an optional fetcher for testing.
 *
 * @param {string} method   HTTP verb (post, get, delete).
 * @param {string} path     Endpoint path e.g. /v1/nfse.
 * @param {string} apiKey   Bearer token.
 * @param {Object} [body]   Request body (will be JSON-encoded).
 * @param {Object} [extra]  Extra headers.
 * @param {Function} [fetchFn] Override UrlFetchApp.fetch for testing.
 * @returns {{ status: number, data: Object }}
 */
function notameiRequest(method, path, apiKey, body, extra, fetchFn) {
  var fetch = fetchFn || UrlFetchApp.fetch;

  var options = {
    method: method,
    contentType: 'application/json',
    headers: Object.assign(
      {
        Authorization: 'Bearer ' + apiKey,
        Accept: 'application/json',
        'User-Agent': 'notamei-sheets/1.0.0',
      },
      extra || {}
    ),
    muteHttpExceptions: true,
  };

  if (body) {
    options.payload = JSON.stringify(body);
  }

  var response = fetch(NOTAMEI_BASE_URL + path, options);
  var code = typeof response.getResponseCode === 'function'
    ? response.getResponseCode()
    : response.status;
  var text = typeof response.getContentText === 'function'
    ? response.getContentText()
    : response.body;

  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  return { status: code, data: data };
}

/**
 * Emit a new NFS-e.
 */
function notameiEmitir(apiKey, servico, tomador, competencia, idempotencyKey, fetchFn) {
  var body = {
    servico: servico,
    tomador: tomador,
    competencia: competencia,
  };
  var extra = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
  return notameiRequest('post', '/v1/nfse', apiKey, body, extra, fetchFn);
}

/**
 * Fetch details for an existing NFS-e.
 */
function notameiConsultar(apiKey, notaId, fetchFn) {
  return notameiRequest('get', '/v1/nfse/' + encodeURIComponent(notaId), apiKey, null, {}, fetchFn);
}

// Allow require() in Node.js tests.
if (typeof module !== 'undefined') {
  module.exports = { notameiRequest, notameiEmitir, notameiConsultar };
}
