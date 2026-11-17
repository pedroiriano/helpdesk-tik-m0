// js/modules/hero-switcher.js — File-safe Native Hero Banner Slider
function initHeroSwitcher() {
  const stage = document.querySelector('.vy-stage');
  if (!stage || stage.dataset.heroSliderReady === 'true') return;
  stage.dataset.heroSliderReady = 'true';

  const tabs = Array.from(stage.querySelectorAll('.vy-stage__tab'));
  const stageImg = stage.querySelector('.vy-stage__img');
  const stagePrompt = stage.querySelector('.vy-stage__prompt');
  const stageModel = stage.querySelector('.vy-stage__model');
  const stageSteps = stage.querySelector('.vy-stage__steps');
  const stageSeed = stage.querySelector('.vy-stage__seed');
  const stageSize = stage.querySelector('.vy-stage__size');
  const stageDetail = document.getElementById('vy-hero-detail');

  const prevBtn = document.getElementById('vy-hero-prev');
  const nextBtn = document.getElementById('vy-hero-next');
  const autoplayBtn = document.getElementById('vy-hero-autoplay');
  const tallyCur = document.getElementById('vy-hero-tally-cur');

  let activeIdx = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
  let transitionTimer = 0;
  let autoplayTimer = 0;
  let isStageVisible = true;
  let isPausedByUser = false;
  let pointerStartX = null;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const autoplayDelay = 5000;

  if (!tabs.length) return;

  stage.setAttribute('aria-roledescription', 'carousel');
  stage.setAttribute('aria-label', 'Featured basketball telemetry');

  // Warm only the next frame; avoid downloading the full reel on constrained mobile connections.
  function preloadNextFrame() {
    if (navigator.connection?.saveData || tabs.length < 2) return;
    const tab = tabs[(activeIdx + 1) % tabs.length];
    if (!tab?.dataset.img) return;
    const image = new Image();
    image.src = tab.dataset.img;
  }

  function stopAutoplay() {
    window.clearInterval(autoplayTimer);
    autoplayTimer = 0;
  }

  function startAutoplay() {
    stopAutoplay();
    if (isPausedByUser || motionPreference.matches || !isStageVisible || document.hidden || tabs.length < 2) return;
    autoplayTimer = window.setInterval(() => {
      const nextIdx = (activeIdx + 1) % tabs.length;
      selectTab(tabs[nextIdx], nextIdx);
    }, autoplayDelay);
  }

  function selectTab(tab, idx, animate = true) {
    if (!tab) return;
    activeIdx = idx !== undefined ? idx : tabs.indexOf(tab);

    tabs.forEach((item) => {
      const isActive = item === tab;
      item.setAttribute('aria-selected', String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });

    const d = tab.dataset;
    if (stageImg && d.img && stageImg.getAttribute('src') !== d.img) {
      window.clearTimeout(transitionTimer);
      if (animate) stage.classList.add('is-switching');
      transitionTimer = window.setTimeout(() => {
        stageImg.src = d.img;
        stageImg.alt = d.alt || 'Studio render frame';
        stageImg.removeAttribute('srcset');
        stageImg.removeAttribute('sizes');
        if (d.width && d.height) {
          stageImg.setAttribute('width', d.width);
          stageImg.setAttribute('height', d.height);
        }
        window.requestAnimationFrame(() => stage.classList.remove('is-switching'));
      }, animate ? 220 : 0);
    }

    if (stagePrompt && d.prompt) stagePrompt.textContent = d.prompt;
    if (stageModel && d.model) stageModel.textContent = d.model;
    if (stageSteps && d.steps) stageSteps.textContent = d.steps;
    if (stageSeed && d.seed) stageSeed.textContent = d.seed;
    if (stageSize && d.size) stageSize.textContent = d.size;
    if (stageDetail && d.detail) {
      stageDetail.href = d.detail;
      stageDetail.setAttribute('aria-label', `Open detail for ${d.title || 'active play'}`);
    }

    const titleTag = stage.querySelector('.vy-stage__title-tag span');
    if (titleTag && d.title) titleTag.textContent = d.title;

    const barFill = stage.querySelector('.vy-stage__bar-fill');
    if (barFill) {
      barFill.setAttribute('data-progress', String(activeIdx + 1));
    }

    if (tallyCur) {
      tallyCur.textContent = (activeIdx + 1 < 10 ? '0' : '') + (activeIdx + 1);
    }

    preloadNextFrame();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      selectTab(tab, i);
      startAutoplay();
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const nextIdx = (activeIdx - 1 + tabs.length) % tabs.length;
      selectTab(tabs[nextIdx], nextIdx);
      startAutoplay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const nextIdx = (activeIdx + 1) % tabs.length;
      selectTab(tabs[nextIdx], nextIdx);
      startAutoplay();
    });
  }

  if (autoplayBtn) {
    autoplayBtn.addEventListener('click', () => {
      isPausedByUser = !isPausedByUser;
      autoplayBtn.setAttribute('aria-pressed', String(isPausedByUser));
      autoplayBtn.setAttribute('aria-label', isPausedByUser ? 'Play automatic slides' : 'Pause automatic slides');
      autoplayBtn.textContent = isPausedByUser ? '\u25B6' : '\u2758\u2758';
      if (isPausedByUser) stopAutoplay();
      else startAutoplay();
    });
  }

  // Keyboard left/right navigation within hero stage
  stage.addEventListener('keydown', (e) => {
    let nextIdx = null;
    if (e.key === 'ArrowLeft') {
      nextIdx = (activeIdx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'ArrowRight') {
      nextIdx = (activeIdx + 1) % tabs.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = tabs.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      selectTab(tabs[nextIdx], nextIdx);
      tabs[nextIdx].focus();
      startAutoplay();
    }
  });

  // Pointer events cover touch, pen, and mouse swipes without blocking vertical scrolling.
  stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    pointerStartX = event.clientX;
  }, { passive: true });

  stage.addEventListener('pointerup', (event) => {
    if (!event.isPrimary || pointerStartX === null) return;
    const distance = event.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(distance) < 48) return;

    const nextIdx = distance < 0
      ? (activeIdx + 1) % tabs.length
      : (activeIdx - 1 + tabs.length) % tabs.length;
    selectTab(tabs[nextIdx], nextIdx);
    startAutoplay();
  }, { passive: true });

  stage.addEventListener('pointercancel', () => {
    pointerStartX = null;
  }, { passive: true });

  stage.addEventListener('focusin', stopAutoplay);
  stage.addEventListener('focusout', (event) => {
    if (!stage.contains(event.relatedTarget)) startAutoplay();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) stopAutoplay();
    else startAutoplay();
  });

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isStageVisible = entry.isIntersecting && entry.intersectionRatio > 0.25;
      if (isStageVisible) startAutoplay();
      else stopAutoplay();
    }, { threshold: [0, 0.25] });
    visibilityObserver.observe(stage);
  } else {
    startAutoplay();
  }

  selectTab(tabs[activeIdx], activeIdx, false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroSwitcher, { once: true });
} else {
  initHeroSwitcher();
}
