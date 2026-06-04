#!/usr/bin/env bash
# Vercel ignoreCommand — decide se o build deve rodar ou ser skippado.
#
# Exit 0 → SKIP (Vercel não builda nem cobra build minutes)
# Exit 1 → BUILD
#
# Estratégia: só roda build quando o diff do último deploy toca arquivos
# que afetam o output da apps/web. Mudanças em docs/, memory/, migrations,
# apps/api/ (Go), CLAUDE.md → NÃO disparam build.
#
# Vercel define VERCEL_GIT_COMMIT_REF e disponibiliza `git diff HEAD^ HEAD`.
# Quando é o 1º commit do branch, git diff falha → buildamos por segurança.
set -e

# Sempre buildar se algum arquivo crítico mudou.
RELEVANT_PATHS=(
  "apps/web/"
  "packages/"
  "docs/openapi.yaml"
  "package.json"
  "package-lock.json"
  "turbo.json"
  "tsconfig.base.json"
)

# Diff do commit atual contra o anterior. Se falhar, builda (safe default).
if ! CHANGED=$(git diff --name-only HEAD^ HEAD 2>/dev/null); then
  echo "📦 Diff indisponível (primeiro commit do branch?) — buildando por segurança"
  exit 1
fi

if [ -z "$CHANGED" ]; then
  echo "🟢 Nenhuma mudança detectada — skip build"
  exit 0
fi

for path in "${RELEVANT_PATHS[@]}"; do
  if echo "$CHANGED" | grep -q "^$path"; then
    echo "📦 Build necessário — mudança em: $path"
    echo "$CHANGED" | grep "^$path" | head -5
    exit 1
  fi
done

echo "🟢 Skip build — nenhum arquivo relevante pra apps/web mudou"
echo "Arquivos do commit:"
echo "$CHANGED" | head -10
exit 0
