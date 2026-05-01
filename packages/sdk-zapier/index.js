'use strict';

const { version } = require('./package.json');
const { version: platformVersion } = require('zapier-platform-core');

const authentication = require('./authentication');
const EmitirNota = require('./creates/emitir_nota');
const CancelarNota = require('./creates/cancelar_nota');
const ConsultarNota = require('./searches/consultar_nota');
const NfseAutorizada = require('./triggers/nfse_autorizada');
const NfseRejeitada = require('./triggers/nfse_rejeitada');

module.exports = {
  version,
  platformVersion,
  authentication,
  creates: {
    [EmitirNota.key]: EmitirNota,
    [CancelarNota.key]: CancelarNota,
  },
  searches: {
    [ConsultarNota.key]: ConsultarNota,
  },
  triggers: {
    [NfseAutorizada.key]: NfseAutorizada,
    [NfseRejeitada.key]: NfseRejeitada,
  },
};
