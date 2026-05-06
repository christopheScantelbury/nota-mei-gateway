/** Strip diacritics e lowercase para busca insensível a acentos */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Zero-pad IBGE id para 7 dígitos */
export function toCode(id: number): string {
  return String(id).padStart(7, '0')
}
