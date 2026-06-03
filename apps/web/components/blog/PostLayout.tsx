import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import { BreadcrumbStructuredData } from '@/components/seo/StructuredData'
import { getPost, getRelatedPosts, type BlogPost } from '@/lib/blog/manifest'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://emitirnotafacil.com.br'

function ArticleStructuredData({ post }: { post: BlogPost }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          author:    { '@type': 'Organization', name: post.author, url: 'https://scantelburydevs.com.br' },
          publisher: { '@type': 'Organization', name: 'NotaFácil', logo: { '@type': 'ImageObject', url: `${BASE_URL}/brand/notafacil-logo.svg` } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${post.slug}` },
          keywords: post.tags.join(', '),
        }),
      }}
    />
  )
}

export default function PostLayout({
  slug,
  children,
}: {
  slug:     string
  children: React.ReactNode
}) {
  const post = getPost(slug)
  if (!post) return null

  const related = getRelatedPosts(slug)
  const dataPub = new Date(post.publishedAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <ArticleStructuredData post={post} />
      <BreadcrumbStructuredData
        crumbs={[
          { name: 'Início', url: BASE_URL },
          { name: 'Blog',   url: `${BASE_URL}/blog` },
          { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
        ]}
      />
      <Navbar />

      <article className="pt-32 pb-16 px-4">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb visível */}
          <nav className="text-sm text-text-2 mb-6" aria-label="breadcrumb">
            <Link href="/" className="hover:text-text-1">Início</Link>
            {' › '}
            <Link href="/blog" className="hover:text-text-1">Blog</Link>
          </nav>

          <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-text-2 text-lg leading-relaxed mb-6">
            {post.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-2 mb-10 pb-6 border-b border-navy-600">
            <span>{dataPub}</span>
            <span>·</span>
            <span>{post.readTimeMin} min de leitura</span>
            <span>·</span>
            <span>por {post.author}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span key={t} className="rounded-full bg-navy-700 border border-navy-600 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {t}
                </span>
              ))}
            </span>
          </div>

          {/* Conteúdo do post */}
          <div className="prose prose-invert max-w-none
                          prose-headings:font-display prose-headings:font-extrabold
                          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                          prose-h3:text-xl  prose-h3:mt-8  prose-h3:mb-3
                          prose-p:text-text-1 prose-p:leading-relaxed
                          prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline
                          prose-strong:text-text-1
                          prose-ul:text-text-1 prose-li:my-1
                          prose-blockquote:border-l-brand-blue prose-blockquote:bg-navy-700 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic
                          prose-code:text-brand-blue prose-code:bg-navy-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-['']">
            {children}
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="border-t border-navy-600 py-16 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-xl font-extrabold mb-6">Continue lendo</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="block rounded-2xl border border-navy-600 bg-navy-700 p-5 hover:border-brand-blue/40 transition-colors"
                >
                  <h3 className="font-display font-bold text-text-1 mb-2">{p.title}</h3>
                  <p className="text-text-2 text-sm leading-snug">{p.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <LandingFooter />
    </main>
  )
}
