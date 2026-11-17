import { api, APIError } from './transport';

type Article = {
  title: string;
  slug: string;
  body: string;
  audience: string;
  state: string;
  kind: string;
  version: number;
  updated_at: string;
};

const aliases: Record<string, string> = {
  'konfigurasi-email-depok-go-id': 'panduan-konfigurasi-email-depok-go-id',
  'pengajuan-tte-bsre': 'panduan-pengajuan-tte-bsre',
  'penanganan-insiden-csirt': 'panduan-penanganan-insiden-csirt',
  'koneksi-wifi-balaikota': 'panduan-koneksi-wifi-balaikota',
};
const audiences: Record<string, string> = {
  PUBLIC_GUEST: 'Publik', PUBLIC_AUTH: 'Warga terdaftar', ASN_AUTH: 'ASN', STAFF_ONLY: 'Petugas',
};
const allowed = new Set(['p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const dropped = new Set(['script', 'style', 'template', 'svg', 'math', 'iframe', 'object', 'embed']);
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });

function create<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function safeArticle(body: string) {
  const inert = document.createElement('template');
  inert.innerHTML = body;
  const output = document.createDocumentFragment();
  function append(source: Node, target: Node) {
    if (source.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(source.textContent ?? ''));
      return;
    }
    if (!(source instanceof Element) || source.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
    const name = source.localName;
    if (dropped.has(name)) return;
    let parent = target;
    if (allowed.has(name)) {
      const element = document.createElement(name);
      if (element instanceof HTMLAnchorElement) {
        try {
          const href = source.getAttribute('href');
          if (href) {
            const url = new URL(href, location.origin);
            if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin)) element.href = url.href;
          }
        } catch { /* Invalid links remain inert. */ }
      }
      target.appendChild(element);
      parent = element;
    }
    for (const child of source.childNodes) append(child, parent);
  }
  for (const child of inert.content.childNodes) append(child, output);
  return output;
}

function detailHref(slug: string, isPage = false) { return (isPage ? '/halaman/' : '/panduan/') + encodeURIComponent(slug); }
function validSlug(slug: string) { return /^[a-z0-9-]{1,100}$/.test(slug); }
function summary(body: string) {
  const text = (safeArticle(body).textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? text.slice(0, 157).trimEnd() + '…' : text;
}
function metadata(article: Article) {
  const date = new Date(article.updated_at);
  return [audiences[article.audience], 'Versi ' + article.version,
    Number.isFinite(date.getTime()) ? 'Diperbarui ' + dateFormat.format(date) : ''].filter(Boolean).join(' · ');
}

export function initKnowledgeBase() {
  const root = document.querySelector<HTMLElement>('[data-hd-knowledge]');
  if (!root) return;
  const isPage = root.dataset.hdKnowledge === 'PAGE' || location.pathname.startsWith('/halaman');
  const apiBase = isPage ? '/portal/pages' : '/knowledge/articles';
  const listPath = isPage ? '/halaman.html' : '/panduan.html';
  const noun = isPage ? 'halaman portal' : 'panduan';
  const field = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const list = field('[data-hd-kb-list]');
  const cards = field('[data-hd-kb-cards]');
  const featured = field('[data-hd-kb-featured]');
  const detail = field('[data-hd-kb-detail]');
  const reader = field('[data-hd-kb-reader]');
  const body = field('[data-hd-kb-body]');
  const state = field('[data-hd-kb-status]');
  const retry = field<HTMLButtonElement>('[data-hd-kb-retry]');
  const pager = field('[data-hd-kb-pager]');
  const search = field<HTMLInputElement>('#hd-knowledge-search');
  const prev = field<HTMLButtonElement>('[data-hd-kb-prev]');
  const next = field<HTMLButtonElement>('[data-hd-kb-next]');
  let active: AbortController | undefined;
  let nextCursor: string | null = null;
  let cursors = [''];
  search.value = new URLSearchParams(location.search).get('q')?.slice(0, 100) ?? '';

  function clearContent() {
    active?.abort();
    cards.replaceChildren();
    body.replaceChildren();
    featured.hidden = reader.hidden = pager.hidden = retry.hidden = true;
  }

  async function load() {
    clearContent();
    const request = new AbortController();
    active = request;
    const match = location.pathname.match(/^\/(?:panduan|halaman)\/([^/]+)\/?$/);
    const oldHash = location.hash.startsWith('#panduan-') ? location.hash.slice(9) : '';
    const raw = match?.[1]?.replace(/\.html$/, '') || oldHash;
    const slug = raw ? Object.hasOwn(aliases, raw) ? aliases[raw] : raw : '';
    list.hidden = Boolean(slug);
    detail.hidden = !slug;
    state.textContent = `Memuat ${noun}…`;
    try {
      if (slug) {
        if (!validSlug(slug)) throw new APIError(404, `${noun} tidak ditemukan`);
        const article = await api<Article>(`${apiBase}/${slug}?view=published`, 'GET', undefined, undefined, undefined, {}, request.signal);
        if (request.signal.aborted) return;
        field('[data-hd-kb-title]').textContent = article.title;
        field('[data-hd-kb-meta]').textContent = metadata(article);
        body.replaceChildren(safeArticle(article.body));
        reader.hidden = false;
        document.title = article.title + ' · Helpdesk TIK';
        state.textContent = '';
        return;
      }
      const query = new URLSearchParams({limit: '12', view: 'published'});
      if (search.value.trim()) query.set('q', search.value.trim());
      const cursor = cursors.at(-1);
      if (cursor) query.set('cursor', cursor);
      const page = await api<{items: Article[]; next_cursor: string|null}>(`${apiBase}?` + query, 'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      nextCursor = page.next_cursor;
      const items = page.items.filter(item => validSlug(item.slug));
      const highlight = cursors.length === 1 && !search.value.trim() ? items.shift() : undefined;
      if (highlight) {
        field('#hd-kb-featured-title').textContent = highlight.title;
        field('[data-hd-kb-featured-summary]').textContent = summary(highlight.body);
        field<HTMLAnchorElement>('[data-hd-kb-featured-link]').href = detailHref(highlight.slug, isPage);
        featured.hidden = false;
      }
      for (const item of items) {
        const article = create('article', '', 'hd-knowledge-card');
        const content = create('div', '', 'hd-knowledge-card__body');
        const heading = create('h2', '', 'hd-knowledge-card__title');
        const link = create('a', item.title);
        link.href = detailHref(item.slug, isPage);
        heading.append(link);
        content.append(heading, create('p', metadata(item), 'hd-kb-metadata'), create('p', summary(item.body), 'hd-knowledge-card__summary'));
        article.append(content);
        cards.append(article);
      }
      prev.disabled = cursors.length < 2;
      next.disabled = !nextCursor;
      pager.hidden = prev.disabled && next.disabled;
      state.textContent = page.items.length ? `${page.items.length} ${noun} pada halaman ini` : `Belum ada ${noun} yang sesuai.`;
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof APIError && error.status === 404) {
        state.textContent = `${noun} tidak ditemukan atau tidak tersedia untuk sesi Anda.`;
      } else {
        state.textContent = navigator.onLine ? `${noun} gagal dimuat. Coba lagi.` : `Sambungkan kembali untuk memuat ${noun}.`;
        retry.hidden = false;
      }
    }
  }

  field('[data-hd-kb-search]').addEventListener('submit', event => {
    event.preventDefault();
    cursors = [''];
    const q = search.value.trim();
    const query = q ? '?' + new URLSearchParams({q}) : '';
    history.replaceState(null, '', listPath + query);
    void load();
  });
  prev.addEventListener('click', () => { if (cursors.length > 1) { cursors.pop(); void load(); } });
  next.addEventListener('click', () => { if (nextCursor) { cursors.push(nextCursor); void load(); } });
  retry.addEventListener('click', () => void load());
  window.addEventListener('pagehide', clearContent);
  window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
  window.addEventListener('focus', () => void load());
  window.addEventListener('hashchange', () => void load());
  window.addEventListener('offline', () => { clearContent(); state.textContent = `Sambungkan kembali untuk memuat ${noun}.`; retry.hidden = false; });
  window.addEventListener('online', () => void load());
  void load();
}
