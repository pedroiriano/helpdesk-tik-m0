// sw.js — predictable offline shell and page cache (v4.3)
const CACHE_NAME = 'courtspec-native-v4.3';
const SCOPE_ROOT = new URL('./', self.registration.scope);

const ROOT_PAGES = [
  '', 'index.html', 'gallery.html', 'pricing.html', 'about.html', 'contact.html',
  'pipeline.html', 'play.html', 'plan.html', 'principle.html', 'brief.html',
  '404.html', 'offline.html'
];

const DETAIL_PAGES = [
  'details/plays/apex-flush.html', 'details/plays/crossover-burst.html',
  'details/plays/arena-three.html', 'details/plays/hardwood-brake.html',
  'details/plays/stepback-dagger.html', 'details/plays/baseline-jam.html',
  'details/plays/corner-three.html', 'details/plays/defensive-slide.html',
  'details/plays/alley-oop.html', 'details/plays/hesitation-freeze.html',
  'details/plays/curl-high-arc.html', 'details/plays/sprint-decel.html',
  'details/plays/shammgod.html', 'details/plays/eurostep.html',
  'details/plays/elbow-pullup.html', 'details/plays/pivot-spin.html',
  'details/pipelines/shooting.html', 'details/pipelines/handles.html',
  'details/pipelines/finishing.html', 'details/pipelines/vision.html',
  'details/plans/starter.html', 'details/plans/studio.html', 'details/plans/scale.html',
  'details/principles/fidelity.html', 'details/principles/provenance.html',
  'details/principles/native.html', 'details/principles/integrity.html',
  'details/briefs/readiness.html', 'details/briefs/calibration.html',
  'details/briefs/governance.html', 'details/briefs/integration.html',
  'details/briefs/privacy.html', 'details/briefs/accessibility.html',
  'details/briefs/security.html', 'details/briefs/terms.html'
];

const SHELL_ASSETS = [
  'manifest.webmanifest',
  'css/main.css?v=4.3', 'css/01-tokens.css?v=4.3', 'css/02-base.css?v=4.3',
  'css/03-layout.css?v=4.3', 'css/04-components.css?v=4.3',
  'css/05-utilities.css?v=4.3', 'css/06-reference-motion.css?v=4.3',
  'css/07-detail-pages.css?v=4.3',
  'js/main.js?v=4.3', 'js/modules/theme.js?v=4.3',
  'js/modules/navigation.js?v=4.3', 'js/modules/reveal.js?v=4.3',
  'js/modules/link-sentinel.js?v=4.3', 'js/modules/hero-switcher.js?v=4.3',
  'js/modules/gallery.js?v=4.3', 'js/modules/metrics-chart.js?v=4.3',
  'js/modules/pricing-sizer.js?v=4.3', 'js/modules/faq.js?v=4.3',
  'js/modules/contact.js?v=4.3', 'js/modules/detail-pages.js?v=4.3',
  'assets/icons/favicon.svg', 'assets/icons/icon-192.png',
  'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
  'assets/images/hero.svg'
];

const PRECACHE = [...ROOT_PAGES, ...DETAIL_PAGES, ...SHELL_ASSETS]
  .map((path) => new URL(path, SCOPE_ROOT).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
      || (await cache.match(new URL('offline.html', SCOPE_ROOT).href))
      || Response.error();
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    if (request.destination === 'image') {
      return (await cache.match(new URL('assets/images/hero.svg', SCOPE_ROOT).href)) || Response.error();
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(networkFirstAsset(request));
    return;
  }
  event.respondWith(cacheFirstAsset(request));
});
