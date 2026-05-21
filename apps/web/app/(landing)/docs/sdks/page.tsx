import Link from 'next/link'

// ── Code snippets ─────────────────────────────────────────────────────────────

const NODE_INSTALL = `npm install @notamei/gateway`

const NODE_USAGE = `import { NotaMEI } from '@notamei/gateway'

const client = new NotaMEI({ apiKey: process.env.NOTAMEI_API_KEY! })

const nota = await client.nfse.emitir({
  tomador: {
    cnpj: '12345678000190',
    razao_social: 'Empresa LTDA',
  },
  servico: {
    codigo_nbs: '01.01.01.10',
    discriminacao: 'Desenvolvimento de software',
    valor: 1500.00,
  },
  competencia: '2026-05',
  webhook_url: 'https://seu-site.com/webhooks/nfse',
})

console.log(nota.nota_id, nota.status)`

const PYTHON_INSTALL = `pip install notamei`

const PYTHON_USAGE = `from notamei import NotaMEI
import os

client = NotaMEI(api_key=os.environ["NOTAMEI_API_KEY"])

nota = client.nfse.emitir(
  tomador={"cnpj": "12345678000190", "razao_social": "Empresa LTDA"},
  servico={
    "codigo_nbs": "01.01.01.10",
    "discriminacao": "Desenvolvimento de software",
    "valor": 1500.00,
  },
  competencia="2026-05",
  webhook_url="https://seu-site.com/webhooks/nfse",
)

print(nota.nota_id, nota.status)`

// ── Sub-components ────────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#8AA0B8] overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </pre>
  )
}

function BadgeOfficial() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#00C85A]/10 text-[#00C85A] border border-[#00C85A]/20">
      Oficial
    </span>
  )
}

function BadgeBeta() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F0B414]/10 text-[#F0B414] border border-[#F0B414]/20">
      Beta
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SDKsPage() {
  return (
    <div className="max-w-2xl space-y-10">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-outfit">SDKs e Integrações</h1>
        <p className="text-[#8AA0B8]">
          Bibliotecas oficiais para integrar emissão de NFS-e ao seu produto.
        </p>
      </div>

      {/* Beta notice */}
      <div className="bg-[#142035] border border-[#F0B414]/20 rounded-lg p-4 text-sm text-[#F0B414] space-y-1">
        <p className="font-medium">Todos os SDKs estão em beta</p>
        <p className="text-[#8AA0B8] font-normal">
          As interfaces podem mudar antes da versão estável. Para integração direta, consulte a{' '}
          <Link href="/docs/referencia" className="text-[#00E8FF] hover:underline">
            Referência REST completa
          </Link>
          .
        </p>
      </div>

      {/* ── Node.js / TypeScript ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-outfit">Node.js / TypeScript</h2>
          <BadgeOfficial />
          <BadgeBeta />
          <span className="text-xs text-[#8AA0B8] font-mono bg-[#142035] px-2 py-0.5 rounded border border-[#1E3050]">
            npm
          </span>
        </div>

        <p className="text-sm text-[#8AA0B8]">
          Pacote oficial para Node.js e Deno. Tipagem completa com TypeScript inclusa.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8AA0B8]">Instalação</p>
          <Code>{NODE_INSTALL}</Code>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8AA0B8]">Exemplo de uso</p>
          <Code>{NODE_USAGE}</Code>
        </div>

        <a
          href="https://www.npmjs.com/package/@scantelburydevs/notamei"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00E8FF]/10 border border-[#00E8FF]/30 text-[#00E8FF] text-sm hover:bg-[#00E8FF]/20 transition-colors"
        >
          Ver no npm ↗
        </a>
      </section>

      <hr className="border-[#1E3050]" />

      {/* ── Python ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-outfit">Python</h2>
          <BadgeOfficial />
          <BadgeBeta />
          <span className="text-xs text-[#8AA0B8] font-mono bg-[#142035] px-2 py-0.5 rounded border border-[#1E3050]">
            pip
          </span>
        </div>

        <p className="text-sm text-[#8AA0B8]">
          Suporte a Python 3.9+. Compatível com Django, FastAPI, Flask e scripts standalone.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8AA0B8]">Instalação</p>
          <Code>{PYTHON_INSTALL}</Code>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8AA0B8]">Exemplo de uso</p>
          <Code>{PYTHON_USAGE}</Code>
        </div>

        <a
          href="https://pypi.org/project/notamei-gateway/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00E8FF]/10 border border-[#00E8FF]/30 text-[#00E8FF] text-sm hover:bg-[#00E8FF]/20 transition-colors"
        >
          Ver no PyPI ↗
        </a>
      </section>

      <hr className="border-[#1E3050]" />

      {/* ── WooCommerce ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-outfit">WooCommerce</h2>
          <BadgeOfficial />
          <span className="text-xs text-[#8AA0B8] font-mono bg-[#142035] px-2 py-0.5 rounded border border-[#1E3050]">
            plugin
          </span>
        </div>

        <p className="text-sm text-[#8AA0B8]">
          Emita NFS-e automaticamente quando um pedido for concluído no WooCommerce.
          Instalação direto pelo painel do WordPress — sem código.
        </p>

        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2 text-sm text-[#8AA0B8]">
          <p className="text-[#EEF4FF] font-medium">Como instalar</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Faça login no painel do WordPress.</li>
            <li>Acesse <code className="text-[#00E8FF] font-mono">Plugins → Adicionar novo</code>.</li>
            <li>Pesquise por <code className="text-[#00E8FF] font-mono">NotaMEI Gateway</code>.</li>
            <li>Instale, ative e cole sua API Key nas configurações do plugin.</li>
          </ol>
        </div>

        <Link
          href="/cadastro?produto=gateway&origem=sdk-woocommerce"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00E8FF]/10 border border-[#00E8FF]/30 text-[#00E8FF] text-sm hover:bg-[#00E8FF]/20 transition-colors"
        >
          Criar conta e obter API Key →
        </Link>
      </section>

      <hr className="border-[#1E3050]" />

      {/* ── Zapier ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-outfit">Zapier</h2>
          <BadgeOfficial />
          <span className="text-xs text-[#8AA0B8] font-mono bg-[#142035] px-2 py-0.5 rounded border border-[#1E3050]">
            no-code
          </span>
        </div>

        <p className="text-sm text-[#8AA0B8]">
          Conecte a NotaFácil API a mais de 6.000 apps sem escrever uma linha de código.
          Acione a emissão de nota quando um formulário for enviado, uma venda for feita no
          seu e-commerce, ou qualquer outro evento do seu fluxo de trabalho.
        </p>

        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 space-y-2 text-sm text-[#8AA0B8]">
          <p className="text-[#EEF4FF] font-medium">Exemplos de automações</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Typeform enviado → emitir NFS-e automaticamente</li>
            <li>Venda concluída no Shopify → emitir NFS-e</li>
            <li>Linha adicionada no Google Sheets → emitir NFS-e</li>
          </ul>
        </div>

        <Link
          href="/cadastro?produto=gateway&origem=sdk-zapier"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00E8FF]/10 border border-[#00E8FF]/30 text-[#00E8FF] text-sm hover:bg-[#00E8FF]/20 transition-colors"
        >
          Criar conta para acessar o Zap →
        </Link>
      </section>

      {/* Footer: link para referência REST */}
      <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-[#EEF4FF]">Precisa de mais controle?</h3>
        <p className="text-sm text-[#8AA0B8]">
          Todos os SDKs são wrappers da nossa API REST. Você pode integrar diretamente via
          HTTP — sem dependências, em qualquer linguagem.
        </p>
        <Link
          href="/docs/referencia"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0F1E] border border-[#1E3050] text-[#EEF4FF] text-sm hover:border-[#00E8FF]/30 hover:text-[#00E8FF] transition-colors"
        >
          Referência completa da API REST →
        </Link>
      </div>

    </div>
  )
}
