const CACHE_NAME = "art-stall-buddy-v1";
const CORE_ASSETS = ["/", "/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png"];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>离线 - 摊玩</title>
  <style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #F7F9F6;
    color: #2C3E30;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 1.5rem;
    text-align: center;
  }
  h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
  p { font-size: 0.875rem; color: #8B9D8E; margin: 0; }
  </style>
</head>
<body>
  <div>
  <h1>当前无法连接网络</h1>
  <p>请检查网络后重试，或使用已缓存的页面。</p>
  </div>
  </body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/sw.js") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) return fallback;

          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }),
  );
});
