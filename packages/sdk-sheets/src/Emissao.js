'use strict';

/**
 * Parse a spreadsheet row into API-ready servico + tomador objects.
 *
 * @param {Array}  row       1-based values array (col 1 = index 0 when 0-based).
 * @param {Object} settings  { defaultNbs, defaultAliquota }
 * @returns {{ ok: boolean, servico, tomador, competencia, idempotencyKey, error }}
 */
function parseRow(row, settings) {
  var tomadorName = String(row[COL.TOMADOR - 1] || '').trim();
  var documento   = String(row[COL.DOCUMENTO - 1] || '').replace(/\D/g, '');
  var discriminacao = String(row[COL.DISCRIMINACAO - 1] || '').trim();
  var valorStr = String(row[COL.VALOR - 1] || '0');
  if (valorStr.indexOf(',') !== -1) {
    valorStr = valorStr.replace(/\./g, '').replace(',', '.');
  }
  var valor = parseFloat(valorStr);
  var nbs         = String(row[COL.NBS - 1] || '').trim() || settings.defaultNbs || '01.01.01.10';
  var competencia = String(row[COL.COMPETENCIA - 1] || '').trim();

  if (!tomadorName) return { ok: false, error: 'Tomador não informado.' };
  if (!documento)   return { ok: false, error: 'CNPJ/CPF não informado.' };
  if (!discriminacao || discriminacao.length < 10)
    return { ok: false, error: 'Discriminação inválida (mín. 10 caracteres).' };
  if (!valor || valor <= 0) return { ok: false, error: 'Valor inválido.' };

  var tipo = documento.length === 14 ? 'PJ' : 'PF';

  var tomador = {
    tipo: tipo,
    documento: documento,
    razao_social: tomadorName,
  };

  var servico = {
    codigo_nbs: nbs,
    discriminacao: discriminacao,
    valor: valor,
    aliquota_iss: parseFloat(settings.defaultAliquota || '2.0'),
  };

  if (!competencia) {
    var now = new Date();
    competencia = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  return {
    ok: true,
    servico: servico,
    tomador: tomador,
    competencia: competencia,
    idempotencyKey: 'sheets-row-' + documento + '-' + competencia,
  };
}

/**
 * Emit NFS-e for a single row, updating the sheet cells in-place.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex  1-based row number.
 * @param {string} apiKey
 * @param {Object} settings
 * @param {Function} [fetchFn]  Override UrlFetchApp.fetch for testing.
 * @returns {string} Status written to the cell.
 */
function emitirLinha(sheet, rowIndex, apiKey, settings, fetchFn) {
  var row = sheet.getRange(rowIndex, 1, 1, COL.PDF_URL).getValues()[0];

  // Skip rows that are already processed.
  var currentStatus = String(row[COL.STATUS - 1] || '').trim().toUpperCase();
  if (currentStatus === STATUS.AUTORIZADA || currentStatus === STATUS.PROCESSANDO) {
    return currentStatus;
  }

  var parsed = parseRow(row, settings);
  if (!parsed.ok) {
    sheet.getRange(rowIndex, COL.STATUS).setValue('ERRO: ' + parsed.error);
    return 'ERRO';
  }

  var result = notameiEmitir(
    apiKey,
    parsed.servico,
    parsed.tomador,
    parsed.competencia,
    parsed.idempotencyKey,
    fetchFn
  );

  if (result.status === 202) {
    sheet.getRange(rowIndex, COL.STATUS).setValue(STATUS.PROCESSANDO);
    sheet.getRange(rowIndex, COL.NOTA_ID).setValue(result.data.nota_id || '');
    return STATUS.PROCESSANDO;
  }

  var errMsg = 'ERRO ' + result.status;
  if (result.data && result.data.message) errMsg += ': ' + result.data.message;
  sheet.getRange(rowIndex, COL.STATUS).setValue(errMsg);
  return 'ERRO';
}

/**
 * Poll all rows with status PROCESSANDO and update their status.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} apiKey
 * @param {Function} [fetchFn]
 */
function atualizarStatusPlanilha(sheet, apiKey, fetchFn) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, COL.PDF_URL).getValues();

  data.forEach(function (row, i) {
    var status  = String(row[COL.STATUS - 1] || '').trim().toUpperCase();
    var notaId  = String(row[COL.NOTA_ID - 1] || '').trim();

    if (status !== STATUS.PROCESSANDO || !notaId) return;

    var result = notameiConsultar(apiKey, notaId, fetchFn);
    if (result.status !== 200) return;

    var detail   = result.data;
    var rowIndex = i + 2;

    sheet.getRange(rowIndex, COL.STATUS).setValue(detail.status || status);

    if (detail.status === STATUS.AUTORIZADA) {
      sheet.getRange(rowIndex, COL.NUMERO_NFSE).setValue(detail.numero_nfse || '');
      var pdfUrl = 'https://api.notameigateway.com.br/v1/nfse/' + notaId + '/pdf';
      sheet.getRange(rowIndex, COL.PDF_URL).setFormula('=HYPERLINK("' + pdfUrl + '","PDF")');
    }
  });
}

// Allow require() in Node.js tests.
if (typeof module !== 'undefined') {
  var _cols = require('./Columns');
  var _api  = require('./Api');
  var COL              = _cols.COL;
  var STATUS           = _cols.STATUS;
  var notameiEmitir    = _api.notameiEmitir;
  var notameiConsultar = _api.notameiConsultar;
  module.exports = { parseRow, emitirLinha, atualizarStatusPlanilha };
}
