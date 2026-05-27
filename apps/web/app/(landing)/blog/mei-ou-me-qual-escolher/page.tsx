import type { Metadata } from 'next'
import Link from 'next/link'
import PostLayout from '@/components/blog/PostLayout'
import { getPost } from '@/lib/blog/manifest'
import { LIMITE_RECEITA, DAS_MEI, ANO_REFERENCIA, fmtMoneyCompact, fmtMoney } from '@/lib/tributario'

const SLUG = 'mei-ou-me-qual-escolher'
const post = getPost(SLUG)!

export const metadata: Metadata = {
  title:       post.title,
  description: post.description,
  alternates:  { canonical: `https://emitirnotafacil.com.br/blog/${SLUG}` },
  openGraph: {
    title:       post.title,
    description: post.description,
    url:         `https://emitirnotafacil.com.br/blog/${SLUG}`,
    type:        'article',
    publishedTime: post.publishedAt,
    authors:     [post.author],
  },
}

export default function Page() {
  return (
    <PostLayout slug={SLUG}>
      <p>
        Empreendedor brasileiro vive uma encruzilhada clássica: <strong>MEI ou
        ME</strong>? A resposta depende do faturamento, da atividade e dos
        planos de crescimento. Comparativo direto:
      </p>

      <h2>Resumo rápido</h2>
      <ul>
        <li>
          <strong>MEI</strong> — até {fmtMoney(LIMITE_RECEITA.MEI)}/ano,
          DAS mensal fixo (~{fmtMoney(DAS_MEI.servicos)} para serviços em {ANO_REFERENCIA}),
          máx. 1 funcionário, sem sócio. Atividades restritas.
        </li>
        <li>
          <strong>ME (Microempresa)</strong> — até {fmtMoney(LIMITE_RECEITA.ME)}/ano, impostos
          variáveis (Simples Nacional ou Lucro Presumido), aceita sócios e
          múltiplos funcionários. Atividades praticamente ilimitadas.
        </li>
      </ul>

      <h2>Quando o MEI é o caminho</h2>
      <p>Você é MEI ideal se:</p>
      <ul>
        <li>Fatura até {fmtMoneyCompact(LIMITE_RECEITA.MEI / 12)}/mês em média</li>
        <li>Atua sozinho ou com 1 ajudante</li>
        <li>Sua atividade está na lista do MEI</li>
        <li>Quer impostos previsíveis (DAS fixo)</li>
        <li>Não pretende ter sócio nos próximos anos</li>
      </ul>

      <h2>Quando vale virar ME</h2>
      <p>Considere migrar se:</p>
      <ul>
        <li>
          <strong>Faturamento subindo:</strong> está chegando perto dos{' '}
          {fmtMoney(LIMITE_RECEITA.MEI)}/ano e/ou tem perspectiva de ultrapassar
        </li>
        <li>
          <strong>Atividade não permitida no MEI:</strong> ex.: consultoria
          pesada, advocacia, medicina
        </li>
        <li>
          <strong>Quer contratar mais de 1 funcionário</strong>
        </li>
        <li>
          <strong>Vai ter sócio</strong>
        </li>
        <li>
          <strong>Precisa emitir nota acima do permitido pelo MEI</strong>{' '}
          (alguns clientes corporativos exigem ME para faturar)
        </li>
      </ul>

      <h2>O que muda no dia-a-dia ao virar ME</h2>
      <ul>
        <li>
          <strong>Contador:</strong> ME exige contador (cerca de R$
          250–500/mês). MEI faz tudo sozinho.
        </li>
        <li>
          <strong>Impostos:</strong> ME no Simples Nacional paga DAS variável
          (~6% do faturamento para serviços, dependendo do anexo). MEI paga
          fixo (~{fmtMoney(DAS_MEI.servicos)}/mês em {ANO_REFERENCIA}).
        </li>
        <li>
          <strong>NFS-e:</strong> ambos emitem pelo padrão nacional a partir
          de set/2026. Se hoje você é MEI usando NotaFácil, a{' '}
          <Link href="/configuracoes/migrar">migração para ME</Link> é
          automática — preserva todo o histórico de notas.
        </li>
        <li>
          <strong>Limites:</strong> ME permite até {fmtMoneyCompact(LIMITE_RECEITA.ME)}/ano. Acima disso,
          vai para EPP (até {fmtMoneyCompact(LIMITE_RECEITA.EPP)}/ano).
        </li>
      </ul>

      <h2>Como migrar</h2>
      <p>
        A migração de MEI para ME envolve:
      </p>
      <ol>
        <li>
          <strong>Desenquadramento do MEI</strong> no Portal do Empreendedor
          (gov.br)
        </li>
        <li>
          <strong>Alteração contratual</strong> na Junta Comercial do estado
        </li>
        <li>
          <strong>Escolha do regime tributário:</strong> Simples Nacional
          (mais comum) ou Lucro Presumido
        </li>
        <li>
          <strong>Contratação de contador</strong> para escriturações mensais
        </li>
        <li>
          <strong>Novo certificado A1 emitido para o CNPJ ME</strong> (mesmo
          número se preservou)
        </li>
      </ol>
      <p>
        Na NotaFácil, basta entrar em <Link href="/configuracoes/migrar">
        Configurações → Migrar para ME</Link> e o histórico de emissões fica
        preservado automaticamente.
      </p>

      <blockquote>
        <strong>Regra prática:</strong> se você está faturando consistentemente
        acima de R$ 5.500/mês ou planeja contratar/sociar nos próximos 12
        meses, comece a estudar a migração para ME já. Se está bem abaixo
        disso, fica MEI tranquilo.
      </blockquote>

      <p>
        Continue lendo:{' '}
        <Link href="/blog/nfse-nacional-obrigatoria-mei">NFS-e Nacional obrigatória em 2026</Link>{' '}
        ·{' '}
        <Link href="/blog/certificado-a1-mei-passo-a-passo">Certificado A1 passo-a-passo</Link>
      </p>
    </PostLayout>
  )
}
