'use strict';

const { COL, STATUS } = require('../src/Columns');
const { parseRow, emitirLinha, atualizarStatusPlanilha } = require('../src/Emissao');

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRow(overrides) {
  const defaults = [
    'Empresa Teste LTDA',   // 1 TOMADOR
    '12345678000190',       // 2 DOCUMENTO
    'Desenvolvimento de software conforme contrato',  // 3 DISCRIMINACAO
    '3500',                 // 4 VALOR
    '01.01.01.10',          // 5 NBS
    '2026-04',              // 6 COMPETENCIA
    '',                     // 7 STATUS
    '',                     // 8 NOTA_ID
    '',                     // 9 NUMERO_NFSE
    '',                     // 10 PDF_URL
  ];
  const row = [...defaults];
  Object.entries(overrides || {}).forEach(([col, val]) => {
    row[Number(col) - 1] = val;
  });
  return row;
}

const defaultSettings = { defaultNbs: '01.01.01.10', defaultAliquota: '2.0' };

// ─── parseRow ────────────────────────────────────────────────────────────────

describe('parseRow', () => {
  test('parses a valid PJ row', () => {
    const result = parseRow(makeRow(), defaultSettings);
    expect(result.ok).toBe(true);
    expect(result.tomador.tipo).toBe('PJ');
    expect(result.tomador.documento).toBe('12345678000190');
    expect(result.tomador.razao_social).toBe('Empresa Teste LTDA');
    expect(result.servico.valor).toBe(3500);
    expect(result.servico.codigo_nbs).toBe('01.01.01.10');
    expect(result.servico.aliquota_iss).toBe(2.0);
    expect(result.competencia).toBe('2026-04');
    expect(result.idempotencyKey).toBe('sheets-row-12345678000190-2026-04');
  });

  test('parses a valid PF row (CPF = 11 digits)', () => {
    const result = parseRow(makeRow({ [COL.DOCUMENTO]: '12345678901' }), defaultSettings);
    expect(result.ok).toBe(true);
    expect(result.tomador.tipo).toBe('PF');
    expect(result.tomador.documento).toBe('12345678901');
  });

  test('strips non-digit characters from documento', () => {
    const result = parseRow(makeRow({ [COL.DOCUMENTO]: '12.345.678/0001-90' }), defaultSettings);
    expect(result.ok).toBe(true);
    expect(result.tomador.documento).toBe('12345678000190');
  });

  test('uses settings.defaultNbs when NBS column is empty', () => {
    const result = parseRow(makeRow({ [COL.NBS]: '' }), { defaultNbs: '07.02.00.00', defaultAliquota: '5.0' });
    expect(result.ok).toBe(true);
    expect(result.servico.codigo_nbs).toBe('07.02.00.00');
  });

  test('uses settings.defaultAliquota', () => {
    const result = parseRow(makeRow(), { defaultNbs: '01.01.01.10', defaultAliquota: '5.0' });
    expect(result.ok).toBe(true);
    expect(result.servico.aliquota_iss).toBe(5.0);
  });

  test('generates current competencia when column is empty', () => {
    const result = parseRow(makeRow({ [COL.COMPETENCIA]: '' }), defaultSettings);
    expect(result.ok).toBe(true);
    expect(result.competencia).toMatch(/^\d{4}-\d{2}$/);
  });

  test('fails when tomador is missing', () => {
    const result = parseRow(makeRow({ [COL.TOMADOR]: '' }), defaultSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Tomador/);
  });

  test('fails when documento is missing', () => {
    const result = parseRow(makeRow({ [COL.DOCUMENTO]: '' }), defaultSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CNPJ/);
  });

  test('fails when discriminacao is too short', () => {
    const result = parseRow(makeRow({ [COL.DISCRIMINACAO]: 'Curto' }), defaultSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Discriminação/);
  });

  test('fails when valor is zero', () => {
    const result = parseRow(makeRow({ [COL.VALOR]: '0' }), defaultSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Valor/);
  });

  test('fails when valor is negative', () => {
    const result = parseRow(makeRow({ [COL.VALOR]: '-100' }), defaultSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Valor/);
  });

  test('parses valor with comma as decimal separator', () => {
    const result = parseRow(makeRow({ [COL.VALOR]: '1.500,75' }), defaultSettings);
    expect(result.ok).toBe(true);
    expect(result.servico.valor).toBe(1500.75);
  });
});

// ─── emitirLinha ─────────────────────────────────────────────────────────────

function makeSheet(rowValues, statusCol) {
  const cells = {};
  const sheet = {
    getRange: jest.fn((row, col, nRows, nCols) => {
      if (nRows === 1 && nCols === COL.PDF_URL) {
        return { getValues: () => [rowValues] };
      }
      return {
        setValue: jest.fn((val) => { cells[`${row},${col}`] = val; }),
        setFormula: jest.fn((val) => { cells[`${row},${col}_formula`] = val; }),
        getValue: () => cells[`${row},${col}`],
      };
    }),
    _cells: cells,
  };
  return sheet;
}

describe('emitirLinha', () => {
  const API_KEY = 'sk_test_x';

  test('emits and writes PROCESSANDO + nota_id on 202', () => {
    const row = makeRow();
    const sheet = makeSheet(row);
    const fetch = jest.fn().mockReturnValue({
      getResponseCode: () => 202,
      getContentText: () => JSON.stringify({ nota_id: 'nota-uuid', status: 'PROCESSANDO' }),
    });

    const result = emitirLinha(sheet, 2, API_KEY, defaultSettings, fetch);

    expect(result).toBe(STATUS.PROCESSANDO);
    expect(fetch).toHaveBeenCalledTimes(1);
    const statusCall = sheet.getRange.mock.calls.find(c => c[0] === 2 && c[1] === COL.STATUS);
    expect(statusCall).toBeDefined();
  });

  test('skips row already AUTORIZADA', () => {
    const row = makeRow({ [COL.STATUS]: 'AUTORIZADA' });
    const sheet = makeSheet(row);
    const fetch = jest.fn();

    const result = emitirLinha(sheet, 2, API_KEY, defaultSettings, fetch);

    expect(result).toBe(STATUS.AUTORIZADA);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('skips row already PROCESSANDO', () => {
    const row = makeRow({ [COL.STATUS]: 'PROCESSANDO' });
    const sheet = makeSheet(row);
    const fetch = jest.fn();

    const result = emitirLinha(sheet, 2, API_KEY, defaultSettings, fetch);

    expect(result).toBe(STATUS.PROCESSANDO);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('writes ERRO on parse failure', () => {
    const row = makeRow({ [COL.TOMADOR]: '' });
    const sheet = makeSheet(row);
    const fetch = jest.fn();

    const result = emitirLinha(sheet, 2, API_KEY, defaultSettings, fetch);

    expect(result).toBe('ERRO');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('writes ERRO on API error', () => {
    const row = makeRow();
    const sheet = makeSheet(row);
    const fetch = jest.fn().mockReturnValue({
      getResponseCode: () => 422,
      getContentText: () => JSON.stringify({ message: 'Invalid NBS' }),
    });

    const result = emitirLinha(sheet, 2, API_KEY, defaultSettings, fetch);

    expect(result).toBe('ERRO');
  });
});

// ─── atualizarStatusPlanilha ──────────────────────────────────────────────────

describe('atualizarStatusPlanilha', () => {
  const API_KEY = 'sk_test_x';

  function makeSheetWithData(rows) {
    const cells = {};
    const sheet = {
      getLastRow: () => rows.length + 1,
      getRange: jest.fn((row, col, nRows, nCols) => {
        if (row === 2 && nRows === rows.length && nCols === COL.PDF_URL) {
          return { getValues: () => rows };
        }
        return {
          setValue: jest.fn((val) => { cells[`${row},${col}`] = val; }),
          setFormula: jest.fn((val) => { cells[`${row},${col}_formula`] = val; }),
        };
      }),
      _cells: cells,
    };
    return sheet;
  }

  test('updates PROCESSANDO rows when API returns AUTORIZADA', () => {
    const rows = [makeRow({ [COL.STATUS]: 'PROCESSANDO', [COL.NOTA_ID]: 'nota-1' })];
    const sheet = makeSheetWithData(rows);
    const fetch = jest.fn().mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        id: 'nota-1',
        status: 'AUTORIZADA',
        numero_nfse: '000042',
      }),
    });

    atualizarStatusPlanilha(sheet, API_KEY, fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/v1/nfse/nota-1');
  });

  test('skips rows not in PROCESSANDO status', () => {
    const rows = [makeRow({ [COL.STATUS]: 'AUTORIZADA', [COL.NOTA_ID]: 'nota-1' })];
    const sheet = makeSheetWithData(rows);
    const fetch = jest.fn();

    atualizarStatusPlanilha(sheet, API_KEY, fetch);

    expect(fetch).not.toHaveBeenCalled();
  });

  test('skips rows with empty nota_id', () => {
    const rows = [makeRow({ [COL.STATUS]: 'PROCESSANDO', [COL.NOTA_ID]: '' })];
    const sheet = makeSheetWithData(rows);
    const fetch = jest.fn();

    atualizarStatusPlanilha(sheet, API_KEY, fetch);

    expect(fetch).not.toHaveBeenCalled();
  });

  test('skips update when API returns non-200', () => {
    const rows = [makeRow({ [COL.STATUS]: 'PROCESSANDO', [COL.NOTA_ID]: 'nota-1' })];
    const sheet = makeSheetWithData(rows);
    const fetch = jest.fn().mockReturnValue({
      getResponseCode: () => 500,
      getContentText: () => JSON.stringify({ error: 'server error' }),
    });

    atualizarStatusPlanilha(sheet, API_KEY, fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('returns early when sheet has no data rows', () => {
    const sheet = { getLastRow: () => 1 };
    const fetch = jest.fn();

    atualizarStatusPlanilha(sheet, API_KEY, fetch);

    expect(fetch).not.toHaveBeenCalled();
  });
});
