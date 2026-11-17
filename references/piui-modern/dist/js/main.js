// js/main.js — File-safe Master Application Bootstrap

// 1. Native Global Error Sentinel
window.addEventListener('error', (event) => {
  console.error('[Sentinel Error Captured]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Sentinel Promise Rejection]:', event.reason);
});

// 2. Offline Service Worker Registration
function initServiceWorker() {
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const projectRoot = new URL('./', manifestLink?.href || window.location.href);
      const serviceWorkerUrl = new URL('sw.js', projectRoot);
      navigator.serviceWorker.register(serviceWorkerUrl, { scope: projectRoot.pathname }).catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
    });
  }
}

// 3. Application Lifecycle Bootstrap
function boot() {
  if (typeof initTheme === 'function') initTheme();
  if (typeof initReveal === 'function') initReveal();
  if (typeof initMetricsChart === 'function') initMetricsChart();
  if (typeof initPricingSizer === 'function') initPricingSizer();
  if (typeof initFaq === 'function') initFaq();
  if (typeof initContact === 'function') initContact();
  if (typeof initLinkSentinel === 'function') initLinkSentinel();
  initServiceWorker();
  console.log('[CourtSpec]: Zero-dependency mobile-first interface initialized.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
