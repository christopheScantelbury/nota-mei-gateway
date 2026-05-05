# Casos de Teste — QA Nota Fácil MEI + Nota MEI Gateway

> **Versão:** 1.0 · **Data:** 2026-05-05  
> **Ambientes:** produção (`notafacilmei.com.br` / `notameigateway.com.br`) e staging  
> **Legenda de severidade:** 🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Baixo

---

## Como preencher

| Campo | Descrição |
|---|---|
| **ID** | Identificador único do caso |
| **Pré-condições** | Estado necessário antes de executar |
| **Passos** | Sequência de ações |
| **Resultado esperado** | Comportamento correto |
| **Resultado real** | Preencher durante o teste |
| **Status** | ✅ Passou · ❌ Falhou · ⏭️ Bloqueado · 🔁 Retest |

---

## 1. AUTENTICAÇÃO — Login OTP

### TC-AUTH-001 🔴 Login com código correto (happy path)
**Pré-condições:** E-mail `usuario@teste.com` cadastrado no sistema  
**Passos:**
1. Acessar `notafacilmei.com.br/login` (ou `/login?produto=gateway` para Gateway)
2. Digitar o e-mail cadastrado
3. Clicar em "Enviar código de acesso"
4. Abrir o e-mail recebido — assunto "Seu código de acesso"
5. Digitar o código de 6 dígitos nas caixas
6. Clicar em "Entrar"

**Resultado esperado:**
- E-mail chega com código numérico de 6 dígitos (não um link)
- Após digitar o código, usuário é redirecionado para `/notas` no domínio correto do produto
- Sidebar exibe a razão social do MEI

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-002 🔴 Código OTP incorreto
**Pré-condições:** Fluxo de OTP iniciado (tela de 6 boxes visível)  
**Passos:**
1. Digitar código errado (ex.: `000000`)
2. Clicar em "Entrar"

**Resultado esperado:**
- Mensagem de erro: "Código incorreto ou expirado..."
- Boxes são limpas automaticamente
- Usuário permanece na tela de OTP

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-003 🟠 E-mail não cadastrado
**Pré-condições:** Nenhuma  
**Passos:**
1. Acessar `/login`
2. Digitar e-mail inexistente no sistema
3. Clicar em "Enviar código de acesso"

**Resultado esperado:**
- Mensagem: "E-mail não cadastrado. Faça seu cadastro primeiro."
- Nenhum e-mail é enviado

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-004 🟡 Reenvio de código com cooldown
**Pré-condições:** Tela de OTP exibida após envio do código  
**Passos:**
1. Verificar que o botão "Reenviar código" NÃO aparece nos primeiros 60 segundos
2. Aguardar o contador zerar
3. Clicar em "Reenviar código"

**Resultado esperado:**
- Contador regressivo de 60s visível
- Botão "Reenviar código" aparece somente após 60s
- Novo e-mail com código diferente é recebido
- Contador reinicia por mais 60s

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-005 🟡 Paste do código OTP
**Pré-condições:** Tela de OTP exibida  
**Passos:**
1. Copiar o código de 6 dígitos do e-mail
2. Clicar na primeira caixa de dígito
3. Colar (Ctrl+V)

**Resultado esperado:**
- Todos os 6 boxes preenchidos automaticamente com cada dígito
- Foco vai para o último box preenchido

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-006 🟡 Navegação entre boxes (teclado)
**Pré-condições:** Tela de OTP exibida  
**Passos:**
1. Digitar um dígito no box 1 → cursor vai para box 2 automaticamente
2. Pressionar Backspace no box 2 vazio → foco retorna para box 1
3. Pressionar seta esquerda/direita entre boxes

**Resultado esperado:**
- Auto-advance: dígito digitado + foco avança
- Backspace em box vazio: limpa o anterior e volta o foco
- Setas: navegam entre boxes sem alterar valores

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-007 🟡 Usuário já logado acessa /login
**Pré-condições:** Usuário autenticado  
**Passos:**
1. Usuário logado acessa `notafacilmei.com.br/login`

**Resultado esperado:**
- Redirecionado imediatamente para `/notas` (não vê a tela de login)

**Resultado real:** ___  
**Status:** ___

---

### TC-AUTH-008 🟠 Logout
**Pré-condições:** Usuário autenticado no dashboard  
**Passos:**
1. Clicar em "Sair" no rodapé do sidebar
2. Tentar acessar `/notas` manualmente

**Resultado esperado:**
- Sessão encerrada
- Acesso a `/notas` redireciona para `/login`

**Resultado real:** ___  
**Status:** ___

---

## 2. SEPARAÇÃO DE PRODUTO — Domain Routing

### TC-PROD-001 🔴 MEI logado no domínio MEI
**Pré-condições:** Conta com `tipo_usuario = 'mei'`  
**Passos:**
1. Fazer login em `notafacilmei.com.br/login`
2. Concluir OTP

**Resultado esperado:**
- Aterra em `notafacilmei.com.br/notas`
- Logo "Nota Fácil MEI" no sidebar
- Sidebar exibe: Notas, Templates, Plano, Configurações (sem API Keys, Webhooks, Automação)
- Título da aba: "Painel — Nota Fácil MEI"

**Resultado real:** ___  
**Status:** ___

---

### TC-PROD-002 🔴 Gateway logado no domínio Gateway
**Pré-condições:** Conta com `tipo_usuario = 'gateway'`  
**Passos:**
1. Fazer login em `notameigateway.com.br/login`
2. Concluir OTP

**Resultado esperado:**
- Aterra em `notameigateway.com.br/notas`
- Logo "Nota MEI Gateway" no sidebar
- Sidebar exibe: Notas, Templates, Automação, API Keys, Webhooks, Plano, Configurações
- Título da aba: "Painel — Nota MEI Gateway"

**Resultado real:** ___  
**Status:** ___

---

### TC-PROD-003 🔴 MEI tenta acessar domínio Gateway
**Pré-condições:** Conta com `tipo_usuario = 'mei'`, usuário logado  
**Passos:**
1. Com sessão ativa de MEI, digitar `notameigateway.com.br/notas` na barra de endereço

**Resultado esperado:**
- Redirecionado automaticamente para `notafacilmei.com.br/notas`
- Nunca vê o dashboard do Gateway

**Resultado real:** ___  
**Status:** ___

---

### TC-PROD-004 🔴 Gateway tenta acessar domínio MEI
**Pré-condições:** Conta com `tipo_usuario = 'gateway'`, usuário logado  
**Passos:**
1. Com sessão ativa de Gateway, digitar `notafacilmei.com.br/notas` na barra de endereço

**Resultado esperado:**
- Redirecionado automaticamente para `notameigateway.com.br/notas`

**Resultado real:** ___  
**Status:** ___

---

### TC-PROD-005 🟠 MEI não vê itens de Gateway no sidebar
**Pré-condições:** Conta com `tipo_usuario = 'mei'`  
**Passos:**
1. Fazer login como MEI
2. Inspecionar o sidebar

**Resultado esperado:**
- Itens **ausentes**: API Keys, Webhooks, Automação
- Itens **presentes**: Notas Fiscais, Templates, Plano & Faturamento, Configurações

**Resultado real:** ___  
**Status:** ___

---

### TC-PROD-006 🟡 Título da aba por produto
**Pré-condições:** Usuário logado em cada produto  
**Passos:**
1. Abrir `notafacilmei.com.br/notas` → verificar título da aba
2. Abrir `notameigateway.com.br/notas` → verificar título da aba

**Resultado esperado:**
- MEI: `"Notas Fiscais — Nota Fácil MEI"`
- Gateway: `"Notas Fiscais — Nota MEI Gateway"`

**Resultado real:** ___  
**Status:** ___

---

## 3. CADASTRO — Onboarding

### TC-CAD-001 🔴 Cadastro MEI completo (happy path)
**Pré-condições:** CNPJ válido não cadastrado  
**Passos:**
1. Acessar `notafacilmei.com.br/cadastro?produto=mei`
2. Step 1: preencher CNPJ, Razão Social, E-mail → "Próximo"
3. Step 2: digitar CEP válido (aguardar preenchimento automático) → "Próximo"
4. Step 3: clicar "Pular por agora"

**Resultado esperado:**
- Tela de sucesso exibe: "Conta criada com sucesso!" + emoji 🎉
- **NÃO** exibe API Key
- Botão "Fazer login →" aponta para `notafacilmei.com.br/login?produto=mei`

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-002 🔴 Cadastro Gateway completo (happy path)
**Pré-condições:** CNPJ válido não cadastrado  
**Passos:**
1. Acessar `notameigateway.com.br/cadastro?produto=gateway`
2. Step 1: preencher dados → "Próximo"
3. Step 2: preencher localização → "Próximo"
4. Step 3: clicar "Pular por agora"

**Resultado esperado:**
- Tela de sucesso exibe API Key completa (`sk_live_...` ou `sk_test_...`)
- Botão "Copiar API Key" funciona
- Link "Ir para o painel" aponta para `notameigateway.com.br/notas`

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-003 🟠 CNPJ duplicado
**Pré-condições:** CNPJ já cadastrado no sistema  
**Passos:**
1. Tentar cadastrar o mesmo CNPJ novamente
2. Completar os 3 steps e submeter

**Resultado esperado:**
- Mensagem de erro clara: CNPJ já cadastrado
- Não cria conta duplicada

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-004 🟠 CNPJ inválido
**Passos:**
1. Step 1: digitar CNPJ com dígito verificador errado (ex.: `11.222.333/0001-00`)
2. Clicar "Próximo"

**Resultado esperado:**
- Mensagem inline: "CNPJ inválido — verifique os dígitos."
- Não avança para o Step 2

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-005 🟡 Lookup de CEP
**Passos:**
1. Step 2: digitar CEP válido (ex.: `01310-100`)

**Resultado esperado:**
- Card verde aparece com: Município, UF
- IBGE preenchido automaticamente
- Indicador "✓" verde no campo CEP

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-006 🟡 CEP não encontrado → busca por nome
**Passos:**
1. Step 2: digitar CEP inexistente (ex.: `99999-999`)
2. Clicar "Não sei meu CEP — buscar município pelo nome"
3. Digitar nome do município no autocomplete

**Resultado esperado:**
- Erro exibido ao digitar CEP inválido
- Link de busca por nome aparece
- Autocomplete funciona e preenche município

**Resultado real:** ___  
**Status:** ___

---

### TC-CAD-007 🟡 Cadastro com certificado A1
**Pré-condições:** Arquivo `.pfx` válido disponível  
**Passos:**
1. Step 3: fazer upload do arquivo `.pfx`
2. Digitar senha do certificado
3. Clicar "Criar conta →"

**Resultado esperado:**
- MEI cadastrado com sucesso
- Certificado associado à conta
- Em Configurações, exibe certificado ativo com data de validade

**Resultado real:** ___  
**Status:** ___

---

## 4. NOTAS FISCAIS — Dashboard

### TC-NF-001 🔴 Listar notas fiscais
**Pré-condições:** MEI logado com ao menos uma nota emitida  
**Passos:**
1. Acessar `/notas`

**Resultado esperado:**
- Lista de notas com: número, tomador, valor, status, data
- Badges coloridos por status: AUTORIZADA (verde), PROCESSANDO (amarelo), REJEITADA (vermelho), CANCELADA (cinza)
- Paginação funcional

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-002 🔴 Emitir nota fiscal (via dashboard)
**Pré-condições:** MEI com certificado cadastrado, plano ativo  
**Passos:**
1. Clicar em "Nova Nota" (ou equivalente)
2. Preencher: código NBS, discriminação, valor, alíquota ISS
3. Preencher dados do tomador: CPF/CNPJ, razão social, município
4. Submeter

**Resultado esperado:**
- Resposta imediata: nota em status `PROCESSANDO`
- Após processamento: status muda para `AUTORIZADA` com número NFS-e
- Nota aparece no topo da lista

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-003 🟠 Cancelar nota autorizada
**Pré-condições:** Nota em status `AUTORIZADA`  
**Passos:**
1. Abrir detalhe da nota
2. Clicar em "Cancelar nota"
3. Confirmar a ação

**Resultado esperado:**
- Status muda para `CANCELADA`
- Data de cancelamento registrada
- Nota não pode ser cancelada novamente

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-004 🟠 Download PDF da nota
**Pré-condições:** Nota em status `AUTORIZADA`  
**Passos:**
1. Abrir detalhe da nota
2. Clicar em "Baixar PDF"

**Resultado esperado:**
- PDF da NFS-e é baixado
- Documento contém: número, código de verificação, dados do prestador e tomador

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-005 🟠 Download XML da nota
**Pré-condições:** Nota em status `AUTORIZADA`  
**Passos:**
1. Abrir detalhe da nota
2. Clicar em "Baixar XML"

**Resultado esperado:**
- XML da NFS-e é baixado
- Arquivo válido conforme schema ABRASF

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-006 🟡 Filtro por status
**Passos:**
1. Na listagem de notas, selecionar filtro "AUTORIZADA"
2. Verificar resultados
3. Selecionar "REJEITADA"

**Resultado esperado:**
- Lista filtra corretamente por status
- Contagem de resultados atualiza

**Resultado real:** ___  
**Status:** ___

---

### TC-NF-007 🟡 Limite do plano atingido
**Pré-condições:** MEI no plano Trial com 3 notas já emitidas no mês  
**Passos:**
1. Tentar emitir uma 4ª nota

**Resultado esperado:**
- Erro claro: limite de emissões do plano atingido
- CTA para upgrade de plano

**Resultado real:** ___  
**Status:** ___

---

## 5. TEMPLATES — Dashboard

### TC-TPL-001 🟠 Gate de plano para Templates (Trial)
**Pré-condições:** MEI no plano Trial  
**Passos:**
1. Acessar `/templates`

**Resultado esperado:**
- Tela de "upgrade necessário" exibida (PlanGate)
- Não mostra templates
- Botão de upgrade para plano PRO

**Resultado real:** ___  
**Status:** ___

---

### TC-TPL-002 🟠 Templates disponíveis no PRO
**Pré-condições:** MEI no plano PRO ou superior  
**Passos:**
1. Acessar `/templates`
2. Criar um novo template
3. Editar o template criado
4. Usar o template para emitir uma nota

**Resultado esperado:**
- CRUD de templates funcional
- Template salvo persiste entre sessões
- Nota emitida via template preenchida com os dados do template

**Resultado real:** ___  
**Status:** ___

---

## 6. API KEYS — Dashboard (Gateway)

### TC-KEY-001 🔴 MEI não vê a seção API Keys
**Pré-condições:** Conta `tipo_usuario = 'mei'`  
**Passos:**
1. Tentar acessar `/api-keys` diretamente na URL

**Resultado esperado:**
- Página não aparece no sidebar
- Acesso direto por URL: redirecionado ou página não encontrada
  *(verificar comportamento esperado conforme decisão de produto)*

**Resultado real:** ___  
**Status:** ___

---

### TC-KEY-002 🔴 Criar API Key (Gateway)
**Pré-condições:** Conta `tipo_usuario = 'gateway'`, logado  
**Passos:**
1. Acessar `/api-keys`
2. Clicar em "Nova API Key"
3. Dar um label (ex.: "Produção")
4. Confirmar criação

**Resultado esperado:**
- Chave exibida UMA VEZ completa (`sk_live_...` ou `sk_test_...`)
- Avisar que a chave não será exibida novamente
- Na listagem, apenas o prefixo e label são visíveis

**Resultado real:** ___  
**Status:** ___

---

### TC-KEY-003 🟠 Revogar API Key
**Pré-condições:** API Key ativa existente  
**Passos:**
1. Clicar em "Revogar" na chave desejada
2. Confirmar a ação
3. Tentar usar a chave revogada na API (`Authorization: Bearer <chave>`)

**Resultado esperado:**
- Chave marcada como revogada com data
- API retorna `401 INVALID_API_KEY` ao usar a chave revogada

**Resultado real:** ___  
**Status:** ___

---

### TC-KEY-004 🟡 Limite de API Keys por plano
**Pré-condições:** Trial (limite: 2 chaves), 2 chaves ativas  
**Passos:**
1. Tentar criar uma 3ª API Key

**Resultado esperado:**
- Bloqueado com mensagem de limite atingido
- CTA para upgrade de plano

**Resultado real:** ___  
**Status:** ___

---

## 7. WEBHOOKS — Dashboard (Gateway)

### TC-WBK-001 🟠 Configurar webhook URL
**Pré-condições:** Conta Gateway, plano Starter ou superior  
**Passos:**
1. Acessar `/webhooks`
2. Configurar URL de endpoint (ex.: `https://meusite.com/webhook`)
3. Salvar

**Resultado esperado:**
- URL salva e associada às próximas notas emitidas
- Listagem de entregas disponível

**Resultado real:** ___  
**Status:** ___

---

### TC-WBK-002 🟠 Entrega de webhook após autorização de nota
**Pré-condições:** Webhook configurado, nota emitida  
**Passos:**
1. Emitir nota com `webhook_url` definida
2. Aguardar processamento (nota AUTORIZADA)
3. Verificar no painel de webhooks

**Resultado esperado:**
- Status `webhook_entregue = true`
- Payload recebido no endpoint com campos: `event`, `nota_id`, `status`, `numero_nfse`, `pdf_url`, `xml_url`, `signature`
- Assinatura HMAC válida

**Resultado real:** ___  
**Status:** ___

---

### TC-WBK-003 🟡 Reentrega automática após falha
**Pré-condições:** Endpoint configurado mas retornando 500  
**Passos:**
1. Emitir nota com endpoint inválido
2. Aguardar tentativas automáticas de reentrega

**Resultado esperado:**
- `webhook_tentativas` incrementa a cada falha
- Sistema tenta reentrega com backoff
- Após máximo de tentativas, marca como falha definitiva

**Resultado real:** ___  
**Status:** ___

---

## 8. AUTOMAÇÃO / RECORRÊNCIAS (Gateway — Business)

### TC-REC-001 🟠 Gate de plano para Automação
**Pré-condições:** Conta Gateway no plano abaixo de Business  
**Passos:**
1. Acessar `/recorrencias`

**Resultado esperado:**
- PlanGate exibido: "Automação disponível a partir do Business"
- CTA de upgrade

**Resultado real:** ___  
**Status:** ___

---

### TC-REC-002 🟡 Criar recorrência (Business)
**Pré-condições:** Conta Gateway, plano Business  
**Passos:**
1. Acessar `/recorrencias`
2. Criar nova recorrência mensal com dados do tomador e serviço
3. Aguardar ciclo de execução

**Resultado esperado:**
- Recorrência salva e listada
- Nota emitida automaticamente na data configurada

**Resultado real:** ___  
**Status:** ___

---

## 9. BILLING — Plano & Faturamento

### TC-BIL-001 🔴 Ver plano atual
**Pré-condições:** MEI logado  
**Passos:**
1. Acessar `/billing`

**Resultado esperado:**
- Plano atual destacado (Trial, Starter, Basic, Pro ou Business)
- Uso do mês: notas emitidas vs. limite do plano
- Barra de progresso de uso

**Resultado real:** ___  
**Status:** ___

---

### TC-BIL-002 🔴 Upgrade de plano (Stripe Checkout)
**Pré-condições:** MEI no plano Trial  
**Passos:**
1. Clicar em "Fazer upgrade" para Starter
2. Completar o checkout no Stripe (usar cartão de teste `4242 4242 4242 4242`)
3. Retornar ao dashboard

**Resultado esperado:**
- Redirecionado para o Stripe Checkout
- Após pagamento: redirecionado de volta para o painel
- Plano atualizado para Starter
- Limite de notas e features atualizados

**Resultado real:** ___  
**Status:** ___

---

### TC-BIL-003 🟠 Customer Portal Stripe
**Pré-condições:** MEI com assinatura ativa  
**Passos:**
1. Clicar em "Gerenciar assinatura" (ou equivalente)

**Resultado esperado:**
- Redirecionado para o Stripe Customer Portal
- Pode visualizar faturas, alterar método de pagamento, cancelar assinatura

**Resultado real:** ___  
**Status:** ___

---

### TC-BIL-004 🟠 Webhook Stripe — pagamento bem-sucedido
**Pré-condições:** Stripe CLI configurado em staging  
**Passos:**
1. Simular evento `customer.subscription.updated` via Stripe CLI
2. Verificar no banco: `emissoes_mensais.stripe_subscription_status`

**Resultado esperado:**
- Status atualizado para `active`
- Plano correto refletido no dashboard

**Resultado real:** ___  
**Status:** ___

---

## 10. PAINEL ADMIN

### TC-ADM-001 🔴 Acesso negado para não-admins
**Pré-condições:** Conta sem role `admin` no `app_metadata`  
**Passos:**
1. Tentar acessar `/admin` diretamente

**Resultado esperado:**
- Redirecionado para `/notas` (ou `/home`)
- Nunca vê o painel admin

**Resultado real:** ___  
**Status:** ___

---

### TC-ADM-002 🔴 Dashboard admin — estatísticas
**Pré-condições:** Conta com `app_metadata.role = 'admin'`  
**Passos:**
1. Acessar `/admin`

**Resultado esperado:**
- Exibe cards: total de MEIs, total de notas, notas autorizadas, notas hoje
- Distribuição de planos (barra ou lista)
- Últimas 10 notas de todos os MEIs

**Resultado real:** ___  
**Status:** ___

---

### TC-ADM-003 🟠 Gestão de usuários
**Passos:**
1. Acessar `/admin/usuarios`

**Resultado esperado:**
- Listagem de todos os MEIs com: razão social, e-mail, plano, uso do mês
- Barra de progresso de uso por usuário

**Resultado real:** ___  
**Status:** ___

---

### TC-ADM-004 🟠 Alterar plano de um usuário
**Passos:**
1. Em `/admin/usuarios`, clicar em "Alterar Plano" de um MEI
2. Selecionar novo plano
3. Salvar

**Resultado esperado:**
- Plano atualizado imediatamente
- MEI vê o novo plano ao atualizar o dashboard
- Features do novo plano habilitadas/desabilitadas

**Resultado real:** ___  
**Status:** ___

---

### TC-ADM-005 🟠 Notas de todos os MEIs
**Passos:**
1. Acessar `/admin/notas`

**Resultado esperado:**
- Listagem de notas de TODOS os MEIs (sem filtro por usuário)
- Filtros por status e busca por tomador funcionam
- Paginação de 30 itens por página

**Resultado real:** ___  
**Status:** ___

---

## 11. API REST — Autenticação B2B (Gateway)

### TC-API-001 🔴 Emitir nota via API (happy path)
**Pré-condições:** API Key válida (`sk_test_...`), certificado cadastrado  
**Passos:**
```http
POST /v1/nfse
Authorization: Bearer sk_test_<chave>
Content-Type: application/json

{
  "servico": {
    "codigo_nbs": "01.01.01.10",
    "discriminacao": "Serviço de desenvolvimento",
    "valor": 1000.00,
    "aliquota_iss": 2.0
  },
  "tomador": {
    "tipo": "PF",
    "documento": "12345678909",
    "razao_social": "Cliente Teste",
    "municipio_ibge": "3550308"
  },
  "competencia": "2026-05"
}
```

**Resultado esperado:**
- HTTP `202 Accepted`
- Body: `{ "nota_id": "uuid", "status": "PROCESSANDO" }`

**Resultado real:** ___  
**Status:** ___

---

### TC-API-002 🔴 API Key inválida
**Passos:**
```http
POST /v1/nfse
Authorization: Bearer sk_test_invalida123
```

**Resultado esperado:**
- HTTP `401`
- Body: `{ "error": "INVALID_API_KEY", "message": "..." }`

**Resultado real:** ___  
**Status:** ___

---

### TC-API-003 🔴 API Key revogada
**Pré-condições:** API Key revogada via dashboard  
**Passos:**
1. Usar a chave revogada em qualquer endpoint

**Resultado esperado:**
- HTTP `401 INVALID_API_KEY`

**Resultado real:** ___  
**Status:** ___

---

### TC-API-004 🟠 Limite de plano via API
**Pré-condições:** MEI no plano Trial com 3 notas no mês  
**Passos:**
1. Tentar emitir 4ª nota via API

**Resultado esperado:**
- HTTP `402`
- Body: `{ "error": "PLAN_LIMIT_REACHED", "message": "..." }`

**Resultado real:** ___  
**Status:** ___

---

### TC-API-005 🟠 Idempotência — chave duplicada
**Passos:**
1. Emitir nota com `idempotency_key: "chave-unica-123"`
2. Emitir novamente com a mesma `idempotency_key`

**Resultado esperado:**
- 2ª chamada retorna a mesma `nota_id` sem criar nova nota
- Comportamento idempotente: sem duplicação

**Resultado real:** ___  
**Status:** ___

---

### TC-API-006 🟠 Consultar status da nota
**Passos:**
```http
GET /v1/nfse/{nota_id}
Authorization: Bearer sk_test_<chave>
```

**Resultado esperado:**
- HTTP `200`
- Body com todos os campos da nota: status, numero_nfse, protocolo, etc.

**Resultado real:** ___  
**Status:** ___

---

### TC-API-007 🟠 Cancelar nota via API
**Pré-condições:** Nota em status `AUTORIZADA`  
**Passos:**
```http
DELETE /v1/nfse/{nota_id}
Authorization: Bearer sk_test_<chave>
```

**Resultado esperado:**
- HTTP `200`
- Status da nota muda para `CANCELADA`

**Resultado real:** ___  
**Status:** ___

---

### TC-API-008 🟡 Rate limiting
**Passos:**
1. Fazer mais de 100 requisições por minuto com a mesma API Key

**Resultado esperado:**
- HTTP `429 Too Many Requests` após atingir o limite
- Header `Retry-After` indicando quando tentar novamente

**Resultado real:** ___  
**Status:** ___

---

### TC-API-009 🟡 Health check
**Passos:**
```http
GET /v1/health
```

**Resultado esperado:**
- HTTP `200`
- Body indicando status de: db, redis, rabbitmq, receita

**Resultado real:** ___  
**Status:** ___

---

## 12. CONFIGURAÇÕES — Dashboard

### TC-CFG-001 🟠 Upload de certificado A1
**Pré-condições:** MEI sem certificado, arquivo `.pfx` disponível  
**Passos:**
1. Acessar `/configuracoes`
2. Fazer upload do certificado
3. Digitar senha do certificado
4. Salvar

**Resultado esperado:**
- Certificado salvo com sucesso (AWS Secrets Manager)
- Exibe: data de validade, status ativo
- Emissão de notas habilitada

**Resultado real:** ___  
**Status:** ___

---

### TC-CFG-002 🟡 Certificado expirado
**Pré-condições:** Certificado com validade vencida  
**Passos:**
1. Tentar emitir nota com certificado expirado

**Resultado esperado:**
- Erro claro indicando certificado expirado
- CTA para renovar o certificado em Configurações

**Resultado real:** ___  
**Status:** ___

---

## 13. MOBILE / RESPONSIVIDADE

### TC-MOB-001 🟠 Login OTP em mobile (iOS/Android)
**Dispositivo:** iPhone ou Android (viewport ~375px)  
**Passos:**
1. Acessar `/login` no mobile
2. Digitar e-mail e solicitar código
3. Digitar código de 6 dígitos

**Resultado esperado:**
- Teclado numérico abre automaticamente nos boxes de OTP (`inputMode="numeric"`)
- Boxes têm tamanho adequado para toque (~44px)
- Auto-fill do iOS/Android funciona (se suportado)

**Resultado real:** ___  
**Status:** ___

---

### TC-MOB-002 🟡 Sidebar móvel — hamburger menu
**Dispositivo:** Viewport < 1024px  
**Passos:**
1. Abrir dashboard em mobile
2. Clicar no botão hamburger (☰)
3. Clicar em um item do menu
4. Clicar no backdrop para fechar

**Resultado esperado:**
- Drawer abre da esquerda com overlay escuro
- Clicar em item fecha o drawer e navega
- Scroll do body bloqueado com drawer aberto
- Clicar no backdrop fecha o drawer

**Resultado real:** ___  
**Status:** ___

---

### TC-MOB-003 🟢 Dashboard responsivo
**Dispositivo:** Tablet (768px) e mobile (375px)  
**Passos:**
1. Navegar pelas principais páginas no mobile
2. Verificar layout de tabelas e cards

**Resultado esperado:**
- Sem overflow horizontal
- Textos legíveis
- Botões com área de toque ≥ 44px

**Resultado real:** ___  
**Status:** ___

---

## 14. REGRESSÃO — Fluxo ponta a ponta

### TC-E2E-001 🔴 Fluxo completo MEI
**Passos:**
1. Cadastrar novo MEI em `notafacilmei.com.br/cadastro?produto=mei`
2. Verificar e-mail de confirmação (se houver)
3. Fazer login via OTP em `notafacilmei.com.br/login`
4. Confirmar aterrizagem em `notafacilmei.com.br/notas`
5. Ir para Configurações → upload de certificado A1
6. Emitir uma nota fiscal
7. Verificar nota AUTORIZADA
8. Baixar PDF
9. Ir para Billing → selecionar plano Starter → checkout Stripe
10. Verificar plano atualizado e limites ampliados
11. Fazer logout

**Resultado esperado:** Todos os passos concluídos sem erros

**Resultado real:** ___  
**Status:** ___

---

### TC-E2E-002 🔴 Fluxo completo Gateway (B2B)
**Passos:**
1. Cadastrar novo MEI em `notameigateway.com.br/cadastro?produto=gateway`
2. Anotar a API Key exibida na tela de sucesso
3. Fazer login via OTP em `notameigateway.com.br/login`
4. Confirmar aterrizagem em `notameigateway.com.br/notas`
5. Ir para API Keys → criar nova chave com label "Integração"
6. Usar a chave para emitir nota via `POST /v1/nfse`
7. Consultar status via `GET /v1/nfse/{id}`
8. Configurar webhook URL
9. Emitir nova nota e verificar entrega do webhook
10. Verificar nota no painel `/notas`

**Resultado esperado:** Todos os passos concluídos sem erros

**Resultado real:** ___  
**Status:** ___

---

## Observações Gerais para o QA

- **Cartões de teste Stripe:** `4242 4242 4242 4242` (aprovado) · `4000 0000 0000 9995` (recusado)
- **Ambiente de homologação NFS-e:** `https://homologacao.nfse.gov.br` — notas NÃO têm validade fiscal
- **Verificar spam:** e-mails OTP podem cair em spam no primeiro uso
- **CNPJ de teste:** usar gerador de CNPJ válido (dígitos verificadores corretos mas não real)
- **Logs de API:** disponíveis no Railway Dashboard para debug de falhas
- **Logs de auth:** disponíveis no Supabase Dashboard → Authentication → Logs

---

*Documento gerado em 2026-05-05. Atualizar a cada release.*
