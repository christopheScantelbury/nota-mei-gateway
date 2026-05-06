'use server'

import { createClient } from '@/lib/supabase/server'

export interface CadastroMEState {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  tipo: 'ME' | 'EPP'
  email: string
  municipioIBGE: string
  inscricaoMunicipal?: string
  regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO'
  certFile?: File
  certPassword?: string
}

export interface CadastroMEResult {
  ok: boolean
  apiKey?: string
  empresaId?: string
  error?: string
}

export async function cadastrarME(state: CadastroMEState): Promise<CadastroMEResult> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { ok: false, error: 'Sessão expirada. Faça login novamente.' }
  }

  const formData = new FormData()
  formData.append('cnpj', state.cnpj.replace(/\D/g, ''))
  formData.append('razao_social', state.razaoSocial.trim())
  formData.append('tipo', state.tipo)
  formData.append('email', state.email.trim())
  formData.append('municipio_ibge', state.municipioIBGE)
  formData.append('regime_tributario', state.regimeTributario)

  if (state.nomeFantasia?.trim()) {
    formData.append('nome_fantasia', state.nomeFantasia.trim())
  }
  if (state.inscricaoMunicipal?.trim()) {
    formData.append('inscricao_municipal', state.inscricaoMunicipal.trim())
  }
  if (state.certFile) {
    formData.append('certificate', state.certFile)
  }
  if (state.certPassword) {
    formData.append('cert_password', state.certPassword)
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/register`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    )

    const data = await res.json()

    if (!res.ok) {
      const msg =
        data.message ??
        data.error ??
        'Erro ao cadastrar empresa. Tente novamente.'

      if (data.error === 'CNPJ_ALREADY_EXISTS') {
        return { ok: false, error: 'CNPJ já cadastrado nesta plataforma.' }
      }
      return { ok: false, error: msg }
    }

    return {
      ok: true,
      apiKey: data.api_key as string,
      empresaId: data.empresa_id as string,
    }
  } catch {
    return {
      ok: false,
      error: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    }
  }
}
