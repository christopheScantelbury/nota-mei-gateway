from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, Optional, TypedDict


NotaStatus = Literal["PROCESSANDO", "AUTORIZADA", "REJEITADA", "CANCELADA", "ERRO_TEMPORARIO"]
TomadorTipo = Literal["PJ", "PF"]
PlanoNome = Literal["Trial", "Starter", "Basic", "Pro", "Business"]


# ── Input TypedDicts (passados como dicts) ────────────────────────────────────

class Servico(TypedDict):
    codigo_nbs: str
    discriminacao: str
    valor: float
    aliquota_iss: float


class _TomadorRequired(TypedDict):
    razao_social: str


class Tomador(_TomadorRequired, total=False):
    cnpj: str
    cpf: str
    tipo: TomadorTipo
    email: str
    municipio_ibge: str


# ── Response dataclasses ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class NotaResposta:
    id: str
    status: str
    mensagem: str

    @classmethod
    def from_api(cls, d: dict) -> NotaResposta:
        return cls(id=d["nota_id"], status=d["status"], mensagem=d["mensagem"])


@dataclass(frozen=True)
class NotaResumo:
    id: str
    status: str
    competencia: str
    created_at: str
    numero_nfse: Optional[str] = None
    valor_servico: Optional[float] = None
    tomador_nome: Optional[str] = None
    emitida_em: Optional[str] = None

    @classmethod
    def from_api(cls, d: dict) -> NotaResumo:
        return cls(
            id=d["id"],
            status=d["status"],
            competencia=d["competencia"],
            created_at=d["created_at"],
            numero_nfse=d.get("numero_nfse"),
            valor_servico=d.get("valor_servico"),
            tomador_nome=d.get("tomador_nome"),
            emitida_em=d.get("emitida_em"),
        )


@dataclass(frozen=True)
class NotaDetalhe:
    id: str
    status: str
    competencia: str
    created_at: str
    updated_at: str
    webhook_entregue: bool
    webhook_tentativas: int
    numero_nfse: Optional[str] = None
    valor_servico: Optional[float] = None
    tomador_nome: Optional[str] = None
    emitida_em: Optional[str] = None
    protocolo_receita: Optional[str] = None
    codigo_verificacao: Optional[str] = None
    tomador_doc: Optional[str] = None
    erro_codigo: Optional[str] = None
    erro_descricao: Optional[str] = None
    webhook_url: Optional[str] = None
    cancelada_em: Optional[str] = None

    @classmethod
    def from_api(cls, d: dict) -> NotaDetalhe:
        return cls(
            id=d["id"],
            status=d["status"],
            competencia=d["competencia"],
            created_at=d["created_at"],
            updated_at=d["updated_at"],
            webhook_entregue=d.get("webhook_entregue", False),
            webhook_tentativas=d.get("webhook_tentativas", 0),
            numero_nfse=d.get("numero_nfse"),
            valor_servico=d.get("valor_servico"),
            tomador_nome=d.get("tomador_nome"),
            emitida_em=d.get("emitida_em"),
            protocolo_receita=d.get("protocolo_receita"),
            codigo_verificacao=d.get("codigo_verificacao"),
            tomador_doc=d.get("tomador_doc"),
            erro_codigo=d.get("erro_codigo"),
            erro_descricao=d.get("erro_descricao"),
            webhook_url=d.get("webhook_url"),
            cancelada_em=d.get("cancelada_em"),
        )


@dataclass(frozen=True)
class ListaNotas:
    data: list[NotaResumo]
    total: int
    limit: int
    offset: int

    @classmethod
    def from_api(cls, d: dict) -> ListaNotas:
        return cls(
            data=[NotaResumo.from_api(n) for n in d["data"]],
            total=d["total"],
            limit=d["limit"],
            offset=d["offset"],
        )


@dataclass(frozen=True)
class UsageData:
    competencia: str
    total_emitidas: int
    limite: int
    excedentes: int
    plano: str
    stripe_status: str
    renovacao_em: Optional[str] = None

    @classmethod
    def from_api(cls, d: dict) -> UsageData:
        return cls(
            competencia=d["competencia"],
            total_emitidas=d["total_emitidas"],
            limite=d["limite"],
            excedentes=d["excedentes"],
            plano=d["plano"],
            stripe_status=d["stripe_status"],
            renovacao_em=d.get("renovacao_em"),
        )


@dataclass(frozen=True)
class WebhookPayload:
    event: str
    nota_id: str
    status: str
    signature: str
    numero_nfse: Optional[str] = None
    codigo_verificacao: Optional[str] = None
    pdf_url: Optional[str] = None
    xml_url: Optional[str] = None
    emitida_em: Optional[str] = None
    erro_codigo: Optional[str] = None
    erro_descricao: Optional[str] = None

    @classmethod
    def from_api(cls, d: dict) -> WebhookPayload:
        return cls(
            event=d["event"],
            nota_id=d["nota_id"],
            status=d["status"],
            signature=d["signature"],
            numero_nfse=d.get("numero_nfse"),
            codigo_verificacao=d.get("codigo_verificacao"),
            pdf_url=d.get("pdf_url"),
            xml_url=d.get("xml_url"),
            emitida_em=d.get("emitida_em"),
            erro_codigo=d.get("erro_codigo"),
            erro_descricao=d.get("erro_descricao"),
        )
