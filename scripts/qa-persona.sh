#!/usr/bin/env bash
# qa-persona.sh — troca a persona da conta de teste e devolve magic link pronto.
#
# Uso:
#   ./scripts/qa-persona.sh mei         # MEI Simples Nacional MEI (default)
#   ./scripts/qa-persona.sh me-sn       # ME Simples Nacional
#   ./scripts/qa-persona.sh me-lp       # ME Lucro Presumido
#   ./scripts/qa-persona.sh epp-lr      # EPP Lucro Real
#
# Pré-requisito: variáveis de ambiente carregadas de ACESSOS.local.md:
#   SUPABASE_SERVICE_ROLE_KEY
#   DEV_ADMIN_TOKEN
#
# Ou definir aqui (cuidado: não commitar):
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
DEV_ADMIN_TOKEN="${DEV_ADMIN_TOKEN:-}"

# Conta Alef (CNPJ 34488964000142) — única com cert A1 uploadado em prod.
EMPRESA_ID="5a7353a4-add4-48a0-9843-718eb4f72680"
EMAIL="christophescantelbury@gmail.com"
SUPABASE_REF="pzjvgtwnstfyangfwdom"
APP_URL="https://www.emitirnotafacil.com.br"

set -euo pipefail

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$DEV_ADMIN_TOKEN" ]; then
  echo "❌ Faltam credenciais. Exporte SUPABASE_SERVICE_ROLE_KEY e DEV_ADMIN_TOKEN" >&2
  echo "   (valores em ACESSOS.local.md seções 2 e 9-ter)" >&2
  exit 1
fi

PERSONA="${1:-mei}"
case "$PERSONA" in
  mei)    TIPO="MEI"; REGIME="SIMPLES_MEI";       LABEL="MEI Simples Nacional MEI" ;;
  me-sn)  TIPO="ME";  REGIME="SIMPLES_NACIONAL";  LABEL="ME Simples Nacional"      ;;
  me-lp)  TIPO="ME";  REGIME="LUCRO_PRESUMIDO";   LABEL="ME Lucro Presumido"       ;;
  epp-lr) TIPO="EPP"; REGIME="LUCRO_REAL";        LABEL="EPP Lucro Real"           ;;
  *)
    echo "❌ Persona inválida: '$PERSONA'" >&2
    echo "   Use: mei | me-sn | me-lp | epp-lr" >&2
    exit 1
    ;;
esac

echo "🔀 Trocando empresa $EMPRESA_ID pra $LABEL ($TIPO / $REGIME)…"
PATCH_RESP=$(curl -s -X PATCH \
  "https://$SUPABASE_REF.supabase.co/rest/v1/empresas?id=eq.$EMPRESA_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"tipo\":\"$TIPO\",\"regime_tributario\":\"$REGIME\"}")

CONFIRMED=$(echo "$PATCH_RESP" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  try { const r=JSON.parse(d); if(Array.isArray(r)&&r[0]) console.log(r[0].tipo+'/'+r[0].regime_tributario); else console.log('ERR:'+d.slice(0,200)) } catch(e){ console.log('ERR:'+d.slice(0,200)) }
})")
echo "   ✅ DB agora: $CONFIRMED"
echo

echo "🔗 Gerando magic link admin pra $EMAIL…"
ML_RESP=$(curl -s -X POST "$APP_URL/api/dev/magic-link" \
  -H "Authorization: Bearer $DEV_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")

ACTION_LINK=$(echo "$ML_RESP" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  const r=JSON.parse(d); if(r.action_link) console.log(r.action_link); else { console.error('ERR:'+d); process.exit(1) }
})")

echo
echo "═══════════════════════════════════════════════════════════════════"
echo " Persona ativa: $LABEL"
echo " Cole o link abaixo em JANELA ANÔNIMA (one-shot, expira em ~1h):"
echo "═══════════════════════════════════════════════════════════════════"
echo
echo "$ACTION_LINK"
echo
echo "📝 Após o QA, rode novamente: ./scripts/qa-persona.sh mei"
echo "   pra voltar empresa pro estado default (NÃO esquecer)."
