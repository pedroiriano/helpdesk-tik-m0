import type { Components } from './business-types.generated';
import { api, errorText } from './transport';
import { ticketState } from './journey';
import { dashboardFeedback } from './dashboard-feedback';
import { exampleAnalytics } from './dashboard-example';

type Session = Components['Session'];
type Page<T> = { items: T[]; next_cursor: string | null };
type DashboardAnalytics = Components['DashboardAnalytics'];
type AnalysisView = { data:DashboardAnalytics; params:URLSearchParams; counts:Record<string, number> };
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits:1 });
const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Jakarta' });
const shortDay = new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'short', timeZone:'Asia/Jakarta' });
const labels: Record<string, string> = {
  active:'Masih aktif', completed:'Selesai ditangani', age_lt24:'Kurang dari 24 jam',
  age_24_72:'24 hingga kurang dari 72 jam', age_gte72:'72 jam atau lebih',
  overdue:'Melewati tenggat', due_soon:'Jatuh tempo dalam 24 jam', on_track:'Jatuh tempo lebih dari 24 jam',
  paused:'SLA dijeda', unmeasured:'Target belum terukur', none:'Selesai atau dibatalkan',
};
const deadlineTone: Record<string, string> = {
  overdue:'urgent', due_soon:'attention', on_track:'success', paused:'neutral', unmeasured:'neutral',
};
const stateTone: Record<string, string> = {
  RESOLVED:'success', CLOSED:'success', CANCELLED:'neutral', NEEDS_INFORMATION:'attention',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function dateValue(iso: string) {
  const date = element('time', stamp.format(new Date(iso)));
  date.dateTime = iso;
  return date;
}

function statusMarker(label: string, tone: string) {
  const marker = element('span', label);
  marker.className = 'hd-ticket-marker';
  marker.dataset.tone = tone;
  return marker;
}

function showValues(list: HTMLElement, rows: [string, string][]) {
  list.replaceChildren(...rows.flatMap(([term, value]) => [element('dt', term), element('dd', value)]));
}

export function bindDashboardAnalysis(dashboard: HTMLElement, session: Session | undefined) {
  const panel = dashboard.querySelector<HTMLElement>('[data-hd-dashboard-analysis]')!;
  const get = <T extends HTMLElement>(key: string) => panel.querySelector<T>('[data-hd-analysis-' + key + ']')!;
  const tablePanel = get('table');
  const tableStatus = get('table-status');
  const tableContent = get('ticket-content');
  const tableRetry = get<HTMLButtonElement>('table-retry');
  const trendPlot = get('trend');
  const tbody = get('rows');
  const search = panel.querySelector<HTMLInputElement>('#hd-analysis-query')!;
  const prev = get<HTMLButtonElement>('prev');
  const next = get<HTMLButtonElement>('next');
  const csv = get<HTMLAnchorElement>('csv');
  const cohortExport = get<HTMLAnchorElement>('cohort-export');
  const capacity = get('capacity');
  const rosterLink = get<HTMLAnchorElement>('roster');
  const performanceLink = get<HTMLAnchorElement>('performance-link');
  const liveMode = get<HTMLButtonElement>('live-mode');
  const demoMode = get<HTMLButtonElement>('demo-mode');
  const allowExample = session?.mode === 'SYNTHETIC_LAB' && session.actor.kind === 'STAFF';
  const tableHeading = panel.querySelector<HTMLElement>('#hd-analysis-table-title')!;
  const context = get('context');
  let current: AbortController | undefined;
  let tableRequest: AbortController | undefined;
  let filters: URLSearchParams | undefined;
  let selection = { day:'', segment:'', q:'' };
  let pageCursors = [''];
  let nextCursor: string | null = null;
  let retryCursors = [''];
  let drillOrigin: HTMLElement | undefined;
  let scopeLabel = '';
  let evaluatedAt = '';
  let liveView: AnalysisView | undefined;

  function clear() {
    current?.abort();
    tableRequest?.abort();
    filters = undefined;
    liveView = undefined;
    evaluatedAt = '';
    drillOrigin = undefined;
    csv.hidden = cohortExport.hidden = capacity.hidden = tablePanel.hidden = panel.hidden = true;
    for (const control of dashboard.querySelectorAll<HTMLElement>('[data-hd-dashboard-drill]')) control.hidden = true;
    csv.removeAttribute('href');
    cohortExport.removeAttribute('href');
    tbody.replaceChildren();
  }

  function setScopeLabel(label: string) {
    scopeLabel = label;
    if (evaluatedAt && filters && panel.dataset.source === 'system') {
      const days = Math.round((Date.parse(filters.get('to')!) - Date.parse(filters.get('from')!)) / 86400000);
      context.textContent = `${scopeLabel} · ${days} hari terakhir · Dinilai ${stamp.format(new Date(evaluatedAt))} WIB`;
    }
  }

  function select(day: string, segment: string, origin?: HTMLElement) {
    if (origin) drillOrigin = origin;
    selection = { day, segment, q:'' };
    search.value = '';
    void loadTable(['']);
    tableHeading.focus();
  }

  function drill(label: string, enabled: boolean, day: string, segment = '') {
    if (!enabled) return element('span', label);
    const button = element('button', label);
    button.type = 'button';
    button.className = 'hd-analysis-drill';
    button.addEventListener('click', () => select(day, segment, button));
    return button;
  }

  function charts(analytics: DashboardAnalytics, canReadRows: boolean) {
    const total = analytics.daily.reduce((sum, day) => sum + day.accepted, 0);
    get('trend-total').textContent = number.format(total) + ' tiket diterima';
    get('trend-empty').hidden = total > 0;
    get('chart').hidden = total === 0;
    const chartMax = Math.max(4, Math.ceil(Math.max(0, ...analytics.daily.map(day => day.accepted)) / 4) * 4);
    get('scale').replaceChildren(...[1, .75, .5, .25, 0].map(part => element('span', number.format(chartMax * part))));
    const trend = analytics.daily.map(day => {
      const label = shortDay.format(new Date(day.day + 'T00:00:00+07:00'));
      const bar = drill(label, canReadRows && day.accepted > 0, day.day);
      bar.classList.add('hd-trend-day');
      const value = element('span', number.format(day.accepted));
      value.className = 'hd-trend-count';
      const fill = element('span');
      fill.className = 'hd-trend-fill';
      fill.style.setProperty('--bar-size', `${day.accepted / chartMax * 100}%`);
      fill.setAttribute('aria-hidden', 'true');
      const cancelled = Math.max(0, day.accepted - day.active - day.completed);
      for (const [series, count] of [['active',day.active], ['completed',day.completed], ['cancelled',cancelled]] as const) {
        if (!count) continue;
        const segment = element('span');
        segment.dataset.series = series;
        segment.style.flexGrow = String(count);
        fill.append(segment);
      }
      bar.prepend(value, fill);
      const caption = `${label}: ${day.accepted} diterima, ${day.active} aktif, ${day.completed} selesai, ${cancelled} dibatalkan`;
      bar.title = caption;
      if (bar instanceof HTMLButtonElement) bar.setAttribute('aria-label', caption);
      return bar;
    });
    trendPlot.style.setProperty('--hd-trend-days', String(trend.length));
    trendPlot.replaceChildren(...trend);
    const buttons = trendPlot.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button, index) => {
      button.tabIndex = index ? -1 : 0;
      button.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight Home End');
    });
    get('daily').replaceChildren(...analytics.daily.map(day => {
      const row = element('tr');
      const heading = element('th', shortDay.format(new Date(day.day + 'T00:00:00+07:00')));
      heading.scope = 'row';
      row.append(heading);
      for (const [field, segment] of [['accepted',''],['active','active'],['completed','completed']] as const) {
        const td = element('td');
        const value = drill(number.format(day[field]), canReadRows && day[field] > 0, day.day, segment);
        if (value instanceof HTMLButtonElement) value.setAttribute('aria-label', `${day[field]} ${labels[segment] ?? 'tiket diterima'} pada ${heading.textContent}`);
        td.append(value);
        row.append(td);
      }
      return row;
    }));
    for (const key of ['age','deadline'] as const) {
      const sum = analytics[key].reduce((count, item) => count + item.count, 0);
      const bars = get(key);
      bars.hidden = sum === 0;
      get(key + '-empty').hidden = sum > 0;
      bars.replaceChildren(...analytics[key].map(item => {
        const row = element('li');
        row.dataset.tone = deadlineTone[item.key] ?? 'active';
        const caption = drill(`${labels[item.key]} · ${number.format(item.count)}`, canReadRows && item.count > 0, '', item.key);
        const line = element('span');
        line.setAttribute('aria-hidden', 'true');
        line.style.setProperty('--bar-size', `${sum ? item.count / sum * 100 : 0}%`);
        row.append(caption, line);
        return row;
      }));
    }
  }

  trendPlot.addEventListener('keydown', event => {
    const current = event.target;
    if (!(current instanceof HTMLButtonElement)) return;
    const buttons = [...trendPlot.querySelectorAll('button')];
    const index = buttons.indexOf(current);
    const destinations: Record<string, number> = {
      ArrowLeft:index - 1, ArrowRight:index + 1, Home:0, End:buttons.length - 1,
    };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    const next = buttons[destinations[event.key]];
    if (!next) return;
    current.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });

  async function loadTable(cursors: string[]) {
    if (!filters || tablePanel.hidden) return;
    tableRequest?.abort();
    const request = new AbortController();
    tableRequest = request;
    const params = new URLSearchParams(filters);
    params.set('limit', '20');
    const cursor = cursors.at(-1);
    if (cursor) params.set('cursor', cursor);
    for (const [name, value] of Object.entries(selection)) if (value) params.set(name, value);
    get('selection').textContent = [
      selection.day ? shortDay.format(new Date(selection.day + 'T00:00:00+07:00')) : 'Semua tanggal dalam periode',
      labels[selection.segment] ?? 'Seluruh status',
      selection.q && `Pencarian: ${selection.q}`,
    ].filter(Boolean).join(' · ');
    retryCursors = cursors;
    tableRetry.hidden = true;
    tableContent.hidden = false;
    tableContent.setAttribute('aria-busy', 'true');
    dashboardFeedback(tableStatus, 'loading', 'Memuat daftar tiket…');
    tbody.replaceChildren();
    prev.disabled = next.disabled = true;
    try {
      const page = await api<Page<Components['DashboardRow']>>('/reports/dashboard-tickets?' + params, 'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      pageCursors = cursors;
      nextCursor = page.next_cursor;
      prev.disabled = cursors.length === 1;
      next.disabled = !nextCursor;
      for (const ticket of page.items) {
        const row = element('tr');
        row.dataset.ticketId = ticket.id;
        const link = element('a', ticket.title);
        link.href = '/admin/app/tickets/detail.html?id=' + encodeURIComponent(ticket.id);
        const title = element('th');
        title.scope = 'row';
        title.append(link, element('small', ticket.number));
        const state = element('td');
        state.append(statusMarker(ticketState(ticket), stateTone[ticket.state] ?? 'active'));
        const received = element('td');
        received.append(dateValue(ticket.accepted_at));
        const age = element('td', ticket.age_seconds === null ? '—' : number.format(ticket.age_seconds / 3600) + ' jam');
        const due = element('td');
        if (ticket.due_at) due.append(dateValue(ticket.due_at));
        if (ticket.deadline !== 'none') due.append(statusMarker(labels[ticket.deadline], deadlineTone[ticket.deadline]));
        if (!due.childNodes.length) due.textContent = '—';
        row.append(title, state, received, age, due);
        tbody.append(row);
      }
      tableContent.hidden = !page.items.length;
      dashboardFeedback(tableStatus, page.items.length ? 'ready' : 'empty',
        page.items.length ? `Halaman ${cursors.length} · ${page.items.length} tiket` : 'Tidak ada tiket yang cocok dengan filter. Ubah pencarian atau hapus filter rincian.');
    } catch (error) {
      if (!request.signal.aborted) {
        tableContent.hidden = false;
        dashboardFeedback(tableStatus, 'error', errorText(error));
        tableRetry.hidden = false;
      }
    } finally {
      if (!request.signal.aborted) tableContent.setAttribute('aria-busy', 'false');
    }
  }

  get<HTMLFormElement>('search').addEventListener('submit', event => {
    event.preventDefault();
    selection.q = search.value.trim();
    void loadTable(['']);
  });
  get('reset').addEventListener('click', () => select('', ''));
  get('back').addEventListener('click', () => {
    const target = drillOrigin?.getClientRects().length ? drillOrigin : dashboard.querySelector<HTMLElement>('#hd-dashboard-heading');
    target?.focus();
  });
  tableRetry.addEventListener('click', () => { tableHeading.focus(); void loadTable(retryCursors); });
  prev.addEventListener('click', () => {
    if (pageCursors.length > 1) { tableHeading.focus(); void loadTable(pageCursors.slice(0, -1)); }
  });
  next.addEventListener('click', () => {
    if (nextCursor) { tableHeading.focus(); void loadTable([...pageCursors, nextCursor]); }
  });
  for (const [card, segment] of [['accepted',''], ['backlog','active'], ['completed','completed']] as const) {
    const button = dashboard.querySelector<HTMLButtonElement>('[data-hd-dashboard-drill="' + card + '"]');
    button?.addEventListener('click', () => select('', segment, button));
  }

  async function technical(params: URLSearchParams, signal: AbortSignal, canExport: boolean) {
    const values = get('performance-values');
    const status = get('performance-status');
    values.replaceChildren();
    dashboardFeedback(status, 'loading', 'Memuat kinerja teknis…');
    performanceLink.href = '/admin/app/helpdesk/index.html?kind=reports&' + params + '#kinerja-teknis';
    try {
      const data = await api<Components['TechnicalPerformance']>('/reports/technical-performance?' + params, 'GET', undefined, undefined, undefined, {}, signal);
      if (signal.aborted) return;
      showValues(values, [
        ['Tiket unik diselesaikan', number.format(data.resolved_tickets)],
        ['Upaya resolusi', number.format(data.resolution_attempts)],
        ['Waktu tercatat', number.format(data.work_seconds / 3600) + ' jam'],
        ['SLA upaya resolusi', data.sla_percent === null ? 'Belum terukur' : `${number.format(data.sla_percent)}% (${data.sla_met}/${data.sla_measured})`],
      ]);
      dashboardFeedback(status, data.watermark ? 'ready' : 'empty',
        data.watermark ? 'Aktivitas terbaru ' + stamp.format(new Date(data.watermark)) + ' WIB.' : 'Belum ada aktivitas teknis dalam periode terpilih.');
      if (canExport) {
        csv.href = '/api/v1/reports/technical-performance.csv?' + params;
        csv.hidden = false;
      }
    } catch (error) {
      if (!signal.aborted) dashboardFeedback(status, 'error', errorText(error));
    }
  }

  async function roster(org: string, signal: AbortSignal) {
    const values = get('capacity-values');
    const status = get('capacity-status');
    values.replaceChildren();
    dashboardFeedback(status, 'loading', 'Memuat kapasitas…');
    rosterLink.href = '/admin/app/helpdesk/index.html?kind=availability&organization_id=' + encodeURIComponent(org) + '#roster';
    const query = new URLSearchParams({ organization_id:org, limit:'100' });
    try {
      const teams = await api<Page<Components['RosterTeam']>>('/staff/roster-teams?' + query, 'GET', undefined, undefined, undefined, {}, signal);
      if (signal.aborted) return;
      if (teams.next_cursor || !teams.items.length) {
        dashboardFeedback(status, 'empty', teams.next_cursor ? 'Pilih tim di halaman jadwal untuk melihat kapasitasnya.' : 'Belum ada tim aktif dalam mandat jadwal.');
        return;
      }
      query.delete('limit');
      for (const team of teams.items) query.append('team_id', team.id);
      const data = await api<Components['TechnicalCapacity']>('/admin/technical-capacity?' + query, 'GET', undefined, undefined, undefined, {}, signal);
      if (signal.aborted) return;
      showValues(values, [
        ['Teknisi dalam jadwal', number.format(data.technicians)],
        ['Teknisi tersedia', number.format(data.available)],
        ['Slot tersisa terukur', data.measured ? number.format(data.remaining) : 'Belum terukur'],
      ]);
      dashboardFeedback(status, 'ready', `${number.format(teams.items.length)} tim dalam mandat jadwal · Dinilai ${stamp.format(new Date(data.assessed_at))} WIB.`);
    } catch (error) {
      if (!signal.aborted) dashboardFeedback(status, 'error', errorText(error));
    }
  }

  function setMode(example: boolean) {
    panel.dataset.source = example ? 'example' : 'system';
    liveMode.setAttribute('aria-pressed', String(!example));
    demoMode.setAttribute('aria-pressed', String(example));
    get('demo-note').hidden = !example;
    get('source').hidden = !allowExample;
    rosterLink.hidden = performanceLink.hidden = example;
  }

  function renderSystem({ data, params, counts }: AnalysisView) {
    setMode(false);
    const org = params.get('organization_id')!;
    const mandates = session?.actor.memberships.filter(m => m.organization_id === org && m.organization_active) ?? [];
    const hasPD = (...permissions: string[]) => mandates.some(m => !m.team_id && permissions.every(p => m.permissions.includes(p)));
    const canReadRows = hasPD('report.read', 'ticket.read');
    filters = new URLSearchParams(params);
    filters.delete('view');
    evaluatedAt = data.evaluated_at;
    setScopeLabel(scopeLabel);
    panel.hidden = false;
    tablePanel.hidden = !canReadRows;
    get('access').hidden = canReadRows;
    for (const control of dashboard.querySelectorAll<HTMLElement>('[data-hd-dashboard-drill]')) {
      control.hidden = !canReadRows || !counts[control.dataset.hdDashboardDrill ?? ''];
    }
    charts(data, canReadRows);
    search.value = '';
    selection = { day:'', segment:'', q:'' };
    if (canReadRows) void loadTable(['']);
    const request = new AbortController();
    current = request;
    const canExport = hasPD('report.read','report.export');
    cohortExport.hidden = !canExport;
    if (canExport) cohortExport.href = '/admin/app/helpdesk/index.html?kind=reports&' + filters + '#laporan-sla';
    void technical(filters, request.signal, canExport);
    capacity.hidden = !mandates.some(m => (m.permissions.includes('identity.grant') && m.permissions.includes('rules.write')) ||
      (session?.actor.role === 'COORDINATOR' && m.permissions.includes('ticket.dispatch')));
    if (!capacity.hidden) void roster(org, request.signal);
  }

  function renderExample() {
    if (!allowExample || !liveView || panel.dataset.source === 'example') return;
    current?.abort();
    tableRequest?.abort();
    filters = undefined;
    drillOrigin = undefined;
    tbody.replaceChildren();
    setMode(true);
    context.textContent = 'Unit Layanan TIK Contoh · 16–22 Nov 2026 (WIB)';
    tablePanel.hidden = cohortExport.hidden = csv.hidden = get('access').hidden = true;
    for (const link of [csv, cohortExport, rosterLink, performanceLink]) link.removeAttribute('href');
    for (const control of dashboard.querySelectorAll<HTMLElement>('[data-hd-dashboard-drill]')) control.hidden = true;
    charts(exampleAnalytics, false);
    capacity.hidden = false;
    dashboardFeedback(get('capacity-status'), 'ready', 'Ilustrasi untuk 2 tim.');
    showValues(get('capacity-values'), [
      ['Teknisi dalam jadwal','8'], ['Teknisi tersedia','5'], ['Slot tersisa terukur','13'],
    ]);
    dashboardFeedback(get('performance-status'), 'ready', 'Ilustrasi aktivitas selama 7 hari.');
    showValues(get('performance-values'), [
      ['Tiket unik diselesaikan','49'], ['Upaya resolusi','52'], ['Waktu tercatat','62 jam'], ['SLA upaya resolusi','90% (45/50)'],
    ]);
  }

  liveMode.addEventListener('click', () => {
    if (liveView && panel.dataset.source === 'example') renderSystem(liveView);
  });
  demoMode.addEventListener('click', renderExample);

  function render(data: DashboardAnalytics | undefined, params: URLSearchParams, counts: Record<string, number>) {
    if (!data) return;
    liveView = { data, params, counts };
    renderSystem(liveView);
  }
  return { clear, setScopeLabel, render };
}
