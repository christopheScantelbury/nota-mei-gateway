import json
import pytest
import responses as resp_mock
from notamei.client import NotaMEI
from notamei._errors import NotaMEIError

BASE = "https://api.notameigateway.com.br"

SERVICO = {"codigo_nbs": "01.01.01.10", "discriminacao": "Dev de software", "valor": 3500.0, "aliquota_iss": 2.0}
TOMADOR_PJ = {"cnpj": "12345678000190", "razao_social": "Empresa LTDA"}
TOMADOR_PF = {"cpf": "12345678900", "razao_social": "João Silva"}

EMISSAO_RESP = {"nota_id": "nota-uuid-001", "status": "PROCESSANDO", "mensagem": "Nota enviada para processamento"}

NOTA_DETALHE = {
    "id": "nota-uuid-001", "status": "AUTORIZADA", "competencia": "2026-04",
    "created_at": "2026-04-26T14:00:00Z", "updated_at": "2026-04-26T14:30:00Z",
    "numero_nfse": "000123", "valor_servico": 3500.0, "tomador_nome": "Empresa LTDA",
    "emitida_em": "2026-04-26T14:30:00Z", "protocolo_receita": "20260401123",
    "codigo_verificacao": "ABC12345", "tomador_doc": "12345678000190",
    "webhook_entregue": True, "webhook_tentativas": 1,
}

LISTA_RESP = {
    "data": [{"id": "nota-uuid-001", "status": "AUTORIZADA", "competencia": "2026-04", "created_at": "2026-04-26T14:00:00Z"}],
    "total": 1, "limit": 20, "offset": 0,
}


@pytest.fixture
def client():
    return NotaMEI("sk_test_abc", base_url=BASE, max_retries=0)


class TestEmitir:
    @resp_mock.activate
    def test_pj_body_correto(self, client):
        resp_mock.add(resp_mock.POST, f"{BASE}/v1/nfse", json=EMISSAO_RESP, status=202)
        nota = client.emitir(servico=SERVICO, tomador=TOMADOR_PJ, competencia="2026-04")

        assert nota.id == "nota-uuid-001"
        assert nota.status == "PROCESSANDO"
        body = json.loads(resp_mock.calls[0].request.body)
        assert body["tomador"]["tipo"] == "PJ"
        assert body["tomador"]["documento"] == "12345678000190"
        assert body["servico"]["codigo_nbs"] == "01.01.01.10"

    @resp_mock.activate
    def test_pf_infere_tipo(self, client):
        resp_mock.add(resp_mock.POST, f"{BASE}/v1/nfse", json=EMISSAO_RESP, status=202)
        client.emitir(servico=SERVICO, tomador=TOMADOR_PF)

        body = json.loads(resp_mock.calls[0].request.body)
        assert body["tomador"]["tipo"] == "PF"
        assert body["tomador"]["documento"] == "12345678900"

    @resp_mock.activate
    def test_idempotency_key_header(self, client):
        resp_mock.add(resp_mock.POST, f"{BASE}/v1/nfse", json=EMISSAO_RESP, status=202)
        client.emitir(servico=SERVICO, tomador=TOMADOR_PJ, idempotency_key="pedido-999")

        assert resp_mock.calls[0].request.headers.get("Idempotency-Key") == "pedido-999"

    @resp_mock.activate
    def test_competencia_padrao(self, client):
        resp_mock.add(resp_mock.POST, f"{BASE}/v1/nfse", json=EMISSAO_RESP, status=202)
        client.emitir(servico=SERVICO, tomador=TOMADOR_PJ)

        body = json.loads(resp_mock.calls[0].request.body)
        import re
        assert re.match(r"^\d{4}-\d{2}$", body["competencia"])


class TestConsultar:
    @resp_mock.activate
    def test_retorna_nota_detalhe(self, client):
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/nfse/nota-uuid-001", json=NOTA_DETALHE)
        nota = client.consultar("nota-uuid-001")

        assert nota.id == "nota-uuid-001"
        assert nota.status == "AUTORIZADA"
        assert nota.numero_nfse == "000123"
        assert nota.protocolo_receita == "20260401123"
        assert nota.webhook_entregue is True
        assert nota.updated_at == "2026-04-26T14:30:00Z"
        assert nota.erro_codigo is None


class TestListar:
    @resp_mock.activate
    def test_sem_filtros(self, client):
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/nfse", json=LISTA_RESP)
        lista = client.listar()

        assert lista.total == 1
        assert len(lista.data) == 1
        assert lista.data[0].id == "nota-uuid-001"

    @resp_mock.activate
    def test_com_filtros_query_string(self, client):
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/nfse", json={**LISTA_RESP, "limit": 5, "offset": 10})
        lista = client.listar(limit=5, offset=10, status="AUTORIZADA", competencia="2026-04")

        url = resp_mock.calls[0].request.url
        assert "limit=5" in url
        assert "offset=10" in url
        assert "status=AUTORIZADA" in url
        assert "competencia=2026-04" in url


class TestCancelar:
    @resp_mock.activate
    def test_retorna_resultado(self, client):
        resp_mock.add(
            resp_mock.DELETE, f"{BASE}/v1/nfse/nota-uuid-001",
            json={"nota_id": "nota-uuid-001", "status": "CANCELADA", "mensagem": "Cancelada"},
            status=202,
        )
        result = client.cancelar("nota-uuid-001")
        assert result["nota_id"] == "nota-uuid-001"
        assert result["status"] == "CANCELADA"


class TestXml:
    @resp_mock.activate
    def test_retorna_string_xml(self, client):
        xml_content = '<?xml version="1.0"?><NFS-e><Numero>123</Numero></NFS-e>'
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/nfse/nota-uuid-001/xml", body=xml_content, content_type="application/xml")
        assert client.xml("nota-uuid-001") == xml_content


class TestErros:
    @resp_mock.activate
    def test_401_lanca_notamei_error(self, client):
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/nfse/x", json={"error": "INVALID_API_KEY", "message": "Chave inválida"}, status=401)
        with pytest.raises(NotaMEIError) as exc_info:
            client.consultar("x")
        assert exc_info.value.code == "INVALID_API_KEY"
        assert exc_info.value.status == 401

    @resp_mock.activate
    def test_422_com_fields(self, client):
        resp_mock.add(
            resp_mock.POST, f"{BASE}/v1/nfse",
            json={"error": "VALIDATION_ERROR", "message": "inválido", "fields": [{"field": "servico.valor", "message": "deve ser positivo"}]},
            status=422,
        )
        with pytest.raises(NotaMEIError) as exc_info:
            client.emitir(servico=SERVICO, tomador=TOMADOR_PJ)
        err = exc_info.value
        assert err.code == "VALIDATION_ERROR"
        assert err.fields[0]["field"] == "servico.valor"


class TestBilling:
    @resp_mock.activate
    def test_usage(self, client):
        resp_mock.add(
            resp_mock.GET, f"{BASE}/v1/billing/usage",
            json={"competencia": "2026-04", "total_emitidas": 10, "limite": 50,
                  "excedentes": 0, "plano": "Starter", "stripe_status": "active",
                  "renovacao_em": "2026-05-01T00:00:00Z"},
        )
        usage = client.billing.usage()
        assert usage.total_emitidas == 10
        assert usage.plano == "Starter"
        assert usage.renovacao_em == "2026-05-01T00:00:00Z"

    @resp_mock.activate
    def test_portal(self, client):
        resp_mock.add(resp_mock.GET, f"{BASE}/v1/billing/portal", json={"url": "https://billing.stripe.com/xxx"})
        assert client.billing.portal() == "https://billing.stripe.com/xxx"

    @resp_mock.activate
    def test_checkout(self, client):
        resp_mock.add(resp_mock.POST, f"{BASE}/v1/billing/checkout", json={"checkout_url": "https://checkout.stripe.com/xxx"})
        url = client.billing.checkout("price_starter", success_url="https://app.com/ok")
        assert url == "https://checkout.stripe.com/xxx"
        body = json.loads(resp_mock.calls[0].request.body)
        assert body["price_id"] == "price_starter"
        assert body["success_url"] == "https://app.com/ok"
