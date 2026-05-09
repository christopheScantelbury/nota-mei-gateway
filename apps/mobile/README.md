# NotaFácil Mobile (Capacitor)

> Wrapper híbrido que empacota o Next.js (`apps/web/`) como app nativo
> Android e iOS, publicado na **Google Play Store** e **Apple App Store**.

---

## Estado atual

✅ **Scaffolding criado** — `package.json`, `capacitor.config.ts` prontos.
⏳ **Falta:** instalar deps, gerar projeto Android (Java/Kotlin), gerar projeto iOS (Mac+Xcode), build inicial e submissão para as lojas.

---

## Pré-requisitos

### Android (já dá pra rodar local)
- Node 20+
- JDK 17 (`brew install openjdk@17` no macOS / `winget install Microsoft.OpenJDK.17` no Windows)
- Android Studio Hedgehog ou superior (instala SDK + emulator)
- Conta Google Play Console — **R$ 25 (US$ 25) taxa única vitalícia**

### iOS (precisa de Mac)
- macOS 14+ rodando em Mac com chip Apple Silicon (M1+) ou Intel
- Xcode 15+ (download grátis na App Store, ~10 GB)
- CocoaPods (`sudo gem install cocoapods`)
- Conta Apple Developer Program — **US$ 99/ano**
- iPhone físico para testes (emulador serve para a maior parte, mas Apple
  exige testar push notifications em device real antes de publicar)

> **Sem Mac?** Existe a opção do GitHub Actions com `runs-on: macos-latest`
> rodando o build iOS na nuvem. Os minutos macOS contam 10× mais
> contra a quota grátis (2.000 min/mês para repos privados → equivale
> a ~200 min macOS). Suficiente para 5-10 builds iOS por mês.

---

## Setup inicial

```bash
cd apps/mobile

# 1. Instalar deps
npm install

# 2. Build estático do Next.js para www/
#    (precisa adaptar apps/web/next.config.mjs com output: 'export')
npm run build:web

# 3. Inicializar Capacitor (cria pasta android/ e ios/ pela primeira vez)
npx cap add android
npx cap add ios       # só funciona em Mac

# 4. Sincronizar build com plataformas nativas
npm run sync

# 5. Abrir no Android Studio
npm run android:open

# 6. Abrir no Xcode (Mac apenas)
npm run ios:open
```

---

## Adaptações necessárias em `apps/web/`

Para o Next.js gerar build 100% estático compatível com Capacitor:

### `apps/web/next.config.mjs`
Adicionar:

```js
{
  output: 'export',           // Gera HTML estático em out/
  images: { unoptimized: true }, // Capacitor não suporta /_next/image
  trailingSlash: true,        // Capacitor mapeia melhor com trailing slash
}
```

⚠️ **Implicações:**
- Server Components que usam APIs server-only (cookies, headers,
  middleware) **não funcionam** — precisa adaptar.
- Rotas dinâmicas precisam de `generateStaticParams`.
- O `app/api/*` (route handlers) **não funciona** — todas as chamadas
  passam a apontar para `https://api.emitirnotafacil.com.br` direto.
- Auth via cookies precisa virar token em `localStorage` ou usar
  `@capacitor/preferences` (storage seguro nativo).

Recomendação: criar um **build alternativo** especificamente para mobile
(`next build:mobile`) que aplica esses overrides — assim o web continua
com SSR para SEO.

### Estratégia recomendada — fork de config

```js
// apps/web/next.config.mobile.mjs
import baseConfig from './next.config.mjs'
export default {
  ...baseConfig,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // remove redirects (não funcionam em estático)
  redirects: undefined,
}
```

E rodar com `NEXT_CONFIG_PATH=next.config.mobile.mjs next build`.

---

## Plugins ativos (no `package.json`)

| Plugin | Uso no NotaFácil |
|---|---|
| `@capacitor/camera` | Tirar foto de contrato/recibo (futuro: OCR via IA) |
| `@capacitor/push-notifications` | FCM Android + APNs iOS para avisar nota autorizada/rejeitada |
| `@capacitor/preferences` | Storage seguro do JWT Supabase (substitui localStorage) |
| `@capacitor/share` | Compartilhar PDF da nota emitida via WhatsApp/e-mail |
| `@capacitor/browser` | Abrir links externos no SafariViewController/Custom Tabs |
| `@capacitor/splash-screen` | Splash inicial branded |
| `@capacitor/status-bar` | Cor da status bar (theme-aware) |
| `@capacitor/haptics` | Feedback tátil em ações importantes |
| `@capacitor/app` | Deep links + back button Android |

---

## Roteiro de submissão

### Google Play Store (Android, ~3-7 dias para aprovação)
1. Criar conta no [Play Console](https://play.google.com/console) — taxa US$ 25
2. Criar app, preencher ficha (descrição, screenshots, política privacidade)
3. Upload do `.aab` gerado em `android/app/build/outputs/bundle/release/`
4. Configurar assinatura (Play App Signing — Google gerencia chave)
5. Submeter para revisão

### Apple App Store (iOS, ~24-48h para aprovação na maioria dos casos)
1. Criar conta [Apple Developer](https://developer.apple.com/programs/) — US$ 99/ano
2. App Store Connect → criar app, ficha, screenshots
3. No Xcode: **Product → Archive** e upload via Organizer
4. TestFlight para beta (até 100 testers internos sem revisão)
5. Submeter para revisão pública (App Review Guidelines aplicam)

### Política de privacidade (obrigatório nas duas lojas)
Criar `/politica-app` no apps/web/ ou usar `/privacidade` existente
desde que mencione coleta de dados específica do app (câmera, push, etc).

---

## Custo total primeiro ano

| Item | Valor |
|---|---|
| Apple Developer Program | US$ 99/ano (~R$ 500) |
| Google Play Console | US$ 25 vitalício (~R$ 125) |
| Mac (se não tiver) | R$ 6.000-10.000 |
| Xcode + Android Studio | grátis |
| **Total mínimo (com Mac)** | **~R$ 625/ano** |

---

## Status: backlog

Esta é uma atividade documentada (MOB-02). Para iniciar:
1. Definir quem tem Mac/Xcode no time
2. Criar contas Apple Developer + Google Play Console
3. Adaptar Next.js para output estático (1-2 dias)
4. `npm install && npx cap add android && npx cap add ios` (1 dia)
5. Customizar splash screens e ícones (1 dia)
6. Builds iniciais e testes em devices reais (2-3 dias)
7. Submissão para as lojas (1 dia + tempo de revisão)

**Estimativa total: 2-4 semanas de trabalho efetivo**, dependendo do
tempo de revisão da Apple e ajustes solicitados pela App Review.
