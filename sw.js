// bumping this string is what forces every visitor's browser to notice
// sw.js changed, install the new worker, and (via the activate handler
// below) throw away every asset it cached under the old name — including
// the previously-cached index.html/app.js that kept serving stale code
// no matter how many times the underlying files were updated.
const CACHE_NAME = "hisab-khata-v19";
const CORE_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  // own JS: without these here, the cache-first fetch handler below never
  // has anything to serve offline for them (they were never in CORE_ASSETS
  // before, so cache.match always missed and fell through to a network
  // fetch that fails offline) — added so Hijri/calendar math (and the rest
  // of the app) genuinely keeps working with no connection, not just the
  // shell page.
  "./js/app/app.js",
  "./js/app/styles.js",
  "./js/app/admin.js",
  "./js/app/debts.js",
  "./js/app/tax.js",
  "./js/app/settings.js",
  "./js/app/calendar-tasks.js",
  "./js/app/reports-search.js",
  "./js/features/hijri-ummalqura.js",
  "./js/family/family-planning-core.js",
  "./js/features/khasra-khata.js",
  "./js/family/family-bazar.js",
  "./js/family/family-planning.js",
  "./js/family/family-bazar-core.js",
  "./js/services/firebase-init.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// OFFLINE: the whole app (our files, React and the Firebase scripts) must load
// with no internet once it has been opened online one time.
//  * our own files: served from the cache straight away (ignoring the ?v=
//    version suffix, which is what used to make every lookup miss), and
//    refreshed in the background while online (a new deploy = a new
//    CACHE_NAME, which also drops the old cache); a file that was never
//    cached is fetched and stored the first time.
//  * opening the site (a "navigate" request, e.g. "/") falls back to index.html
//  * CDN scripts/fonts (React, Firebase JS, Google Fonts): network-first, with
//    the cached copy as the offline fallback
//  * everything else — above all Firestore/Auth API traffic — is NOT touched,
//    so Firebase does its own offline handling (see firebase-init.js).
const CDN_HOSTS = /(^|\.)(gstatic\.com|unpkg\.com|fonts\.googleapis\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true })
          || (req.mode === "navigate" ? await cache.match("./index.html") : undefined);
        const refresh = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        });
        if (cached) { refresh.catch(() => {}); return cached; }
        return refresh.catch(() => cache.match("./index.html").then((r) => r || Response.error()));
      })
    );
  } else if (CDN_HOSTS.test(url.hostname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) { const clone = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Response.error()))
    );
  }
});
