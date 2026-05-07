import withBundleAnalyzer from '@next/bundle-analyzer'

const analyze = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      // Produto aliases — SEO
      { source: '/microempresa',      destination: '/me',       permanent: true },
      { source: '/epp',               destination: '/me',       permanent: true },
      { source: '/simples-nacional',  destination: '/me',       permanent: true },
      { source: '/desenvolvedor',     destination: '/gateway',  permanent: true },
      { source: '/developer',         destination: '/gateway',  permanent: true },
      // Auth aliases
      { source: '/entrar',            destination: '/login',    permanent: true },
      { source: '/registrar',         destination: '/cadastro', permanent: true },
      // Cadastro aliases (manter compatibilidade com links antigos)
      { source: '/mei/cadastro',      destination: '/cadastro?produto=mei', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Ensure Recharts (a large dep) is only in client bundles
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'framer-motion'],
  },
}

export default analyze(nextConfig)
