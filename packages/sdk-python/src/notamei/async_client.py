from __future__ import annotations

import asyncio
from typing import Optional

import httpx

from ._errors import NotaMEIError
from ._models import (
    ListaNotas,
    NotaDetalhe,
    NotaResposta,
    NotaResumo,
    Servico,
    Tomador,
    UsageData,
    WebhookPayload,
)
from ._webhook import parse_webhook, verify_signature
from .client import DEFAULT_BASE_URL, _build_emissao_body, _current_competencia


def _raise_for_httpx(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    try:
        data = resp.json()
    except Exception:
        raise NotaMEIError("INTERNAL_ERROR", f"HTTP {resp.status_code}", resp.status_code)
    raise NotaMEIError(
        code=data.get("error", "INTERNAL_ERROR"),
        message=data.get("message", "Erro desconhecido"),
        status=resp.status_code,
        request_id=data.get("request_id"),
        fields=data.get("fields"),
    )


class AsyncBillingClient:
    def __init__(self, client: _RetryingClient) -> None:
        self._client = client

    async def usage(self) -> UsageData:
        resp = await self._client.request("GET", "/v1/billing/usage")
        _raise_for_httpx(resp)
        return UsageData.from_api(resp.json())

    async def portal(self) -> str:
        resp = await self._client.request("GET", "/v1/billing/portal")
        _raise_for_httpx(resp)
        return resp.json()["url"]

    async def checkout(
        self,
        price_id: str,
        *,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> str:
        body: dict = {"price_id": price_id}
        if success_url:
            body["success_url"] = success_url
        if cancel_url:
            body["cancel_url"] = cancel_url
        resp = await self._client.request("POST", "/v1/billing/checkout", json=body)
        _raise_for_httpx(resp)
        return resp.json()["checkout_url"]


class _RetryingClient:
    """httpx.AsyncClient com retry exponencial em erros 5xx."""

    def __init__(self, client: httpx.AsyncClient, max_retries: int) -> None:
        self._client = client
        self._max_retries = max_retries

    async def request(self, method: str, path: str, **kwargs) -> httpx.Response:
        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                await asyncio.sleep(1.0 * (2 ** (attempt - 1)))
            resp = await self._client.request(method, path, **kwargs)
            if resp.status_code >= 500 and attempt < self._max_retries:
                continue
            return resp
        return resp  # último attempt

    async def aclose(self) -> None:
        await self._client.aclose()


class AsyncNotaMEI:
    """
    Cliente assíncrono para a API Nota MEI Gateway.

    Suporta uso como context manager::

        async with AsyncNotaMEI("sk_live_...") as client:
            nota = await client.emitir(...)

    Ou instanciar diretamente e chamar ``await client.close()`` ao final.
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        http = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "notamei-gateway-python/0.1.0",
                "Accept": "application/json",
            },
            timeout=timeout,
            follow_redirects=True,
        )
        self._client = _RetryingClient(http, max_retries)
        self.billing = AsyncBillingClient(self._client)

    async def emitir(
        self,
        *,
        servico: Servico,
        tomador: Tomador,
        competencia: Optional[str] = None,
        webhook_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> NotaResposta:
        headers: dict = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        resp = await self._client.request(
            "POST",
            "/v1/nfse",
            json=_build_emissao_body(servico, tomador, competencia, webhook_url),
            headers=headers,
        )
        _raise_for_httpx(resp)
        return NotaResposta.from_api(resp.json())

    async def consultar(self, nota_id: str) -> NotaDetalhe:
        resp = await self._client.request("GET", f"/v1/nfse/{nota_id}")
        _raise_for_httpx(resp)
        return NotaDetalhe.from_api(resp.json())

    async def listar(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None,
        competencia: Optional[str] = None,
    ) -> ListaNotas:
        params: dict = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        if competencia:
            params["competencia"] = competencia
        resp = await self._client.request("GET", "/v1/nfse", params=params)
        _raise_for_httpx(resp)
        return ListaNotas.from_api(resp.json())

    async def cancelar(self, nota_id: str) -> dict:
        resp = await self._client.request("DELETE", f"/v1/nfse/{nota_id}")
        _raise_for_httpx(resp)
        d = resp.json()
        return {"nota_id": d["nota_id"], "status": d["status"], "mensagem": d["mensagem"]}

    async def pdf(self, nota_id: str) -> bytes:
        resp = await self._client.request("GET", f"/v1/nfse/{nota_id}/pdf")
        _raise_for_httpx(resp)
        return resp.content

    async def xml(self, nota_id: str) -> str:
        resp = await self._client.request("GET", f"/v1/nfse/{nota_id}/xml")
        _raise_for_httpx(resp)
        return resp.text

    def verify_webhook(self, raw_body: str | bytes, signature: str, secret: str) -> bool:
        return verify_signature(raw_body, signature, secret)

    def parse_webhook(
        self, raw_body: str | bytes, signature: str, secret: str
    ) -> WebhookPayload:
        return parse_webhook(raw_body, signature, secret)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncNotaMEI:
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
