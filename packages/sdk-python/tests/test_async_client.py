import json
import pytest
import httpx
import respx
from notamei.async_client import AsyncNotaMEI
from notamei._errors import NotaMEIError

BASE = "https://api.notameigateway.com.br"

SERVICO = {"codigo_nbs": "01.01.01.10", "discriminacao": "Dev de software", "valor": 3500.0, "aliquota_iss": 2.0}
TOMADOR_PJ = {"cnpj": "12345678000190", "razao_social": "Empresa LTDA"}
EMISSAO_RESP = {"nota_id": "nota-uuid-001", "status": "PROCESSANDO", "mensagem": "Nota enviada para processamento"}
NOTA_DETALHE = {
    "id": "nota-uuid-001", "status": "AUTORIZADA", "competencia": "2026-04",
    "created_at": "2026-04-26T14:00:00Z", "updated_at": "2026-04-26T14:30:00Z",
    "webhook_entregue": False, "webhook_tentativas": 0,
}
LISTA_RESP = {
    "data": [{"id": "nota-uuid-001", "status": "AUTORIZADA", "competencia": "2026-04", "created_at": "2026-04-26T14:00:00Z"}],
    "total": 1, "limit": 20, "offset": 0,
}


@pytest.fixture
def client():
    return AsyncNotaMEI("sk_test_abc", base_url=BASE, max_retries=0)


@respx.mock
async def test_emitir_body_correto(client):
    route = respx.post(f"{BASE}/v1/nfse").mock(return_value=httpx.Response(202, json=EMISSAO_RESP))
    nota = await client.emitir(servico=SERVICO, tomador=TOMADOR_PJ, competencia="2026-04")

    assert nota.id == "nota-uuid-001"
    assert nota.status == "PROCESSANDO"
    body = json.loads(route.calls[0].request.content)
    assert body["tomador"]["tipo"] == "PJ"
    assert body["servico"]["codigo_nbs"] == "01.01.01.10"
    await client.close()


@respx.mock
async def test_emitir_pf_infere_tipo(client):
    respx.post(f"{BASE}/v1/nfse").mock(return_value=httpx.Response(202, json=EMISSAO_RESP))
    await client.emitir(servico=SERVICO, tomador={"cpf": "12345678900", "razao_social": "João"})

    body = json.loads(respx.calls[0].request.content)
    assert body["tomador"]["tipo"] == "PF"
    assert body["tomador"]["documento"] == "12345678900"
    await client.close()


@respx.mock
async def test_consultar(client):
    respx.get(f"{BASE}/v1/nfse/nota-uuid-001").mock(return_value=httpx.Response(200, json=NOTA_DETALHE))
    nota = await client.consultar("nota-uuid-001")

    assert nota.id == "nota-uuid-001"
    assert nota.status == "AUTORIZADA"
    await client.close()


@respx.mock
async def test_listar(client):
    respx.get(f"{BASE}/v1/nfse").mock(return_value=httpx.Response(200, json=LISTA_RESP))
    lista = await client.listar(limit=5)

    assert lista.total == 1
    assert lista.data[0].id == "nota-uuid-001"
    await client.close()


@respx.mock
async def test_cancelar(client):
    respx.delete(f"{BASE}/v1/nfse/nota-uuid-001").mock(
        return_value=httpx.Response(202, json={"nota_id": "nota-uuid-001", "status": "CANCELADA", "mensagem": "ok"})
    )
    result = await client.cancelar("nota-uuid-001")
    assert result["status"] == "CANCELADA"
    await client.close()


@respx.mock
async def test_xml(client):
    xml = '<?xml version="1.0"?><NFS-e/>'
    respx.get(f"{BASE}/v1/nfse/nota-uuid-001/xml").mock(return_value=httpx.Response(200, text=xml))
    assert await client.xml("nota-uuid-001") == xml
    await client.close()


@respx.mock
async def test_erro_401(client):
    respx.get(f"{BASE}/v1/nfse/x").mock(
        return_value=httpx.Response(401, json={"error": "INVALID_API_KEY", "message": "Chave inválida"})
    )
    with pytest.raises(NotaMEIError) as exc_info:
        await client.consultar("x")
    assert exc_info.value.code == "INVALID_API_KEY"
    assert exc_info.value.status == 401
    await client.close()


@respx.mock
async def test_context_manager():
    respx.post(f"{BASE}/v1/nfse").mock(return_value=httpx.Response(202, json=EMISSAO_RESP))
    async with AsyncNotaMEI("sk_test_abc", base_url=BASE, max_retries=0) as c:
        nota = await c.emitir(servico=SERVICO, tomador=TOMADOR_PJ)
    assert nota.id == "nota-uuid-001"


@respx.mock
async def test_billing_usage(client):
    respx.get(f"{BASE}/v1/billing/usage").mock(return_value=httpx.Response(200, json={
        "competencia": "2026-04", "total_emitidas": 5, "limite": 50,
        "excedentes": 0, "plano": "Starter", "stripe_status": "active",
    }))
    usage = await client.billing.usage()
    assert usage.total_emitidas == 5
    assert usage.plano == "Starter"
    await client.close()
