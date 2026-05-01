from __future__ import annotations
from typing import Optional


class NotaMEIError(Exception):
    """Exceção base para erros da API Nota MEI Gateway."""

    def __init__(
        self,
        code: str,
        message: str,
        status: int,
        request_id: Optional[str] = None,
        fields: Optional[list[dict]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.request_id = request_id
        self.fields = fields

    def __repr__(self) -> str:
        return f"NotaMEIError(code={self.code!r}, status={self.status}, message={str(self)!r})"
