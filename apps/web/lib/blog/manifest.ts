// Manifesto de posts do blog. Adicionar um novo post:
//   1. Cria o arquivo `app/(landing)/blog/<slug>/page.tsx`
//   2. Adiciona aqui um item com slug + metadata
//   3. Sitemap e listagem do /blog atualizam automaticamente

export type BlogPost = {
  slug:        string
  title:       string
  description: string         // <= 160 chars (meta description)
  publishedAt: string         // ISO date
  updatedAt?:  string         // ISO date (opcional)
  author:      string
  tags:        string[]       // para internal linking + filtros futuros
  readTimeMin: number
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug:        'nfse-nacional-obrigatoria-mei',
    title:       'NFS-e Nacional obrigatória para MEI — o que muda em 2026',
    description: 'Receita Federal exige NFS-e do padrão nacional para MEI prestador de serviço. Veja prazos, como aderir e quem precisa.',
    publishedAt: '2026-05-08',
    author:      'ScantelburyDevs',
    tags:        ['mei', 'nfs-e', 'receita-federal', 'obrigatoriedade'],
    readTimeMin: 5,
  },
  {
    slug:        'certificado-a1-mei-passo-a-passo',
    title:       'Certificado digital A1 para MEI — guia passo a passo (2026)',
    description: 'O que é o certificado A1, onde comprar (Certisign, Serasa) ou como emitir gratuitamente, e como instalar para emitir notas.',
    publishedAt: '2026-05-08',
    author:      'ScantelburyDevs',
    tags:        ['mei', 'certificado-a1', 'tutorial'],
    readTimeMin: 6,
  },
  {
    slug:        'mei-ou-me-qual-escolher',
    title:       'MEI ou ME: qual escolher para sua empresa em 2026?',
    description: 'Comparativo completo entre MEI e Microempresa: limites, impostos, atividades permitidas e quando vale migrar.',
    publishedAt: '2026-05-08',
    author:      'ScantelburyDevs',
    tags:        ['mei', 'me', 'enquadramento', 'comparativo'],
    readTimeMin: 7,
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

export function getRelatedPosts(slug: string, limit = 2): BlogPost[] {
  const current = getPost(slug)
  if (!current) return []
  return BLOG_POSTS
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      post: p,
      score: p.tags.filter((t) => current.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post)
}
