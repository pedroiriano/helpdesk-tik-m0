import { sessionBus } from './session-events';
import { syncAdminShell, bindAdminPagePicker } from './admin-shell';
import { adminItems, canNavigate, canOpenAdminPage, adminPageContext, roleLabels, adminSubjects } from '../../admin-navigation.mjs';
import { syncJourney, serviceLoginHref, loginDestination } from './journey';
import { initDashboard } from './dashboard';
import { initKnowledgeBase } from "./knowledge";
import { api, APIError, errorText, csrf } from './transport';
import type { Components } from './business-types.generated';
import { setupSearchCombobox } from './search-combobox';

type Session = Components['Session'];
type Service = Components['Service'];
type Field = Components['Form']['fields'][number];
type FormSnapshot = Components['Form'];
type Policy = Components['Policy'];
type Page<T> = { items: T[]; next_cursor: string | null; as_of: string };
type Master = Partial<Service & Components['Category'] & Components['Organization'] & Components['Team'] & Components['Membership']> & { id: string; version: number };
const $ = <T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document): T | null => parent.querySelector<T>(selector);
const nodes = <T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document): T[] => [...parent.querySelectorAll<T>(selector)];
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; };
const status = (selector: string, message: string, parent: ParentNode = document) => { const el = $(selector, parent); if (el) el.textContent = message; };
const control = (form: HTMLFormElement, name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const value = (form: HTMLFormElement, name: string) => control(form, name).value.trim();
const checked = (form: HTMLFormElement, name: string) => (control(form, name) as HTMLInputElement).checked;
const options = (select: HTMLSelectElement, entries: { value: string; label: string }[], blank = false) => {
  select.replaceChildren(); if (blank) { const option = element('option', 'Tanpa pilihan'); option.value = ''; select.append(option); }
  for (const entry of entries) { const option = element('option', entry.label); option.value = entry.value; select.append(option); }
};
let session: Session | undefined;

sessionBus?.addEventListener('message', () => { document.dispatchEvent(new Event('hd:unauthorized')); location.reload(); });
window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
document.addEventListener('hd:unauthorized', () => { session = undefined; syncJourney(undefined); syncAdminShell(undefined); nodes('[data-hd-session]').forEach(el=>el.textContent='Sesi berakhir atau belum tersedia. Silakan masuk.'); const panel = $('[data-hd-admin]'); if (panel) panel.hidden = true; $('[data-hd-rows]')?.replaceChildren(); nodes('[data-hd-logout]').forEach(el => el.hidden = true); });
async function loadSession(): Promise<void> {
  try { session = await api<Session>('/auth/me'); } catch (e) { if (!(e instanceof APIError && e.status === 401)) { status('[data-hd-session]', errorText(e)); throw e; } }
  syncJourney(session); syncAdminShell(session);
  const message = session ? `${session.actor.name} · ${roleLabels[session.actor.role] ?? 'Petugas'} · Lab sintetis` : 'Anda sedang mengakses sebagai tamu.';
  nodes('[data-hd-session]').forEach(el => el.textContent = message);
  const profile = $('#popover-profile strong'); if (profile) profile.textContent = session?.actor.name ?? 'Belum masuk';
  nodes<HTMLButtonElement>('[data-hd-logout]').forEach(button => { button.hidden = !session; button.addEventListener('click', async () => {
    button.disabled = true; try { await api('/auth/logout', 'POST', { expected_version: session?.version, reason: 'Logout pengguna' }); sessionBus?.postMessage('SESSION_CHANGED'); location.assign('/layanan.html'); }
    catch (e) { if (e instanceof APIError && e.status === 401) location.assign('/layanan.html'); else status('[data-hd-session]', errorText(e)); } finally { button.disabled = false; }
  }); });
}
function intent() { let previous = '', key = ''; return (path: string, payload: unknown) => { const serialized = path + JSON.stringify(payload); if (serialized !== previous) { previous = serialized; key = crypto.randomUUID(); } return key; }; }
async function registerUser(form: HTMLFormElement): Promise<void> {
  try {
    const boot = await api<Components['Bootstrap']>('/auth/bootstrap');
    const submit = $('button[type=submit]', form) as HTMLButtonElement | null;
    status('[data-hd-register-status]', 'Siap mendaftarkan akun baru. Lengkapi formulir di atas.', form);
    const key = intent();
    let pending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      const pwd = control(form, 'password').value;
      const pwdConfirm = control(form, 'password_confirm').value;
      if (pwd !== pwdConfirm) {
        status('[data-hd-register-status]', 'Konfirmasi kata sandi tidak cocok. Silakan periksa kembali.', form);
        control(form, 'password_confirm').focus();
        return;
      }
      const nik = value(form, 'nik');
      if (!/^\d{16}$/.test(nik)) {
        status('[data-hd-register-status]', 'NIK harus terdiri dari 16 digit angka.', form);
        control(form, 'nik').focus();
        return;
      }
      pending = true;
      if (submit) submit.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status('[data-hd-register-status]', 'Memvalidasi format dan mendaftarkan akun lab…', form);
      const payload = {
        nik,
        name: value(form, 'name'),
        email: value(form, 'email'),
        phone: value(form, 'phone'),
        password: pwd,
        csrf_token: boot.csrf_token
      };
      try {
        await api('/auth/register', 'POST', payload, key('/auth/register', payload), boot.csrf_token);
        status('[data-hd-register-status]', 'Pendaftaran berhasil! Mengalihkan ke tiket saya…', form);
        sessionBus?.postMessage('SESSION_CHANGED');
        setTimeout(() => location.assign('/tiket.html'), 500);
      } catch (e) {
        status('[data-hd-register-status]', errorText(e), form);
        $('[data-hd-register-status]', form)?.focus();
      } finally {
        pending = false;
        if (submit) submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  } catch (e) {
    status('[data-hd-register-status]', errorText(e), form);
  }
}

async function login(form: HTMLFormElement, bootstrap: Promise<Components['Bootstrap']>, initializePicker: boolean): Promise<void> {
  try {
    const boot = await bootstrap;
    const isAdminLogin = form.hasAttribute('data-hd-admin-login');
    const labSubjects = isAdminLogin ? adminSubjects(boot.subjects) : boot.subjects;
    const submit = $('button[type=submit]', form) as HTMLButtonElement | null;
    if (submit) submit.disabled = false;
    status('[data-hd-login-status]', 'Masukkan identitas akun atau gunakan aktivasi cepat peran lab.', form);

    if (initializePicker) {
      const tabs = nodes<HTMLButtonElement>('[data-auth-tab]');
      const selectTab = (selected: HTMLButtonElement) => {
        for (const tab of tabs) {
          const active = tab === selected;
          tab.setAttribute('aria-selected', String(active));
          tab.tabIndex = active ? 0 : -1;
          const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
          if (panel) panel.hidden = !active;
        }
      };
      if (tabs[0]) selectTab(tabs[0]);
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectTab(tab));
        tab.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
          if (next) { selectTab(next); next.focus(); }
        });
      });

      const subjectSelect = $<HTMLSelectElement>('#hd-subject') ?? $<HTMLSelectElement>('select[name=subject]', form);
      if (subjectSelect) {
        options(subjectSelect, labSubjects.map(s => ({ value: s.id, label: `${s.name} · ${isAdminLogin ? roleLabels[s.role ?? ''] ?? 'Petugas' : s.role || s.kind}` })));
        subjectSelect.disabled = false;
      }
      const roleCodes: Record<string, string> = {admin:'SUPER_ADMIN',superadmin:'SUPER_ADMIN',operator:'OPERATOR',koordinator:'COORDINATOR',teknisi:'TECHNICIAN',kadis:'LEADERSHIP',pimpinan:'LEADERSHIP',auditor:'AUDITOR',asn:'ASN',warga:'PUBLIC',publik:'PUBLIC'};
      let switching = false;
      const labKey = intent();
      for (const button of nodes<HTMLButtonElement>('[data-quick-login], [data-hd-lab-select]')) {
        button.disabled = false;
        button.addEventListener('click', async () => {
          if (switching) return;
          const role = button.dataset.quickLogin;
          const subject = labSubjects.find(s => role ? s.role === roleCodes[role] : s.id === subjectSelect?.value);
          const feedback = '[data-hd-lab-status]';
          if (!subject) { status(feedback, 'Pilih identitas lab terlebih dahulu.'); subjectSelect?.focus(); return; }
          switching = true;
          button.disabled = true;
          status(feedback, 'Mengaktifkan sesi lab…');
          try {
            const payload = { lab_subject_id: subject.id, csrf_token: boot.csrf_token };
            const path = '/auth/sessions';
            const res = await api<{ actor?: { kind?: string } }>(path, 'POST', payload, labKey(path, payload), boot.csrf_token);
            sessionBus?.postMessage('SESSION_CHANGED');
            location.assign(loginDestination(res.actor?.kind, location.search));
          } catch (e) {
            status(feedback, errorText(e));
            $(feedback)?.focus();
          } finally {
            switching = false;
            button.disabled = false;
          }
        });
      }
    }

    const key = intent();
    let pending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      pending = true;
      if (submit) submit.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status('[data-hd-login-status]', 'Memverifikasi dan menyimpan sesi…', form);

      let payload: Record<string, unknown>;
      const identifierInput = control(form, 'identifier');
      const passwordInput = control(form, 'password');
      if (identifierInput && passwordInput) {
        payload = {
          identifier: value(form, 'identifier'),
          password: passwordInput.value,
          csrf_token: boot.csrf_token
        };
      } else {
        payload = {
          lab_subject_id: value(form, 'subject'),
          csrf_token: boot.csrf_token
        };
      }

      try {
        const res = await api<{ actor?: { kind?: string } }>('/auth/sessions', 'POST', payload, key('/auth/sessions', payload), boot.csrf_token);
        sessionBus?.postMessage('SESSION_CHANGED');
        location.assign(loginDestination(res.actor?.kind, location.search));
      } catch (e) {
        status('[data-hd-login-status]', errorText(e), form);
        $('[data-hd-login-status]', form)?.focus();
      } finally {
        pending = false;
        if (submit) submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  } catch (e) {
    status('[data-hd-login-status]', errorText(e), form);
  }
}
async function catalog(): Promise<void> {
  const root = $('[data-hd-catalog]')!; let cursor = ''; let next: string | null = null; const history: string[] = [];
  async function load() { status('[data-hd-status]', 'Memuat katalog sesuai hak akses…'); root.setAttribute('aria-busy', 'true'); root.replaceChildren();
    try { const page = await api<Page<Service>>('/catalog/services?limit=12' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')); next = page.next_cursor;
      for (const service of page.items) {
        const card = element('article', '', 'vy-contact-form');
        card.classList.add('hd-service-option');
        const topRow = element('div', '');
        topRow.className = 'hd-service-option__meta';
        const codeBadge = element('p', service.code, 'court-badge');
        codeBadge.style.margin = '0';
        const isGuest = service.access_mode === 'PUBLIC_GUEST';
        const audText = isGuest ? 'Bisa Tanpa Login (Warga)' : (service.access_mode === 'ASN_AUTH' ? 'Khusus ASN Depok' : audience(service.access_mode));
        const audBadge = element('span', audText, 'court-badge');

        topRow.append(codeBadge, audBadge);
        const title = element('h2', service.name);

        const contentDiv = element('div', '');
        contentDiv.append(topRow, title);
        const actDiv = element('div', '', 'hd-actions');

        const btnLapor = element('a', '', 'btn btn-primary');
        btnLapor.textContent = 'Buat laporan';
        btnLapor.href = '/lapor.html?id=' + encodeURIComponent(service.id);
        const btnDetail = element('a', '', 'btn btn-secondary');
        btnDetail.textContent = 'Lihat syarat layanan';
        btnDetail.href = '/detail-layanan.html?id=' + encodeURIComponent(service.id);
        actDiv.append(btnLapor, btnDetail);
        card.append(contentDiv, actDiv);
        root.append(card);
      }
      status('[data-hd-status]', page.items.length ? `${page.items.length} layanan pada halaman ini.` : 'Belum ada layanan yang tersedia untuk hak akses ini.');
    } catch (e) { next = null; status('[data-hd-status]', errorText(e)); }
    finally { root.removeAttribute('aria-busy'); ($('[data-hd-prev]') as HTMLButtonElement).disabled = history.length === 0; ($('[data-hd-next]') as HTMLButtonElement).disabled = !next; }
  }
  $('[data-hd-prev]')?.addEventListener('click', () => { cursor = history.pop() ?? ''; void load(); }); $('[data-hd-next]')?.addEventListener('click', () => { if (next) { history.push(cursor); cursor = next; void load(); } }); await load();
}
const audience = (mode: string) => ({ PUBLIC_GUEST: 'Publik tanpa login', PUBLIC_AUTH: 'Publik dengan akun', ASN_AUTH: 'ASN sesuai organisasi', STAFF_ONLY: 'Petugas sesuai organisasi' })[mode] ?? mode;
const SERVICE_SLUGS: Record<string, string> = {
  'akses-internet-opd': 'TIK-NET-01',
  'jaringan-internet-intranet': 'TIK-NET-01',
  'email-dinas-depok': 'TIK-EML-01',
  'akun-email-kedinasan': 'TIK-EML-01',
  'subdomain-hosting-portal': 'TIK-DOM-01',
  'subdomain-opd': 'TIK-DOM-01',
  'integrasi-aplikasi-spbe': 'TIK-INT-01',
  'splp-api': 'TIK-INT-01',
  'pengajuan-tte-bsre': 'TIK-TTE-01',
  'tte-bsre': 'TIK-TTE-01',
  'insiden-keamanan-csirt': 'TIK-SEC-01',
  'penanganan-insiden-csirt': 'TIK-SEC-01',
  'fasilitasi-video-conference': 'TIK-VIC-01',
  'vicon-pimpinan': 'TIK-VIC-01',
  'pemeliharaan-server-virtual': 'TIK-SRV-01',
  'colocation-data-center': 'TIK-SRV-01',
  'instalasi-jaringan-lan-wifi': 'TIK-LAN-01',
  'pemeliharaan-lan-wifi': 'TIK-LAN-01',
  'dukungan-simpeg-kinerja': 'TIK-SIM-01',
  'aplikasi-kepegawaian-simpeg': 'TIK-SIM-01',
  'dukungan-sipd-simda': 'TIK-KEU-01',
  'sistem-keuangan-daerah': 'TIK-KEU-01',
  'depok-single-window-dsw': 'TIK-DSW-01',
  'aplikasi-dsw': 'TIK-DSW-01',
  'pemeliharaan-jaringan-cctv': 'TIK-CCT-01',
  'cctv-pengawasan-kota': 'TIK-CCT-01',
  'wifi-publik-alun-alun': 'TIK-PUB-01',
  'internet-publik-wifi': 'TIK-PUB-01',
  'pendampingan-aplikasi-baru': 'TIK-DEV-01',
  'pembuatan-aplikasi-opd': 'TIK-DEV-01',
  'pemulihan-kredensial-spbe': 'TIK-ACC-01',
  'reset-akun-spbe': 'TIK-ACC-01'
};
async function detail(): Promise<void> {
  const params = new URLSearchParams(location.search);
  let id = params.get('id') ?? params.get('layanan') ?? params.get('slug') ?? params.get('service') ?? '';
  if (!id && location.pathname.startsWith('/layanan/')) {
    id = location.pathname.replace(/^\/layanan\//, '').replace(/\.html$/, '').replace(/\/$/, '');
  }
  if (!/^[0-9a-f-]{36}$/i.test(id) && id) {
    try {
      const targetCode = (SERVICE_SLUGS[id.toLowerCase()] ?? id).toLowerCase();
      const page = await api<Page<Service>>('/catalog/services?limit=100');
      const found = page.items.find(s => s.code.toLowerCase() === targetCode || s.code.toLowerCase() === id.toLowerCase() || s.id === id);
      if (found) id = found.id;
    } catch {}
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    const isAsnOnly = id && (SERVICE_SLUGS[id.toLowerCase()] || id.startsWith('TIK-'));
    if (isAsnOnly) {
      status('[data-hd-status]', 'Layanan ini memerlukan autentikasi Pegawai / ASN Pemerintah Kota Depok.');
      const detailContainer = $('[data-hd-detail]');
      if (detailContainer) {
        detailContainer.hidden = false;
        detailContainer.replaceChildren();
        const alertBox = element('div', '', 'vy-contact-form');
        alertBox.style.cssText = 'background:#f0f7ff;border:1px solid #b6d4fe;padding:20px;border-radius:8px;margin-top:12px;';
        alertBox.innerHTML = '<h2 style="color:#004085;font-size:1.25rem;margin:0 0 8px 0;">Autentikasi ASN Diperlukan</h2>' +
          '<p style="color:#004085;font-size:14px;line-height:1.6;margin:0 0 16px 0;">Spesifikasi layanan ini dikhususkan bagi Perangkat Daerah dan Aparatur Sipil Negara (ASN) Pemerintah Kota Depok. Gunakan identitas ASN sintetis pada halaman akses lab untuk melihat spesifikasi lengkap. Integrasi SSO nyata belum diaktifkan.</p>' +
          '<div class="hd-actions"><a href="' + serviceLoginHref(id, 'detail') + '" class="btn btn-primary">Masuk dan kembali ke layanan</a><a href="/layanan.html" class="btn" style="background:#f6f8fa;border:1px solid #d0d7de;color:#24292f;text-decoration:none;padding:10px 18px;border-radius:6px;">← Kembali ke Katalog</a></div>';
        detailContainer.append(alertBox);
      }
      return;
    }
    status('[data-hd-status]', 'Tautan layanan tidak valid.');
    return;
  }
  const detailContainer = $('[data-hd-detail]');
  const topActions = element('div', '', 'hd-actions');
  topActions.style.cssText = 'margin:12px 0 20px;display:flex;gap:12px;flex-wrap:wrap;';
  const btnCreateTop = element('a', '', 'btn btn-primary');
  btnCreateTop.innerHTML = '<span class="hd-btn-icon">🚀</span> Ajukan Permohonan / Buat Tiket Sekarang →';
  btnCreateTop.href = '/lapor.html?id=' + encodeURIComponent(id);
  topActions.append(btnCreateTop);
  detailContainer?.prepend(topActions);
  const btnCreateBottom = element('a', '', 'btn btn-primary');
  btnCreateBottom.innerHTML = '<span class="hd-btn-icon">🚀</span> Lanjutkan Mengisi Formulir Tiket →';
  btnCreateBottom.href = '/lapor.html?id=' + encodeURIComponent(id);
  detailContainer?.append(btnCreateBottom);
  try {
    const service = await api<Service>('/catalog/services/' + id);
    const [form, policy] = await Promise.all([
      api<FormSnapshot>('/catalog/services/' + id + '/form'),
      api<Policy>('/catalog/services/' + id + '/policy')
    ]);
    status('[data-hd-service-name]', service.name);
    const isGuest = service.access_mode === 'PUBLIC_GUEST';
    const audLabel = isGuest ? 'Layanan Terbuka untuk Publik (Dapat Dilaporkan Tanpa Login)' : (service.access_mode === 'ASN_AUTH' ? 'Khusus Pegawai / ASN Pemerintah Kota Depok' : audience(service.access_mode));
    status('[data-hd-service-meta]', `${audLabel} · Formulir versi ${form.form_version} · Kode: ${service.code}`);
    const fields = $('[data-hd-fields]')!;
    fields.replaceChildren();
    for (const field of form.fields) {
      const group = element('div', '', 'vy-input-group');
      const label = element('label', field.label + (field.required ? ' *' : ''));
      let input: HTMLElement;
      if (field.kind === 'choice') {
        const select = element('select', '', 'vy-input') as HTMLSelectElement;
        options(select, field.options.map(v => ({ value: v, label: v })));
        input = select;
      } else if (/uraian|gejala|kronologi|catatan|kebutuhan|kendala|pesan|alasan|justifikasi|tujuan/i.test(field.key) && field.kind !== 'number' && field.kind !== 'date') {
        const textarea = element('textarea', '', 'vy-input') as HTMLTextAreaElement;
        textarea.rows = 2;
        textarea.placeholder = `(Contoh isian ${field.label.toLowerCase()})`;
        input = textarea;
      } else {
        const inp = element('input', '', 'vy-input') as HTMLInputElement;
        inp.type = field.kind === 'number' || field.kind === 'date' ? field.kind : (/email/i.test(field.key) ? 'email' : (/kontak|wa/i.test(field.key) ? 'tel' : 'text'));
        inp.placeholder = `(Contoh isian ${field.label.toLowerCase()})`;
        input = inp;
      }
      input.id = 'preview-' + field.key;
      label.htmlFor = input.id;
      (input as HTMLInputElement).disabled = true;
      group.append(label, input);
      fields.append(group);
    }
    status('[data-hd-policy]', `Ketentuan Lampiran: Kebijakan versi ${policy.policy_version} · Batas berkas ${(policy.upload_max_bytes / 1048576).toLocaleString('id-ID')} MiB · Format didukung: ${policy.allowed_mime.join(', ')}`);
    $('[data-hd-detail]')!.hidden = false;
    status('[data-hd-status]', form.fields.length ? 'Formulir spesifikasi dimuat dari server.' : 'Layanan ini belum memiliki field formulir.');
  } catch (e) { status('[data-hd-status]', errorText(e)); }
}

async function admin(): Promise<void> {
  const can = (p: string) => session ? session.actor.memberships.some(m => m.organization_active && m.permissions.includes(p)) : false;
  const select = $('#hd-master-kind') as HTMLSelectElement;
  const form = $('[data-hd-master-form]') as HTMLFormElement;
  const catalogAllowed = can('catalog.write'), identityAllowed = can('identity.grant');

  if (session?.actor.kind !== 'STAFF') return;
  for (const option of [...select.options]) {
    const item = adminItems.find(i=>i.kind === option.value);
    option.disabled = !item || !canNavigate(item,session);
    option.hidden = option.disabled;
  }
  for (const group of select.querySelectorAll<HTMLOptGroupElement>('optgroup')) group.hidden = !group.querySelector('option:not([hidden])');
  const context = adminPageContext(location.pathname,location.search,session);
  if (!context.item?.kind || !canNavigate(context.item,session)) return;
  select.value = context.item.kind;
  bindAdminPagePicker(select, session);
  if (!new URLSearchParams(location.search).has('kind')) {
    const canonical = new URL(location.href); canonical.searchParams.set('kind',select.value);
    window.history.replaceState(null,'',canonical);
  }
  syncJourney(session); syncAdminShell(session);
  const adminPanel = $('[data-hd-admin]');
  status('[data-hd-status]', 'Menyiapkan halaman pengelolaan…');

  let orgs: Components['Organization'][] = [];
  let categoryPage: { items: Components['Category'][] } = { items: [] };
  let teams: Components['Team'][] = [];
  let subjects: Components['Subject'][] = [];
  try {
    if (identityAllowed || catalogAllowed) {
      orgs = (await api<Page<Components['Organization']>>('/admin/organizations?limit=100')).items;
      subjects = (await api<Components['Bootstrap']>('/auth/bootstrap')).subjects;
    }
  } catch {}

  const orgLabel = (id: string) => orgs.find(o => o.id === id)?.name ?? 'Organisasi terikat';
  if (form) {
    options(control(form, 'org') as HTMLSelectElement, orgs.map(o => ({ value: o.id, label: o.name })));
    options(control(form, 'member-subject') as HTMLSelectElement, subjects.map(s => ({ value: s.id, label: `${s.name} · ${s.role}` })));
  }
  if ($('#hd-audience')) options($('#hd-audience') as HTMLSelectElement, orgs.map(o => ({ value: o.id, label: o.name })));
  const scopedOrganizationOptions = (...permissions: string[]) => {
    const ids = [...new Set((session?.actor.memberships ?? [])
      .filter(m => m.organization_active && permissions.some(p => m.permissions.includes(p)))
      .map(m => m.organization_id))];
    return ids.map(id => ({
      value: id,
      label: orgs.find(org => org.id === id)?.name ?? (ids.length === 1 ? 'Organisasi dalam mandat Anda' : `Organisasi ${id}`),
    }));
  };
  const maintenanceOrg = $<HTMLSelectElement>('#hd-maint-org');
  if (maintenanceOrg) options(maintenanceOrg, scopedOrganizationOptions('system.maintenance'));
  const runnerOrg = $<HTMLSelectElement>('#hd-runner-org');
  if (runnerOrg) options(runnerOrg, scopedOrganizationOptions('system.job'));

  function scopeChoices() {
    if (!form) return;
    const org = value(form, 'org');
    options(control(form, 'category') as HTMLSelectElement, categoryPage.items.filter(c => c.active && c.owner_org_id === org).map(c => ({ value: c.id, label: c.name })), true);
    options(control(form, 'team') as HTMLSelectElement, teams.filter(t => t.active && t.organization_id === org).map(t => ({ value: t.id, label: t.name })), true);
  }

  if (form) {
    control(form, 'org').addEventListener('change', () => {
      control(form, 'category').value = '';
      control(form, 'team').value = '';
      void refreshCategory(true);
      void refreshTeam(true);
    });
  }

  function remotePicker<T extends { id: string; name: string }>(path: string, target: HTMLSelectElement, accept: (rows: T[]) => void, scope: () => string, blank = false) {
    const row = element('div', '', 'hd-actions');
    const prev = element('button', 'Pilihan sebelumnya', 'piui-btn piui-btn--secondary piui-btn--sm');
    const nextBtn = element('button', 'Pilihan berikutnya', 'piui-btn piui-btn--secondary piui-btn--sm');
    const reload = element('button', 'Muat ulang pilihan', 'piui-btn piui-btn--secondary piui-btn--sm');
    for (const button of [prev, nextBtn, reload]) button.type = 'button';
    prev.disabled = true; nextBtn.disabled = true;
    row.append(prev, nextBtn, reload);
    target.parentElement?.append(row);

    let cursor = '', after: string | null = null; const history: string[] = []; let epoch = 0;
    async function loadPicker(reset = false) {
      const requestEpoch = ++epoch;
      if (reset) { cursor = ''; history.length = 0; }
      for (const button of [prev, nextBtn, reload]) button.disabled = true;
      const selectedValues = [...target.selectedOptions].map(o => ({ value: o.value, label: o.textContent ?? 'Pilihan tersimpan' }));
      try {
        const org = scope();
        if (scope !== unscoped && !org) {
          after = null; options(target, [], blank); accept([]); return;
        }
        const page = await api<Page<T>>(path + '?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '') + (org ? '&organization_id=' + encodeURIComponent(org) : ''));
        if (requestEpoch !== epoch) return;
        accept(page.items);
        options(target, page.items.map(v => ({ value: v.id, label: v.name })), blank);
        for (const selectedItem of selectedValues) {
          if (!selectedItem.value) continue;
          if (![...target.options].some(o => o.value === selectedItem.value)) {
            const saved = element('option', selectedItem.label);
            saved.value = selectedItem.value;
            target.append(saved);
          }
          if (target.multiple) {
            const opt = [...target.options].find(o => o.value === selectedItem.value);
            if (opt) opt.selected = true;
          } else {
            target.value = selectedItem.value;
          }
        }
        after = page.next_cursor;
      } catch (e) {
        // Safe catch for remote pickers - do not throw
        console.warn('Picker load error:', e);
      } finally {
        if (requestEpoch === epoch) {
          prev.disabled = !history.length;
          nextBtn.disabled = !after;
          reload.disabled = false;
        }
      }
    }
    prev.addEventListener('click', () => { cursor = history.pop() ?? ''; void loadPicker(); });
    nextBtn.addEventListener('click', () => { if (after) { history.push(cursor); cursor = after; void loadPicker(); } });
    reload.addEventListener('click', () => void loadPicker(true));
    return loadPicker;
  }

  const unscoped = () => '';
  const refreshOrg = remotePicker<Components['Organization']>('/admin/organizations', control(form, 'org') as HTMLSelectElement, rows => { orgs = rows; }, unscoped);
  const refreshCategory = remotePicker<Components['Category']>('/admin/categories', control(form, 'category') as HTMLSelectElement, rows => { categoryPage = { items: rows }; }, () => value(form, 'org'), true);
  const refreshTeam = remotePicker<Components['Team']>('/admin/teams', control(form, 'team') as HTMLSelectElement, rows => { teams = rows; }, () => value(form, 'org'), true);
  
  try { if (identityAllowed) await refreshOrg(true); } catch {}
  try { if (catalogAllowed) await refreshCategory(true); } catch {}
  try { if (identityAllowed) await refreshTeam(true); } catch {}
  scopeChoices();

  const refreshAudience = remotePicker<Components['Organization']>('/admin/organizations', $('#hd-audience') as HTMLSelectElement, () => {}, unscoped);
  try { if (identityAllowed) await refreshAudience(true); } catch {}

  let selected: Master | undefined, cursor = '', next: string | null = null;
  const history: string[] = [];
  let currentForm: FormSnapshot | undefined, currentPolicy: Policy | undefined;
  const names: Record<string, string> = {
    services: 'layanan',
    categories: 'kategori',
    organizations: 'organisasi',
    teams: 'tim',
    memberships: 'membership dan izin',
    navigation: 'navigasi portal',
    articles: 'artikel panduan',
    notifications: 'notifikasi',
    reports: 'laporan',
    audit: 'audit',
    maintenance: 'pemeliharaan',
    media: 'media'
  };

  const submit = $('button[type=submit]', form) as HTMLButtonElement | null;

  function configure(row?: Master) {
    selected = row;
    if (form) form.reset();
    const kind = select.value;
    const fields: Record<string, string[]> = {
      services: ['code', 'name', 'org', 'category', 'access', 'active'],
      categories: ['code', 'name', 'org', 'active'],
      organizations: ['code', 'name', 'active'],
      teams: ['name', 'org', 'active'],
      memberships: ['org', 'member-subject', 'team', 'permissions', 'expires', 'reason', 'revoked']
    };

    if (!fields[kind]) {
      if (form) form.hidden = true;
      return;
    }

    if (form) {
      form.hidden = false;
      const allowed = fields[kind];
      nodes<HTMLElement>('[data-hd-field]', form).forEach(wrapper => {
        const visible = allowed.includes(wrapper.dataset.hdField!);
        wrapper.hidden = !visible;
        nodes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea', wrapper).forEach(input => {
          input.disabled = !visible;
          input.required = visible && !['category', 'team', 'active', 'revoked', 'permissions'].includes(wrapper.dataset.hdField!);
        });
      });
      status('[data-hd-editor-title]', `${row ? 'Ubah' : 'Tambah'} ${names[kind] ?? kind}`);
      status('[data-hd-editor-version]', row ? `Versi ${row.version}. Perubahan hanya diterima jika versi masih sama.` : 'Data baru');
      status('[data-hd-save-status]', '');
      if (row) {
        control(form, 'code').value = row.code ?? '';
        control(form, 'name').value = row.name ?? '';
        const rowOrg = row.owner_org_id ?? row.organization_id ?? '';
        if (rowOrg && ![...(control(form, 'org') as HTMLSelectElement).options].some(o => o.value === rowOrg)) {
          const o = element('option', orgLabel(rowOrg));
          o.value = rowOrg;
          (control(form, 'org') as HTMLSelectElement).append(o);
        }
        control(form, 'org').value = rowOrg;
        scopeChoices();
        if (row.category_id && ![...(control(form, 'category') as HTMLSelectElement).options].some(o => o.value === row.category_id)) {
          const o = element('option', 'Kategori tersimpan');
          o.value = row.category_id;
          (control(form, 'category') as HTMLSelectElement).append(o);
        }
        control(form, 'category').value = row.category_id ?? '';
        control(form, 'access').value = row.access_mode ?? 'PUBLIC_GUEST';
        control(form, 'member-subject').value = row.subject_id ?? '';
        if (row.team_id && ![...(control(form, 'team') as HTMLSelectElement).options].some(o => o.value === row.team_id)) {
          const o = element('option', 'Tim tersimpan');
          o.value = row.team_id;
          (control(form, 'team') as HTMLSelectElement).append(o);
        }
        control(form, 'team').value = row.team_id ?? '';
        control(form, 'permissions').value = row.permissions?.join(', ') ?? '';
        (control(form, 'active') as HTMLInputElement).checked = row.active ?? false;
        (control(form, 'revoked') as HTMLInputElement).checked = row.revoked ?? false;
        control(form, 'expires').value = row.expires_at ? new Date(new Date(row.expires_at).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '';
      }
      if (submit) submit.disabled = kind === 'organizations' && !row && !can('identity.organization.create');
      const serviceEditors = $('[data-hd-service-editors]');
      if (serviceEditors) serviceEditors.hidden = kind !== 'services' || !row;
      currentForm = undefined; currentPolicy = undefined;
      if (kind === 'services' && row) void loadEditors(row);
    }
  }

  async function loadEditors(row: Master) {
    const editors = $('[data-hd-service-editors]');
    if (!editors) return;
    nodes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input,select,textarea,button[type=submit],[data-hd-add-field]', editors).forEach(el => el.disabled = true);
    $('[data-hd-form-fields]')!.replaceChildren();
    status('[data-hd-form-status]', 'Memuat versi formulir…');
    status('[data-hd-policy-status]', 'Memuat kebijakan…');
    try {
      const [loadedForm, loadedPolicy] = await Promise.all([
        api<FormSnapshot>(`/admin/services/${row.id}/form`),
        api<Policy>(`/admin/services/${row.id}/policy`)
      ]);
      if (selected?.id !== row.id || selected.version !== row.version) return;
      currentForm = loadedForm; currentPolicy = loadedPolicy;
      const root = $('[data-hd-form-fields]')!;
      root.replaceChildren();
      for (const f of currentForm.fields) addField(f);
      ($('#hd-upload') as HTMLInputElement).value = String(currentPolicy.upload_max_bytes);
      for (const option of [...($('#hd-mime') as HTMLSelectElement).options]) option.selected = currentPolicy.allowed_mime.some(mime => mime === option.value);
      for (const id of currentPolicy.audience_org_ids) {
        const picker = $('#hd-audience') as HTMLSelectElement;
        if (![...picker.options].some(o => o.value === id)) {
          const preserved = element('option', orgLabel(id) + ' · Audience tersimpan');
          preserved.value = id;
          picker.append(preserved);
        }
      }
      for (const option of [...($('#hd-audience') as HTMLSelectElement).options]) option.selected = currentPolicy.audience_org_ids.includes(option.value);
      nodes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input,select,textarea,button[type=submit],[data-hd-add-field]', editors).forEach(el => el.disabled = false);
      status('[data-hd-form-status]', `Formulir versi ${currentForm.form_version} dimuat.`);
      status('[data-hd-policy-status]', `Kebijakan versi ${currentPolicy.policy_version} dimuat.`);
    } catch (e) {
      status('[data-hd-form-status]', errorText(e));
    }
  }

  let listEpoch = 0;

  async function load() {
    const epoch = ++listEpoch;
    const requestedKind = select.value;
    syncJourney(session); syncAdminShell(session);

    const maintSec = $('[data-hd-m11-section]');
    const m9Sec = $('[data-hd-m9-section]');
    const mediaSec = $('[data-hd-media-section]');
    const navSec = $('[data-hd-navigation-section]');
    const artSec = $('[data-hd-articles-section]');
    const masterCard = $('[data-hd-rows]')?.closest('.piui-card') as HTMLElement | null;
    const root = $('[data-hd-rows]');

    // Hide all sub-sections first
    if (maintSec) maintSec.hidden = true;
    if (m9Sec) m9Sec.hidden = true;
    if (mediaSec) mediaSec.hidden = true;
    if (navSec) navSec.hidden = true;
    if (artSec) artSec.hidden = true;
    if (masterCard) masterCard.hidden = true;
    if (form) form.hidden = true;
    const serviceEditors = $('[data-hd-service-editors]');
    if (serviceEditors) serviceEditors.hidden = true;

    if (requestedKind === 'maintenance') {
      if (maintSec) maintSec.hidden = false;
      status('[data-hd-caption]', 'Pemeliharaan Sistem & Scoped Runner');
      status('[data-hd-status]', 'Pilih mode pemeliharaan, ajukan job operasional scoped, atau periksa kesehatan sistem.');
      return;
    }

    if (['notifications', 'reports', 'audit'].includes(requestedKind)) {
      if (m9Sec) {
        m9Sec.hidden = false;
        switchM9Tab(requestedKind);
      }
      status('[data-hd-caption]', `Pusat ${requestedKind}`);
      status('[data-hd-status]', 'Kelola notifikasi, laporan, dan jejak audit.');
      return;
    }

    if (requestedKind === 'media') {
      if (mediaSec) mediaSec.hidden = false;
      status('[data-hd-caption]', 'Pustaka Media Terpadu');
      status('[data-hd-status]', 'Pustaka media dua-owner: M3 tiket privat & M8 editorial publik.');
      void loadAdminMedia(currentMediaOwner);
      return;
    }

    if (requestedKind === 'navigation') {
      if (navSec) navSec.hidden = false;
      status('[data-hd-caption]', 'Pengelolaan Portal & Navigasi Publik');
      status('[data-hd-status]', 'Konfigurasi hierarki rute navigasi portal dan pembatasan audience.');
      void loadNavigation();
      return;
    }

    if (requestedKind === 'articles') {
      if (artSec) artSec.hidden = false;
      status('[data-hd-caption]', 'Basis Pengetahuan & Editorial Artikel');
      status('[data-hd-status]', 'Kelola siklus hidup panduan operasional SPBE Kota Depok.');
      void loadArticles();
      return;
    }

    // Standard Master (services, categories, organizations, teams, memberships)
    if (masterCard) masterCard.hidden = false;
    if (form) form.hidden = false;
    $('[data-hd-new]')!.hidden = false;
    $('[data-hd-refresh]')!.hidden = false;
    $('[data-hd-prev]')!.parentElement!.hidden = false;

    if (!root) return;
    root.replaceChildren();
    status('[data-hd-status]', 'Memuat master dari server…');
    try {
      const page = await api<Page<Master>>(`/admin/${requestedKind}?limit=20${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (epoch !== listEpoch) return;
      next = page.next_cursor;
      for (const row of page.items) {
        const tr = element('tr');
        const label = row.name ?? subjects.find(s => s.id === row.subject_id)?.name ?? 'Membership';
        tr.append(
          element('td', label),
          element('td', orgLabel(row.owner_org_id ?? row.organization_id ?? row.id)),
          element('td', `${row.revoked ? 'Dicabut' : row.active === false ? 'Nonaktif' : 'Aktif'} · v${row.version}`)
        );
        const action = element('td'), edit = element('button', 'Ubah', 'piui-btn piui-btn--secondary piui-btn--sm');
        edit.type = 'button';
        edit.addEventListener('click', () => {
          configure(row);
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          $('input:not([disabled]),select:not([disabled])', form)?.focus({ preventScroll: true });
        });
        action.append(edit);
        tr.append(action);
        root.append(tr);
      }
      if (!page.items.length) {
        const tr = element('tr'), td = element('td', 'Belum ada data pada scope ini.');
        td.colSpan = 4;
        tr.append(td);
        root.append(tr);
      }
      status('[data-hd-caption]', `Master ${names[requestedKind]} · Halaman ${history.length + 1}`);
      status('[data-hd-status]', `${page.items.length} data pada halaman ini. Gunakan navigasi halaman dan navigasi pilihan untuk data berikutnya sesuai scope.`);
    } catch (e) {
      next = null;
      status('[data-hd-status]', errorText(e));
    }
    ($('[data-hd-prev]') as HTMLButtonElement).disabled = !history.length;
    ($('[data-hd-next]') as HTMLButtonElement).disabled = !next;
  }

  $('[data-hd-new]')?.addEventListener('click', () => configure());
  $('[data-hd-refresh]')?.addEventListener('click', () => { configure(); void load(); });
  $('[data-hd-prev]')?.addEventListener('click', () => { cursor = history.pop() ?? ''; void load(); });
  $('[data-hd-next]')?.addEventListener('click', () => { if (next) { history.push(cursor); cursor = next; void load(); } });

  const saveKey = intent();
  let pending = false;
  if (form) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      pending = true;
      if (submit) submit.disabled = true;
      status('[data-hd-save-status]', 'Menyimpan pada server…');
      const kind = select.value;
      const body: Record<string, unknown> = selected ? { expected_version: selected.version } : {};
      if (['services', 'categories', 'organizations'].includes(kind)) body.code = value(form, 'code');
      if (kind !== 'memberships') { body.name = value(form, 'name'); body.active = checked(form, 'active'); }
      if (kind === 'services' || kind === 'categories') body.owner_org_id = value(form, 'org');
      if (kind === 'teams' || kind === 'memberships') body.organization_id = value(form, 'org');
      if (kind === 'services') {
        body.access_mode = value(form, 'access');
        body.category_id = value(form, 'category') || null;
        body.form_version = selected?.form_version ?? 1;
      }
      if (kind === 'memberships') {
        body.subject_id = value(form, 'member-subject');
        body.team_id = value(form, 'team') || null;
        body.permissions = value(form, 'permissions').split(',').map(v => v.trim()).filter(Boolean);
        const expires = new Date(value(form, 'expires') + '+07:00');
        if (Number.isNaN(expires.getTime())) {
          status('[data-hd-save-status]', 'Waktu berlaku tidak valid.');
          pending = false;
          if (submit) submit.disabled = false;
          return;
        }
        body.expires_at = expires.toISOString();
        body.revoked = checked(form, 'revoked');
        body.reason = value(form, 'reason');
      }
      const path = `/admin/${kind}${selected ? '/' + selected.id : ''}`;
      try {
        const result = await api<{ id: string; version: number }>(path, selected ? 'PUT' : 'POST', body, saveKey(path, body));
        status('[data-hd-save-status]', `Tersimpan pada server. Versi ${result.version}.`);
        await load();
        if (selected) configure({ ...selected, ...body, id: result.id, version: result.version } as Master);
      } catch (e) {
        status('[data-hd-save-status]', errorText(e));
        $('[data-hd-save-status]')?.focus();
      } finally {
        pending = false;
        if (submit) submit.disabled = !session;
      }
    });
  }

  function addField(field?: Field) {
    const root = $('[data-hd-form-fields]')!;
    const group = element('fieldset', '', 'hd-field-row'), legend = element('legend', 'Field formulir');
    group.append(legend);
    const grid = element('div', '', 'hd-form-grid');
    for (const [key, label, content] of [
      ['key', 'Key field', field?.key ?? ''],
      ['label', 'Label yang ditampilkan', field?.label ?? ''],
      ['options', 'Pilihan (satu per baris, khusus choice)', field?.options.join('\n') ?? '']
    ] as const) {
      const wrap = element('div', '', 'piui-field'), text = element('label', label), input = key === 'options' ? element('textarea', '', 'piui-input') : element('input', '', 'piui-input');
      input.id = 'field-' + crypto.randomUUID();
      input.dataset.prop = key;
      input.value = content;
      input.required = key !== 'options';
      text.htmlFor = input.id;
      wrap.append(text, input);
      grid.append(wrap);
    }
    const kindWrap = element('div', '', 'piui-field'), kindLabel = element('label', 'Jenis field'), kindInput = element('select', '', 'piui-input');
    kindInput.id = 'kind-' + crypto.randomUUID();
    kindInput.dataset.prop = 'kind';
    kindLabel.htmlFor = kindInput.id;
    options(kindInput, ['text', 'number', 'date', 'choice'].map(v => ({ value: v, label: v })));
    kindInput.value = field?.kind ?? 'text';
    kindWrap.append(kindLabel, kindInput);
    grid.append(kindWrap);
    const required = element('input');
    required.type = 'checkbox';
    required.dataset.prop = 'required';
    required.checked = field?.required ?? false;
    const requiredLabel = element('label', ' Wajib diisi');
    requiredLabel.prepend(required);
    grid.append(requiredLabel);
    group.append(grid);
    const remove = element('button', 'Hapus field dari versi baru', 'piui-btn piui-btn--secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => group.remove());
    group.append(remove);
    root.append(group);
  }

  $('[data-hd-add-field]')?.addEventListener('click', () => addField());
  const formKey = intent(), policyKey = intent();

  async function refreshSelected() {
    if (selected) {
      selected = await api<Master>('/admin/services/' + selected.id);
      status('[data-hd-editor-version]', `Versi ${selected.version}`);
      await loadEditors(selected);
      await load();
    }
  }

  ($('[data-hd-form-editor]') as HTMLFormElement | null)?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected || !currentForm) return;
    const f = event.currentTarget as HTMLFormElement;
    if (!f.reportValidity()) return;
    const button = $('button[type=submit]', f) as HTMLButtonElement;
    button.disabled = true;
    const fields: Field[] = nodes<HTMLFieldSetElement>('fieldset', $('[data-hd-form-fields]')!).map(row => ({
      key: ($('[data-prop=key]', row) as HTMLInputElement).value.trim(),
      label: ($('[data-prop=label]', row) as HTMLInputElement).value.trim(),
      kind: ($('[data-prop=kind]', row) as HTMLSelectElement).value as Field['kind'],
      required: ($('[data-prop=required]', row) as HTMLInputElement).checked,
      options: ($('[data-prop=kind]', row) as HTMLSelectElement).value === 'choice' ? ($('[data-prop=options]', row) as HTMLTextAreaElement).value.split('\n').map(v => v.trim()).filter(Boolean) : []
    }));
    const body: Components['FormWrite'] = { expected_version: selected.version, form_version: currentForm.form_version + 1, fields };
    const path = `/admin/services/${selected.id}/form`;
    try {
      await api(path, 'PUT', body, formKey(path, body));
      await refreshSelected();
      status('[data-hd-form-status]', 'Versi formulir baru tersimpan. Versi lama tetap tersedia.');
    } catch (e) {
      status('[data-hd-form-status]', errorText(e));
    } finally {
      button.disabled = false;
    }
  });

  ($('[data-hd-policy-editor]') as HTMLFormElement | null)?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected || !currentPolicy) return;
    const f = event.currentTarget as HTMLFormElement;
    if (!f.reportValidity()) return;
    const button = $('button[type=submit]', f) as HTMLButtonElement;
    button.disabled = true;
    const body: Components['PolicyWrite'] = {
      expected_version: selected.version,
      policy_version: currentPolicy.policy_version + 1,
      upload_max_bytes: Number(($('#hd-upload') as HTMLInputElement).value),
      allowed_mime: [...($('#hd-mime') as HTMLSelectElement).selectedOptions].map(v => v.value) as Policy['allowed_mime'],
      audience_org_ids: [...($('#hd-audience') as HTMLSelectElement).selectedOptions].map(v => v.value)
    };
    const path = `/admin/services/${selected.id}/policy`;
    try {
      await api(path, 'PUT', body, policyKey(path, body));
      await refreshSelected();
      status('[data-hd-policy-status]', 'Versi kebijakan baru tersimpan.');
    } catch (e) {
      status('[data-hd-policy-status]', errorText(e));
    } finally {
      button.disabled = false;
    }
  });

  // M9 Tabs & Handlers
  const m9Tabs = nodes<HTMLButtonElement>('[data-hd-tab]');
  const m9Panels = nodes<HTMLElement>('[data-hd-panel]');
  function switchM9Tab(target: string) {
    for (const t of m9Tabs) {
      if (t.dataset.hdTab === target) {
        t.className = 'piui-btn piui-btn--primary';
      } else {
        t.className = 'piui-btn piui-btn--secondary';
      }
    }
    for (const p of m9Panels) {
      p.hidden = p.dataset.hdPanel !== target;
    }
  }
  for (const tab of m9Tabs) {
    tab.addEventListener('click', () => {
      if (tab.dataset.hdTab) switchM9Tab(tab.dataset.hdTab);
    });
  }

  const reportOrg = $<HTMLSelectElement>('#hd-report-org');
  if (reportOrg) options(reportOrg, scopedOrganizationOptions('report.read', 'report.export'));
  const notificationOrg = $<HTMLSelectElement>('#hd-tg-org');
  if (notificationOrg) options(notificationOrg, scopedOrganizationOptions('notification.binding'));

  const fromInput = $('#hd-report-from') as HTMLInputElement | null;
  const toInput = $('#hd-report-to') as HTMLInputElement | null;
  if (fromInput && !fromInput.value) {
    const d = new Date(Date.now() - 30 * 86400000);
    fromInput.value = new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  }
  if (toInput && !toInput.value) {
    const d = new Date();
    toInput.value = new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  }

  $('[data-hd-fetch-report]')?.addEventListener('click', async () => {
    const org = ($('#hd-report-org') as HTMLSelectElement)?.value;
    const fVal = ($('#hd-report-from') as HTMLInputElement)?.value;
    const tVal = ($('#hd-report-to') as HTMLInputElement)?.value;
    if (!org || !fVal || !tVal) {
      status('[data-hd-status]', 'Pilih organisasi serta rentang waktu tanggal awal dan akhir.');
      return;
    }
    status('[data-hd-status]', 'Memuat laporan kinerja SLA dari server…');
    try {
      const fIso = new Date(fVal + '+07:00').toISOString();
      const tIso = new Date(tVal + '+07:00').toISOString();
      const rep = await api<{
        measure?: string;
        denominator?: number;
        count?: number;
        watermark?: string | null;
        sla_percent?: number | null;
        accepted?: number;
        completed?: number;
        breached?: number;
        backlog?: number;
        timezone?: string;
      }>(`/reports?from=${encodeURIComponent(fIso)}&to=${encodeURIComponent(tIso)}&organization_id=${encodeURIComponent(org)}`);
      const summary = $('[data-hd-report-summary]');
      if (summary) {
        summary.hidden = false;
        status('[data-hd-rep-measure]', rep.sla_percent == null ? 'Belum ada penyelesaian dengan target terukur' : `${rep.sla_percent.toLocaleString('id-ID', {maximumFractionDigits: 2})}% tepat waktu`);
        status('[data-hd-rep-denominator]', String(rep.denominator ?? 0));
        status('[data-hd-rep-count]', String(rep.count ?? 0));
        status('[data-hd-rep-cohort]', `${rep.accepted ?? 0} diterima, ${rep.completed ?? 0} selesai, ${rep.backlog ?? 0} aktif, ${rep.breached ?? 0} selesai terlambat`);
        status('[data-hd-rep-watermark]', rep.watermark ? new Date(rep.watermark).toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'}) : 'Belum ada fakta');
      }
      status('[data-hd-status]', 'Laporan kinerja SLA berhasil dimuat.');
    } catch (err) {
      status('[data-hd-status]', errorText(err));
    }
  });

  const exportDialog = $<HTMLDialogElement>('[data-hd-export-dialog]');
  $('[data-hd-open-export]')?.addEventListener('click', () => {
    if (exportDialog) {
      if (typeof exportDialog.showModal === 'function') exportDialog.showModal();
      else exportDialog.setAttribute('open', '');
    }
  });
  document.querySelectorAll('[data-hd-close-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (exportDialog) {
        if (typeof exportDialog.close === 'function') exportDialog.close();
        else exportDialog.removeAttribute('open');
      }
    });
  });

  const exportForm = $('[data-hd-export-form]') as HTMLFormElement | null;
  if (exportForm) {
    exportForm.addEventListener('submit', async e => {
      e.preventDefault();
      const org = ($('#hd-report-org') as HTMLSelectElement)?.value;
      const fVal = ($('#hd-report-from') as HTMLInputElement)?.value;
      const tVal = ($('#hd-report-to') as HTMLInputElement)?.value;
      const cohort = ($('#hd-export-cohort') as HTMLSelectElement)?.value || 'ACCEPTED';
      const format = ($('#hd-export-format') as HTMLSelectElement)?.value || 'CSV';
      if (!org || !fVal || !tVal) {
        status('[data-hd-export-status]', 'Parameter organisasi dan rentang waktu belum lengkap.');
        return;
      }
      status('[data-hd-export-status]', 'Mengajukan ekspor data asinkron (202 Accepted)…');
      try {
        const fIso = new Date(fVal + '+07:00').toISOString();
        const tIso = new Date(tVal + '+07:00').toISOString();
        const res = await api<{ id: string; status: string; download_path?: string }>('/reports/exports', 'POST', {
          organization_id: org,
          from: fIso,
          to: tIso,
          cohort,
          format,
          reason: 'Ekspor laporan kinerja SLA'
        });
        status('[data-hd-export-status]', `Tugas ekspor diterima (${res.id.slice(0, 8)}…). Status: ${res.status}`);
        const dlArea = $('[data-hd-download-area]');
        const dlLink = $('[data-hd-download-link]') as HTMLAnchorElement | null;
        if (dlArea && dlLink) {
          dlArea.hidden = false;
          dlLink.href = `/api/v1/reports/exports/${res.id}/file`;
          dlLink.textContent = `Unduh Berkas Ekspor (${format})`;
        }
      } catch (err) {
        status('[data-hd-export-status]', errorText(err));
      }
    });
  }

  const tgForm = $<HTMLFormElement>('[data-hd-telegram-form]');
  if (tgForm) {
    const orgField = $<HTMLSelectElement>('#hd-tg-org');
    const codeField = $<HTMLInputElement>('#hd-tg-code');
    const bound = $('[data-hd-sink-bound]');
    let binding: {id: string; version: number} | undefined;
    orgField?.addEventListener('change', () => { if (codeField) codeField.value = ''; });
    $('[data-hd-tg-challenge]')?.addEventListener('click', async () => {
      if (!orgField?.value || !codeField) return;
      try {
        const challenge = await api<{code: string}>('/notifications/sink-challenges', 'POST', {scope_org_id: orgField.value});
        codeField.value = challenge.code;
        status('[data-hd-telegram-status]', 'Kode sink lab berlaku lima menit.');
      } catch (err) {
        status('[data-hd-telegram-status]', errorText(err));
      }
    });
    tgForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!orgField?.value || !codeField?.value) return;
      try {
        binding = await api('/notifications/telegram-bindings', 'POST', {
          scope_org_id: orgField.value, channel: 'SINK', verification_code: codeField.value, expected_version: 1
        });
        codeField.value = '';
        if (bound) bound.hidden = false;
        status('[data-hd-telegram-status]', 'Pengikatan sink lab aktif.');
      } catch (err) {
        status('[data-hd-telegram-status]', errorText(err));
      }
    });
    $('[data-hd-tg-revoke]')?.addEventListener('click', async () => {
      if (!binding) return;
      try {
        await api(`/notifications/telegram-bindings/${binding.id}/revoke`, 'POST', {
          expected_version: binding.version, reason: 'Dicabut oleh pemilik pengikatan'
        });
        binding = undefined;
        if (bound) bound.hidden = true;
        status('[data-hd-telegram-status]', 'Pengikatan sink lab dicabut.');
      } catch (err) {
        status('[data-hd-telegram-status]', errorText(err));
      }
    });
  }

  $('[data-hd-refresh-audit]')?.addEventListener('click', async () => {
    status('[data-hd-status]', 'Memuat jejak audit append-only…');
    try {
      const res = await api<{ items: { created_at: string; actor_id: string; action: string; object_id: string; result: string; reason?: string }[] }>('/audit?limit=25');
      const rows = $('[data-hd-audit-rows]');
      if (rows) {
        rows.replaceChildren();
        for (const it of res.items || []) {
          const tr = element('tr');
          tr.append(
            element('td', new Date(it.created_at).toLocaleString('id-ID')),
            element('td', it.actor_id.slice(0, 8) + '…'),
            element('td', it.action),
            element('td', it.object_id ? it.object_id.slice(0, 8) + '…' : '-'),
            element('td', it.result),
            element('td', it.reason || '-')
          );
          rows.append(tr);
        }
      }
      status('[data-hd-status]', 'Jejak audit berhasil dimuat.');
    } catch (err) {
      status('[data-hd-status]', errorText(err));
    }
  });

  // M11 Tabs and Operational Runner
  const m11Tabs = nodes<HTMLButtonElement>('[data-hd-tab-m11]');
  const m11Panels = nodes<HTMLElement>('[data-hd-panel-m11]');
  for (const tab of m11Tabs) {
    tab.addEventListener('click', () => {
      const target = tab.dataset.hdTabM11;
      for (const t of m11Tabs) {
        if (t === tab) {
          t.className = 'piui-btn piui-btn--primary';
        } else {
          t.className = 'piui-btn piui-btn--secondary';
        }
      }
      for (const p of m11Panels) {
        p.hidden = p.dataset.hdPanelM11 !== target;
      }
    });
  }

  const maintForm = $('[data-hd-maintenance-form]') as HTMLFormElement | null;
  if (maintForm) {
    maintForm.addEventListener('submit', async e => {
      e.preventDefault();
      const org = ($('#hd-maint-org') as HTMLSelectElement).value;
      const mode = ($('#hd-maint-mode') as HTMLSelectElement).value;
      const sVal = ($('#hd-maint-start') as HTMLInputElement).value;
      const eVal = ($('#hd-maint-end') as HTMLInputElement).value;
      const reason = ($('#hd-maint-reason') as HTMLTextAreaElement).value;
      const body = {
        organization_id: org,
        mode,
        starts_at: sVal ? new Date(sVal).toISOString() : new Date().toISOString(),
        ends_at: eVal ? new Date(eVal).toISOString() : new Date(Date.now() + 3600000).toISOString(),
        message: reason
      };
      try {
        await api('/admin/maintenance', 'POST', body);
        status('[data-hd-maint-status]', `Kebijakan pemeliharaan (${mode}) berhasil diterapkan pada server.`);
      } catch (err) {
        status('[data-hd-maint-status]', errorText(err));
      }
    });
  }

  const runnerForm = $('[data-hd-runner-form]') as HTMLFormElement | null;
  if (runnerForm) {
    runnerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const org = ($('#hd-runner-org') as HTMLSelectElement).value;
      const kind = ($('#hd-runner-kind') as HTMLSelectElement).value;
      const reason = ($('#hd-runner-reason') as HTMLInputElement).value;
      const body: Record<string, unknown> = {
        target_id: org,
        kind,
        reason
      };
      try {
        const res = await api<Record<string, unknown>>('/admin/operations', 'POST', body);
        status('[data-hd-runner-status]', `Status pekerjaan ${String(res.state)}.`);
        const jobField = $<HTMLInputElement>('#hd-runner-job');
        if (jobField && typeof res.id === 'string') jobField.value = res.id;
        const resCard = $('[data-hd-runner-result]');
        const resPre = $('[data-hd-runner-output]');
        if (resCard && resPre) {
          resCard.hidden = false;
          resPre.textContent = JSON.stringify(res, null, 2);
        }
      } catch (err) {
        status('[data-hd-runner-status]', errorText(err));
      }
    });
  }

  $('[data-hd-review-job]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $<HTMLInputElement>('#hd-runner-job')?.value.trim() || '';
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      status('[data-hd-runner-status]', 'Masukkan ID pekerjaan yang sah.');
      return;
    }
    try {
      const path = `/admin/operations/${id}`;
      let job = await api<{version: number; state: string}>(path);
      if ((e as SubmitEvent).submitter?.hasAttribute('data-hd-approve-job')) {
        const reason = $<HTMLInputElement>('#hd-runner-approval-reason')?.value.trim();
        if (!reason) {
          status('[data-hd-runner-status]', 'Isi alasan persetujuan.');
          return;
        }
        job = await api(path + '/approve', 'POST', {expected_version: job.version, reason});
      }
      const card = $('[data-hd-runner-result]');
      const output = $('[data-hd-runner-output]');
      if (card && output) {
        card.hidden = false;
        output.textContent = JSON.stringify(job, null, 2);
      }
      status('[data-hd-runner-status]', `Status pekerjaan ${job.state}.`);
    } catch (err) {
      status('[data-hd-runner-status]', errorText(err));
    }
  });

  $('[data-hd-refresh-health]')?.addEventListener('click', async () => {
    try {
      status('[data-hd-health-status]', 'Memeriksa kesehatan sistem (redacted)...');
      const health = await api<{
        status: string;
        modules: Record<string, string>;
        scanner: string;
        storage: string;
        worker: string;
        outbox_lag: number | null;
        oldest_delivery_seconds: number | null;
        dead_letters: number | null;
        observed_at: string;
      }>('/admin/health');
      status('[data-hd-health-status]', `Status Sistem: ${health.status} (${new Date(health.observed_at).toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})})`);
      const rows = $('[data-hd-health-rows]');
      if (!rows) return;
      rows.replaceChildren();
      const addRow = (comp: string, st: string, note: string) => {
        const tr = element('tr');
        tr.append(element('td', comp), element('td', st), element('td', note));
        rows.append(tr);
      };
      addRow('Pemindai ClamAV', health.scanner, 'Uji pemindaian berkas sintetis');
      addRow('Penyimpanan privat', health.storage, 'Uji tulis, baca, dan hapus berkas probe');
      addRow('Scheduler', health.worker, 'Heartbeat eksekusi auto-close');
      addRow('Outbox', health.outbox_lag == null ? 'UNAVAILABLE' : String(health.outbox_lag),
        health.oldest_delivery_seconds == null ? 'Usia antrean belum terukur' : `Tertua ${health.oldest_delivery_seconds} detik · dead-letter ${health.dead_letters ?? 0}`);
      for (const [m, s] of Object.entries(health.modules || {})) {
        addRow(`Modul ${m.toUpperCase()}`, s, 'Probe skema melalui pool pemilik');
      }
    } catch (err) {
      status('[data-hd-health-status]', errorText(err));
    }
  });

  // =========================================================================
  // Pustaka Media Terpadu (M3/M8) Handlers
  // =========================================================================
  let currentMediaOwner: 'M3' | 'M8' = 'M8';
  const mediaTabs = nodes<HTMLButtonElement>('[data-hd-tab-media]');
  function switchMediaTab(owner: 'M3' | 'M8') {
    currentMediaOwner = owner;
    for (const tab of mediaTabs) {
      if (tab.dataset.hdTabMedia === owner) {
        tab.className = 'piui-btn piui-btn--primary';
      } else {
        tab.className = 'piui-btn piui-btn--secondary';
      }
    }
    void loadAdminMedia(owner);
  }
  for (const tab of mediaTabs) {
    tab.addEventListener('click', () => {
      const o = tab.dataset.hdTabMedia as 'M3' | 'M8' | undefined;
      if (o) switchMediaTab(o);
    });
  }
  $('[data-hd-refresh-media]')?.addEventListener('click', () => void loadAdminMedia(currentMediaOwner));

  const filterStatusSelect = $('#hd-media-filter-status') as HTMLSelectElement | null;
  filterStatusSelect?.addEventListener('change', () => void loadAdminMedia(currentMediaOwner));

  // Toggle Media Upload Panel
  const uploadPanel = $('[data-hd-media-upload-panel]');
  $('[data-hd-toggle-upload]')?.addEventListener('click', () => {
    if (uploadPanel) {
      uploadPanel.hidden = !uploadPanel.hidden;
      if (!uploadPanel.hidden) {
        uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
  $('[data-hd-close-upload]')?.addEventListener('click', () => {
    if (uploadPanel) uploadPanel.hidden = true;
  });

  // Dropzone Interaction for Media Upload
  const dropzoneEl = $('#hd-admin-media-dropzone');
  const fileInputEl = $('#hd-admin-media-file') as HTMLInputElement | null;
  const previewBoxEl = $('[data-hd-media-preview-box]');
  const previewThumbEl = $('[data-hd-media-preview-thumb]');
  const previewNameEl = $('[data-hd-media-preview-name]');
  const previewSizeEl = $('[data-hd-media-preview-size]');
  const clearFileBtn = $('[data-hd-media-clear-file]');
  let selectedUploadFile: File | null = null;

  function handleFileSelected(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      status('[data-hd-media-upload-status]', 'Ukuran berkas melebihi batas 10 MB.');
      return;
    }
    selectedUploadFile = file;
    if (dropzoneEl) dropzoneEl.style.display = 'none';
    if (previewBoxEl) previewBoxEl.style.display = 'flex';
    if (previewNameEl) previewNameEl.textContent = file.name;
    if (previewSizeEl) previewSizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB · ${file.type || 'application/octet-stream'}`;

    if (previewThumbEl) {
      previewThumbEl.replaceChildren();
      if (file.type.startsWith('image/')) {
        const img = element('img');
        img.src = URL.createObjectURL(file);
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        previewThumbEl.append(img);
      } else {
        const icon = element('span', '📄');
        icon.style.fontSize = '24px';
        previewThumbEl.append(icon);
      }
    }
    const altInput = $('#hd-media-alt') as HTMLInputElement | null;
    if (altInput && !altInput.value) {
      altInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }
  }

  function clearSelectedFile() {
    selectedUploadFile = null;
    if (fileInputEl) fileInputEl.value = '';
    if (previewBoxEl) previewBoxEl.style.display = 'none';
    if (dropzoneEl) dropzoneEl.style.display = 'block';
  }

  if (dropzoneEl && fileInputEl) {
    dropzoneEl.addEventListener('click', () => fileInputEl.click());
    dropzoneEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputEl.click();
      }
    });
    dropzoneEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropzoneEl.classList.add('is-dragover');
    });
    dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('is-dragover'));
    dropzoneEl.addEventListener('drop', e => {
      e.preventDefault();
      dropzoneEl.classList.remove('is-dragover');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
    fileInputEl.addEventListener('change', () => {
      if (fileInputEl.files && fileInputEl.files.length > 0) {
        handleFileSelected(fileInputEl.files[0]);
      }
    });
  }
  clearFileBtn?.addEventListener('click', clearSelectedFile);

  // Form Submit for Media Upload
  const publication = $<HTMLFormElement>('[data-hd-media-publication]');
  if (publication) {
    const requestKey = intent();
    let sending = false;
    publication.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !publication.reportValidity()) return;
      const action = (event as SubmitEvent).submitter as HTMLButtonElement | null;
      const sourceID = value(publication, 'source_id');
      const body: Record<string, unknown> = {
        expected_version: Number(value(publication, 'expected_version')),
        sanitized_copy_id: value(publication, 'sanitized_copy_id'),
        target_id: value(publication, 'target_id'),
        target_audience: value(publication, 'target_audience'),
        reason: value(publication, 'reason')
      };
      const approving = action?.value === 'approve';
      if (!approving) {
        body.approval_id = value(publication, 'approval_id');
        body.target_owner = 'M8';
      }
      const path = `/media/${encodeURIComponent(sourceID)}/${approving ? 'approvals' : 'reuse'}`;
      sending = true;
      publication.setAttribute('aria-busy', 'true');
      try {
        const receipt = await api<{ id: string }>(path, 'POST', body, requestKey(path, body));
        if (approving) control(publication, 'approval_id').value = receipt.id;
        status('[data-hd-media-publication-status]', approving ? 'Persetujuan server tersimpan. Editor dapat menghubungkan salinan ke tujuan yang sama.' : 'Salinan terhubung. Akses pembaca mengikuti status dan audience konten tujuan.', publication);
      } catch (error) {
        status('[data-hd-media-publication-status]', errorText(error), publication);
        $('[data-hd-media-publication-status]', publication)?.focus();
      } finally {
        sending = false;
        publication.removeAttribute('aria-busy');
      }
    });
  }
  const mediaUploadForm = $('[data-hd-media-upload-form]') as HTMLFormElement | null;
  if (mediaUploadForm) {
    const mediaIntentKey = intent();
    const organizations = [...new Set((session?.actor.memberships ?? []).filter(m => m.organization_active && m.permissions.includes('media.write')).map(m => m.organization_id))];
    const orgSelect = control(mediaUploadForm, 'organization_id') as HTMLSelectElement;
    if (orgSelect) options(orgSelect, organizations.map(id => ({ value: id, label: `Organisasi ${id}` })), organizations.length > 1);
    mediaUploadForm.hidden = organizations.length === 0;

    mediaUploadForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!selectedUploadFile) {
        status('[data-hd-media-upload-status]', 'Pilih berkas media terlebih dahulu.');
        return;
      }
      const alt = ($('#hd-media-alt') as HTMLInputElement)?.value.trim();
      const caption = ($('#hd-media-caption') as HTMLInputElement)?.value.trim();
      const license = ($('#hd-media-license') as HTMLSelectElement)?.value || 'CC-BY-4.0';
      const source = ($('#hd-media-source') as HTMLInputElement)?.value.trim() || 'Diskominfotik Kota Depok';

      if (!alt) {
        status('[data-hd-media-upload-status]', 'Deskripsi alt wajib diisi.');
        return;
      }

      const submitBtn = $('[data-hd-media-submit]') as HTMLButtonElement | null;
      if (submitBtn) submitBtn.disabled = true;
      status('[data-hd-media-upload-status]', 'Menghitung digest SHA-256 dan mendaftarkan media…');

      try {
        const buffer = await selectedUploadFile.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const sha256Hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

        const metaPayload = {
          expected_version: 1,
          filename: selectedUploadFile.name,
          mime: selectedUploadFile.type || 'application/octet-stream',
          size_bytes: selectedUploadFile.size,
          sha256: sha256Hex,
          alt,
          caption: caption || undefined,
          license,
          source: source || undefined
        };

        const metadata = { ...metaPayload, org_id: value(mediaUploadForm, 'organization_id') };
        const created = await api<{ id: string; version: number }>('/media', 'POST', metadata, mediaIntentKey('/media', metadata));
        status('[data-hd-media-upload-status]', `Mengunggah blob ke karantina ClamAV (${created.id.slice(0, 8)}…)…`);

        const putRes = await fetch(`/api/v1/media/${created.id}/content`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {
            'Content-Type': selectedUploadFile.type || 'application/octet-stream',
            'X-CSRF-Token': csrf(),
            'Idempotency-Key': crypto.randomUUID()
          },
          body: selectedUploadFile
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new APIError(putRes.status, errData.message || 'Gagal menyimpan konten media');
        }

        const scanResult = await putRes.json();
        status('[data-hd-media-upload-status]', `Media berhasil diunggah! Status Pemindai: ${scanResult.status || 'CLEAN'}.`);
        clearSelectedFile();
        mediaUploadForm.reset();
        setTimeout(() => {
          if (uploadPanel) uploadPanel.hidden = true;
          switchMediaTab('M8');
        }, 1200);
      } catch (err) {
        status('[data-hd-media-upload-status]', 'Gagal unggah: ' + errorText(err));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Media Detail Modal Dialog
  const mediaDetailDialog = $<HTMLDialogElement>('[data-hd-media-detail-dialog]');
  document.querySelectorAll('[data-hd-close-media-detail]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (mediaDetailDialog) {
        if (typeof mediaDetailDialog.close === 'function') mediaDetailDialog.close();
        else mediaDetailDialog.removeAttribute('open');
      }
    });
  });

  interface MediaDetailItem {
    id: string;
    version: number;
    owner: string;
    status: string;
    visibility: string;
    size_bytes: number;
    mime?: string;
    sha256?: string;
    alt?: string;
    caption?: string;
    license?: string;
    source?: string;
    storage_key?: string;
    sanitized_from_id?: string;
    approved_by?: string;
    created_at?: string;
  }

  function showMediaDetail(item: MediaDetailItem) {
    if (!mediaDetailDialog) return;
    const body = $('[data-hd-media-detail-body]', mediaDetailDialog);
    if (!body) return;
    body.replaceChildren();

    const addDetailField = (lbl: string, val: string, mono = false) => {
      const p = element('p');
      p.style.margin = '4px 0';
      const strong = element('strong', lbl + ': ');
      p.append(strong);
      if (mono) {
        const code = element('code', val);
        code.style.cssText = 'background:rgba(255,255,255,0.08);padding:2px 4px;border-radius:4px;word-break:break-all;font-size:0.8rem;';
        p.append(code);
      } else {
        p.append(document.createTextNode(val));
      }
      body.append(p);
    };

    addDetailField('UUID Media', item.id, true);
    addDetailField('Versi sumber', String(item.version));
    addDetailField('Owner Domain', `${item.owner} (${item.owner === 'M8' ? 'Editorial Publik' : 'Privat Tiket Penanganan'})`);
    addDetailField('Status Pemindaian', item.status);
    addDetailField('Tingkat Visibilitas', item.visibility || 'PRIVATE');
    addDetailField('Deskripsi Alt', item.alt || '-');
    if (item.caption) addDetailField('Keterangan / Caption', item.caption);
    addDetailField('Tipe MIME', item.mime || 'application/octet-stream');
    addDetailField('Ukuran Berkas', `${(item.size_bytes / 1024).toFixed(1)} KB (${item.size_bytes} byte)`);
    if (item.sha256) addDetailField('SHA-256 Digest', item.sha256, true);
    if (item.license) addDetailField('Lisensi', item.license);
    if (item.source) addDetailField('Sumber Aset', item.source);
    
    if (item.sanitized_from_id) addDetailField('Sanitized From (Provenance)', item.sanitized_from_id, true);
    if (item.approved_by) addDetailField('Disetujui Oleh', item.approved_by, true);
    if (item.created_at) addDetailField('Waktu Unggah', new Date(item.created_at).toLocaleString('id-ID'));

    if (typeof mediaDetailDialog.showModal === 'function') mediaDetailDialog.showModal();
    else mediaDetailDialog.setAttribute('open', '');
  }

  async function loadAdminMedia(owner: 'M3' | 'M8') {
    const container = $('[data-hd-media-container]');
    const statusEl = $('[data-hd-media-status]');
    if (!container) return;
    container.replaceChildren();
    if (statusEl) statusEl.textContent = `Memuat berkas media dari domain ${owner}…`;

    const filterVal = (filterStatusSelect?.value || 'ALL').toUpperCase();

    try {
      const res = await api<{ items: MediaDetailItem[] }>(`/media?owner=${owner}&limit=50`);
      let items = res.items || [];
      if (filterVal !== 'ALL') {
        items = items.filter(it => it.status.toUpperCase() === filterVal);
      }

      if (statusEl) {
        statusEl.textContent = `${items.length} berkas media ditemukan pada domain ${owner} (status filter: ${filterVal}).`;
      }

      if (!items.length) {
        container.append(element('p', `Belum ada berkas media pada domain ${owner} untuk filter ini.`, 'piui-empty-state'));
        return;
      }

      for (const item of items) {
        const card = element('div', '', 'hd-media-card');

        // Thumbnail Box
        const thumb = element('div', '', 'hd-media-thumb');
        const isImg = item.mime?.startsWith('image/') || (!item.mime && item.status === 'CLEAN');
        if (isImg && item.status === 'CLEAN') {
          const img = element('img');
          img.src = `/api/v1/media/${item.id}/content`;
          img.alt = item.alt || 'Pratinjau Media';
          img.loading = 'lazy';
          img.onerror = () => {
            thumb.replaceChildren(element('span', '🖼️', ''));
            (thumb.firstElementChild as HTMLElement).style.fontSize = '32px';
          };
          thumb.append(img);
        } else {
          const docIcon = element('span', item.status === 'QUARANTINED' ? '🛡️' : '📄');
          docIcon.style.fontSize = '32px';
          thumb.append(docIcon);
        }

        // Top Row: Owner Badge & Status Badge
        const topRow = element('div', '', 'hd-actions');
        topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:0;';
        const ownerBadge = element('span', `${item.owner} · ${item.owner === 'M8' ? 'Publik' : 'Privat'}`, item.owner === 'M8' ? 'hd-badge-m8' : 'hd-badge-m3');
        const statusBadge = element('span', item.status, item.status === 'CLEAN' ? 'hd-badge-clean' : item.status === 'QUARANTINED' ? 'hd-badge-quarantined' : 'court-badge');
        topRow.append(ownerBadge, statusBadge);

        // Title / Alt
        const title = element('strong', item.alt || item.id.slice(0, 14) + '…');
        title.style.cssText = 'font-size:0.875rem;line-height:1.35;word-break:break-all;color:var(--piui-text-primary,#fafafa);';

        // Size & Date
        const meta = element('div');
        meta.style.cssText = 'display:flex;flex-direction:column;gap:2px;font-size:0.75rem;color:var(--piui-text-secondary,#a1a1aa);';
        const sizeText = element('span', `${(item.size_bytes / 1024).toFixed(1)} KB · ${item.visibility || 'PRIVATE'}`);
        const dateText = element('span', item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
        meta.append(sizeText, dateText);

        // Actions Row
        const actions = element('div', '', 'hd-actions');
        actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:0;margin-top:auto;';

        // Copy ID Button
        const copyBtn = element('button', 'Salin ID', 'piui-btn piui-btn--secondary piui-btn--sm');
        copyBtn.type = 'button';
        copyBtn.title = 'Salin UUID media';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(item.id);
            copyBtn.textContent = 'Tersalin!';
            setTimeout(() => { copyBtn.textContent = 'Salin ID'; }, 1500);
          } catch {
            prompt('Salin UUID Media:', item.id);
          }
        });

        // Detail Button
        const detailBtn = element('button', 'Detail', 'piui-btn piui-btn--secondary piui-btn--sm');
        detailBtn.type = 'button';
        detailBtn.addEventListener('click', () => showMediaDetail(item));

        actions.append(copyBtn, detailBtn);

        // Download Button if CLEAN
        if (item.status === 'CLEAN') {
          const dlBtn = element('a', 'Unduh', 'piui-btn piui-btn--primary piui-btn--sm');
          dlBtn.href = `/api/v1/media/${item.id}/content`;
          dlBtn.target = '_blank';
          dlBtn.download = item.alt ? `${item.alt.slice(0, 30)}.bin` : item.id;
          actions.append(dlBtn);
        }

        card.append(thumb, topRow, title, meta, actions);
        container.append(card);
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Gagal memuat media: ' + errorText(err);
    }
  }

  // =========================================================================
  // Pengelolaan Portal & Navigasi Publik (M2) Handlers
  // =========================================================================
  async function loadNavigation() {
    const tbody = $('[data-hd-nav-rows]');
    if (!tbody) return;
    tbody.replaceChildren();
    try {
      const res = await api<{ items: Array<{ route: string; label: string; audience: string; position: number; active?: boolean }> }>('/catalog/navigation');
      const items = res.items || [];
      for (const it of items) {
        const tr = element('tr');
        tr.append(
          element('td', it.label),
          element('td', it.route),
          element('td', it.audience),
          element('td', String(it.position)),
          element('td', it.active !== false ? 'Aktif' : 'Nonaktif')
        );
        tbody.append(tr);
      }
      if (!items.length) {
        const tr = element('tr'), td = element('td', 'Belum ada rute navigasi terdaftar.');
        td.colSpan = 5;
        tr.append(td);
        tbody.append(tr);
      }
    } catch (err) {
      status('[data-hd-nav-status]', errorText(err));
    }
  }

  const navForm = $('[data-hd-nav-form]') as HTMLFormElement | null;
  $('[data-hd-new-nav]')?.addEventListener('click', () => {
    if (navForm) {
      navForm.hidden = !navForm.hidden;
      if (!navForm.hidden) navForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  $('[data-hd-close-nav-form]')?.addEventListener('click', () => {
    if (navForm) navForm.hidden = true;
  });
  $('[data-hd-refresh-nav]')?.addEventListener('click', () => void loadNavigation());

  if (navForm) {
    navForm.addEventListener('submit', async e => {
      e.preventDefault();
      const label = ($('#hd-nav-label') as HTMLInputElement)?.value.trim();
      const route = ($('#hd-nav-route') as HTMLInputElement)?.value.trim();
      const audience = ($('#hd-nav-audience') as HTMLSelectElement)?.value || 'PUBLIC_GUEST';
      const position = Number(($('#hd-nav-position') as HTMLInputElement)?.value || 10);
      if (!label || !route) return;
      status('[data-hd-nav-status]', 'Menyimpan rute navigasi…');
      try {
        await api('/admin/navigation', 'POST', {
          expected_version: 1,
          label,
          route,
          audience,
          position,
          active: true
        });
        status('[data-hd-nav-status]', 'Rute navigasi berhasil disimpan pada server.');
        navForm.reset();
        setTimeout(() => {
          navForm.hidden = true;
          void loadNavigation();
        }, 1000);
      } catch (err) {
        status('[data-hd-nav-status]', errorText(err));
      }
    });
  }

  // =========================================================================
  // Basis Pengetahuan & Editorial Artikel (M8) Handlers
  // =========================================================================
  type EditorialArticle = {id: string; version: number; title: string; slug: string; audience: string; state: string; body: string; org_id?: string};
  const artForm = $<HTMLFormElement>('[data-hd-article-form]');
  const articlePanel = $('[data-hd-articles-section]');
  const editorialPrev = $<HTMLButtonElement>('[data-hd-editorial-prev]');
  const editorialNext = $<HTMLButtonElement>('[data-hd-editorial-next]');
  const editorialStatus = (message: string) => status('[data-hd-editorial-status]', message);
  let articleDraft: EditorialArticle | undefined;
  let articleCursors = [''];
  let editorialCursor: string | null = null;

  function editArticle(item?: EditorialArticle) {
    if (!artForm) return;
    articleDraft = item;
    artForm.reset();
    status('[data-hd-article-form-title]', item ? 'Sunting artikel' : 'Tulis artikel', artForm);
    for (const key of ['title', 'slug', 'audience', 'body'] as const) {
      const input = artForm.elements.namedItem(key);
      if (item && (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) input.value = item[key];
    }
    status('[data-hd-article-status]', '', artForm);
    artForm.hidden = false;
    $<HTMLInputElement>('#hd-art-title')?.focus();
  }

  async function loadArticles() {
    const tbody = $('[data-hd-articles-rows]');
    if (!tbody) return;
    tbody.replaceChildren();
    editorialStatus('Memuat artikel…');
    if (editorialPrev) editorialPrev.disabled = true;
    if (editorialNext) editorialNext.disabled = true;
    try {
      const query = new URLSearchParams({limit: '20'});
      const cursor = articleCursors.at(-1);
      if (cursor) query.set('cursor', cursor);
      const res = await api<Page<EditorialArticle>>('/knowledge/articles?' + query);
      editorialCursor = res.next_cursor;
      for (const it of res.items) {
        const tr = element('tr');
        const actions = element('td');
        const scoped = (permission: string) => session?.actor.memberships.some(m =>
          m.organization_active && (!it.org_id || m.organization_id === it.org_id) && m.permissions.includes(permission));
        if (scoped('content.write') && (it.state !== 'PUBLISHED' || scoped('content.publish'))) {
          const edit = element('button', 'Sunting', 'piui-btn piui-btn--secondary piui-btn--sm');
          edit.type = 'button';
          edit.addEventListener('click', () => editArticle(it));
          actions.append(edit);
        }
        const transition = it.state === 'PUBLISHED' ? ['ARCHIVE', 'Arsipkan'] :
          it.state === 'ARCHIVED' ? ['RESTORE', 'Pulihkan ke draft'] : ['PUBLISH', 'Terbitkan'];
        if (scoped('content.publish')) {
          const action = element('button', transition[1], 'piui-btn piui-btn--secondary piui-btn--sm');
          action.type = 'button';
          action.addEventListener('click', async () => {
            action.disabled = true;
            try {
              await api(`/knowledge/articles/${it.id}/transitions`, 'POST', {
                expected_version: it.version, action: transition[0], reason: transition[1] + ' artikel panduan',
              });
              await loadArticles();
            } catch (err) {
              editorialStatus(errorText(err));
              action.disabled = false;
            }
          });
          actions.append(action);
        }
        const href = '/panduan/' + encodeURIComponent(it.slug);
        if (it.state === 'PUBLISHED') {
          const link = element('a', 'Baca', 'piui-btn piui-btn--secondary piui-btn--sm');
          link.href = href;
          actions.append(link);
        }
        tr.append(element('td', it.title), element('td', href), element('td', it.audience),
          element('td', it.state), element('td', `v${it.version}`), actions);
        tbody.append(tr);
      }
      if (editorialPrev) editorialPrev.disabled = articleCursors.length < 2;
      if (editorialNext) editorialNext.disabled = !editorialCursor;
      editorialStatus(res.items.length ? `${res.items.length} artikel pada halaman ini.` : 'Belum ada artikel pada halaman ini.');
    } catch (err) {
      editorialStatus(errorText(err));
    }
  }

  editorialPrev?.addEventListener('click', () => { if (articleCursors.length > 1) { articleCursors.pop(); void loadArticles(); } });
  editorialNext?.addEventListener('click', () => { if (editorialCursor) { articleCursors.push(editorialCursor); void loadArticles(); } });
  const newArticle = $<HTMLButtonElement>('[data-hd-new-article]');
  if (newArticle) {
    newArticle.hidden = !can('content.write');
    newArticle.addEventListener('click', () => editArticle());
  }
  $('[data-hd-close-art-form]')?.addEventListener('click', () => {
    if (artForm) artForm.hidden = true;
    newArticle?.focus();
  });
  $('[data-hd-refresh-articles]')?.addEventListener('click', () => void loadArticles());

  artForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!articlePanel || articlePanel.hidden) return;
    const submit = $<HTMLButtonElement>('button[type="submit"]', artForm);
    if (submit?.disabled) return;
    const fields = new FormData(artForm);
    const text = (key: string) => String(fields.get(key) ?? '').trim();
    const path = articleDraft ? '/knowledge/articles/' + articleDraft.id : '/knowledge/articles';
    if (submit) submit.disabled = true;
    status('[data-hd-article-status]', 'Menyimpan artikel…', artForm);
    try {
      await api(path, articleDraft ? 'PUT' : 'POST', {
        expected_version: articleDraft?.version ?? 1, org_id: articleDraft?.org_id,
        title: text('title'), slug: text('slug'), audience: text('audience'), body: text('body'), alt: text('alt'),
      });
      artForm.hidden = true;
      await loadArticles();
      editorialStatus('Artikel disimpan.');
    } catch (error) {
      status('[data-hd-article-status]', errorText(error), artForm);
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  await load();
  if (adminPanel) adminPanel.hidden = false;
}

async function main() {
  setupSearchCombobox();
  for (const f of nodes<HTMLFormElement>('form[data-hd-register]')) void registerUser(f);
  const loginForms = nodes<HTMLFormElement>('form[data-hd-login]');
  if (loginForms.length) {
    const bootstrap = api<Components['Bootstrap']>('/auth/bootstrap');
    loginForms.forEach((form, index) => { void login(form, bootstrap, index === 0); });
  }
  const page = $('[data-hd-page]')?.dataset.hdPage;
  if (page && page !== 'login' && page !== 'register') {
    await loadSession();
    if (location.pathname.startsWith('/admin/') && !canOpenAdminPage(location.pathname,location.search,session)) return;
    if (page === 'catalog') await catalog();
    if (page === 'detail') await detail();
    if (page === 'admin') await admin();
    if (page === 'dashboard') initDashboard(session?.actor.memberships ?? [], session?.actor.role);
    if (page === 'knowledge') initKnowledgeBase();
  }
}
void main().catch(e => status('[data-hd-status]', errorText(e)));
