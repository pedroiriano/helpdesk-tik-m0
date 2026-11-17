// js/modules/link-sentinel.js - Link Integrity & Anti-Tabnabbing Sentinel
function initLinkSentinel() {
  // Pindai semua tautan di dalam dokumen secara otomatis
  const externalLinks = document.querySelectorAll('a[target="_blank"]');
  externalLinks.forEach((link) => {
    const currentRel = link.getAttribute('rel') || '';
    const relParts = new Set(currentRel.split(/\s+/).filter(Boolean));

    // Wajib memiliki noopener dan noreferrer
    relParts.add('noopener');
    relParts.add('noreferrer');

    link.setAttribute('rel', Array.from(relParts).join(' '));
  });

  // Pasang MutationObserver agar tautan dinamis baru juga otomatis terlindungi
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const links = node.matches('a[target="_blank"]') 
              ? [node] 
              : node.querySelectorAll('a[target="_blank"]');
            links.forEach((link) => {
              const currentRel = link.getAttribute('rel') || '';
              const relParts = new Set(currentRel.split(/\s+/).filter(Boolean));
              relParts.add('noopener');
              relParts.add('noreferrer');
              link.setAttribute('rel', Array.from(relParts).join(' '));
            });
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
