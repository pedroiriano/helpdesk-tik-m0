import { api } from './transport';

type Suggestion = { title: string; description: string; href: string };

export function setupSearchCombobox(): void {
  const input = document.querySelector<HTMLInputElement>('#hd-public-search');
  const list = document.querySelector<HTMLElement>('#hd-search-suggestions');
  const status = document.querySelector<HTMLElement>('#hd-search-status');
  if (!input || !list || !status) return;
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
  const search = async (query: string) => {
    const request = new AbortController();
    pending = request;
    const q = encodeURIComponent(query);
    const signal = request.signal;
    status.textContent = 'Mencari layanan dan panduan…';
    const [services, guides, pages] = await Promise.allSettled([
      api<{items: {id:string; title:string; snippet:string}[]}>('/search?owner=M2&q=' + q + '&limit=5',
        'GET', undefined, undefined, undefined, {}, signal),
      api<{items: {slug:string; title:string}[]}>('/knowledge/articles?view=published&q=' + q + '&limit=5',
        'GET', undefined, undefined, undefined, {}, signal),
      api<{items: {slug:string; title:string}[]}>('/portal/pages?view=published&q=' + q + '&limit=3',
        'GET', undefined, undefined, undefined, {}, signal),
    ]);
    if (signal.aborted) return;
    options = [
      ...(services.status === 'fulfilled' ? services.value.items.map(service => ({
        title: service.title,
        description: 'Layanan · ' + service.snippet,
        href: '/detail-layanan.html?id=' + encodeURIComponent(service.id),
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
    const partial = services.status !== 'fulfilled' || guides.status !== 'fulfilled' || pages.status !== 'fulfilled';
    status.textContent = options.length
      ? options.length + ' saran tersedia.' + (partial ? ' Salah satu sumber gagal dimuat.' : '')
      : partial ? 'Pencarian gagal dimuat sepenuhnya. Ubah kueri atau coba lagi.' : 'Tidak ada layanan atau panduan yang cocok.';
    list.hidden = options.length === 0;
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
    if (event.key === 'Tab') {
      close();
      return;
    }
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
    if (!input.contains(event.target as Node) && !list.contains(event.target as Node)) close();
  });
}
