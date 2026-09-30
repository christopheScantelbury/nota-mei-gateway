import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Nota MEI Gateway — Emissão de NFS-e para MEI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '72px 80px',
          background: '#0A0F1E',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // Direção explícita: o parser do Satori (next/og) quebra com
            // "Missing comma before color stops" em gradiente sem ângulo.
            backgroundImage:
              'linear-gradient(to bottom, rgba(30,48,80,0.4) 1px, transparent 1px), linear-gradient(to right, rgba(30,48,80,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Cyan glow blob */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -160,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,232,255,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: 300,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,111,255,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Top badge */}
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(0,232,255,0.08)',
            border: '1px solid rgba(0,232,255,0.2)',
            borderRadius: 999,
            padding: '6px 16px',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E8FF' }} />
          <span style={{ color: '#00E8FF', fontSize: 14, fontWeight: 500 }}>
            Receita Federal Nacional · NFS-e
          </span>
        </div>

        {/* Main heading */}
        {/* Satori: todo nó com mais de um filho precisa de display:flex, e
            zIndex não é suportado (a ordem no DOM já põe o texto por cima). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#EEF4FF',
              letterSpacing: '-1px',
              maxWidth: 800,
            }}
          >
            <span>Nota MEI</span>
            <span
              style={{
                backgroundImage: 'linear-gradient(135deg, #00E8FF 0%, #7C6FFF 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Gateway
            </span>
          </div>

          <div style={{ display: 'flex', fontSize: 24, color: '#8AA0B8', maxWidth: 680, lineHeight: 1.5 }}>
            API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.
          </div>

          {/* Metrics row */}
          <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
            {[
              { value: '< 2s', label: 'tempo médio emissão' },
              { value: '99.9%', label: 'uptime SLA' },
              { value: '5 planos', label: 'a partir de grátis' },
            ].map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#EEF4FF' }}>{m.value}</span>
                <span style={{ fontSize: 13, color: '#8AA0B8' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom brand */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, color: '#8AA0B8' }}>by</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#EEF4FF' }}>ScantelburyDevs</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
