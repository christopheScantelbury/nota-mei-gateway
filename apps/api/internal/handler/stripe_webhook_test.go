package handler

import (
	"encoding/json"
	"testing"

	stripelib "github.com/stripe/stripe-go/v81"
)

func TestParseInvoiceEvent(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		wantSub string
		wantAmt int64
	}{
		{
			// Formato da conta (2026-03-25.dahlia): sem "subscription" no topo.
			name: "dahlia parent.subscription_details",
			raw: `{"id":"in_1","amount_due":5999,"parent":{"quote_details":null,` +
				`"subscription_details":{"metadata":{"empresa_id":"x"},"subscription":"sub_dahlia"},` +
				`"type":"subscription_details"}}`,
			wantSub: "sub_dahlia", wantAmt: 5999,
		},
		{name: "acacia string", raw: `{"id":"in_2","subscription":"sub_acacia","amount_due":100}`, wantSub: "sub_acacia", wantAmt: 100},
		{name: "acacia expandido", raw: `{"id":"in_3","subscription":{"id":"sub_exp","object":"subscription"}}`, wantSub: "sub_exp"},
		{name: "avulsa sem assinatura", raw: `{"id":"in_4","subscription":null,"parent":null}`, wantSub: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseInvoiceEvent([]byte(tc.raw))
			if err != nil {
				t.Fatalf("parseInvoiceEvent: %v", err)
			}
			if got.SubscriptionID != tc.wantSub || got.AmountDue != tc.wantAmt {
				t.Errorf("got %+v, want sub=%q amount=%d", got, tc.wantSub, tc.wantAmt)
			}
		})
	}
}

// Os handlers de subscription/checkout continuam usando os tipos do stripe-go
// v81 (acacia). Garante que um payload dahlia — com os campos que mudaram de
// lugar — ainda desserializa e expõe o que lemos.
func TestDahliaPayloadsDecodeIntoV81Types(t *testing.T) {
	subRaw := `{"id":"sub_1","object":"subscription","status":"active","customer":"cus_1",
		"discounts":[],"billing_mode":{"type":"classic"},"invoice_settings":{"issuer":{"type":"self"}},
		"items":{"object":"list","data":[{"id":"si_1","object":"subscription_item",
			"current_period_start":1762201644,"current_period_end":1764793644,
			"price":{"id":"price_1Tf0psQkYQoRUOWmuQnm2z3a","object":"price","unit_amount":5999,
				"recurring":{"interval":"month","interval_count":1,"meter":null,"usage_type":"licensed"}}}]},
		"metadata":{"empresa_id":"0a231bdd-bb5c-48d2-b733-3e509fefe0f8","plano_id":"37894888-10f0-4f8d-ad65-7c5ac31090a3"}}`
	var sub stripelib.Subscription
	if err := json.Unmarshal([]byte(subRaw), &sub); err != nil {
		t.Fatalf("subscription dahlia: %v", err)
	}
	if sub.Status != "active" || sub.Metadata["empresa_id"] == "" || sub.Items.Data[0].Price.ID != "price_1Tf0psQkYQoRUOWmuQnm2z3a" {
		t.Errorf("campos lidos pelo handler não vieram: %+v", sub)
	}

	csRaw := `{"id":"cs_1","object":"checkout.session","customer":"cus_1","status":"complete",
		"payment_status":"paid","subscription":"sub_1","metadata":{"empresa_id":"e1"},
		"permissions":null,"collected_information":{"shipping_details":null},"origin_context":null}`
	var cs stripelib.CheckoutSession
	if err := json.Unmarshal([]byte(csRaw), &cs); err != nil {
		t.Fatalf("checkout dahlia: %v", err)
	}
	if cs.Customer == nil || cs.Customer.ID != "cus_1" || cs.Metadata["empresa_id"] != "e1" {
		t.Errorf("checkout: customer/metadata não vieram: %+v", cs)
	}
}
