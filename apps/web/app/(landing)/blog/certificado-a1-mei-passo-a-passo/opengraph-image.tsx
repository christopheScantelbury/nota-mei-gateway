import { renderPostOG, ogImageSize, ogImageContentType } from '@/lib/blog/og-image'

export const runtime     = 'edge'
export const alt         = 'Certificado digital A1 para MEI — guia passo a passo'
export const size        = ogImageSize
export const contentType = ogImageContentType

export default async function Image() {
  return renderPostOG('certificado-a1-mei-passo-a-passo')
}
