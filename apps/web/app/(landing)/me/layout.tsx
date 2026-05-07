import type { Metadata } from 'next'
import { StructuredDataME } from '@/components/StructuredDataME'

export const metadata: Metadata = {
  title: 'NFS-e para Microempresa (ME) | emitirnotafacil.com.br',
  description:
    'Emita notas fiscais de serviço para ME e EPP pelo padrão nacional NFS-e. ' +
    'Simples Nacional e Lucro Presumido. Obrigatório a partir de setembro/2026.',
  keywords: [
    'NFS-e microempresa',
    'nota fiscal ME',
    'emitir nota fiscal simples nacional',
    'NFS-e EPP',
    'nota fiscal serviço ME',
    'obrigatoriedade NFS-e 2026',
    'CNPJ ME nota fiscal',
  ],
  openGraph: {
    title: 'NFS-e para ME e EPP — Obrigatório em Set/2026',
    description:
      'Plataforma completa para emissão de NFS-e por Microempresas. ' +
      'Simples Nacional e Lucro Presumido. Qualquer município do Brasil.',
    url: 'https://emitirnotafacil.com.br/me',
    siteName: 'emitirnotafacil.com.br',
    locale: 'pt_BR',
    type: 'website',
  },
  alternates: {
    canonical: 'https://emitirnotafacil.com.br/me',
  },
}

export default function MELayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredDataME />
      {children}
    </>
  )
}
