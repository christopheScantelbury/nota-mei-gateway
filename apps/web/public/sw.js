/* NotaFácil PWA Service Worker
 * Estratégia:
 *  - Cache "offline-first" para shell estático (rotas e assets)
 *  - Network-first para HTML autenticado (dashboard) — sempre fresco
 *  - Stale-while-revalidate para JS/CSS/imagens do _next/static
 *  - Página offline.html como fallback quando rede falhar
 *
 * IMPORTANTE: bumpe CACHE_VERSION a cada deploy importante para
 * forçar re-cache. O install prompt componente registra com
 * { updateViaCache: 'none' } para nunca cachear o próprio sw.js.
 */

const CACHE_VERSION = 'v1.0.1-portal';
const STATIC_CACHE  = `notafacil-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notafacil-runtime-${CACHE_VERSION}`;
const OFFLINE_URL   = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/mei',
  '/me',
  '/gateway',
  '/precos',
  '/blog',
  '/offline.html',
  '/manifest.json',
  '/brand/notafacil-icon.svg',
  '/brand/notafacil-logo.svg',
];

// ── Install ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll é tudo-ou-nada; usar add individual permite falhar parcialmente
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] precache miss:', url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ───────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Só processa GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não interfere em chamadas pra a API (Bearer auth, sempre fresco)
  if (url.hostname.includes('api.emitirnotafacil.com.br')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Páginas autenticadas — network first, cache só como fallback
  const isAuthArea =
    url.pathname.startsWith('/notas') ||
    url.pathname.startsWith('/billing') ||
    url.pathname.startsWith('/configuracoes') ||
    url.pathname.startsWith('/api-keys') ||
    url.pathname.startsWith('/webhooks') ||
    url.pathname.startsWith('/templates') ||
    url.pathname.startsWith('/recorrencias') ||
    url.pathname.startsWith('/clientes') ||
    url.pathname.startsWith('/links') ||
    url.pathname.startsWith('/home') ||
    url.pathname.startsWith('/emitir');
  if (isAuthArea) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets imutáveis do Next.js (têm hash no nome) — cache-first é seguro.
  // _next/static usa stale-while-revalidate. Outros assets também.
  // IMPORTANTE: chunks JS (page-XXX.js, layout-XXX.js etc.) NÃO usam cache —
  // sempre buscar fresco, senão usuários ficam vendo UI antiga após deploy.
  if (
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/logos/') ||
    /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // Bundles JS/CSS do Next.js — network-first pra garantir UI sempre fresca
  if (
    url.pathname.startsWith('/_next/') ||
    /\.(js|css)$/.test(url.pathname)
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Documentos HTML públicos — network first com fallback offline
  if (request.destination === 'document') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

// ── Estratégias ─────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    return fresh;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const fresh = await fetch(request);
    // Só cacheia 200
    if (fresh.ok) {
      const clone = fresh.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchAndUpdate = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchAndUpdate;
}
