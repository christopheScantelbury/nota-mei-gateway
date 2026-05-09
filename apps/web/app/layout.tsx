import type { Metadata, Viewport } from 'next'
import { Outfit, Inter, DM_Sans, DM_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { OrgStructuredData } from '@/components/seo/StructuredData'
import PWAProvider from '@/components/pwa/PWAProvider'
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

// DM Sans — nova tipografia oficial (brand-kit v2.0)
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['300', '400', '500'],
})

// ── Metadata ───────────────────────────────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://emitirnotafacil.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    // Sem template global: cada layout aninhado (dashboard, admin) define o
    // próprio template com o nome do produto correto. Um template no root
    // seria aplicado sobre o `default` do dashboard para páginas sem título
    // próprio (Client Components), resultando em sufixo duplo como
    // "Painel — Nota Fácil MEI · Nota MEI Gateway".
    template: '%s',
  },
  description:
    'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional. Integre em minutos, emita com confiança.',
  keywords: ['NFS-e', 'MEI', 'nota fiscal', 'API', 'Receita Federal', 'emissão automática'],
  authors: [{ name: 'ScantelburyDevs', url: 'https://scantelburydevs.com.br' }],
  creator: 'ScantelburyDevs',
  publisher: 'ScantelburyDevs',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // ── Favicon & ícones ──────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16px.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32px.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-72px.png', sizes: '72x72', type: 'image/png' },
      { url: '/favicon-96px.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-256px.png', sizes: '256x256', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/favicon-120px.png', sizes: '120x120', type: 'image/png' },
      { url: '/favicon-152px.png', sizes: '152x152', type: 'image/png' },
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'Nota MEI Gateway',
    title: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    description: 'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.',
    images: [{ url: '/og/og-gateway-1200x630.png', width: 1200, height: 630, alt: 'Nota MEI Gateway' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
    description: 'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.',
    images: ['/og/og-gateway-1200x630.png'],
    site:    '@scantelburydevs',
    creator: '@scantelburydevs',
  },
  manifest: '/manifest.json',
  // PWA / iOS Safari — meta tags para o "Adicionar à Tela de Início"
  appleWebApp: {
    capable:    true,
    title:      'NotaFácil',
    statusBarStyle: 'default',
  },
  // Verificação Google Search Console (e Bing). Configure as envs no Vercel:
  //   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<código do GSC>
  //   NEXT_PUBLIC_BING_SITE_VERIFICATION=<código do Bing>
  // Sem env, o campo simplesmente não é renderizado.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '',
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // themeColor adapts per scheme — browsers use the matching entry
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)',  color: '#0F172A' },
  ],
}

// ── Root Layout ────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      // suppressHydrationWarning evita mismatch entre SSR (sem classe) e
      // client (next-themes adiciona "light" ou "dark" antes de pintar)
      suppressHydrationWarning
      className={`${outfit.variable} ${inter.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        <OrgStructuredData />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          {/* Skip-to-main para teclado / leitores de tela (WCAG 2.1 AA 2.4.1) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-brand-cyan focus:text-navy-900 focus:font-semibold focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
          >
            Ir para o conteúdo principal
          </a>

          {children}

          <PWAProvider />

          <Toaster
            theme="system"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-navy-700 border border-navy-600 text-text-1 font-body text-sm',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
