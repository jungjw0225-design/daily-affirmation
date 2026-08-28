/* 매일 확언 — 오프라인 캐시 서비스워커 */
'use strict';

var CACHE = 'aff-cache-v1';
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

/* cache-first + 백그라운드 네트워크 갱신 (stale-while-revalidate)
   Google Fonts 포함 모든 GET에 동일 적용 — 네트워크 실패는 조용히 무시 */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        // 오프라인: 캐시가 있으면 그걸, 없으면 네트워크 오류 응답 (폰트는 시스템 폰트로 폴백됨)
        return cached || Response.error();
      });
      return cached || net;
    })
  );
});
