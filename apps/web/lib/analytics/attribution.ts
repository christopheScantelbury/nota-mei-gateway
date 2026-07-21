// Atribuição de origem do cadastro — medição independente do GA4.
//
// POR QUE ISTO EXISTE
// O GA4 só reporta quem aceita o banner de cookies (Consent Mode v2 começa
// tudo `denied`, e a modelagem comportamental que recuperaria os pings sem
// cookie exige ~1.000 eventos/dia — volume que este site não tem). Na prática
// isso escondia ~90% do tráfego pago: 77 cliques no Google Ads viraram 8
// sessões visíveis no GA4, e o teste da campanha ME terminaria sem resposta.
//
// Aqui capturamos gclid/utm_* direto da URL de entrada e mandamos junto com o
// cadastro, que grava no banco. O banco vira a fonte da verdade pra pergunta
// "a campanha gerou cadastro?" — imune a consent, adblock e modelagem.
//
// ESCOPO / PRIVACIDADE
// Cookie first-party (`nf_attr`), sem dado pessoal: só identificadores de
// campanha que o próprio Google anexa na URL do clique. Não é usado pra
// personalizar anúncio nem é compartilhado — serve só pra atribuir um cadastro
// nosso à campanha que o originou. Distinto do `nf_consent`, que controla GA4.

export const ATTRIBUTION_COOKIE = 'nf_attr'
const NINETY_DAYS_S = 60 * 60 * 24 * 90

export type Attribution = {
  gclid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  landing_page?: string
  referrer?: string
}

/** Parâmetros de clique pago. gbraid/wbraid substituem o gclid quando o
 *  usuário está em contexto sem cookie cross-site (iOS/app). */
const CLICK_IDS = ['gclid', 'gbraid', 'wbraid'] as const
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

/** Trunca pra não estourar coluna nem carregar lixo de URLs malformadas. */
function clean(v: string | null, max = 255): string | undefined {
  if (!v) return undefined
  const t = v.trim().slice(0, max)
  return t.length > 0 ? t : undefined
}

/**
 * Lê a URL atual e persiste a origem se houver sinal de campanha.
 *
 * Modelo **last non-direct touch**: uma nova visita com gclid/utm sobrescreve
 * a anterior. É o mesmo modelo do Google Ads (last click), então o que
 * gravamos no cadastro bate com o que o Ads credita à campanha. Visita sem
 * nenhum parâmetro NÃO apaga a atribuição anterior — senão o usuário que
 * clica no anúncio hoje e volta direto amanhã pra se cadastrar apareceria
 * como orgânico, que é justamente o erro que estamos consertando.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)

  const attr: Attribution = {}
  for (const key of CLICK_IDS) {
    const v = clean(params.get(key))
    if (v) {
      attr.gclid = v
      break // um só; gclid tem precedência pela ordem do array
    }
  }
  for (const key of UTM_KEYS) {
    const v = clean(params.get(key))
    if (v) attr[key] = v
  }

  // Sem sinal de campanha nesta visita → preserva o que já havia.
  if (Object.keys(attr).length === 0) return

  attr.landing_page = clean(window.location.pathname + window.location.search, 500)
  attr.referrer = clean(document.referrer, 255)

  try {
    document.cookie =
      `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attr))}` +
      `; path=/; max-age=${NINETY_DAYS_S}; SameSite=Lax`
  } catch {
    // Cookie bloqueado (modo restrito do navegador). Não é fatal: o cadastro
    // segue normalmente, só perde a atribuição.
  }
}

/** Lê a atribuição persistida. Retorna `null` quando não há nada gravado. */
export function getAttribution(): Attribution | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ATTRIBUTION_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Attribution
  } catch {
    // Cookie corrompido — ignora em vez de quebrar o cadastro.
    return null
  }
}
