/*
 * Service worker — hand-rolled, zero-dependency, matching the project ethos.
 *
 * Strategy:
 *   - install : precache the app shell (start URL, manifest, icons)
 *   - activate: drop caches from older versions, take control immediately
 *   - fetch   : navigations -> network-first with offline fallback to the
 *               cached shell; same-origin GETs (Vite emits content-hashed,
 *               immutable asset names) -> cache-first, filling the cache on
 *               miss. Everything else passes straight through to the network.
 *
 * Bump CACHE_VERSION on any shell change to retire the previous cache.
 */
const CACHE_VERSION = "v6";
const CACHE_NAME = `agentic-guide-${CACHE_VERSION}`;

// Relative to the SW scope (the deploy path, e.g. "/agentladder/").
const SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

// Vite emits content-hashed asset names we can't know ahead of time, so we
// fetch the shell HTML and read the <script>/<link> URLs out of it. Caching
// these during install is what makes the app work offline on the FIRST visit
// (before the SW controls the page, its asset requests bypass this worker).
async function discoverAssets(html) {
  const urls = new Set();
  const re = /(?:src|href)="([^"]+\.(?:js|css))(?:\?[^"]*)?"/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      urls.add(new URL(m[1], self.registration.scope).href);
    } catch {
      /* skip anything that isn't a resolvable URL */
    }
  }
  return [...urls];
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(SHELL.map((url) => cache.add(url)));
  try {
    const res = await fetch("./", { cache: "no-cache" });
    if (res.ok) {
      await cache.put("./", res.clone());
      const assets = await discoverAssets(await res.text());
      await Promise.allSettled(assets.map((url) => cache.add(url)));
    }
  } catch {
    /* offline at install time — runtime caching fills the gaps later */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("agentic-guide-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin go to network

  // Dev servers (and GitHub Pages) send `Vary: Origin` on hashed assets;
  // `crossorigin` module scripts then send an Origin header the precached
  // entry lacks, so a Vary-sensitive match misses and we fail offline. The
  // app shell is keyed purely by URL, so match ignoring Vary/search.
  const MATCH = { ignoreVary: true, ignoreSearch: true };

  // Navigations: fresh when online, cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request, MATCH)
            .then((hit) => hit || caches.match("./", MATCH)),
        ),
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(request, MATCH).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
