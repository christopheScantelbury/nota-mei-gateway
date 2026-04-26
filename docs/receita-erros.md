# Mapeamento de Erros — Receita Federal NFS-e Nacional

| Código | Descrição | Ação recomendada |
|---|---|---|
| E001 | CNPJ inválido | Validar CNPJ antes do envio |
| E002 | Certificado inválido ou expirado | Renovar certificado A1 via `/v1/auth/certificate` |
| E003 | Alíquota ISS inválida para o município | Consultar tabela de alíquotas do município |
| E004 | Código NBS inválido | Verificar código NBS em `nbs_catalog` |
| E010 | RPS duplicado | Usar `idempotency_key` único por nota |
| E020 | MEI não habilitado para emissão | Verificar situação cadastral na Receita |
| E050 | Serviço temporariamente indisponível | Retry com backoff exponencial |
| E099 | Erro genérico Receita | Logar `xml_retorno` e abrir ticket |

## Status do ciclo de vida da nota

```
PROCESSANDO → AUTORIZADA   (sucesso)
PROCESSANDO → REJEITADA    (erro permanente da Receita)
PROCESSANDO → ERRO_TEMPORARIO → retry → PROCESSANDO
AUTORIZADA  → CANCELADA    (via DELETE /v1/nfse/:id)
```
