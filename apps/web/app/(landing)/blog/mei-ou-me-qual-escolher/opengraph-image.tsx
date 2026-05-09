import { renderPostOG, ogImageSize, ogImageContentType } from '@/lib/blog/og-image'

export const runtime     = 'edge'
export const alt         = 'MEI ou ME — qual escolher para sua empresa em 2026'
export const size        = ogImageSize
export const contentType = ogImageContentType

export default async function Image() {
  return renderPostOG('mei-ou-me-qual-escolher')
}
