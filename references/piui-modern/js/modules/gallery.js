// js/modules/gallery.js — File-safe Filter, Master-Detail Viewer & Prompt Copier
function initGallery() {
  if (document.documentElement.dataset.galleryControlsReady === 'true') return;
  document.documentElement.dataset.galleryControlsReady = 'true';

  // 1. Copy Prompt Utility
  function bindCopyButtons(container = document) {
    const copyBtns = container.querySelectorAll('.vy-copy-prompt, #vy-out-copy');
    copyBtns.forEach((btn) => {
      btn.setAttribute('aria-live', 'polite');
      btn.addEventListener('click', () => {
        let text = '';
        if (btn.id === 'vy-out-copy') {
          const promptEl = document.getElementById('vy-out-prompt');
          text = promptEl ? promptEl.textContent.trim() : '';
        } else {
          const card = btn.closest('.vy-work') || btn.closest('.vy-meta');
          const promptEl = card ? card.querySelector('.vy-prompt-field') : null;
          text = promptEl ? promptEl.textContent.trim() : '';
        }

        if (!text) return;

        function done() {
          btn.setAttribute('data-copied', '1');
          const prevText = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(() => {
            btn.removeAttribute('data-copied');
            btn.textContent = prevText;
          }, 1600);
        }

        function fallback() {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.className = 'vy-clipboard-fallback';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            done();
          } catch (e) {
            btn.textContent = 'Copy failed';
          }
          document.body.removeChild(ta);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  bindCopyButtons();

  // 2. Showcase Grid Filtering (index.html)
  const grid = document.getElementById('vy-gallery-grid');
  const countEl = document.getElementById('vy-gallery-count');
  const filterBtns = Array.from(document.querySelectorAll('.vy-filter, .vy-groups button[data-filter]'));
  const requestedFilter = new URLSearchParams(window.location.search).get('filter');

  // Arrow-key navigation keeps each filter bar fast and predictable for keyboard users.
  document.querySelectorAll('.vy-groups').forEach((group) => {
    const groupButtons = Array.from(group.querySelectorAll('button[data-filter]'));
    group.addEventListener('keydown', (event) => {
      const currentIndex = groupButtons.indexOf(document.activeElement);
      if (currentIndex < 0) return;

      let nextIndex = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % groupButtons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + groupButtons.length) % groupButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = groupButtons.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        groupButtons[nextIndex].focus();
      }
    });
  });

  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.vy-work'));
    function applyIndexFilter(category) {
      let shown = 0;
      cards.forEach((card) => {
        const match = category === 'all' || card.getAttribute('data-path') === category;
        card.hidden = !match;
        if (match) shown++;
      });
      filterBtns.forEach((b) => {
        b.setAttribute('aria-pressed', b.getAttribute('data-filter') === category ? 'true' : 'false');
      });
      if (countEl) countEl.textContent = `${shown} / ${cards.length}`;
    }

    filterBtns.forEach((b) => {
      b.addEventListener('click', () => applyIndexFilter(b.getAttribute('data-filter')));
    });

    const queryFilter = filterBtns.find((button) => button.dataset.filter === requestedFilter);
    const initialFilter = queryFilter || filterBtns.find((button) => button.getAttribute('aria-pressed') === 'true');
    applyIndexFilter(initialFilter?.getAttribute('data-filter') || 'all');
  }

  // 3. Master-Detail Viewer (gallery.html)
  const list = document.getElementById('vy-log-list');
  const viewer = document.querySelector('.vy-out__viewer');
  if (list && viewer) {
    const rows = Array.from(list.querySelectorAll('.vy-reel-cell'));
    const logCountEl = document.getElementById('vy-log-count');
    const detailLink = document.getElementById('vy-out-detail');
    const detailImageLink = document.getElementById('vy-out-image-link');
    const detailIds = [
      'apex-flush', 'crossover-burst', 'arena-three', 'hardwood-brake',
      'stepback-dagger', 'baseline-jam', 'corner-three', 'defensive-slide',
      'alley-oop', 'hesitation-freeze', 'curl-high-arc', 'sprint-decel',
      'shammgod', 'eurostep', 'elbow-pullup', 'pivot-spin'
    ];
    const out = {
      image: document.getElementById('vy-out-image'),
      title: document.getElementById('vy-out-title'),
      kind: document.getElementById('vy-out-kind'),
      model: document.getElementById('vy-out-model'),
      steps: document.getElementById('vy-out-steps'),
      seed: document.getElementById('vy-out-seed'),
      forkDt: document.getElementById('vy-out-fork-dt'),
      fork: document.getElementById('vy-out-fork'),
      size: document.getElementById('vy-out-size'),
      prompt: document.getElementById('vy-out-prompt')
    };
    rows.forEach((row, index) => {
      if (!row.id) row.id = `vy-play-tab-${String(index + 1).padStart(2, '0')}`;
    });

    function revealViewer() {
      if (window.innerWidth < 900) {
        const box = viewer.getBoundingClientRect();
        if (box.top < 0 || box.bottom > window.innerHeight) {
          viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }

    function paint(row, syncUrl = false) {
      if (!row) return;
      rows.forEach((r) => {
        const selected = r === row;
        r.setAttribute('aria-selected', selected ? 'true' : 'false');
        r.tabIndex = selected ? 0 : -1;
      });

      const d = row.dataset;
      const thumb = row.querySelector('.vy-out__thumb img');
      const src = thumb ? thumb.getAttribute('src') : '';
      viewer.setAttribute('aria-labelledby', row.id);

      if (out.title) out.title.textContent = d.title || '';
      if (out.kind) out.kind.textContent = d.kind || '';
      if (out.model) out.model.textContent = d.model || '';
      if (out.steps) out.steps.textContent = d.steps || '';
      if (out.seed) out.seed.textContent = d.seed || '';
      if (out.size) out.size.textContent = d.size || '';
      if (out.prompt) out.prompt.textContent = d.renderPrompt || '';
      const detailId = detailIds[rows.indexOf(row)] || detailIds[0];
      const detailHref = `details/plays/${encodeURIComponent(detailId)}.html`;
      if (detailLink) {
        detailLink.href = detailHref;
        detailLink.setAttribute('aria-label', `Open full detail for ${d.title || 'selected play'}`);
      }
      if (detailImageLink) {
        detailImageLink.href = detailHref;
        detailImageLink.setAttribute('aria-label', `Open ${d.title || 'selected play'} detail`);
      }
      if (syncUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('play', detailId);
        window.history.pushState({}, '', url);
      }

      const fork = d.fork || '';
      if (out.forkDt && out.fork) {
        out.forkDt.hidden = !fork;
        out.fork.hidden = !fork;
        if (fork) out.fork.textContent = `from #${fork}`;
      }

      if (out.image && src && out.image.getAttribute('src') !== src) {
        out.image.setAttribute('data-updating', '1');
        setTimeout(() => {
          out.image.src = src;
          out.image.alt = d.title || 'Selected render';
          out.image.removeAttribute('srcset');
          out.image.removeAttribute('sizes');
          const imageWidth = thumb?.getAttribute('width');
          const imageHeight = thumb?.getAttribute('height');
          if (imageWidth && imageHeight) {
            out.image.setAttribute('width', imageWidth);
            out.image.setAttribute('height', imageHeight);
          }
          out.image.removeAttribute('data-updating');
        }, 120);
      }
    }

    function applyGalleryFilter(path) {
      let shown = 0;
      let firstVisible = null;
      rows.forEach((row) => {
        const match = path === 'all' || row.dataset.path === path;
        row.hidden = !match;
        if (match) {
          shown++;
          if (!firstVisible) firstVisible = row;
        }
      });

      filterBtns.forEach((b) => {
        b.setAttribute('aria-pressed', b.dataset.filter === path ? 'true' : 'false');
      });

      if (logCountEl) logCountEl.textContent = `${shown} / ${rows.length}`;

      const activeRow = rows.find((r) => r.getAttribute('aria-selected') === 'true');
      if (firstVisible && (!activeRow || activeRow.hidden)) {
        paint(firstVisible);
      }
    }

    rows.forEach((row) => {
      row.addEventListener('click', () => {
        paint(row, true);
        revealViewer();
      });
      row.addEventListener('focus', () => paint(row));
    });

    list.addEventListener('keydown', (event) => {
      const visibleRows = rows.filter((row) => !row.hidden);
      const currentIndex = visibleRows.indexOf(document.activeElement);
      if (currentIndex < 0) return;
      let nextIndex = null;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visibleRows.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + visibleRows.length) % visibleRows.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = visibleRows.length - 1;
      if (nextIndex !== null) {
        event.preventDefault();
        const nextRow = visibleRows[nextIndex];
        nextRow.focus();
        paint(nextRow, true);
        revealViewer();
      }
    });

    filterBtns.forEach((b) => {
      b.addEventListener('click', () => {
        applyGalleryFilter(b.dataset.filter);
        const url = new URL(window.location.href);
        if (b.dataset.filter === 'all') url.searchParams.delete('filter');
        else url.searchParams.set('filter', b.dataset.filter);
        const activeRow = rows.find((row) => row.getAttribute('aria-selected') === 'true' && !row.hidden);
        const activeId = detailIds[rows.indexOf(activeRow)];
        if (activeId) url.searchParams.set('play', activeId);
        window.history.pushState({}, '', url);
      });
    });

    const queryFilter = filterBtns.find((button) => button.dataset.filter === requestedFilter);
    const initialFilter = queryFilter || filterBtns.find((button) => button.getAttribute('aria-pressed') === 'true');
    applyGalleryFilter(initialFilter?.dataset.filter || 'all');

    // Initial paint
    const requestedPlay = new URLSearchParams(window.location.search).get('play');
    const requestedIndex = detailIds.indexOf(requestedPlay);
    const requestedRow = requestedIndex >= 0 ? rows[requestedIndex] : null;
    const initial = requestedRow || rows.find((r) => r.getAttribute('aria-selected') === 'true') || rows[0];
    if (initial) paint(initial);

    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const filter = filterBtns.some((button) => button.dataset.filter === params.get('filter')) ? params.get('filter') : 'all';
      applyGalleryFilter(filter);
      const playIndex = detailIds.indexOf(params.get('play'));
      const target = playIndex >= 0 && !rows[playIndex].hidden ? rows[playIndex] : rows.find((row) => !row.hidden);
      if (target) paint(target);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGallery, { once: true });
} else {
  initGallery();
}
