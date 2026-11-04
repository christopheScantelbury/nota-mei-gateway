import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/nfse/:id/rascunho — dados de uma nota já emitida para pré-preencher
// /notas/nova ("Corrigir e emitir novamente" / "Emitir outra igual", #272).
//
// Isolamento: client com a sessão do usuário — a RLS de notas_fiscais e de
// clientes só devolve linhas das empresas dele.
//
// Fontes, da melhor para a pior:
//   1. notas_fiscais.dados_emissao — o pedido original (notas a partir de 2026-11-04)
//   2. xml_enviado (DPS) — discriminação e e-mail do tomador em notas antigas
//   3. clientes — e-mail/município pelo documento do tomador

export interface RascunhoNota {
  servico: { codigo_nbs: string; discriminacao: string; valor: number | null; aliquota_iss: number | null }
  tomador: { tipo: 'PJ' | 'PF'; documento: string; razao_social: string; email: string; municipio_ibge: string }
  competencia: string
  iss_retido: boolean | null
  completo: boolean // false = parte dos campos precisa ser preenchida de novo
}

type Dados = {
  servico?: { codigo_nbs?: string; discriminacao?: string; valor?: number; aliquota_iss?: number }
  tomador?: { tipo?: string; documento?: string; razao_social?: string; email?: string; municipio_ibge?: string }
  competencia?: string
  iss_retido?: boolean | null
}

function tagXML(xml: string | null, tag: string, dentroDe?: string): string {
  if (!xml) return ''
  let trecho = xml
  if (dentroDe) {
    const m = xml.match(new RegExp(`<${dentroDe}[^>]*>([\\s\\S]*?)</${dentroDe}>`))
    if (!m) return ''
    trecho = m[1]
  }
  const m = trecho.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  if (!m) return ''
  return m[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .trim()
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: nota } = await supabase
    .from('notas_fiscais')
    .select('id, empresa_id, tomador_doc, tomador_nome, tomador_tipo, valor_servico, competencia, iss_retido, dados_emissao, xml_enviado')
    .eq('id', params.id)
    .maybeSingle()
  if (!nota) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const d = (nota.dados_emissao ?? {}) as Dados
  const xml = (nota.xml_enviado as string | null) ?? null

  const documento = (d.tomador?.documento ?? nota.tomador_doc ?? '').replace(/\D/g, '')
  const tipo: 'PJ' | 'PF' = d.tomador?.tipo === 'PF' || (!d.tomador?.tipo && documento.length === 11) ? 'PF' : 'PJ'

  let email = d.tomador?.email ?? tagXML(xml, 'email', 'toma')
  let municipio = d.tomador?.municipio_ibge ?? ''
  if ((!email || !municipio) && documento) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('email, municipio_ibge')
      .eq('empresa_id', nota.empresa_id)
      .eq('documento', documento)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if (!email && cliente?.email) email = cliente.email
    if (!municipio && cliente?.municipio_ibge) municipio = cliente.municipio_ibge
  }

  const rascunho: RascunhoNota = {
    servico: {
      codigo_nbs: d.servico?.codigo_nbs ?? '',
      discriminacao: d.servico?.discriminacao ?? tagXML(xml, 'xDescServ'),
      valor: d.servico?.valor ?? (nota.valor_servico != null ? Number(nota.valor_servico) : null),
      aliquota_iss: d.servico?.aliquota_iss ?? null,
    },
    tomador: {
      tipo,
      documento,
      razao_social: d.tomador?.razao_social ?? nota.tomador_nome ?? '',
      email,
      municipio_ibge: municipio,
    },
    competencia: d.competencia ?? nota.competencia ?? '',
    iss_retido: d.iss_retido ?? nota.iss_retido ?? null,
    completo: Boolean(nota.dados_emissao),
  }
  return NextResponse.json(rascunho)
}
