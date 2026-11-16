/* 煎好日 service worker: offline shell + runtime caching */
var VERSION = 'jgd-v3';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/styles.css',
  'assets/lucide.min.js',
  'assets/three.min.js',
  'assets/crowd3d.js',
  'assets/food-01.jpg', 'assets/food-02.jpg', 'assets/food-03.jpg', 'assets/food-04.jpg',
  'assets/food-05.jpg', 'assets/food-06.jpg', 'assets/food-07.jpg', 'assets/food-09.jpg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* pages: network first so updates show immediately, fall back to cache offline */
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }

  /* same-origin assets, Google Fonts and the hero poster: stale-while-revalidate */
  var cacheable = url.origin === self.location.origin ||
    /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) ||
    url.hostname === 'i.postimg.cc';
  if (!cacheable) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
