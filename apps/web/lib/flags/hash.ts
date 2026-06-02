// Hash determinístico djb2 — sem dependência externa.
//
// Spec: HIST-7.4. Garante que (sessionId, flagKey) sempre mapeia pro mesmo
// bucket 0..99, então o usuário sempre vê a mesma variante.

/** djb2 → 0..99 */
export function bucket(sessionId: string, flagKey: string): number {
  const input = `${sessionId}:${flagKey}`
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100
}
