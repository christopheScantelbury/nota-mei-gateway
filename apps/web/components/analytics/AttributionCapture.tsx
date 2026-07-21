'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/lib/analytics/attribution'

/**
 * Captura gclid/utm_* da URL de entrada e persiste em cookie first-party.
 *
 * Precisa rodar no root layout porque o clique do anúncio cai na LP (`/me`)
 * mas o cadastro acontece em `/cadastro/me` — sem capturar na chegada, os
 * parâmetros se perdem na primeira navegação e o cadastro fica órfão.
 *
 * Não renderiza nada. Ver `lib/analytics/attribution.ts` pro porquê de não
 * dependermos do GA4 pra essa medição.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution()
  }, [])

  return null
}
