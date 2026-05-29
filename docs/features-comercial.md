# NotaFácil — Funcionalidades para o Time Comercial
> Documento de referência pra construir narrativa de marketing e materiais de vendas.
> Atualizado: 2026-05-28

---

## 🎯 Quem somos
**NotaFácil** é a única plataforma 100% pronta para **NFS-e Nacional** (obrigatória em set/2026) com três produtos sob a mesma marca, atendendo do MEI ao dev integrador:

- **NotaFácil MEI** → app mobile-first para MEIs emitirem nota em 30s
- **NotaFácil Empresa** → painel para ME/EPP com regime tributário multi
- **NotaFácil API (Gateway)** → REST + SDKs pra devs integrarem em ERPs/marketplaces

---

## 🏆 Marco diferencial
**Primeira NFS-e Nacional emitida e cancelada em produção** com cert ICP-Brasil real (mai/2026). Estamos meses à frente de ~90% dos concorrentes que ainda trabalham só com ABRASF municipal.

---

# Por persona

## 📱 Para MEI (Microempreendedor)

| Feature | Valor pro cliente |
|---|---|
| **Emissão em 30 segundos** pelo celular | Sem instalar nada, abre no browser, sem cadastro complicado |
| **Sem alíquota, sem retenção, sem cálculo** | "Como MEI você só paga DAS fixo — a gente não te enche com formulário fiscal" |
| **Sugestão de serviço por IA** | Digita "criei um site" → app sugere o código NBS certo |
| **Filtro automático pelos CNAEs do seu CNPJ** | Nunca mais vai escolher serviço errado e tomar rejeição da Receita |
| **Login sem senha** (OTP no e-mail) | "Esqueceu a senha? Não tem senha." |
| **Templates de nota** | Recadastra cliente recorrente em 1 clique |
| **Dashboard com checklist de onboarding** | Onboard guiado: cadastro → certificado → 1ª nota → 1ª autorização |
| **Histórico mensal com breakdown** | "X autorizadas · Y processando · Z rejeitadas" — clareza total |
| **App instalável (PWA)** | Adiciona ao tela início iOS/Android sem passar pela loja |
| **Modo escuro/claro automático** | Acessibilidade WCAG 2.1 AA |

**Ângulo de venda**: *"Você abriu seu MEI pra trabalhar, não pra entender ICMS. A gente cuida da parte chata."*

---

## 🏢 Para ME / EPP (Empresa)

| Feature | Valor pro cliente |
|---|---|
| **Multi-regime tributário** (Simples Nacional, Lucro Presumido, Lucro Real) | UI se adapta automaticamente — só aparece o que faz sentido pro seu regime |
| **Retenção de ISS configurável por nota** | Para LP/LR — controle fino do que vai pra fonte |
| **ISS Lookup com 10+ municípios** | Alíquota correta automática pelo município do tomador |
| **Multi-empresa numa conta só** | Contador/sócio gerencia várias CNPJs sem trocar de login |
| **CRM de clientes integrado** | Cadastra cliente uma vez, reusa em todas as notas |
| **Auto-preenchimento via CNPJ + CEP** | Digita o CNPJ → puxa razão social, e-mail, endereço da Receita |
| **Substituição de nota via evento e105102** | Errou? Substitui com 2 cliques, vincula original + nova |
| **Cancelamento via evento e101101** | Padrão NFS-e Nacional oficial |
| **Auditoria de CNAE** | Detecta serviços fora do enquadramento antes da Receita rejeitar |
| **Recorrências (assinaturas)** | Cobra mensalidade do cliente, emite nota automática todo mês |
| **Templates de serviço reutilizáveis** | Padroniza a discriminação pra evitar rejeição por DPS mal formada |
| **Trial ilimitado pra ME** durante onboarding | Sem cartão pra testar, sem pegadinha |

**Ângulo de venda**: *"NFS-e Nacional vira obrigatória em setembro de 2026. Migra agora, sem dor de cabeça, e ainda ganha CRM, recorrências e multi-empresa."*

---

## 🔌 Para Devs / Integradores (Gateway API)

| Feature | Valor pro cliente |
|---|---|
| **API REST documentada (OpenAPI 3)** | Spec navegável + Swagger UI |
| **SDKs oficiais**: Node.js / TS, Python, WooCommerce, Zapier, Google Sheets | Integra em horas, não em semanas |
| **Sandbox público sem cadastro** | Testa a API no browser em 30s — `https://emitirnotafacil.com.br/sandbox` |
| **API keys sk_live_ / sk_test_** | Padrão Stripe — devs já conhecem |
| **Webhooks com HMAC SHA-256** | Eventos em tempo real (autorizada, rejeitada, cancelada) |
| **Idempotência nativa** (`Idempotency-Key`) | Sem nota duplicada por retry |
| **Rate limit por API key** | Justo, transparente |
| **Status page público** | `/status` — uptime, latência, incidents |
| **Documentação para SEO** | Quickstart, Referência, Erros, Changelog |
| **Métricas Prometheus** | Pro time DevOps do cliente integrar no Grafana |
| **Suporte mTLS A1 com cadeia completa ICP-Brasil** | Compliance fiscal sem hack |

**Ângulo de venda**: *"Stripe-like API pra emissão fiscal. Seu ERP ganha NFS-e Nacional em 1 dia de dev — sem se enrolar com SOAP, XSD, ABRASF municipal."*

---

# Diferenciais técnicos (pra material institucional)

## 🛡️ Segurança e compliance
- **Certificados A1 nunca em disco** — AWS Secrets Manager + KMS
- **Row-Level Security** em toda tabela Supabase (PostgreSQL)
- **mTLS** com renegociação correta pra IIS da Receita (pegadinha que derruba a maioria)
- **Cofre fiscal de 5 anos** (S3 com lifecycle automático) — exigência fiscal cumprida
- **API keys hash SHA-256** — chave real nunca persiste no banco
- **Stripe Webhook signature validation** — sem replay attack

## ⚡ Infraestrutura
- **API Go (Fiber v2)** — baixo footprint, alta concorrência
- **Postgres Supabase** com pool otimizado
- **RabbitMQ** pra webhooks assíncronos com retry exponencial
- **Redis** pra rate limit + BillingGuard + cache NBS
- **Horizontal scaling pronto** (RPS atômico via locks Redis)
- **Health checks + métricas Prometheus** out-of-the-box
- **CI/CD GitHub Actions** com testes unitários Go + linter

## 📈 Performance
- **Emissão síncrona em ~2-3s** (DPS direto à Receita)
- **NBS picker com busca por nome** (trigram + ILIKE no Postgres)
- **Filtro CNAE com lazy-load via BrasilAPI** (cache no banco)
- **Resposta da BrasilAPI** com timeout 5s + falha silenciosa

## 🎨 UX
- **Light/Dark theme** com next-themes
- **Tipografia Outfit + DM Sans + DM Mono** (sistema de design v2.0)
- **Mobile-first** — testado em iPhone 14 Pro Max 430px
- **Barra de progresso global** em navegações (feedback instantâneo)
- **Auto-fill** via BrasilAPI (CNPJ) + ViaCEP (CEP)
- **Modais Radix** com header sticky + footer sticky
- **Service Worker** com network-first em JS/CSS pra deploys sem cache stale

---

# Posicionamento competitivo

## Onde batemos a concorrência

| Diferencial | Nós | Concorrência típica |
|---|---|---|
| **NFS-e Nacional v1.01** em produção | ✅ Funcionando desde mai/2026 | ❌ Maioria ainda ABRASF municipal |
| **API REST simples** | ✅ JSON puro, Bearer auth | ❌ SOAP + XSD complicados |
| **Sandbox sem cadastro** | ✅ /sandbox público | ❌ Precisa cadastro + e-mail pra acessar |
| **3 personas, 1 plataforma** | ✅ MEI + Empresa + API | ❌ Geralmente só MEI ou só API |
| **Trial ilimitado pra ME** | ✅ Sem cartão | ❌ Free só 5/10 notas |
| **SDKs prontos** (Node, Py, Woo, Zapier, Sheets) | ✅ | ❌ Geralmente só Java/.NET |
| **Mobile-first PWA** | ✅ Instala no celular | ❌ Apps "responsivos" quebrados |
| **gov.br via Cert em Nuvem** (roadmap) | 🔄 Em discussão | ❌ Não consideram |
| **Multi-empresa** | ✅ | ❌ 1 CNPJ por conta |

---

# Datas críticas pro marketing

- **Setembro/2026** — NFS-e Nacional obrigatória pra municípios sem solução própria. **Pico de demanda**.
- **Janeiro/2027** — Convergência total pro padrão nacional (ABRASF municipal aposentado).
- **Renovação anual de A1** — todo cliente precisa renovar todo ano. **Janela de upsell de cert em nuvem**.

---

# Sugestões de mensagens-chave

## Headline para landing (já em uso)
> "Emita NFS-e Nacional em segundos. Sem complicação."

## Para campanha MEI
> "Em setembro/2026, a NFS-e fica obrigatória. Em 30 segundos, você já está emitindo."

## Para campanha ME/EPP
> "Sua empresa vai precisar migrar. Faça antes da multidão."

## Para campanha Dev
> "A primeira API REST pronta pra NFS-e Nacional. Stripe-like, com sandbox e SDKs."

## Para vídeo de demo
> "Cadastro → A1 → 1ª nota → autorização da Receita: tudo em menos de 2 minutos."

---

# Materiais sugeridos
1. **One-pager por persona** (MEI, ME/EPP, Gateway) — PDF de 1 página com top features
2. **Calculadora de ROI** pra Devs — "Quanto custa integrar NFS-e do zero vs. NotaFácil API?"
3. **Webinar 30min** — "NFS-e Nacional 2026: o que muda e como se preparar"
4. **Blog post técnico** — "Por que abandonamos SOAP/ABRASF municipal e adotamos NFS-e Nacional desde o dia 1"
5. **Comparativo público** — tabela vs. principais concorrentes (NFE.io, Notas, Plug Notas, etc.)

---

**Repositório**: github.com/christopheScantelbury/nota-mei-gateway
**Stack pública**: Next.js 14 + Go 1.23 + Supabase + Railway + Vercel + Stripe
