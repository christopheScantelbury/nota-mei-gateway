# Looker Studio Dashboard — 2026-06
> HIST-7.3 do pacote `NotaFacil-Specs-v1`. Setup de dashboard externo.

## Dependências

- HIST-7.1 ✅ (GA4 + Consent)
- HIST-7.2 ✅ (taxonomia de eventos)
- Property GA4 ativa em produção com pelo menos 7 dias de dados

## Estrutura sugerida (5 abas)

### Aba 1 — Resumo executivo (28 dias)
- Sessões (total + por persona via custom dim)
- Usuários únicos
- Taxa de cadastro (signup_complete / sessions)
- Tempo médio até primeira nota autorizada
- Conversão sandbox → signup (devs)

### Aba 2 — Funnel por persona
- Sankey chart com etapas dos funnels 1, 2, 3 do `06-Eventos-Analytics.md`
- Taxa de drop-off por etapa

### Aba 3 — Top sources
- Sessões por `utm_source`/`medium`/`campaign`
- Conversão por canal

### Aba 4 — CTAs granular
- `cta_click` agrupado por `cta_location`
- Heatmap CTA × persona

### Aba 5 — E-mail (após HIST-6.2/6.3)
- Open rate, CTR, bounce por campanha (Brevo Statistics API → BigQuery)

## Compartilhamento

- Acesso: dev lead, product, marketing
- Comentários habilitados

## Ações

- [ ] Criar property GA4 e aguardar 7 dias de dados
- [ ] Conectar GA4 ao Looker Studio
- [ ] Aplicar template das 5 abas
- [ ] Compartilhar com stakeholders
