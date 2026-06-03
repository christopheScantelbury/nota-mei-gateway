'use client'
import { useState } from 'react'

const FAQS = [
  {
    pergunta: 'Funciona para Lucro Presumido?',
    resposta:
      'Sim. O sistema suporta Simples Nacional e Lucro Presumido. Para LP, ' +
      'o campo de retenção de ISS na fonte é exibido automaticamente no formulário ' +
      'de emissão. Tomadores que são órgãos públicos têm retenção obrigatória.',
  },
  {
    pergunta: 'Funciona para qualquer município?',
    resposta:
      'Funciona para todos os municípios que já aderiram ao NFS-e Nacional (SEFIN Nacional). ' +
      'Você pode consultar a lista em nosso endpoint GET /v1/municipios ou no portal gov.br/nfse.',
  },
  {
    pergunta: 'Que tipo de certificado digital preciso?',
    resposta:
      'Certificado A1 (.pfx ou .p12) emitido por uma Autoridade Certificadora ICP-Brasil. ' +
      'O certificado é armazenado com criptografia e utilizado para assinar ' +
      'os documentos fiscais automaticamente. Suporte a A3 está no roadmap.',
  },
  {
    pergunta: 'A obrigatoriedade é realmente em setembro/2026?',
    resposta:
      'Sim. A Resolução CGSN nº 189, de 23 de abril de 2026, estabelece ' +
      '01/09/2026 como data obrigatória para ME e EPP optantes pelo Simples Nacional. ' +
      'Lucro Presumido também está no escopo da obrigatoriedade.',
  },
  {
    pergunta: 'Quanto custa?',
    resposta:
      'Estamos em trial gratuito para ME durante o período de lançamento. ' +
      'Os planos definitivos serão comunicados por e-mail antes da ativação. ' +
      'Não há cobrança automática — você decide quando e se ativar um plano pago.',
  },
  {
    pergunta: 'Posso cancelar ou substituir uma nota emitida?',
    resposta:
      'Sim. Cancelamento em até 90 dias (365 dias para tomador do setor público). ' +
      'Substituição (com dados corrigidos) em até 9 dias corridos após a emissão. ' +
      'O dashboard exibe o prazo restante em cada nota.',
  },
]

export function MEFAQ() {
  const [aberto, setAberto] = useState<number | null>(null)

  return (
    <section className="px-6 py-20 max-w-3xl mx-auto" id="faq">
      <h2 className="font-display text-3xl font-bold text-text-1 text-center mb-12">
        Perguntas frequentes
      </h2>
      <div className="space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = aberto === i
          const panelId = `me-faq-panel-${i}`
          const buttonId = `me-faq-button-${i}`
          return (
            <div
              key={i}
              className="rounded-xl border border-navy-600 bg-navy-700 overflow-hidden"
            >
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setAberto(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4
                           text-left text-text-1 font-medium hover:text-brand-cyan
                           transition-colors"
              >
                {faq.pergunta}
                <span
                  aria-hidden="true"
                  className={`text-brand-cyan transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                >
                  +
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-6 pb-5 text-text-2 text-sm leading-relaxed"
              >
                {faq.resposta}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
