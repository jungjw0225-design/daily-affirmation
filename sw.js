/* 매일 확언 — 오프라인 캐시 서비스워커 */
'use strict';

var CACHE = 'aff-cache-v2';
var CORE = ['./', './index.html', './icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 하나가 실패해도 나머지는 캐시되도록 개별 처리
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function putCache(req, res) {
  if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {});
  }
  return res;
}

/* 네트워크 우선 (앱 본체·문장/사진 목록): 새 버전이 첫 방문에 바로 반영.
   cache:'no-cache'로 브라우저 HTTP 캐시(GitHub Pages max-age 10분)를 우회해
   항상 서버에 최신 여부를 확인 (안 바뀌었으면 304로 가볍게 끝남).
   네트워크가 느리면 2.5초 후 캐시로 먼저 열고, 응답은 다음을 위해 캐시에 저장 */
function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      caches.match(req).then(function (cached) {
        if (!settled && cached) { settled = true; resolve(cached); }
      });
    }, 2500);
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      putCache(req, res);
      clearTimeout(timer);
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(req).then(function (cached) {
        if (!settled) { settled = true; resolve(cached || Response.error()); }
      });
    });
  });
}

/* 캐시 우선 + 백그라운드 갱신 (사진·폰트 등 무거운 리소스) */
function cacheFirst(req) {
  return caches.match(req).then(function (cached) {
    var net = fetch(req).then(function (res) { return putCache(req, res); })
      .catch(function () { return cached || Response.error(); });
    return cached || net;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var path = '';
  try { path = new URL(req.url).pathname; } catch (err) {}
  var fresh = req.mode === 'navigate' || /\.(html|json)$/.test(path) || path.slice(-1) === '/';
  e.respondWith(fresh ? networkFirst(req) : cacheFirst(req));
});
