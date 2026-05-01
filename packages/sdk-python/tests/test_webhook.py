import hashlib
import hmac
import json
import pytest
from notamei._webhook import verify_signature, parse_webhook
from notamei._errors import NotaMEIError


def _sign(body: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"sha256={digest}"


SECRET = "test-secret"
BODY = json.dumps({"event": "nfse.autorizada", "nota_id": "uuid-123", "status": "AUTORIZADA", "signature": ""})


def test_verify_valid():
    assert verify_signature(BODY, _sign(BODY, SECRET), SECRET) is True


def test_verify_wrong_secret():
    assert verify_signature(BODY, _sign(BODY, "outro"), SECRET) is False


def test_verify_body_tampered():
    assert verify_signature(BODY + " ", _sign(BODY, SECRET), SECRET) is False


def test_verify_no_prefix():
    hex_only = hmac.new(SECRET.encode(), BODY.encode(), hashlib.sha256).hexdigest()
    assert verify_signature(BODY, hex_only, SECRET) is False


def test_verify_bytes_body():
    body_bytes = BODY.encode("utf-8")
    assert verify_signature(body_bytes, _sign(BODY, SECRET), SECRET) is True


def test_parse_webhook_valid():
    raw = json.dumps({
        "event": "nfse.autorizada",
        "nota_id": "abc-123",
        "status": "AUTORIZADA",
        "numero_nfse": "000123",
        "signature": "",
    })
    sig = _sign(raw, SECRET)
    payload = parse_webhook(raw, sig, SECRET)
    assert payload.nota_id == "abc-123"
    assert payload.event == "nfse.autorizada"
    assert payload.numero_nfse == "000123"


def test_parse_webhook_invalid_signature():
    with pytest.raises(NotaMEIError) as exc_info:
        parse_webhook(BODY, "sha256=invalida", SECRET)
    assert exc_info.value.code == "FORBIDDEN"
    assert exc_info.value.status == 403
