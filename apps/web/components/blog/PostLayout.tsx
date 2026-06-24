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

      <article className="pt-24 md:pt-32 pb-12 md:pb-16 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb visível */}
          <nav className="text-sm text-text-2 mb-4 md:mb-6" aria-label="breadcrumb">
            <Link href="/" className="hover:text-text-1">Início</Link>
            {' › '}
            <Link href="/blog" className="hover:text-text-1">Blog</Link>
          </nav>

          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-3 md:mb-4">
            {post.title}
          </h1>
          <p className="text-text-2 text-base md:text-lg leading-relaxed mb-5 md:mb-6">
            {post.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-text-2 mb-8 md:mb-10 pb-5 md:pb-6 border-b border-navy-600">
            <span>{dataPub}</span>
            <span aria-hidden>·</span>
            <span>{post.readTimeMin} min de leitura</span>
            <span aria-hidden>·</span>
            <span>por {post.author}</span>
            <span className="basis-full sm:basis-auto sm:ml-auto flex flex-wrap gap-2 mt-1 sm:mt-0">
              {post.tags.map((t) => (
                <span key={t} className="rounded-full bg-navy-700 border border-navy-600 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {t}
                </span>
              ))}
            </span>
          </div>

          {/* Conteúdo do post — estilos por seletor de descendente (sem plugin typography) */}
          <div className="text-text-1 text-base md:text-[17px] leading-relaxed
                          [&_h2]:font-display [&_h2]:font-extrabold [&_h2]:text-text-1 [&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:mt-10 [&_h2]:md:mt-12 [&_h2]:mb-3 [&_h2]:md:mb-4 [&_h2]:leading-tight
                          [&_h3]:font-display [&_h3]:font-extrabold [&_h3]:text-text-1 [&_h3]:text-lg [&_h3]:sm:text-xl [&_h3]:mt-7 [&_h3]:md:mt-8 [&_h3]:mb-2 [&_h3]:md:mb-3 [&_h3]:leading-tight
                          [&_p]:my-4 [&_p]:md:my-5
                          [&_a]:text-brand-blue [&_a]:no-underline hover:[&_a]:underline [&_a]:break-words
                          [&_strong]:text-text-1 [&_strong]:font-semibold
                          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:sm:pl-6 [&_ul]:my-4 [&_ul]:space-y-1.5
                          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:sm:pl-6 [&_ol]:my-4 [&_ol]:space-y-1.5
                          [&_li]:leading-relaxed
                          [&_blockquote]:border-l-4 [&_blockquote]:border-brand-blue [&_blockquote]:bg-navy-700 [&_blockquote]:rounded-r-xl [&_blockquote]:py-3 [&_blockquote]:px-4 [&_blockquote]:my-6 [&_blockquote]:text-text-1
                          [&_code]:text-brand-blue [&_code]:bg-navy-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.92em]">
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
