import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role key.
 * Bypassa RLS — usar APENAS em Server Components e Route Handlers do admin.
 * NUNCA expor no cliente/browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o admin client',
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
