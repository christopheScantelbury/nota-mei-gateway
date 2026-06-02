import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { enqueueBrevoEvent } from '@/lib/brevo/events'

/**
 * Auth callback handler for Magic Link / OAuth providers.
 * Supabase redirects here after login with a `code` param (PKCE flow).
 * We exchange it for a session, set the cookie on the redirect response,
 * and forward the user to the dashboard.
 *
 * Also handles first-time ME/EPP login: links auth.uid() to any empresa row
 * with matching email and user_id = NULL (created by POST /v1/auth/register/me
 * before the Supabase account existed).
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

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && sessionData?.user) {
      // ── ME/EPP first-login linkage ────────────────────────────────────────
      // When a ME/EPP empresa is registered via POST /v1/auth/register/me, the
      // Supabase auth account doesn't exist yet, so user_id is stored as NULL.
      // On the user's first login (Magic Link), we link user_id = auth.uid().
      // Uses service role to bypass RLS (the row has user_id=NULL so the user's
      // own RLS policy can't reach it yet).
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        try {
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { persistSession: false } }
          )
          // Find any empresa with matching email and no user_id yet
          const { data: unlinked } = await adminClient
            .from('empresas')
            .select('id')
            .eq('email', sessionData.user.email!)
            .is('user_id', null)
            .limit(1)
            .maybeSingle()

          if (unlinked) {
            await adminClient
              .from('empresas')
              .update({ user_id: sessionData.user.id })
              .eq('id', unlinked.id)
          }
        } catch {
          // Non-fatal — user can still access dashboard if empresa was already linked
        }
      }

      // HIST-6.1 — enfileira evento de signup (fire-and-forget, falha não bloqueia login)
      try {
        const ts = sessionData.user.created_at ?? new Date().toISOString()
        const isNewSignup = Math.abs(Date.now() - new Date(ts).getTime()) < 5 * 60_000 // < 5min
        if (isNewSignup && sessionData.user.email) {
          await enqueueBrevoEvent({
            eventName: 'user_signup',
            email: sessionData.user.email,
            properties: { user_id: sessionData.user.id },
          })
        }
      } catch { /* non-fatal */ }
    }

    if (!error) {
      return redirectResponse
    }
  }

  // No code or exchange failed — send back to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
