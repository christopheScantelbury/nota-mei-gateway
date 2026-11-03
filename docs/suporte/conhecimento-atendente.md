# Base de conhecimento do atendente (IA de suporte)

> ⚠️ **A fonte viva agora é a tabela `support_knowledge`**, editável em
> **/admin/suporte/conhecimento** (entra na próxima resposta da IA, sem deploy).
> As entradas abaixo foram importadas pela migration `20261103000001_suporte.sql`;
> este arquivo fica como histórico.
>
> **Regra:** toda correção, deploy, incidente, mudança de preço/plano ou limitação
> conhecida entra na base do atendente na mesma sessão.
>
> Formato de cada entrada: data · o que mudou · impacto para o cliente · como orientar.
> Não colocar dados pessoais de clientes aqui.

## Como falar com o cliente sobre falhas (procedimento)

- Falha ou rejeição já corrigida → tratar como **instabilidade momentânea, já normalizada**.
  Não dizer "erro nosso", "bug" ou "defeito"; não culpar Receita/Stripe/parceiros; não citar
  códigos internos, commits ou detalhes técnicos. Pedir desculpas e dizer o que fazer agora.
- Nunca prometer reembolso, desconto, crédito ou mudança de plano — só humano.
- (Pedido do Chris em 2026-11-03.)

## Correções recentes

### 2026-11-03 · Rejeição E0166 "regime de apuração dos tributos do SN" (ME/EPP Simples) — CORRIGIDO
- **O que era (interno):** toda nota de ME/EPP optante do Simples era rejeitada com E0166
  porque não enviávamos `regApTribSN`. MEI não era afetado.
- **Corrigido em:** 03/11/2026 às 18h08 (Brasília) — agora vai `regApTribSN=1`
  (federais e ISS pelo Simples).
- **Como orientar:** "instabilidade momentânea, já normalizada" → emitir de novo (painel:
  "Corrigir e emitir novamente"/nova nota; API: nova `Idempotency-Key`). Nada a mudar no cadastro.
- **Escalar:** E0166 depois de 03/11 18h08, ou empresa acima do sublimite / ISS ou federais
  fora do Simples (ainda sem opção no produto).

### 2026-11-03 · Rejeição E0714 "Arquivo enviado com erro na assinatura" — CORRIGIDO
- **O que era:** notas cuja descrição do serviço tinha **quebras de linha** (ex.: dados
  bancários em várias linhas) ou **aspas** eram rejeitadas pela Receita com E0714.
  (Interno: falha nossa no cálculo da assinatura digital, não do certificado do cliente.
  Para o cliente: "instabilidade momentânea, já normalizada".)
- **Corrigido em:** 03/11/2026 (~17h50, horário de Brasília).
- **Como orientar:** se o cliente teve E0714 até essa data, pode **emitir a nota novamente**
  (pelo painel, uma nova emissão; pela API, com uma nova `Idempotency-Key` — reenviar a
  mesma chave devolve a rejeição antiga). Não precisa trocar certificado nem mudar a
  descrição. Nenhuma nota rejeitada gera efeito fiscal.
- **Se acontecer de novo depois de 03/11/2026:** escalar para humano (é bug).

### 2026-11-03 · Assinatura paga aparecendo como "Trial" — CORRIGIDO
- **O que era:** o pagamento no cartão era aprovado, mas o sistema não atualizava o plano
  (continuava aparecendo Trial e o portal de cobrança não abria).
- **Corrigido em:** 03/11/2026. Assinaturas pagas antes disso já foram atualizadas.
- **Como orientar:** se o cliente pagou e ainda vê Trial, **escalar para humano com
  prioridade alta** (envolve cobrança) — não pedir para pagar de novo.

## Limitações conhecidas

- **NF-e / NFC-e (nota de produto):** não emitimos. Só NFS-e (serviço) pela NFS-e Nacional.
  Está em avaliação (ver `docs/ANALISE-NFE-PRODUTO.md`); não prometer prazo.
- **Cota consumida por tentativas do teste:** no trial toda tentativa conta (inclusive
  rejeitada) e continua contando depois da assinatura no mesmo mês (issue #257). Se o cliente
  reclamar de cota consumida sem notas autorizadas → escalar (equipe ajusta o contador).
- **DANFSE (PDF oficial):** o serviço da Receita (ADN) está instável; o link do PDF pode
  redirecionar para a consulta pública da nota no portal nfse.gov.br — isso é esperado.
