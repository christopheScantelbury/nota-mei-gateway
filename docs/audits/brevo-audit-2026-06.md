# Auditoria Brevo — 2026-06
> HIST-6.0 do pacote `NotaFacil-Specs-v1`.
> Documento a ser preenchido com base no painel Brevo + código atual.

## 1. SDK em uso

- **Cliente HTTP**: `apps/web/lib/brevo/client.ts` (fetch nativo, Brevo API v3)
- **Endpoints usados**:
  - `POST /v3/events` — track event
  - `POST /v3/smtp/email` — envio transacional via template

Não há SDK npm — feito sob medida pra economizar dep e ter controle de retry.

## 2. API Key

- **Onde**: variável de ambiente `BREVO_API_KEY` (formato `xkeysib-...`) no Railway/Vercel
- **Não confundir** com `SMTP_PASS` (chave SMTP `xsmtpsib-...`) usada pra envio direto via SMTP

## 3. Eventos enviados hoje

- `user_signup` — disparado em `/auth/callback` quando `user.created_at < 5min`
- _(roadmap)_ `cert_uploaded`, `first_nfse_created`, `first_nfse_authorized`, `plan_upgraded` — call sites a instrumentar conforme HIST-6.1 spec

## 4. Templates ativos

**A preencher no painel**: IDs em `lib/brevo/templates.ts`:

| Key | Template ID | Status |
|---|---|---|
| `ONBOARDING_WELCOME` | 101 | A criar |
| `ONBOARDING_CERT_REMINDER` | 102 | A criar |
| `ONBOARDING_FIRST_NOTE_TUTORIAL` | 103 | A criar |
| `ONBOARDING_FIRST_AUTH_CONGRATS` | 104 | A criar |
| `URGENCY_ME_T60` ... `T1` | 201-206 | A criar |

Copies prontas em `NotaFacil-Specs-v1/03-Copies-Finais.md` seções "E-mails de onboarding" e "E-mails de urgência ME/EPP".

## 5. Listas/segmentos

- A criar segmento: `porte IN ('ME','EPP') AND subscription_status != 'active' AND unsubscribed_urgency = false`

## 6. Webhooks reversos

Status: pendente. Eventos de open/click vão ser usados pra alimentar `email_dispatch_log`.

## 7. Domínio + DKIM/DMARC

- Domínio `emitirnotafacil.com.br` ✅ autenticado no Brevo (DKIM + DMARC + SPF)
- Sender verificado: `NotaFácil <noreply@emitirnotafacil.com.br>`

## Gaps identificados

- [ ] Criar os 4 templates de onboarding (HIST-6.2)
- [ ] Criar os 6 templates de urgência (HIST-6.3)
- [ ] Configurar webhooks reversos pra alimentar `email_dispatch_log` (HIST-6.4 P2)
- [ ] Adicionar `BREVO_API_KEY` no Vercel (envprod)
- [ ] Validar que `BREVO_EVENTS_API_KEY` aceita track event (alguns planos exigem chave Tracker separada)
