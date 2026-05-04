import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth callback handler for Magic Link / OAuth providers.
 * Supabase redirects here after login with a `code` param.
 * We exchange it for a session, set the cookie and redirect to the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/notas'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to the intended destination or default dashboard.
      const target = next.startsWith('/') ? next : '/notas'
      return NextResponse.redirect(`${origin}${target}`)
    }
  }

  // Something went wrong — redirect to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
