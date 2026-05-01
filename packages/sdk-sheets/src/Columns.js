/**
 * Column index constants (1-based) for the Nota MEI Gateway spreadsheet template.
 *
 * A         B          C             D      E    F           G       H        I              J
 * Tomador | Documento | Discriminação | Valor | NBS | Competência | Status | Nota ID | Número NFS-e | PDF URL
 */
var COL = {
  TOMADOR: 1,
  DOCUMENTO: 2,
  DISCRIMINACAO: 3,
  VALOR: 4,
  NBS: 5,
  COMPETENCIA: 6,
  STATUS: 7,
  NOTA_ID: 8,
  NUMERO_NFSE: 9,
  PDF_URL: 10,
};

var HEADER_ROW = [
  'Tomador / Razão Social',
  'CNPJ ou CPF (só dígitos)',
  'Discriminação do Serviço',
  'Valor (R$)',
  'Código NBS',
  'Competência (AAAA-MM)',
  'Status',
  'Nota ID',
  'Número NFS-e',
  'PDF URL',
];

var STATUS = {
  PENDENTE: 'PENDENTE',
  PROCESSANDO: 'PROCESSANDO',
  AUTORIZADA: 'AUTORIZADA',
  REJEITADA: 'REJEITADA',
  CANCELADA: 'CANCELADA',
  ERRO: 'ERRO',
};

// Allow require() in Node.js tests.
if (typeof module !== 'undefined') {
  module.exports = { COL, HEADER_ROW, STATUS };
}
