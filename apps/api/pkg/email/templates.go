package email

import "fmt"

// --- shared layout helpers ---

func htmlOpen() string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#0A0F1E;font-family:Inter,Arial,sans-serif;color:#EEF4FF;}
  .wrap{max-width:600px;margin:40px auto;background:#142035;border-radius:12px;overflow:hidden;}
  .header{background:#0A0F1E;padding:32px 40px 24px;border-bottom:1px solid #1E3050;}
  .header h1{margin:0;font-size:22px;font-weight:800;color:#00E8FF;font-family:Outfit,Arial,sans-serif;}
  .body{padding:32px 40px;}
  .label{font-size:12px;color:#8AA0B8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;}
  .value{font-size:16px;color:#EEF4FF;margin-bottom:20px;}
  .code{font-family:"DM Mono",monospace;background:#0A0F1E;border:1px solid #1E3050;border-radius:6px;padding:12px 16px;font-size:15px;color:#00E8FF;letter-spacing:.05em;word-break:break-all;}
  .btn{display:inline-block;margin-top:8px;padding:12px 28px;background:#00E8FF;color:#0A0F1E;font-weight:700;border-radius:8px;text-decoration:none;font-size:15px;}
  .divider{border:none;border-top:1px solid #1E3050;margin:28px 0;}
  .footer{padding:20px 40px;font-size:12px;color:#8AA0B8;border-top:1px solid #1E3050;}
  .status-ok{color:#00C85A;font-weight:700;}
  .status-err{color:#FF3232;font-weight:700;}
</style>
</head>
<body>
<div class="wrap">`
}

func htmlClose() string {
	return `<div class="footer">Nota MEI Gateway · ScantelburyDevs · Seu código. Nossa precisão.</div>
</div></body></html>`
}

// NotaAutorizadaParams holds the data for the nota-autorizada email.
type NotaAutorizadaParams struct {
	RazaoSocial   string
	NumeroNFSe    string
	CodigoVerific string
	ValorServico  string
	PdfURL        string
	XmlURL        string
}

// NotaAutorizadaHTML returns the HTML body for a nota-autorizada notification.
func NotaAutorizadaHTML(p NotaAutorizadaParams) string {
	return htmlOpen() + fmt.Sprintf(`
<div class="header"><h1>Nota Fiscal Autorizada ✓</h1></div>
<div class="body">
  <p>Olá, <strong>%s</strong>!</p>
  <p>Sua nota fiscal foi <span class="status-ok">AUTORIZADA</span> pela Receita Federal.</p>
  <hr class="divider"/>
  <div class="label">Número NFS-e</div>
  <div class="value">%s</div>
  <div class="label">Código de Verificação</div>
  <div class="code">%s</div>
  <div class="label" style="margin-top:20px;">Valor do Serviço</div>
  <div class="value">R$ %s</div>
  <hr class="divider"/>
  <p>
    <a class="btn" href="%s">Baixar PDF</a>&nbsp;&nbsp;
    <a class="btn" style="background:#1E3050;color:#00E8FF;" href="%s">Baixar XML</a>
  </p>
</div>
`, p.RazaoSocial, p.NumeroNFSe, p.CodigoVerific, p.ValorServico, p.PdfURL, p.XmlURL) +
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
<div class="header"><h1>Nota Fiscal Rejeitada</h1></div>
<div class="body">
  <p>Olá, <strong>%s</strong>.</p>
  <p>Sua nota fiscal foi <span class="status-err">REJEITADA</span> pela Receita Federal.</p>
  <hr class="divider"/>
  <div class="label">Código de Erro</div>
  <div class="code">%s</div>
  <div class="label" style="margin-top:20px;">Descrição</div>
  <div class="value">%s</div>
  <hr class="divider"/>
  <p>Corrija os dados e emita uma nova nota pelo painel ou pela API.</p>
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
<div class="header"><h1>Bem-vindo ao Nota MEI Gateway!</h1></div>
<div class="body">
  <p>Olá, <strong>%s</strong>!</p>
  <p>Seu cadastro foi realizado com sucesso. Sua API Key está logo abaixo — guarde-a em um local seguro, pois ela <strong>não será exibida novamente</strong>.</p>
  <hr class="divider"/>
  <div class="label">CNPJ</div>
  <div class="value">%s</div>
  <div class="label">Sua API Key</div>
  <div class="code">%s</div>
  <hr class="divider"/>
  <p>Use o header <code style="color:#00E8FF;">Authorization: Bearer &lt;sua-api-key&gt;</code> em todas as requisições.</p>
  <p>Consulte a documentação em <a style="color:#00E8FF;" href="https://api.notameigateway.com.br/docs">api.notameigateway.com.br/docs</a>.</p>
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
<div class="header"><h1>Falha no Pagamento</h1></div>
<div class="body">
  <p>Olá, <strong>%s</strong>.</p>
  <p>Não foi possível processar o pagamento da sua assinatura. Para evitar a interrupção do serviço, atualize seu método de pagamento.</p>
  <hr class="divider"/>
  <div class="label">Plano</div>
  <div class="value">%s</div>
  <div class="label">Valor</div>
  <div class="value">R$ %s</div>
  <hr class="divider"/>
  <p><a class="btn" href="%s">Atualizar Pagamento</a></p>
  <p style="font-size:13px;color:#8AA0B8;margin-top:16px;">O link acima expira em 24 horas. Se precisar de ajuda, entre em contato com nosso suporte.</p>
</div>
`, p.RazaoSocial, p.PlanoNome, p.ValorBRL, p.PortalURL) +
		htmlClose()
}
