'use client'

import { useEffect } from 'react'
import { setupClientErrorTracking } from '@/lib/error-tracking'

/**
 * Registra global error handlers (window.error + unhandledrejection).
 * Renderiza nada — só side effect no mount.
 *
 * Inserido no root layout pra ativar em todas as páginas.
 */
export default function ErrorTrackingSetup() {
  useEffect(() => {
    setupClientErrorTracking()
  }, [])
  return null
}
