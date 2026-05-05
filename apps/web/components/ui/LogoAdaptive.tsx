'use client'

/**
 * LogoAdaptive — troca o SVG da logo conforme o tema ativo (light / dark).
 *
 * Antes do mount renderiza um placeholder invisível com as mesmas dimensões
 * para evitar layout shift (CLS). Após mount, usa resolvedTheme do next-themes.
 *
 * Props extras:
 *   iconLightSrc / iconDarkSrc — versão só-ícone para telas muito pequenas (≤ 360px).
 *   Se não fornecidos, exibe sempre a logo completa.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

interface LogoAdaptiveProps {
  lightSrc: string
  darkSrc: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
  /** Ícone compacto para telas ≤ 360px */
  iconLightSrc?: string
  iconDarkSrc?: string
}

export default function LogoAdaptive({
  lightSrc,
  darkSrc,
  alt,
  width,
  height,
  priority = false,
  className,
  iconLightSrc,
  iconDarkSrc,
}: LogoAdaptiveProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <div style={{ width, height: Math.min(height, 44), display: 'inline-block' }} aria-hidden />
  }

  const isDark = resolvedTheme === 'dark'
  const src     = isDark ? darkSrc  : lightSrc
  const iconSrc = isDark ? iconDarkSrc : iconLightSrc

  return (
    <>
      {/* Logo completa — desktop e mobile ≥ 361px */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={`${iconSrc ? 'hidden min-[361px]:block' : ''} ${className ?? ''}`}
      />
      {/* Ícone compacto — apenas em telas ≤ 360px, se fornecido */}
      {iconSrc && (
        <Image
          src={iconSrc}
          alt={alt}
          width={40}
          height={40}
          priority={priority}
          unoptimized
          className="block min-[361px]:hidden w-10 h-10"
        />
      )}
    </>
  )
}
