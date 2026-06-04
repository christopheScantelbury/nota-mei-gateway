// Validador de senha forte — pura, sem dependências, usado em /login (futuro
// reset) e /configuracoes/senha.
//
// Política (alinhada com Supabase Auth padrão + nossa exigência):
//   - mínimo 8 caracteres
//   - pelo menos 1 minúscula
//   - pelo menos 1 maiúscula
//   - pelo menos 1 número
//
// Symbol não é obrigatório por padrão (usabilidade > paranoia em produto SaaS
// fiscal — quem precisa de mais segurança usa magic link OTP).

export interface PasswordValidation {
  ok: boolean
  errors: string[]
  /** 0..4 — feedback visual de força. */
  score: number
}

export function validatePassword(pw: string): PasswordValidation {
  const errors: string[] = []
  if (pw.length < 8)          errors.push('Mínimo 8 caracteres')
  if (!/[a-z]/.test(pw))      errors.push('Pelo menos 1 letra minúscula')
  if (!/[A-Z]/.test(pw))      errors.push('Pelo menos 1 letra MAIÚSCULA')
  if (!/[0-9]/.test(pw))      errors.push('Pelo menos 1 número')

  // Bonus pra score (não bloqueia, só pontua barra de força)
  let score = 0
  if (pw.length >= 8)         score++
  if (pw.length >= 12)        score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw))       score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  score = Math.min(4, score)

  return { ok: errors.length === 0, errors, score }
}

/** Helper UI: cor + label do score 0..4. */
export function passwordStrengthLabel(score: number): { label: string; color: string } {
  switch (score) {
    case 0: return { label: 'Muito fraca', color: 'bg-red-500' }
    case 1: return { label: 'Fraca',       color: 'bg-red-400' }
    case 2: return { label: 'Razoável',    color: 'bg-amber-500' }
    case 3: return { label: 'Forte',       color: 'bg-emerald-500' }
    case 4: return { label: 'Muito forte', color: 'bg-emerald-600' }
    default: return { label: '',           color: 'bg-gray-300' }
  }
}
