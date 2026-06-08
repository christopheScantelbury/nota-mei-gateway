# 08 — Decisões Fechadas

> Log oficial de decisões. Esta é a **fonte da verdade** quando houver dúvida durante implementação.
> Cada decisão tem: contexto · alternativas consideradas · escolha final · racional.

---

## D-01 · Preços ME/EPP

**Contexto:** plano de marketing pedia "âncora de preço ME/EPP" sem definir valores.

**Alternativas:**
- A) R$ 49 / 99 / 199 — agressivo, possível ceticismo de tomadores ME
- B) R$ 79 / 149 / 289 — abaixo do concorrente direto sem soar barato
- C) R$ 99 / 179 / 349 — paridade com mercado, sem ancoragem

**Escolha:** B — R$ 79 / R$ 149 / R$ 289

**Racional:** 42% abaixo do eNotas Básico (R$ 137), com API inclusa e multi-empresa nativo desde o entry. Margem operacional positiva mantida (custo unitário estimado ~R$ 0,12/nota). Detalhe em `07-Pesquisa-Mercado.md` §4.

**Status:** ✅ Fechado · seeds em `04-Modelos-Dados.md` migration 005

---

## D-02 · Copy do hero (variante A — controle)

**Contexto:** plano pedia "amplificar urgência" mas sem definir wording.

**Alternativas:**
- A) "Sua NFS-e Nacional pronta antes de setembro/2026" — propositiva
- B) "Antes de setembro, sua empresa precisa emitir NFS-e Nacional." — direta com urgência
- C) "Set/2026 vem aí. Você está pronto?" — pergunta retórica

**Escolha:** A como controle, B como variante para teste A/B futuro

**Racional:** A é menos ansiosa e mais convidativa para topo de funil (visitantes frios). B é mais agressiva e melhor para retargeting (visitantes que já entendem o contexto). Testar A/B no Sprint 3+ com feature flag `hero_copy_variant`.

**Status:** ✅ Fechado · copies em `03-Copies-Finais.md`

---

## D-03 · Régua de urgência ME/EPP

**Contexto:** plano sugeria T-90 → T-1, mas devs começam Sprint 3 em 01/07/2026 (Janela T-62).

**Alternativas:**
- A) Manter T-90 → impossível (já passou em 03/06)
- B) Ajustar para T-60 → T-1, mantendo a lógica de escalada
- C) Adicionar T-90 informativa em campanha separada futura

**Escolha:** B — disparos em T-60, T-30, T-15, T-7, T-3, T-1

**Racional:** preserva a lógica de escalada do plano com 6 disparos, primeira data viável (03/07) garante implementação tranquila no Sprint 3.

**Status:** ✅ Fechado · copies em `03-Copies-Finais.md` · datas em `02-Especificacoes-Tecnicas.md` HIST-6.3

---

## D-04 · Stack do blog

**Contexto:** plano pedia "manutenção de baixo custo no Vercel/Railway".

**Alternativas:**
- A) WordPress headless — overhead de infra + plugin updates
- B) Sanity/Contentful — custo mensal + lock-in
- C) MDX no monorepo Next.js — zero custo extra, versionado em git, deploy junto da app
- D) Ghost — custo de hospedagem + sem integração nativa com Next

**Escolha:** C — MDX no monorepo com engine `velite` (preferido) ou `contentlayer2`

**Racional:** zero custo adicional, posts versionados no git (review via PR), deploy atômico junto da app, performance estática perfeita (SSG no Vercel). Marketing escreve em Markdown.

**Trade-off:** marketing precisa abrir PR para publicar. Mitigação: doc simples + comando `npm run new:post slug-aqui` que scaffolda o frontmatter.

**Status:** ✅ Fechado · setup em `02-Especificacoes-Tecnicas.md` HIST-5.0

---

## D-05 · Sistema de feature flags

**Contexto:** plano não previa ferramenta de A/B; usuário rejeitou ferramentas externas pagas.

**Alternativas:**
- A) LaunchDarkly / Statsig — custo mensal e overhead
- B) PostHog cloud — gratuito até limite, mas adiciona vendor
- C) Sistema caseiro com hash determinístico em PostgreSQL — zero deps, controle total

**Escolha:** C — hash djb2 determinístico + tabela `feature_flags` + hook `useFeatureFlag`

**Racional:** suficiente para A/B simples (controle vs uma variante), zero custo, sem dep externa, fail-safe (DB off → control). Implementação em ~1 dia de dev. Não precisa de plataforma sofisticada nesse estágio.

**Limitação aceita:** estatística básica (sem teste de hipótese automático). Análise manual no Looker Studio comparando conversion rate por `variant` é suficiente para o volume atual.

**Status:** ✅ Fechado · spec em `02-Especificacoes-Tecnicas.md` HIST-7.4 + `04-Modelos-Dados.md` migration 001

---

## D-06 · Concorrentes do comparativo

**Contexto:** mercado tem 6+ players relevantes. Quais incluir na tabela e em quais formatos.

**Alternativas:**
- A) Tabela com 2 (NotaFácil vs Focus NFe apenas)
- B) Tabela com 4 principais (NotaFácil, Focus, eNotas, PlugNotas)
- C) Tabela com 6+ (todos os players)

**Escolha:** B — 4 colunas: NotaFácil, Focus NFe, eNotas, PlugNotas

**Racional:**
- 4 colunas couberam em mobile com scroll horizontal
- Capturam 90% do TAM de competição direta
- NFe.io fica fora porque é enterprise (raro overlap real com nosso público)
- Nuvem Fiscal, Notazz, Notaas ficam para watchlist e posts específicos vs

**Posts "vs" individuais:** Focus NFe (Sprint 3, piloto), eNotas (Sprint 4), PlugNotas (Sprint 4), Nuvem Fiscal (Sprint 5+).

**Status:** ✅ Fechado · dados em `data/competitors.json` (estrutura em `02-Especificacoes-Tecnicas.md` HIST-4.1)

---

## D-07 · Sandbox como CTA primário no /gateway

**Contexto:** atualmente o /gateway tem "Criar conta" como CTA primário e sandbox como secundário.

**Escolha:** **inverter** — sandbox vira primário, cadastro fica secundário

**Racional:** PLG dev manda — friction de zero é o que diferencia. O cadastro fica disponível mas não é a porta principal. Acompanhar funil: sandbox → conversão em conta paga.

**Status:** ✅ Fechado · spec em `02-Especificacoes-Tecnicas.md` HIST-3.3

---

## D-08 · Estrutura de informação do menu (Sandbox)

**Contexto:** sandbox precisa estar acessível sem ser difícil de achar.

**Alternativas:**
- A) Item top-level no menu principal — viola hierarquia (sandbox é parte do Gateway)
- B) Submenu dentro de "Gateway API" — mantém hierarquia, exige hover/click
- C) Ambos via teste A/B

**Escolha:** B com possibilidade de C via feature flag `sandbox_in_main_nav`

**Racional:** mantém arquitetura limpa. Se telemetria do Sprint 1 mostrar que sandbox tem baixo descobrimento, ativar flag de teste A/B no Sprint 3+.

**Status:** ✅ Fechado · spec em `02-Especificacoes-Tecnicas.md` HIST-3.2

---

## D-09 · Não usar ferramenta de A/B test externa

**Contexto:** usuário explicitou: não quer ferramentas pagas para A/B.

**Escolha:** sistema caseiro de feature flags + custom dimensions GA4 + análise no Looker Studio

**Racional:** ver D-05. Análise estatística rodada manualmente no Looker comparando variantes por `experiment_id`.

**Status:** ✅ Fechado

---

## D-10 · Dados de comparativo em JSON estático vs banco

**Contexto:** tabela de comparativo muda raramente (mensal). Onde guardar?

**Alternativas:**
- A) Banco (PostgreSQL) — versionável via migration, mas exige UI admin
- B) JSON estático em `data/competitors.json` — versionável via git, sem UI admin necessária

**Escolha:** B — JSON estático

**Racional:** mudanças no comparativo são raras e exigem revisão (review via PR). Não justifica UI admin no curto prazo. Se virar pain point depois, migra para banco.

**Status:** ✅ Fechado · arquivo `data/competitors.json` com schema em `02-Especificacoes-Tecnicas.md` HIST-4.1

---

## D-11 · Não criar issues no GitHub

**Contexto:** usuário pediu inicialmente issues no GitHub, depois rejeitou.

**Escolha:** entregar tudo como Markdown organizado em pasta. Sem automação de criação de issues.

**Racional:** time vai trabalhar diretamente a partir dos documentos. Se quiser materializar como issues depois, o backlog está formatado de forma 1:1 (cada HIST-X.Y já tem título, descrição, AC, estimativa).

**Status:** ✅ Fechado · entregue este pacote em `/mnt/user-data/outputs/`

---

## D-12 · Sem kickoff — pacote autocontido

**Contexto:** usuário explicitou: "tudo já analisado e estruturado para os devs fazerem".

**Escolha:** pacote contém todas as decisões pré-tomadas, copies prontos, schemas finais, contratos de componentes. Devs implementam sem retornar para esclarecimentos.

**Racional:** velocidade de execução é prioridade dada a janela Set/2026. Decisões abertas viram bloqueios. Esta abordagem assume que o analista (eu) carrega o risco das decisões — se algo precisar revisar, é mais barato refazer do que ficar perguntando.

**Status:** ✅ Fechado · este pacote

---

## D-13 · Vigência de timezone para o countdown

**Contexto:** a NFS-e Nacional vira obrigatória em "01/09/2026". Que timezone usar?

**Escolha:** `2026-09-01T00:00:00-03:00` (Brasília, UTC-3)

**Racional:** Receita Federal opera em horário oficial de Brasília. Usuário em qualquer timezone ainda terá o countdown referência ao momento de mudança regulatória.

**Status:** ✅ Fechado · constante em `lib/dates/countdown.ts`

---

## D-14 · Cookie de dismiss do top bar

**Contexto:** quanto tempo o dismiss da top bar persiste?

**Alternativas:**
- A) Sessão (sumida ao fechar aba)
- B) 24 horas
- C) 7 dias
- D) Para sempre

**Escolha:** C — 7 dias

**Racional:** dismiss curto demais (A, B) reposiciona como banner irritante. Dismiss para sempre (D) elimina a urgência de quem fechou cedo e depois quer revisitar. 7 dias dá descanso sem perder a janela de Set/2026.

**Cookie:** `nf_topbar_dismissed_v1` (`v1` permite invalidar todos via mudança de versão se mudar conteúdo significativamente).

**Status:** ✅ Fechado

---

## D-15 · Modo "obrigatório vigente" automático

**Contexto:** após 01/09/2026, a mensagem de urgência precisa mudar de "vai virar obrigatório" para "já é obrigatório".

**Escolha:** todos os componentes que mostram urgência verificam `new Date() >= VIGENCIA` e trocam a copy automaticamente. Sem deploy manual.

**Racional:** elimina risco de esquecer de atualizar copies em 01/09. Componentes afetados: `UrgencyTopBar`, `CountdownSet2026`, banners contextuais.

**Status:** ✅ Fechado · implementação em `02-Especificacoes-Tecnicas.md` HIST-1.1 e HIST-1.3

---

## D-16 · Idempotência dos eventos Brevo

**Contexto:** worker pode tentar enviar mesmo evento 2x (race condition, retry mal calibrado).

**Escolha:** chave de idempotência baseada em `{email}:{event_name}:{minute_timestamp}` + constraint UNIQUE no banco. Tentativa duplicada falha silenciosamente no `ON CONFLICT DO NOTHING`.

**Racional:** Brevo cobra por contato/evento; envios duplicados poluem dashboards de open/click. O minuto como granularidade evita enviar 2x o mesmo evento por bug, mas permite re-enviar em situação legítima (1 hora depois).

**Status:** ✅ Fechado · spec em `02-Especificacoes-Tecnicas.md` HIST-6.1 + migration 002

---

## D-17 · "Eventos first_*" só uma vez

**Contexto:** queremos disparar campanha "primeira nota autorizada" só na primeira vez, não a cada nota.

**Escolha:** materializar flag em `users.first_nfse_authorized_at`. Antes de enfileirar evento Brevo, verificar `WHERE first_nfse_authorized_at IS NULL`.

**Racional:** evita lookup pesado em tabela de notas. Update idempotente com `WHERE ... IS NULL` garante set-once.

**Status:** ✅ Fechado · migration 006

---

## D-18 · Captura de UTMs persistente

**Contexto:** atribuir conversão ao primeiro toque exige guardar UTMs do primeiro acesso, não só da sessão atual.

**Escolha:** cookie `nf_first_touch` (30 dias) capturando UTMs + referrer + landing page no primeiro acesso. No signup, copiar do cookie para colunas `first_utm_*` no user.

**Racional:** janela de 30 dias cobre 95% das jornadas de B2B SaaS. Persistir no banco do usuário libera análise pós-30d.

**Status:** ✅ Fechado · migration 007 + hook `useFirstTouchAttribution`

---

## Decisões em aberto (P2, fora do escopo Set/2026)

Estas decisões **não precisam ser tomadas agora**, mas ficam registradas:

- **D-FUT-1:** Plataforma de A/B test profissional (quando volume > 50k sessions/mês justificar)
- **D-FUT-2:** Migração de comparativo para banco com UI admin (quando atualizações forem semanais)
- **D-FUT-3:** App mobile (atualmente PWA cumpre o papel para MEI)
- **D-FUT-4:** Suporte a NFC-e/NF-e (decisão para 2027)
- **D-FUT-5:** Internacionalização do produto (não no roadmap atual)

---

## Como propor mudança nas decisões

Se algo precisar revisar em produção:

1. Abrir PR alterando este documento
2. Adicionar nova entrada **abaixo** (não editar histórico) com novo ID
3. Marcar entrada anterior com `**Status:** ⚠️ Revisada — ver D-XX`
4. Documentar mudança no novo bloco com motivação

Preserva trilha de auditoria das decisões tomadas no marco Set/2026.
