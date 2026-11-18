// Keep the native PIUI slider and substitute only its five published frames.
(async () => {
  const stage = document.querySelector('.vy-stage');
  if (!stage) return;
  const tabs = [...stage.querySelectorAll('.vy-stage__tab')];
  const image = stage.querySelector('.vy-stage__img');
  if (tabs.length !== 5 || !image) return;
  try {
    const response = await fetch('/api/v1/portal/hero', {credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)});
    if (!response.ok) return;
    const {version,banners} = await response.json();
    if (!Number.isSafeInteger(version) || version <= 0 || !Array.isArray(banners) || banners.length !== tabs.length) return;
    const sources = banners.map(banner=>{
      if (typeof banner.title !== 'string' || typeof banner.alt !== 'string') return '';
      if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(banner.media_id ?? '')) {
        return '/api/v1/portal/hero/media/'+banner.media_id+'?v='+version;
      }
      if (/^hero-0[1-5]-[a-z0-9-]+-tanpa-teks\.png$/.test(banner.asset ?? '')) {
        return '/assets/helpdesk/02_Hero_Tanpa_Teks/'+banner.asset;
      }
      return '';
    });
    if (sources.some(source=>!source)) return;
    tabs.forEach((tab, i)=>{
      const {title,alt} = banners[i];
      Object.assign(tab.dataset,{img:sources[i],title,alt});
      tab.setAttribute('aria-label',title);
      tab.title=title;
      const thumb=tab.querySelector('img');
      if (thumb) thumb.src=sources[i];
      const caption=tab.querySelector('.hd-hero-thumb-title');
      if (caption) caption.textContent=' · '+title;
    });
    const active=Math.max(0,tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true'));
    image.src=sources[active];
    image.alt=banners[active].alt;
    const caption=stage.querySelector('.vy-stage__title-tag span');
    if (caption) caption.textContent=banners[active].title;
  } catch {
    // Offline or unavailable publication keeps the bundled banners.
  }
})();

// Hydrate landing FAQ accordion cleanly from M8 published FAQs with bundled fallback.
(async () => {
  const faqRoot = document.getElementById('vy-faq');
  if (!faqRoot) return;
  try {
    const res = await fetch('/api/v1/knowledge/faqs?view=published&limit=6', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.items) || data.items.length === 0) return;
    const nodes = data.items.map((item, idx) => {
      const box = document.createElement('div');
      box.className = 'vy-faq__item';
      const panelId = 'faq-m8-' + (idx + 1);
      const btn = document.createElement('button');
      btn.className = 'vy-faq__q';
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', panelId);
      const qSpan = document.createElement('span');
      qSpan.textContent = item.title || '';
      const icon = document.createElement('span');
      icon.className = 'vy-faq__icon';
      icon.setAttribute('aria-hidden', 'true');
      btn.append(qSpan, icon);

      const ansWrap = document.createElement('div');
      ansWrap.className = 'vy-faq__a';
      ansWrap.id = panelId;
      ansWrap.setAttribute('data-open', '0');
      ansWrap.setAttribute('aria-hidden', 'true');
      ansWrap.inert = true;
      const inner = document.createElement('div');
      inner.className = 'vy-faq__inner';
      const p = document.createElement('p');
      p.textContent = String(item.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      inner.append(p);
      ansWrap.append(inner);

      btn.addEventListener('click', () => {
        const wasOpen = btn.getAttribute('aria-expanded') === 'true';
        const nextOpen = !wasOpen;
        btn.setAttribute('aria-expanded', String(nextOpen));
        ansWrap.setAttribute('data-open', nextOpen ? '1' : '0');
        ansWrap.setAttribute('aria-hidden', String(!nextOpen));
        ansWrap.inert = !nextOpen;
      });

      box.append(btn, ansWrap);
      return box;
    });
    faqRoot.replaceChildren(...nodes);
  } catch {
    // Offline or unavailable API preserves bundled fallback FAQ items.
  }
})();

// Close sibling FAQ items in the same landing accordion while keeping upstream faq.js unmodified.
document.addEventListener('click', event => {
  const btn = event.target instanceof Element ? event.target.closest('.vy-faq__q') : null;
  const root = btn?.closest('.vy-faq, #vy-price-compare, #vy-price-faq');
  if (!btn || !root) return;
  for (const other of root.querySelectorAll('.vy-faq__q')) {
    if (other === btn) continue;
    other.setAttribute('aria-expanded', 'false');
    const id = other.getAttribute('aria-controls');
    const panel = id ? document.getElementById(id) : null;
    if (panel) {
      panel.setAttribute('data-open', '0');
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;
    }
  }
}, true);
