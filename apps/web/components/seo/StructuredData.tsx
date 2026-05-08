// Componentes JSON-LD reutilizáveis (schema.org). Cada um renderiza um
// <script type="application/ld+json"> com markup que o Google usa para
// gerar rich snippets nas SERPs.
// Validador: https://validator.schema.org/
//
// Convenção: todos os componentes são Server Components por padrão.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://emitirnotafacil.com.br'

function jsonLd(data: object) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ── Organization (cobre toda a marca, ideal no layout root) ─────────────────
export function OrgStructuredData() {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NotaFácil',
    legalName: 'ScantelburyDevs',
    url: BASE_URL,
    logo: `${BASE_URL}/brand/notafacil-logo.svg`,
    description:
      'Plataforma de emissão de NFS-e Nacional para MEI, ME e EPP, integrada à Receita Federal.',
    sameAs: [
      'https://scantelburydevs.com.br',
      'https://github.com/christopheScantelbury/nota-mei-gateway',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'suporte@emitirnotafacil.com.br',
        availableLanguage: ['Portuguese'],
      },
    ],
  })
}

// ── SoftwareApplication (uma por landing de produto) ────────────────────────
type SoftwareAppProps = {
  name:        string         // "NotaFácil MEI"
  description: string
  url:         string         // "https://emitirnotafacil.com.br/mei"
  category?:   string         // default: "BusinessApplication"
  priceFromBRL?: number       // ex: 0 para Trial, 29.90 para Starter
}

export function SoftwareAppStructuredData(p: SoftwareAppProps) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: p.name,
    description: p.description,
    url: p.url,
    applicationCategory: p.category ?? 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: p.priceFromBRL ?? 0,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '50',
    },
  })
}

// ── FAQPage (uma por landing com FAQ) ───────────────────────────────────────
type FAQItem = { q: string; a: string }

export function FAQStructuredData({ faqs }: { faqs: FAQItem[] }) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })
}

// ── Product (uma lista por página de planos) ────────────────────────────────
type Plano = {
  nome:        string         // "Starter"
  descricao:   string
  precoBRL:    number
  unidade?:    string         // ex: "/mês"
}

export function PlanosStructuredData({ planos }: { planos: Plano[] }) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: planos.map((plano, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: `NotaFácil ${plano.nome}`,
        description: plano.descricao,
        offers: {
          '@type': 'Offer',
          price: plano.precoBRL,
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          url: `${BASE_URL}/cadastro`,
        },
      },
    })),
  })
}

// ── BreadcrumbList (opcional, usar em páginas profundas como /docs/quickstart) ──
type Crumb = { name: string; url: string }

export function BreadcrumbStructuredData({ crumbs }: { crumbs: Crumb[] }) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  })
}
