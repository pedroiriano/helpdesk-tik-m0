import { api } from './transport';

type Suggestion = { title: string; description: string; href: string };
type Hit = { id: string; title: string; snippet: string };
type HitPage = { items: Hit[]; next_cursor: string | null };
const service = (hit: Hit): Suggestion => ({
  title: hit.title, description: 'Layanan · ' + hit.snippet,
  href: '/detail-layanan.html?id=' + encodeURIComponent(hit.id),
});
const media = (hit: Hit): Suggestion => ({
  title: hit.title || 'Media', description: hit.snippet ? 'Media · ' + hit.snippet : 'Media · Unduh',
  href: '/api/v1/media/' + encodeURIComponent(hit.id) + '/download',
});

export function setupSearchCombobox(): void {
  const input = document.querySelector<HTMLInputElement>('#hd-public-search');
  const list = document.querySelector<HTMLElement>('#hd-search-suggestions');
  const status = document.querySelector<HTMLElement>('#hd-search-status');
  if (!input || !list || !status) return;
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn btn-secondary';
  more.textContent = 'Muat hasil berikutnya';
  more.hidden = true;
  status.after(more);
  let pageQuery = '';
  let serviceCursor: string | null = null;
  let mediaCursor: string | null = null;
  let options: Suggestion[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;

  const close = () => {
    pending?.abort();
    clearTimeout(timer);
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    options = [];
    active = -1;
    more.hidden = true;
    more.disabled = false;
    serviceCursor = mediaCursor = null;
  };
  const select = (index: number) => {
    const option = options[index];
    if (option) location.assign(option.href);
  };
  const focusOption = (index: number) => {
    active = index;
    for (const [i, option] of [...list.children].entries()) {
      option.setAttribute('aria-selected', String(i === active));
    }
    const option = list.children[index];
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({block: 'nearest'});
  };
  const fetchPage = (route: string, q: string, limit: number, signal: AbortSignal, cursor?: string) =>
    api<HitPage>('/search?' + route + '&q=' + encodeURIComponent(q) + '&limit=' + limit +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), 'GET', undefined, undefined, undefined, {}, signal);

  const render = () => {
    list.replaceChildren();
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.hidden = options.length === 0;
    more.hidden = !serviceCursor && !mediaCursor;
    input.setAttribute('aria-expanded', String(!list.hidden));
    options.forEach((option, index) => {
      const item = document.createElement('li');
      item.id = 'hd-search-opt-' + index;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.className = 'hd-suggestion-item';
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      meta.className = 'hd-suggestion-meta';
      title.textContent = option.title;
      meta.textContent = option.description;
      item.append(title, meta);
      item.addEventListener('click', () => select(index));
      list.append(item);
    });
  };

  const search = async (query: string) => {
    const request = new AbortController();
    pending = request;
    const q = encodeURIComponent(query);
    const signal = request.signal;
    status.textContent = 'Mencari layanan, FAQ, dan panduan…';
    const [services, assets, guides, pages, faqs] = await Promise.allSettled([
      fetchPage('owner=M2', query, 5, signal),
      fetchPage('owner=M8&kind=MEDIA', query, 4, signal),
      api<{items: {slug:string; title:string}[]}>('/knowledge/articles?view=published&q=' + q + '&limit=5',
        'GET', undefined, undefined, undefined, {}, signal),
      api<{items: {slug:string; title:string}[]}>('/portal/pages?view=published&q=' + q + '&limit=3',
        'GET', undefined, undefined, undefined, {}, signal),
      api<{items: {slug:string; title:string; category_label?:string}[]}>('/knowledge/faqs?view=published&q=' + q + '&limit=4',
        'GET', undefined, undefined, undefined, {}, signal),
    ]);
    if (signal.aborted) return;
    pageQuery = query;
    serviceCursor = services.status === 'fulfilled' ? services.value.next_cursor : null;
    mediaCursor = assets.status === 'fulfilled' ? assets.value.next_cursor : null;
    options = [
      ...(services.status === 'fulfilled' ? services.value.items.map(service) : []),
      ...(assets.status === 'fulfilled' ? assets.value.items.map(media) : []),
      ...(faqs.status === 'fulfilled' ? faqs.value.items.map(faq => ({
        title: faq.title,
        description: 'FAQ · ' + (faq.category_label || 'Umum'),
        href: '/faq.html#' + encodeURIComponent(faq.slug),
      })) : []),
      ...(guides.status === 'fulfilled' ? guides.value.items.map(guide => ({
        title: guide.title,
        description: 'Panduan',
        href: '/panduan/' + encodeURIComponent(guide.slug),
      })) : []),
      ...(pages.status === 'fulfilled' ? pages.value.items.map(page => ({
        title: page.title,
        description: 'Halaman Portal',
        href: '/halaman/' + encodeURIComponent(page.slug),
      })) : []),
    ];
    const partial = services.status !== 'fulfilled' || guides.status !== 'fulfilled' || pages.status !== 'fulfilled' || faqs.status !== 'fulfilled' || assets.status !== 'fulfilled';
    status.textContent = options.length
      ? options.length + ' saran tersedia.' + (partial ? ' Salah satu sumber gagal dimuat.' : '')
      : partial ? 'Pencarian gagal dimuat sepenuhnya. Ubah kueri atau coba lagi.' : 'Tidak ada hasil pencarian yang cocok.';
    render();
  };

  more.addEventListener('click', async () => {
    if (more.disabled) return;
    const request = new AbortController();
    pending?.abort();
    pending = request;
    more.disabled = true;
    const sources = [
      { route: 'owner=M2', cursor: serviceCursor, map: service, advance: (value: string | null) => { serviceCursor = value; } },
      { route: 'owner=M8&kind=MEDIA', cursor: mediaCursor, map: media, advance: (value: string | null) => { mediaCursor = value; } },
    ];
    let failed = false;
    await Promise.all(sources.map(async source => {
      if (!source.cursor) return;
      try {
        const next = await fetchPage(source.route, pageQuery, 5, request.signal, source.cursor);
        if (request.signal.aborted) return;
        options.push(...next.items.map(source.map));
        source.advance(next.next_cursor);
      } catch {
        failed = true;
      }
    }));
    if (request.signal.aborted) return;
    render();
    more.disabled = false;
    if (more.hidden) input.focus();
    status.textContent = failed ? 'Sebagian hasil gagal dimuat. Coba lagi.' : options.length + ' hasil tersedia.';
  });

  input.addEventListener('input', () => {
    close();
    status.textContent = '';
    const q = input.value.trim();
    if (q.length >= 2) timer = setTimeout(() => void search(q), 200);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      close();
      status.textContent = '';
      event.preventDefault();
      return;
    }
    if (event.key === 'Tab') return;
    if (!options.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption((active + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(active < 0 ? options.length - 1 : (active - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      select(active);
    }
  });
  document.addEventListener('click', event => {
    if (!input.contains(event.target as Node) && !list.contains(event.target as Node) && !more.contains(event.target as Node)) close();
  });
}
