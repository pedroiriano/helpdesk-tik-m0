const PAGE_SIZE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'Semua' },
];

type SortDir = 'none' | 'asc' | 'desc';

interface SortKey {
  kind: 0 | 1 | 2;
  num: number;
  text: string;
}

const idCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });
const instances = new WeakMap<HTMLTableElement, AdminDataTable>();
let rootObserver: MutationObserver | null = null;
let idSeq = 0;

function isAdminRoute(): boolean {
  return typeof location === 'undefined' || location.pathname.startsWith('/admin/');
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isNonSortableHeader(label: string): boolean {
  return /^(pilih|tindakan|aksi\s*massal|select|actions?)$/i.test(label) ||
    (/^aksi$/i.test(label) && !/jejak audit/i.test(label));
}

function isPlaceholderEmptyRow(tr: HTMLTableRowElement): boolean {
  if (tr.hasAttribute('data-dt-empty-row')) return true;
  if (tr.cells.length === 1) {
    const span = Number(tr.cells[0]?.getAttribute('colspan') || '1');
    if (span > 1) return true;
  }
  return false;
}

function isActionCell(cell: HTMLTableCellElement | undefined): boolean {
  if (!cell) return false;
  if (cell.querySelector('input[type="checkbox"], input[type="radio"]')) return true;
  const buttons = cell.querySelectorAll('button, a');
  if (buttons.length > 0) {
    const cloneText = normalizeText(cell.textContent);
    const controlText = normalizeText(Array.from(buttons).map(b => b.textContent).join(' '));
    if (cloneText.length > 0 && cloneText === controlText) return true;
  }
  return false;
}

function parseIndonesianDate(raw: string): number | null {
  const s = normalizeText(raw).replace(/\s+WIB$/i, '').trim();
  if (!s || s === '-') return null;

  // ISO-like date/datetime: YYYY-MM-DD...
  if (/^20\d{2}-\d{2}-\d{2}/.test(s)) {
    const ts = Date.parse(s);
    if (Number.isFinite(ts)) return ts;
  }

  // id-ID short/medium locale formats: DD/MM/YYYY[, HH.mm[.ss]]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const hour = m[4] ? Number(m[4]) : 0;
    const minute = m[5] ? Number(m[5]) : 0;
    const second = m[6] ? Number(m[6]) : 0;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return Date.UTC(year, month - 1, day, hour, minute, second);
    }
  }
  return null;
}

function extractSortKey(cell: HTMLTableCellElement | undefined): SortKey {
  if (!cell) return { kind: 2, num: 0, text: '' };
  const timeEl = cell.querySelector('time[datetime]');
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime');
    if (dt) {
      const ts = Date.parse(dt);
      if (Number.isFinite(ts)) {
        return { kind: 0, num: ts, text: normalizeText(cell.textContent) };
      }
    }
  }

  const text = normalizeText(cell.textContent);
  if (!text || text === '-' || /^belum tersedia$/i.test(text)) {
    return { kind: 2, num: 0, text: '' };
  }

  const parsedDate = parseIndonesianDate(text);
  if (parsedDate !== null) {
    return { kind: 0, num: parsedDate, text };
  }

  // Version tag e.g. v12
  const verMatch = text.match(/^v(\d+)$/i);
  if (verMatch) {
    return { kind: 0, num: Number(verMatch[1]), text };
  }

  // Pure numeric / Indonesian thousands separator / percentage
  if (/^-?\d+(?:\.\d{3})*(?:,\d+)?\s*%?$/.test(text)) {
    const cleaned = text.replace(/\s*%$/, '').replace(/\./g, '').replace(',', '.');
    const num = Number(cleaned);
    if (Number.isFinite(num)) {
      return { kind: 0, num, text };
    }
  }

  return { kind: 1, num: 0, text };
}

function extractFilterToken(cellText: string): string {
  const clean = normalizeText(cellText);
  if (!clean || clean === '-') return '';
  // Normalize status + version suffixes like "Aktif · v2" or "PENDING (v1)"
  const stripped = clean.replace(/\s*(?:·|\()\s*v\d+\)?$/i, '').trim();
  return stripped || clean;
}

function isColumnFilterable(
  headerLabel: string,
  columnIndex: number,
  rows: HTMLTableRowElement[],
  actionCols: Set<number>
): boolean {
  if (actionCols.has(columnIndex)) return false;
  if (/^(pilih|tindakan|aksi\s*massal)$/i.test(headerLabel)) return false;
  if (/^(waktu|diterima|target|jatuh tempo|id|slug|rute|alasan|keterangan|ringkasan|percobaan|objek|judul|data|tiket)/i.test(headerLabel)) {
    return false;
  }
  const values = new Set<string>();
  let totalLen = 0;
  for (const row of rows) {
    const token = extractFilterToken(row.cells[columnIndex]?.textContent ?? '');
    if (!token) continue;
    if (token.length > 56) return false;
    if (/^\d+(?:\.\d{3})*$/.test(token) && !/posisi/i.test(headerLabel)) return false;
    if (!values.has(token)) {
      values.add(token);
      totalLen += token.length;
    }
    if (values.size > 25) return false;
  }
  if (values.size === 0) return false;
  const categoricalByHeader = /(status|prioritas|organisasi|penugasan|hasil|jenis|kanal|audience|arah|komponen|aksi)/i.test(headerLabel);
  if (!categoricalByHeader && rows.length > 1 && values.size >= rows.length) return false;
  return totalLen / values.size <= 44;
}

function buildPageList(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

class AdminDataTable {
  private readonly table: HTMLTableElement;
  private readonly shell: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly filterSelect: HTMLSelectElement;
  private readonly mobileSortSelect: HTMLSelectElement;
  private readonly pageSizeSelect: HTMLSelectElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly infoEl: HTMLElement;
  private readonly pagerEl: HTMLElement;

  private searchQuery = '';
  private filterValue = '';
  private sortCol = -1;
  private sortDir: SortDir = 'none';
  private pageSize: number | 'all' = 10;
  private currentPage = 1;

  private internalUpdate = false;
  private syncScheduled = false;
  private orderCounter = 0;
  private lastContextKey = '';
  private readonly originalOrder = new WeakMap<HTMLTableRowElement, number>();
  private observer: MutationObserver | null = null;
  private emptyFilterRow: HTMLTableRowElement | null = null;

  constructor(table: HTMLTableElement) {
    this.table = table;
    const uid = ++idSeq;

    const existingScroll = table.closest('.hd-table-wrap, .piui-table-scroll') as HTMLElement | null;
    const scrollWrap = existingScroll ?? this.wrapTable(table);

    this.shell = document.createElement('div');
    this.shell.className = 'hd-dt-shell';
    this.shell.dataset.hdDtShell = '1';

    scrollWrap.classList.add('hd-dt-scroll');
    table.classList.add('hd-dt-table');

    const toolbar = document.createElement('div');
    toolbar.className = 'hd-dt-toolbar';

    // Live Search
    const searchGroup = document.createElement('div');
    searchGroup.className = 'hd-dt-control hd-dt-control--search';
    const searchLabel = document.createElement('label');
    searchLabel.className = 'hd-dt-label';
    searchLabel.htmlFor = `hd-dt-search-${uid}`;
    searchLabel.textContent = 'Cari';
    this.searchInput = document.createElement('input');
    this.searchInput.id = `hd-dt-search-${uid}`;
    this.searchInput.type = 'search';
    this.searchInput.className = 'piui-input hd-dt-search';
    this.searchInput.placeholder = 'Cari kata kunci tabel…';
    this.searchInput.setAttribute('aria-label', 'Cari data tabel secara langsung');
    this.searchInput.dataset.dtSearch = '';
    searchGroup.append(searchLabel, this.searchInput);

    // Column/Status Filter
    const filterGroup = document.createElement('div');
    filterGroup.className = 'hd-dt-control hd-dt-control--filter';
    const filterLabel = document.createElement('label');
    filterLabel.className = 'hd-dt-label';
    filterLabel.htmlFor = `hd-dt-filter-${uid}`;
    filterLabel.textContent = 'Filter';
    this.filterSelect = document.createElement('select');
    this.filterSelect.id = `hd-dt-filter-${uid}`;
    this.filterSelect.className = 'piui-input hd-dt-filter';
    this.filterSelect.setAttribute('aria-label', 'Filter data tabel');
    this.filterSelect.dataset.dtFilter = '';
    filterGroup.append(filterLabel, this.filterSelect);

    // Mobile Sort (synced with clickable column headers; visible on <= 640px card view)
    const mobileSortGroup = document.createElement('div');
    mobileSortGroup.className = 'hd-dt-control hd-dt-control--mobile-sort';
    const mobileSortLabel = document.createElement('label');
    mobileSortLabel.className = 'hd-dt-label';
    mobileSortLabel.htmlFor = `hd-dt-msort-${uid}`;
    mobileSortLabel.textContent = 'Urutkan';
    this.mobileSortSelect = document.createElement('select');
    this.mobileSortSelect.id = `hd-dt-msort-${uid}`;
    this.mobileSortSelect.className = 'piui-input hd-dt-msort';
    this.mobileSortSelect.setAttribute('aria-label', 'Urutkan kolom tabel');
    this.mobileSortSelect.dataset.dtMobileSort = '';
    mobileSortGroup.append(mobileSortLabel, this.mobileSortSelect);

    // Page Size (10, 20, 50, 100, Semua)
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'hd-dt-control hd-dt-control--pagesize';
    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'hd-dt-label';
    sizeLabel.htmlFor = `hd-dt-size-${uid}`;
    sizeLabel.textContent = 'Tampil';
    this.pageSizeSelect = document.createElement('select');
    this.pageSizeSelect.id = `hd-dt-size-${uid}`;
    this.pageSizeSelect.className = 'piui-input hd-dt-pagesize';
    this.pageSizeSelect.setAttribute('aria-label', 'Jumlah data tampil');
    this.pageSizeSelect.dataset.dtPagesize = '';
    for (const opt of PAGE_SIZE_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === '10') o.selected = true;
      this.pageSizeSelect.append(o);
    }
    sizeGroup.append(sizeLabel, this.pageSizeSelect);

    this.resetBtn = document.createElement('button');
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'piui-btn piui-btn--secondary piui-btn--sm hd-dt-reset';
    this.resetBtn.textContent = 'Reset';
    this.resetBtn.hidden = true;
    this.resetBtn.dataset.dtReset = '';

    toolbar.append(searchGroup, filterGroup, mobileSortGroup, sizeGroup, this.resetBtn);

    const footer = document.createElement('div');
    footer.className = 'hd-dt-footer';
    this.infoEl = document.createElement('p');
    this.infoEl.className = 'hd-dt-info';
    this.infoEl.setAttribute('aria-live', 'polite');
    this.infoEl.dataset.dtInfo = '';
    this.pagerEl = document.createElement('nav');
    this.pagerEl.className = 'hd-dt-pager';
    this.pagerEl.setAttribute('aria-label', 'Navigasi halaman data tabel');
    this.pagerEl.dataset.dtPager = '';
    footer.append(this.infoEl, this.pagerEl);

    if (scrollWrap.parentElement) {
      scrollWrap.parentElement.insertBefore(this.shell, scrollWrap);
    }
    this.shell.append(toolbar, scrollWrap, footer);

    this.bindEvents();
    this.observeTable();
    this.lastContextKey = this.computeContextKey();
    this.sync();
  }

  private wrapTable(table: HTMLTableElement): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'hd-table-wrap';
    if (table.parentElement) {
      table.parentElement.insertBefore(wrap, table);
    }
    wrap.append(table);
    return wrap;
  }

  private bindEvents(): void {
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = normalizeText(this.searchInput.value).toLowerCase();
      this.currentPage = 1;
      this.render();
    });

    this.filterSelect.addEventListener('change', () => {
      this.filterValue = this.filterSelect.value;
      this.currentPage = 1;
      this.render();
    });

    this.mobileSortSelect.addEventListener('change', () => {
      const val = this.mobileSortSelect.value;
      if (!val) {
        this.sortCol = -1;
        this.sortDir = 'none';
      } else {
        const [colStr, dir] = val.split(':');
        const colIdx = Number(colStr);
        if (Number.isInteger(colIdx) && (dir === 'asc' || dir === 'desc')) {
          this.sortCol = colIdx;
          this.sortDir = dir;
        }
      }
      this.currentPage = 1;
      this.syncHeaderSortAttributes();
      this.render();
    });

    this.pageSizeSelect.addEventListener('change', () => {
      const raw = this.pageSizeSelect.value;
      this.pageSize = raw === 'all' ? 'all' : (Number(raw) || 10);
      this.currentPage = 1;
      this.render();
    });

    this.resetBtn.addEventListener('click', () => {
      this.searchQuery = '';
      this.searchInput.value = '';
      this.filterValue = '';
      this.filterSelect.value = '';
      this.sortCol = -1;
      this.sortDir = 'none';
      this.currentPage = 1;
      this.syncHeaderSortAttributes();
      this.render();
    });
  }

  private mutateDom(fn: () => void): void {
    this.internalUpdate = true;
    try {
      fn();
    } finally {
      this.observer?.takeRecords();
      this.internalUpdate = false;
    }
  }

  private observeTable(): void {
    this.observer = new MutationObserver(() => {
      if (this.internalUpdate) return;
      this.scheduleSync();
    });
    const tbody = this.table.tBodies[0];
    if (tbody) {
      this.observer.observe(tbody, { childList: true });
    }
    if (this.table.caption) {
      this.observer.observe(this.table.caption, { childList: true, characterData: true, subtree: true });
    }
  }

  public scheduleSync(): void {
    if (this.syncScheduled) return;
    this.syncScheduled = true;
    queueMicrotask(() => {
      this.syncScheduled = false;
      this.sync();
    });
  }

  private getHeaderCells(): HTMLTableCellElement[] {
    const headRow = this.table.tHead?.rows[0];
    return headRow ? Array.from(headRow.cells) : [];
  }

  private getHeaderLabel(th: HTMLTableCellElement): string {
    const saved = th.dataset.dtLabel;
    if (saved) return saved;
    const raw = normalizeText(th.textContent);
    th.dataset.dtLabel = raw;
    return raw;
  }

  private computeContextKey(): string {
    const headers = this.getHeaderCells().map(th => this.getHeaderLabel(th)).join('|');
    const rawCap = normalizeText(this.table.caption?.textContent);
    const cap = rawCap.replace(/\s*·\s*Halaman\s+\d+.*$/i, '').trim();
    return `${cap}::${headers}`;
  }

  private getRealRows(): HTMLTableRowElement[] {
    const tbody = this.table.tBodies[0];
    if (!tbody) return [];
    const rows: HTMLTableRowElement[] = [];
    for (const tr of Array.from(tbody.rows)) {
      if (isPlaceholderEmptyRow(tr)) continue;
      if (!this.originalOrder.has(tr)) {
        this.originalOrder.set(tr, ++this.orderCounter);
      }
      rows.push(tr);
    }
    return rows;
  }

  private detectExcludedActionCols(rows: HTMLTableRowElement[], headers: HTMLTableCellElement[]): Set<number> {
    const excluded = new Set<number>();
    headers.forEach((th, idx) => {
      const label = this.getHeaderLabel(th);
      if (isNonSortableHeader(label)) {
        excluded.add(idx);
        return;
      }
      if (/^(tindakan|aksi)$/i.test(label) || /^pilih$/i.test(label)) {
        excluded.add(idx);
        return;
      }
      if (rows.length > 0) {
        const sample = rows.slice(0, 5);
        if (sample.every(r => isActionCell(r.cells[idx]))) {
          excluded.add(idx);
        }
      }
    });
    return excluded;
  }

  private enhanceHeaders(excludedCols: Set<number>): void {
    const headers = this.getHeaderCells();
    const prevMobileVal = this.mobileSortSelect.value;
    this.mobileSortSelect.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Urutan asli';
    this.mobileSortSelect.append(defaultOpt);

    headers.forEach((th, colIdx) => {
      const label = this.getHeaderLabel(th);
      const sortable = !excludedCols.has(colIdx) && label.length > 0;
      if (!sortable) {
        th.removeAttribute('aria-sort');
        return;
      }

      if (!th.dataset.dtHeaderBound) {
        th.dataset.dtHeaderBound = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hd-dt-sort';
        const labelSpan = document.createElement('span');
        labelSpan.className = 'hd-dt-sort__label';
        labelSpan.textContent = label;
        const iconSpan = document.createElement('span');
        iconSpan.className = 'hd-dt-sort__icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = '⇅';
        btn.append(labelSpan, iconSpan);
        btn.addEventListener('click', () => {
          this.toggleSortColumn(colIdx);
        });
        this.mutateDom(() => {
          th.replaceChildren(btn);
        });
      }

      const ascOpt = document.createElement('option');
      ascOpt.value = `${colIdx}:asc`;
      ascOpt.textContent = `${label} ↑ (A–Z / Awal)`;
      const descOpt = document.createElement('option');
      descOpt.value = `${colIdx}:desc`;
      descOpt.textContent = `${label} ↓ (Z–A / Baru)`;
      this.mobileSortSelect.append(ascOpt, descOpt);
    });

    if (prevMobileVal && Array.from(this.mobileSortSelect.options).some(o => o.value === prevMobileVal)) {
      this.mobileSortSelect.value = prevMobileVal;
    }
    this.syncHeaderSortAttributes();
  }

  private toggleSortColumn(colIdx: number): void {
    if (this.sortCol !== colIdx) {
      this.sortCol = colIdx;
      this.sortDir = 'asc';
    } else if (this.sortDir === 'asc') {
      this.sortDir = 'desc';
    } else if (this.sortDir === 'desc') {
      this.sortCol = -1;
      this.sortDir = 'none';
    } else {
      this.sortDir = 'asc';
    }
    this.currentPage = 1;
    this.syncHeaderSortAttributes();
    this.render();
  }

  private syncHeaderSortAttributes(): void {
    const headers = this.getHeaderCells();
    headers.forEach((th, idx) => {
      if (!th.dataset.dtHeaderBound) return;
      const active = idx === this.sortCol && this.sortDir !== 'none';
      const aria = active ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      th.setAttribute('aria-sort', aria);
      const icon = th.querySelector('.hd-dt-sort__icon');
      if (icon) {
        icon.textContent = !active ? '⇅' : this.sortDir === 'asc' ? '↑' : '↓';
      }
      th.classList.toggle('is-sorted', active);
    });
    const desiredMobile = this.sortCol >= 0 && this.sortDir !== 'none' ? `${this.sortCol}:${this.sortDir}` : '';
    if (Array.from(this.mobileSortSelect.options).some(o => o.value === desiredMobile)) {
      this.mobileSortSelect.value = desiredMobile;
    }
  }

  private rebuildFilterOptions(rows: HTMLTableRowElement[], excludedCols: Set<number>): void {
    const headers = this.getHeaderCells();
    const prevValue = this.filterValue;
    this.filterSelect.replaceChildren();

    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'Semua data';
    this.filterSelect.append(allOpt);

    headers.forEach((th, colIdx) => {
      const label = this.getHeaderLabel(th);
      if (!isColumnFilterable(label, colIdx, rows, excludedCols)) return;

      const distinct = new Map<string, number>();
      for (const row of rows) {
        const token = extractFilterToken(row.cells[colIdx]?.textContent ?? '');
        if (!token) continue;
        distinct.set(token, (distinct.get(token) ?? 0) + 1);
      }
      if (distinct.size === 0) return;

      const group = document.createElement('optgroup');
      group.label = label;
      const sortedEntries = Array.from(distinct.entries()).sort((a, b) => idCollator.compare(a[0], b[0]));
      for (const [token, count] of sortedEntries) {
        const opt = document.createElement('option');
        opt.value = `${colIdx}\u0000${token}`;
        opt.textContent = `${token} (${count})`;
        group.append(opt);
      }
      this.filterSelect.append(group);
    });

    if (prevValue && Array.from(this.filterSelect.options).some(o => o.value === prevValue)) {
      this.filterSelect.value = prevValue;
    } else {
      this.filterValue = '';
      this.filterSelect.value = '';
    }
  }

  private assignCellLabels(rows: HTMLTableRowElement[]): void {
    const labels = this.getHeaderCells().map(th => this.getHeaderLabel(th));
    for (const row of rows) {
      Array.from(row.cells).forEach((cell, idx) => {
        if (!cell.dataset.label && labels[idx]) {
          cell.dataset.label = labels[idx];
        }
      });
    }
  }

  public sync(): void {
    const ctxKey = this.computeContextKey();
    const contextChanged = this.lastContextKey !== '' &&
      ctxKey !== this.lastContextKey &&
      !/^Daftar master::/.test(this.lastContextKey);
    if (contextChanged) {
      this.searchQuery = '';
      this.searchInput.value = '';
      this.filterValue = '';
      this.sortCol = -1;
      this.sortDir = 'none';
      this.currentPage = 1;
    }
    this.lastContextKey = ctxKey;

    const rows = this.getRealRows();
    const headers = this.getHeaderCells();
    const excludedCols = this.detectExcludedActionCols(rows, headers);

    this.assignCellLabels(rows);
    this.enhanceHeaders(excludedCols);
    this.rebuildFilterOptions(rows, excludedCols);
    this.render();
  }

  private matchesFilters(row: HTMLTableRowElement, excludedCols: Set<number>): boolean {
    if (this.filterValue) {
      const sep = this.filterValue.indexOf('\u0000');
      if (sep > 0) {
        const colIdx = Number(this.filterValue.slice(0, sep));
        const expected = this.filterValue.slice(sep + 1);
        const actual = extractFilterToken(row.cells[colIdx]?.textContent ?? '');
        if (actual !== expected) return false;
      }
    }
    if (this.searchQuery) {
      const parts: string[] = [];
      Array.from(row.cells).forEach((cell, idx) => {
        if (excludedCols.has(idx)) {
          // Still search text on links/buttons only if cell contains real text like ticket link
          const linkText = normalizeText(cell.querySelector('a')?.textContent);
          if (linkText) parts.push(linkText);
          return;
        }
        parts.push(normalizeText(cell.textContent));
      });
      const haystack = parts.join(' ').toLowerCase();
      if (!haystack.includes(this.searchQuery)) return false;
    }
    return true;
  }

  private sortRows(rows: HTMLTableRowElement[]): HTMLTableRowElement[] {
    const colIdx = this.sortCol;
    const dir = this.sortDir;
    const ordered = [...rows];
    if (colIdx < 0 || dir === 'none') {
      ordered.sort((a, b) => (this.originalOrder.get(a) ?? 0) - (this.originalOrder.get(b) ?? 0));
      return ordered;
    }

    const factor = dir === 'asc' ? 1 : -1;
    const cached = new Map<HTMLTableRowElement, SortKey>();
    for (const r of ordered) {
      cached.set(r, extractSortKey(r.cells[colIdx]));
    }
    ordered.sort((a, b) => {
      const ka = cached.get(a)!;
      const kb = cached.get(b)!;
      if (ka.kind === 2 && kb.kind === 2) {
        return (this.originalOrder.get(a) ?? 0) - (this.originalOrder.get(b) ?? 0);
      }
      if (ka.kind === 2) return 1;
      if (kb.kind === 2) return -1;

      if (ka.kind === 0 && kb.kind === 0) {
        const diff = (ka.num - kb.num) * factor;
        if (diff !== 0) return diff;
      } else {
        const cmp = idCollator.compare(ka.text, kb.text) * factor;
        if (cmp !== 0) return cmp;
      }
      return (this.originalOrder.get(a) ?? 0) - (this.originalOrder.get(b) ?? 0);
    });
    return ordered;
  }

  private updateEmptyFilterRow(tbody: HTMLTableSectionElement, show: boolean, colCount: number): void {
    if (!show) {
      if (this.emptyFilterRow?.isConnected) {
        this.emptyFilterRow.remove();
      }
      return;
    }
    if (!this.emptyFilterRow) {
      this.emptyFilterRow = document.createElement('tr');
      this.emptyFilterRow.className = 'hd-dt-empty-row';
      this.emptyFilterRow.dataset.dtEmptyRow = 'true';
      const td = document.createElement('td');
      td.textContent = 'Tidak ada data yang cocok dengan kata kunci pencarian atau filter.';
      this.emptyFilterRow.append(td);
    }
    const td = this.emptyFilterRow.cells[0];
    if (td) td.colSpan = Math.max(1, colCount);
    if (this.emptyFilterRow.parentElement !== tbody || tbody.lastElementChild !== this.emptyFilterRow) {
      tbody.append(this.emptyFilterRow);
    }
  }

  private render(): void {
    const tbody = this.table.tBodies[0];
    if (!tbody) return;
    const headers = this.getHeaderCells();
    const realRows = this.getRealRows();
    const excludedCols = this.detectExcludedActionCols(realRows, headers);

    const hasActiveControls = Boolean(this.searchQuery || this.filterValue || (this.sortCol >= 0 && this.sortDir !== 'none'));
    this.resetBtn.hidden = !hasActiveControls;

    const sortedAll = this.sortRows(realRows);
    const matchedSet = new Set<HTMLTableRowElement>();
    const matchedRows: HTMLTableRowElement[] = [];
    for (const row of sortedAll) {
      if (this.matchesFilters(row, excludedCols)) {
        matchedSet.add(row);
        matchedRows.push(row);
      }
    }

    const totalAll = realRows.length;
    const totalMatched = matchedRows.length;
    const effectiveLimit = this.pageSize === 'all' ? Math.max(1, totalMatched) : this.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalMatched / effectiveLimit));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = this.pageSize === 'all' ? 0 : (this.currentPage - 1) * effectiveLimit;
    const endIdx = this.pageSize === 'all' ? totalMatched : Math.min(totalMatched, startIdx + effectiveLimit);
    const visibleSet = new Set(matchedRows.slice(startIdx, endIdx));

    this.mutateDom(() => {
      // Only reorder DOM children if order actually differs from sortedAll
      let needsReorder = false;
      const currentRows = Array.from(tbody.rows).filter(r => !isPlaceholderEmptyRow(r));
      if (currentRows.length === sortedAll.length) {
        for (let i = 0; i < sortedAll.length; i++) {
          if (currentRows[i] !== sortedAll[i]) {
            needsReorder = true;
            break;
          }
        }
      }
      if (needsReorder) {
        for (const r of sortedAll) tbody.append(r);
      }
      for (const r of sortedAll) {
        r.hidden = !visibleSet.has(r);
      }
      this.updateEmptyFilterRow(tbody, totalAll > 0 && totalMatched === 0, headers.length);
    });

    this.renderFooterInfo(totalAll, totalMatched, startIdx, endIdx);
    this.renderPagination(totalMatched, totalPages);
  }

  private renderFooterInfo(totalAll: number, totalMatched: number, startIdx: number, endIdx: number): void {
    if (totalAll === 0) {
      this.infoEl.textContent = 'Belum ada data untuk ditampilkan.';
      return;
    }
    if (totalMatched === 0) {
      this.infoEl.textContent = `Menampilkan 0 dari ${totalAll} data (tidak ada yang cocok).`;
      return;
    }
    const base = this.pageSize === 'all'
      ? `Menampilkan semua ${totalMatched} data`
      : `Menampilkan ${startIdx + 1}–${endIdx} dari ${totalMatched} data`;
    this.infoEl.textContent = totalMatched < totalAll ? `${base} (difilter dari ${totalAll} total)` : base;
  }

  private renderPagination(totalMatched: number, totalPages: number): void {
    this.pagerEl.replaceChildren();
    if (totalMatched === 0) {
      this.pagerEl.hidden = true;
      return;
    }
    this.pagerEl.hidden = false;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'piui-btn piui-btn--secondary piui-btn--sm hd-dt-page-btn';
    prevBtn.textContent = 'Sebelumnya';
    prevBtn.disabled = this.currentPage <= 1;
    prevBtn.dataset.dtPrev = '';
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });
    this.pagerEl.append(prevBtn);

    const pages = buildPageList(this.currentPage, totalPages);
    for (const item of pages) {
      if (item === 'ellipsis') {
        const span = document.createElement('span');
        span.className = 'hd-dt-ellipsis';
        span.textContent = '…';
        span.setAttribute('aria-hidden', 'true');
        this.pagerEl.append(span);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = item === this.currentPage
        ? 'piui-btn piui-btn--primary piui-btn--sm hd-dt-page-btn is-active'
        : 'piui-btn piui-btn--secondary piui-btn--sm hd-dt-page-btn';
      btn.textContent = String(item);
      btn.dataset.dtPage = String(item);
      if (item === this.currentPage) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.addEventListener('click', () => {
          this.currentPage = item;
          this.render();
        });
      }
      this.pagerEl.append(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'piui-btn piui-btn--secondary piui-btn--sm hd-dt-page-btn';
    nextBtn.textContent = 'Berikutnya';
    nextBtn.disabled = this.currentPage >= totalPages;
    nextBtn.dataset.dtNext = '';
    nextBtn.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.render();
      }
    });
    this.pagerEl.append(nextBtn);
  }
}

export function enhanceAdminDataTable(table: HTMLTableElement): void {
  if (!isAdminRoute()) return;
  if (table.hasAttribute('data-dt-disabled')) return;
  const existing = instances.get(table);
  if (existing) {
    existing.scheduleSync();
    return;
  }
  instances.set(table, new AdminDataTable(table));
}

export function initAdminDataTables(root: ParentNode = document): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (!isAdminRoute()) return;

  if (root instanceof HTMLTableElement && root.classList.contains('piui-table')) {
    enhanceAdminDataTable(root);
  } else {
    root.querySelectorAll<HTMLTableElement>('table.piui-table').forEach(enhanceAdminDataTable);
  }

  if (!rootObserver && document.body) {
    rootObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.dataset.hdDtShell) continue;
          if (node.matches('table.piui-table')) {
            if (!instances.has(node as HTMLTableElement)) {
              enhanceAdminDataTable(node as HTMLTableElement);
            }
          } else {
            node.querySelectorAll<HTMLTableElement>('table.piui-table').forEach(t => {
              if (!instances.has(t)) enhanceAdminDataTable(t);
            });
          }
        }
      }
    });
    rootObserver.observe(document.body, { childList: true, subtree: true });
  }
}
