# QA — Validação Completa NotaFácil v2.0
> Roteiro de testes pós-rebrand + multi-produto + migração MEI → ME
> Branch: `main` · Commit alvo: `825c512` ou superior · Ambiente: produção

---

## Pré-requisitos

| Item | Valor |
|---|---|
| Dashboard | https://nota-mei-gateway-web.vercel.app |
| API | https://api.emitirnotafacil.com.br |

### Usuários já criados em produção (login direto, sem Magic Link)

| ID | E-mail | Senha | Persona | Empresa |
|---|---|---|---|---|
| U1 | `qa-mei@testador.dev` | `QaTeste2026!` | MEI | QA Teste MEI LTDA · 12.345.678/0001-95 |
| U2 | `qa-me@testador.dev` | `QaTeste2026!` | ME | QA Empresa ME LTDA · 98.765.432/0001-10 |
| U3 | `qa-novo@testador.dev` | `QaTeste2026!` | — | (sem empresa cadastrada) |

> Login com e-mail + senha em `/login` · sem precisar de Magic Link.

---

## Bloco A — Identidade Visual NotaFácil v2.0

### A1 — Tema light é padrão na home
**Anônimo · `/`**
1. Abrir em janela limpa (sem cookies de tema)
2. Inspecionar background da página

✅ Esperado:
- `body` com `background-color: rgb(248, 250, 252)` (slate-50 claro)
- Texto principal `rgb(15, 23, 42)` (slate-900)
- Fonte: **DM Sans** (verificar em Computed → font-family)

### A2 — Logo correto por persona

| Rota | Logo esperado | Cor da CTA "Cadastrar grátis"/principal |
|---|---|---|
| `/` (home) | `notafacil-logo.svg` (azul) | `#3B82F6` brand-blue |
| `/mei` | `notafacil-mei.svg` (teal) | `#14B8A6` persona-mei |
| `/me` | `notafacil-empresa.svg` (coral) | `#F97316` persona-emp |
| `/gateway` | `notafacil-api.svg` (purple) | `#8B5CF6` persona-api |

Procedimento: visitar cada rota, abrir DevTools → inspecionar `nav img` e `nav a[href*=cadastro]`. Verificar `src` do img e `background-color` computado.

### A3 — Favicon NotaFácil
1. Verificar aba do browser exibindo o ícone novo (documentos sobrepostos + check azul)
2. Confirmar que `/favicon.ico` retorna 200 e o conteúdo é o ícone novo (não o antigo "Nota MEI")

### A4 — Toggle de tema
1. Em `/`, clicar no botão de tema (ícone lua/sol)
2. Background deve mudar para tom escuro (`rgb(15, 23, 42)`)
3. Logo deve manter legibilidade (variante dark se aplicável)
4. Persistir tema após reload (localStorage `theme`)

---

## Bloco B — Navegação e Redirects (BUG-01..03 do ciclo anterior)

### B1 — Navbar desktop (≥ 1024px)
**Anônimo · `/`**

Itens esperados na navbar:
- [ ] Logo NotaFácil (canto esquerdo) → clicável → `/`
- [ ] Link "MEI" → `/mei`
- [ ] Link "ME / EPP" → `/me`
- [ ] Link "Gateway API" → `/gateway`
- [ ] Link "Preços" → `/precos`
- [ ] Toggle de tema
- [ ] Botão "Entrar" → `/login`
- [ ] Botão "Cadastrar grátis" (CTA preenchida) → `/cadastro`

### B2 — Mobile drawer (< 640px)
**Anônimo · `/` em viewport 375px**

1. Clicar no ícone hambúrguer (canto direito)
2. Drawer deve abrir com `role="dialog"`

Itens esperados no drawer:
- [ ] MEI · ME / EPP · Gateway API · Preços · Documentação · Status
- [ ] Botão "Entrar" (secondary, com borda)
- [ ] Botão "Cadastrar grátis" (primary, preenchido)
- [ ] Drawer fecha ao clicar em qualquer link
- [ ] Drawer fecha com tecla Esc

### B3 — Redirects canônicos (5 URLs)

| URL | Redirect esperado | Tipo |
|---|---|---|
| `/desenvolvedor` | `/gateway` | 308 permanente |
| `/developer` | `/gateway` | 308 permanente |
| `/entrar` | `/login` | 308 permanente |
| `/registrar` | `/cadastro` | 308 permanente |
| `/mei/cadastro` | `/cadastro?produto=mei` | 307 temporário |

Validar via `curl -I https://nota-mei-gateway-web.vercel.app/<url>` e checar `location:` no header.

---

## Bloco C — Cadastro e Seletor de Produto

### C1 — `/cadastro` exibe seletor de 3 produtos
**Anônimo · `/cadastro`** (sem query string)

✅ Esperado:
- H1 "Criar conta" ou "Como você quer começar?"
- 3 cards visíveis:
  1. **Sou MEI** → link `/cadastro?produto=mei`
  2. **Tenho ME/EPP** com badge "Obrigatório em Set/2026" → link `/cadastro/me` ou `/me/cadastro`
  3. **Integrar via API** → link `/gateway`
- Link "Já tenho conta — entrar" no rodapé

### C2 — `/cadastro?produto=mei` mostra formulário MEI direto

Pular o seletor e abrir o stepper de cadastro MEI.

### C3 — `/cadastro?produto=gateway` mostra cadastro API

Cadastro voltado para devs (e-mail + nome + senha).

---

## Bloco D — Dashboard MEI (login U1)

### D1 — Login com U1
1. `/login` → e-mail `qa-mei@testador.dev` + senha `QaTeste2026!` → "Entrar"
2. Após autenticar, deve cair direto em `/notas` (1 empresa = sem seletor)

### D2 — Sidebar MEI
- [ ] Logo: **NotaFácil MEI** (variante teal)
- [ ] Razão social: "QA Teste MEI LTDA"
- [ ] Nav: Notas Fiscais, Templates, API Keys, Plano & Faturamento, Configurações
- [ ] **NÃO aparecem**: Automação, Webhooks (são ME/EPP only)
- [ ] Active state em `/notas` na cor brand-blue

### D3 — Aviso de migração não aparece (>90 dias)
- [ ] Banner "Obrigatoriedade NFS-e" **não** deve estar visível (ainda faltam ~117 dias para 01/09/2026)

### D4 — Acesso /configuracoes/migrar
1. Navegar para `/configuracoes/migrar`
2. Stepper deve carregar com Step 1 — dados da empresa pré-preenchidos:
   - Razão social: QA Teste MEI LTDA
   - CNPJ formatado: 12.345.678/0001-95
   - Tipo atual: MEI / Novo tipo: ME (em destaque)
   - Box de aviso amarelo com 4 itens

---

## Bloco E — Dashboard ME (login U2)

### E1 — Login com U2
1. `/login` → `qa-me@testador.dev` + `QaTeste2026!`
2. Cai direto em `/notas`

### E2 — Sidebar ME
- [ ] Logo: **NotaFácil Empresa** (variante coral)
- [ ] Razão social: "QA Empresa ME LTDA"
- [ ] Nav completa: Notas Fiscais, Templates, **Automação**, API Keys, **Webhooks**, Plano & Faturamento, Configurações

### E3 — Bloqueio de página de migração
1. Acessar `/configuracoes/migrar`
2. Deve redirecionar para `/configuracoes` (empresa não é MEI)
3. Sem 500 nem tela em branco

---

## Bloco F — Sem empresa (login U3)

### F1 — Redirect para /cadastro
1. `/login` → `qa-novo@testador.dev` + `QaTeste2026!`
2. Tentar acessar `/notas`
3. Deve redirecionar para `/cadastro` (sem empresa cadastrada)
4. Seletor de 3 produtos deve aparecer

---

## Bloco G — Multi-empresa

### G1 — Adicionar 2ª empresa para U1 (setup via SQL)

No Supabase Dashboard → SQL Editor (ou via service role):

```sql
INSERT INTO empresas (tipo, regime_tributario, cnpj, razao_social, email,
                      municipio_ibge, cnae, cep, user_id, trial_me, tipo_usuario)
VALUES ('ME', 'SIMPLES_NACIONAL', '11223344000155', 'QA Segunda Empresa ME',
        'qa-mei@testador.dev', '3550308', '6201500', '01310100',
        '7906e372-0107-4ec7-abfa-cd9c28a274b7', true, 'gateway');
```

E remover preferência salva:
```sql
DELETE FROM user_preferences WHERE user_id = '7906e372-0107-4ec7-abfa-cd9c28a274b7';
```

### G2 — Seletor de empresa
1. Logout + login U1
2. Deve cair em `/seletor-empresa`
3. Listar 2 empresas com nome, tipo (badge MEI/ME), notas no mês
4. Card "Adicionar outra empresa" no rodapé

### G3 — EmpresaSwitcher
1. Selecionar a empresa MEI no seletor → cai em `/notas` com sidebar teal
2. No EmpresaSwitcher (header ou dropdown), trocar para a empresa ME
3. Sidebar deve atualizar para coral (NotaFácil Empresa) e itens de menu adaptarem (Automação + Webhooks aparecem)

### G4 — Persistência da preferência
1. Selecionar empresa ME via switcher
2. Logout + login
3. Deve cair direto em `/notas` com a empresa ME ativa (sem passar pelo seletor)

---

## Bloco H — Migração MEI → ME (login U1, empresa MEI)

> Pré-requisito: remover a 2ª empresa criada em G1, ou usar uma conta MEI nova

### H1 — Stepper completo
1. `/configuracoes/migrar` → Step 1
2. Confirmar dados → "Continuar →"
3. Step 2: marcar **Lucro Presumido**, inscrição municipal "99999-1"
4. Voltar para Step 1, voltar para Step 2 → seleção persiste
5. "Confirmar migração"
6. Step 3: tela de sucesso ✅ menciona regime "Lucro Presumido"
7. "Ir para as notas →" → cai em `/notas`

### H2 — UI atualiza para ME
- [ ] Sidebar muda para variante coral (NotaFácil Empresa)
- [ ] Itens "Automação" e "Webhooks" aparecem
- [ ] Página `/configuracoes/migrar` agora redireciona (já não é MEI)

### H3 — Verificação no banco
```sql
-- 1. Empresa atualizada
SELECT tipo, regime_tributario, inscricao_municipal
FROM empresas WHERE cnpj = '12345678000195';
-- Esperado: tipo='ME', regime_tributario='LUCRO_PRESUMIDO', inscricao='99999-1'

-- 2. Histórico de migração
SELECT de_tipo, para_tipo, status FROM empresa_migracoes
WHERE empresa_id = (SELECT id FROM empresas WHERE cnpj='12345678000195');
-- Esperado: 1 linha com de_tipo=MEI, para_tipo=ME, status=CONCLUIDA

-- 3. Audit log
SELECT acao, produto, metadata->>'regime_tributario'
FROM audit_log WHERE acao='migrar_mei_para_me'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: produto=ME_DASHBOARD, regime_tributario=LUCRO_PRESUMIDO
```

### H4 — API rejeita migração inválida
Obter token Bearer da sessão U2 (DevTools → Application → cookies `sb-*`):

```bash
# Tentativa de migrar empresa que já é ME → 409
curl -X POST https://api.emitirnotafacil.com.br/v1/auth/migrar \
  -H "Authorization: Bearer <U2_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"empresa_id":"de0a3966-7f39-4d12-b74a-8c34ff0da864","para_tipo":"ME","regime_tributario":"SIMPLES_NACIONAL"}'
# Esperado: 409 INVALID_TIPO

# Regime inválido → 400
curl -X POST https://api.emitirnotafacil.com.br/v1/auth/migrar \
  -H "Authorization: Bearer <U1_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"empresa_id":"d1d66ffc-541c-4a59-aff2-537d7497edf1","para_tipo":"ME","regime_tributario":"INVALIDO"}'
# Esperado: 400 VALIDATION_ERROR
```

---

## Bloco I — Regressão e Smoke

### I1 — Emissão de nota (smoke)
**U2 (ME) · /notas**
1. Clicar "Emitir nota"
2. Preencher dados mínimos válidos
3. Submeter → nota deve aparecer com status PROCESSANDO
4. Sem 500 nem RLS bloqueando

### I2 — Conta MEI legada (sem `empresas`)
Se existir conta legada (cadastro antes da migração `multi_produto`), validar:
- [ ] Login funciona
- [ ] Sidebar mostra NotaFácil MEI (fallback via tabela `meis`)
- [ ] Notas históricas aparecem
- [ ] Sem regressão

### I3 — Performance / sem console errors
**Anônimo · `/`, `/mei`, `/me`, `/gateway`, `/cadastro`**
1. Abrir DevTools → Console
2. Recarregar cada página
3. Não devem aparecer erros vermelhos
4. Lighthouse > 80 em Performance e Accessibility

---

## Checklist Final

| # | Bloco | Teste | Status | Obs |
|---|---|---|---|---|
| A1 | Visual | Tema light padrão | ⬜ | |
| A2 | Visual | Logo por persona (4 rotas) | ⬜ | |
| A3 | Visual | Favicon NotaFácil | ⬜ | |
| A4 | Visual | Toggle tema persistente | ⬜ | |
| B1 | Nav | Navbar desktop completa | ⬜ | |
| B2 | Nav | Mobile drawer com 2 CTAs | ⬜ | |
| B3 | Nav | 5 redirects canônicos | ⬜ | |
| C1 | Cadastro | Seletor 3 produtos | ⬜ | |
| C2 | Cadastro | `?produto=mei` direto | ⬜ | |
| C3 | Cadastro | `?produto=gateway` | ⬜ | |
| D1 | MEI | Login U1 → /notas | ⬜ | |
| D2 | MEI | Sidebar variante teal | ⬜ | |
| D3 | MEI | Sem banner migração | ⬜ | |
| D4 | MEI | Acesso /migrar | ⬜ | |
| E1 | ME | Login U2 → /notas | ⬜ | |
| E2 | ME | Sidebar variante coral | ⬜ | |
| E3 | ME | Bloqueio /migrar | ⬜ | |
| F1 | Sem empresa | Redirect /cadastro | ⬜ | |
| G1 | Multi | Setup 2ª empresa | ⬜ | |
| G2 | Multi | Seletor de empresa | ⬜ | |
| G3 | Multi | EmpresaSwitcher | ⬜ | |
| G4 | Multi | Persistência prefs | ⬜ | |
| H1 | Migração | Stepper completo | ⬜ | |
| H2 | Migração | UI atualiza ME | ⬜ | |
| H3 | Migração | Banco consistente | ⬜ | |
| H4 | Migração | API valida erros | ⬜ | |
| I1 | Regressão | Emissão de nota | ⬜ | |
| I2 | Regressão | Conta legada | ⬜ | |
| I3 | Regressão | Sem console errors | ⬜ | |

---

## Critério de Aprovação

| Prioridade | Testes | Critério |
|---|---|---|
| 🔴 Bloqueante | A1, A2, B1–B3, C1, D1–D2, E1–E2, H1–H3, I1 | 100% |
| 🟡 Alta | A3, A4, B1, C2–C3, D3–D4, E3, F1, G1–G4, H4 | ≥ 90% |
| 🟢 Média | I2, I3 | ≥ 80% |

Bugs encontrados: abrir issue com label `qa` e prefixo `[v2.0]`.
