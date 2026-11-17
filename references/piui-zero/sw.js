/** Only static PIUI-owned shell assets; never API, auth, private HTML or detail data. */
const CACHE_VERSION="2.2.2";
const CACHE_PREFIX="piui-zero-shell-v";
const CACHE_NAME=CACHE_PREFIX+CACHE_VERSION;
const STATIC_SHELL_ALLOWLIST=new Set(["/assets/js/components/collection-layout.js", "/assets/icons/piui-mark-light.svg", "/assets/icons/piui-mark-dark.svg", "/assets/icons/piui-favicon.svg", "/assets/icons/favicon.ico", "/assets/icons/piui-16.png", "/assets/icons/piui-32.png", "/assets/icons/piui-48.png", "/assets/icons/piui-180.png", "/assets/icons/piui-1024.png", "/assets/icons/piui-maskable-512.png", "/assets/js/core/environment.js", "/assets/icons/piui-sprite.svg", "/assets/css/main.css", "/assets/css/tokens.css", "/assets/css/base.css", "/assets/css/layout.css", "/assets/css/components.css", "/assets/css/utilities.css", "/assets/css/markdown-editor.css", "/assets/js/app.js", "/assets/js/core/url-state.js", "/assets/js/core/session-guard.js", "/assets/js/components/shell.js", "/assets/js/components/popup-layer.js", "/assets/js/components/cmd-palette.js", "/assets/js/components/svg-chart.js", "/assets/js/components/dashboard-controller.js", "/assets/js/components/data-table.js", "/assets/js/components/tabs.js", "/assets/js/components/select2.js", "/assets/js/components/markdown-editor.js", "/assets/js/components/gallery.js", "/assets/js/components/lazy-media.js", "/assets/js/components/wow-motion.js", "/assets/js/components/enterprise-suite.js", "/assets/js/core/icons.js", "/assets/js/components/date-range.js", "/assets/js/components/entity-detail.js", "/assets/js/components/forms.js", "/assets/js/components/notification-center.js", "/assets/js/components/notifications-page.js", "/assets/icons/piui-mark.svg", "/assets/icons/piui-wordmark.svg", "/assets/icons/piui-192.png", "/assets/icons/piui-512.png", "/assets/js/core/dom.js", "/assets/js/core/clipboard.js", "/assets/js/core/csv.js", "/assets/js/core/notifications-store.js", "/assets/js/core/adapters.js", "/assets/js/core/table-state.js", "/assets/js/core/assets.js", "/assets/js/core/media-policy.js", "/assets/js/components/data-state.js", "/assets/js/components/table-tools.js", "/assets/js/components/drafts.js", "/assets/js/components/kanban.js", "/assets/js/components/product-help.js", "/assets/js/components/feature-registry.js", "/assets/js/components/catalog-contracts.js", "/assets/js/core/worker-policy.js", "/offline.html", "/manifest.webmanifest"]);
const PRECACHE=["/offline.html", "/manifest.webmanifest", "/assets/icons/piui-mark.svg", "/assets/icons/piui-sprite.svg", "/assets/css/main.css?v=2.2.2", "/assets/js/app.js?v=2.2.2", "/assets/js/app.js", "/assets/js/core/environment.js", "/assets/js/components/shell.js", "/assets/js/components/popup-layer.js", "/assets/js/core/session-guard.js", "/assets/js/components/forms.js", "/assets/js/components/drafts.js", "/assets/js/core/dom.js", "/assets/js/core/adapters.js", "/assets/js/components/feature-registry.js", "/assets/js/core/assets.js", "/assets/js/core/worker-policy.js", "/assets/css/main.css", "/assets/css/tokens.css", "/assets/css/base.css", "/assets/css/layout.css", "/assets/css/components.css", "/assets/css/utilities.css", "/assets/js/components/product-help.js"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE)));self.skipWaiting();});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;
 if(request.mode==='navigate') {
  event.respondWith(fetch(request).catch(async()=>await (await caches.open(CACHE_NAME)).match('/offline.html')||Response.error()));return;
 }
 if(!STATIC_SHELL_ALLOWLIST.has(url.pathname))return;
 if([...url.searchParams.keys()].some(key=>key!=='v')||(url.searchParams.has('v')&&url.searchParams.get('v')!==CACHE_VERSION))return;
 // Revalidate unversioned imports as well; preserve full URL identity including v.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try {
   const response=await fetch(request,{cache:'no-cache'});
   if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
   return response;
  } catch {return await cache.match(request)||Response.error();}
 })());
});
