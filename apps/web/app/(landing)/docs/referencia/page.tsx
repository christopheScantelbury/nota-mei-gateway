import type { Metadata } from 'next'
import ScalarReference from './ScalarReference'

// Refeito 2026-06-05: antes era um route handler que servia HTML standalone
// fora do layout do site — ficava sem topbar/sidebar/branding. Agora é
// page.tsx que renderiza dentro do DocsLayout (sidebar nav + topbar),
// embed Scalar via client component com customCss alinhado aos tokens v2.

export const metadata: Metadata = {
  title: 'Referência da API · NotaFácil API',
  description:
    'Documentação interativa da NotaFácil API — emita NFS-e Nacional para MEI, ME e EPP via REST. Endpoints, schemas, exemplos.',
}

export default function ReferenciaPage() {
  return (
    <div className="max-w-none -mx-4 sm:-mx-6 md:-ml-8 md:-mr-4 -my-8">
      <ScalarReference />
    </div>
  )
}
