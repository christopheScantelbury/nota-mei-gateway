/**
 * Tipos compartilhados entre rotas e UI. Vive em /lib porque Next.js 14 não
 * permite exports custom (incluindo `export interface`) em arquivos route.ts.
 */
export interface RecorrenciaRow {
  id:                    string
  empresa_id:            string | null
  mei_id:                string | null
  nome:                  string
  ativo:                 boolean
  dia_vencimento:        number
  proxima_emissao:       string
  ultima_emissao:        string | null
  webhook_url:           string | null
  servico:               Record<string, unknown>
  tomador:               Record<string, unknown>
  enviar_email_tomador:  boolean
  email_tomador:         string | null
  created_at:            string
  updated_at:            string
}
