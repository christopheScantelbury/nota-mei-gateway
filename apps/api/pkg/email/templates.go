package email

import (
	"fmt"
	"html"
	"os"
	"regexp"

	"github.com/google/uuid"
)

// --- shared layout helpers (NotaFácil brand-kit v1.0 — light identity) ---
//
// Paleta: blue-500 #3B82F6 (marca), teal-500 #14B8A6 (persona MEI),
// slate-900 #0F172A (texto), slate-500 #64748B (suave), slate-50 #F8FAFC (fundo).
// Tipografia: DM Sans (com fallback de sistema), DM Mono para código.

func htmlOpen() string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#F8FAFC;font-family:'DM Sans',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#334155;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:600px;margin:32px auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;}
  .header{padding:28px 40px 20px;border-bottom:1px solid #E2E8F0;}
  .wordmark{font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1;}
  .wordmark .b{color:#0F172A;}
  .wordmark .f{color:#3B82F6;}
  .wordmark .s{color:#14B8A6;}
  .tagline{margin-top:6px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#94A3B8;}
  .body{padding:32px 40px;}
  .body h2{margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;letter-spacing:-.01em;}
  .body p{margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155;}
  .label{font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;font-weight:600;}
  .value{font-size:16px;color:#0F172A;margin-bottom:18px;font-weight:500;}
  .code{font-family:'DM Mono','Courier New',monospace;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;font-size:14px;color:#0F172A;letter-spacing:.02em;word-break:break-all;}
  .btn{display:inline-block;margin-top:4px;padding:13px 28px;background:#3B82F6;color:#FFFFFF;font-weight:600;border-radius:8px;text-decoration:none;font-size:15px;}
  .divider{border:none;border-top:1px solid #E2E8F0;margin:24px 0;}
  .footer{padding:20px 40px;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;background:#F8FAFC;}
  .status-ok{color:#16A34A;font-weight:700;}
  .status-err{color:#DC2626;font-weight:700;}
  .hint{font-size:13px;color:#64748B;}
  .pill-ok{display:inline-block;padding:4px 12px;border-radius:9999px;background:#F0FDF4;color:#16A34A;font-weight:700;font-size:13px;}
  .pill-err{display:inline-block;padding:4px 12px;border-radius:9999px;background:#FEF2F2;color:#DC2626;font-weight:700;font-size:13px;}
</style>
</head>
<body>
<div class="wrap">
<div class="header">
  <div class="wordmark"><span class="b">Nota</span><span class="f">Fácil</span> <span class="s">MEI</span></div>
  <div class="tagline">Emissão automatizada de NFS-e</div>
</div>`
}

// supportWhatsApp devolve o WhatsApp do suporte (só dígitos, com DDI).
// SUPPORT_WHATSAPP no ambiente sobrescreve o padrão.
func supportWhatsApp() string {
	n := regexp.MustCompile(`\D`).ReplaceAllString(os.Getenv("SUPPORT_WHATSAPP"), "")
	if n == "" {
		n = "5547997352380"
	}
	return n
}

// htmlClose fecha os e-mails enviados aos NOSSOS clientes, com o canal de
// suporte visível (#258 — cliente achou que "não existe suporte").
func htmlClose() string {
	return fmt.Sprintf(`<div class="footer">
  <p style="margin:0 0 6px;color:#64748B;">Precisa de ajuda? Clique em <strong>Ajuda</strong> no painel ou fale com a gente pelo <a href="https://wa.me/%s" style="color:#3B82F6;">WhatsApp</a>.</p>
  NotaFácil · ScantelburyDevs · Seu código. Nossa precisão.
</div>
</div></body></html>`, supportWhatsApp())
}

// htmlCloseTomador fecha e-mails enviados ao tomador (cliente do nosso
// cliente) — sem o canal de suporte do NotaFácil, que não é para ele.
func htmlCloseTomador() string {
	return `<div class="footer">Nota fiscal emitida com NotaFácil · emitirnotafacil.com.br</div>
</div></body></html>`
}

// FormatBRL formata um valor em reais no padrão brasileiro: 3500 → "3.500,00".
func FormatBRL(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	cents := int64(v*100 + 0.5)
	inteiro, frac := cents/100, cents%100
	digits := fmt.Sprintf("%d", inteiro)
	var out []byte
	for i, d := range []byte(digits) {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, d)
	}
	r := fmt.Sprintf("%s,%02d", out, frac)
	if neg {
		r = "-" + r
	}
	return r
}

// NotaTomadorParams holds the data for the e-mail that delivers the NFS-e to
// the tomador (#274 envio automático e botão "Enviar por e-mail").
type NotaTomadorParams struct {
	TomadorNome   string
	PrestadorNome string
	ChaveAcesso   string
	ValorServico  string
	ConsultaURL   string
	// Referências gravadas na fila (não aparecem no e-mail).
	NotaID    *uuid.UUID
	EmpresaID *uuid.UUID
}

// NotaTomadorHTML returns the HTML body sent to the tomador.
func NotaTomadorHTML(p NotaTomadorParams) string {
	saudacao := "Olá!"
	if p.TomadorNome != "" {
		saudacao = fmt.Sprintf("Olá, <strong>%s</strong>!", html.EscapeString(p.TomadorNome))
	}
	numeroLabel := "Número da NFS-e"
	if len(p.ChaveAcesso) == 50 {
		numeroLabel = "Chave de Acesso"
	}
	var detalhes string
	if p.ChaveAcesso != "" {
		detalhes += fmt.Sprintf(`
  <div class="label">%s</div>
  <div class="code">%s</div>`, numeroLabel, html.EscapeString(p.ChaveAcesso))
	}
	if p.ValorServico != "" {
		detalhes += fmt.Sprintf(`
  <div class="label" style="margin-top:20px;">Valor do Serviço</div>
  <div class="value">R$ %s</div>`, html.EscapeString(p.ValorServico))
	}
	var botao string
	if p.ConsultaURL != "" {
		botao = fmt.Sprintf(`
  <hr class="divider"/>
  <p><a class="btn" href="%s">Ver e baixar a nota fiscal</a></p>
  <p class="hint">O link abre a consulta pública oficial da NFS-e Nacional (gov.br), onde você vê e baixa o PDF (DANFSE) e o XML, sem login.</p>`, html.EscapeString(p.ConsultaURL))
	}
	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Você recebeu uma nota fiscal</h2>
  <p>%s <strong>%s</strong> emitiu uma nota fiscal de serviço (NFS-e) para você.</p>
  <hr class="divider"/>%s%s
</div>
`, saudacao, html.EscapeString(p.PrestadorNome), detalhes, botao) +
		htmlCloseTomador()
}

// NotaAutorizadaParams holds the data for the nota-autorizada email.
type NotaAutorizadaParams struct {
	RazaoSocial   string
	NumeroNFSe    string
	CodigoVerific string
	ValorServico  string
	PdfURL        string
	XMLURL        string
}

// NotaAutorizadaHTML returns the HTML body for a nota-autorizada notification.
func NotaAutorizadaHTML(p NotaAutorizadaParams) string {
	// NFS-e Nacional identifica a nota pela chave de acesso (50 dígitos).
	// Notas no modelo ABRASF possuem código de verificação. Renderiza só o
	// que existir, evitando boxes vazios.
	numeroLabel := "Número da NFS-e"
	if len(p.NumeroNFSe) == 50 {
		numeroLabel = "Chave de Acesso"
	}

	var detalhes string
	if p.NumeroNFSe != "" {
		detalhes += fmt.Sprintf(`
  <div class="label">%s</div>
  <div class="code">%s</div>`, numeroLabel, p.NumeroNFSe)
	}
	if p.CodigoVerific != "" {
		detalhes += fmt.Sprintf(`
  <div class="label" style="margin-top:20px;">Código de Verificação</div>
  <div class="code">%s</div>`, p.CodigoVerific)
	}
	if p.ValorServico != "" {
		detalhes += fmt.Sprintf(`
  <div class="label" style="margin-top:20px;">Valor do Serviço</div>
  <div class="value">R$ %s</div>`, p.ValorServico)
	}

	var botoes string
	if p.PdfURL != "" {
		botoes = fmt.Sprintf(`
  <hr class="divider"/>
  <p><a class="btn" href="%s">Consultar e baixar a NFS-e</a></p>
  <p class="hint">O link acima abre a consulta pública oficial da NFS-e, onde o destinatário pode visualizar e baixar o PDF (DANFSE) e o XML sem necessidade de login.</p>`, p.PdfURL)
	}

	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Nota Fiscal Autorizada</h2>
  <p>Olá, <strong>%s</strong>! Sua nota fiscal foi <span class="pill-ok">AUTORIZADA</span> pela Receita Federal.</p>
  <hr class="divider"/>%s%s
</div>
`, p.RazaoSocial, detalhes, botoes) +
		htmlClose()
}

// NotaRejeitadaParams holds the data for the nota-rejeitada email.
type NotaRejeitadaParams struct {
	RazaoSocial   string
	ErroCodigo    string
	ErroDescricao string
}

// NotaRejeitadaHTML returns the HTML body for a nota-rejeitada notification.
func NotaRejeitadaHTML(p NotaRejeitadaParams) string {
	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Nota Fiscal Rejeitada</h2>
  <p>Olá, <strong>%s</strong>. Sua nota fiscal foi <span class="pill-err">REJEITADA</span> pela Receita Federal.</p>
  <hr class="divider"/>
  <div class="label">Código de Erro</div>
  <div class="code">%s</div>
  <div class="label" style="margin-top:20px;">Descrição</div>
  <div class="value">%s</div>
  <hr class="divider"/>
  <p class="hint">Corrija os dados e emita uma nova nota pelo painel ou pela API.</p>
</div>
`, p.RazaoSocial, p.ErroCodigo, p.ErroDescricao) +
		htmlClose()
}

// BoasVindasParams holds the data for the welcome email.
type BoasVindasParams struct {
	RazaoSocial string
	CNPJ        string
	APIKey      string // full key, shown only once
}

// BoasVindasHTML returns the HTML body for the MEI welcome email.
func BoasVindasHTML(p BoasVindasParams) string {
	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Bem-vindo ao NotaFácil MEI!</h2>
  <p>Olá, <strong>%s</strong>! Seu cadastro foi realizado com sucesso. Sua API Key está logo abaixo — guarde-a em um local seguro, pois ela <strong>não será exibida novamente</strong>.</p>
  <hr class="divider"/>
  <div class="label">CNPJ</div>
  <div class="value">%s</div>
  <div class="label">Sua API Key</div>
  <div class="code">%s</div>
  <hr class="divider"/>
  <p class="hint">Use o header <code style="color:#3B82F6;">Authorization: Bearer &lt;sua-api-key&gt;</code> em todas as requisições.</p>
  <p class="hint">Consulte a documentação em <a style="color:#3B82F6;" href="https://api.emitirnotafacil.com.br/docs">api.emitirnotafacil.com.br/docs</a>.</p>
</div>
`, p.RazaoSocial, p.CNPJ, p.APIKey) +
		htmlClose()
}

// PagamentoFalhouParams holds the data for the payment-failed email.
type PagamentoFalhouParams struct {
	RazaoSocial string
	PlanoNome   string
	ValorBRL    string
	PortalURL   string
}

// PagamentoFalhouHTML returns the HTML body for a payment-failed notification.
func PagamentoFalhouHTML(p PagamentoFalhouParams) string {
	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Falha no Pagamento</h2>
  <p>Olá, <strong>%s</strong>. Não foi possível processar o pagamento da sua assinatura. Para evitar a interrupção do serviço, atualize seu método de pagamento.</p>
  <hr class="divider"/>
  <div class="label">Plano</div>
  <div class="value">%s</div>
  <div class="label">Valor</div>
  <div class="value">R$ %s</div>
  <hr class="divider"/>
  <p><a class="btn" href="%s">Atualizar Pagamento</a></p>
  <p class="hint" style="margin-top:16px;">O link acima expira em 24 horas. Se precisar de ajuda, entre em contato com nosso suporte.</p>
</div>
`, p.RazaoSocial, p.PlanoNome, p.ValorBRL, p.PortalURL) +
		htmlClose()
}

// BoasVindasMEParams holds the data for the ME welcome email.
type BoasVindasMEParams struct {
	RazaoSocial      string
	APIKey           string
	RegimeTributario string // "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL"
}

// BoasVindasMEHTML returns the welcome HTML email for a new ME/EPP empresa.
// Includes ISS recolhimento guidance tailored to the regime tributário.
func BoasVindasMEHTML(p BoasVindasMEParams) string {
	var issBlock string
	switch p.RegimeTributario {
	case "SIMPLES_NACIONAL":
		issBlock = `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px 20px;margin:20px 0;">
  <div style="color:#16A34A;font-weight:700;margin-bottom:6px;">✅ ISS recolhido via DAS (Simples Nacional)</div>
  <p style="margin:0;color:#64748B;font-size:14px;">O ISS já está incluído no seu DAS mensal — não é necessário emitir guia separada. Pague o DAS até o dia 20 de cada mês pelo <strong style="color:#0F172A;">PGDAS-D</strong> no Portal do Simples Nacional.</p>
</div>`
	case "LUCRO_PRESUMIDO":
		issBlock = `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px 20px;margin:20px 0;">
  <div style="color:#D97706;font-weight:700;margin-bottom:6px;">⚠️ ISS recolhido via DAM (Lucro Presumido)</div>
  <p style="margin:0;color:#64748B;font-size:14px;">Você deve emitir uma guia DAM para cada nota fiscal. O vencimento é <strong style="color:#0F172A;">dia 10 do mês seguinte</strong> à emissão. Acesse o sistema de emissão de DAM da prefeitura do seu município para gerar a guia.</p>
</div>`
	default:
		issBlock = `<div style="background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;margin:20px 0;">
  <div style="color:#64748B;font-weight:700;margin-bottom:6px;">ℹ️ Recolhimento de ISS</div>
  <p style="margin:0;color:#64748B;font-size:14px;">Consulte seu contador para verificar a forma de recolhimento do ISS conforme seu regime tributário.</p>
</div>`
	}

	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>🎉 Empresa cadastrada com sucesso</h2>
  <p>Olá, <strong>%s</strong>! Sua empresa foi cadastrada no <strong>NotaFácil MEI</strong>. Você já pode emitir NFS-e pela nossa API.</p>
  <hr class="divider"/>
  <div class="label">Sua API Key (exibida apenas uma vez)</div>
  <div class="code">%s</div>
  <p class="hint" style="color:#DC2626;margin-top:8px;">⚠️ Guarde esta chave em local seguro — ela não será exibida novamente.</p>
  <hr class="divider"/>
  %s
  <hr class="divider"/>
  <p class="hint">Próximos passos: faça upload do seu certificado A1 via <code style="color:#3B82F6;">POST /v1/auth/certificate</code> para habilitar a assinatura digital das notas.</p>
</div>
`, p.RazaoSocial, p.APIKey, issBlock) +
		htmlClose()
}

// RecorrenciaSemCertificadoHTML avisa que uma automação parou por falta do A1.
func RecorrenciaSemCertificadoHTML(razaoSocial, nomeRecorrencia, configURL string) string {
	return htmlOpen() + fmt.Sprintf(`
<div class="body">
  <h2>Sua nota automática está aguardando o certificado</h2>
  <p>Olá, <strong>%s</strong>. A automação <strong>%s</strong> chegou na data de emissão, mas não encontramos um certificado digital A1 válido na sua conta — sem ele a Receita não aceita a nota.</p>
  <p>Assim que você enviar o certificado, a nota é emitida automaticamente em até 1 hora. Nada precisa ser refeito.</p>
  <p><a class="btn" href="%s">Enviar certificado A1</a></p>
  <p class="hint" style="margin-top:16px;">Este aviso é enviado uma única vez por automação.</p>
</div>
`, html.EscapeString(razaoSocial), html.EscapeString(nomeRecorrencia), configURL) +
		htmlClose()
}
