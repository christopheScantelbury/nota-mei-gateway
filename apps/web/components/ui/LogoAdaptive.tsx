'use client'

/**
 * LogoAdaptive — troca o SVG da logo conforme o tema ativo (light / dark).
 *
 * Usa useTheme do next-themes para ler resolvedTheme após a hidratação.
 * Antes do mount renderiza um placeholder invisível com as mesmas dimensões
 * para evitar layout shift (CLS).
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

interface LogoAdaptiveProps {
  lightSrc: string   // logo para fundo claro
  darkSrc: string    // logo para fundo escuro
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
}

export default function LogoAdaptive({
  lightSrc,
  darkSrc,
  alt,
  width,
  height,
  priority = false,
  className,
}: LogoAdaptiveProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Só usa o tema depois do mount para evitar mismatch de hidratação
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    // Espaço reservado com as mesmas dimensões — evita CLS
    return <div style={{ width, height, display: 'inline-block' }} aria-hidden />
  }

  const src = resolvedTheme === 'dark' ? darkSrc : lightSrc

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={className}
    />
  )
}
