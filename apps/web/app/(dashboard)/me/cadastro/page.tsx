import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CadastroMEStepper } from './CadastroMEStepper'

export const metadata: Metadata = {
  title: 'Cadastro ME/EPP',
  description: 'Cadastre sua empresa ME ou EPP para emitir NFS-e via Nota MEI Gateway.',
}

/**
 * ME-40 — Fluxo de cadastro ME self-service
 *
 * Server Component que:
 *  1. Verifica autenticação — redireciona para /login se não autenticado
 *  2. Verifica se o usuário já tem empresa cadastrada — redireciona para /notas
 *  3. Renderiza o CadastroMEStepper (Client Component)
 */
export default async function CadastroMEPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Se já existe empresa cadastrada, manda para o dashboard
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (empresa) {
    redirect('/notas')
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-navy-600 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-text-1">
              Cadastro ME/EPP
            </h1>
            <p className="text-sm text-text-2 mt-0.5">
              Configure sua empresa para emitir NFS-e via Nota MEI Gateway
            </p>
          </div>
          <a
            href="/notas"
            className="text-xs text-text-2 hover:text-text-1 transition hidden sm:block"
          >
            Já tenho cadastro →
          </a>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex-1 px-6 py-8">
        <CadastroMEStepper />
      </div>
    </div>
  )
}
