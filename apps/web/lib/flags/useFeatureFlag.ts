'use client'

import { useEffect, useState } from 'react'

interface FlagState {
  variant: string
  isLoading: boolean
  isControl: boolean
}

const memo = new Map<string, string>()

/**
 * Hook client pra ler feature flag por chave.
 *
 * Spec: HIST-7.4. Faz fetch ao /api/flags/{key}. Cache em memória por sessão.
 * Pré-render: retorna {isLoading:true, variant:'control'} pra evitar layout shift.
 *
 * @example
 * const { variant, isLoading } = useFeatureFlag('hero_copy_variant')
 * if (variant === 'variant_b') return <Hero variantB />
 */
export function useFeatureFlag(key: string): FlagState {
  const [variant, setVariant] = useState<string>(() => memo.get(key) ?? 'control')
  const [isLoading, setLoading] = useState(!memo.has(key))

  useEffect(() => {
    if (memo.has(key)) { setVariant(memo.get(key)!); setLoading(false); return }
    let alive = true
    fetch(`/api/flags/${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : { variant: 'control' })
      .then((d: { variant?: string }) => {
        const v = d.variant ?? 'control'
        memo.set(key, v)
        if (alive) { setVariant(v); setLoading(false) }
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [key])

  return { variant, isLoading, isControl: variant === 'control' }
}
