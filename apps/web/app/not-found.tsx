import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0F1E',
        color: '#EEF4FF',
        fontFamily: 'Inter, sans-serif',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '4rem', fontWeight: 800, color: '#00E8FF', margin: 0 }}>
        404
      </h1>
      <p style={{ color: '#8AA0B8', margin: 0 }}>Página não encontrada</p>
      <Link
        href="/"
        style={{
          marginTop: '1rem',
          padding: '0.6rem 1.4rem',
          background: '#00E8FF',
          color: '#0A0F1E',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Voltar ao início
      </Link>
    </div>
  )
}
