import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de uso do Nota MEI Gateway — plataforma de emissão de NFS-e para MEI.',
  robots: { index: true, follow: true },
}

const LAST_UPDATE = '03 de maio de 2026'
const COMPANY = 'ScantelburyDevs'
const EMAIL   = 'legal@emitirnotafacil.com.br'
const SITE    = 'emitirnotafacil.com.br'

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-text-2 hover:text-brand-cyan transition mb-8 inline-block"
        >
          ← Início
        </Link>

        <h1 className="font-display text-4xl font-extrabold mb-2">Termos de Uso</h1>
        <p className="text-text-2 text-sm mb-10">
          Última atualização: <span className="text-text-1">{LAST_UPDATE}</span>
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-sm text-text-2 leading-relaxed">

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma <strong className="text-text-1">{SITE}</strong>{' '}
              e seus serviços relacionados (&quot;Serviço&quot;), operada por {COMPANY} (&quot;nós&quot;,
              &quot;nosso&quot;), você concorda com estes Termos de Uso (&quot;Termos&quot;) e com nossa
              Política de Privacidade. Se você não concordar com estes Termos, não utilize o Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">2. Descrição do Serviço</h2>
            <p>
              O Nota MEI Gateway é uma API REST que permite a emissão automatizada de Notas Fiscais de
              Serviços Eletrônicas (NFS-e) para Microempreendedores Individuais (MEI) via Receita Federal
              Nacional — Sistema Nacional NFS-e. O Serviço inclui:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>API de emissão, consulta e cancelamento de NFS-e</li>
              <li>Dashboard de gerenciamento de notas e faturamento</li>
              <li>Armazenamento seguro de certificado digital A1</li>
              <li>Sistema de webhooks para notificação de eventos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">3. Cadastro e conta</h2>
            <p>
              Para utilizar o Serviço, você deve:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Ser titular de um CNPJ MEI válido e ativo na Receita Federal</li>
              <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
              <li>Manter a confidencialidade de suas API Keys</li>
              <li>Notificar imediatamente em caso de uso não autorizado</li>
            </ul>
            <p className="mt-3">
              Você é responsável por todas as atividades realizadas com suas credenciais de acesso.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">4. Uso aceitável</h2>
            <p>Você concorda em <strong className="text-text-1">não</strong>:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Emitir notas fiscais fraudulentas, falsas ou simuladas</li>
              <li>Tentar contornar os limites de emissão do plano contratado</li>
              <li>Realizar engenharia reversa ou comprometer a segurança da API</li>
              <li>Revender ou sublicenciar o acesso à plataforma para terceiros</li>
              <li>Utilizar o Serviço para fins ilegais ou em violação à legislação fiscal brasileira</li>
            </ul>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">5. Planos e pagamento</h2>
            <p>
              O Serviço é oferecido em diferentes planos com limites mensais de emissão. Ao contratar um
              plano pago, você autoriza a cobrança recorrente mensal via Stripe. Emissões acima do limite
              contratado são cobradas por unidade (excedente), conforme valores exibidos na plataforma.
            </p>
            <p className="mt-3">
              Cancelamentos têm efeito no fim do período já pago. Não realizamos reembolso proporcional
              de períodos não utilizados, exceto nos casos previstos no Código de Defesa do Consumidor.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">6. Certificado digital</h2>
            <p>
              Para emissão de NFS-e, é necessário o upload do certificado digital A1 do MEI. O certificado
              é armazenado de forma cifrada no AWS Secrets Manager. Você é responsável pela validade e
              autorização de uso do certificado. Não nos responsabilizamos por emissões rejeitadas por
              certificado expirado, revogado ou com dados divergentes.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">7. Disponibilidade</h2>
            <p>
              Buscamos manter disponibilidade de 99,9% mensais. No entanto, o Serviço pode ficar
              temporariamente indisponível por manutenção, falhas de terceiros (Receita Federal, AWS,
              Supabase) ou eventos fora de nosso controle. Não nos responsabilizamos por emissões não
              realizadas durante indisponibilidades.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">8. Limitação de responsabilidade</h2>
            <p>
              Na extensão máxima permitida pela lei, {COMPANY} não se responsabiliza por danos indiretos,
              incidentais, especiais ou consequentes, incluindo perda de lucros ou dados. Nossa
              responsabilidade total não excederá o valor pago pelos Serviços nos últimos 3 meses.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">9. Rescisão</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento pelo dashboard ou contatando{' '}
              <a href={`mailto:${EMAIL}`} className="text-brand-cyan hover:underline">{EMAIL}</a>.
              Podemos suspender ou encerrar contas que violem estes Termos, mediante aviso prévio de
              48 horas exceto em casos de fraude, uso ilegal ou risco de segurança.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">10. Legislação aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
              da Comarca de São Paulo/SP para dirimir quaisquer controvérsias, com renúncia a qualquer outro.
            </p>
          </section>

          <section>
            <h2 className="text-text-1 text-lg font-semibold font-display mb-3">11. Contato</h2>
            <p>
              Dúvidas sobre estes Termos:{' '}
              <a href={`mailto:${EMAIL}`} className="text-brand-cyan hover:underline">{EMAIL}</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-navy-600 flex gap-4 text-xs text-text-2">
          <Link href="/privacidade" className="hover:text-brand-cyan transition">Política de Privacidade</Link>
          <Link href="/" className="hover:text-brand-cyan transition">← Início</Link>
        </div>
      </div>
    </main>
  )
}
