import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'crypto'

// POST /api/auth/register-dev
//
// Cadastro simplificado pra desenvolvedor integrador (Gateway).
// Diferente do cadastro MEI/ME que exige CNPJ + cert A1, o dev pode entrar
// na plataforma SEM ter empresa cadastrada — ele cadastra empresas DEPOIS,
// quando for emitir notas reais em produção.
//
// Cria:
// 1. auth.users com user_metadata.is_dev_account=true + nome + empresa
// 2. api_key sk_test_ vinculada ao user_id (sandbox only)
// 3. Magic link enviado por e-mail pra primeiro login (sem senha)
//
// Body:
//   { nome: string, email: string, empresa_trabalha?: string }
//
// Response:
//   { user_id, api_key (sk_test_), email_otp_pending: true }

interface RegisterDevBody {
  nome?: string
  email?: string
  empresa_trabalha?: string
}

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: RegisterDevBody
  try {
    body = (await req.json()) as RegisterDevBody
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const nome = (body.nome ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const empresaTrabalha = (body.empresa_trabalha ?? '').trim()

  // Validações básicas
  if (!nome || nome.length < 2) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', field: 'nome', message: 'Nome obrigatório' },
      { status: 422 },
    )
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', field: 'email', message: 'E-mail inválido' },
      { status: 422 },
    )
  }

  const sb = service()

  // ── 1. Cria auth.user com email_confirm=true (sem senha — só OTP) ────────
  const tempPwd = randomBytes(32).toString('hex')
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: tempPwd,
    email_confirm: true,
    user_metadata: {
      nome,
      is_dev_account: true,
      empresa_trabalha: empresaTrabalha || null,
      tipo_usuario: 'gateway',
    },
  })

  if (createErr) {
    // E-mail já existe? Tratar gentil
    if (createErr.message?.toLowerCase().includes('already')) {
      return NextResponse.json(
        { error: 'EMAIL_ALREADY_EXISTS', message: 'E-mail já cadastrado. Faça login.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'CREATE_USER_FAILED', message: createErr.message },
      { status: 500 },
    )
  }

  const userId = created.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'NO_USER_RETURNED' }, { status: 500 })
  }

  // ── 2. Gera api_key sk_test_ (sandbox) vinculada ao user_id sem empresa ──
  const rawKey = `sk_test_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const { error: keyErr } = await sb.from('api_keys').insert({
    user_id: userId,
    empresa_id: null,
    key_hash: keyHash,
    key_prefix: 'sk_test_',
    label: 'Sandbox inicial',
  })

  if (keyErr) {
    // Rollback do user — não dá pra deixar user sem api key
    await sb.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json(
      { error: 'CREATE_KEY_FAILED', message: keyErr.message },
      { status: 500 },
    )
  }

  // ── 3. Dispara magic link OTP por e-mail (fire-and-forget) ────────────
  // IMPORTANTE: generateLink SÓ gera mas NÃO envia. Pra fazer o Supabase
  // mandar o e-mail (template PT-BR já configurado), precisamos chamar o
  // endpoint /auth/v1/otp com create_user=false (user já existe via
  // createUser acima). Bug descoberto pelo user que se cadastrou como dev
  // mas nunca recebeu o magic link.
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        email,
        create_user: false,
        // PKCE callback que troca code por session + redirect /home.
        // Apex sem www porque Supabase site_url=www e ele substitui
        // silenciosamente quando hostname diverge.
        email_redirect_to:
          'https://www.emitirnotafacil.com.br/auth/callback?next=/home',
      }),
    })
  } catch {
    /* não-fatal — user pode pedir reenviar OTP no login */
  }

  return NextResponse.json({
    user_id: userId,
    api_key: rawKey,
    email_otp_pending: true,
  }, { status: 201 })
}
