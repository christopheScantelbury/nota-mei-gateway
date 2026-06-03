/**
 * LogoAdaptive — troca o SVG do logo conforme tema light/dark.
 *
 * IMPLEMENTAÇÃO (SSR-safe, sem race condition):
 * Renderiza **ambas as versões** e usa CSS class `.dark` no `<html>` (controlada
 * pelo next-themes `attribute="class"`) pra alternar visibilidade. Funciona
 * imediatamente no SSR — não depende de useEffect/resolvedTheme.
 *
 * Tinha um bug N+1 da rodada 2 QA: durante hidratação, `resolvedTheme`
 * retornava 'light' por um frame mesmo quando o user tinha tema dark salvo,
 * a imagem dark nunca era usada dependendo do timing.
 *
 * `forceTheme` ainda funciona pra superfícies que ignoram o toggle.
 */

import Image from 'next/image'

interface LogoAdaptiveProps {
  lightSrc: string
  darkSrc: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
  /** Ícone compacto para telas ≤ 360px. Quando fornecido, alterna entre
   *  full e ícone POR BREAKPOINT — independente do tema. */
  iconLightSrc?: string
  iconDarkSrc?: string
  /** Força um tema específico, ignorando .dark class. */
  forceTheme?: 'light' | 'dark'
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
  forceTheme,
}: LogoAdaptiveProps) {
  // ── forceTheme: renderiza só uma versão (cor fixa, ignora tema) ───────
  if (forceTheme) {
    const isDark = forceTheme === 'dark'
    const src     = isDark ? darkSrc      : lightSrc
    const iconSrc = isDark ? iconDarkSrc  : iconLightSrc
    return (
      <>
        <Image
          src={src} alt={alt} width={width} height={height} priority={priority} unoptimized
          className={`${iconSrc ? 'hidden min-[361px]:block' : ''} ${className ?? ''}`}
        />
        {iconSrc && (
          <Image
            src={iconSrc} alt={alt} width={40} height={40} priority={priority} unoptimized
            className="block min-[361px]:hidden w-10 h-10"
          />
        )}
      </>
    )
  }

  // ── Tema-aware via CSS class (sem JS, sem race) ────────────────────────
  // Renderiza AMBAS as versões; `.dark` no <html> controla qual aparece.
  const hasIcons = !!iconLightSrc && !!iconDarkSrc
  const base = className ?? ''

  // Mobile ≤ 360 só recebe ícones SE ambos foram fornecidos
  const fullVisible = hasIcons ? 'hidden min-[361px]:block' : 'block'

  return (
    <>
      {/* Logo completa LIGHT — visível em tema light */}
      <Image
        src={lightSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
        className={`${fullVisible} dark:!hidden ${base}`}
      />
      {/* Logo completa DARK — visível em tema dark */}
      <Image
        src={darkSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
        className={`hidden dark:${hasIcons ? 'min-[361px]:block' : 'block'} ${base}`}
      />

      {/* Ícone compacto LIGHT (≤ 360px, tema light) */}
      {hasIcons && (
        <Image
          src={iconLightSrc!} alt={alt} width={40} height={40} priority={priority} unoptimized
          className="block min-[361px]:hidden dark:!hidden w-10 h-10"
        />
      )}
      {/* Ícone compacto DARK (≤ 360px, tema dark) */}
      {hasIcons && (
        <Image
          src={iconDarkSrc!} alt={alt} width={40} height={40} priority={priority} unoptimized
          className="hidden dark:block min-[361px]:dark:hidden w-10 h-10"
        />
      )}
    </>
  )
}
