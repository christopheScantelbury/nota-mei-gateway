import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated Supabase session.
const PROTECTED_PREFIXES = ['/home', '/notas', '/billing', '/configuracoes', '/templates', '/recorrencias']

// Routes that should redirect to /home if already authenticated.
const AUTH_ROUTES = ['/login', '/recuperar-senha']

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

  // Redirect unauthenticated users away from protected routes.
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages.
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))
  if (isAuthRoute && user) {
    const nextParam = request.nextUrl.searchParams.get('next')
    const target = nextParam && nextParam.startsWith('/') ? nextParam : '/home'
    const dest = request.nextUrl.clone()
    dest.pathname = target
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
     */
    '/((?!_next/static|_next/image|favicon.ico|brand/|api/).*)',
  ],
}
