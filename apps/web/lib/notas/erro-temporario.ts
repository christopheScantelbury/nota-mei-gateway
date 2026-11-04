/**
 * Nota em ERRO_TEMPORARIO (#277): o erro_codigo gravado pelo DPSReconciler
 * (#273) diz o que o cliente deve fazer — e as orientações são opostas.
 *
 *  - AGUARDANDO_RECEITA (e STUCK, legado): sem resposta conclusiva da Receita;
 *    a nota pode ter sido autorizada. NÃO emitir de novo (duplicaria a NFS-e).
 *  - NAO_RECEBIDA: a Receita confirmou que não tem a DPS — pode emitir de novo.
 */
export type SituacaoErroTemporario = 'aguardando' | 'nao_recebida' | 'generico'

export function situacaoErroTemporario(erroCodigo: string | null | undefined): SituacaoErroTemporario {
  switch ((erroCodigo ?? '').toUpperCase()) {
    case 'AGUARDANDO_RECEITA':
    case 'STUCK':
      return 'aguardando'
    case 'NAO_RECEBIDA':
      return 'nao_recebida'
    default:
      return 'generico'
  }
}

export const TEXTO_ERRO_TEMPORARIO: Record<SituacaoErroTemporario, { badge: string; titulo: string; texto: string }> = {
  aguardando: {
    badge: 'Aguardando Receita',
    titulo: 'Aguardando confirmação da Receita',
    texto:
      'A Receita ainda não confirmou esta nota. Não emita novamente — ela pode já ter sido autorizada, ' +
      'e uma nova emissão duplicaria a NFS-e. O status é atualizado automaticamente.',
  },
  nao_recebida: {
    badge: 'Não recebida',
    titulo: 'A Receita não recebeu esta nota',
    texto: 'A Receita confirmou que esta nota não chegou até ela. Você pode emitir novamente com os mesmos dados.',
  },
  generico: {
    badge: 'Erro Temporário',
    titulo: 'Instabilidade momentânea na emissão',
    texto: 'Estamos tentando de novo automaticamente. Não emita novamente enquanto o status não mudar.',
  },
}
