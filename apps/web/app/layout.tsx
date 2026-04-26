import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nota MEI Gateway',
  description: 'Emissão automatizada de NFS-e para MEI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
