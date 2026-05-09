import type { Metadata } from 'next'
import Link from 'next/link'
import PostLayout from '@/components/blog/PostLayout'
import { getPost } from '@/lib/blog/manifest'

const SLUG = 'certificado-a1-mei-passo-a-passo'
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
        Para emitir NFS-e Nacional, o MEI precisa de um{' '}
        <strong>certificado digital A1</strong> — uma assinatura eletrônica
        que comprova que aquela nota foi emitida pelo CNPJ correto. Sem ele,
        o XML não é aceito pela Receita.
      </p>

      <h2>O que é certificado A1</h2>
      <p>
        É um arquivo (geralmente <code>.pfx</code> ou <code>.p12</code>) que
        funciona como sua identidade digital. Tem validade de <strong>1
        ano</strong> e fica instalado no computador, navegador ou plataforma
        de emissão. Difere do A3 (que vem em pen drive ou cartão).
      </p>

      <h2>Onde adquirir</h2>
      <h3>Opção 1 — Certificadora paga (recomendado)</h3>
      <p>
        Custa entre R$ 100 e R$ 220 por ano. As principais:
      </p>
      <ul>
        <li><strong>Certisign</strong> — referência de mercado, atendimento online ou presencial</li>
        <li><strong>Serasa Experian</strong> — emite via app no celular (Mobile ID)</li>
        <li><strong>Soluti</strong> — preço competitivo, processo 100% online</li>
        <li><strong>AC Safeweb</strong> — entrega rápida</li>
      </ul>
      <p>
        Processo: você compra online, faz uma videoconferência de validação
        (10 min, mostra documentos) e recebe o arquivo <code>.pfx</code> com
        senha por e-mail.
      </p>

      <h3>Opção 2 — Gratuito (e-CPF, mais limitado)</h3>
      <p>
        A Receita Federal disponibiliza certificado gratuito{' '}
        <strong>e-CPF</strong> via portal gov.br. Funciona para emissão de
        NFS-e desde que o CPF do titular seja vinculado ao CNPJ MEI.
        Vantagem: zero custo. Desvantagem: processo de obtenção é menos
        amigável.
      </p>

      <h2>Como instalar na NotaFácil</h2>
      <ol>
        <li>
          <Link href="/cadastro?produto=mei">Cadastra seu MEI</Link> na
          plataforma
        </li>
        <li>
          Na tela de configurações, clica em <strong>"Adicionar certificado"</strong>
        </li>
        <li>
          Faz upload do arquivo <code>.pfx</code> e digita a senha
        </li>
        <li>
          Pronto — todas as suas notas vão ser assinadas automaticamente
        </li>
      </ol>
      <p>
        O certificado é armazenado <strong>cifrado no AWS Secrets Manager</strong>{' '}
        — nunca em disco aberto, nunca em texto puro. Só é descriptografado em
        memória no momento exato da assinatura.
      </p>

      <h2>Quando renovar</h2>
      <p>
        Programa-se: a NotaFácil avisa por e-mail e dashboard{' '}
        <strong>30 dias antes do vencimento</strong>. Se passar do prazo, as
        emissões são bloqueadas até subir o novo. Renovação é o mesmo processo
        do primeiro upload.
      </p>

      <blockquote>
        <strong>Dica:</strong> deixe a senha do .pfx anotada num gerenciador
        de senhas (1Password, Bitwarden). Sem ela, o arquivo é inútil.
      </blockquote>

      <p>
        Próximo passo: ler o{' '}
        <Link href="/blog/nfse-nacional-obrigatoria-mei">guia da NFS-e
        Nacional obrigatória</Link> para entender o que muda em 2026.
      </p>
    </PostLayout>
  )
}
