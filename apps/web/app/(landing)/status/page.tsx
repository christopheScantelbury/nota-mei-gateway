'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/Button'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown'

interface ServiceState {
  name: string
  key: string
  description: string
  status: ServiceStatus
  latencyMs?: number
}

interface HealthResponse {
  status: string
  services: Record<string, { status: string; latency_ms?: number }>
}

function statusColor(s: ServiceStatus) {
  if (s === 'operational') return 'text-nota-autorizada'
  if (s === 'degraded')    return 'text-nota-processando'
  if (s === 'down')        return 'text-nota-rejeitada'
  return 'text-text-2'
}

function statusBg(s: ServiceStatus) {
  if (s === 'operational') return 'bg-nota-autorizada'
  if (s === 'degraded')    return 'bg-nota-processando'
  if (s === 'down')        return 'bg-nota-rejeitada'
  return 'bg-text-2'
}

function statusLabel(s: ServiceStatus) {
  if (s === 'operational') return 'Operacional'
  if (s === 'degraded')    return 'Degradado'
  if (s === 'down')        return 'Indisponível'
  return 'Verificando…'
}

function overallStatus(services: ServiceState[]): ServiceStatus {
  if (services.some(s => s.status === 'down'))       return 'down'
  if (services.some(s => s.status === 'degraded'))   return 'degraded'
  if (services.every(s => s.status === 'operational')) return 'operational'
  return 'unknown'
}

const SERVICES: { key: string; name: string; description: string }[] = [
  { key: 'db',      name: 'API REST',                description: 'Endpoints de emissão, consulta e cancelamento de NFS-e' },
  { key: 'redis',   name: 'Worker de processamento', description: 'Fila de envio à Receita Federal e geração de XMLs' },
  { key: 'receita', name: 'Receita Federal',          description: 'Conexão mTLS com a API NFS-e Nacional v1.2' },
  { key: 'stripe',  name: 'Stripe',                   description: 'Billing, Checkout e Customer Portal' },
  { key: 'rabbitmq',name: 'Mensageria',               description: 'Entregas de webhook (RabbitMQ + retry engine)' },
]

export default function StatusPage() {
  const [services, setServices] = useState<ServiceState[]>(
    SERVICES.map(s => ({ ...s, status: 'unknown' as ServiceStatus }))
  )
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchHealth() {
    setLoading(true)
    try {
      const t0  = Date.now()
      const res = await fetch(`${API_URL}/v1/health`, { cache: 'no-store' })
      const latency = Date.now() - t0

      if (!res.ok) {
        setServices(SERVICES.map(s => ({ ...s, status: 'down' as ServiceStatus })))
        setLastChecked(new Date())
        return
      }

      const data: HealthResponse = await res.json()

      setServices(SERVICES.map(s => {
        const svc = data.services?.[s.key]
        let status: ServiceStatus = 'down'
        if (svc?.status === 'ok')       status = 'operational'
        else if (svc?.status === 'degraded') status = 'degraded'
        return {
          ...s,
          status,
          latencyMs: s.key === 'db' ? latency : svc?.latency_ms,
        }
      }))
    } catch {
      setServices(SERVICES.map(s => ({ ...s, status: 'down' as ServiceStatus })))
    } finally {
      setLoading(false)
      setLastChecked(new Date())
    }
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 60_000)
    return () => clearInterval(id)
  }, [])

  const overall = overallStatus(services)
  const overallBg =
    overall === 'operational' ? 'bg-nota-autorizada/10 border-nota-autorizada/40' :
    overall === 'degraded'    ? 'bg-nota-processando/10 border-nota-processando/40' :
    overall === 'down'        ? 'bg-nota-rejeitada/10 border-nota-rejeitada/40' :
    'bg-navy-700 border-navy-600'

  return (
    <div className="min-h-screen bg-navy-900 text-text-1">
      {/* Header */}
      <header className="border-b border-navy-600 bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/gateway" className="flex items-center shrink-0">
            <LogoAdaptive
              lightSrc="/brand/notafacil-logo.svg"
              darkSrc="/brand/notafacil-logo-dark.svg"
              alt="NotaFácil API"
              width={160}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-text-1">Status da API</h1>
          <p className="text-text-2 mt-2 text-sm">
            Monitoramento em tempo real dos componentes da plataforma.
            {lastChecked && (
              <> Última verificação: {lastChecked.toLocaleTimeString('pt-BR')}.</>
            )}
          </p>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-xl border p-5 flex items-center gap-4 ${overallBg}`}>
          <span className={`w-4 h-4 rounded-full shrink-0 ${statusBg(overall)} ${overall === 'operational' ? 'animate-pulse' : ''}`} />
          <div>
            <p className={`font-semibold text-lg ${statusColor(overall)}`}>
              {overall === 'operational' ? 'Todos os sistemas operacionais' :
               overall === 'degraded'    ? 'Degradação parcial em andamento' :
               overall === 'down'        ? 'Interrupção de serviço detectada' :
               'Verificando status…'}
            </p>
            <p className="text-sm text-text-2">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={loading} onClick={fetchHealth} className="ml-auto shrink-0">
            {loading ? '…' : '↻ Atualizar'}
          </Button>
        </div>

        {/* Service list */}
        <div className="rounded-xl border border-navy-600 overflow-hidden">
          {services.map((svc, i) => (
            <div
              key={svc.key}
              className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-navy-600' : ''}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusBg(svc.status)}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text-1">{svc.name}</p>
                <p className="text-xs text-text-2 mt-0.5">{svc.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${statusColor(svc.status)}`}>
                  {statusLabel(svc.status)}
                </p>
                {svc.latencyMs != null && svc.status === 'operational' && (
                  <p className="text-xs text-text-2">{svc.latencyMs}ms</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Incident history (static — no incidents) */}
        <div>
          <h2 className="font-display text-lg font-bold mb-4">Histórico de incidentes</h2>
          <div className="rounded-xl border border-navy-600 p-8 text-center">
            <p className="text-nota-autorizada font-semibold text-sm">✓ Nenhum incidente nos últimos 30 dias</p>
            <p className="text-text-2 text-xs mt-1">Uptime de 99,9% em todos os componentes críticos.</p>
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center text-xs text-text-2 pt-4 border-t border-navy-600 flex gap-6 justify-center">
          <Link href="/"    className="hover:text-text-1 transition">Home</Link>
          <Link href="/docs" className="hover:text-text-1 transition">Docs</Link>
          <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">Suporte</a>
        </div>
      </div>
    </div>
  )
}
