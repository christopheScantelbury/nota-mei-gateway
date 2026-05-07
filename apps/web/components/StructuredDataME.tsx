export function StructuredDataME() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'emitirnotafacil.com.br — NFS-e para ME',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://emitirnotafacil.com.br/me',
    description:
      'Plataforma para emissão de Nota Fiscal de Serviço Eletrônica (NFS-e) ' +
      'para Microempresas (ME) e EPP. Padrão nacional obrigatório a partir de 01/09/2026.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      description: 'Trial gratuito durante período de lançamento',
    },
    provider: {
      '@type': 'Organization',
      name: 'ScantelburyDevs',
      url: 'https://scantelburydevs.com.br',
    },
    featureList: [
      'NFS-e Simples Nacional',
      'NFS-e Lucro Presumido',
      'ISS com retenção na fonte',
      'Qualquer município NFS-e Nacional',
      'Certificado A1',
      'Cancelamento em 90 dias',
      'Substituição em 9 dias',
    ],
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Quando a NFS-e se torna obrigatória para ME?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'A partir de 01/09/2026, conforme Resolução CGSN nº 189/2026, ' +
            'para ME e EPP optantes pelo Simples Nacional.',
        },
      },
      {
        '@type': 'Question',
        name: 'O sistema funciona para Lucro Presumido?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Sim. O sistema suporta Simples Nacional e Lucro Presumido, ' +
            'incluindo retenção de ISS na fonte pelo tomador.',
        },
      },
      {
        '@type': 'Question',
        name: 'Funciona para qualquer município?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Funciona para todos os municípios já integrados ao NFS-e Nacional (SEFIN Nacional).',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  )
}
