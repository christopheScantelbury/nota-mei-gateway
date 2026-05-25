import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth callback handler for Magic Link / OAuth providers.
 * Supabase redirects here after login with a `code` param (PKCE flow).
 * We exchange it for a session, set the cookie on the redirect response,
 * and forward the user to the dashboard.
 *
 * IMPORTANT: this route MUST be excluded from the middleware matcher so
 * the middleware's getUser() call doesn't run before the session is set.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'
  const target = next.startsWith('/') ? next : '/home'

  if (code) {
    // Build the redirect response first so we can attach cookies to it.
    const redirectResponse = NextResponse.redirect(`${origin}${target}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            // Write auth cookies directly onto the redirect response so they
            // are included in the Set-Cookie headers sent back to the browser.
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }
  }

  // No code or exchange failed — send back to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
