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

/** Script síncrono que precisa rodar antes de qualquer evento. */
export function gtagInitScript(): string {
  if (!GA_ID) return ''
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
        gtag('consent', 'update', { analytics_storage: 'granted' });
      }
    })();

    gtag('js', new Date());
    gtag('config', '${GA_ID}', {
      send_page_view: true,
      anonymize_ip: true
    });
  `.trim()
}
