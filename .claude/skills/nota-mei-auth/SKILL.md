---
name: nota-mei-auth
description: Auth flow — magic link callback (PKCE + OTP token_hash), Supabase config, sessões, /api/dev/magic-link admin. Use SEMPRE que mexer em `apps/web/app/auth/`, `apps/web/app/api/dev/magic-link/`, ou debugar problemas de login.
---

# Auth — magic link callback + sessão

## ⚠️ Bug clássico — generateLink joga token no HASH

Supabase `auth.admin.generateLink({type:'magiclink'})` retorna URL apontando pra:
```
https://<proj>.supabase.co/auth/v1/verify?token=<HASH>&type=magiclink&redirect_to=<APP>
```

Quando seguido, Supabase redireciona pra `<APP>` com token NO HASH:
```
https://app.com/auth/callback#access_token=eyJhbGc...
```

**Hash NUNCA chega no server route.** Route handler que só lê `?code=` (PKCE) sempre cai em `auth_callback_failed`. Foi o bug P0 da sessão 2026-06-08 (commit `0d7a248`).

## ✅ Solução em 2 lados

### 1. `/api/dev/magic-link` reescreve o action_link

Em vez de retornar o link do Supabase, extrai o `token` e constrói URL direto pra `/auth/callback?token_hash=...&type=magiclink&next=/home`:

```ts
const originalLink = data?.properties?.action_link  // do generateLink
const parsed = new URL(originalLink)
const tokenHash = parsed.searchParams.get('token')
const linkType  = parsed.searchParams.get('type') ?? 'magiclink'

const direct = new URL(`${APP_ORIGIN}/auth/callback`)
direct.searchParams.set('token_hash', tokenHash)
direct.searchParams.set('type', linkType)
direct.searchParams.set('next', '/home')
const actionLink = direct.toString()
```

Token no query string → chega no server → callback troca por session.

### 2. `/auth/callback/route.ts` aceita os 2 flows

```ts
const code = searchParams.get('code')
const tokenHash = searchParams.get('token_hash')
const otpType = searchParams.get('type')

const hasPkce = !!code
const hasOtp = !!tokenHash && !!otpType

if (hasPkce || hasOtp) {
  // ... cria supabase server client com cookie setter na response ...

  const authResult = hasPkce
    ? await supabase.auth.exchangeCodeForSession(code!)
    : await supabase.auth.verifyOtp({
        type: otpType as EmailOtpType,
        token_hash: tokenHash!,
      })

  if (!authResult.error && authResult.data?.user) {
    // ... ME/EPP first-login linkage (user_id NULL → auth.uid()) ...
    return redirectResponse  // com cookies attached
  }
}

return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
```

### 3. Template Supabase Dashboard (PENDENTE em prod)

Pra magic link **no email real** funcionar, o template precisa ser atualizado:

**Authentication → Email Templates → Magic Link**:

Antes:
```html
<a href="{{ .ConfirmationURL }}">Entrar</a>
```

Depois:
```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/home">Entrar</a>
```

⚠️ Sem essa mudança o admin link via `/api/dev/magic-link` funciona, mas magic link recebido por email do user real continua quebrado.

## /api/dev/magic-link — uso pra QA

Rota gateada por `DEV_ADMIN_TOKEN` (env Vercel). Permite gerar magic link pra qualquer email cadastrado sem precisar de OTP por email.

```bash
curl -X POST https://www.emitirnotafacil.com.br/api/dev/magic-link \
  -H "Authorization: Bearer $DEV_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@scantelburydevs.com.br"}'
```

Resposta:
```json
{
  "action_link": "https://www.emitirnotafacil.com.br/auth/callback?token_hash=...&type=magiclink&next=/home",
  "email": "contato@scantelburydevs.com.br"
}
```

Abrir `action_link` em janela anônima → sessão criada + redirect /home.

**Defesas em profundidade** já no código:
- Token comparado com `timingSafeEqual` (anti timing-attack)
- Em produção exige token ≥32 chars
- Email validado por regex
- Resposta de erro genérica
- Sem `DEV_ADMIN_TOKEN` setado → 503 (rota desabilitada)

## Compartilhamento de cookie entre tabs

Cookies do Supabase são scoped pelo domínio (`.emitirnotafacil.com.br`). **Nova tab herda cookie** — se já tem sessão de outro user, magic link de email diferente **não troca** porque session válida ainda existe.

Pra forçar troca de conta:

```js
// DevTools console — limpar tudo do domínio
document.cookie.split(";").forEach(c => {
  const name = c.split("=")[0].trim()
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.emitirnotafacil.com.br`
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=emitirnotafacil.com.br`
})
localStorage.clear()
sessionStorage.clear()
```

## ME/EPP first-login linkage

ME/EPP cadastra via `POST /v1/auth/register/me` (Go) **antes** do Supabase auth account existir. Empresa fica com `user_id = NULL`.

No primeiro login (magic link), o callback **linka**:
```ts
// Usa service role pra bypass RLS (user.id ainda não bate com empresa.user_id)
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const { data: unlinked } = await adminClient
  .from('empresas')
  .select('id, email')
  .ilike('email', userEmail.toLowerCase())
  .is('user_id', null)
  .limit(1)
  .maybeSingle()

if (unlinked) {
  await adminClient
    .from('empresas')
    .update({ user_id: sessionData.user.id })
    .eq('id', unlinked.id)
}
```

Atenção: query case-insensitive (`ilike`) porque empresa pode ter sido salva com case diferente do auth.users (Supabase normaliza pra lowercase).

## Sessão Supabase — config

No `supabase/config.toml` local:
```toml
jwt_expiry = 3600         # 1h pro JWT
[auth.sessions]
inactivity_timeout = "24h"  # logout após 24h sem uso
timebox = "168h"            # max 7d mesmo com atividade
```

**⚠️ Dashboard prod precisa ser editado manualmente** — `supabase db push` NÃO aplica `auth.*`:

Authentication → Sessions:
- inactivity_timeout: `86400` (24h em segundos)
- timebox: `604800` (7 dias em segundos)

## Middleware exclui /auth/callback

`apps/web/middleware.ts` matcher **NÃO pode** rodar antes do callback — o middleware tenta `getUser()` antes do cookie ser setado pela response do callback. Garantir que callback está no exclude list.

## Convenção PKCE vs OTP

| Flow | Trigger | Param query | Método |
|---|---|---|---|
| PKCE | `/login` client-side com `supabase.auth.signInWithOtp()` | `?code=...` | `exchangeCodeForSession(code)` |
| OTP | Magic link no email OU `/api/dev/magic-link` | `?token_hash=...&type=...` | `verifyOtp({type, token_hash})` |

Callback aceita **AMBOS** — usa o param correto pra decidir.

## Sintomas de bug e diagnóstico

| Sintoma | Causa provável |
|---|---|
| Login falha com `auth_callback_failed` | Callback antigo só lê `?code=` (regressão) |
| URL final tem `#access_token=...` no hash | generateLink não foi reescrito ou template Dashboard não foi atualizado |
| `/login` mostra "O link expirou ou é inválido" | Token já consumido OU sessão atual rejeita verifyOtp |
| Cookie do user antigo persiste | Limpar via DevTools antes do magic link novo |
| ME/EPP login mas dashboard mostra dados MEI | Cookie de sessão MEI persistiu — limpar e retentar |
