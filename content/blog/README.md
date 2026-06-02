# Blog NotaFácil — posts MDX

Pasta destino dos posts MDX (HIST-5.0). Cada post `.mdx` aqui é lido pela
infraestrutura em `apps/web/lib/blog/` e renderizado em `/blog/[slug]`.

## Frontmatter exigido

```yaml
---
title: "Título — até 60 caracteres"
description: "Meta description — até 160 caracteres"
slug: titulo-do-post
date: 2026-07-01
author: NotaFácil
tags: [comparativo, nfse-nacional, focus-nfe]
coverImage: /blog/cover.png
---
```

## Componentes MDX disponíveis

Importáveis sem `import` no `.mdx`:

- `<Callout type="info|warn|success|danger" title="">` — bloco de destaque
- `<CTABanner title="" primaryCta={{...}}>` — banner de conversão
- `<MigrationCTA from="Focus NFe" />` — CTA específico de migração
- `<VsHero competitor="focus_nfe" />` — hero para posts "vs concorrente"
- `<CompetitorTable variant="full|summary" />` — tabela comparativa

## Como publicar

1. Criar arquivo `meu-post.mdx` nesta pasta
2. Adicionar entry em `apps/web/lib/blog/manifest.ts`
3. Push em `main` → Vercel build estático

## Engine

A renderização usa `next-mdx-remote` (instalação sob demanda quando primeiro
post MDX for criado — `npm i next-mdx-remote`). Até lá, posts continuam em
`apps/web/app/(landing)/blog/<slug>/page.tsx` como TSX.
