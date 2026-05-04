#!/usr/bin/env bash
# S3 Provision Script — Nota MEI Gateway (STOR-01)
#
# Cria o bucket S3 para arquivamento fiscal e configura:
#   1. Bloqueio de acesso público
#   2. Criptografia SSE-S3 por padrão
#   3. Lifecycle policy (5 anos)
#   4. Política IAM S3 para o user nota-mei-gateway-api
#
# PRÉ-REQUISITO: credenciais de admin AWS configuradas (aws configure)
#   ou via env vars: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
#
# COMO RODAR:
#   bash _secrets_setup/s3_provision.sh

set -euo pipefail

BUCKET="nota-mei-gateway-fiscal"
REGION="sa-east-1"
ACCOUNT_ID="394072826336"
IAM_USER="nota-mei-gateway-api"
LIFECYCLE_FILE="docs/s3-lifecycle.json"

echo ""
echo "🪣  Provisionando S3 para Nota MEI Gateway (STOR-01)"
echo "======================================================"

# ── 1. Criar bucket ─────────────────────────────────────────────────────────
echo ""
echo "1️⃣  Criando bucket: s3://${BUCKET} (${REGION})..."

if aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "   ⚠️  Bucket já existe — pulando criação."
else
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
  echo "   ✅ Bucket criado."
fi

# ── 2. Bloquear acesso público ────────────────────────────────────────────────
echo ""
echo "2️⃣  Configurando Block Public Access..."
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "   ✅ Acesso público bloqueado."

# ── 3. Criptografia SSE-S3 por padrão ────────────────────────────────────────
echo ""
echo "3️⃣  Habilitando criptografia SSE-S3 por padrão..."
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'
echo "   ✅ Criptografia SSE-S3 habilitada."

# ── 4. Lifecycle policy (5 anos — STOR-01) ───────────────────────────────────
echo ""
echo "4️⃣  Aplicando lifecycle policy (5 anos)..."

# Remove campos _comment que não são válidos no AWS CLI
LIFECYCLE_CLEAN=$(cat "${LIFECYCLE_FILE}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for rule in data.get('Rules', []):
    for t in rule.get('Transitions', []):
        t.pop('_comment', None)
    rule.get('Expiration', {}).pop('_comment', None)
    rule.get('NoncurrentVersionExpiration', {}).pop('_comment', None)
print(json.dumps(data))
")

aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET}" \
  --lifecycle-configuration "${LIFECYCLE_CLEAN}"
echo "   ✅ Lifecycle policy aplicada:"
echo "      Standard (0-30d) → Standard-IA (30d-1a) → Glacier IR (1-3a) → Deep Archive (3-5a) → Expire (5a)"

# ── 5. Política IAM S3 para o user nota-mei-gateway-api ──────────────────────
echo ""
echo "5️⃣  Adicionando permissões S3 ao IAM user ${IAM_USER}..."

CURRENT_POLICY=$(aws iam get-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "nota-mei-gateway-policy" \
  --query 'PolicyDocument' \
  --output json 2>/dev/null | python3 -c "import sys,json,urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))" 2>/dev/null || echo "{}")

# Build new policy with S3 added
NEW_POLICY=$(python3 -c "
import json

current = ${CURRENT_POLICY}
if not current or 'Statement' not in current:
    current = {'Version': '2012-10-17', 'Statement': []}

# Remove existing S3 statement if present
current['Statement'] = [s for s in current['Statement'] if s.get('Sid') != 'S3FiscalDocs']

# Add S3 statement
current['Statement'].append({
    'Sid': 'S3FiscalDocs',
    'Effect': 'Allow',
    'Action': [
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject',
        's3:ListBucket'
    ],
    'Resource': [
        'arn:aws:s3:::${BUCKET}',
        'arn:aws:s3:::${BUCKET}/*'
    ]
})

print(json.dumps(current))
")

aws iam put-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "nota-mei-gateway-policy" \
  --policy-document "${NEW_POLICY}"

echo "   ✅ Permissões S3 adicionadas ao user ${IAM_USER}."
echo "      Actions: s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket"
echo "      Resource: arn:aws:s3:::${BUCKET}/*"

# ── 6. Verificação final ──────────────────────────────────────────────────────
echo ""
echo "6️⃣  Verificação final..."
aws s3api get-bucket-encryption --bucket "${BUCKET}" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text
aws s3api get-bucket-lifecycle-configuration --bucket "${BUCKET}" --query 'Rules[0].Status' --output text
echo ""
echo "======================================================"
echo "✅  S3 provisionado com sucesso!"
echo ""
echo "📋 Variável já configurada no Railway (via GraphQL API):"
echo "   S3_BUCKET_NOTAS=nota-mei-gateway-fiscal"
echo ""
echo "💡 Próximo passo: fazer redeploy do serviço API no Railway"
echo "   para que a variável S3_BUCKET_NOTAS seja lida."
