import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type Notification = {
  id: string
  type: 'cert_expiring' | 'plan_limit_80' | 'plan_limit_100' | 'nota_autorizada' | 'nota_rejeitada'
  title: string
  body: string
  href: string
  createdAt: string
}

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const competencia = currentCompetencia()

  const [meiResult, emissaoResult, recentNotasResult] = await Promise.all([
    supabase
      .from('meis')
      .select('cert_valid_until')
      .eq('id', session.user.id)
      .single<{ cert_valid_until: string | null }>(),

    supabase
      .from('emissoes_mensais')
      .select('total_emitidas, planos(emissoes_limite)')
      .eq('mei_id', session.user.id)
      .eq('competencia', competencia)
      .single<{ total_emitidas: number; planos: { emissoes_limite: number } | null }>(),

    supabase
      .from('notas_fiscais')
      .select('id, status, tomador_nome, created_at')
      .eq('mei_id', session.user.id)
      .in('status', ['AUTORIZADA', 'REJEITADA'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<{ id: string; status: string; tomador_nome: string | null; created_at: string }[]>(),
  ])

  const notifications: Notification[] = []
  const now = new Date()

  // Cert expiry alerts
  const certUntil = meiResult.data?.cert_valid_until
  if (certUntil) {
    const daysLeft = Math.ceil((new Date(certUntil).getTime() - now.getTime()) / 86400000)
    if (daysLeft <= 0) {
      notifications.push({
        id: 'cert_expired',
        type: 'cert_expiring',
        title: 'Certificado A1 expirado',
        body: 'Seu certificado expirou. Renove agora para continuar emitindo notas.',
        href: '/configuracoes?aba=certificado',
        createdAt: now.toISOString(),
      })
    } else if (daysLeft <= 30) {
      notifications.push({
        id: `cert_expiring_${daysLeft}`,
        type: 'cert_expiring',
        title: `Certificado vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
        body: 'Renove antes do prazo para evitar interrupção nas emissões.',
        href: '/configuracoes?aba=certificado',
        createdAt: now.toISOString(),
      })
    }
  }

  // Plan usage alerts
  const totalEmitidas = emissaoResult.data?.total_emitidas ?? 0
  const limite = emissaoResult.data?.planos?.emissoes_limite ?? 5
  const pct = limite > 0 ? (totalEmitidas / limite) * 100 : 0

  if (pct >= 100) {
    notifications.push({
      id: 'plan_100',
      type: 'plan_limit_100',
      title: 'Limite do plano atingido',
      body: `${totalEmitidas} de ${limite} emissões utilizadas. Faça upgrade para continuar.`,
      href: '/billing',
      createdAt: now.toISOString(),
    })
  } else if (pct >= 80) {
    notifications.push({
      id: 'plan_80',
      type: 'plan_limit_80',
      title: '80% do limite utilizado',
      body: `${totalEmitidas} de ${limite} emissões este mês. Considere fazer upgrade.`,
      href: '/billing',
      createdAt: now.toISOString(),
    })
  }

  // Recent nota events (last 24h)
  for (const nota of (recentNotasResult.data ?? [])) {
    if (nota.status === 'AUTORIZADA') {
      notifications.push({
        id: `nota_auth_${nota.id}`,
        type: 'nota_autorizada',
        title: 'NFS-e autorizada',
        body: nota.tomador_nome ? `Nota para ${nota.tomador_nome} foi aprovada.` : 'Nota aprovada pela Receita Federal.',
        href: `/notas/${nota.id}`,
        createdAt: nota.created_at,
      })
    } else if (nota.status === 'REJEITADA') {
      notifications.push({
        id: `nota_rej_${nota.id}`,
        type: 'nota_rejeitada',
        title: 'NFS-e rejeitada',
        body: nota.tomador_nome ? `Nota para ${nota.tomador_nome} foi rejeitada.` : 'Nota rejeitada pela Receita Federal.',
        href: `/notas/${nota.id}`,
        createdAt: nota.created_at,
      })
    }
  }

  return NextResponse.json({ notifications })
}
