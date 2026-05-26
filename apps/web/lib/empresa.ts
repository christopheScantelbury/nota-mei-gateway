import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve a empresa ativa do usuário autenticado.
 *
 * Estratégia (mesma do dashboard layout):
 *  1. Se tem 1 empresa → essa.
 *  2. Se tem várias → usa user_preferences.empresa_id.
 *  3. Se não tem preferência salva → retorna null (caller deve redirecionar p/ seletor).
 *  4. Fallback legacy MEI: empresas.id === user_id, então essa cobre o caso normal.
 */
export async function getActiveEmpresaId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .returns<{ id: string }[]>()

  if (!empresas?.length) return null
  if (empresas.length === 1) return empresas[0].id

  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('empresa_id')
    .eq('user_id', userId)
    .maybeSingle<{ empresa_id: string | null }>()

  const preferred = prefs?.empresa_id
    ? empresas.find((e) => e.id === prefs.empresa_id)
    : null

  return preferred?.id ?? null
}
