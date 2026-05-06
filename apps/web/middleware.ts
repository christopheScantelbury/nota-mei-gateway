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

// Domínio único de produção: emitirnotafacil.com.br
// Ambos os produtos (MEI e Gateway) rodam aqui. A separação é feita
// pelo campo tipo_usuario no banco, não por domínio.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
