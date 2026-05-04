import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notameigateway.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Disallow authenticated dashboard pages — they 302 to /login anyway,
        // but better to be explicit so crawlers don't waste quota.
        disallow: ['/notas', '/billing', '/configuracoes', '/api-keys', '/webhooks', '/templates', '/recorrencias', '/home', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
