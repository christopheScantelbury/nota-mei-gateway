# Análise — Emissão de nota fiscal de PRODUTO (NF-e 55 / NFC-e 65)

> NotaFácil / Nota MEI Gateway · ScantelburyDevs
> Data: 2026-10-01 · Autor: análise técnica e de negócio (somente leitura, nada implementado)
> Gatilho: um integrador perguntou se emitimos NF-e. Decisão vigente: **D-FUT-4** — "Suporte a NFC-e/NF-e (decisão para 2027)" (`NotaFacil-Specs-v1/08-Decisoes-Fechadas.md:289`).

---

## 0. Resumo executivo

1. **Recomendação: não construir agora. Validar a demanda primeiro.** Se houver compromisso de pagamento (o integrador que perguntou ou ≥ 3 leads qualificados), oferecer **NF-e modelo 55 via parceiro (Focus NFe, API de Revenda) por trás da nossa API** (`POST /v1/nfe`), com o mesmo contrato da NFS-e: idempotência, webhooks HMAC e respostas 201/202/422.
2. **MVP:** só NF-e 55, emitente do Simples Nacional (CRT 1) e MEI (CRT 4), sem ICMS-ST, com dados fiscais por item **informados pelo cliente**. NFC-e, ST e motor tributário ficam de fora.
3. **Esforço:** API-only cerca de **2–3 semanas-dev**; com painel, cadastro de produtos, SDKs e WooCommerce, cerca de **5–7 semanas-dev**. Construir direto com as SEFAZ (in-house) custa **3–5 meses-dev** até cobrir bem a NF-e, mais 0,25–0,5 dev fixo de manutenção. Não se justifica com zero pagantes.
4. **Custo do parceiro:** de R$ 113,90/mês (3 CNPJs, mais R$ 37,90 por CNPJ extra) até R$ 548/mês (CNPJs ilimitados, 4.000 notas). Preço de revenda é negociado. **O custo é por CNPJ**, então a NF-e deve ser um **adicional pago à parte**, não entrar na cota atual.
5. **Prazo até a 1ª nota (via parceiro):** cerca de 3 semanas após a decisão, **desde que o cliente tenha Inscrição Estadual e esteja credenciado na SEFAZ da UF** (isso depende do cliente, não de nós).
6. **Risco regulatório próximo:** a partir de **01/01/2027** os grupos IBS/CBS passam a ser obrigatórios na NF-e de emitentes do Simples (CRT 1, 2 e 4). É mais um motivo para deixar o leiaute com um parceiro que acompanha as Notas Técnicas.

---

## 1. Panorama regulatório (focado em MEI e ME/EPP)

> As fontes estão na §9. O Portal Nacional da NF-e (nfe.fazenda.gov.br) entrou em loop de redirecionamento na consulta. Por isso, o conteúdo das Notas Técnicas foi confirmado por fontes secundárias (Tecnospeed, Senior, Legisweb, Avalara) e pelos títulos dos arquivos oficiais. Os ajustes SINIEF foram lidos direto no CONFAZ.

### 1.1 NF-e (55) × NFC-e (65)

| | NF-e 55 | NFC-e 65 |
|---|---|---|
| Uso | Circulação de mercadorias em geral: B2B, interestadual, venda a PJ, e-commerce com transporte | Varejo presencial ao consumidor final; substitui ECF e SAT |
| Base legal | Ajuste SINIEF 07/05 | Ajuste SINIEF 19/16 |
| Destinatário CNPJ | Sim | **Não.** Proibido emitir NFC-e para CNPJ desde 03/11/2025 (segundo a Focus NFe) |
| Limites | — | Vedada em operações ≥ R$ 200 mil; CPF obrigatório a partir de R$ 10 mil ou se o comprador pedir |
| Cancelamento | 24h (extemporâneo a critério da UF, em geral até 480h, com multa) | 30 min (a UF pode reduzir); 168h por substituição em contingência |
| CC-e | Sim (720h, segundo fontes secundárias) | **Vedada** |
| Credenciamento | O **contribuinte** se credencia na SEFAZ da UF onde tem IE | Idem, mais CSC (QR Code v2) por UF |

**Consequência:** o cliente que perguntou (integrador de ERP, B2B) quer **NF-e 55**. A NFC-e é outro mercado (PDV, impressora térmica, contingência offline) e não serve ao nosso público atual.

### 1.2 MEI e NF-e

- **Obrigatoriedade:** o MEI deve emitir nota na venda a PJ, salvo se o destinatário emitir nota de entrada (Res. CGSN 140/2018, art. 106). Na venda presencial a PF está dispensado, salvo se o cliente pedir. O MEI está fora da obrigatoriedade de NF-e por CNAE (Protocolo ICMS 42/09, cl. 4ª, I). Ponto não confirmado: não obtivemos a transcrição literal do art. 106.
- **Inscrição Estadual:** para emitir NF-e, o MEI precisa de **IE ativa** e de **credenciamento na SEFAZ**. Quem se credencia é o contribuinte, não o software. Também precisa de certificado e-CNPJ (A1 ou A3).
- **Alternativas gratuitas** (concorrem com um produto pago para MEI):
  - **Nota Fiscal Fácil (NFF)**, app da SVRS com login gov.br e **sem certificado**. Emite NF-e/NFC-e para MEI em algumas UFs. O módulo MEI está ativo em RS, SC e PI; uma matéria de 2024 cita 8 UFs aderentes (AC, BA, ES, PI, RJ, RS, SC, SP). **Não confirmamos a lista atual.**
  - **NFA-e** (nota avulsa) por UF, por exemplo o Web Emissor do RS.
  - **Emissor de NF-e do Sebrae**, gratuito, exige IE e certificado. **Não confirmamos** se está operacional em 2026: a página do "Novo Emissor" mostrava erro em 26/09/2026.
  - **Não existe** um "Emissor Nacional" de NF-e equivalente ao da NFS-e.
- **CRT = 4 (MEI):** criado pela NT 2024.001 (Ajuste SINIEF 43/2023), em produção desde 16/09/2024. As regras de CFOP para MEI estão em produção desde 01/04/2025. CSOSN permitidos com CRT 4: **102, 300, 400, 900** na NF-e e 102/300 na NFC-e. Na NFC-e, GTIN, CEST e NCM são facultativos para MEI.

### 1.3 ME/EPP: Simples × Lucro Presumido/Real

- **Simples Nacional (CRT 1; CRT 2 se excedeu o sublimite):** o ICMS vai por **CSOSN**. Os mais comuns: 101 (com crédito; exige `pCredSN`/`vCredICMSSN`), 102 (sem crédito), 103, 201/202/203 (com ICMS-ST, emitente substituto), 300, 400, 500 (ST já recolhida), 900.
- **Regime normal (CRT 3):** **CST** de ICMS, com destaque e apuração reais, IPI, e PIS/COFINS não cumulativo. A complexidade é muito maior. **Fica fora do MVP.**
- **DIFAL (EC 87/2015, LC 190/2022):** optante do Simples **não recolhe** DIFAL em venda a consumidor final não contribuinte de outra UF (ADI 5464/5469; SEFAZ-SP, Resposta à Consulta 32028/2025). Isso simplifica o MVP para e-commerce do Simples.

### 1.4 Dados fiscais por item: quem informa?

| Campo | Regra | Origem no MVP |
|---|---|---|
| NCM (8 díg.) | Obrigatório (facultativo para MEI só na NFC-e) | **Cliente**, no cadastro de produto |
| CFOP | Depende da operação (5xxx interna / 6xxx interestadual; 5.102/6.102 revenda, 5.101/6.101 produção própria etc.) | Derivado: tipo de operação + UF de origem/destino, com padrão por produto |
| CEST (7 díg.) | Obrigatório se a mercadoria consta nos anexos de ST/antecipação (Conv. ICMS 142/2018), mesmo sem ST na UF; o fisco valida CEST×NCM | Cliente (opcional) |
| CSOSN / CST | CRT 1/4 → CSOSN; CRT 3 → CST | Padrão por empresa (ex.: 102), sobrescrevível por item |
| Origem (0–8) | Obrigatório | Padrão 0 (nacional) |
| GTIN (`cEAN`/`cEANTrib`) | GTIN ou "SEM GTIN"; validado no Cadastro Centralizado de GTIN; desde 01/10/2025 a validação se estende a produtos com alíquota reduzida da LC 214 | Cliente |
| IPI, PIS/COFINS | No Simples, em regra sem destaque; **não verificamos** o detalhamento do leiaute para o Simples | Grupos com valores zerados conforme o regime (**validar no MOC**) |
| IBS/CBS (`cClassTrib`, grupo UB) | Obrigatório para o Simples a partir de 01/01/2027 | Padrão por empresa + override por item (ver 1.5) |

**Posição recomendada:** **não construímos motor tributário.** O cliente informa NCM, CSOSN, CFOP ou tipo de operação, e nós oferecemos **padrões por empresa e por produto** com validação de formato. Sugestão automática de NCM (via descrição) pode ser uma fase posterior, sempre como sugestão que o cliente confirma. A responsabilidade fiscal pela classificação é do contribuinte; isso deve constar nos Termos de Uso.

### 1.5 Reforma tributária: IBS/CBS/IS no leiaute

- **NT 2025.002-RTC** (grupos `IBSCBS`/UB, `cClassTrib`, IS, totais W03 etc.). Versões recentes: v1.40 (20/05/2026; produção em 03/08/2026), v1.50 (03/06/2026) e **v1.51** (agosto de 2026; **novas validações em produção em 05/10/2026**).
- **Cronograma** (Ato Conjunto RFB/CGIBS nº 4, de 30/07/2026):
  - **03/08/2026:** regime regular.
  - **01/12/2026:** NF-e para não contribuintes do ICMS.
  - **01/01/2027:** emitentes do **Simples Nacional** (inclui CRT 4/MEI).
- **2026 é ano de teste** (CBS 0,9% e IBS 0,1%, apuração "meramente informativa"). O Ato Técnico Conjunto 01/2026 adiou as regras de validação: documentos são autorizados mesmo sem todos os campos e a rejeição 1115 não entrou em produção, mas a obrigação de preencher continua. **Não confirmado:** a data final desse adiamento, e se a alíquota-teste se aplica ao Simples (as fontes divergem sobre a LC 214, art. 348).
- **Impacto:** o MVP precisa aceitar `cClassTrib` e os grupos IBS/CBS por item (ou um padrão por empresa) desde o primeiro dia, porque a janela é jan/2027. Um parceiro absorve o leiaute. Mesmo assim, **o cálculo pode ficar conosco ou com o cliente**: a Focus declara que suporta os campos, mas deixa o cálculo das alíquotas com o integrador.

### 1.6 Eventos

| Evento | NF-e | NFC-e |
|---|---|---|
| Cancelamento (110111) | 24h; extemporâneo conforme a UF | 30 min; por substituição até 168h |
| Carta de Correção CC-e (110110) | Sim. **Não** corrige base, alíquota, quantidade, valor, datas, dados cadastrais de emitente/destinatário | Vedada |
| Inutilização de numeração | Até o dia 10 do mês seguinte | Idem |
| Manifestação do destinatário (210200/210210/210220/210240) | Prazo conclusivo reduzido de 180 para **90 dias** (NT 2020.001 v1.60, Ajuste SINIEF 14/2026) | — |

A **inutilização** é uma obrigação operacional nova para nós: falhas ou rejeições que consomem número geram buracos na série, que precisam ser inutilizados. Na NFS-e isso não existe.

### 1.7 Contingência

- **NF-e:** SVC (SVC-AN ou SVC-RS conforme a UF), EPEC e FS-DA, com transmissão posterior em até 168h.
  - SVC-AN: AC, AL, AP, CE, DF, ES, MG, PA, PB, PI, RJ, RN, RO, RR, RS, SC, SE, SP, TO.
  - SVC-RS: AM, BA, GO, MA, MS, MT, PE, PR.
  - Desde 11/02/2025, o web service da SVC-AN foi unificado ao da SVAN.
- **NFC-e:** contingência **offline** (emite e imprime antes de autorizar; transmite até o 1º dia útil seguinte). Isso exige software **local** no PDV, que não combina com uma API cloud. É mais um motivo para deixar a NFC-e fora.
- **Arquitetura:** com parceiro, a contingência da NF-e fica com ele (a Focus declara contingência automática na NFC-e; na NF-e, **não confirmado**). In-house, seria preciso detectar indisponibilidade (`StatusServico4`), trocar de autorizador e reconciliar depois.

### 1.8 NFC-e: CSC e QR Code

- **QR Code v2:** usa o CSC (token gerado pelo contribuinte no portal da SEFAZ de cada UF).
- **QR Code v3** (NT 2025.001, produção a partir de 03/11/2025): troca o CSC por assinatura digital. É obrigatória para produtor rural PF; para CNPJ é opcional conforme a UF. A v2 segue válida.
- **Mudanças recentes:** em SP o SAT está vedado desde 01/01/2026 (NFC-e obrigatória no varejo); no CE o MFE foi encerrado em 28/01/2026. É um mercado em migração, mas de **varejo com PDV**, não o nosso.

### 1.9 Web services e autorizadores

- **NF-e:**
  - Autorizadores próprios: **AM, BA, GO, MG, MS, MT, PE, PR, RS, SP**.
  - **SVAN:** MA.
  - **SVRS:** AC, AL, AP, CE, DF, ES, PA, PB, PI, RJ, RN, RO, RR, SC, SE, TO.
  - São 12 endpoints, não 27.
- **Padrão técnico:** SOAP 1.2, leiaute 4.00, mTLS ICP-Brasil, ambientes de homologação e produção.
  - Serviços: `NFeAutorizacao4`, `NFeRetAutorizacao4`, `NFeConsultaProtocolo4`, `NFeStatusServico4`, `NFeRecepcaoEvento4`, `NFeInutilizacao4`.
- **Credenciamento:** é do **contribuinte**, por UF. Em PE é automático e exige pelo menos 10 notas de teste em homologação antes da produção. Com parceiro, **o cliente continua precisando de IE e credenciamento**. Esse é o maior atrito do onboarding e não temos como eliminá-lo.

### 1.10 Guarda e DANFE

- **Guarda do XML autorizado e do protocolo** (`procNFe`) pelo prazo da legislação tributária: na prática **5 anos** contados do exercício seguinte (interpretação do prazo decadencial do CTN). O XML e o protocolo devem ser **enviados ou disponibilizados ao destinatário** logo após a autorização (Ajuste 07/05, cl. 7ª §7º). Nosso lifecycle S3 de 5 anos (STOR-01) atende.
- **DANFE:** retrato ou paisagem, simplificado, etiqueta. **DANFE NFC-e:** bobina de 56 mm+, com QR Code.

---

## 2. O que já existe no código e pode ser reaproveitado

> Levantamento feito no repositório em 2026-10-01. Os caminhos são relativos a `apps/api/` quando não indicado.

| Peça | Onde | Reaproveita para NF-e? |
|---|---|---|
| Certificado A1 | `pkg/cert/provider.go:31` `CertProvider.GetCert` → `*tls.Certificate`; upload com `pkcs12.DecodeChain` (sslmate) em `pfxToSecretJSON` (:157); cache de 4h (`cache.go:13`, `caching_provider.go`); `PFXNotAfter` | **Sim, sem mudança.** É o mesmo e-CNPJ A1 e o retorno serve para mTLS e assinatura. A ressalva vale só para o parceiro: ele precisa receber o PFX (ver §7). |
| Assinatura XMLDSig | `internal/document/xmldsig.go` (`XMLDSigSigner.Sign` :77, `PooledSigner` em `worker_pool.go:31`) | **Parcial (só in-house).** O C14N inclusivo com transform enveloped é o mesmo, e o `#Id` via `extractIDValue` (:233) e a `<Signature>` irmã após o elemento (`insertSignature` :324) servem. **Precisa mudar:** (1) a NF-e 4.00 usa **RSA-SHA1/SHA1**, mas o código fixa SHA-256 (:40-42); (2) `signableElements` (:52) não inclui `infNFe`/`infEvento`/`infInut`; (3) o C14N "por string" (`c14nElement` :186) não normaliza escapes, então um `xProd` com aspas (`TV 32"`) quebra o digest, e ele pega só a 1ª ocorrência (sem lote); (4) o XML precisa sair **compacto** (hoje é `MarshalIndent`). |
| Cliente mTLS | `internal/nfse/nacional_client.go` (`doJSON` :265 com `RenegotiateOnceAsClient` :275), `adapter.go` (`withRetry` :250) | **Só o padrão.** O envelope é JSON+gzip+base64 (NFS-e); a SEFAZ exige **SOAP 1.2** (`application/soap+xml`), tabela de URLs por UF/ambiente e `RootCAs` ICP-Brasil (hoje não há pool próprio). **Atenção:** o `withRetry` reenvia em 5xx/timeout, o que na NF-e pode gerar **duplicidade**. O correto é consultar o protocolo pela chave antes de reenviar. |
| Builder do documento | `internal/document/dps_builder.go` (`Build` :79, `ErrValidation` :50, `SetTpAmb` :32), `dps_types.go` | **Só o padrão** (structs `encoding/xml` na ordem do XSD + `ErrValidation` → 422). O conteúdo é 100% NFS-e. O leiaute 4.00 da NF-e tem cerca de 10× mais campos (itens `det`, impostos por item, totais, transporte, pagamento, IBS/CBS). Não há validação contra XSD no código; os XSDs da NFS-e estão só em `docs/nfse-schemas/`. |
| Persistência | `internal/nfse/nota_repository.go` (`Create` :146, `Autorizar` :472, `Rejeitar` :495 com guard `WHERE status='PROCESSANDO'`; `NextNumeroDPS` :107 em `dps_sequences`) | **Padrão sim, tabela não.** `notas_fiscais` é NFS-e (sem itens; a chave de 50 dígitos fica em `numero_nfse`; o XML autorizado retornado não é salvo). Copiar o padrão de sequência atômica (`INSERT … ON CONFLICT … RETURNING`) para **série + número** da NF-e. |
| Poller | `internal/nfse/poller.go:43` (lock Redis `nfs:poll:<id>` 2 min, interfaces `CertLoader`/`EmissaoCounter`/`PollerLocker`), montado em `cmd/worker/main.go:95` | **Padrão sim.** Criar `nfe.Poller` com o mesmo lock, chamando a consulta do parceiro ou da SEFAZ. |
| Fluxo HTTP de emissão | `internal/handler/nfse.go` `emitirNotaME` (:310): idempotência (:318-339, `replayNota` :1947 → 200 `Idempotent-Replayed`), cota (`billingGrd.Allow` → 402), `Create` → 409 `IDEMPOTENCY_KEY_CONFLICT` (:534), envio ao S3 (:545), envio → 201/202/422 (:593-673) | **O desenho é 100% reaproveitável** (mesmos códigos HTTP). O código está acoplado à NFS-e, então copiar para um handler novo e extrair os helpers comuns (idempotência e replay) **depois**. |
| Webhooks | `internal/webhook/publisher.go:35-41` (`EventType nfse.*`, `DeliveryMessage`), `consumer.go` (HMAC `X-Nota-Signature` :253, filas de retry 1m/5m/30m) | **Sim.** Adicionar `nfe.autorizada`, `nfe.rejeitada`, `nfe.cancelada`, `nfe.cce` e um campo `tipo_documento`. `buildPayload` (:289) fixa `/v1/nfse/{id}/pdf\|xml`: parametrizar. |
| Billing / cota | `internal/billing/guard.go` (`Allow` :187, contador Redis `billing:<id>:<YYYY-MM>`), `repository.go:199` `IncrementEmitidasEmpresa` (`emissoes_mensais.total_emitidas`) | **Parcial.** O `Guard.Check` (:95) **não é usado em produção**; o que roda é `Allow`. Recomendo um **contador separado** para NF-e (chave Redis `billing:nfe:<id>:<YYYY-MM>` + coluna nova) para não consumir a cota da NFS-e. `planos.tipo_empresa` não distingue tipo de documento. |
| Sandbox | `internal/sandbox/handler.go` (notas em memória, sempre AUTORIZADA após 300 ms; owner `demo` ou `dev:<sha8>` :86; rate limit em `ratelimit.go:41`), interceptado em `cmd/server/main.go:410-433` | **Sim (clonar).** Ver §4.5. |
| Armazenamento 5 anos | `pkg/storage/store.go:15` `ObjectStore{Put,Get,PresignedURL}`, `S3Store` (SSE-AES256) / `NoopStore` | **Sim.** Novas chaves: `nfe/{empresa}/{nota}/procNFe.xml`, `danfe.pdf`, `eventos/{seq}.xml`. |
| PDF | `internal/document/pdf_comprovante.go` (`GenerateComprovante` :85, `go-pdf/fpdf v0.9.0`) | **Não para o DANFE.** Não há código de barras (Code-128 da chave) nem QR Code no repositório. Com parceiro, **usamos o DANFE dele** e o arquivamos no S3. |
| Registro de rotas | `cmd/server/main.go`: grupo `v1` (:486), `v1.Post("/nfse"…)` (:489-496), injeção `With*` (:222-230) | Ponto de encaixe de `/v1/nfe`. |
| Cadastro do emitente | Tabela `empresas` (`auth.Empresa`, `internal/auth/empresa.go:14`): tem `tipo`, `regime_tributario` (mapeável para CRT 4/1/3), `cnpj`, `municipio_ibge`, `cep`, `cnae` | **Faltam:** `inscricao_estadual`, `uf`, endereço completo (logradouro, número, bairro), nome fantasia, telefone e CRT explícito. |
| Destinatário | Tabela `clientes` (`20260526000003_clientes.sql`): já tem `uf`, endereço completo e **`inscricao_estadual`** | **Sim.** Serve como destinatário da NF-e (`indIEDest` derivado da IE). |
| Painel `/notas/nova` | `apps/web/app/(dashboard)/notas/nova/page.tsx` (713 linhas; `NBSServicoPicker`, `ClienteCombobox`, `CepMunicipioInput`, `MoneyInput`) | **Página nova.** Não existe conceito de **itens**. `ClienteCombobox`, `CepMunicipioInput` e `MoneyInput` servem. |
| WooCommerce | `packages/sdk-woo/includes/class-notamei-order.php` (`emit_for_order` :64, idempotência `woo-order-<id>`, `build_servico` :127 usa `get_total()` + NBS padrão) | **Precisa mapear itens** (`$order->get_items()` → `det[]` com NCM do meta do produto). Ver §5.4. |
| SDKs | `packages/sdk-node/src/client.ts:239-308` (`emitir`, `consultar`, `listar`, `cancelar`, `pdf`, `xml` em `/v1/nfse`), `packages/sdk-python/src/notamei/client.py:115-233` | Adicionar namespace `nfe` (`client.nfe.emitir(...)`) sem quebrar os métodos atuais. |

**Resumo:** reaproveitamos a "carcaça" do produto: certificado, armazenamento, webhooks, idempotência, numeração atômica, locks, sandbox, autenticação por API key e o contrato HTTP. **Toda a camada fiscal da NF-e é nova:** leiaute, SOAP por UF, eventos, inutilização, DANFE, cadastro de produtos e dados do emitente.

---

## 3. Caminhos possíveis

### 3.1 Fornecedores de mercado (consulta em 2026-10-01)

| | Focus NFe | NFE.io | PlugNotas (TecnoSpeed) | Webmania | Spedy | Migrate InvoiCy |
|---|---|---|---|---|---|---|
| NF-e / NFC-e / NFS-e | ✅ ✅ ✅ | ✅ ✅ ✅ | ✅ ✅ ✅ | ✅ ✅ ✅ | ✅ ✅ ✅ | ✅ ✅ ✅ |
| Preço público | **Sim** | Sim (franquia), excedente não publicado | **Não** (sob consulta) | Parcial | Parcial | Não |
| Entrada NF-e | Solo R$ 89,90 (1 CNPJ, 100 notas, R$ 0,10 por nota extra); **Start R$ 113,90** (3 CNPJs + R$ 37,90 por CNPJ extra); **Growth R$ 548** (CNPJs ilimitados, 4.000 notas, R$ 0,12 por nota extra) | Base R$ 190 (250 notas, CNPJs ilimitados) | — | "a partir de R$ 69,90" (não confirmado a que se refere); PME R$ 249,90 (500 notas) | Avançado R$ 157 (com API; R$ 0,44 por nota extra) | — |
| Empresas + A1 via API | ✅ API de Revenda (token de revenda) | ✅ `/v2/companies` + `/certificates` | ✅ `/empresa` + `/certificado` | ✅ API Gerencial B2B | ✅ / ❓ | ❓ |
| Revenda / white-label explícito | ✅ plano de revenda nos Termos; afiliados até 20% | ✅ (sob consulta) | ✅ (foco em software house) | ✅ B2B | ✅ | ✅ |
| Cálculo de impostos | Parcial; **IBS/CBS fica com o integrador** | Pago à parte (parceiro) | ✅ calculadora IBS/CBS por item | ✅ (declarado) | ❓ | ❓ |
| IBS/CBS (NT 2025.002) | ✅ campos | ✅ v1.50 (sem IS) | ✅ | ✅ (declarado) | ✅ | ❓ |
| DANFE | ✅ | ✅ | ✅ | ✅ | ✅ | ❓ |
| Plugin WooCommerce próprio | ⛔ | Só NFS-e | ❓ | ✅ **oficial** (NF-e/NFC-e/NFS-e) | ❓ | ❓ |

> ⚠️ **A Nuvem Fiscal** (citada no prompt) **anunciou desativação em 22/04/2026, com fim em 31/07/2026** (comunicado no próprio site de suporte e tópico no fórum ACBr; o domínio não resolve mais). Ela sai da lista e serve de lembrete: **toda integração com parceiro precisa de uma camada de adapter nossa**, para trocar de fornecedor sem mexer no contrato público.

**Bibliotecas open source (base para in-house):** `nfephp-org/sped-nfe` (PHP) é a mais madura (push em 11/09/2026, já com NT 2025.002 e QR v3). ACBr/ACBrLib (Pascal, bindings; binários prontos só para assinantes). PyNFe (Python, push em 02/2026). **Em Go não há nada maduro**: `frones/nfe` parado desde 2023; `gonfe` e `nfe-go` criados em 2026, sem estrelas, um deles sem licença.

### 3.2 Comparativo dos caminhos

| Critério | A. In-house (SEFAZ direto) | B. Parceiro (white-label via API) | C. Híbrido (parceiro agora, adapter pronto para internalizar) |
|---|---|---|---|
| Esforço até o MVP | **12–20 semanas-dev**: leiaute 4.00 + IBS/CBS, SOAP para 12 autorizadores, ajustes no signer, eventos, inutilização, DANFE com Code-128, homologação por UF | **5–7 semanas-dev** com painel/SDK/Woo (2–3 só API) | Igual a B + cerca de 0,5 semana para a interface `dfe.Provider` |
| Tempo até a 1ª nota | 3–5 meses | ~3 semanas (+ IE/credenciamento do cliente) | ~3 semanas |
| Custo fixo | ~R$ 0 de infra; custo é tempo do dev (oportunidade) | R$ 113,90–548/mês (ou contrato de revenda) | Idem B |
| Custo variável/nota | ~0 | R$ 0,10–0,12 por nota acima da franquia + **R$ 37,90 por CNPJ extra** (Start) | Idem B |
| Manutenção contínua | **Alta**: NTs frequentes (só a 2025.002 teve 5+ versões em 2026), 12 endpoints, contingência; 0,25–0,5 dev fixo | Baixa: só nosso mapeamento JSON quando o parceiro muda o contrato | Baixa |
| Risco fiscal/operacional | Alto: rejeições, duplicidade por retry, falhas de C14N, contingência malfeita | Médio: depende do SLA do parceiro | Médio |
| Dependência de terceiro | Nenhuma | **Alta** (lição da Nuvem Fiscal) | Mitigada pelo adapter + 2º fornecedor homologado em espera |
| Contrato da nossa API | Igual ao NFS-e | Igual ao NFS-e (o parceiro fica escondido) | Igual ao NFS-e |
| Certificado A1 | Fica só no nosso Secrets Manager | **Copiado para o parceiro** (choque com a regra de segurança nº 1, ver §7) | Idem B enquanto usar parceiro |

### 3.3 Recomendação

**Caminho C (híbrido), mas só depois de validar a demanda**:

1. **Agora (custo ~0):** responder ao integrador com transparência ("NF-e em beta sob demanda"), medir o interesse e pedir **cotação de revenda à Focus NFe e à PlugNotas** em paralelo.
2. **Com compromisso de pagamento:** implementar `POST /v1/nfe` sobre a interface `dfe.Provider`, com `FocusProvider` como primeira implementação.
3. **Internalizar (provider `sefaz`) só quando** o custo do parceiro passar de cerca de 1 dev-mês por trimestre (algo como > 300 CNPJs ativos com NF-e) **ou** houver motivo regulatório ou de segurança. Antes disso, construir in-house troca 3–5 meses de produto central (NFS-e, que ainda não tem pagante) por um módulo sem cliente.

**Por que a Focus como padrão:** é a única com **preço público, API de Revenda documentada e plano de revenda nos Termos** (os clientes ficam como nossos). O ponto fraco: o IBS/CBS fica com o integrador. A **PlugNotas** pode ganhar na cotação por ter a calculadora IBS/CBS por item, mas o preço é opaco. A **Webmania** é o concorrente a temer no WooCommerce, não um parceiro.

---

## 4. MVP proposto e roadmap

### 4.1 Escopo do MVP ("NF-e 55 Simples")

**Dentro:**
- NF-e **modelo 55**, venda de mercadoria (revenda ou produção própria), **emitente CRT 1 (Simples) ou CRT 4 (MEI)**.
- Operações **internas e interestaduais**. Com parceiro, a UF não muda o esforço; o DIFAL não se aplica ao Simples.
- CSOSN **101, 102, 103, 300, 400, 500, 900** (sem os de ST como substituto: 201/202/203).
- Destinatário PJ ou PF (CPF/CNPJ, IE opcional → `indIEDest`), com endereço completo.
- Itens com NCM, CFOP, CSOSN, origem, unidade, quantidade, valor, GTIN ou "SEM GTIN", CEST opcional, frete/desconto simples, forma de pagamento.
- Grupos **IBS/CBS** por item via `cClassTrib` padrão da empresa + override (obrigatório a partir de jan/2027).
- Eventos: **cancelamento** e **CC-e**. **Inutilização** automática dos números consumidos por rejeição.
- XML `procNFe` + DANFE arquivados no S3, entregues por `GET /v1/nfe/:id/xml|pdf`.
- Webhooks `nfe.*`, idempotência, sandbox.

**Fora (fases posteriores ou nunca):**
- NFC-e 65 (PDV, contingência offline, CSC/QR).
- Emitente Lucro Presumido/Real (CRT 3).
- ICMS-ST como substituto, FCP, IPI com destaque.
- Importação/exportação, devolução referenciada, nota complementar/ajuste, NF-e de entrada.
- Manifestação do destinatário.
- Motor tributário ou sugestão de NCM.
- Transporte detalhado (volumes, transportadora) além do `modFrete`.

### 4.2 Roadmap em fases

| Fase | Gatilho | Entrega | Esforço |
|---|---|---|---|
| **F0 — Validação** | Já | Resposta ao integrador; formulário "quero NF-e" na `/api` e na `/comparativo`; cotação Focus + PlugNotas; atualizar D-FUT-4 | ~1 dia |
| **F1 — API beta** | 1 cliente pagante comprometido **ou** ≥ 3 leads qualificados | `dfe.Provider` + `FocusProvider`; `POST/GET/DELETE /v1/nfe`, CC-e, xml/pdf; webhooks; sandbox; migrations; cadastro de IE/endereço do emitente (via API e em `/configuracoes`) | 2–3 semanas-dev |
| **F2 — Painel + SDKs** | Clientes do beta usando | `/notas-produto/nova` com itens; catálogo `/produtos`; listagem; SDK Node/Python `client.nfe.*`; OpenAPI; Postman | 2 semanas-dev |
| **F3 — WooCommerce** | ≥ 5 lojas interessadas | Mapear `get_items()` → itens; meta do produto (NCM/CSOSN/CFOP/GTIN); escolha automática NFS-e × NF-e por produto | 1–1,5 semana-dev |
| **F4 — Ampliação fiscal** | Demanda concreta | CRT 3, ST (201/202/203), devolução, manifestação, sugestão de NCM | por item |
| **F5 — Internalização** | > ~300 CNPJs ativos ou motivo de segurança | `SefazProvider` em Go (ver §5.7) | 12–20 semanas-dev |
| **NFC-e** | Só se mudarmos de segmento (varejo/PDV) | — | Fora do roadmap |

---

## 5. Arquitetura do caminho recomendado

### 5.1 Componentes

```
Cliente (painel / SDK / Woo / ERP)
        │  POST /v1/nfe  (Bearer sk_live_ / JWT)  Idempotency-Key
        ▼
apps/api  ── handler/nfe.go ─────────────┐
   │  validação + idempotência + cota NF-e │
   │  nfe.Service                          │
   │     ├─ nfe.Repository (Postgres)      │
   │     ├─ dfe.Provider  ◄── interface    │
   │     │     ├─ focus.Provider (F1)      │  HTTPS + token de revenda
   │     │     └─ sefaz.Provider (F5)      │  SOAP 1.2 + mTLS (cert via pkg/cert)
   │     ├─ pkg/storage (S3: procNFe.xml, danfe.pdf, eventos)
   │     └─ webhook.Publisher (nfe.*)  → RabbitMQ → consumer (HMAC)
   │
   ├─ POST /v1/webhooks/dfe/focus  (callback do parceiro, autenticado por segredo)
   └─ cmd/worker: nfe.Poller (lock Redis "nfe:poll:{id}") + inutilizador
```

**Princípio:** um pacote novo `internal/nfe/` e um novo `pkg/dfe/`. **Nada em `internal/nfse/` muda**, exceto adições pequenas e retrocompatíveis em `internal/webhook/` (novos `EventType` e `tipo_documento`).

### 5.2 Interface do provider (esboço)

```go
// pkg/dfe/provider.go
type Provider interface {
    // RegistrarEmitente cria/atualiza o emitente no fornecedor (IE, endereço, A1).
    RegistrarEmitente(ctx context.Context, e Emitente, cert *tls.Certificate) (ref string, err error)
    Emitir(ctx context.Context, ref string, nfe NFe) (*Resultado, error) // ref = nossa idempotência
    Consultar(ctx context.Context, ref string) (*Resultado, error)
    Cancelar(ctx context.Context, ref, justificativa string) (*Evento, error)
    CartaCorrecao(ctx context.Context, ref, correcao string) (*Evento, error)
    Inutilizar(ctx context.Context, cnpj string, serie, ini, fim int, just string) (*Evento, error)
    BaixarXML(ctx context.Context, ref string) ([]byte, error)
    BaixarDANFE(ctx context.Context, ref string) ([]byte, error)
}
```

`NFe`, `Item`, `Destinatario` e `Resultado` são **nossos tipos de domínio**, iguais ao JSON público. Cada provider traduz. Assim a troca Focus → PlugNotas → SEFAZ não muda o contrato.

**Observação sobre a Focus** (detalhes a confirmar na documentação ao implementar): a emissão é **assíncrona** (`POST /v2/nfe?ref=<ref>` → status `processando_autorizacao` → consulta ou gatilho). O `ref` da Focus serve como nossa idempotência no fornecedor: mesmo `ref`, mesma nota, sem duplicidade em retry.

### 5.3 Endpoints novos

| Método | Path | Descrição |
|---|---|---|
| POST | `/v1/nfe` | Emitir NF-e |
| GET | `/v1/nfe` | Listar (paginado, filtros status/competência) |
| GET | `/v1/nfe/:id` | Consultar |
| DELETE | `/v1/nfe/:id` | Cancelar (corpo: `justificativa` ≥ 15 caracteres) |
| POST | `/v1/nfe/:id/carta-correcao` | CC-e |
| GET | `/v1/nfe/:id/xml` · `/pdf` | `procNFe` / DANFE |
| GET/POST/PATCH | `/v1/produtos` | Catálogo (NCM, CSOSN, CFOP, GTIN padrão) — F2 |
| PATCH | `/v1/empresa/fiscal` | IE, UF, endereço, CRT, série, `cClassTrib` padrão (habilita NF-e) |
| POST | `/v1/webhooks/dfe/focus` | Callback do parceiro (sem API key; segredo no header) |

**Request (`POST /v1/nfe`):**

```json
{
  "natureza_operacao": "Venda de mercadoria",
  "tipo_operacao": "VENDA",                // VENDA | VENDA_PRODUCAO_PROPRIA → CFOP sugerido
  "consumidor_final": true,
  "presenca": "INTERNET",                  // indPres
  "destinatario": {
    "documento": "12345678000190",
    "nome": "Empresa Cliente LTDA",
    "inscricao_estadual": "ISENTO",
    "email": "financeiro@empresa.com",
    "endereco": { "logradouro": "Av. Paulista", "numero": "1000", "bairro": "Bela Vista",
                  "cep": "01310100", "municipio_ibge": "3550308", "uf": "SP" }
  },
  "itens": [
    { "produto_id": "uuid-opcional",
      "codigo": "SKU-123", "descricao": "Camiseta algodão M", "ncm": "61091000",
      "cfop": "6102", "csosn": "102", "origem": 0, "gtin": "SEM GTIN",
      "unidade": "UN", "quantidade": 2, "valor_unitario": 59.90, "desconto": 0,
      "ibscbs": { "cclass_trib": "000001" } }
  ],
  "frete": { "modalidade": 9, "valor": 0 },
  "pagamento": [{ "forma": "PIX", "valor": 119.80 }],
  "informacoes_complementares": "Documento emitido por ME ou EPP optante pelo Simples Nacional",
  "webhook_url": "https://erp.empresa.com/webhooks/nfe"
}
```

**Respostas:** iguais à NFS-e.

| HTTP | `status` | Quando |
|---|---|---|
| 201 | AUTORIZADA | Autorizou dentro da janela síncrona (espera curta, ~5s) |
| 202 | PROCESSANDO | Vai pelo webhook/poller (caso comum em fornecedor assíncrono) |
| 422 | REJEITADA | `RECEITA_REJECTION` com `erro_codigo`/`erro_descricao` da SEFAZ |
| 422 | — | `VALIDATION_ERROR` com `fields` (NCM inválido, CSOSN incompatível com o CRT etc.) |
| 422 | — | `NFE_NAO_HABILITADA`: empresa sem IE, endereço ou credenciamento |
| 402 | — | `PLAN_LIMIT_REACHED` / `NFE_ADDON_REQUIRED` |
| 200 / 409 | — | Replay de idempotência / `IDEMPOTENCY_KEY_CONFLICT` |

**Webhook:** mesmo envelope e HMAC (`X-Nota-Signature`) da NFS-e, com `event: nfe.autorizada|nfe.rejeitada|nfe.cancelada|nfe.cce`, `tipo_documento: "NFE"`, `chave_acesso` (44 dígitos), `serie`, `numero`, `protocolo`, `xml_url`, `pdf_url`.

### 5.4 Schema proposto (SQL só no documento, não aplicar)

Tabela **nova**, separada de `notas_fiscais`. Motivos:
- `notas_fiscais` tem colunas e CHECK de NFS-e e nenhum conceito de item.
- Telas admin e listagens já quebraram com nulos inesperados (BUG-005, `mei_id` NULL).
- Misturar coloca em risco a NFS-e, que está em produção.

Uma view `documentos_fiscais` pode unificar a listagem depois.

```sql
-- 1) Dados fiscais do emitente (empresas)
ALTER TABLE empresas
  ADD COLUMN inscricao_estadual   VARCHAR(20),
  ADD COLUMN uf                   CHAR(2),
  ADD COLUMN logradouro           VARCHAR(255),
  ADD COLUMN numero_endereco      VARCHAR(20),
  ADD COLUMN complemento          VARCHAR(100),
  ADD COLUMN bairro               VARCHAR(100),
  ADD COLUMN telefone             VARCHAR(20),
  ADD COLUMN nome_fantasia        VARCHAR(255),
  ADD COLUMN crt                  SMALLINT CHECK (crt IN (1,2,3,4)),
  ADD COLUMN nfe_habilitada       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN nfe_serie_padrao     SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN nfe_cclass_trib_padrao VARCHAR(6),
  ADD COLUMN nfe_csosn_padrao     VARCHAR(3),
  ADD COLUMN dfe_provider         VARCHAR(20),          -- 'focus' | 'plugnotas' | 'sefaz'
  ADD COLUMN dfe_provider_ref     VARCHAR(100);         -- id do emitente no fornecedor

-- 2) Catálogo de produtos (F2)
CREATE TABLE produtos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo         VARCHAR(60) NOT NULL,                  -- SKU
  descricao      VARCHAR(120) NOT NULL,
  ncm            CHAR(8) NOT NULL,
  cest           CHAR(7),
  gtin           VARCHAR(14),                           -- NULL = "SEM GTIN"
  unidade        VARCHAR(6) NOT NULL DEFAULT 'UN',
  origem         SMALLINT NOT NULL DEFAULT 0 CHECK (origem BETWEEN 0 AND 8),
  csosn          VARCHAR(3),
  cfop_interno   CHAR(4),
  cfop_interestadual CHAR(4),
  cclass_trib    VARCHAR(6),
  valor_unitario DECIMAL(15,4),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

-- 3) Numeração por série (padrão de dps_sequences)
CREATE TABLE nfe_sequences (
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  modelo       SMALLINT NOT NULL DEFAULT 55,
  serie        SMALLINT NOT NULL,
  ambiente     SMALLINT NOT NULL,                       -- 1 produção | 2 homologação
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, modelo, serie, ambiente)
);

-- 4) Notas de produto
CREATE TABLE nfe_notas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  modelo             SMALLINT NOT NULL DEFAULT 55,
  serie              SMALLINT NOT NULL,
  numero             INTEGER NOT NULL,
  ambiente           SMALLINT NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'PROCESSANDO',
  chave_acesso       CHAR(44),
  protocolo          VARCHAR(20),
  dfe_provider       VARCHAR(20) NOT NULL,
  dfe_ref            VARCHAR(100) NOT NULL,             -- ref enviada ao fornecedor
  idempotency_key    VARCHAR(255),
  cliente_id         UUID REFERENCES clientes(id),
  dest_documento     VARCHAR(14),
  dest_nome          VARCHAR(255),
  dest_uf            CHAR(2),
  natureza_operacao  VARCHAR(60),
  valor_produtos     DECIMAL(15,2),
  valor_total        DECIMAL(15,2),
  competencia        VARCHAR(7),
  payload_json       JSONB NOT NULL,                    -- request normalizado (auditoria)
  xml_s3_key         TEXT,
  pdf_s3_key         TEXT,
  erro_codigo        VARCHAR(20),
  erro_descricao     TEXT,
  webhook_url        TEXT,
  autorizada_em      TIMESTAMPTZ,
  cancelada_em       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nfe_status_values CHECK (status IN
    ('PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA','DENEGADA','ERRO_TEMPORARIO')),
  UNIQUE (empresa_id, modelo, serie, numero, ambiente),
  UNIQUE (dfe_provider, dfe_ref)
);
CREATE UNIQUE INDEX nfe_notas_idem ON nfe_notas(empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX nfe_notas_chave ON nfe_notas(chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX nfe_notas_processando ON nfe_notas(status) WHERE status = 'PROCESSANDO';
CREATE INDEX nfe_notas_empresa_comp ON nfe_notas(empresa_id, competencia);

-- 5) Itens
CREATE TABLE nfe_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id         UUID NOT NULL REFERENCES nfe_notas(id) ON DELETE CASCADE,
  n_item         SMALLINT NOT NULL,
  produto_id     UUID REFERENCES produtos(id),
  codigo         VARCHAR(60) NOT NULL,
  descricao      VARCHAR(120) NOT NULL,
  ncm            CHAR(8) NOT NULL,
  cfop           CHAR(4) NOT NULL,
  csosn          VARCHAR(3),
  origem         SMALLINT NOT NULL,
  quantidade     DECIMAL(15,4) NOT NULL,
  valor_unitario DECIMAL(21,10) NOT NULL,
  valor_total    DECIMAL(15,2) NOT NULL,
  cclass_trib    VARCHAR(6),
  UNIQUE (nfe_id, n_item)
);

-- 6) Eventos (cancelamento, CC-e, inutilização)
CREATE TABLE nfe_eventos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  nfe_id       UUID REFERENCES nfe_notas(id),           -- NULL para inutilização
  tipo         VARCHAR(10) NOT NULL,                     -- 110111 | 110110 | INUT
  sequencia    SMALLINT NOT NULL DEFAULT 1,
  status       VARCHAR(20) NOT NULL,                     -- REGISTRADO | REJEITADO
  protocolo    VARCHAR(20),
  conteudo     TEXT,                                     -- justificativa / correção
  serie        SMALLINT, numero_inicial INTEGER, numero_final INTEGER,
  xml_s3_key   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 7) Cota de NF-e separada
ALTER TABLE emissoes_mensais ADD COLUMN total_nfe_emitidas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planos ADD COLUMN nfe_limite INTEGER NOT NULL DEFAULT 0;    -- 0 = sem NF-e

-- RLS (regra inegociável nº 5)
ALTER TABLE produtos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_notas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_eventos   ENABLE ROW LEVEL SECURITY;
-- Policies seguindo o padrão atual de empresas (empresa.user_id = auth.uid()), mais service_role.
```

> **Numeração com parceiro:** a Focus pode numerar sozinha. **Recomendo que nós numeremos** (`nfe_sequences`) e enviemos série e número, para não depender do fornecedor numa migração futura. A inutilização de buracos fica com a gente (worker diário: números consumidos com status REJEITADA e sem reenvio no mesmo número → `Inutilizar`). Confirmar na documentação da Focus se ela aceita número explícito.

### 5.5 Fluxo assíncrono, poller, sandbox, armazenamento e DANFE

1. **`POST /v1/nfe`:**
   - validar (formato NCM/CFOP/CSOSN × CRT, soma de pagamento = total, IE do emitente presente);
   - idempotência (copiar o padrão de `emitirNotaME`, `handler/nfse.go:318-339`);
   - checar cota NF-e (`billing:nfe:<id>:<YYYY-MM>`);
   - reservar o número (`nfe_sequences`) e fazer o `INSERT` PROCESSANDO com `dfe_ref = <nota_id>`;
   - `Provider.Emitir`.
2. **Janela síncrona curta** (até ~5s, consultando a cada 1s): se autorizou → baixar XML e DANFE → S3 → **201**. Senão → **202** e segue.
3. **Gatilho do parceiro** (`/v1/webhooks/dfe/focus`) ou **`nfe.Poller`** (cópia de `nfse/poller.go`, lock `nfe:poll:{id}`, a cada 30s nas notas PROCESSANDO há mais de 30s): `Consultar` → `Autorizar`/`Rejeitar` com guard `WHERE status='PROCESSANDO'` → S3 → `webhook.Publisher` (`nfe.*`) → contador de cota.
4. **Retry:** **nunca** reenviar `Emitir` às cegas. Sempre `Consultar(ref)` primeiro. O `ref` estável garante idempotência no fornecedor.
5. **Sandbox:** clonar `internal/sandbox/` para `/v1/nfe`. Chaves `sk_test_` sem empresa recebem notas simuladas em memória, **com as mesmas validações de formato do handler real** e rejeições simuladas por gatilho (ex.: NCM `00000000` → 422 com o código SEFAZ 778). Empresas reais em homologação podem usar `ambiente=2` no parceiro (**não confirmado** se o ambiente de homologação da Focus é gratuito por CNPJ).
6. **Armazenamento:** `procNFe.xml`, `danfe.pdf` e o XML de cada evento em `nfe/{empresa}/{nota}/...` via `pkg/storage`, com o mesmo bucket e lifecycle de 5 anos. Os URLs públicos saem dos nossos endpoints, nunca do parceiro: se trocarmos de fornecedor, os links continuam válidos.
7. **DANFE:** o do parceiro, arquivado. Um DANFE próprio (fpdf + Code-128) só na F5.

### 5.6 O que generalizar × o que manter separado

| Generalizar (baixo risco, aditivo) | Manter separado |
|---|---|
| `webhook.EventType` + `tipo_documento` no payload (campo novo, retrocompatível); URLs de `buildPayload` parametrizadas por tipo | Handler, service e repository (`internal/nfe/` ≠ `internal/nfse/`) |
| Extrair depois um helper de idempotência e replay de `handler/nfse.go`, só quando o 2º uso estiver estável | Tabelas (`nfe_notas` ≠ `notas_fiscais`) |
| `pkg/cert` (mesmo provider) | Sandbox (handler próprio, mesmo padrão) |
| `pkg/storage` (novas funções de chave) | Contador de cota (chave Redis e coluna próprias) |
| Middleware de autenticação, rate limit e grupo `v1` | Signer: **não mexer** no `XMLDSigSigner` da NFS-e na F1; na F5, parametrizar algoritmo e elementos com testes de regressão da DPS |

### 5.7 Se internalizar (F5): o que muda no código atual

- `xmldsig.go`: algoritmo configurável (SHA1 para NF-e), `infNFe`/`infEvento`/`infInut` em `signableElements`, C14N robusto (escape de texto e várias ocorrências) e XML **sem indentação**.
- Novo cliente SOAP 1.2, com tabela de endpoints por UF × ambiente × serviço (12 autorizadores + SVC-AN/SVC-RS), `RootCAs` com a cadeia ICP-Brasil e `http.Transport` reaproveitado (hoje `doJSON` cria um por chamada).
- `StatusServico4` e troca automática para SVC.
- Builder do leiaute 4.00 + NT 2025.002 com validação XSD no CI.
- DANFE próprio com Code-128.
- Homologação por autorizador (cada SEFAZ própria + SVRS + SVAN).

---

## 6. Precificação e impacto no negócio

### 6.1 Quem é o cliente e o tamanho da oportunidade

- **Universo:** cerca de **25–26 milhões de empresas ativas**, quase todas do Simples. **MEIs: 12,7 a 17 milhões, conforme a fonte** (Mapa de Empresas/MEMP: 52,3% das ativas e > 12,7 mi no 2º quadrimestre de 2025; Sebrae e bases privadas falam em 16–17 mi em 2026). **Não confirmamos** a fatia que vende mercadoria. O comércio é o 2º setor em aberturas de MEI em 2026 (298,7 mil registros no 1º quadrimestre, segundo o Sebrae), o que sugere vários milhões de negócios de comércio entre MEI e ME/EPP.
- **Para nós, o relevante não é o total:**
  1. **O funil atual é de serviço.** Quem emite NFS-e conosco presta serviço e, em geral, não tem IE nem vende mercadoria. A NF-e atrai uma **persona nova** (lojista, e-commerce, indústria pequena) que hoje não chega pelos nossos canais nem pelas campanhas de Ads.
  2. **MEI que vende produto tem alternativas gratuitas** (NFF em algumas UFs, NFA-e, Emissor Sebrae) e volume baixo de vendas a PJ. É um mau alvo pago.
  3. **O alvo com melhor encaixe:** (a) **integradores e ERPs** que já usam nossa API de NFS-e e querem "uma API só" para serviço e produto. É o caso que motivou esta análise e é o diferencial "multi-documento". (b) **ME/EPP do Simples** que vendem serviço **e** produto (assistência técnica, instalação com material, agências que revendem equipamento).
  4. **E-commerce WooCommerce:** a Webmania já tem plugin oficial cobrindo NF-e/NFC-e/NFS-e. Entramos só se o nosso plugin trouxer vantagem (preço, NFS-e Nacional nativa).

### 6.2 Custo unitário via parceiro (Focus, preço de lista)

| Cenário | Custo Focus | Custo por CNPJ |
|---|---|---|
| 1–3 CNPJs (Start) | R$ 113,90/mês | R$ 38–114 |
| 10 CNPJs (Start: 113,90 + 7×37,90) | R$ 379,20/mês | ~R$ 37,90 |
| 15+ CNPJs → Growth | R$ 548/mês (4.000 notas) | ≤ R$ 36,50 e caindo |
| 50 CNPJs (Growth) | R$ 548/mês | ~R$ 11 |

O custo marginal é **por CNPJ** (cerca de R$ 37,90 no Start), não por nota (R$ 0,10–0,12 acima da franquia). Logo:
- **Não dá para incluir NF-e na cota atual.** O MEI Mensal (cerca de R$ 19,90–24,90) fica com margem negativa já no 1º CNPJ.
- **Proposta (a validar com a cotação de revenda):**

| Público | Proposta | Racional |
|---|---|---|
| ME/EPP (painel) | **Adicional "NF-e de produto" R$ 59,90/mês**, com 100 NF-e incluídas e R$ 0,40 por nota excedente | Cobre o CNPJ no Start (~R$ 38) mais Stripe; margem cresce muito no Growth |
| Gateway/Dev | **R$ 39,90 por CNPJ emitente ativo/mês** (emitiu ≥ 1 NF-e no mês), com 100 notas por CNPJ; excedente R$ 0,25 | Espelha a estrutura de custo do parceiro (por CNPJ); o integrador repassa ao cliente final |
| MEI | **Não oferecer no MVP** (ou adicional ≥ R$ 39,90, só sob demanda) | Alternativas gratuitas; ticket baixo |

- **Ponto de equilíbrio do Growth:** R$ 548 ÷ R$ 59,90 ≈ **10 empresas pagantes**. Abaixo disso, ficar no Start (pass-through).
- **Implementação de billing:** produto Stripe separado (subscription item adicional na assinatura existente), `planos.nfe_limite` e contador próprio. O catálogo é editado **só via `/admin/planos`** (regra do projeto).

### 6.3 Impacto no SDK WooCommerce

- Hoje `build_servico` (`class-notamei-order.php:127`) emite **NFS-e pelo total do pedido**. Para produto: iterar `$order->get_items()`, ler meta do produto (`_notamei_ncm`, `_notamei_csosn`, `_notamei_cfop`, `_notamei_gtin`, com padrão nas configurações), montar `itens[]`, calcular frete e desconto e escolher **NF-e** quando o carrinho tiver produto físico (`$product->needs_shipping()`) e **NFS-e** quando for serviço. Pedido misto gera duas notas com duas idempotências: `woo-order-<id>-nfe` e `-nfse`.
- A loja precisa de **IE e credenciamento**. O plugin deve checar `nfe_habilitada` e mostrar instruções.
- É a F3, porque a Webmania já ocupa esse espaço.

---

## 7. Riscos e mitigação

| # | Risco | Tipo | Mitigação |
|---|---|---|---|
| 1 | **Certificado A1 copiado para o parceiro.** A regra de segurança nº 1 do CLAUDE.md ("A1 nunca em disco, só no Secrets Manager") fica parcialmente furada: o PFX vai para um terceiro | Segurança/LGPD | Consentimento explícito do cliente no onboarding da NF-e; parceiro como **suboperador** em contrato/DPA; registrar exceção na regra nº 1 ("exceto envio a provedor DF-e homologado, com consentimento"); preferir fornecedor com política de custódia documentada |
| 2 | Fornecedor encerra ou muda preço (precedente: **Nuvem Fiscal**, fim em 31/07/2026) | Fornecedor | Interface `dfe.Provider`; nossos tipos de domínio; nós numeramos; XML/DANFE arquivados no nosso S3; links servidos por nós; 2º fornecedor (PlugNotas) cotado e pronto para homologar |
| 3 | **IBS/CBS obrigatório para o Simples em 01/01/2027**; a Focus deixa o cálculo com o integrador | Fiscal | `cClassTrib` e grupo IBS/CBS no contrato desde a F1; padrão por empresa; acompanhar NT 2025.002 (v1.51 → próximas); se a cotação permitir, preferir provider com calculadora (PlugNotas) |
| 4 | Classificação errada (NCM/CFOP/CSOSN) gera rejeição ou autuação do cliente | Fiscal/reputação | Termos de Uso: responsabilidade do contribuinte; validação de formato e compatibilidade (CSOSN × CRT, CFOP × UF destino); mensagens de rejeição traduzidas (como em `docs/receita-erros.md`) |
| 5 | Onboarding travado: cliente sem IE ou sem credenciamento na SEFAZ | Produto | Checklist de habilitação no painel; `NFE_NAO_HABILITADA` com link de instruções por UF; não cobrar o adicional até a 1ª NF-e autorizada |
| 6 | Duplicidade de NF-e por retry | Técnico | `ref` estável no fornecedor; consultar antes de reenviar; **não** reusar o `withRetry` atual para a emissão |
| 7 | Buracos de numeração não inutilizados | Fiscal | Worker de inutilização + relatório mensal |
| 8 | Margem negativa com muitos CNPJs de baixo volume | Negócio | Preço por CNPJ ativo; migrar para o Growth com ≥ 10 pagantes; negociar revenda |
| 9 | Desvio de foco: a NFS-e (produto core) ainda tem **zero pagantes** | Estratégico | Gatilho explícito para a F1 (pagamento comprometido); time-box de 3 semanas; NFC-e fora |
| 10 | Regressão na NFS-e em produção | Técnico | Pacotes separados; mudanças em `internal/webhook` só aditivas e com testes; signer da NFS-e intocado na F1 |

---

## 8. Decisões que o Chris precisa tomar

1. **Construir agora ou só sob demanda?** **Recomendação:** só sob demanda. A F1 começa com 1 cliente pagante comprometido (ou ≥ 3 leads qualificados). Até lá, F0 (resposta + lista de interesse + cotações).
2. **Parceiro ou in-house?** **Recomendação:** parceiro atrás de um adapter (caminho C). In-house só na F5, com escala ou motivo de segurança.
3. **Qual parceiro?** **Recomendação:** pedir cotação de revenda à **Focus NFe** (padrão: preço público, API de Revenda) e à **PlugNotas** (calculadora IBS/CBS) em paralelo. Decidir pelo custo por CNPJ e pelo suporte a IBS/CBS para o Simples em 2027.
4. **Aceitar o A1 do cliente custodiado pelo parceiro?** **Recomendação:** sim, com consentimento explícito, DPA e exceção registrada na regra de segurança nº 1. Sem isso, o caminho é só in-house.
5. **Escopo do MVP:** **Recomendação:** NF-e 55, Simples (CRT 1) + MEI (CRT 4), sem ST, sem NFC-e. Dados fiscais informados pelo cliente, com padrões por empresa e produto. **Sem motor tributário.**
6. **Precificação:** **Recomendação:** adicional separado da cota de NFS-e (ME/EPP R$ 59,90/mês com 100 NF-e; Gateway R$ 39,90 por CNPJ ativo). MEI fora do MVP. Valores finais depois da cotação.
7. **NFC-e:** **Recomendação:** tirar do roadmap de 2027. Não combina com API cloud (PDV, contingência offline, impressora) nem com o nosso público. Atualizar D-FUT-4 e a resposta em `apps/web/app/(landing)/comparativo/page.tsx:36`, que hoje promete "NFC-e em 2027".
8. **WooCommerce com NF-e:** **Recomendação:** só na F3, com ≥ 5 lojas interessadas. A Webmania já tem plugin oficial.

---

## 9. Fontes consultadas (acesso em 2026-10-01)

**Legislação e órgãos oficiais**
- CONFAZ — Ajuste SINIEF 07/05 (NF-e: credenciamento, guarda, cancelamento, CC-e, inutilização, contingência, DANFE): https://www.confaz.fazenda.gov.br/legislacao/ajustes/2005/AJ_007_05
- CONFAZ — Ajuste SINIEF 19/16 (NFC-e): https://www.confaz.fazenda.gov.br/legislacao/ajustes/2016/AJ_019_16
- gov.br — Nota fiscal para MEI: https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/nota-fiscal
- Receita Federal — cronograma dos DF-e da reforma (Ato Conjunto RFB/CGIBS nº 4/2026): https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-e-comite-gestor-do-ibs-publicam-o-cronograma-de-implementacao-dos-documentos-fiscais-eletronicos-da-reforma-tributaria-do-consumo
- CGIBS — transição IBS/CBS 2026: https://www.cgibs.gov.br/comite-gestor-e-receita-federal-garantem-prazo-de-adaptacao-e-transicao-segura-para-contribuintes-do-ibs-e-da-cbs-em-2026
- CGIBS — adiamento das regras de validação: https://www.cgibs.gov.br/receita-federal-e-comite-gestor-do-ibs-esclarecem-adiamento-das-regras-de-validacao-dos-documentos-fiscais-eletronicos
- Portal NF-e — NT 2024.001 (CRT 4), arquivo oficial (título): https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=6luq3tpmg08%3D
- SEFAZ-RS — NFF/NFA-e para MEI: https://fazenda.rs.gov.br/servicos-ao-cidadao/servicos?servico=1717
- SVRS — notícias da Nota Fiscal Fácil: https://dfe-portal.svrs.rs.gov.br/Nff/Noticias
- SVRS — autorizadores de NFC-e: https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos
- SEFAZ-RS — SVC-RS: https://www.sefaz.rs.gov.br/NFE/NFE-SVC.aspx
- SEFAZ-PE — credenciamento: https://www.sefaz.pe.gov.br/Servicos/nota-fiscal-eletronica/Paginas/credenciamento-de-contribuintes.aspx
- SEFAZ-SP — Resposta à Consulta 32028/2025 (DIFAL no Simples): https://legislacao.fazenda.sp.gov.br/Paginas/RC32028_2025.aspx
- SEFAZ-SP — Portaria CAT 147/2012: https://legislacao.fazenda.sp.gov.br/Paginas/pcat1472012.aspx
- Sebrae — Emissor NF-e: https://sebrae.com.br/sites/portalsebrae/produtoseservicos/emissornfe
- Mapa de Empresas, boletim do 2º quadrimestre de 2025: https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/boletins/mapa-de-empresas-boletim-2o-quadrimestre-2025.pdf
- Agência Sebrae — MEIs em 2026: https://agenciasebrae.com.br/dados/meis-lideram-abertura-de-empresas-no-pais-e-ja-representam-78-dos-novos-negocios-em-2026/

**Notas Técnicas e leiaute (secundárias)**
- Tecnospeed — NT 2024.001 / CRT 4: https://blog.tecnospeed.com.br/nf-e-e-nfc-e-nota-tecnica-2024-001-crt-4/
- Tecnospeed — NT 2025.002 (reforma): https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/
- Tecnospeed — NT 2025.001 (QR Code v3): https://blog.tecnospeed.com.br/nota-tecnica-2025-001-nfc-e-qr-code/
- Tecnospeed — prazos de cancelamento: https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360013667653
- Legisweb — NT 2025.002 v1.51: https://www.legisweb.com.br/noticia/?id=34084
- Senior — validações em produção em 05/10/2026: https://documentacao.senior.com.br/exigenciaslegais/noticias/federal/2026/2026-09-25-nf-e-novas-validacoes-entram-em-producao-em-05-10-2026-sua-empresa-esta-preparada/
- Dia a Dia Tributário — NT 2025.002 v1.31: https://www.diaadiatributario.com.br/nt-2025-002-rtc-v1-31-finaliza-o-leiaute-da-nf-e-nfc-e-para-ibs-cbs-is-e-confirma-a-obrigatoriedade-em-1o-01-2026/
- Normas Legais — Ato Conjunto RFB/CGIBS 1/2025: https://www.normaslegais.com.br/legislacao/ato-conjunto-rfb-cgibs-1-2025.htm
- Normas Legais — Protocolo ICMS 42/09: https://www.normaslegais.com.br/legislacao/protocoloicms42_2009.htm
- ERPWorks — rejeição 1115: https://erpworks.com.br/conteudos/nfe-ibs-cbs-obrigatoriedade-agosto-2026-rejeicoes/
- Pasqualino — LC 214, alíquotas de transição: https://pasqualino.com.br/aliquotas-de-transicao-do-ibs-e-da-cbs-2026-2028-como-aplicar-na-pratica-segundo-a-lc-214-2025/
- Escola Superior ESN — Simples e regime regular IBS/CBS: https://escolasuperioresn.com.br/regime-regular-ibs-cbs-simples-nacional/
- reformatributaria.com — MD-e 90 dias: https://www.reformatributaria.com/tecnologia/nota-tecnica-da-nfe-reduz-prazo-para-manifestacao-do-destinatario/
- FlexDocs — web services, SOAP 1.2, autorizadores: https://flexdocs.net/guiaNFe/WS.html
- Avalara — QR Code v3: https://www.avalara.com/br/pt/blog/2025/09/nt-qrcode-versao3-nfe-nfce.html
- Datacaixa — QR Code v3 / validade da v2: https://www.datacaixa.com.br/versao-3-00-novo-leiaute-do-qr-code-da-nfc-e/
- IOB — CRT/MEI: https://noticias.iob.com.br/nota-fiscal-mei-crt/ · CSOSN: https://aprendo.iob.com.br/ajudaonline/artigo.aspx?artigo=6862
- Contábeis — CRT 4: https://www.contabeis.com.br/noticias/70144/atencao-mei-crt-4-e-obrigatorio-na-nota-fiscal-a-partir-de-hoje-1o/ · GTIN: https://www.contabeis.com.br/noticias/73041/gtin-sera-obrigatorio-para-novo-grupo-de-produtos-em-outubro/ · NFF: https://www.contabeis.com.br/noticias/67732/nota-fiscal-facil-para-quais-estados-esta-valendo-como-acessar-e-mais/ · MFE CE: https://www.contabeis.com.br/noticias/73536/ceara-encerra-mfe-e-cf-e-migracao-para-nfc-e-comeca-em-2026/
- CRC-SP — fim do SAT em SP: https://online.crcsp.org.br/portal/noticias/noticia.asp?c=10087
- Portal Tributário — MEI e nota fiscal: https://www.portaltributario.com.br/tributario/O_MEI_e_obrigado_a_emitir_nota_fiscal.htm

**Fornecedores**
- Focus NFe — preços: https://focusnfe.com.br/precos/ · Termos (plano de revenda): https://focusnfe.com.br/termos-de-uso/ · API de Revenda: https://forum.focusnfe.com.br/t/cadastro-de-empresa-api-de-revenda/71 · Afiliados: https://focusnfe.com.br/programa-afiliados/ · Reforma: https://focusnfe.com.br/guides/reforma-tributaria/ · NFC-e: https://focusnfe.com.br/produtos/nota-fiscal-consumidor-nfce/ · CSOSN: https://focusnfe.com.br/blog/csosn/ · CEST: https://focusnfe.com.br/blog/o-que-e-cest/
- NFE.io — preços NF-e: https://nfe.io/precos/emissao-nfe/ · NFC-e: https://nfe.io/precos/emissao-nfce/ · produto: https://nfe.io/nota-fiscal-de-produto-eletronica/ · NT 2025.002: https://nfe.io/docs/documentacao/reforma-tributaria/conceitos-funcionais/nota-fiscal-de-produto/adequacao-nt-2025-002-rtc-v150/ · empresas via API: https://nfe.io/docs/documentacao/gerenciamento-empresas/visao-geral/ · software houses: https://nfe.io/segmentos/software-house-erps/ · plugin Woo (NFS-e): https://github.com/nfe/woo-nfe
- PlugNotas/TecnoSpeed: https://tecnospeed.com.br/plugdfe/plugnotas/ · cadastro de empresa: https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360055614214
- Webmania (página com HTTP 403; dados do trecho da busca): https://webmania.com.br/planos/ · API B2B: https://webmania.com.br/docs/rest-api-gerencial-b2b/ · plugin Woo: https://wordpress.org/plugins/nota-fiscal-eletronica-woocommerce/
- Spedy: https://spedy.com.br/api · Migrate InvoiCy: https://desenvolvedores.migrate.info/2017/03/criacao-e-personalizacao-de-white-label/ · eNotas: https://enotas.com.br/precos/
- Nuvem Fiscal — comunicado de desativação: https://www.nuvemfiscal.com.br/suporte/ · fórum ACBr: https://www.projetoacbr.com.br/forum/topic/91922-comunicado-de-desativa%C3%A7%C3%A3o-do-servi%C3%A7o-nuvem-fiscal-22042026/
- Bibliotecas: https://github.com/nfephp-org/sped-nfe · https://acbr.sourceforge.io/ACBrLib/Download.html · PyNFe, node-sped-nfe, frones/nfe (GitHub)

**Não confirmado (lista consolidada):**
- Transcrição literal do art. 106 da Res. CGSN 140.
- UFs atuais com módulo MEI na NFF.
- Situação do Emissor Sebrae em 2026.
- Data final do adiamento das validações IBS/CBS.
- Aplicação da alíquota-teste ao Simples.
- Detalhamento de IPI/PIS/COFINS do Simples no leiaute.
- Se o leiaute continua "4.00" com a NT 2025.002.
- Contingência automática da Focus para NF-e.
- Se a homologação da Focus é gratuita.
- Se a Focus aceita número explícito.
- Excedente da NFE.io e da Webmania.
- Fatia de MEI/ME que vende mercadoria.

**Código consultado (repositório, somente leitura):** `apps/api/pkg/cert/`, `apps/api/internal/document/{xmldsig,signer,worker_pool,dps_builder,dps_types,pdf_comprovante}.go`, `apps/api/internal/nfse/{nacional_client,adapter,nota_repository,poller}.go`, `apps/api/internal/handler/nfse.go`, `apps/api/internal/webhook/`, `apps/api/internal/billing/`, `apps/api/internal/sandbox/`, `apps/api/pkg/storage/`, `apps/api/cmd/{server,worker}/main.go`, `supabase/migrations/*`, `apps/web/app/(dashboard)/notas/nova/page.tsx`, `apps/web/app/(landing)/comparativo/page.tsx`, `apps/web/lib/pricing/precos.ts`, `packages/sdk-{woo,node,python}/`, `NotaFacil-Specs-v1/{07-Pesquisa-Mercado,08-Decisoes-Fechadas}.md`.
