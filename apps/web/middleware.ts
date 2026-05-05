import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated Supabase session.
const PROTECTED_PREFIXES = [
  '/home', '/notas', '/billing', '/configuracoes',
  '/templates', '/recorrencias', '/api-keys', '/webhooks',
]

// Routes that require admin role (app_metadata.role === 'admin').
const ADMIN_PREFIXES = ['/admin']

// Routes that should redirect to /notas if already authenticated.
const AUTH_ROUTES = ['/login', '/recuperar-senha']

// Domínios de produto — em produção, login redireciona para o domínio certo do usuário.
// O domain guard final fica no layout.tsx (tem acesso ao DB).
// Aqui só redirecionamos usuários já logados que batem em /login.
const PRODUCT_ORIGINS: Record<string, string> = {
  'notafacilmei.com.br':        'https://notafacilmei.com.br',
  'www.notafacilmei.com.br':    'https://notafacilmei.com.br',
  'notameigateway.com.br':      'https://notameigateway.com.br',
  'www.notameigateway.com.br':  'https://notameigateway.com.br',
}

// Hostname → path rewrite for multi-domain setup.
// Each product domain rewrites its root to the dedicated landing page.
// All other paths (cadastro, dashboard, etc.) are served normally regardless of domain.
const DOMAIN_REWRITES: Record<string, string> = {
  'notafacilmei.com.br':        '/mei',
  'www.notafacilmei.com.br':    '/mei',
  'notameigateway.com.br':      '/gateway',
  'www.notameigateway.com.br':  '/gateway',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''

  // Domain-based rewrite: serve product landing at the root of each domain.
  const rewriteTo = DOMAIN_REWRITES[hostname]
  if (rewriteTo && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = rewriteTo
    return NextResponse.rewrite(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always call getUser() so Supabase can refresh the session
  // token if needed — this updates the cookie and keeps the session alive.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Admin routes: exige autenticação + role === 'admin' ──
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
  if (isAdmin) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // app_metadata só pode ser definido server-side — seguro contra adulteração
    const role = user.app_metadata?.role
    if (role !== 'admin') {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/home'
      homeUrl.search = ''
      return NextResponse.redirect(homeUrl)
    }
  }

  // ── Dashboard routes: exige autenticação ──
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Auth pages: redireciona usuários já logados ──
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))
  if (isAuthRoute && user) {
    const nextParam = request.nextUrl.searchParams.get('next')
    const pathTarget = nextParam && nextParam.startsWith('/') ? nextParam : '/notas'

    // Em produção: redireciona para o domínio do produto correto.
    // O layout.tsx tem o tipo_usuario e fará a correção definitiva se necessário.
    const productOrigin = PRODUCT_ORIGINS[hostname]
    if (productOrigin) {
      const dest = new URL(pathTarget, productOrigin)
      return NextResponse.redirect(dest)
    }

    const dest = request.nextUrl.clone()
    dest.pathname = pathTarget
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - /brand/       (public brand assets)
     * - /api/         (route handlers manage their own auth)
     * - /auth/        (Supabase callback — must not be intercepted by middleware)
     * - /logos/       (public logo assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|brand/|logos/|api/|auth/).*)',
  ],
}
