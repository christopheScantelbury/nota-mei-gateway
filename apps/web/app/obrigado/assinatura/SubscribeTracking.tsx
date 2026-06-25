// Client component só pra disparar GA4 + Google Ads conversion.
// Separado da page pra manter a thank-you page como Server Component.

'use client'

import { useEffect, useRef } from 'react'
import { trackSubscribe, sendAdsConversion, type Persona } from '@/lib/analytics/events'

interface Props {
  persona: Persona
  plan: string
  value: number
  transactionId: string | null
}

export default function SubscribeTracking({ persona, plan, value, transactionId }: Props) {
  // useRef pra evitar disparo duplicado em modo dev (StrictMode re-render).
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    trackSubscribe({
      persona,
      plan,
      value,
      transaction_id: transactionId ?? undefined,
    })
    sendAdsConversion('NEXT_PUBLIC_ADS_CONV_SUBSCRIBE', {
      value,
      transactionId: transactionId ?? undefined,
    })
  }, [persona, plan, value, transactionId])

  return null
}
