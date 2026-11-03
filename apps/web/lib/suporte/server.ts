// Helpers server-side do suporte (usar só em Route Handlers / Server Components).

import type { SupabaseClient } from '@supabase/supabase-js'
import { ANEXOS_BUCKET, type SupportMessage } from './types'

const TIPOS_IMAGEM: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_ANEXO_BYTES = 3 * 1024 * 1024

/** Lista mensagens do chamado; o cliente nunca recebe notas internas. */
export async function carregarMensagens(
  admin: SupabaseClient,
  ticketId: string,
  opts: { incluirInterno: boolean },
): Promise<SupportMessage[]> {
  let q = admin
    .from('support_messages')
    .select('id, ticket_id, autor, autor_user_id, conteudo, anexo_path, metadata, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (!opts.incluirInterno) q = q.neq('autor', 'interno')
  const { data } = await q.returns<SupportMessage[]>()
  const msgs = data ?? []

  const paths = msgs.map((m) => m.anexo_path).filter((p): p is string => Boolean(p))
  if (paths.length) {
    const { data: signed } = await admin.storage.from(ANEXOS_BUCKET).createSignedUrls(paths, 60 * 60)
    const porPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const m of msgs) m.anexo_url = m.anexo_path ? porPath.get(m.anexo_path) ?? null : null
  }
  return msgs
}

/** Versão do cliente: sem metadata (tokens, ferramentas). */
export function paraCliente(msgs: SupportMessage[]) {
  return msgs.map(({ id, autor, conteudo, anexo_url, created_at }) => ({ id, autor, conteudo, anexo_url: anexo_url ?? null, created_at }))
}

/** Sobe um print (data URL) para o bucket privado. Retorna o path ou um erro legível. */
export async function subirAnexo(
  admin: SupabaseClient,
  userId: string,
  ticketId: string,
  dataUrl: string,
): Promise<{ path: string } | { erro: string }> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  if (!m) return { erro: 'Formato de imagem não suportado (use JPG, PNG ou WebP).' }
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.byteLength > MAX_ANEXO_BYTES) return { erro: 'Imagem muito grande (máximo 3 MB).' }

  const path = `${userId}/${ticketId}/${Date.now()}.${TIPOS_IMAGEM[m[1]]}`
  const { error } = await admin.storage.from(ANEXOS_BUCKET).upload(path, bytes, { contentType: m[1], upsert: false })
  if (error) return { erro: 'Não foi possível enviar a imagem agora.' }
  return { path }
}

export function inicioDoDiaUTC(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
