'use strict';

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem('✅ Emitir notas selecionadas', 'emitirNotasSelecionadas')
    .addItem('🔄 Atualizar status (PROCESSANDO)', 'atualizarStatus')
    .addSeparator()
    .addItem('📋 Inserir template de colunas', 'inserirTemplate')
    .addSeparator()
    .addItem('⚙️ Configurações', 'abrirConfiguracoes')
    .addToUi();
}

function onHomepage() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Nota MEI Gateway'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(
          'Emita NFS-e diretamente da planilha. ' +
          'Abra uma planilha e use o menu Extensões → Nota MEI Gateway.'
        ))
    )
    .build();
}

function onFileScopeGranted() {
  onOpen();
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function emitirNotasSelecionadas() {
  var apiKey = getApiKey_();
  if (!apiKey) { showError_('Configure a API Key em ⚙️ Configurações.'); return; }

  var sheet    = SpreadsheetApp.getActiveSheet();
  var settings = getSettings_();
  var selection = sheet.getActiveRange();

  var startRow = Math.max(selection.getRow(), 2); // Skip header row.
  var endRow   = Math.max(selection.getLastRow(), startRow);

  var emitidas = 0;
  var erros    = 0;

  for (var r = startRow; r <= endRow; r++) {
    var result = emitirLinha(sheet, r, apiKey, settings);
    if (result === STATUS.PROCESSANDO) emitidas++;
    else if (String(result).startsWith('ERRO')) erros++;
  }

  SpreadsheetApp.getUi().alert(
    '✅ Emissão concluída',
    emitidas + ' nota(s) enviadas para processamento.' +
    (erros ? '\n⚠️ ' + erros + ' linha(s) com erro — verifique a coluna Status.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function atualizarStatus() {
  var apiKey = getApiKey_();
  if (!apiKey) { showError_('Configure a API Key em ⚙️ Configurações.'); return; }

  var sheet = SpreadsheetApp.getActiveSheet();
  atualizarStatusPlanilha(sheet, apiKey);
  SpreadsheetApp.getActive().toast('Status atualizado.', 'Nota MEI Gateway');
}

function inserirTemplate() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ui    = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Inserir template',
    'Isso irá inserir o cabeçalho na linha 1 e formatar a planilha. Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Header row.
  var headerRange = sheet.getRange(1, 1, 1, HEADER_ROW.length);
  headerRange.setValues([HEADER_ROW]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0A0F1E');
  headerRange.setFontColor('#00E8FF');

  // Set column widths.
  sheet.setColumnWidth(COL.TOMADOR, 180);
  sheet.setColumnWidth(COL.DOCUMENTO, 140);
  sheet.setColumnWidth(COL.DISCRIMINACAO, 240);
  sheet.setColumnWidth(COL.VALOR, 90);
  sheet.setColumnWidth(COL.NBS, 110);
  sheet.setColumnWidth(COL.COMPETENCIA, 110);
  sheet.setColumnWidth(COL.STATUS, 120);
  sheet.setColumnWidth(COL.NOTA_ID, 220);
  sheet.setColumnWidth(COL.NUMERO_NFSE, 110);
  sheet.setColumnWidth(COL.PDF_URL, 80);

  // Insert one example row.
  sheet.getRange(2, COL.TOMADOR).setValue('Empresa Exemplo LTDA');
  sheet.getRange(2, COL.DOCUMENTO).setValue('12345678000190');
  sheet.getRange(2, COL.DISCRIMINACAO).setValue('Desenvolvimento de software conforme contrato');
  sheet.getRange(2, COL.VALOR).setValue(3500);
  sheet.getRange(2, COL.NBS).setValue('01.01.01.10');
  sheet.getRange(2, COL.COMPETENCIA).setValue(
    Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM')
  );

  sheet.setFrozenRows(1);
  SpreadsheetApp.getActive().toast('Template inserido na linha 1.', 'Nota MEI Gateway');
}

function abrirConfiguracoes() {
  var html = HtmlService.createHtmlOutputFromFile('src/Sidebar')
    .setTitle('Nota MEI — Configurações')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

// ─── Polling trigger (time-based) ────────────────────────────────────────────

/**
 * Create a time-based trigger that polls PROCESSANDO notes every 2 minutes.
 * Called from the sidebar when the user enables automatic polling.
 */
function ativarPollingAutomatico() {
  deletarPollingAutomatico();
  ScriptApp.newTrigger('atualizarStatus')
    .timeBased()
    .everyMinutes(2)
    .create();
}

function deletarPollingAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'atualizarStatus') {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function pollingAtivo() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'atualizarStatus';
  });
}

// ─── Settings (sidebar bridge) ───────────────────────────────────────────────

function getSettingsForSidebar() {
  var props = PropertiesService.getUserProperties();
  return {
    apiKey: props.getProperty('notamei_api_key') || '',
    defaultNbs: props.getProperty('notamei_default_nbs') || '01.01.01.10',
    defaultAliquota: props.getProperty('notamei_default_aliquota') || '2.0',
    pollingAtivo: pollingAtivo(),
  };
}

function salvarConfiguracoes(form) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('notamei_api_key', form.apiKey || '');
  props.setProperty('notamei_default_nbs', form.defaultNbs || '01.01.01.10');
  props.setProperty('notamei_default_aliquota', form.defaultAliquota || '2.0');

  if (form.pollingAtivo) {
    ativarPollingAutomatico();
  } else {
    deletarPollingAutomatico();
  }
  return { ok: true };
}

function testarConexao() {
  var apiKey = getApiKey_();
  if (!apiKey) return { ok: false, message: 'API Key não configurada.' };

  var result = notameiConsultar(apiKey, 'health-check-id');
  // 404 = API reached + authenticated; 401 = bad key.
  if (result.status === 404) return { ok: true, message: 'Conexão OK.' };
  if (result.status === 401) return { ok: false, message: 'API Key inválida.' };
  return { ok: false, message: 'Erro ' + result.status + ': ' + JSON.stringify(result.data) };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function getApiKey_() {
  return PropertiesService.getUserProperties().getProperty('notamei_api_key') || '';
}

function getSettings_() {
  var props = PropertiesService.getUserProperties();
  return {
    defaultNbs: props.getProperty('notamei_default_nbs') || '01.01.01.10',
    defaultAliquota: props.getProperty('notamei_default_aliquota') || '2.0',
  };
}

function showError_(msg) {
  SpreadsheetApp.getUi().alert('Nota MEI Gateway', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
