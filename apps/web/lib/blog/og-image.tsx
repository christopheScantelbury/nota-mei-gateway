import { ImageResponse } from 'next/og'
import { getPost } from './manifest'

// Helper compartilhado para gerar OG image (1200×630) de cada post.
// Cada post chama renderPostOG(slug) no seu opengraph-image.tsx.
// Edge runtime para gerar no momento do request — Vercel cacheia.

export const ogImageSize = { width: 1200, height: 630 }
export const ogImageContentType = 'image/png'

export async function renderPostOG(slug: string) {
  const post = getPost(slug)
  const title = post?.title ?? 'NotaFácil Blog'
  const meta  = post
    ? `${post.readTimeMin} min de leitura · ${new Date(post.publishedAt).toLocaleDateString('pt-BR')}`
    : 'Guias práticos sobre NFS-e, MEI e ME'

  return new ImageResponse(
    (
      <div
        style={{
          width:   '100%',
          height:  '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#F8FAFC',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#3B82F6', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: 'white',
          }}>N</div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            Nota<span style={{ color: '#60A5FA' }}>Fácil</span>
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 18,
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: 4,
          }}>
            Blog
          </span>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <h1 style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -2,
            margin: 0,
            maxWidth: 1000,
          }}>
            {title}
          </h1>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 22,
          color: '#94A3B8',
        }}>
          <span>{meta}</span>
          <span style={{ color: '#3B82F6', fontWeight: 600 }}>
            emitirnotafacil.com.br
          </span>
        </div>
      </div>
    ),
    { ...ogImageSize },
  )
}
