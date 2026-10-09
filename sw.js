/* LRPS Dope Simulator — service worker.
 *
 * The whole app is ~1 MB of static files and makes no network request after
 * load, so it can run with no signal at all once installed:
 *   - install:   precache every file the page needs (list written by scripts/stage.mjs)
 *   - navigation: network first (3 s budget), cached page when offline or slow
 *   - everything else: cache first — css/js URLs carry ?v=<commit>, so a new
 *     release is a new URL and can never be served stale
 *   - activate:  drop caches from older releases
 *
 * Served raw (no staging) the precache list is empty and VERSION is 'dev':
 * it still works offline after the first visit, from the runtime cache.
 */
'use strict';

const VERSION = /*@version*/'dev'/*@end*/;
const PRECACHE = /*@precache*/[]/*@end*/;
const CACHE = 'lrps-' + VERSION;
const PAGE = new URL('./', self.registration.scope).href;
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' skips the HTTP cache, so a release never precaches the previous one's files
    await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lrps-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'version' && event.source) event.source.postMessage({ type: 'version', version: VERSION });
});

// A worker writes only to its own cache, and only while that cache exists: once a newer
// release has activated and deleted it, a request still in flight through this (old)
// worker must not resurrect it. Reads fall back to any cache.
async function ownCache() {
  return (await caches.has(CACHE)) ? caches.open(CACHE) : null;
}

function isPage(url) {
  return url.origin === self.location.origin && (url.href.split(/[?#]/)[0] === PAGE || url.pathname.endsWith('/index.html'));
}

async function fromNetworkFirst(request) {
  const cache = await ownCache();
  const network = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (res.ok && cache) cache.put(PAGE, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (e) { /* offline: fall through to the cache */ }
  const cached = (cache && await cache.match(PAGE)) || await caches.match(PAGE);
  if (cached) return cached;
  return network; // nothing cached yet: wait for the network after all
}

async function fromCacheFirst(request) {
  const cache = await ownCache();
  const cached = (cache && await cache.match(request)) || await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic' && cache) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' || isPage(url)) event.respondWith(fromNetworkFirst(request));
  else event.respondWith(fromCacheFirst(request));
});
