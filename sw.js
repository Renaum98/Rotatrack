const CACHE_NAME = "rotatrack-v4.1";
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
  // ASSUME O CONTROLE IMEDIATAMENTE: Faz a nova versão valer na mesma hora
  return self.clients.claim();
});

// 3. INTERCEPTAR PEDIDOS (ESTRATÉGIA: REDE PRIMEIRO, CACHE DEPOIS)
self.addEventListener("fetch", (event) => {
  // Ignora requisições do Firebase/Google
  if (
    event.request.url.includes("firestore") ||
    event.request.url.includes("googleapis")
  ) {
    return;
  }

  // Ignora requisições que não sejam GET (como POST do Firebase Auth, etc)
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    // 1º TENTA PEGAR DA INTERNET (Para ter a versão mais atualizada que você commitou)
    fetch(event.request)
      .then((networkResponse) => {
        // Se deu certo, atualiza o cache "silenciosamente" com o arquivo novo
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // 2º SE ESTIVER OFFLINE, PEGA DO CACHE (Para o PWA continuar funcionando sem internet)
        return caches.match(event.request);
      }),
  );
});
