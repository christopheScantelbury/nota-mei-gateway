from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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

DEFAULT_BASE_URL = "https://api.notameigateway.com.br"


def _current_competencia() -> str:
    now = datetime.now(tz=timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


def _build_emissao_body(
    servico: Servico,
    tomador: Tomador,
    competencia: Optional[str],
    webhook_url: Optional[str],
) -> dict:
    tipo = tomador.get("tipo") or ("PF" if tomador.get("cpf") else "PJ")
    documento = tomador.get("cpf") if tipo == "PF" else tomador.get("cnpj", "")
    body: dict = {
        "servico": {
            "codigo_nbs": servico["codigo_nbs"],
            "discriminacao": servico["discriminacao"],
            "valor": servico["valor"],
            "aliquota_iss": servico["aliquota_iss"],
        },
        "tomador": {
            "tipo": tipo,
            "documento": documento,
            "razao_social": tomador["razao_social"],
            **({"email": tomador["email"]} if "email" in tomador else {}),
            **({
                "municipio_ibge": tomador["municipio_ibge"]
            } if "municipio_ibge" in tomador else {}),
        },
        "competencia": competencia or _current_competencia(),
    }
    if webhook_url:
        body["webhook_url"] = webhook_url
    return body


def _raise_for_response(resp: requests.Response) -> None:
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


class BillingClient:
    def __init__(self, session: requests.Session, base_url: str, timeout: float) -> None:
        self._session = session
        self._base_url = base_url
        self._timeout = timeout

    def usage(self) -> UsageData:
        resp = self._session.get(f"{self._base_url}/v1/billing/usage", timeout=self._timeout)
        _raise_for_response(resp)
        return UsageData.from_api(resp.json())

    def portal(self) -> str:
        resp = self._session.get(f"{self._base_url}/v1/billing/portal", timeout=self._timeout)
        _raise_for_response(resp)
        return resp.json()["url"]

    def checkout(
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
        resp = self._session.post(
            f"{self._base_url}/v1/billing/checkout", json=body, timeout=self._timeout
        )
        _raise_for_response(resp)
        return resp.json()["checkout_url"]


class NotaMEI:
    """
    Cliente síncrono para a API Nota MEI Gateway.

    Exemplo::

        from notamei import NotaMEI

        client = NotaMEI("sk_live_...")
        nota = client.emitir(
            servico={"codigo_nbs": "01.01.01.10", "discriminacao": "Dev de software",
                     "valor": 3500.00, "aliquota_iss": 2.0},
            tomador={"cnpj": "12345678000190", "razao_social": "Empresa LTDA"},
        )
        print(nota.id, nota.status)
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
        self._timeout = timeout

        retry = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET", "POST", "DELETE"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self._session = requests.Session()
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)
        self._session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "notamei-gateway-python/0.1.0",
            "Accept": "application/json",
        })
        self.billing = BillingClient(self._session, self._base_url, self._timeout)

    def emitir(
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
        resp = self._session.post(
            f"{self._base_url}/v1/nfse",
            json=_build_emissao_body(servico, tomador, competencia, webhook_url),
            headers=headers,
            timeout=self._timeout,
        )
        _raise_for_response(resp)
        return NotaResposta.from_api(resp.json())

    def consultar(self, nota_id: str) -> NotaDetalhe:
        resp = self._session.get(
            f"{self._base_url}/v1/nfse/{nota_id}", timeout=self._timeout
        )
        _raise_for_response(resp)
        return NotaDetalhe.from_api(resp.json())

    def listar(
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
        resp = self._session.get(
            f"{self._base_url}/v1/nfse", params=params, timeout=self._timeout
        )
        _raise_for_response(resp)
        return ListaNotas.from_api(resp.json())

    def cancelar(self, nota_id: str) -> dict:
        resp = self._session.delete(
            f"{self._base_url}/v1/nfse/{nota_id}", timeout=self._timeout
        )
        _raise_for_response(resp)
        d = resp.json()
        return {"nota_id": d["nota_id"], "status": d["status"], "mensagem": d["mensagem"]}

    def pdf(self, nota_id: str) -> bytes:
        resp = self._session.get(
            f"{self._base_url}/v1/nfse/{nota_id}/pdf", timeout=self._timeout
        )
        _raise_for_response(resp)
        return resp.content

    def xml(self, nota_id: str) -> str:
        resp = self._session.get(
            f"{self._base_url}/v1/nfse/{nota_id}/xml", timeout=self._timeout
        )
        _raise_for_response(resp)
        return resp.text

    def verify_webhook(self, raw_body: str | bytes, signature: str, secret: str) -> bool:
        return verify_signature(raw_body, signature, secret)

    def parse_webhook(self, raw_body: str | bytes, signature: str, secret: str) -> WebhookPayload:
        return parse_webhook(raw_body, signature, secret)
