import type { Metadata } from 'next'
import Link from 'next/link'
import PostLayout from '@/components/blog/PostLayout'
import { getPost } from '@/lib/blog/manifest'

const SLUG = 'nfse-nacional-obrigatoria-mei'
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
        A partir de <strong>1º de setembro de 2026</strong>, todo MEI prestador
        de serviço passa a ser obrigado a emitir <strong>NFS-e do padrão
        nacional</strong> (NFS-e Nacional), gerenciado pela Receita Federal.
        A mudança encerra um cenário em que cada município operava o próprio
        sistema com regras distintas.
      </p>

      <h2>Quem precisa emitir</h2>
      <p>
        A obrigatoriedade vale para o MEI que <strong>presta serviços</strong>{' '}
        — não para o MEI que apenas comercializa produtos (esse continua usando
        NFC-e ou NF-e, conforme o estado). Se você atua em consultoria,
        marketing, design, manutenção, beleza, transporte de passageiros ou
        qualquer outro serviço listado no MEI, está dentro.
      </p>

      <h2>O que muda na prática</h2>
      <ul>
        <li>
          <strong>Padrão único nacional:</strong> mesmo XML, mesmo formato,
          mesmas regras em todos os 5.000+ municípios aderentes
        </li>
        <li>
          <strong>Certificado digital A1 obrigatório</strong> para assinar o
          XML (mesmo formato usado por NF-e tradicional)
        </li>
        <li>
          <strong>Código NBS</strong> — Nomenclatura Brasileira de Serviços —
          em vez do código de serviço municipal
        </li>
        <li>
          <strong>Emissão por API ou portal</strong> nacional do gov.br
        </li>
      </ul>

      <h2>Como começar</h2>
      <p>
        Há três caminhos:
      </p>
      <ol>
        <li>
          <strong>Portal nacional do gov.br</strong> — gratuito, mas exige que
          você entenda da estrutura do XML, códigos NBS, alíquotas municipais.
          Não muito amigável para o MEI iniciante.
        </li>
        <li>
          <strong>Plataforma especializada</strong> (como a{' '}
          <Link href="/mei">NotaFácil MEI</Link>) — você preenche um formulário
          simples ou usa o app no celular, e a plataforma cuida do XML,
          assinatura, envio e acompanhamento.
        </li>
        <li>
          <strong>Integração via API</strong> — para quem tem sistema próprio
          (SaaS, ERP, marketplace), via{' '}
          <Link href="/gateway">NotaFácil API</Link>.
        </li>
      </ol>

      <h2>O que fazer agora</h2>
      <p>
        Mesmo que a obrigatoriedade só comece em setembro/2026, é recomendável
        já <strong>adquirir o certificado A1</strong> e fazer um cadastro
        prévio numa plataforma. Veja nosso{' '}
        <Link href="/blog/certificado-a1-mei-passo-a-passo">guia
        passo-a-passo do certificado A1</Link> para começar.
      </p>

      <blockquote>
        <strong>Resumo:</strong> MEI prestador de serviço terá que emitir
        NFS-e Nacional a partir de set/2026. Adquira certificado A1, escolha
        uma plataforma de emissão e cadastre-se com antecedência para evitar
        correria nas primeiras semanas.
      </blockquote>
    </PostLayout>
  )
}
