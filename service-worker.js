// Naam van de cache. Verhoog dit getal als je later bestanden aanpast
// en wilt dat gebruikers de nieuwe versie krijgen.
const CACHE_NAME = "walk-to-mordor-v5";

// Bestanden die de app nodig heeft om te werken
const FILES_TO_CACHE = [
  "index.html",
  "style.css",
  "script.js",
  "journey.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

// Bij installatie: bestanden alvast opslaan in de cache
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// Bij activatie: oude caches van eerdere versies opruimen
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
});

// Bij elk verzoek: eerst kijken of het bestand in de cache staat,
// anders alsnog ophalen via internet
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      return cachedResponse || fetch(event.request);
    })
  );
});
