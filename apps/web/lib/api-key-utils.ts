/**
 * Helpers compartilhados pra geração/hash de API keys.
 * Espelha a lógica do Go em apps/api/internal/auth/repository.go.
 */

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Gera uma nova API key (plain + hash + prefix).
 * Default é `sk_live_` (produção). Pra ambientes de teste, passar `test`.
 */
export async function generateAPIKey(
  env: 'live' | 'test' = 'live',
): Promise<{ plain: string; hash: string; prefix: string }> {
  const prefix = `sk_${env}_`
  const rawHex = randomHex(32)
  const plain  = `${prefix}${rawHex}`
  const hash   = await sha256Hex(plain)
  return { plain, hash, prefix }
}

/**
 * Token URL-safe pra link público. Usa hex (não base64) pra evitar
 * caracteres especiais que precisam encoding.
 */
export function generateLinkToken(): string {
  return randomHex(24) // 48 chars hex = ~192 bits de entropia, mais que suficiente
}
