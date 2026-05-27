import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

// Rate limit em memória — 1 emissão por minuto por token.
// Em produção com múltiplas instâncias do Vercel, idealmente usar Redis.
// Pra MVP em memória basta — pior caso o limit não é estrito entre instâncias.
const lastEmissaoAt = new Map<string, number>()
const RATE_LIMIT_MS = 60_000  // 1 minuto

interface LinkSource {
  id:                  string
  empresa_id:          string
  template_id:         string | null
  recorrencia_id:      string | null
  nome:                string
  internal_api_key:    string
  usos:                number
  ativo:               boolean
}

interface ResumoEmissao {
  nome:           string
  servico_nbs:    string
  servico_descricao: string
  valor:          number | null
  tomador_nome:   string
  tomador_doc:    string
  competencia:    string | null
  usos:           number
}

async function fetchLinkData(token: string): Promise<{
  link: LinkSource
  servico: Record<string, unknown>
  tomador: Record<string, unknown>
  competencia: string | null
} | { error: string; status: number }> {
  const admin = createAdminClient()

  const { data: link, error: linkErr } = await admin
    .from('emissao_links')
    .select('id, empresa_id, template_id, recorrencia_id, nome, internal_api_key, usos, ativo')
    .eq('token', token)
    .eq('ativo', true)
    .maybeSingle<LinkSource>()

  if (linkErr) {
    console.error('[emitir-publico] link lookup err', linkErr)
    return { error: 'INTERNAL_ERROR', status: 500 }
  }
  if (!link) return { error: 'NOT_FOUND', status: 404 }

  // Resolve dados do template ou recorrência
  let servico: Record<string, unknown> | null = null
  let tomador: Record<string, unknown> | null = null
  let competencia: string | null = null

  if (link.template_id) {
    const { data: tpl } = await admin
      .from('nota_templates')
      .select('servico, tomador')
      .eq('id', link.template_id)
      .maybeSingle<{ servico: Record<string, unknown>; tomador: Record<string, unknown> | null }>()
    if (!tpl) return { error: 'SOURCE_NOT_FOUND', status: 404 }
    servico = tpl.servico
    tomador = tpl.tomador ?? null
    // Competência: usa mês corrente
    competencia = new Date().toISOString().slice(0, 7)
  } else if (link.recorrencia_id) {
    const { data: rec } = await admin
      .from('nota_recorrencias')
      .select('servico, tomador, proxima_emissao')
      .eq('id', link.recorrencia_id)
      .maybeSingle<{ servico: Record<string, unknown>; tomador: Record<string, unknown>; proxima_emissao: string }>()
    if (!rec) return { error: 'SOURCE_NOT_FOUND', status: 404 }
    servico = rec.servico
    tomador = rec.tomador
    competencia = rec.proxima_emissao?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)
  }

  if (!servico || !tomador) return { error: 'INVALID_SOURCE', status: 422 }

  return { link, servico, tomador, competencia }
}

// GET /api/emitir-publico/:token — devolve resumo pra confirmação
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const result = await fetchLinkData(params.token)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  const { link, servico, tomador, competencia } = result

  const resumo: ResumoEmissao = {
    nome:              link.nome,
    servico_nbs:       String(servico.codigo_nbs ?? ''),
    servico_descricao: String(servico.discriminacao ?? ''),
    valor:             servico.valor != null ? Number(servico.valor) : null,
    tomador_nome:      String(tomador.razao_social ?? ''),
    tomador_doc:       String(tomador.documento ?? ''),
    competencia,
    usos:              link.usos,
  }
  return NextResponse.json(resumo)
}

// POST /api/emitir-publico/:token — emite a nota usando a internal_api_key
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  // Rate limit
  const now  = Date.now()
  const last = lastEmissaoAt.get(params.token) ?? 0
  if (now - last < RATE_LIMIT_MS) {
    const waitMs = RATE_LIMIT_MS - (now - last)
    return NextResponse.json(
      { error: 'RATE_LIMIT', message: `Aguarde ${Math.ceil(waitMs / 1000)}s pra emitir outra nota com este link.` },
      { status: 429 },
    )
  }
  lastEmissaoAt.set(params.token, now)

  const result = await fetchLinkData(params.token)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  const { link, servico, tomador, competencia } = result

  // Monta payload pra Go /v1/nfse
  const payload = {
    servico,
    tomador,
    competencia,
  }

  let goRes: Response
  try {
    goRes = await fetch(`${API_BASE}/v1/nfse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${link.internal_api_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[emitir-publico] go call err', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Falha ao conectar com o servidor de emissão' }, { status: 502 })
  }

  const goBody = await goRes.json().catch(() => ({}))

  if (!goRes.ok) {
    return NextResponse.json(
      { error: goBody.error ?? 'EMISSION_FAILED', message: goBody.message ?? 'Erro ao emitir a nota' },
      { status: goRes.status },
    )
  }

  // Atualiza estatísticas do link
  const admin = createAdminClient()
  await admin
    .from('emissao_links')
    .update({
      usos:              link.usos + 1,
      ultima_emissao_em: new Date().toISOString(),
      ultima_nota_id:    goBody.nota_id ?? null,
    })
    .eq('id', link.id)

  return NextResponse.json({
    ok:       true,
    nota_id:  goBody.nota_id,
    status:   goBody.status ?? 'PROCESSANDO',
    mensagem: 'Nota enviada para processamento. Você e o cliente receberão por email assim que for autorizada.',
  })
}
