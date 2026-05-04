#!/usr/bin/env node
/**
 * AWS Provisioning Script — Nota MEI Gateway
 *
 * Cria automaticamente:
 *   1. KMS Customer Managed Key (CMK) em sa-east-1
 *   2. IAM User  nota-mei-api  com política mínima (KMS + Secrets Manager)
 *   3. Access Key para o IAM User
 *
 * PRÉ-REQUISITOS:
 *   1. Ter uma conta AWS (https://aws.amazon.com/free)
 *   2. Ter AWS CLI instalado: winget install Amazon.AWSCLI  (ou baixar em https://aws.amazon.com/cli)
 *   3. Configurar credenciais de admin:  aws configure
 *   4. Instalar deps:  npm install  (na raiz do projeto)
 *
 * COMO RODAR:
 *   node _secrets_setup/aws_provision.js
 *
 * RESULTADO:
 *   Imprime as variáveis prontas para copiar no Railway e no ACESSOS.local.md
 */

const { KMSClient, CreateKeyCommand, CreateAliasCommand } = require('@aws-sdk/client-kms');
const { IAMClient, CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand, PutUserPolicyCommand } = require('@aws-sdk/client-iam');

const REGION = 'sa-east-1';
const PROJECT = 'nota-mei-gateway';

async function main() {
  console.log('\n🔧 Provisionando infraestrutura AWS para Nota MEI Gateway...\n');

  const kms = new KMSClient({ region: REGION });
  const iam = new IAMClient({ region: REGION });

  // ── 1. Criar KMS Customer Managed Key ───────────────────────────────────────
  console.log('1️⃣  Criando KMS CMK em sa-east-1...');
  let kmsKeyId, kmsKeyArn;
  try {
    const kmsRes = await kms.send(new CreateKeyCommand({
      Description: `${PROJECT} — chave mestra para certificados A1`,
      KeyUsage: 'ENCRYPT_DECRYPT',
      Origin: 'AWS_KMS',
      Tags: [
        { TagKey: 'Project', TagValue: PROJECT },
        { TagKey: 'ManagedBy', TagValue: 'nota-mei-provisioning-script' },
      ],
    }));
    kmsKeyId = kmsRes.KeyMetadata.KeyId;
    kmsKeyArn = kmsRes.KeyMetadata.Arn;
    console.log(`   ✅ KMS Key criada: ${kmsKeyArn}`);

    // Alias para facilitar identificação
    await kms.send(new CreateAliasCommand({
      AliasName: `alias/${PROJECT}`,
      TargetKeyId: kmsKeyId,
    }));
    console.log(`   ✅ Alias criado: alias/${PROJECT}`);
  } catch (err) {
    if (err.name === 'AlreadyExistsException') {
      console.log('   ⚠️  Alias já existe — reusing existing key. Pegue o ARN em: AWS Console → KMS → Customer managed keys');
      process.exit(1);
    }
    throw err;
  }

  // ── 2. Criar IAM User ────────────────────────────────────────────────────────
  const username = `${PROJECT}-api`;
  console.log(`\n2️⃣  Criando IAM User: ${username}...`);

  try {
    await iam.send(new CreateUserCommand({
      UserName: username,
      Tags: [{ Key: 'Project', Value: PROJECT }],
    }));
    console.log(`   ✅ IAM User criado: ${username}`);
  } catch (err) {
    if (err.name === 'EntityAlreadyExists') {
      console.log(`   ⚠️  IAM User ${username} já existe — continuando...`);
    } else throw err;
  }

  // ── 3. Política mínima (KMS + Secrets Manager) ────────────────────────────────
  console.log('\n3️⃣  Anexando política inline ao IAM User...');

  // Precisamos do Account ID para montar os ARNs
  const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
  const sts = new STSClient({ region: REGION });
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  const accountId = identity.Account;
  console.log(`   Account ID: ${accountId}`);

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'KMSEncryptDecrypt',
        Effect: 'Allow',
        Action: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
        Resource: kmsKeyArn,
      },
      {
        Sid: 'SecretsManagerCerts',
        Effect: 'Allow',
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:PutSecretValue',
          'secretsmanager:CreateSecret',
          'secretsmanager:DescribeSecret',
          'secretsmanager:UpdateSecret',
        ],
        Resource: `arn:aws:secretsmanager:${REGION}:${accountId}:secret:nota-mei-gateway/*`,
      },
    ],
  };

  await iam.send(new PutUserPolicyCommand({
    UserName: username,
    PolicyName: `${PROJECT}-policy`,
    PolicyDocument: JSON.stringify(policy),
  }));
  console.log('   ✅ Política anexada');

  // ── 4. Criar Access Key ───────────────────────────────────────────────────────
  console.log('\n4️⃣  Criando Access Key...');
  const keyRes = await iam.send(new CreateAccessKeyCommand({ UserName: username }));
  const accessKeyId = keyRes.AccessKey.AccessKeyId;
  const secretAccessKey = keyRes.AccessKey.SecretAccessKey;
  console.log(`   ✅ Access Key criada: ${accessKeyId}`);

  // ── 5. Output ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('✅ AWS provisionado com sucesso! Copie as vars abaixo:\n');
  console.log(`AWS_REGION=${REGION}`);
  console.log(`AWS_KMS_KEY_ARN=${kmsKeyArn}`);
  console.log(`AWS_ACCESS_KEY_ID=${accessKeyId}`);
  console.log(`AWS_SECRET_ACCESS_KEY=${secretAccessKey}`);
  console.log('='.repeat(70));
  console.log('\n⚠️  IMPORTANTE: salve o AWS_SECRET_ACCESS_KEY agora — ele não aparece novamente!');
  console.log('\n📋 Próximos passos:');
  console.log('   1. Copie as vars acima para ACESSOS.local.md (seção AWS)');
  console.log('   2. Configure no Railway: railway variables set AWS_KMS_KEY_ARN=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...');
  console.log('   3. Configure no Railway (api-staging): mesmo comando com --service api-staging');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  if (err.name === 'CredentialsProviderError') {
    console.error('\n💡 Credenciais AWS não encontradas. Execute primeiro:');
    console.error('   aws configure  (informe Access Key ID, Secret, região sa-east-1)');
  }
  process.exit(1);
});
