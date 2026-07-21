'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import CookiePreferencesLink from '@/components/consent/CookiePreferencesLink'

// ── Persona-aware logo (igual ao Navbar) ────────────────────────────────────
// A landing é theme-aware (CSS variables): light → fundo claro com logo light
// (texto preto); dark → fundo escuro com logo-dark (texto branco).
type LogoConfig = { src: string; darkSrc: string; alt: string; width: number }

function getLogoForPath(pathname: string): LogoConfig {
  if (pathname.startsWith('/mei'))     return { src: '/brand/notafacil-mei.svg',     darkSrc: '/brand/notafacil-mei-dark.svg',     alt: 'NotaFácil MEI',     width: 200 }
  if (pathname.startsWith('/me'))      return { src: '/brand/notafacil-empresa.svg', darkSrc: '/brand/notafacil-empresa-dark.svg', alt: 'NotaFácil Empresa', width: 240 }
  if (pathname.startsWith('/gateway')) return { src: '/brand/notafacil-api.svg',     darkSrc: '/brand/notafacil-api-dark.svg',     alt: 'NotaFácil API',     width: 195 }
  return { src: '/brand/notafacil-logo.svg', darkSrc: '/brand/notafacil-logo-dark.svg', alt: 'NotaFácil', width: 170 }
}

// ── Footer único para todas as landings ──────────────────────────────────────
// Estrutura: 4 colunas — Marca / Produtos / Desenvolvedores / Empresa
// + bottom strip com copyright. Brand kit v2.0 — slate borders, light theme.
export default function LandingFooter() {
  const pathname = usePathname() ?? '/'
  const logo = getLogoForPath(pathname)
  const homeHref = pathname.startsWith('/mei') ? '/mei'
                : pathname.startsWith('/me')   ? '/me'
                : pathname.startsWith('/gateway') ? '/gateway' : '/'
  // Oculta links de devs em páginas de usuário final (MEI e ME/EPP)
  const isEndUser = pathname.startsWith('/mei') || pathname.startsWith('/me')

  return (
    <footer className="border-t border-navy-600 py-12 px-4 mt-16">
      <div className="mx-auto max-w-6xl">
        <div className={`grid grid-cols-1 gap-10 mb-10 ${isEndUser ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
          {/* Marca */}
          <div className="sm:col-span-1 flex flex-col gap-3">
            <Link href={homeHref} className="inline-flex items-center" aria-label={logo.alt}>
              <LogoAdaptive
                lightSrc={logo.src}
                darkSrc={logo.darkSrc}
                alt={logo.alt}
                width={logo.width}
                height={36}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-text-2 text-xs leading-relaxed max-w-[220px]">
              Emissão de NFS-e Nacional para MEI, ME e EPP.<br />
              Build · Migrate · Innovate.
            </p>
          </div>

          {/* Produtos */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
              Produtos
            </h4>
            <ul className="flex flex-col gap-2.5 text-sm text-text-2">
              <li><Link href="/mei"     className="hover:text-text-1 transition">NotaFácil MEI</Link></li>
              <li><Link href="/me"      className="hover:text-text-1 transition">NotaFácil Empresa</Link></li>
              <li><Link href="/gateway" className="hover:text-text-1 transition">NotaFácil API</Link></li>
              <li><Link href="/precos"  className="hover:text-text-1 transition">Planos e preços</Link></li>
              <li><Link href="/blog"    className="hover:text-text-1 transition">Blog</Link></li>
            </ul>
          </div>

          {/* Desenvolvedores — visível apenas em páginas não-MEI/ME */}
          {!isEndUser && (
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
                Desenvolvedores
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-text-2">
                <li><Link href="/docs"             className="hover:text-text-1 transition">Documentação</Link></li>
                <li><Link href="/docs/quickstart"  className="hover:text-text-1 transition">Quickstart</Link></li>
                <li><Link href="/docs/sdks"        className="hover:text-text-1 transition">SDKs</Link></li>
                <li><Link href="/sandbox"          className="hover:text-text-1 transition">Sandbox</Link></li>
                <li><Link href="/status"           className="hover:text-text-1 transition">Status da API</Link></li>
              </ul>
            </div>
          )}

          {/* Empresa */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
              Empresa
            </h4>
            <ul className="flex flex-col gap-2.5 text-sm text-text-2">
              <li>
                <a href="https://www.scantelburydevs.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-text-1 transition">
                  ScantelburyDevs ↗
                </a>
              </li>
              <li><Link href="/privacidade" className="hover:text-text-1 transition">Privacidade</Link></li>
              <li><Link href="/termos"      className="hover:text-text-1 transition">Termos de uso</Link></li>
              <li><CookiePreferencesLink /></li>
              <li>
                <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">
                  Suporte
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-600 pt-6 flex flex-col gap-3 text-xs text-text-2">
          {/* Linha 1 — dados legais (exigência Google Ads BR + LGPD)
              Setar NEXT_PUBLIC_LEGAL_CNPJ, NEXT_PUBLIC_LEGAL_RAZAO, NEXT_PUBLIC_LEGAL_ADDRESS no Vercel.
              Sem env vars setadas, esconde a linha — evita placeholders no ar. */}
          {process.env.NEXT_PUBLIC_LEGAL_CNPJ && (
            <div className="text-text-2/80 leading-relaxed">
              {process.env.NEXT_PUBLIC_LEGAL_RAZAO ?? 'ScantelburyDevs'} · CNPJ{' '}
              {process.env.NEXT_PUBLIC_LEGAL_CNPJ}
              {process.env.NEXT_PUBLIC_LEGAL_ADDRESS && (
                <> · {process.env.NEXT_PUBLIC_LEGAL_ADDRESS}</>
              )}
            </div>
          )}
          {/* Linha 2 — copyright + crédito */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>© {new Date().getFullYear()} ScantelburyDevs · Todos os direitos reservados</span>
            <a
              href="https://www.scantelburydevs.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-1 transition font-mono"
            >
              Desenvolvido por ScantelburyDevs ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
