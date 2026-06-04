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
  //
  // ⚠️ IMPORTANTE: Tailwind JIT só detecta classes LITERAIS no source.
  // NUNCA usar `dark:${variable}` ou interpolação — a classe não é gerada.
  // Por isso os dois ramos (hasIcons / sem ícones) têm strings completas.
  const hasIcons = !!iconLightSrc && !!iconDarkSrc
  const base = className ?? ''

  if (!hasIcons) {
    return (
      <>
        <Image
          src={lightSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
          className={`block dark:hidden ${base}`}
        />
        <Image
          src={darkSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
          className={`hidden dark:block ${base}`}
        />
      </>
    )
  }

  // Com ícones: wrappers separados por tema; cada um troca ícone↔full por breakpoint.
  return (
    <>
      {/* ─── Tema LIGHT ─── */}
      <span className="contents dark:hidden">
        <Image
          src={iconLightSrc!} alt={alt} width={40} height={40} priority={priority} unoptimized
          className="block min-[361px]:hidden w-10 h-10"
        />
        <Image
          src={lightSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
          className={`hidden min-[361px]:block ${base}`}
        />
      </span>
      {/* ─── Tema DARK ─── */}
      <span className="hidden dark:contents">
        <Image
          src={iconDarkSrc!} alt={alt} width={40} height={40} priority={priority} unoptimized
          className="block min-[361px]:hidden w-10 h-10"
        />
        <Image
          src={darkSrc} alt={alt} width={width} height={height} priority={priority} unoptimized
          className={`hidden min-[361px]:block ${base}`}
        />
      </span>
    </>
  )
}
