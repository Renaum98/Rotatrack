const CACHE_NAME = "rotatrack-v4.5";
const urlsToCache = [
  "./",
  "./index.html",
  "./inicio.html",
  "./styles/components.css",
  "./styles/layout.css",
  "./styles/login.css",
  "./styles/pages.css",
  "./styles/reset.css",
  "./styles/variables.css",
  "./scripts/firebase-config.js",
  "./scripts/login.js",
  "./scripts/main.js",
  "./scripts/routes.js",
  "./scripts/state.js",
  "./scripts/storage.js",
  "./scripts/ui.js",
  "./scripts/utils.js",
  "./scripts/calendar.js",
  "./scripts/padronizador.js",
  "./assets/rota_logo-192.png",
  "./assets/rota_logo-512.png",
];

// Hosts de CDNs externas que devem ser cacheadas (offline-friendly)
const CDN_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "www.gstatic.com",
];

// 1. INSTALAÇÃO
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

// 2. ATIVAÇÃO
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  return self.clients.claim();
});

// 3. ESTRATÉGIAS:
//    - HTML/navegação: network-first (pega versão nova; cai pro cache offline)
//    - Estáticos locais e CDNs (CSS/JS/fontes/imagens): stale-while-revalidate
//    - Firebase/Firestore: passa direto (não intercepta)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora não-GET e Firestore/Firebase APIs dinâmicas
  if (req.method !== "GET") return;
  if (
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis.com") && !url.hostname.includes("fonts.googleapis.com")
  ) {
    return;
  }

  const isHTML =
    req.mode === "navigate" ||
    req.destination === "document" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  const isLocal = url.origin === self.location.origin;
  const isCDN = CDN_HOSTS.some((h) => url.hostname.endsWith(h));

  if (isLocal || isCDN) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      return res;
    })
    .catch(() => caches.match(req).then((r) => r || caches.match("./inicio.html")));
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
}
