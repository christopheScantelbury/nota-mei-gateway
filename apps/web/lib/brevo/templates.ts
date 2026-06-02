// IDs dos templates Brevo criados no painel.
//
// Spec: HIST-6.2.
// Substituir os valores quando os templates forem criados no Brevo.
// Códigos no `03-Copies-Finais.md` seções "E-mails de onboarding" e "E-mails
// de urgência ME/EPP".

export const BREVO_TEMPLATES = {
  // Onboarding (HIST-6.2)
  ONBOARDING_WELCOME:               101,  // D+0 — Boas-vindas
  ONBOARDING_CERT_REMINDER:         102,  // D+1 condicional — sem cert
  ONBOARDING_FIRST_NOTE_TUTORIAL:   103,  // D+3 condicional — cert ok, sem nota
  ONBOARDING_FIRST_AUTH_CONGRATS:   104,  // Evento — primeira autorização

  // Urgência ME/EPP T-60 → T-1 (HIST-6.3)
  URGENCY_ME_T60: 201,
  URGENCY_ME_T30: 202,
  URGENCY_ME_T15: 203,
  URGENCY_ME_T7:  204,
  URGENCY_ME_T3:  205,
  URGENCY_ME_T1:  206,
} as const

export type BrevoTemplateKey = keyof typeof BREVO_TEMPLATES
