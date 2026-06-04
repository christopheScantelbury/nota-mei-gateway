export const metadata = { title: 'Definir senha — Configurações' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SenhaForm from './SenhaForm'

export default async function ConfiguracoesSenhaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Detecta se o user já tem senha definida.
  // Supabase não expõe esse boolean diretamente; usamos uma heurística:
  // se `last_sign_in_at` existe E o user nunca trocou senha, ainda pode
  // não ter definido. Como heurística é frágil, deixamos o form sempre
  // mostrar "senha atual (opcional)" e tratamos o erro de updateUser.
  // Os providers identities listam 'email' (com password) vs só 'email' (OTP).
  const hasPassword = (user.identities ?? []).some(
    (i) => i.provider === 'email' && (i.identity_data as Record<string, unknown> | null)?.email_verified !== undefined,
  )

  return <SenhaForm hasPassword={hasPassword} userEmail={user.email ?? ''} />
}
