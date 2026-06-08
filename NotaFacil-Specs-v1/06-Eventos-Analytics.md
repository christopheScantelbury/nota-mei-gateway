# 06 — Taxonomia de Analytics

> Eventos GA4 padronizados. Não criar eventos ad-hoc fora desta taxonomia.
> Tudo passa pela função canônica `trackCtaClick` ou helpers similares em `lib/analytics/events.ts`.

---

## Configuração GA4

### Property ID
- Variável de ambiente: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Formato: `G-XXXXXXXXXX`

### Consent Mode v2 (obrigatório LGPD)
Antes do aceite do banner:
```javascript
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500,
})
```

Após aceite:
```javascript
gtag('consent', 'update', {
  analytics_storage: 'granted',
})
```

---

## Custom Dimensions (cadastrar no painel GA4)

| Nome | Escopo | Tipo | Descrição | Valores aceitos |
|---|---|---|---|---|
| `persona` | event | text | Persona do usuário no momento do evento | `mei`, `me`, `dev`, `unknown` |
| `cta_location` | event | text | Onde o CTA estava na página | ver tabela abaixo |
| `plan` | event | text | Plano associado (se aplicável) | `mei_avulso`, `mei_mensal`, `me_start`, ... |
| `experiment_id` | event | text | ID do feature flag/experimento | `hero_copy_variant`, `none`, ... |
| `variant` | event | text | Variante atribuída | `control`, `variant_a`, ... |
| `page_section` | event | text | Seção da página | `hero`, `pricing`, `comparativo`, `faq` |
| `utm_first_source` | user | text | UTM source do primeiro toque | qualquer string |
| `utm_first_medium` | user | text | UTM medium do primeiro toque | qualquer string |
| `utm_first_campaign` | user | text | UTM campaign do primeiro toque | qualquer string |

### Valores aceitos para `cta_location`

```
topbar
header
hero_main_cta
hero_card_mei
hero_card_me
hero_card_dev
sandbox_hero
gateway_hero
pricing_card_mei
pricing_card_me
pricing_card_dev
pricing_main_cta
comparativo_hero
comparativo_table
comparativo_faq
comparativo_final
blog_inline
blog_cta_banner
blog_migration_cta
footer
email_onboarding
email_urgency
404_page
```

---

## Eventos canônicos

### `page_view`
**Disparado:** automático pelo GA4 em mudança de rota
**Props customizadas:** nenhuma além das padrão

### `cta_click`
**Disparado:** clique em qualquer botão/link de conversão
**Props:**
```typescript
{
  persona: 'mei' | 'me' | 'dev' | 'unknown'
  cta_location: CtaLocation
  plan?: string
  experiment_id?: string
  variant?: string
}
```

**Exemplo de chamada:**
```typescript
trackCtaClick({
  persona: 'me',
  location: 'pricing_card_me',
  plan: 'me_start',
})
```

### `pricing_view`
**Disparado:** Intersection Observer detecta seção de preços visível por > 1s
**Props:** `{ persona_focus?: 'mei' | 'me' | 'dev' }` (se há card em destaque)

### `comparison_view`
**Disparado:** entrada na página `/comparativo` ou visualização da tabela embed
**Props:** `{ view_type: 'page' | 'home_embed' | 'blog_embed' }`

### `sandbox_open`
**Disparado:** entrada em `/sandbox`
**Props:** `{ entry_point: 'header' | 'hero' | 'pricing' | 'gateway' | 'direct' }`

### `signup_start`
**Disparado:** clique no botão de cadastro (antes do formulário)
**Props:** `{ persona, plan, source_page }`

### `signup_complete`
**Disparado:** sucesso no submit do cadastro
**Props:** `{ persona, plan }`

### `cert_upload_start`
**Disparado:** clique em "Enviar certificado"
**Props:** `{ time_since_signup_minutes: number }`

### `cert_upload_complete`
**Disparado:** sucesso no upload do A1
**Props:** `{ time_since_signup_minutes: number }`

### `first_nfse_created`
**Disparado:** servidor confirma POST /v1/nfse de primeira vez
**Props:** `{ persona, time_since_signup_minutes: number }`

### `first_nfse_authorized`
**Disparado:** webhook da Receita confirma autorização da 1ª nota
**Props:** `{ persona, time_since_signup_minutes: number, municipio: string }`

### `topbar_view`
**Disparado:** top bar exibida (uma vez por sessão)

### `topbar_dismiss`
**Disparado:** clique no X da top bar

### `countdown_view`
**Disparado:** componente countdown entra no viewport (Intersection Observer)
**Props:** `{ location: 'hero' | 'pilar' | 'me_page' }`

### `email_opened` / `email_clicked` / `email_unsubscribed`
**Disparado:** webhook da Brevo confirma evento
**Props:** `{ campaign_key: string, template_id: number }`

---

## Funnels a configurar no painel GA4

### Funnel 1 — Aquisição → Ativação MEI

```
1. page_view (path: /)
2. cta_click (persona=mei OR cta_location=hero_card_mei)
3. page_view (path: /mei)
4. signup_start (persona=mei)
5. signup_complete (persona=mei)
6. cert_upload_complete
7. first_nfse_authorized (persona=mei)
```

### Funnel 2 — Aquisição → Ativação ME/EPP

```
1. page_view (path: /)
2. cta_click (persona=me OR cta_location=hero_card_me OR pricing_card_me)
3. page_view (path: /me)
4. signup_start (persona=me)
5. signup_complete (persona=me)
6. cert_upload_complete
7. first_nfse_authorized (persona=me)
```

### Funnel 3 — Aquisição → Ativação Dev (PLG via sandbox)

```
1. page_view (path: /)
2. cta_click (cta_location=sandbox_hero OR pricing_card_dev OR hero_card_dev)
3. sandbox_open
4. signup_start (persona=dev)
5. signup_complete (persona=dev)
6. first_nfse_created (persona=dev)
```

### Funnel 4 — Comparativo → Conversão

```
1. page_view (path: /comparativo)
2. comparison_view
3. cta_click (cta_location IN [comparativo_*])
4. signup_complete
```

---

## Eventos da régua de urgência ME/EPP (HIST-6.3)

Para cada envio, adicionar UTMs únicos no link de CTA:

```
utm_source=brevo
utm_medium=email
utm_campaign=urgency_me_2026
utm_content=t60   (ou t30, t15, t7, t3, t1)
```

Eventos esperados (vindos do webhook Brevo):
- `email_sent` — disparado no envio
- `email_opened`
- `email_clicked`
- `email_unsubscribed`

Custom dimension associado: `email_step = 't60' | 't30' | 't15' | 't7' | 't3' | 't1'`

---

## Eventos da régua de onboarding (HIST-6.2)

UTMs para os links nos e-mails:

```
utm_source=brevo
utm_medium=email
utm_campaign=onboarding
utm_content=welcome   (ou cert_reminder, first_note_tutorial, first_auth_congrats)
```

---

## Dashboard Looker Studio (HIST-7.3) — métricas por aba

### Aba 1 — Resumo executivo (28 dias com comparação)
- Sessões (total e por persona)
- Usuários únicos
- Taxa de cadastro (signup_complete / sessions)
- Tempo médio até primeira nota autorizada
- Conversão sandbox → signup (devs)

### Aba 2 — Funnel por persona
- Sankey chart com as 7 etapas dos funnels 1, 2 e 3
- Taxa de drop-off por etapa
- Filtros: período, source, medium

### Aba 3 — Top sources
- Sessões por `utm_source` / `medium` / `campaign`
- Taxa de conversão por canal
- Custo (placeholder para quando rodar mídia paga em P2)

### Aba 4 — CTAs (granular)
- Eventos `cta_click` agrupados por `cta_location`
- Heatmap: CTA × persona
- Top 10 CTAs por volume e por taxa de conversão downstream

### Aba 5 — E-mail (após HIST-6.2/6.3 rodando)
- Open rate, CTR, bounce rate por campanha
- Comparação onboarding vs urgência
- Curva de conversão T-60 → T-1

---

## Convenções de eventos

- **Naming:** `snake_case`, verbos no passado (`signup_complete`, não `complete_signup`)
- **Props:** `snake_case`, primitivos (string, number, boolean) — sem objetos aninhados
- **PII:** **nunca** enviar e-mail, nome, CNPJ, ou qualquer dado pessoal como prop de evento
- **Cardinality:** evitar props com muitos valores únicos (não logar `municipio` em todos os eventos, por exemplo)
- **Versionamento:** se precisar mudar significado de um evento, criar `nome_v2` em vez de quebrar histórico

---

## Validação contínua

Toda nova feature/PR que adicionar evento deve:

1. **Atualizar este documento** com a definição do evento
2. **Validar em DebugView** antes do merge
3. **Confirmar custom dimensions** estão no painel GA4
4. **Notificar marketing** se for evento novo de funnel (precisa atualização do dashboard)
