/**
 * Error tracking in-house (#245 MVP, sem Sentry SDK).
 *
 * Captura errors do frontend (client + server) e persiste em error_log
 * via POST /api/errors. Dedupe via fingerprint (SHA-256 truncado).
 *
 * Upgrade futuro pra Sentry: trocar `sendError` por SDK call.
 */

const TRACKING_ENABLED = process.env.NEXT_PUBLIC_ERROR_TRACKING !== 'off'

export interface ErrorCapture {
  message: string
  stack?: string
  source: 'web-client' | 'web-server'
  url?: string
  metadata?: Record<string, unknown>
  level?: 'error' | 'warning' | 'info'
}

/**
 * Envia error pra API. Client OR Server side.
 * Falha silenciosa — não loga em loop.
 */
export async function captureError(input: ErrorCapture): Promise<void> {
  if (!TRACKING_ENABLED) return
  try {
    const body = {
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 4000),
      source: input.source,
      url: input.url ?? (typeof window !== 'undefined' ? window.location.href : undefined),
      metadata: input.metadata,
      level: input.level ?? 'error',
    }
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Não bloqueia navigation
      keepalive: typeof window !== 'undefined',
    })
  } catch {
    // Silent — não joga error sobre error
  }
}

/**
 * Helper pra capturar Error objects diretamente.
 */
export function captureException(err: unknown, opts: Omit<ErrorCapture, 'message' | 'stack'> & Partial<Pick<ErrorCapture, 'message' | 'stack'>> = { source: 'web-client' }): void {
  const message =
    opts.message ??
    (err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error')
  const stack = opts.stack ?? (err instanceof Error ? err.stack : undefined)
  void captureError({ ...opts, message, stack })
}

/**
 * Setup global handlers no client. Chame uma vez no app.
 * Captura unhandled errors + promise rejections.
 */
export function setupClientErrorTracking(): void {
  if (typeof window === 'undefined') return
  if ((window as { __errorTrackingSetup?: boolean }).__errorTrackingSetup) return
  ;(window as { __errorTrackingSetup?: boolean }).__errorTrackingSetup = true

  window.addEventListener('error', (event) => {
    captureError({
      message: event.message,
      stack: event.error?.stack,
      source: 'web-client',
      url: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    captureError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'web-client',
      metadata: { kind: 'unhandled-promise' },
    })
  })
}
