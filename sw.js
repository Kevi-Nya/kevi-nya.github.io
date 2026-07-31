/**
 * kevi_nya 数字花园 — Service Worker
 * 自动版本化缓存 + 部署即更新
 */
var CACHE_VERSION = '1';  // ← 每次部署手动 +1
var CACHE_NAME = 'kevi-garden-v' + CACHE_VERSION;

// 需要预缓存的关键资源（首次安装后离线可用）
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/data.json',
  '/manifest.json',
  '/favicon.png',
  '/pics/avatar.webp',
  '/pics/avatar.avif',
  '/pics/og-image.jpg',
  '/pics/clock-frame.png',
  '/pics/clock-frame@2x.png',
  '/pics/SH.JPG',
  '/pics/icons/icon-192.png',
  '/pics/icons/icon-512.png'
];

// ===== install: 预缓存关键资源 =====
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting(); // 立即激活，不等待旧 SW 释放
    })
  );
});

// ===== activate: 清除旧版本缓存 =====
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // 删除旧版本
          }
        })
      );
    }).then(function () {
      return self.clients.claim(); // 立即接管所有页面
    })
  );
});

// ===== fetch: 缓存优先 + 网络回退 + 自动更新 =====
self.addEventListener('fetch', function (event) {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 chrome-extension 和非 http(s) 请求
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      // 并发请求网络和读取缓存
      var fetched = fetch(event.request).then(function (response) {
        // 网络成功 → 更新缓存（静默写入，不阻塞响应）
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // 网络失败 → 返回缓存（如有）
        return cached || new Response('Offline', { status: 503 });
      });

      // 优先返回缓存（如有），否则等待网络
      return cached || fetched;
    })
  );
});
