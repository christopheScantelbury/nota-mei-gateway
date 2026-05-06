import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Signs the user out and redirects to the landing page.
 *
 * Pattern mirrors auth/callback/route.ts: build the redirect response FIRST
 * so Supabase can attach the cleared auth cookies to it via setAll().
 * Using redirect() from next/navigation here would throw before the cookies
 * are written onto the response — the session would survive the redirect.
 */
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  // 303 See Other: converte POST → GET no redirect, evitando HTTP 405 na landing.
  // NextResponse.redirect() usa 307 por padrão, que preserva o método HTTP.
  const response = NextResponse.redirect(url, { status: 303 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  await supabase.auth.signOut()
  return response
}
