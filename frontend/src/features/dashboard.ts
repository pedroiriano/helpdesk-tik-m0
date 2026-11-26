import type { Components } from './business-types.generated';
import { api, APIError } from './transport';
import { bindDashboardAnalysis } from './dashboard-analysis';
import { dashboardFeedback } from './dashboard-feedback';

type Session = Components['Session'];
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export function initDashboard(session: Session | undefined) {
  const dashboard = document.querySelector<HTMLElement>('[data-hd-page="dashboard"]');
  if (!dashboard) return;
  const get = <T extends HTMLElement>(selector: string) => dashboard.querySelector<T>(selector)!;
  const form = get<HTMLFormElement>('[data-hd-dashboard-filter]');
  const organizations = get<HTMLSelectElement>('#hd-dashboard-org');
  const period = get<HTMLSelectElement>('#hd-dashboard-period');
  const results = get('[data-hd-dashboard-results]');
  const settings = get<HTMLDetailsElement>('[data-hd-dashboard-settings]');
  const detailResults = get('[data-hd-dashboard-detail-results]');
  const context = get('[data-hd-dashboard-context]');
  const state = get('[data-hd-dashboard-status]');
  const heading = get('#hd-dashboard-heading');
  const skeleton = get('[data-hd-dashboard-loading]');
  const retry = get<HTMLButtonElement>('[data-hd-dashboard-retry]');
  const widerPeriod = get<HTMLButtonElement>('[data-hd-dashboard-expand-period]');
  const cohort = get('#hd-dashboard-cohort');
  const login = get('[data-hd-dashboard-login]');
  const analysis = bindDashboardAnalysis(dashboard, session);
  let pending: AbortController | undefined;
  document.addEventListener('hd:unauthorized', () => {
    pending?.abort();
    analysis.clear();
    context.hidden = settings.hidden = results.hidden = detailResults.hidden = form.hidden =
      skeleton.hidden = cohort.hidden = retry.hidden = widerPeriod.hidden = true;
    results.setAttribute('aria-busy', 'false');
    dashboardFeedback(state, 'error', 'Sesi telah berakhir. Masuk kembali untuk melihat laporan.');
    login.hidden = false;
  });
  const staff = session?.actor.kind === 'STAFF';
  const active = staff ? session.actor.memberships.filter(m => m.organization_active) : [];
  const scopes = [...new Set(active.filter(m => !m.team_id && m.permissions.includes('report.read')).map(m => m.organization_id))];
  login.hidden = staff;
  if (!scopes.length) {
    const assigned = new Set(active.map(m => m.organization_id)).size;
    dashboardFeedback(state, 'empty', staff
      ? `Mandat aktif di ${number.format(assigned)} PD. Ringkasan tiket tersedia untuk pemegang mandat laporan tingkat PD.`
      : 'Masuk dengan akun petugas untuk membuka ruang kerja Anda.');
    return;
  }
  for (const org of scopes) {
    organizations.append(new Option(scopes.length === 1 ? 'PD dalam mandat Anda' : 'PD ' + (organizations.length + 1), org));
  }
  const scopeName = get('[data-hd-dashboard-scope-name]');
  const showScope = () => {
    scopeName.textContent = organizations.selectedOptions[0]?.text ?? 'PD dalam mandat Anda';
    analysis.setScopeLabel(scopeName.textContent);
  };
  void api<{items: Components['DirectoryEntry'][]}>('/reporting/directory?limit=100').then(directory => {
    for (const option of organizations.options) {
      const name = directory.items.find(item => item.id === option.value)?.name;
      if (name) option.textContent = name;
    }
    showScope();
  }).catch(() => {});
  settings.hidden = form.hidden = false;

  async function load() {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    analysis.clear();
    results.hidden = detailResults.hidden = context.hidden = cohort.hidden = retry.hidden = widerPeriod.hidden = true;
    skeleton.hidden = false;
    results.setAttribute('aria-busy', 'true');
    dashboardFeedback(state, 'loading', 'Memuat ringkasan tiket…');
    const now = Date.now();
    const to = new Date(now).toISOString();
    const days = period.value === '30' ? 30 : 7;
    const from = new Date(now - days * 86400000).toISOString();
    const organization = organizations.value;
    const params = new URLSearchParams({from, to, organization_id: organization, view:'dashboard'});
    try {
      const report = await api<Components['Report']>('/reports?' + params, 'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      get('[data-hd-dashboard-accepted]').textContent = number.format(report.accepted);
      get('[data-hd-dashboard-backlog]').textContent = number.format(report.backlog);
      get('[data-hd-dashboard-completed]').textContent = number.format(report.completed);
      const rate = report.sla_percent === null ? 'Belum terukur' : number.format(report.sla_percent) + '%';
      const rateValue = get('[data-hd-dashboard-rate]');
      rateValue.textContent = rate;
      rateValue.dataset.unmeasured = String(report.sla_percent === null);
      const meter = get<HTMLMeterElement>('#hd-dashboard-meter');
      get('[data-hd-dashboard-ratio]').textContent = report.sla_percent === null
        ? 'Belum ada penyelesaian dengan target dan waktu selesai yang dapat diukur.'
        : `${number.format(report.count)} dari ${number.format(report.denominator)} penyelesaian terukur tepat waktu (${rate}).`;
      meter.hidden = report.sla_percent === null;
      meter.value = report.sla_percent ?? 0;
      meter.textContent = rate;
      const rows = get('[data-hd-dashboard-metrics]');
      rows.replaceChildren();
      for (const [label, value] of [
        ['Penyelesaian dengan target terukur', report.denominator],
        ['Selesai tepat waktu', report.count],
        ['Selesai terlambat', report.breached],
        ['Selesai tanpa pengukuran', report.unmeasured],
      ] as const) {
        const row = document.createElement('tr');
        const name = document.createElement('th');
        name.scope = 'row';
        name.textContent = label;
        const amount = document.createElement('td');
        amount.textContent = number.format(value);
        row.append(name, amount);
        rows.append(row);
      }
      get('[data-hd-dashboard-window]').textContent =
        `Diterima mulai ${date.format(new Date(from))} hingga sebelum ${date.format(new Date(to))} WIB. Selesai ditangani mencakup tiket yang menunggu konfirmasi pelapor dan tiket yang sudah ditutup. Tiket dibatalkan: ${number.format(report.cancelled)}.`;
      const watermark = report.watermark ? date.format(new Date(report.watermark)) + ' WIB' : 'Belum ada fakta';
      const policy = report.policy_version === null
        ? 'Tidak ada satu versi kebijakan yang dilaporkan.'
        : `Versi kebijakan SLA ${number.format(report.policy_version)}.`;
      get('[data-hd-dashboard-watermark]').textContent =
        `Pembaruan data: ${watermark}. Dibaca ${date.format(new Date(report.as_of))} WIB. ${policy}`;
      showScope();
      get('[data-hd-dashboard-range]').textContent = `${days} hari terakhir (WIB)`;
      context.hidden = false;
      dashboardFeedback(state, report.accepted ? 'ready' : 'empty', report.accepted ? '' : 'Belum ada tiket diterima dalam periode ini.');
      widerPeriod.hidden = report.accepted > 0 || days === 30;
      skeleton.hidden = true;
      results.hidden = detailResults.hidden = cohort.hidden = false;
      results.setAttribute('aria-busy', 'false');
      analysis.render(report.analytics, params, { accepted:report.accepted, backlog:report.backlog, completed:report.completed });
    } catch (error) {
      if (request.signal.aborted) return;
      skeleton.hidden = true;
      results.setAttribute('aria-busy', 'false');
      const forbidden = error instanceof APIError && error.status === 403;
      dashboardFeedback(state, 'error', forbidden
        ? 'Akses laporan untuk perangkat daerah ini tidak tersedia. Periksa mandat atau pilih PD lain.'
        : 'Ringkasan gagal dimuat. Periksa koneksi lalu coba lagi.');
      retry.hidden = forbidden;
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); void load(); });
  form.addEventListener('change', () => { void load(); });
  retry.addEventListener('click', () => { heading.focus(); void load(); });
  widerPeriod.addEventListener('click', () => { heading.focus(); period.value = '30'; void load(); });
  void load();
}
