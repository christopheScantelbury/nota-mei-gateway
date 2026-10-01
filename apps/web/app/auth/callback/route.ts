import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { enqueueBrevoEvent } from '@/lib/brevo/events'
import { linkUnlinkedEmpresa } from '@/lib/auth/link-empresa'

/**
 * Auth callback handler — aceita DOIS flows:
 *
 * 1. **PKCE** (`?code=...`): usado quando o `/login` client-side faz
 *    `signInWithOtp` com PKCE. Trocamos `code` por session via
 *    `exchangeCodeForSession`.
 *
 * 2. **OTP token_hash** (`?token_hash=...&type=...`): usado quando o
 *    magic link aponta direto pra cá com o hash do token. Verificamos
 *    via `verifyOtp` que estabelece a session.
 *
 * ⚠️ Bug descoberto 2026-06-08: o callback antigo só lidava com PKCE.
 * Supabase `auth.admin.generateLink({type:'magiclink'})` (usado por
 * /api/dev/magic-link) e o template de email padrão geram URLs do tipo
 * `https://<proj>.supabase.co/auth/v1/verify?token=...&redirect_to=...`
 * que redirecionam pra `redirect_to` com token NO HASH (`#access_token=...`).
 * Hash não chega no server → callback caía em auth_callback_failed.
 *
 * Fix: o magic-link agora aponta direto pra `/auth/callback?token_hash=...&
 * type=magiclink&next=/home` (sem passar pelo /auth/v1/verify). Aqui
 * chamamos `verifyOtp({type, token_hash})` que troca por session.
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
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type')
  const next = searchParams.get('next') ?? '/home'
  const target = next.startsWith('/') ? next : '/home'

  const hasPkce = !!code
  const hasOtp = !!tokenHash && !!otpType

  if (hasPkce || hasOtp) {
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

    // Troca o token por session conforme o flow detectado.
    const authResult = hasPkce
      ? await supabase.auth.exchangeCodeForSession(code!)
      : await supabase.auth.verifyOtp({
          type: otpType as EmailOtpType,
          token_hash: tokenHash!,
        })
    const sessionData = authResult.data
    const error = authResult.error

    if (!error && sessionData?.user) {
      // ── ME/EPP first-login linkage (ver lib/auth/link-empresa.ts) ──────────
      // Também roda no layout do dashboard — cobre login por código/senha.
      await linkUnlinkedEmpresa(sessionData.user.id, sessionData.user.email, 'callback')

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
