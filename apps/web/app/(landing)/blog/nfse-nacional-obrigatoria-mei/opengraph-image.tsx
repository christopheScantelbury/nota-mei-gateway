import { renderPostOG, ogImageSize, ogImageContentType } from '@/lib/blog/og-image'

export const runtime     = 'edge'
export const alt         = 'NFS-e Nacional obrigatória para MEI — guia 2026'
export const size        = ogImageSize
export const contentType = ogImageContentType

export default async function Image() {
  return renderPostOG('nfse-nacional-obrigatoria-mei')
}
