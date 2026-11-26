import { api, errorText } from './transport';
import type { Components } from './business-types.generated';
import { applyReportLink } from './report-link-context';

type OptionValue = { value: string; label: string };
type Page<T> = { items: T[]; next_cursor: string | null };
type Mandate = { organization_id: string; organization_active: boolean; team_id?: string | null; permissions: string[] };
const wib = new Intl.DateTimeFormat('id-ID', { timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'short' });
const numbers = new Intl.NumberFormat('id-ID',{maximumFractionDigits:2});
const formatHours = (seconds: number) => numbers.format(seconds / 3600) + ' jam';

export function bindTechnicalPerformance(organizations: OptionValue[], mandates: Mandate[], own: boolean) {
  const panel = document.querySelector<HTMLElement>('[data-hd-technical-report]');
  if (!panel || !organizations.length) return;
  const $ = <T extends HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  const form = $<HTMLFormElement>('form');
  const org = $<HTMLSelectElement>('#hd-technical-report-org');
  const team = $<HTMLSelectElement>('#hd-technical-report-team');
  const from = $<HTMLInputElement>('#hd-technical-report-from');
  const to = $<HTMLInputElement>('#hd-technical-report-to');
  const status = $('[data-hd-technical-report-status]');
  const summary = $('[data-hd-technical-report-summary]');
  const exportLink = $<HTMLAnchorElement>('[data-hd-technical-report-export]');
  const fetchButton = $<HTMLButtonElement>('button[type=submit]');
  const formatInput = (d: number) => new Date(d + 7 * 3600000).toISOString().slice(0,16);
  from.value = formatInput(Date.now()-30*86400000);
  to.value = formatInput(Date.now()+60000);
  org.replaceChildren(...organizations.map(option => new Option(option.label,option.value)));
  applyReportLink(org, from, to);
  if (own) $('[data-hd-technical-report-title]').textContent = 'Pencapaian Saya';
  let current: AbortController | undefined;
  let teamRequest: AbortController | undefined;

  const clearResults = () => {
    current?.abort();
    fetchButton.disabled = false;
    exportLink.hidden = true;
    summary.replaceChildren();
    status.textContent = '';
  };
  const loadTeams = async () => {
    clearResults();
    teamRequest?.abort();
    const request = new AbortController();
    teamRequest = request;
    team.disabled = true;
    team.replaceChildren(new Option('Semua tim dalam mandat',''));
    status.textContent = 'Memuat tim…';
    const path = '/reports/technical-teams?organization_id=' + encodeURIComponent(org.value) + '&limit=100';
    try {
      let cursor: string | null = null;
      do {
        const result: Page<Components['TechnicalTeam']> = await api(path+(cursor ? '&cursor='+encodeURIComponent(cursor) : ''),
          'GET', undefined, undefined, undefined, {}, request.signal);
        if (request.signal.aborted) return;
        team.append(...result.items.map(item => new Option(item.name,item.id)));
        cursor = result.next_cursor;
      } while (cursor);
      status.textContent = '';
    } catch (err) {
      if (!request.signal.aborted) status.textContent = errorText(err);
    } finally {
      if (!request.signal.aborted) team.disabled = false;
    }
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    clearResults();
    const lower = new Date(from.value+'+07:00'), upper = new Date(to.value+'+07:00');
    if (!(upper>lower)) {
      status.textContent = 'Waktu akhir harus setelah waktu mulai.';
      to.focus();
      return;
    }
    const query = new URLSearchParams({organization_id:org.value, from:lower.toISOString(), to:upper.toISOString()});
    if (team.value) query.set('team_id',team.value);
    const request = new AbortController();
    current = request;
    fetchButton.disabled = true;
    status.textContent = 'Menghitung kinerja…';
    try {
      const data = await api<Components['TechnicalPerformance']>('/reports/technical-performance?'+query,
        'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      const rows = [
        ['Tiket unik diselesaikan',String(data.resolved_tickets)],
        ['Upaya resolusi',String(data.resolution_attempts)],
        ['Dikonfirmasi pelapor',String(data.confirmed)],
        ['Ditutup otomatis',String(data.auto_closed)],
        ['Dibuka kembali',String(data.reopened)],
        ['Catatan pekerjaan',data.work_logs + ' catatan · ' + formatHours(data.work_seconds)],
        ['Pemenuhan SLA resolusi',data.sla_percent == null ? 'Belum ada upaya terukur'
          : numbers.format(data.sla_percent) + '% (' + data.sla_met + '/' + data.sla_measured + ')'],
        ['Upaya tanpa data SLA lengkap',String(data.sla_unmeasured)],
        ['Waktu SLA bruto / neto',formatHours(data.gross_seconds) + ' / ' + formatHours(data.net_seconds)],
      ];
      for (const [label,value] of rows) {
        const term = document.createElement('dt'), description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        summary.append(term,description);
      }
      status.textContent = data.watermark
        ? 'Aktivitas terbaru dalam periode ' + wib.format(new Date(data.watermark)) + ' WIB.'
        : 'Belum ada aktivitas dalam periode terpilih.';
      if (mandates.some(m => m.organization_active && m.organization_id === org.value &&
          m.permissions.includes('report.export') && (!m.team_id || m.team_id === team.value))) {
        exportLink.href = '/api/v1/reports/technical-performance.csv?'+query;
        exportLink.hidden = false;
      }
    } catch (err) {
      if (!request.signal.aborted) status.textContent = errorText(err);
    } finally {
      if (!request.signal.aborted) fetchButton.disabled = false;
    }
  });
  org.addEventListener('change', () => void loadTeams());
  for (const control of [team,from,to]) control.addEventListener('change',clearResults);
  return loadTeams;
}
