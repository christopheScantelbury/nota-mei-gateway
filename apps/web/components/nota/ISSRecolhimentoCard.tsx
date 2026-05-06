/**
 * ISSRecolhimentoCard — ME-42
 *
 * Card informativo que orienta a empresa sobre como recolher o ISS da
 * competência, exibido logo após a autorização da nota e na tela de detalhes.
 *
 * Simples Nacional (MEI ou ME/EPP):
 *   → DAS via PGDAS-D; tomador NÃO desconta ISS do pagamento
 *
 * Lucro Presumido / Lucro Real sem retenção:
 *   → DAM emitido no sistema Nota Manaus; vence dia 10 do mês seguinte
 *
 * Lucro Presumido / Lucro Real com ISS retido:
 *   → Tomador já reteve na fonte; empresa não precisa gerar DAM
 */

import type { RegimeTributario } from '@/lib/types'

interface ISSRecolhimentoCardProps {
  regime?: RegimeTributario | null
  issRetido?: boolean | null
  /** AAAA-MM — usado para calcular o vencimento do DAM */
  competencia?: string | null
}

/** Retorna o vencimento do DAM: dia 10 do mês seguinte à competência */
function vencimentoDAM(competencia: string): { iso: string; formatted: string; vencido: boolean } {
  const [ano, mes] = competencia.split('-').map(Number)
  const venc = new Date(ano, mes, 10) // mês é 0-indexed, então mes=mês seguinte
  const iso = venc.toISOString().slice(0, 10)
  const formatted = venc.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const vencido = new Date() > venc
  return { iso, formatted, vencido }
}

export default function ISSRecolhimentoCard({
  regime,
  issRetido,
  competencia,
}: ISSRecolhimentoCardProps) {
  // ISS retido na fonte → tomador já recolheu, não precisa de instrução
  if (
    issRetido === true &&
    (regime === 'LUCRO_PRESUMIDO' || regime === 'LUCRO_REAL')
  ) {
    return (
      <div className="rounded-xl border border-nota-upgrade/30 bg-nota-upgrade/10 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-nota-upgrade mb-1">
          <span className="h-2 w-2 rounded-full bg-nota-upgrade shrink-0" />
          ISS retido na fonte
        </div>
        <p className="text-text-2">
          O ISS foi retido pelo tomador de serviços. Você não precisa emitir DAM para
          esta competência — o recolhimento é responsabilidade do contratante.
        </p>
      </div>
    )
  }

  // Lucro Presumido / Lucro Real sem retenção → DAM via Nota Manaus
  if (regime === 'LUCRO_PRESUMIDO' || regime === 'LUCRO_REAL') {
    const dam =
      competencia && /^\d{4}-\d{2}$/.test(competencia)
        ? vencimentoDAM(competencia)
        : null

    return (
      <div
        className={`rounded-xl border p-4 text-sm ${
          dam?.vencido
            ? 'border-nota-rejeitada/30 bg-nota-rejeitada/10'
            : 'border-nota-processando/30 bg-nota-processando/10'
        }`}
      >
        <div
          className={`flex items-center gap-2 font-semibold mb-1 ${
            dam?.vencido ? 'text-nota-rejeitada' : 'text-nota-processando'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              dam?.vencido ? 'bg-nota-rejeitada' : 'bg-nota-processando'
            }`}
          />
          ISS recolhido via DAM — {regime === 'LUCRO_PRESUMIDO' ? 'Lucro Presumido' : 'Lucro Real'}
        </div>
        <p className="text-text-2 mb-2">
          Gere o Documento de Arrecadação Municipal (DAM) no sistema{' '}
          <a
            href="https://nota.manaus.am.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan hover:underline"
          >
            Nota Manaus
          </a>{' '}
          para recolher o ISS desta competência.
        </p>
        {dam && (
          <p
            className={`text-xs font-semibold ${
              dam.vencido ? 'text-nota-rejeitada' : 'text-nota-processando'
            }`}
          >
            {dam.vencido
              ? `⚠️ Vencimento: ${dam.formatted} — verifique multa e juros`
              : `Vence em: ${dam.formatted}`}
          </p>
        )}
      </div>
    )
  }

  // Simples Nacional (MEI ou ME/EPP) → DAS via PGDAS-D
  return (
    <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-brand-cyan mb-1">
        <span className="h-2 w-2 rounded-full bg-brand-cyan shrink-0" />
        ISS recolhido via DAS — Simples Nacional
      </div>
      <p className="text-text-2 mb-2">
        O ISS desta competência é recolhido mensalmente via DAS no PGDAS-D.{' '}
        <strong className="text-text-1">O tomador não desconta o ISS do pagamento.</strong>
      </p>
      <a
        href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATBHE/pgdasd2018.app.aspx"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-brand-cyan hover:underline"
      >
        Acessar PGDAS-D →
      </a>
    </div>
  )
}
