# Investigar e corrigir — Funil de cadastro ME

> Aberto em 2026-07-16 · Origem: campanha Google Ads "NotaFácil - Pesquisa - ME" (pausada)
> Objetivo: descobrir por que **ninguém consegue se cadastrar** e reabrir a porta antes de religar o tráfego pago.

---

## 1. Contexto — o que motivou

Rodamos uma campanha de Pesquisa no Google Ads (13/jul → 16/jul) mirando ME/EPP, mandando tráfego para `emitirnotafacil.com.br/me`.

| Métrica | Valor |
|---|---|
| Cliques | 38 |
| CTR | 2,64% |
| CPC médio | R$ 2,59 |
| Gasto | R$ 97,08 |
| **Cadastros gerados** | **0** |

**O tráfego não é o problema.** O GA4 recebeu `cta_click`, `pricing_view`, `form_start` e `form_submit` — ou seja, gente **chegou, clicou no CTA, viu preço e mexeu no formulário**. Mas a consulta ao banco (Supabase, tabela `empresas`) mostra:

- Última empresa criada: **2026-06-26** — três semanas ANTES da campanha.
- Desde o lançamento (13/jul): **nenhuma**.

Conclusão: **a porta de entrada está fechada.** Não adianta comprar clique enquanto isso não for resolvido.

---

## 2. 🔴 BUG #1 (crítico) — Beco sem saída no Step 1 do cadastro

**Arquivo:** `apps/web/app/(onboarding)/cadastro/me/page.tsx`
**Status:** confirmado por leitura de código · **falta reproduzir no navegador**

### O que acontece

O Step 1 busca o CNPJ na BrasilAPI automaticamente (auto-preenche razão social, CNAE, CEP, município, e-mail). Quando essa busca **falha por qualquer motivo** — rede, timeout, rate limit, CORS, CNPJ novo/não encontrado na Receita, API fora do ar:

```ts
} catch {
  setCnpjLookupError('Falha ao consultar Receita. Preencha manualmente.')
}
```

Mas o botão de avançar é:

```ts
disabled={cnpjLookupLoading || !!cnpjLookupError}
```

E o `validateStep1()` também bloqueia:

```ts
else if (cnpjLookupError && cnpjDigits.length === 14) errs.cnpj = cnpjLookupError
```

### Por que é um beco sem saída

1. A mensagem **manda preencher manualmente** — mas o botão está **desabilitado**. Contradição direta.
2. O erro só é limpo quando o `useEffect` roda de novo, e ele tem um guard:
   ```ts
   if (digits === lastFetchedCnpjRef.current) return
   ```
   Ou seja: **redigitar o mesmo CNPJ não refaz a busca.** O usuário fica preso permanentemente, a menos que digite um CNPJ *diferente* (que não é o dele).

Isso casa exatamente com o sintoma observado: `form_start` dispara, e **zero empresa no banco**.

### Fix proposto

Falha de lookup deve ser **aviso**, não bloqueio:
- Remover `!!cnpjLookupError` do `disabled` do botão.
- Remover o bloqueio no `validateStep1()` para erros de *lookup* (manter apenas a validação de DV/módulo 11, que é erro real do usuário).
- Distinguir dois tipos de erro:
  - **CNPJ inválido (DV)** → bloqueia (é erro do usuário).
  - **Falha/indisponibilidade da BrasilAPI / CNPJ não encontrado** → só avisa e libera o preenchimento manual.
- Permitir "tentar de novo" (limpar o `lastFetchedCnpjRef` ou expor um botão de retry).

### Como testar

1. `/cadastro/me` em aba anônima.
2. CNPJ real e válido → deve auto-preencher e liberar o botão.
3. **Simular falha**: DevTools → Network → throttle/offline durante a busca, OU usar CNPJ válido inexistente na Receita.
4. **Confirmar o travamento**: botão fica desabilitado pra sempre? Redigitar o mesmo CNPJ resolve?
5. Após o fix: com a BrasilAPI falhando, deve ser possível preencher tudo na mão e concluir.

---

## 3. 🟠 BUG #2 — `signup_complete` nunca dispara no fluxo ME (estamos cegos)

**Arquivos:**
- `apps/web/lib/analytics/events.ts` (define `trackSignupComplete`)
- `apps/web/app/obrigado/cadastro/page.tsx` (único lugar que o chama)
- `apps/web/app/(onboarding)/cadastro/me/page.tsx` (fluxo ME — **não** chama)

### O que acontece

`trackSignupComplete()` + `sendAdsConversion('NEXT_PUBLIC_ADS_CONV_SIGNUP')` só rodam na página `/obrigado/cadastro`. Mas o cadastro ME, ao dar certo, faz:

```ts
setAppStep('success')   // tela de sucesso inline — NÃO redireciona pra /obrigado/cadastro
```

**Resultado: mesmo com cadastro real, o evento nunca dispara.** Confirmado no GA4 — `signup_complete` não aparece na lista de eventos recebidos nos últimos 28 dias.

### Impacto

Sem isso não conseguimos medir cadastro nem otimizar campanha (nem migrar pra Smart Bidding depois). Foi só porque consultamos o banco direto que sabemos que o zero é real.

### Fix proposto

Escolher **uma** das duas:
- **(a)** Disparar `trackSignupComplete({ persona: 'me', plan })` no `useEffect` da tela de sucesso do fluxo ME; ou
- **(b)** Redirecionar para `/obrigado/cadastro?persona=me` após o sucesso (reaproveita o disparo que já existe e centraliza).

Preferência: **(b)** — uma única fonte de verdade pro evento, menos chance de divergir de novo.

> ⚠️ Não popular os labels `NEXT_PUBLIC_ADS_CONV_*` na Vercel. A conversão pro Google Ads vai por **importação GA4↔Ads** (já existe a ação "NotaFácil — Assinatura paga"). Se os dois caminhos dispararem, conta em dobro.

---

## 4. 🟡 Investigar — dois fluxos de cadastro ME coexistindo?

Existem **duas** implementações de cadastro ME no repo:

| Rota | Arquivo | Observação |
|---|---|---|
| `/cadastro/me` | `app/(onboarding)/cadastro/me/page.tsx` | wizard de 3 steps · **é pra onde a LP `/me` manda** |
| `/me/cadastro` | `app/(dashboard)/me/cadastro/CadastroMEStepper.tsx` + `steps/` + `actions.ts` | stepper de 4 steps (Dados · Regime · Certificado · API Key) |

**Investigar:** qual é o fluxo vivo? O outro é código morto? Se ambos estão ativos, qual recebe o tráfego pago e qual está sendo mantido? Duplicação assim é fonte garantida de bug divergente (ex.: corrigir o tracking num e esquecer o outro).

---

## 5. 🟡 Investigar — fricção que derruba conversão

**Arquivo:** `apps/web/app/(onboarding)/cadastro/me/page.tsx`

1. **CNAE obrigatório de 7 dígitos** (`validateStep2`): se a BrasilAPI não auto-preencheu, o dono da ME precisa saber o CNAE de cabeça. Muita gente não sabe → abandono.
   - Avaliar: tornar opcional? Buscar por descrição? Aceitar sem e completar depois no painel?
2. **CEP/município obrigatório** — ok, mas depende do `CepMunicipioInput` funcionar. Testar com CEP real.
3. **Promessa da LP vs. realidade**: a `/me` promete *"Cadastrar minha ME gratuitamente"*. Conferir se o caminho até "empresa criada" é realmente leve (o cert A1 já foi tirado do caminho — o Step 3 é pulado —, mas vale reconfirmar).

---

## 6. 🟡 Investigar — e-mail: o cliente recebe o acesso?

Depois do cadastro, o acesso é **100% por magic link no e-mail**. Dois riscos que perdem cliente **depois** de ele já ter se cadastrado:

1. **E-mail auto-preenchido da Receita**:
   ```ts
   email: prev.email || (data.email ?? '')
   ```
   A BrasilAPI devolve o e-mail cadastrado na Receita — que costuma ser **antigo ou do contador**. O magic link vai pro lugar errado e o cliente nunca entra.
   - Fix a avaliar: não auto-preencher e-mail, ou marcar como "confirme este e-mail".
2. **Entrega do e-mail** (Supabase Auth + Brevo): testar tempo de chegada, spam, e clicar no link até cair logado.
   - Ver skill `nota-mei-auth` (callback PKCE + OTP token_hash) e a rota admin `/api/dev/magic-link` pra QA.

---

## 7. 🟡 Investigar — a API está de pé?

Endpoint chamado pelo cadastro: `POST {NEXT_PUBLIC_API_URL}/v1/auth/register/me` (→ `api.emitirnotafacil.com.br`).

Se der 500/timeout/CORS, o usuário vê só *"Erro ao cadastrar empresa. Tente novamente."*

**Checar:**
- `GET /v1/health`.
- POST direto via curl com CNPJ de teste → ver status e corpo.
- **Logs do Railway (serviço `api`) no período 13–16/jul**, filtrando 4xx/5xx — se alguém tentou e falhou, está lá.
- **Vercel runtime errors** nas rotas `/me` e `/cadastro/me`.

---

## 8. 🔵 Higiene (rápido, mas conta)

- **Mobile**: a maior parte do clique pago é celular. Passar o fluxo **inteiro** num celular real.
- **LCP da `/me`**: acima de 2,5s o tráfego pago abandona (Vercel Speed Insights).
- **Console do navegador** na `/me` e `/cadastro/me` — erro de JS quebra o form silenciosamente.

---

## 9. Ordem sugerida

1. **Reproduzir o BUG #1** (5 min) — é o mais provável e o mais barato de checar.
2. **Ler os logs** Railway/Vercel do período dos 38 cliques — se houve erro real, aparece.
3. **Corrigir #1 + #2 no mesmo deploy** de `apps/web` (política de deploy batched — ver CLAUDE.md §10-bis).
4. Resolver os itens 4–6 conforme o que a investigação mostrar.
5. **Só então** despausar a campanha ME no Google Ads (está pronta, é 1 clique) e refazer o teste — aí sim com medição funcionando.

## 10. Definição de pronto

- [ ] Com a BrasilAPI falhando, é possível concluir o cadastro preenchendo na mão.
- [ ] Um cadastro de ponta a ponta cria a linha em `empresas` **e** dispara `signup_complete` no GA4.
- [ ] O magic link chega e loga no painel.
- [ ] Fluxo completo passa no celular.
- [ ] Fica claro qual dos dois fluxos de cadastro ME é o vivo (e o morto foi removido).
