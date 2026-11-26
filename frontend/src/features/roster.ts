import { api, durableIntent, errorText } from './transport';
import type { Components } from './business-types.generated';

type Option = { value: string; label: string };
type Page<T> = { items: T[]; next_cursor: string | null };
type Subject = { id: string; name: string; role: string };
type Team = Components['RosterTeam'];
type Roster = Components['Roster'];
type Input = Components['RosterWrite'];
const availabilityLabel: Record<string, string> = {
  INACTIVE: 'Nonaktif', ABSENT: 'Berhalangan', OUTSIDE_SCHEDULE: 'Di luar jadwal',
  UNCONFIGURED: 'Belum dikonfigurasi', UNKNOWN_LOAD: 'Beban belum diketahui',
  AVAILABLE: 'Tersedia', FULL: 'Kapasitas penuh',
};
const wib = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const toInput = (v: string) => new Date(Date.parse(v) + 7 * 3600000).toISOString().slice(0, 16);

export function bindRoster(organizations: Option[]): void {
  const panel = document.querySelector<HTMLElement>('[data-hd-roster]');
  if (!panel || !organizations.length) return;
  const get = <T extends HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  const org = get<HTMLSelectElement>('#hd-roster-org');
  const division = get<HTMLSelectElement>('#hd-roster-division');
  const team = get<HTMLSelectElement>('#hd-roster-team');
  const scope = get<HTMLDetailsElement>('[data-hd-roster-scope]');
  const scopeLabel = get('[data-hd-roster-scope-label]');
  const newButton = get<HTMLButtonElement>('[data-hd-roster-new]');
  const editorTitle = get('[data-hd-roster-editor-title]');
  const form = get<HTMLFormElement>('[data-hd-roster-form]');
  const subject = get<HTMLSelectElement>('#hd-roster-subject');
  const status = get('[data-hd-roster-status]');
  const capacityStatus = get('[data-hd-roster-capacity]');
  const all = get<HTMLButtonElement>('[data-hd-roster-summary-all]');
  let capacityRequest: AbortController | undefined;
  const loadCapacity = async (teamIDs: string[]) => {
    capacityRequest?.abort();
    const request = new AbortController();
    capacityRequest = request;
    capacityStatus.textContent = 'Menghitung kapasitas…';
    const query = new URLSearchParams({ organization_id: org.value });
    teamIDs.forEach(id => query.append('team_id', id));
    try {
      const data = await api<Components['TechnicalCapacity']>('/admin/technical-capacity?' + query,
        'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      const label = teamIDs.length > 1 ? 'Kapasitas gabungan' : 'Kapasitas tim';
      const measured = data.measured + ' dari ' + data.technicians + ' teknisi terukur';
      capacityStatus.textContent = !data.technicians ? label + ' · Belum ada teknisi yang sedang bertugas.'
        : !data.measured ? label + ' belum terukur · ' + measured + '.'
        : label + ' · ' + data.available + ' teknisi tersedia · ' + data.remaining + ' slot tersisa · ' +
          measured + ' · ' + wib.format(new Date(data.assessed_at)) + ' WIB.';
    } catch (err) {
      if (!request.signal.aborted) capacityStatus.textContent = errorText(err);
    }
  };
  const rows = get('[data-hd-roster-rows]');
  const more = get<HTMLButtonElement>('[data-hd-roster-more]');
  const submit = get<HTMLButtonElement>('button[type=submit]');
  const save = durableIntent<Input>();
  let directory: Subject[] = [];
  let selected: Roster | undefined;
  let cursor: string | null = null;
  let pending: AbortController | undefined;
  let busy = false;
  let editorTrigger: HTMLButtonElement | undefined;

  const reset = () => { selected = undefined; form.reset(); subject.disabled = false; };
  const syncScope = () => {
    scopeLabel.textContent = [
      org.selectedOptions[0]?.text,
      division.value ? division.selectedOptions[0]?.text : '',
      team.value ? team.selectedOptions[0]?.text : '',
    ].filter(Boolean).join(' · ') || 'Pilih cakupan jadwal';
  };
  const showEditor = (title: string, trigger: HTMLButtonElement) => {
    editorTrigger = trigger;
    editorTitle.textContent = title;
    form.hidden = false;
    editorTitle.focus();
  };
  const returnToList = () => {
    form.hidden = true;
    (editorTrigger?.isConnected ? editorTrigger : newButton).focus();
  };
  const clearList = () => {
    capacityRequest?.abort();
    capacityStatus.textContent = '';
    cursor = null;
    newButton.hidden = more.hidden = form.hidden = true;
    rows.replaceChildren();
    reset();
  };
  const load = async (append = false) => {
    pending?.abort();
    if (!append) clearList();
    syncScope();
    if (!team.value) {
      status.textContent = 'Pilih tim teknis untuk melihat jadwal.';
      return;
    }
    if (!append) void loadCapacity([team.value]);
    const request = new AbortController();
    pending = request;
    status.textContent = 'Memuat jadwal…';
    more.disabled = true;
    try {
      const path = '/admin/teams/' + team.value + '/rosters?organization_id=' + org.value;
      const getPage = () => api<Page<Roster>>(path + (append && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
        'GET', undefined, undefined, undefined, {}, request.signal);
      const staffPath = '/staff/directory?' + new URLSearchParams({organization_id:org.value,team_id:team.value});
      const [page,staff] = await Promise.all([getPage(),append ? Promise.resolve(undefined)
        : api<{items:Subject[]}>(staffPath,'GET',undefined,undefined,undefined,{},request.signal)]);
      if (request.signal.aborted) return;
      if (staff) {
        directory = staff.items;
        subject.replaceChildren(new Option('Pilih teknisi',''), ...directory.map(item=>new Option(item.name,item.id)));
      }
      for (const item of page.items) {
        const row = document.createElement('tr');
        const name = directory.find(person => person.id === item.subject_id)?.name ?? 'Teknisi tidak aktif / di luar direktori';
        const period = wib.format(new Date(item.available_from)) + ' – ' + wib.format(new Date(item.available_until));
        const current = item.availability ? availabilityLabel[item.availability.status] : 'Belum dinilai';
        const capacity = item.capacity == null ? 'Belum diatur'
          : item.availability?.remaining == null ? String(item.capacity) : item.availability.remaining + ' dari ' + item.capacity + ' slot tersisa';
        for (const cell of [name, item.skills.join(', '), period, current, capacity, wib.format(new Date(item.updated_at))]) {
          const td = document.createElement('td'); td.textContent = cell; row.append(td);
        }
        const action = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'piui-btn piui-btn--secondary piui-btn--sm';
        button.textContent = 'Ubah';
        button.addEventListener('click', () => {
          if (busy) return;
          reset();
          selected = item;
          if (![...subject.options].some(option => option.value === item.subject_id)) subject.add(new Option(name, item.subject_id));
          subject.value = item.subject_id;
          subject.disabled = true;
          get<HTMLInputElement>('#hd-roster-skills').value = item.skills.join(', ');
          get<HTMLInputElement>('#hd-roster-from').value = toInput(item.available_from);
          get<HTMLInputElement>('#hd-roster-until').value = toInput(item.available_until);
          get<HTMLSelectElement>('#hd-roster-active').value = String(item.active);
          get<HTMLInputElement>('#hd-roster-limit').value = item.capacity == null ? '' : String(item.capacity);
          showEditor('Ubah jadwal', button);
        });
        action.append(button); row.append(action); rows.append(row);
      }
      cursor = page.next_cursor;
      more.hidden = !cursor;
      newButton.hidden = !directory.length;
      status.textContent = directory.length
        ? rows.childElementCount ? `${rows.childElementCount} jadwal ditampilkan.` : 'Belum ada jadwal pada tim ini.'
        : 'Belum ada teknisi dengan mandat aktif pada tim ini. Periksa Akun dan hak akses.';
    } catch (err) {
      if (!request.signal.aborted) status.textContent = errorText(err);
    } finally {
      if (!request.signal.aborted) more.disabled = false;
    }
  };

  let availableTeams: Team[] = [];
  const loadOrg = async (resetDivision = true, pickDivision = '', pickTeam = '', initial = false) => {
    pending?.abort();
    clearList();
    team.replaceChildren();
    all.hidden = true;
    subject.replaceChildren();
    directory = [];
    if (resetDivision) division.replaceChildren(new Option('Semua bidang',''));
    syncScope();
    const request = new AbortController();
    pending = request;
    const chosen = org.value;
    if (!chosen) return;
    status.textContent = 'Memuat tim dan teknisi…';
    try {
      if (resetDivision) {
        const teams: Team[] = [];
        let next: string | null = null;
        do {
          const query = new URLSearchParams({organization_id:chosen,limit:'100'});
          const result: Page<Team> = await api('/staff/roster-teams?' + query + (next ? '&cursor=' + encodeURIComponent(next) : ''),
            'GET', undefined, undefined, undefined, {}, request.signal);
          if (request.signal.aborted) return;
          teams.push(...result.items);
          next = result.next_cursor;
        } while (next);
        availableTeams = teams;
        const divisions = new Map(teams.filter(item => item.division_id && item.division_name)
          .map(item=>[item.division_id!,item.division_name!]));
        for (const [id,name] of divisions) division.add(new Option(name,id));
        if (divisions.has(pickDivision)) division.value = pickDivision;
      }
      const visible = availableTeams.filter(item => !division.value || item.division_id === division.value);
      team.replaceChildren(new Option('Pilih tim teknis', ''), ...visible.map(item => new Option(item.name, item.id)));
      all.hidden = visible.length < 2 || visible.length > 100;
      status.textContent = visible.length ? 'Pilih tim teknis.' : 'Belum ada tim aktif untuk pilihan PD dan bidang ini.';
      const preferred = visible.some(item => item.id === pickTeam) ? pickTeam : visible.length === 1 ? visible[0].id : "";
      if (preferred) {
        team.value = preferred;
        if (initial) scope.open = false;
        await load();
      }
    } catch (err) {
      if (!request.signal.aborted) status.textContent = errorText(err);
    }
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const values = new FormData(form);
    const from = new Date(String(values.get('from')) + '+07:00');
    const until = new Date(String(values.get('until')) + '+07:00');
    if (!(until > from)) {
      status.textContent = 'Waktu selesai harus setelah waktu mulai.';
      status.focus();
      return;
    }
    const input: Input = {
      subject_id: selected?.subject_id ?? subject.value,
      skills: String(values.get('skills')).split(',').map(s => s.trim()).filter(Boolean),
      available_from: from.toISOString(),
      available_until: until.toISOString(),
      active: values.get('active') === 'true',
      reason: String(values.get('reason')).trim(),
      expected_version: selected?.version ?? 0,
      ...(values.get('capacity') ? {capacity: Number(values.get('capacity'))} : {}),
    };
    const path = '/admin/teams/' + team.value + '/rosters' + (selected ? '/' + selected.id : '') + '?organization_id=' + org.value;
    const method = selected ? 'PUT' : 'POST';
    busy = submit.disabled = org.disabled = division.disabled = team.disabled = more.disabled = true;
    try {
      await save(path, input, (key, original) => api<Roster>(path, method, original, key));
      await load();
      status.textContent = 'Jadwal tersimpan.';
      status.focus();
    } catch (err) {
      status.textContent = errorText(err);
      status.focus();
    } finally {
      busy = submit.disabled = org.disabled = division.disabled = team.disabled = more.disabled = false;
    }
  });
  newButton.addEventListener('click', () => {
    if (busy) return;
    reset();
    showEditor('Tambah jadwal', newButton);
  });
  get<HTMLButtonElement>('[data-hd-roster-reset]').addEventListener('click', () => {
    if (busy) return;
    reset();
    returnToList();
  });
  more.addEventListener('click', () => { if (!busy) void load(true); });
  all.addEventListener('click', () => { if (!busy) void loadCapacity([...team.options].map(item => item.value).filter(Boolean)); });
  team.addEventListener('change', () => { void load(); });
  org.addEventListener('change', () => { void loadOrg(); });
  division.addEventListener('change', () => { void loadOrg(false); });
  org.replaceChildren(...organizations.map(item => new Option(item.label, item.value)));
  const route = new URLSearchParams(location.search);
  const initialOrg = route.get('organization_id') ?? '';
  const uid = (key: string) => {
    const value = route.get(key) ?? '';
    return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value) ? value : '';
  };
  if (location.hash === '#roster' && organizations.some(entry => entry.value === initialOrg)) {
    org.value = initialOrg;
  }
  panel.hidden = false;
  if (route.get('kind') === 'availability' || location.hash === '#roster') {
    scope.open = true;
    void loadOrg(true,uid('division_id'),uid('team_id'),true);
  }
}

export function bindPersonalRoster(organizations: Option[]): void {
  const panel = document.querySelector<HTMLElement>('[data-hd-personal-roster]');
  if (!panel || !organizations.length) return;
  const get = <T extends HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  const org = get<HTMLSelectElement>('#hd-personal-roster-org');
  const schedule = get('[data-hd-personal-roster-items]');
  const scheduleStatus = get('[data-hd-personal-roster-status]');
  const nextSchedule = get<HTMLButtonElement>('[data-hd-personal-roster-more]');
  const absences = get('[data-hd-absence-items]');
  const nextAbsence = get<HTMLButtonElement>('[data-hd-absence-more]');
  const form = get<HTMLFormElement>('[data-hd-absence-form]');
  const submit = get<HTMLButtonElement>('button[type=submit]');
  const reset = get<HTMLButtonElement>('[data-hd-absence-reset]');
  const status = get('[data-hd-absence-status]');
  const starts = get<HTMLInputElement>('#hd-absence-from');
  const ends = get<HTMLInputElement>('#hd-absence-until');
  const reason = get<HTMLInputElement>('#hd-absence-reason');
  const save = durableIntent<Components['TechnicianAbsenceWrite'] | Components['VersionedReason']>();
  type Absence = Components['TechnicianAbsence'];
  let selected: Absence | undefined;
  let scheduleCursor: string | null = null;
  let absenceCursor: string | null = null;
  let currentSchedule: AbortController | undefined;

  const period = (from: string, to: string) => wib.format(new Date(from)) + ' – ' + wib.format(new Date(to));
  const changeMode = (item?: Absence) => {
    selected = item;
    form.reset();
    starts.disabled = ends.disabled = !!item;
    starts.parentElement!.hidden = ends.parentElement!.hidden = !!item;
    submit.textContent = item ? 'Konfirmasi pembatalan' : 'Simpan ketidakhadiran';
    reset.hidden = !item;
    status.textContent = item ? 'Batalkan periode ' + period(item.starts_at, item.ends_at) + '.' : '';
  };
  const loadSchedule = async (append = false) => {
    currentSchedule?.abort();
    const request = new AbortController();
    currentSchedule = request;
    nextSchedule.disabled = true;
    if (!append) schedule.replaceChildren();
    scheduleStatus.textContent = 'Memuat jadwal…';
    const query = new URLSearchParams({organization_id: org.value});
    if (append && scheduleCursor) query.set('cursor', scheduleCursor);
    try {
      const result = await api<Page<Roster>>('/technicians/me/rosters?' + query, 'GET', undefined, undefined, undefined, {}, request.signal);
      if (request.signal.aborted) return;
      for (const item of result.items) {
        const row = document.createElement('li');
        row.textContent = [item.team_name, period(item.available_from, item.available_until), item.skills.join(', '),
          item.availability ? availabilityLabel[item.availability.status] : null].filter(Boolean).join(' · ');
        schedule.append(row);
      }
      scheduleCursor = result.next_cursor;
      nextSchedule.hidden = !scheduleCursor;
      scheduleStatus.textContent = schedule.childElementCount ? '' : 'Belum ada jadwal pada organisasi ini.';
    } catch (err) {
      if (!request.signal.aborted) scheduleStatus.textContent = errorText(err);
    } finally {
      if (!request.signal.aborted) nextSchedule.disabled = false;
    }
  };
  const loadAbsences = async (append = false) => {
    nextAbsence.disabled = true;
    if (!append) absences.replaceChildren();
    try {
      const result = await api<Page<Absence>>('/technicians/me/absences' + (append && absenceCursor ? '?cursor=' + encodeURIComponent(absenceCursor) : ''));
      for (const item of result.items) {
        const row = document.createElement('li');
        row.textContent = period(item.starts_at, item.ends_at) + (item.cancelled ? ' · Dibatalkan' : '');
        if (!item.cancelled && Date.parse(item.ends_at) > Date.now()) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'piui-btn piui-btn--secondary piui-btn--sm';
          button.textContent = 'Batalkan';
          button.addEventListener('click', () => { if (!submit.disabled) { changeMode(item); reason.focus(); } });
          row.append(' ', button);
        }
        absences.append(row);
      }
      absenceCursor = result.next_cursor;
      nextAbsence.hidden = !absenceCursor;
      if (!absences.childElementCount) {
        const row = document.createElement('li');
        row.textContent = 'Belum ada catatan ketidakhadiran.';
        absences.append(row);
      }
    } catch (err) {
      status.textContent = errorText(err);
    } finally {
      nextAbsence.disabled = false;
    }
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    const path = '/technicians/me/absences' + (selected ? '/' + selected.id + '/cancel' : '');
    const from = new Date(starts.value + '+07:00'), until = new Date(ends.value + '+07:00');
    if (!selected && !(until > from)) {
      status.textContent = 'Waktu selesai harus setelah waktu mulai.';
      ends.focus();
      return;
    }
    const input = selected ? {expected_version: selected.version, reason: reason.value.trim()}
      : {starts_at: from.toISOString(), ends_at: until.toISOString(), reason: reason.value.trim()};
    submit.disabled = reset.disabled = nextAbsence.disabled = true;
    try {
      const result = await save(path, input, (key, original) => api<Absence>(path, 'POST', original, key));
      changeMode();
      status.textContent = result.cancelled ? 'Ketidakhadiran dibatalkan.' : 'Ketidakhadiran tersimpan.';
      await Promise.all([loadAbsences(), loadSchedule()]);
    } catch (err) {
      status.textContent = errorText(err);
      status.focus();
    } finally {
      submit.disabled = reset.disabled = nextAbsence.disabled = false;
    }
  });
  reset.addEventListener('click', () => { changeMode(); starts.focus(); });
  org.addEventListener('change', () => { void loadSchedule(); });
  nextSchedule.addEventListener('click', () => { void loadSchedule(true); });
  nextAbsence.addEventListener('click', () => { void loadAbsences(true); });
  org.replaceChildren(...organizations.map(item => new Option(item.label, item.value)));
  panel.hidden = false;
  void loadSchedule();
  void loadAbsences();
}
