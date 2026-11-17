// js/modules/router.js - Native Client-Side Router with View Transitions API
export function initRouter() {
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    // Hanya tangani tautan internal (bukan anchor #, bukan link eksternal http://)
    const isInternal = href && href.startsWith('/') && !href.startsWith('//');
    const isStandardClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;

    if (isInternal && isStandardClick && !link.hasAttribute('download')) {
      event.preventDefault();
      navigateTo(href);
    }
  });

  window.addEventListener('popstate', () => {
    renderRoute(window.location.pathname, false);
  });
}

export async function navigateTo(url) {
  if (document.startViewTransition) {
    document.startViewTransition(async () => {
      await renderRoute(url, true);
    });
  } else {
    await renderRoute(url, true);
  }
}

async function renderRoute(url, pushState = true) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Halaman tidak ditemukan');
    const htmlText = await res.text();
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlText, 'text/html');

    document.title = newDoc.title;
    const newContent = newDoc.querySelector('#main-content');
    const currentContent = document.querySelector('#main-content');

    if (newContent && currentContent) {
      currentContent.replaceWith(newContent);
    }

    if (pushState) {
      history.pushState({}, '', url);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    // Fallback navigasi penuh jika fetch gagal
    window.location.href = url;
  }
}
