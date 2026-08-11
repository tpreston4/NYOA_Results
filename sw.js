const CACHE = "nyoa-points-v3";
const SHELL = ["./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

// Cache each file individually rather than using cache.addAll(), which fails
// the entire install if even one request errors (e.g. a slow load or a
// missing file). Precaching is only used as an offline fallback — the actual
// app always prefers a fresh network fetch (see below) — so it's fine for
// this to be best-effort instead of all-or-nothing.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => { if (res.ok) return c.put(url, res); })
            .catch((err) => console.warn("SW precache failed:", url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Only cache/serve the app shell ourselves. Live data fetches (proxy/remote)
// always go straight to the network.
//
// NETWORK-FIRST: always try to fetch the latest file first. Only fall back
// to the cached copy if the network request fails (e.g. offline). This is
// the opposite of cache-first — it means updates you push to GitHub show up
// the next time the app is opened with a connection, instead of getting
// stuck showing an old cached version indefinitely.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // don't intercept remote data calls

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
