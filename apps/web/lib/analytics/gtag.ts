// Inicialização do GA4 com Consent Mode v2.
//
// O snippet padrão do GA4 dispara `page_view` automático, mas precisamos
// configurar o consent ANTES de qualquer chamada — a estratégia oficial
// é injetar o `gtag('consent','default',{...})` síncrono no <head>.
//
// Este arquivo exporta o conteúdo do <Script> que vai dentro do <head>
// no root layout.
//
// Variável de ambiente:
//   NEXT_PUBLIC_GA_MEASUREMENT_ID — formato G-XXXXXXXXXX. Sem isso, o script
//   é no-op (não polui produção quando rodando local sem env configurada).

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
/** ID da conta Google Ads (formato AW-XXXXXXXXX). Quando vazio, helpers
 *  de conversion viram no-op — útil pra dev/staging sem queimar ID real. */
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

/** Script síncrono que precisa rodar antes de qualquer evento.
 *  Configura GA4 + Google Ads no mesmo gtag namespace (`config` aceita N IDs). */
export function gtagInitScript(): string {
  if (!GA_ID && !ADS_ID) return ''

  const configs: string[] = []
  if (GA_ID) {
    configs.push(`gtag('config', '${GA_ID}', { send_page_view: true, anonymize_ip: true });`)
  }
  if (ADS_ID) {
    // allow_enhanced_conversions liga Enhanced Conversions automático no Ads
    // (precisa ser ativado também na UI do Google Ads pra cada conversion action).
    configs.push(`gtag('config', '${ADS_ID}', { allow_enhanced_conversions: true });`)
  }

  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;

    // Consent Mode v2 — começa tudo NEGADO; CookieBanner libera ao aceitar.
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });

    // Se já temos consent salvo (visitas anteriores), libera antes do GA carregar.
    (function() {
      var m = document.cookie.match(/(?:^|;\\s*)nf_consent=(granted|denied)/);
      if (m && m[1] === 'granted') {
        gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted'
        });
      }
    })();

    gtag('js', new Date());
    ${configs.join('\n    ')}
  `.trim()
}

/** URL do gtag.js a injetar como <Script src=...>. Usa GA_ID se disponível,
 *  senão ADS_ID. Os dois compartilham o mesmo namespace global. */
export function gtagSrc(): string | null {
  const id = GA_ID || ADS_ID
  return id ? `https://www.googletagmanager.com/gtag/js?id=${id}` : null
}
