/**
 * Constantes tributárias centralizadas.
 *
 * ⚠️ Revisar anualmente (janeiro de cada ano).
 *
 * Não use valores tributários hardcoded em componentes — sempre importe daqui.
 * Quando o salário mínimo ou os limites do Simples mudarem, basta atualizar
 * este arquivo (e o ANO_REFERENCIA) e todo o app reflete.
 *
 * Fontes oficiais:
 *  - MEI         : LC 123/2006 art. 18-A, atualizada por LC 188/2021 e LC 226/2022
 *  - ME/EPP      : LC 123/2006 art. 3º (limites de receita bruta anual)
 *  - DAS-MEI     : Resolução CGSN nº 140/2018 + valor anual do salário mínimo
 *  - Anexos SN   : LC 123/2006 anexos III, IV, V (alíquotas por faixa)
 *  - Salário mínimo 2025: Decreto 12.342/2024 (R$ 1.518,00)
 */

/** Ano de referência destes valores. Atualizar ao revisar. */
export const ANO_REFERENCIA = 2025

/** Salário mínimo nacional vigente */
export const SALARIO_MINIMO = 1518.00

// ── Limites de receita bruta anual (LC 123/2006) ────────────────────────────

export const LIMITE_RECEITA = {
  /** MEI — LC 188/2021 / LC 226/2022 (proposta R$ 144.913,41; vigente: 81k) */
  MEI: 81_000,
  /** ME — Microempresa */
  ME:  360_000,
  /** EPP — Empresa de Pequeno Porte */
  EPP: 4_800_000,
} as const

// ── DAS-MEI (Documento de Arrecadação do Simples — MEI) ─────────────────────
//
// Composto por:
//   · INSS: 5% do salário mínimo (todos)
//   · ICMS: R$ 1,00 (comércio / indústria — Anexo XI alíneas a, b, c)
//   · ISS : R$ 5,00 (serviços — Anexo XI alínea d)

export const DAS_MEI = {
  inss:        SALARIO_MINIMO * 0.05,             // R$ 75,90 (2025)
  icms:        1.00,
  iss:         5.00,
  /** Comércio ou indústria (INSS + ICMS) */
  comercio:    SALARIO_MINIMO * 0.05 + 1.00,      // R$ 76,90 (2025)
  /** Serviços (INSS + ISS) */
  servicos:    SALARIO_MINIMO * 0.05 + 5.00,      // R$ 80,90 (2025)
  /** Comércio + serviços (INSS + ICMS + ISS) */
  comercioEServicos: SALARIO_MINIMO * 0.05 + 1.00 + 5.00,  // R$ 81,90 (2025)
} as const

// ── Formatadores ─────────────────────────────────────────────────────────────

const fmtBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** "R$ 81.000,00" — para valores cheios */
export function fmtMoney(value: number): string {
  return fmtBRL.format(value)
}

/** "R$ 81 mil" / "R$ 4,8 mi" — formato compacto, útil em copy */
export function fmtMoneyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (value >= 1_000) {
    return `R$ ${Math.round(value / 1_000)} mil`
  }
  return fmtBRL.format(value)
}

// ── Helpers de copy ──────────────────────────────────────────────────────────

/**
 * Texto curto descrevendo o DAS-MEI por categoria.
 * Ex.: "DAS fixo mensal (cerca de R$ 80,90 para serviços em 2025)"
 *
 * Use quando o usuário precisar de uma referência aproximada.
 * NUNCA use isso pra valor exato de cobrança — o DAS é gerado pela Receita.
 */
export function descricaoDASMei(categoria: 'comercio' | 'servicos' | 'ambos' = 'servicos'): string {
  const valor = DAS_MEI[categoria === 'ambos' ? 'comercioEServicos' : categoria]
  return `${fmtMoney(valor)} em ${ANO_REFERENCIA}`
}
