# Medição de tráfego pago — diagnóstico e correções

> 2026-07-21 · NotaFácil (`emitirnotafacil.com.br`) · campanha "NotaFácil - Pesquisa - ME"
> Conta Google Ads 530-742-4931 · GA4 propriedade `p543205085`

---

## 1. O problema

A campanha ME rodou com tráfego de ótima qualidade (CTR 4,70%, CPC R$1,97, 100% dos
termos de pesquisa on-topic) e mesmo assim registrava **0 cadastros**. A investigação
mostrou que o problema **não era o tráfego nem a oferta — era a medição**.

| Fonte | Cliques / sessões (28 dias) |
|---|---|
| Google Ads (cliques na campanha ME) | **~77** |
| GA4 (sessões `google / cpc`) | **8** |
| **Taxa de medição** | **~10%** |

Cerca de **90% do tráfego pago sumia antes de virar dado**.

### Causa raiz

`apps/web/lib/analytics/gtag.ts` inicializa o Consent Mode v2 com tudo negado:

```js
gtag('consent', 'default', {
  analytics_storage: 'denied', ad_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied',
  wait_for_update: 500
});
```

O gtag carrega e envia *cookieless pings*, mas o GA4 só converte esses pings em dados
de relatório via **modelagem comportamental**, que exige ~1.000 eventos/dia por 7 dias.
O site fez **312 eventos em 28 dias**. Os pings são coletados e **nunca viram relatório**.

Resultado prático: **só aparece nos relatórios quem clica "Aceitar"** no banner — ~10%.

### Bug encontrado no caminho (corrigido)

Os dois caminhos de consentimento **discordavam entre si**:

| Caminho | `analytics_storage` | `ad_storage` |
|---|---|---|
| `consent.ts` → usuário clica "Aceitar" (**1ª visita**) | `granted` | ❌ `denied` (fixo) |
| `gtag.ts` → visitante recorrente (cookie já salvo) | `granted` | ✅ `granted` |

`ad_storage` é o que autoriza guardar o **GCLID** (cookie `_gcl_*`), o elo entre
*clique no anúncio* e *conversão*. Ele ficava negado exatamente na **primeira visita**,
que é a que vem do anúncio — e só era concedido se a pessoa **voltasse depois**.

Como a conversão chega no Google Ads por **importação do GA4**, a atribuição da campanha
estava estruturalmente quebrada.

---

## 2. O que foi corrigido

### (A) Consentimento consistente — `ad_storage` segue o aceite

`apps/web/lib/analytics/consent.ts` — os quatro sinais agora seguem o mesmo estado.

⚠️ **Acompanha mudança de texto obrigatória.** Como o aceite passou a conceder de fato
cookies de publicidade, o banner (`components/consent/CookieBanner.tsx`) foi reescrito
de "Cookies analíticos / Não compartilhamos seus dados" para descrever o que realmente
acontece (Google Analytics **e** Google Ads, medição de origem incluindo anúncios).
Descrever como só "analítico" tornaria o consentimento **não informado**.

### (B) Atribuição no banco — medição independente do consentimento

O GA4 continuará vendo só quem aceita. Então a pergunta de negócio
("a campanha gerou cadastro?") passa a ser respondida pelo **banco**, que é imune
a consentimento, adblock e modelagem.

| Arquivo | Papel |
|---|---|
| `apps/web/lib/analytics/attribution.ts` | Captura `gclid`/`gbraid`/`wbraid` + `utm_*` da URL de entrada; persiste em cookie first-party `nf_attr` (90 dias), modelo *last non-direct touch* |
| `apps/web/components/analytics/AttributionCapture.tsx` | Monta no root layout — precisa rodar na chegada (o clique cai em `/me`, o cadastro é em `/cadastro/me`) |
| `apps/web/app/(onboarding)/cadastro/me/page.tsx` | Envia `atribuicao` no POST de cadastro |
| `apps/api/internal/handler/register_me.go` | Aceita e trunca os campos (entrada pública = hostil, mas nunca bloqueia o cadastro) |
| `apps/api/internal/auth/empresa.go` | Persiste; campos vazios viram `NULL` |
| `supabase/migrations/20260721000001_atribuicao_cadastro.sql` | Colunas + índices parciais |

**Consulta que responde o teste da campanha:**

```sql
-- Cadastros por origem, últimos 30 dias
SELECT
  COALESCE(utm_source, CASE WHEN gclid IS NOT NULL THEN 'google(gclid)' END, 'orgânico/direto') AS origem,
  utm_medium,
  utm_campaign,
  COUNT(*) AS cadastros
FROM empresas
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY cadastros DESC;

-- Só os que vieram de clique pago
SELECT created_at, razao_social, gclid, utm_campaign, utm_term, landing_page
FROM empresas
WHERE gclid IS NOT NULL
ORDER BY created_at DESC;
```

> ℹ️ Depende do **auto-tagging** do Google Ads estar ligado (padrão: sim) pra o `gclid`
> chegar na URL. Vale conferir em *Configurações da conta → Tagging automática*.

---

## 3. (C) Proposta em aberto — repensar o banner

**Não implementado. Requer validação jurídica antes de qualquer deploy.**

Mesmo com A + B, o GA4 segue enxergando só ~10% — bom o bastante pro teste da campanha
(que agora se apoia no banco), mas ruim pra qualquer análise de comportamento
(páginas, funil, scroll, abandono).

### O ponto jurídico

A LGPD **não** exige o modelo europeu de bloqueio prévio (opt-in) para cookies
analíticos da mesma forma que o GDPR/ePrivacy. Muitos sites brasileiros operam com
**barra de aviso + opt-out**, apoiando-se em legítimo interesse (Art. 7º, IX) para
medição própria, reservando o opt-in explícito para publicidade personalizada.

### Modelo sugerido para avaliação

| Categoria | Base | Comportamento |
|---|---|---|
| Analytics (GA4, medição própria) | Legítimo interesse | `granted` por padrão, com aviso claro e opt-out fácil |
| Publicidade (`ad_personalization`) | Consentimento | permanece `denied` até aceite explícito |

Ganho estimado: medição de ~10% → perto de 100%, sem tirar o controle do usuário.

### ⚠️ Antes de implementar

1. Validar com quem responde pela privacidade (`privacidade@emitirnotafacil.com.br`).
2. Atualizar `/privacidade` descrevendo categorias, bases legais e como revogar.
3. Manter uma forma **sempre acessível** de mudar a escolha (hoje o banner some após
   a primeira interação e não há como reabrir — pendência a resolver junto).

---

## 4. Estado / próximos passos

- [x] Bug do `ad_storage` corrigido + texto do banner alinhado
- [x] Atribuição no banco (frontend + API + migration)
- [x] `supabase db push` pra aplicar a migration em produção — *aplicada 2026-07-21; 19 empresas preservadas, colunas acessíveis*
- [x] Deploy (web + api) — *commits `3f66c19` (api+migration) e `3c3ea92` (web), separados conforme §10-bis*
- [x] Reabrir preferências de cookie — *`resetConsent()` + link "Preferências de cookies" no rodapé; banner reaparece via evento. Ver §5*
- [ ] Conferir auto-tagging ligado no Google Ads ⏳ **Chris**
- [ ] Reavaliar a campanha ME com dado do banco ao atingir ~R$150 ⏳ **Chris**
- [ ] Decidir sobre (C) após validação jurídica ⏳ **Chris**

---

## 5. Achados da revisão pré-deploy (não estavam no plano)

Dois problemas apareceram ao revisar o que iria pra produção. Ambos corrigidos
no commit `3c3ea92`.

### 5.1 🔴 A política de privacidade ficaria factualmente falsa

`/privacidade` §8 dizia:

> "Utilizamos **apenas cookies estritamente necessários** (…). **Não utilizamos
> cookies de rastreamento ou publicidade.**"

Já era impreciso (o GA4 roda quando o usuário aceita), mas a correção (A) tornaria
a frase **diretamente falsa** — "Aceitar" passou a conceder `ad_storage`, ou seja,
cookies de publicidade do Google. E (B) adiciona o `nf_attr`. Subir assim deixaria
o **banner dizendo uma coisa e a política a oposta** — o consentimento deixaria de
ser informado justamente no documento que deveria informá-lo.

Seção 8 reescrita descrevendo o que o código de fato faz:

| Categoria | Exemplos | Base legal |
|---|---|---|
| a) Necessários | sessão Supabase, preferências, o próprio `nf_consent` | Execução de contrato (Art. 7º, V) |
| b) Medição de origem | `nf_attr` (90d, sem dado pessoal, não compartilhado) | Legítimo interesse (Art. 7º, IX) |
| c) Análise e publicidade | `_ga`, `_gcl_*` — **só com aceite** | Consentimento (Art. 7º, I) |

### 5.2 🟠 Não havia como revogar o consentimento

O banner sumia após a primeira escolha e **não havia como mudar de ideia** sem
apagar cookies na mão. A LGPD pede que revogar seja tão fácil quanto consentir
(Art. 8º, §5º) — na prática a escolha ficava presa.

Implementado: `resetConsent()` em `lib/analytics/consent.ts` (nega os quatro
sinais **antes** de apagar o cookie, pra que o estado que vale seja o restritivo
caso o usuário saia da página em seguida) + link **"Preferências de cookies"** no
rodapé + `CONSENT_RESET_EVENT` pro banner reaparecer (banner e rodapé são
componentes irmãos, sem estado compartilhado).

**Validado no browser antes do deploy:**

| Ação | Banner | Cookie | Sinais gtag |
|---|---|---|---|
| Aceitar | some | `granted` | 4× `granted` |
| Revogar (rodapé) | **volta** | apagado | 4× `denied` |

> Isso resolve também o item que a §3 listava como pendência a tratar junto da
> proposta (C) — a revogação já existe **independente** de qualquer decisão sobre
> mudar o modelo de consentimento.
