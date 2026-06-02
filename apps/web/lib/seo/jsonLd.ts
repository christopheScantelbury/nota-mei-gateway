// Helpers de JSON-LD para SEO.
//
// Spec: HIST-5.2.

const ORG_NAME    = 'NotaFácil'
const ORG_URL     = 'https://emitirnotafacil.com.br'
const ORG_LOGO    = 'https://emitirnotafacil.com.br/brand/notafacil-logo.png'
const PUBLISHER   = 'ScantelburyDevs'
const PUBLISHER_URL = 'https://scantelburydevs.com.br'

interface BlogArticleInput {
  title: string
  description: string
  slug: string
  date: string
  updated?: string
  author?: string
  coverImage?: string
  tags?: string[]
}

/** Schema.org Article para posts do blog. */
export function articleJsonLd(post: BlogArticleInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: {
      '@type': 'Organization',
      name: post.author ?? PUBLISHER,
      url: PUBLISHER_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${ORG_URL}/blog/${post.slug}`,
    },
    image: post.coverImage ? `${ORG_URL}${post.coverImage}` : undefined,
    keywords: post.tags?.join(', '),
  }
}

/** Schema.org WebPage genérico com mainEntity FAQPage opcional. */
export function webPageJsonLd(input: {
  name: string
  description: string
  url: string
  faq?: Array<{ q: string; a: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: input.url,
    about: {
      '@type': 'Product',
      name: ORG_NAME,
      brand: { '@type': 'Brand', name: PUBLISHER },
    },
    mainEntity: input.faq ? {
      '@type': 'FAQPage',
      mainEntity: input.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    } : undefined,
  }
}
