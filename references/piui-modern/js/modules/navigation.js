// js/modules/navigation.js — File-safe Mobile Drawer & Scroll-Reveal Navigation
function initNavigation() {
  const headerFrame = document.getElementById('vy-topbar_glide_frame');
  const burgerBtn = document.getElementById('vy-topbar-glide-panel-btn') || document.getElementById('nav-toggle');
  const flyout = document.getElementById('vy-topbar-glide-flyout') || document.getElementById('site-navigation');
  if (!burgerBtn || !flyout) return;

  const desktopNav = window.matchMedia('(min-width: 1024px)');
  const pageSurfaces = [document.querySelector('main'), document.querySelector('footer')].filter(Boolean);

  // Mark the matching destination so the classic desktop-style menu has a clear selection state.
  const navigationLinks = [...flyout.querySelectorAll('a[href]')];
  const currentUrl = new URL(window.location.href);
  const exactMatch = navigationLinks.find((link) => {
    const targetUrl = new URL(link.href, currentUrl);
    return targetUrl.pathname === currentUrl.pathname && targetUrl.hash === currentUrl.hash;
  });
  const pageMatch = navigationLinks.find((link) => {
    const targetUrl = new URL(link.href, currentUrl);
    return targetUrl.pathname === currentUrl.pathname && (!targetUrl.hash || targetUrl.hash === '#top');
  });
  const detailParent = (() => {
    const path = currentUrl.pathname.toLowerCase();
    const parentPage = path.includes('/details/plays/') ? 'gallery.html'
      : path.includes('/details/plans/') ? 'pricing.html'
        : path.includes('/details/principles/') ? 'about.html'
          : path.includes('/details/briefs/') ? 'contact.html'
            : path.includes('/details/pipelines/') ? 'index.html'
              : null;
    if (!parentPage) return null;
    return navigationLinks.find((link) => new URL(link.href, currentUrl).pathname.toLowerCase().endsWith(`/${parentPage}`));
  })();
  const activeLink = exactMatch || pageMatch || detailParent;
  if (activeLink) activeLink.setAttribute('aria-current', 'page');

  function getFocusableItems() {
    return [...flyout.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  function closeMenu() {
    burgerBtn.setAttribute('aria-expanded', 'false');
    flyout.classList.remove('is-open');
    flyout.setAttribute('aria-hidden', 'true');
    burgerBtn.setAttribute('aria-label', 'Open navigation menu');
    pageSurfaces.forEach((surface) => { surface.inert = false; });
    document.body.classList.remove('vy-nav-menu-open');
  }

  function openMenu() {
    burgerBtn.setAttribute('aria-expanded', 'true');
    flyout.classList.add('is-open');
    flyout.setAttribute('aria-hidden', 'false');
    burgerBtn.setAttribute('aria-label', 'Close navigation menu');
    pageSurfaces.forEach((surface) => { surface.inert = true; });
    document.body.classList.add('vy-nav-menu-open');

    // Move focus to first interactive link inside flyout
    const firstLink = flyout.querySelector('a, button');
    if (firstLink) firstLink.focus();
  }

  burgerBtn.addEventListener('click', () => {
    const isExpanded = burgerBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (!flyout.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      closeMenu();
      burgerBtn.focus();
      return;
    }

    if (e.key === 'Tab') {
      const focusableItems = getFocusableItems();
      if (!focusableItems.length) return;

      const firstItem = focusableItems[0];
      const lastItem = focusableItems.at(-1);
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
  });

  // Close when clicking any link inside flyout
  flyout.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      closeMenu();
    }
  });

  // Close if clicking outside the flyout and button
  document.addEventListener('click', (e) => {
    if (flyout.classList.contains('is-open') &&
        !flyout.contains(e.target) &&
        !burgerBtn.contains(e.target)) {
      closeMenu();
    }
  });

  desktopNav.addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  const hero = document.getElementById('top') || document.querySelector('.vy-ref-hero, .vy-hero');
  const shouldRevealAfterHero = document.body.hasAttribute('data-nav-after-hero') || Boolean(document.querySelector('.vy-ref-hero'));

  if (headerFrame && hero && shouldRevealAfterHero) {
    if (!document.body.hasAttribute('data-nav-after-hero')) {
      document.body.setAttribute('data-nav-after-hero', '');
    }

    let isVisible = null;

    function setHeaderVisibility(isPastHero) {
      if (isVisible === isPastHero) return;
      isVisible = isPastHero;
      headerFrame.classList.toggle('is-past-hero', isPastHero);
      headerFrame.inert = !isPastHero;
      headerFrame.setAttribute('aria-hidden', String(!isPastHero));
      if (!isPastHero) closeMenu();
    }

    function evaluateScroll() {
      const heroRect = hero.getBoundingClientRect();
      // Reveal navbar when bottom of hero section scrolls past top of viewport (threshold 64px)
      const isPast = heroRect.bottom <= 64;
      setHeaderVisibility(isPast);
    }

    // Evaluate immediately on initial paint / load
    evaluateScroll();

    // High performance passive scroll listener with requestAnimationFrame
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          evaluateScroll();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Handle viewport resize or orientation changes
    window.addEventListener('resize', evaluateScroll, { passive: true });

    // IntersectionObserver as secondary safeguard
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver(() => {
        evaluateScroll();
      }, { threshold: [0, 0.05, 0.1, 0.2] });
      heroObserver.observe(hero);
    }
  }

  // Keep the compact hero jump list meaningful when users return to it.
  const quickLinks = [...document.querySelectorAll('.vy-quick-nav a[href^="#"]')];
  if (quickLinks.length && 'IntersectionObserver' in window) {
    const sectionLinks = quickLinks
      .map((link) => ({ link, section: document.querySelector(link.hash) }))
      .filter(({ section }) => section);

    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      sectionLinks.forEach(({ link, section }) => {
        if (section === visible.target) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.05, 0.2, 0.45] });

    sectionLinks.forEach(({ section }) => sectionObserver.observe(section));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavigation, { once: true });
} else {
  initNavigation();
}
