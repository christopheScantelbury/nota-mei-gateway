===  Nota MEI Gateway ===
Contributors: scantelburydevs
Tags: nfse, nota fiscal, mei, woocommerce, brasil
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: MIT

Emissão automática de NFS-e para MEI no WooCommerce via Nota MEI Gateway.

== Description ==

Integra o WooCommerce com a API Nota MEI Gateway para emitir automaticamente uma NFS-e
após cada pedido pago ou concluído.

**Funcionalidades:**

* Emissão automática ao confirmar pagamento ou concluir pedido
* Meta box na tela do pedido com status da NFS-e (PROCESSANDO, AUTORIZADA, REJEITADA, CANCELADA)
* Ações manuais no pedido: re-emitir, atualizar status
* Endpoint de webhook para receber callbacks da API em tempo real
* Validação HMAC-SHA256 dos webhooks recebidos
* Suporte a HPOS (Custom Order Tables) do WooCommerce 8+
* Configurações na aba WooCommerce → Nota MEI

**Pré-requisitos:**

* Uma conta ativa no Nota MEI Gateway (https://notameigateway.com.br)
* Campos de checkout com CPF (_billing_cpf) e/ou CNPJ (_billing_cnpj) nos metadados do pedido
  (compatível com plugins como WooCommerce Extra Checkout Fields for Brazil)

== Installation ==

1. Faça o upload da pasta `notamei-gateway` para `/wp-content/plugins/`
2. Ative o plugin em Plugins → Plugins Instalados
3. Acesse WooCommerce → Nota MEI e configure a API Key
4. Configure o webhook no painel Nota MEI Gateway apontando para:
   `https://seu-site.com.br/wp-json/notamei/v1/webhook`

== Frequently Asked Questions ==

= O plugin precisa do CPF ou CNPJ do cliente? =

Sim. O CPF deve estar em `_billing_cpf` e o CNPJ em `_billing_cnpj` nos metadados do pedido.
Use um plugin como "WooCommerce Extra Checkout Fields for Brazil" para coletar esses dados no checkout.

= O que acontece se o cliente não informar CPF/CNPJ? =

Por padrão, o plugin ignora a emissão e registra uma nota no pedido. Você pode alterar isso
em WooCommerce → Nota MEI → Pedido sem CPF/CNPJ.

= Como re-emitir uma NFS-e rejeitada? =

Acesse o pedido no painel, clique em Ações e selecione "[Nota MEI] Emitir / Re-emitir NFS-e".

== Changelog ==

= 1.0.0 =
* Versão inicial.
