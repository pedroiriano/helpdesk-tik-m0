import type { Components } from './business-types.generated';
import { api, APIError } from './transport';

type Mandate = { organization_active: boolean; organization_id: string; permissions: string[] };
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export function initDashboard(memberships: Mandate[], role = '') {
  const dashboard = document.querySelector<HTMLElement>('[data-hd-page="dashboard"]');
  if (!dashboard) return;
  const get = <T extends HTMLElement>(selector: string) => dashboard.querySelector<T>(selector)!;
  const form = get<HTMLFormElement>('[data-hd-dashboard-filter]');
  const organizations = get<HTMLSelectElement>('#hd-dashboard-org');
  const period = get<HTMLSelectElement>('#hd-dashboard-period');
  const results = get('[data-hd-dashboard-results]');
  const state = get('[data-hd-dashboard-status]');
  const active = memberships.filter(m => m.organization_active);
  const scopes = [...new Set(active.filter(m => m.permissions.includes('report.read')).map(m => m.organization_id))];
  get('[data-hd-dashboard-login]').hidden = active.length > 0;
  for (const link of dashboard.querySelectorAll<HTMLElement>('[data-hd-dashboard-grant]')) {
    const grant = link.dataset.hdDashboardGrant ?? '';
    link.hidden = !active.some(m => m.permissions.includes(grant)) || grant === 'ticket.resolve' && role !== 'TECHNICIAN';
  }
  if (!scopes.length) {
    if (active.length) get('#hd-dashboard-heading').textContent = 'Mulai pekerjaan';
    state.textContent = active.length ? 'Pilih pintasan tugas di atas sesuai peran dan mandat organisasi Anda.' : 'Masuk dengan akun petugas untuk membuka ruang kerja Anda.';
    return;
  }
  for (const org of scopes) {
    organizations.append(new Option(scopes.length === 1 ? 'Organisasi dalam mandat Anda' : org, org));
  }
  form.hidden = false;
  let pending: AbortController | undefined;

  async function load() {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    results.hidden = true;
    state.textContent = 'Memuat ringkasan tiket…';
    const now = Date.now();
    const to = new Date(now).toISOString();
    const days = period.value === '30' ? 30 : 7;
    const from = new Date(now - days * 86400000).toISOString();
    const params = new URLSearchParams({from, to, organization_id: organizations.value});
    try {
      const report = await api<Components['Report']>('/reports?' + params, 'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      get('[data-hd-dashboard-accepted]').textContent = number.format(report.accepted);
      get('[data-hd-dashboard-backlog]').textContent = number.format(report.backlog);
      get('[data-hd-dashboard-completed]').textContent = number.format(report.completed);
      const rate = report.sla_percent === null ? 'Belum terukur' : number.format(report.sla_percent) + '%';
      get('[data-hd-dashboard-rate]').textContent = rate;
      const meter = get<HTMLMeterElement>('#hd-dashboard-meter');
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
      const watermark = report.watermark ? date.format(new Date(report.watermark)) + ' WIB' : 'Belum ada fakta';
      get('[data-hd-dashboard-watermark]').textContent =
        `Fakta terbaru · ${watermark}. Dibaca ${date.format(new Date(report.as_of))} WIB.`;
      state.textContent = report.accepted ? `Tiket diterima ${date.format(new Date(from))} hingga ${date.format(new Date(to))} WIB.` : 'Belum ada tiket diterima dalam periode ini.';
      results.hidden = false;
    } catch (error) {
      if (request.signal.aborted) return;
      state.textContent = error instanceof APIError ? error.message : 'Ringkasan gagal dimuat. Periksa koneksi lalu perbarui ringkasan.';
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); void load(); });
  document.addEventListener('hd:unauthorized', () => {
    pending?.abort();
    results.hidden = form.hidden = true;
    state.textContent = 'Sesi telah berakhir. Masuk kembali untuk melihat laporan.';
    get('[data-hd-dashboard-login]').hidden = false;
  });
  void load();
}
