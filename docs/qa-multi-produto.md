Relatório de QA — Multi-Produto & Migração MEI → ME
Data de execução: 07/05/2026 | Branch: main | Ambiente: https://nota-mei-gateway-web.vercel.app

⚠️ Aviso sobre cobertura de execução
Os testes dos Blocos 3–7 (T3.1–T7.2) requerem usuários autenticados com dados pré-configurados no Supabase (U1, U2, U3) via Magic Link + SQL. Como essas contas não foram criadas antes dos testes, esses casos estão marcados como ⬜ BLOQUEADO (pré-condição não satisfeita) com orientações de setup. Os Blocos 1 e 2 foram executados integralmente.

Bloco 1 — Navbar e Landing
T1.1 — Links de produto na navbar (desktop) ❌ FALHOU
Viewport: 1280×800 (≥ 1024px) ✅
Encontrado na navbar:

Planos → ancora #planos ✅
FAQ → ancora #faq ✅
Docs → /docs ✅
Começar grátis → /cadastro (único CTA)

Esperado pela spec mas AUSENTE:

Link MEI na navbar → ausente ❌
Link ME / EPP na navbar → ausente ❌
Link Gateway API na navbar → ausente ❌
Link Preços na navbar → o item existe como "Planos" ancorado, não como "Preços" ⚠️
Botão Entrar → ausente ❌
Botão Cadastrar grátis → presente como "Começar grátis" ⚠️ (texto diferente)

Observação: Os links MEI/ME/Gateway existem como cards no corpo da landing page (não na navbar). A navegação funciona corretamente via cards: MEI → /mei ✅, ME/EPP → /me ✅, Gateway → /gateway ✅. O problema é estrutural — a navbar não contém os links de produto esperados.

T1.2 — Menu mobile ❌ FALHOU (parcialmente)
O drawer mobile existe no DOM (role="dialog", aria-label="Menu de navegação") mas só está visível em viewports < 640px (classe Tailwind sm:hidden). O botão "Abrir menu" (aria-label="Abrir menu") existe mas o menu não abre por clique (funciona via CSS de breakpoint).
Encontrado no drawer mobile:

Planos (#planos) ✅
FAQ (#faq) ✅
Documentação (/docs) ✅
Status da API (/status) ✅
Toggle de tema ✅
Começar grátis (/cadastro) ✅ (1 CTA)

Esperado mas ausente:

Links MEI, ME/EPP, Gateway API → ❌ ausentes
Entrar → ❌ ausente
2 CTAs no rodapé (Entrar + Cadastrar grátis) → apenas 1 CTA ❌
Comportamento de fechar ao clicar em link → não verificável sem viewport real < 640px


T1.3 — Redirects canônicos ❌ TODOS FALHARAM
URL testadaEsperadoResultado/desenvolvedorRedirect → /gateway404 Página não encontrada ❌/developerRedirect → /gateway404 Página não encontrada ❌/entrarRedirect → /login404 Página não encontrada ❌/registrarRedirect → /cadastro404 Página não encontrada ❌/mei/cadastroRedirect → /cadastro?produto=mei404 Página não encontrada ❌
Nenhum dos 5 redirects canônicos está implementado.

Bloco 2 — Cadastro (Seletor de Produto)
T2.1 — Seletor exibido sem parâmetro ❌ FALHOU
URL: /cadastro (sem query params)
Esperado: 3 cards — Sou MEI / Tenho ME/EPP / Integrar via API
Encontrado: O formulário de cadastro MEI é exibido diretamente (stepper com 3 steps: Dados do MEI → Localização → Certificado), sem seletor de produto. O seletor de produto não existe na rota /cadastro.
O seletor de produto existe apenas na home page (/) como cards visuais.

T2.2 — Cadastro MEI direto via parâmetro ✅ PASSOU (com ressalva)
URL: /cadastro?produto=mei
O formulário MEI é exibido corretamente com branding "Nota Fácil MEI". A diferença em relação ao /cadastro sem parâmetro é apenas o nome do produto no cabeçalho ("Nota Fácil MEI" vs "Nota MEI Gateway") — ambas as rotas já mostram o formulário MEI diretamente. ⚠️ O parâmetro funciona, mas como /cadastro sem parâmetro já vai direto para MEI, o comportamento do seletor T2.1 não existe.

Blocos 3–7 — Requerem pré-configuração de usuários
Estes testes não podem ser executados sem a criação prévia dos 3 usuários de teste com as respectivas configurações de banco de dados.
Passos necessários antes de retomar:
1. Criar conta U3 (sem empresa):
Acesse /login, insira qa-novo@testador.dev, receba o Magic Link e complete o login.
2. Criar conta U1 (MEI) + inserir SQL:
Acesse /login, insira qa-mei@testador.dev, faça login, anote o UUID em Supabase → Authentication → Users e execute o SQL da pré-configuração U1.
3. Criar conta U2 (ME) + inserir SQL:
Idem com qa-me@testador.dev e o SQL da pré-configuração U2.
Após o setup, retome os testes a partir do T3.1.

Checklist Final
#TesteStatusObservaçõesT1.1Navbar desktop❌ FALHOUNavbar não contém MEI, ME/EPP, Gateway API, Entrar. CTA é "Começar grátis" não "Cadastrar grátis"T1.2Menu mobile❌ FALHOUDrawer existe mas sem links de produto, sem botão Entrar, apenas 1 CTAT1.3Redirects❌ FALHOUTodos os 5 redirects retornam 404T2.1Seletor /cadastro❌ FALHOUFormulário MEI direto, sem seletor de 3 cardsT2.2Cadastro MEI direto✅ PASSOUFormulário MEI exibido corretamente com ?produto=meiT3.1Sidebar MEI⬜ BLOQUEADOAguarda setup U1T3.2Sem banner migração⬜ BLOQUEADOAguarda setup U1T4.1Sidebar ME⬜ BLOQUEADOAguarda setup U2T5.1Sem empresa → cadastro⬜ BLOQUEADOSem auth redireciona para /login (correto), comportamento pós-login requer U3T5.21 empresa → dashboard direto⬜ BLOQUEADOAguarda setup U1/U2T5.32 empresas → seletor⬜ BLOQUEADOAguarda setup U1 + SQL segunda empresaT5.4EmpresaSwitcher⬜ BLOQUEADOAguarda T5.3T6.1Acesso página migração⬜ BLOQUEADO/configuracoes/migrar → /login (auth guard OK)T6.2Formulário dados ME⬜ BLOQUEADOAguarda T6.1T6.3Migração concluída⬜ BLOQUEADOAguarda T6.2T6.4Verificação no banco⬜ BLOQUEADOAguarda T6.3T6.5Bloqueio empresa já ME⬜ BLOQUEADOAguarda setup U2T6.6API erros corretos⬜ BLOQUEADOAguarda token Bearer de U2T7.1Regressão legado⬜ BLOQUEADORequer conta MEI legada existenteT7.2Emissão de nota⬜ BLOQUEADOAguarda setup U2

Bugs Encontrados (Bloco 1–2)
🔴 BUG-01 [MÉDIA] — Navbar não contém links de produto esperados
[multi-produto] T1.1 — A navbar desktop não inclui links MEI, ME/EPP, Gateway API e não há botão "Entrar". Os produtos são acessíveis apenas via cards no body da home.
🔴 BUG-02 [MÉDIA] — Menu mobile sem links de produto e sem botão Entrar
[multi-produto] T1.2 — O drawer mobile não lista MEI, ME/EPP, Gateway API e tem apenas 1 CTA ("Começar grátis") em vez dos 2 esperados (Entrar + Cadastrar grátis).
🔴 BUG-03 [ALTA] — Nenhum redirect canônico implementado (5 de 5 falharam)
[multi-produto] T1.3 — /desenvolvedor, /developer, /entrar, /registrar e /mei/cadastro retornam 404. Necessário configurar os redirects no next.config.js ou equivalente.
🔴 BUG-04 [ALTA] — Seletor de produto ausente em /cadastro
[multi-produto] T2.1 — A rota /cadastro sem parâmetros deveria exibir o seletor de 3 produtos, mas exibe diretamente o formulário MEI. O seletor não existe como página independente.

Próximos Passos

Imediato: Corrigir os redirects canônicos (BUG-03) — é simples e de alto impacto para SEO/UX.
Imediato: Decidir se a navbar precisa dos links de produto (BUG-01, BUG-02) ou se os cards da home são suficientes — parece uma decisão de design pendente de alinhamento.
Imediato: Criar os 3 usuários de teste e executar SQL no Supabase para desbloquear os testes T3–T7 (bloqueantes para aprovação).
Após setup: Retomar a partir de T3.1, priorizando os testes bloqueantes T6.1–T6.4, T7.1 e T7.2.