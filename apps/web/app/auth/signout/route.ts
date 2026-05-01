import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function POST(_req: NextRequest) {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/')
}
