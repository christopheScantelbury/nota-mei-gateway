import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Nota MEI Gateway'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0F1E',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
          gap: 24,
        }}
      >
        {/* Glow effects */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,232,255,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Hexagon logo placeholder */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #00E8FF20, #7C6FFF20)',
            border: '2px solid rgba(0,232,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 36, color: '#00E8FF', fontWeight: 800 }}>N</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#EEF4FF',
            textAlign: 'center',
            letterSpacing: '-1px',
          }}
        >
          Nota MEI{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #00E8FF 0%, #7C6FFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Gateway
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: '#8AA0B8',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          Emissão automatizada de NFS-e para MEI via Receita Federal Nacional
        </div>

        {/* Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,232,255,0.08)',
            border: '1px solid rgba(0,232,255,0.2)',
            borderRadius: 999,
            padding: '8px 20px',
            marginTop: 8,
          }}
        >
          <span style={{ color: '#00E8FF', fontSize: 15, fontWeight: 500 }}>
            emitirnotafacil.com.br
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
