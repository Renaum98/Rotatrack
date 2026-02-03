const CACHE_NAME = "rotatrack-v10";
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
  "./assets/rota_logo-192.png",
  "./assets/rota_logo-512.png",
];

// 1. INSTALAÇÃO (Salva os arquivos)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

// 2. ATIVAÇÃO (Limpa caches antigos se você mudar a versão)
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
});

// 3. INTERCEPTAR PEDIDOS (Serve o cache se estiver offline)
self.addEventListener("fetch", (event) => {
  // Ignora requisições do Firebase/Google (deixa a lib do Firebase tratar isso)
  if (
    event.request.url.includes("firestore") ||
    event.request.url.includes("googleapis")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se achou no cache, retorna. Se não, busca na rede.
      return response || fetch(event.request);
    }),
  );
});
