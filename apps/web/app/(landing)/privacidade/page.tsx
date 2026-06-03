import type { Metadata } from 'next'
import Link from 'next/link'
import LogoAdaptive from '@/components/ui/LogoAdaptive'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de Privacidade do Nota MEI Gateway — como coletamos, usamos e protegemos seus dados.',
  robots: { index: true, follow: true },
}

const LAST_UPDATE = '03 de maio de 2026'
const COMPANY = 'ScantelburyDevs'
const EMAIL   = 'privacidade@emitirnotafacil.com.br'

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-navy-900 text-text-1">
      {/* Minimal navbar */}
      <header className="border-b border-navy-600 bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            <LogoAdaptive
              lightSrc="/brand/notafacil-logo.svg"
              darkSrc="/brand/notafacil-logo-dark.svg"
              alt="NotaFácil"
              width={140}
              height={34}
              className="h-7 w-auto"
              priority
            />
          </Link>
          <Link href="/" className="text-sm text-text-2 hover:text-brand-cyan transition">
            ← Início
          </Link>
        </div>
      </header>

      <main>
      <div className="max-w-3xl mx-auto px-6 py-12">

        <h1 className="font-display text-4xl font-extrabold mb-2">Política de Privacidade</h1>
        <p className="text-text-2 text-sm mb-10">
          Última atualização: <span className="text-text-1">{LAST_UPDATE}</span>
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-sm text-text-2 leading-relaxed">

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como {COMPANY} (&quot;nós&quot;, &quot;nosso&quot;) coleta,
              usa, armazena e compartilha informações ao fornecer o Nota MEI Gateway. Estamos comprometidos
              com a proteção de dados pessoais nos termos da Lei Geral de Proteção de Dados (LGPD —
              Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">2. Dados coletados</h2>
            <p>Coletamos as seguintes categorias de dados:</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-text-1 font-medium">Dados cadastrais do MEI</p>
                <p>CNPJ, razão social, e-mail, município IBGE — necessários para a emissão de NFS-e.</p>
              </div>
              <div>
                <p className="text-text-1 font-medium">Certificado digital A1</p>
                <p>
                  Armazenado cifrado no AWS Secrets Manager. Nunca é salvo em disco ou exposto em logs.
                  Usado exclusivamente para assinar XMLs de NFS-e.
                </p>
              </div>
              <div>
                <p className="text-text-1 font-medium">Dados das notas fiscais</p>
                <p>XML enviado e retornado, dados do tomador, valores — exigência da Receita Federal.</p>
              </div>
              <div>
                <p className="text-text-1 font-medium">Dados de faturamento</p>
                <p>
                  Gerenciados pelo Stripe. Não armazenamos dados de cartão — apenas IDs de cliente e
                  assinatura Stripe.
                </p>
              </div>
              <div>
                <p className="text-text-1 font-medium">Dados de uso</p>
                <p>Logs de API (método, status, latência), métricas de uso mensais — sem dados pessoais.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">3. Finalidade do tratamento</h2>
            <p>Tratamos seus dados para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Prestar o serviço de emissão de NFS-e (execução de contrato)</li>
              <li>Cumprir obrigações legais fiscais (obrigação legal)</li>
              <li>Gerenciar faturamento e assinaturas (execução de contrato)</li>
              <li>Enviar comunicações transacionais — aprovação/rejeição de notas (interesse legítimo)</li>
              <li>Melhorar o Serviço com métricas de uso anonimizadas (interesse legítimo)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">4. Compartilhamento de dados</h2>
            <p>Compartilhamos dados apenas com subprocessadores necessários:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li><strong className="text-text-1">Supabase</strong> — banco de dados e autenticação (PostgreSQL gerenciado)</li>
              <li><strong className="text-text-1">AWS</strong> — armazenamento de certificados digitais (Secrets Manager + KMS)</li>
              <li><strong className="text-text-1">Stripe</strong> — processamento de pagamentos</li>
              <li><strong className="text-text-1">Receita Federal</strong> — API NFS-e Nacional (obrigação legal)</li>
            </ul>
            <p className="mt-3">Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">5. Retenção de dados</h2>
            <p>
              Mantemos os dados pelo prazo mínimo exigido pela legislação fiscal brasileira — 5 anos para
              documentos fiscais (art. 195 do CTN). Dados de conta são excluídos em até 90 dias após o
              encerramento da conta, salvo obrigação legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">6. Segurança</h2>
            <p>Adotamos as seguintes medidas de segurança:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Certificados A1 cifrados com AWS KMS (chave gerenciada por cliente)</li>
              <li>API Keys armazenadas apenas como hash SHA-256 irreversível</li>
              <li>Comunicações via HTTPS/TLS 1.3</li>
              <li>Row Level Security habilitado em todas as tabelas</li>
              <li>Logs sem dados sensíveis (certificados, senhas, chaves privadas)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">7. Seus direitos (LGPD)</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li><strong className="text-text-1">Acesso</strong> — confirmar quais dados temos sobre você</li>
              <li><strong className="text-text-1">Correção</strong> — corrigir dados incompletos ou desatualizados</li>
              <li><strong className="text-text-1">Exclusão</strong> — solicitar a exclusão dos seus dados (respeitados os prazos legais)</li>
              <li><strong className="text-text-1">Portabilidade</strong> — receber seus dados em formato estruturado</li>
              <li><strong className="text-text-1">Oposição</strong> — opor-se ao tratamento baseado em interesse legítimo</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato:{' '}
              <a href={`mailto:${EMAIL}`} className="text-brand-cyan hover:underline">{EMAIL}</a>
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">8. Cookies</h2>
            <p>
              Utilizamos apenas cookies estritamente necessários para autenticação (sessão Supabase) e
              preferências do dashboard. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">9. Contato do DPO</h2>
            <p>
              Encarregado de Proteção de Dados:{' '}
              <a href={`mailto:${EMAIL}`} className="text-brand-cyan hover:underline">{EMAIL}</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-navy-600 flex gap-4 text-xs text-text-2">
          <Link href="/termos" className="hover:text-brand-cyan transition">Termos de Uso</Link>
          <Link href="/" className="hover:text-brand-cyan transition">← Início</Link>
        </div>
      </div>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-navy-600 py-6 px-6 mt-8">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-between items-center gap-3 text-xs text-text-2">
          <p>© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/privacidade" className="hover:text-text-1 transition">Privacidade</Link>
            <Link href="/termos" className="hover:text-text-1 transition">Termos</Link>
            <Link href="/status" className="hover:text-text-1 transition">Status</Link>
            <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
