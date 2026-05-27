import EmitirPublicoClient from './EmitirPublicoClient'

export const metadata = {
  title: 'Emitir nota',
  robots: { index: false, follow: false }, // links secretos não devem ser indexados
}

export default function EmitirPublicoPage({ params }: { params: { token: string } }) {
  return <EmitirPublicoClient token={params.token} />
}
