/* 아이들 식단표 서비스 워커
 * - 앱 껍데기(HTML/CSS/JS/아이콘): 캐시 우선 + 뒤에서 갱신
 * - data/menus.json: 네트워크 우선(최신 식단이 먼저) + 실패하면 캐시
 * 모든 경로는 상대경로라 https://<user>.github.io/<repo>/ 어디에 올려도 동작합니다.
 */
const VERSION = 'v3';
const SHELL_CACHE = 'kids-meal-shell-' + VERSION;
const DATA_CACHE = 'kids-meal-data-' + VERSION;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-64.png'
];

const DATA_URL = new URL('./data/menus.json', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' 로 설치 시점에 HTTP 캐시를 건너뛰고 진짜 최신 파일을 받아 둔다.
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.all(SHELL_FILES.map((file) =>
        fetch(new Request(file, { cache: 'reload' }))
          .then((res) => {
            if (res && res.ok) return cache.put(file, res);
            throw new Error('precache failed: ' + file);
          })
      )))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isDataRequest(url) {
  return url.origin === self.location.origin && url.pathname.endsWith('/data/menus.json');
}

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      // 쿼리스트링(?t=...)을 뺀 주소로 저장해 다음 오프라인에서도 찾을 수 있게 한다.
      await cache.put(DATA_URL, fresh.clone());
      return fresh;
    }
    throw new Error('bad response');
  } catch (err) {
    const cached = await cache.match(DATA_URL);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-From-Cache', 'true');
      const body = await cached.blob();
      return new Response(body, { status: 200, headers });
    }
    return new Response(JSON.stringify({ schemaVersion: 1, days: [] }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

async function cacheFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    // 뒤에서 조용히 최신본으로 갱신
    fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch (err) {
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isDataRequest(url)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  event.respondWith(cacheFirstShell(request));
});
