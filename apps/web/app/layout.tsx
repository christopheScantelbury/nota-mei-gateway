import type { Metadata, Viewport } from 'next'
import { Outfit, Inter, DM_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

// ── Fonts ──────────────────────────────────────────────────────────────────
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['300', '400', '500'],
})

// ── Metadata ───────────────────────────────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notameigateway.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    template: '%s · Nota MEI Gateway',
  },
  description:
    'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional. Integre em minutos, emita com confiança.',
  keywords: ['NFS-e', 'MEI', 'nota fiscal', 'API', 'Receita Federal', 'emissão automática'],
  authors: [{ name: 'ScantelburyDevs', url: 'https://scantelburydevs.com.br' }],
  creator: 'ScantelburyDevs',
  publisher: 'ScantelburyDevs',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'Nota MEI Gateway',
    title: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    description:
      'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Nota MEI Gateway',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    description:
      'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.',
    images: ['/twitter-image'],
    creator: '@scantelburydevs',
  },
  // icon.tsx + apple-icon.tsx in app/ are auto-detected by Next.js 14
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0A0F1E',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

// ── Root Layout ────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${inter.variable} ${dmMono.variable}`}
    >
      <body className="font-body antialiased">
        {/* Skip-to-main for keyboard / screen-reader users (WCAG 2.1 AA 2.4.1) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-brand-cyan focus:text-navy-900 focus:font-semibold focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
        >
          Ir para o conteúdo principal
        </a>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#142035',
              border: '1px solid #1E3050',
              color: '#EEF4FF',
            },
          }}
        />
      </body>
    </html>
  )
}
