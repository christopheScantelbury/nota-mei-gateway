import { createClient } from '@supabase/supabase-js'

/**
 * Vincula ao usuário logado a empresa ME/EPP que ainda está sem dono.
 *
 * POST /v1/auth/register/me cria a empresa ANTES da conta no Supabase Auth
 * existir, então ela nasce com user_id = NULL e precisa ser ligada no primeiro
 * login (casando pelo e-mail). Antes isso só rodava em /auth/callback — ou
 * seja, só pra quem CLICAVA no link do e-mail. Quem digitava o código de 6
 * dígitos (verifyOtp no browser) ou entrava por senha nunca passava ali: a
 * empresa ficava órfã e o dashboard mandava a pessoa de volta pro /cadastro.
 * Visto em prod 2026-09-30 com 2 clientes reais.
 *
 * Usa service role (a linha com user_id NULL não é alcançável pela RLS do
 * próprio usuário). Nunca lança: falha só é logada.
 *
 * @returns true quando uma empresa foi vinculada agora.
 */
export async function linkUnlinkedEmpresa(
  userId: string,
  email: string | null | undefined,
  source: string,
): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.warn(`[${source}] SUPABASE_SERVICE_ROLE_KEY missing — linkage skipped`)
    return false
  }
  if (!email) return false

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })
    // Case-insensitive: Supabase Auth normaliza pra minúsculas, mas a empresa
    // pode ter sido gravada com o e-mail como veio do formulário.
    const emailNormalized = email.toLowerCase()

    const { data: unlinked, error: selectErr } = await admin
      .from('empresas')
      .select('id')
      .ilike('email', emailNormalized)
      .is('user_id', null)
      .limit(1)
      .maybeSingle()

    if (selectErr) {
      console.error(`[${source}] select unlinked empresa failed`, selectErr)
      return false
    }
    if (!unlinked) return false

    // .is('user_id', null) de novo: em corrida com outro request, só um vence.
    const { data: updated, error: updateErr } = await admin
      .from('empresas')
      .update({ user_id: userId })
      .eq('id', unlinked.id)
      .is('user_id', null)
      .select('id')
    if (updateErr) {
      console.error(`[${source}] link user_id failed`, { empresa_id: unlinked.id, user_id: userId, err: updateErr })
      return false
    }
    const linked = (updated?.length ?? 0) > 0
    if (linked) console.info(`[${source}] linked empresa`, { empresa_id: unlinked.id, user_id: userId })
    return linked
  } catch (e) {
    console.error(`[${source}] empresa linkage exception`, e)
    return false
  }
}
