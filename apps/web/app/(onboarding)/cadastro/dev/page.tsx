import type { Metadata } from 'next'
import CadastroDevClient from './CadastroDevClient'

export const metadata: Metadata = {
  title: { absolute: 'Cadastro de Desenvolvedor — NotaFácil API' },
  description:
    'Cadastro simplificado para desenvolvedores integrando a API de NFS-e Nacional do NotaFácil. Receba sua API Key de sandbox em segundos — sem precisar de CNPJ.',
}

export default function CadastroDevPage() {
  return <CadastroDevClient />
}
