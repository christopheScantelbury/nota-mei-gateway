import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/empresa/me
//
// Retorna informações da empresa/MEI logado para o frontend ajustar a UI:
//   · tipo: "MEI" | "ME" | "EPP"
//   · regime_tributario: "SIMPLES_MEI" | "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL"
//   · isMei: shortcut booleano
//   · isSimplesNacional: shortcut (MEI ou SN)
//
// Usado pela tela "Nova nota" para esconder/mostrar campos de imposto:
//   · MEI/SN → não mostra alíquota ISS, retenção (recolhe ISS via DAS)
//   · LP/LR → mostra tudo (ISS retido na fonte é decisão por nota)

interface EmpresaInfo {
  tipo: 'MEI' | 'ME' | 'EPP'
  regime_tributario: 'SIMPLES_MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  isMei: boolean
  isSimplesNacional: boolean
  cnpj: string | null
  razao_social: string | null
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // empresas primeiro (modelo unificado)
  const { data: emp } = await supabase
    .from('empresas')
    .select('cnpj, razao_social, tipo, regime_tributario')
    .eq('user_id', user.id)
    .maybeSingle<{
      cnpj: string
      razao_social: string
      tipo: 'MEI' | 'ME' | 'EPP'
      regime_tributario: EmpresaInfo['regime_tributario']
    }>()

  if (emp) {
    const isMei = emp.tipo === 'MEI'
    return NextResponse.json<EmpresaInfo>({
      tipo: emp.tipo,
      regime_tributario: emp.regime_tributario,
      isMei,
      isSimplesNacional: isMei || emp.regime_tributario === 'SIMPLES_NACIONAL',
      cnpj: emp.cnpj,
      razao_social: emp.razao_social,
    })
  }

  // Fallback meis (legacy) — sempre MEI / SIMPLES_MEI
  const { data: mei } = await supabase
    .from('meis')
    .select('cnpj, razao_social')
    .eq('id', user.id)
    .maybeSingle<{ cnpj: string; razao_social: string }>()

  if (mei) {
    return NextResponse.json<EmpresaInfo>({
      tipo: 'MEI',
      regime_tributario: 'SIMPLES_MEI',
      isMei: true,
      isSimplesNacional: true,
      cnpj: mei.cnpj,
      razao_social: mei.razao_social,
    })
  }

  return NextResponse.json({ error: 'EMPRESA_NOT_FOUND' }, { status: 404 })
}
