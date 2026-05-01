from __future__ import annotations
import hashlib
import hmac

from ._errors import NotaMEIError
from ._models import WebhookPayload


def verify_signature(raw_body: str | bytes, signature: str, secret: str) -> bool:
    """
    Verifica a assinatura HMAC-SHA256 de um payload de webhook.
    Usa comparação em tempo constante para evitar timing attacks.
    """
    if not signature.startswith("sha256="):
        return False

    body_bytes = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    expected = hmac.new(
        secret.encode("utf-8"), body_bytes, hashlib.sha256
    ).hexdigest()
    received = signature[len("sha256="):]

    return hmac.compare_digest(expected, received)


def parse_webhook(raw_body: str | bytes, signature: str, secret: str) -> WebhookPayload:
    """
    Verifica a assinatura e retorna o WebhookPayload parsed.
    Lança NotaMEIError(code='FORBIDDEN') se a assinatura for inválida.
    """
    import json

    if not verify_signature(raw_body, signature, secret):
        raise NotaMEIError("FORBIDDEN", "Assinatura do webhook inválida", 403)

    body_str = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body
    return WebhookPayload.from_api(json.loads(body_str))
