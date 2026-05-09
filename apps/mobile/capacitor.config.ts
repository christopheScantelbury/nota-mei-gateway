import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:    'com.scantelburydevs.notafacil',
  appName:  'NotaFácil',
  webDir:   'www',
  bundledWebRuntime: false,

  // Em DEV: serve o Next.js já rodando em localhost ao invés do build estático
  // Útil pra dev rápido sem rebuild a cada mudança.
  // Comentar antes de gerar o .aab/.ipa de produção.
  // server: {
  //   url:                 'http://10.0.2.2:3000',  // Android emulator → host
  //   cleartext:           true,
  //   androidScheme:       'https',
  //   allowNavigation:     ['emitirnotafacil.com.br', '*.emitirnotafacil.com.br'],
  // },

  plugins: {
    SplashScreen: {
      launchShowDuration:    1500,
      launchAutoHide:        true,
      backgroundColor:       '#F8FAFC',
      androidSplashResourceName: 'splash',
      androidScaleType:      'CENTER_CROP',
      showSpinner:           false,
    },
    StatusBar: {
      style:           'DEFAULT',
      backgroundColor: '#F8FAFC',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  android: {
    allowMixedContent: false,
    captureInput:      true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    contentInset:        'automatic',
    limitsNavigationsToAppBoundDomains: true,
  },
}

export default config
