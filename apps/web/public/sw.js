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

const CACHE_VERSION = 'v1.0.0';
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
    url.pathname.startsWith('/recorrencias');
  if (isAuthArea) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets do Next.js — stale-while-revalidate (rápido + atualiza em background)
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/logos/') ||
    /\.(png|jpg|jpeg|webp|svg|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
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
