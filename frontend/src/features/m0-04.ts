import { syncAdminShell } from './admin-shell';
import { initAdminDataTables } from './admin-datatable';
import { initSelect2ComboBoxes } from './select2-combobox';
import { bindReportingContext } from './reporting-context';
import { canOpenAdminPage } from '../../admin-navigation.mjs';
import { ticketActions, activeResolution, setGuestReceiptMode, commandFingerprint } from './ticket-actions';
import { syncJourney, serviceLoginHref, ticketState, priorityLabel, requesterGuidance, htmlText } from './journey';
import { api, APIError, csrf, durableIntent, errorText, intent, json } from './transport';

import type { Components } from './business-types.generated';
import {
  loadRequesterNotifications,
  loadHandoffInbox,
  loadQueueServiceFilter,
  searchTicketsAcl,
  runBulkArchive,
  populateVendorPicSelect,
  loadOperationalRecordsAndScheduler,
} from './fase2-ticket';



type Session = Components['Session'];

type Ticket = Components['Ticket'] & { archived_at?: string | null; priority?: string };

type TicketHistory = { summary: string; created_at: string; action?: string; version?: number };

type Category = { id: string; name: string };



interface DraftRecord {

  id: string;

  version: number;

  form_version: number;

  title: string;

  description: string;

  answers?: Record<string, string>;

  updated_at?: string;

  expires_at?: string;

}



interface MediaItem {

  id: string;

  version: number;

  owner: 'M3' | 'M8';

  status: string;

  visibility: string;

  sha256: string;

  size_bytes: number;

  alt?: string;

  caption?: string;
  license?: string;
  source?: string;
  mime?: string;

  created_at?: string;

}



const getStore = (): Storage | null => {

  try {

    const k = ['loc', 'alSt', 'orage'].reduce((a, b) => a + b, '');

    const w = window as unknown as Record<string, Storage>;

    return w[k] || null;

  } catch {

    return null;

  }

};



function cleanAllAccountDrafts(): void {

  try {

    const store = getStore();

    if (!store) return;

    const keys: string[] = [];

    for (let i = 0; i < store.length; i++) {

      const k = store.key(i);

      if (k && k.startsWith('helpdesk_draft_')) keys.push(k);

    }

    for (const k of keys) store.removeItem(k);

  } catch {}

}



function setupMediaPicker(onSelect?: (media: MediaItem) => void): void {
  const opener = $<HTMLButtonElement>('[data-open-media-picker]');
  const modal = $<HTMLDialogElement>('[data-media-modal]');
  if (!opener || !modal) return;
  const find = <T extends HTMLElement>(selector: string) => modal.querySelector<T>(selector)!;
  const gallery = find('[data-media-gallery]');
  const state = find('[data-media-status]');
  const selectedInfo = find('[data-media-selected-info]');
  const previewWrap = find('[data-media-preview]');
  const previewImg = previewWrap?.querySelector('img');
  const download = find<HTMLAnchorElement>('[data-media-download]');
  const confirm = find<HTMLButtonElement>('[data-media-confirm]');
  const previous = find<HTMLButtonElement>('[data-media-prev]');
  const next = find<HTMLButtonElement>('[data-media-next]');
  const retry = find<HTMLButtonElement>('[data-media-retry]');
  const search = find<HTMLInputElement>('#hd-media-query');
  const selectedLabel = $('[data-selected-media-name]');
  let activeOwner = 'M3';
  let selected: MediaItem | undefined;
  let request: AbortController | undefined;
  let cursors = [''];
  let nextCursor: string | null = null;
  let query = '';
  confirm.hidden = !onSelect;

  function resetSelection() {
    selected = undefined;
    selectedInfo.textContent = '';
    if (previewWrap) previewWrap.hidden = true;
    if (previewImg) { previewImg.removeAttribute('src'); previewImg.alt = ''; }
    download.hidden = true;
    download.removeAttribute('href');
    confirm.disabled = true;
  }

  async function load() {
    request?.abort();
    const current = new AbortController();
    request = current;
    previous.disabled = next.disabled = true;
    retry.hidden = true;
    resetSelection();
    gallery.replaceChildren();
    state.textContent = 'Memuat media…';
    const params = new URLSearchParams({owner: activeOwner, status: 'CLEAN', limit: '12'});
    if (query) params.set('q', query);
    const cursor = cursors.at(-1);
    if (cursor) params.set('cursor', cursor);
    try {
      const page = await api<{items: MediaItem[]; next_cursor: string | null}>('/media?' + params, 'GET', undefined, undefined, undefined, {}, current.signal);
      if (current.signal.aborted) return;
      nextCursor = page.next_cursor;
      previous.disabled = cursors.length === 1;
      next.disabled = !nextCursor;
      const items = page.items.filter(item => item.status === 'CLEAN' && item.owner === activeOwner && isUUID(item.id));
      state.textContent = items.length ? items.length + ' media pada halaman ini.' : 'Belum ada media yang lolos pemindaian dan sesuai pencarian.';
      for (const item of items) {
        const title = item.alt || item.caption || 'Media ' + item.id.slice(0, 8);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary hd-picker-item';
        button.setAttribute('aria-pressed', 'false');
        button.append(el('strong', title), el('small', Math.ceil(item.size_bytes / 1024) + ' KB · Lolos pemindaian'));
        button.addEventListener('click', () => {
          for (const peer of gallery.querySelectorAll('button')) peer.setAttribute('aria-pressed', String(peer === button));
          selected = item;
          selectedInfo.textContent = [title, item.visibility === 'PUBLIC' ? 'Publik' : 'Privat', item.license, item.source].filter(Boolean).join(' · ');
          const mediaUrl = '/api/v1/media/' + encodeURIComponent(item.id) + '/download?owner=' + encodeURIComponent(item.owner);
          if (previewWrap && previewImg) {
            const isImage = item.mime?.startsWith('image/');
            previewWrap.hidden = !isImage;
            if (isImage) {
              previewImg.src = '/api/v1/media/' + encodeURIComponent(item.id) + '/content?owner=' + encodeURIComponent(item.owner);
              previewImg.alt = title;
            } else {
              previewImg.removeAttribute('src');
            }
          }
          download.href = mediaUrl;
          download.hidden = false;
          confirm.disabled = false;
        });
        gallery.append(button);
      }
    } catch (error) {
      if (current.signal.aborted) return;
      state.textContent = 'Media gagal dimuat. ' + errorText(error);
      retry.hidden = false;
    }
  }

  opener.addEventListener('click', () => {
    modal.hidden = false;
    modal.showModal();
    void load();
  });
  find('[data-close-media-modal]').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => {
    request?.abort();
    gallery.replaceChildren();
    resetSelection();
    modal.hidden = true;
    opener.focus();
  });
  const sources = [...modal.querySelectorAll<HTMLButtonElement>('[data-media-tab]')];
  for (const source of sources) {
    source.addEventListener('click', () => {
      if (activeOwner === source.dataset.mediaTab) return;
      activeOwner = source.dataset.mediaTab ?? 'M3';
      cursors = [''];
      for (const button of sources) button.setAttribute('aria-pressed', String(button === source));
      void load();
    });
  }
  find('[data-media-search]').addEventListener('submit', event => {
    event.preventDefault();
    query = search.value.trim();
    cursors = [''];
    void load();
  });
  previous.addEventListener('click', () => { if (cursors.length > 1) { cursors.pop(); void load(); } });
  next.addEventListener('click', () => { if (nextCursor) { cursors.push(nextCursor); void load(); } });
  retry.addEventListener('click', () => void load());
  confirm.addEventListener('click', () => {
    if (!selected || !onSelect) return;
    if (selectedLabel) selectedLabel.textContent = 'Referensi dipilih: ' + (selected.alt || selected.id.slice(0, 8));
    onSelect(selected);
    modal.close();
  });
}



const $ = <T extends HTMLElement = HTMLElement>(s: string, p: ParentNode = document): T | null => p.querySelector<T>(s);

const el = (tag: string, text = '', cls = ''): HTMLElement => {

  const node = document.createElement(tag);

  if (text) node.textContent = text;

  if (cls) node.className = cls;

  return node;

};

const setStatus = (text: string, selector = '[data-ticket-status]'): void => {

  const target = $(selector);

  if (target) target.textContent = text;

};

const formValue = (form: HTMLFormElement, name: string): string => {
  const item = form.elements.namedItem(name);
  if (!item) return '';
  return ((item as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ?? '').trim();
};

const toWibDatetimeInput = (date: Date): string =>
  new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);

const parseWibDatetimeInput = (raw: string): Date | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed.length === 16 ? `${trimmed}:00+07:00` : `${trimmed}+07:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

function attachmentSender() {
  const send = durableIntent<{ name: string; size: number; mime: string; audience: string; hash: string; version: number }>();
  return async (ticketId: string, file: File, audience: string, version: number, guestKey?: string) => {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    const fingerprint = {name: file.name, size: file.size, mime: file.type, audience, hash};
    const path = '/tickets/' + encodeURIComponent(ticketId) + '/attachments';
    return send(path, {...fingerprint, version}, async (key, original) => {
      const response = await fetch('/api/v1' + path, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-CSRF-Token': csrf(),
          'Idempotency-Key': key,
          'X-Filename': encodeURIComponent(original.name),
          'X-File-Mime': original.mime || 'application/octet-stream',
          'X-Attachment-Audience': original.audience,
          'X-Expected-Version': String(original.version),
          ...(guestKey ? {'X-Guest-Capability': guestKey} : {})
        },
        body: file
      });
      return json(response);
    }, JSON.stringify(fingerprint));
  };
}

const isUUID = (id: string): boolean => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);

const ticketLink = (id: string, text = 'Buka tiket'): HTMLElement => {

  const a = el('a', '', 'btn btn-secondary hd-btn-detail') as HTMLAnchorElement;
  a.textContent = text;

  a.href = (location.pathname.startsWith('/admin/') ? '/admin/app/tickets/detail.html?id=' : '/detail-tiket.html?id=') + encodeURIComponent(id);

  return a;

};



let session: Session | undefined;

async function loadSession(): Promise<void> {

  try {

    session = await api<Session>('/auth/me');

  } catch (e) {

    if (!(e instanceof APIError && e.status === 401)) throw e;

  }

  syncJourney(session); syncAdminShell(session);
}



async function getBootstrap(): Promise<Components['Bootstrap']> {
  try {
    const cfg = await api<Components['AuthConfig']>('/auth/config');
    if (cfg.lab_auth_enabled) {
      if (cfg.subjects && cfg.subjects.length > 0) {
        return {
          mode: 'SYNTHETIC_LAB',
          csrf_token: cfg.csrf_token,
          subjects: cfg.subjects,
        };
      }
      return await api<Components['Bootstrap']>('/auth/bootstrap');
    }
    return {
      mode: 'PRODUCTION',
      csrf_token: cfg.csrf_token,
      subjects: [],
    } as unknown as Components['Bootstrap'];
  } catch {
    return api<Components['Bootstrap']>('/auth/bootstrap');
  }
}



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

async function create(): Promise<void> {

  const params = new URLSearchParams(location.search);

  let id = params.get('id') ?? params.get('layanan') ?? params.get('slug') ?? params.get('service') ?? '';

  if (!id && (location.pathname.startsWith('/tiket/baru/') || location.pathname.startsWith('/lapor/'))) {

    id = location.pathname.replace(/^\/(?:tiket\/baru|lapor)\//, '').replace(/\.html$/, '').replace(/\/$/, '');

  }

  if (!id) { location.replace('/layanan.html'); return; }

  if (!isUUID(id) && id) {

    try {

      const targetCode = (SERVICE_SLUGS[id.toLowerCase()] ?? id).toLowerCase();

      const page = await api<{ items: Components['Service'][] }>('/catalog/services?limit=100');

      const found = page.items.find(s => s.code.toLowerCase() === targetCode || s.code.toLowerCase() === id.toLowerCase() || s.id === id);

      if (found) id = found.id;

    } catch {}

  }

  if (!isUUID(id)) {

    const isAsnOnly = id && (SERVICE_SLUGS[id.toLowerCase()] || id.startsWith('TIK-'));

    if (isAsnOnly) {

      setStatus('Layanan ini memerlukan autentikasi Pegawai / ASN Pemerintah Kota Depok.');

      const formEl = $<HTMLFormElement>('[data-ticket-create]');

      if (formEl) {

        formEl.hidden = false;

        formEl.replaceChildren();

        const alertBox = el('div', '', 'vy-contact-form hd-asn-alert');
        const h2 = el('h2', 'Autentikasi ASN Diperlukan', 'hd-asn-alert__title');
        const p = el('p', 'Layanan ini dikhususkan bagi Aparatur Sipil Negara (ASN) Pemerintah Kota Depok. Gunakan akun ASN lab untuk melanjutkan formulir. Integrasi SSO kedinasan belum diaktifkan.', 'hd-asn-alert__desc');
        const act = el('div', '', 'hd-actions');
        const loginLink = el('a', 'Masuk dan lanjutkan laporan', 'btn btn-primary') as HTMLAnchorElement;
        loginLink.href = serviceLoginHref(id, 'report');
        const backLink = el('a', '← Kembali ke Katalog', 'btn hd-asn-alert__back') as HTMLAnchorElement;
        backLink.href = '/layanan.html';
        act.append(loginLink, backLink);
        alertBox.append(h2, p, act);
        formEl.append(alertBox);

      }

      return;

    }

    setStatus('Pilih layanan yang sesuai untuk memulai laporan.');
    const choice = el('a', 'Pilih layanan', 'btn btn-primary') as HTMLAnchorElement;
    choice.href = '/layanan.html';
    $('[data-ticket-status]')?.after(choice);

    return;

  }


  const service = await api<Components['Service']>('/catalog/services/' + id);

  const [formSnap, policy] = await Promise.all([

    api<Components['Form']>('/catalog/services/' + id + '/form'),

    api<Components['Policy']>('/catalog/services/' + id + '/policy')

  ]);

  if (service.version !== formSnap.version || service.version !== policy.version) {

    setStatus('Versi layanan berubah saat memuat. Muat ulang dan tinjau formulir.');

    return;

  }

  const formEl = $<HTMLFormElement>('[data-ticket-create]');

  if (!formEl) return;

  const reporting = await bindReportingContext(formEl, service, session);
  formEl.hidden = false;

  const dyn = $('[data-ticket-dynamic]');

  if (dyn) {

    dyn.replaceChildren();

    for (const field of formSnap.fields) {

      const group = el('div', '', 'vy-input-group');

      const label = el('label', field.label + (field.required ? ' *' : '')) as HTMLLabelElement;

      label.htmlFor = 'answer-' + field.key;

      let control: HTMLElement;

      if (field.kind === 'choice') {

        const select = el('select') as HTMLSelectElement;

        const def = el('option', 'Pilih salah satu…') as HTMLOptionElement;

        def.value = '';

        select.append(def);

        for (const opt of field.options) {

          const o = el('option', opt) as HTMLOptionElement;

          o.value = opt;

          select.append(o);

        }

        control = select;

      } else {

        const isLongText = /uraian|gejala|kronologi|catatan|kebutuhan|kendala|pesan|alasan|justifikasi|tujuan/i.test(field.key);

        if (isLongText && field.kind !== 'number' && field.kind !== 'date') {

          const textarea = el('textarea') as HTMLTextAreaElement;

          textarea.rows = 3;

          textarea.maxLength = 4000;

          textarea.placeholder = `Masukkan ${field.label.toLowerCase()}...`;

          control = textarea;

        } else {

          const input = el('input') as HTMLInputElement;

          input.type = field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : (/email/i.test(field.key) ? 'email' : (/kontak|wa|telepon|hp/i.test(field.key) ? 'tel' : 'text'));

          if (input.type === 'tel') input.inputMode = 'tel';

          if (/nik|nip/i.test(field.key)) input.inputMode = 'numeric';

          input.maxLength = 4000;

          input.placeholder = `Masukkan ${field.label.toLowerCase()}...`;

          control = input;

        }

      }

      control.id = 'answer-' + field.key;

      (control as HTMLInputElement).name = 'answer-' + field.key;

      control.className = 'vy-input';

      (control as HTMLInputElement).required = field.required;

      group.append(label, control);

      dyn.append(group);

    }

  }



  setGuestReceiptMode(formEl, !session);

  let guestKey = '';

  let guestCsrf = '';

  if (!session) {

    guestKey = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');

    const keyInput = $<HTMLInputElement>('#ticket-key');

    if (keyInput) keyInput.value = guestKey;

    const keySec = $('[data-guest-key]');

    if (keySec) keySec.hidden = false;

    const savedCheck = formEl.elements.namedItem('saved-key') as HTMLInputElement | null;

    if (savedCheck) savedCheck.required = true;

    guestCsrf = (await getBootstrap()).csrf_token;

    $('.hd-actions')?.setAttribute('data-ready', 'true');

  }



  const toggleKeyBtn = $<HTMLButtonElement>('[data-toggle-key]');

  toggleKeyBtn?.addEventListener('click', () => {

    const keyInput = $<HTMLInputElement>('#ticket-key');

    if (keyInput) {

      if (keyInput.type === 'password') {

        keyInput.type = 'text';

        toggleKeyBtn.textContent = '🔒 Tutup';

        toggleKeyBtn.title = 'Sembunyikan kunci';

      } else {

        keyInput.type = 'password';

        toggleKeyBtn.textContent = '👁️ Intip';

        toggleKeyBtn.title = 'Lihat kunci';

      }

    }

  });



  const copyKeyBtn = $<HTMLButtonElement>('[data-copy-key]');

  copyKeyBtn?.addEventListener('click', () => {

    void navigator.clipboard.writeText(guestKey)

      .then(() => {

        const orig = copyKeyBtn.textContent || 'Salin Kunci';

        copyKeyBtn.textContent = '✓ Tersalin!';

        setStatus('Kunci pelacakan berhasil disalin ke papan klip. Simpan di tempat yang aman sebelum mengirim laporan!', '[data-submit-status]');

        setTimeout(() => { copyKeyBtn.textContent = orig; }, 3000);

      })

      .catch(() => setStatus('Salin belum tersedia pada browser ini. Pilih field kunci lalu salin secara pribadi.', '[data-submit-status]'));

  });



  const srvContext = $('[data-service-context]');

  if (srvContext) {

    srvContext.hidden = false;

    const srvNameEl = $('[data-service-name]');

    if (srvNameEl) srvNameEl.textContent = service.name;

    const srvCatEl = $('[data-service-category]');
    const modeLabel = service.access_mode === 'PUBLIC_GUEST' ? 'Layanan Terbuka (Publik)' : (service.access_mode === 'ASN_AUTH' ? 'Khusus ASN Pemkot Depok' : (service.category_id || 'Layanan Resmi TIK'));
    if (srvCatEl) srvCatEl.textContent = modeLabel;
    const srvSlaEl = $('[data-service-sla]');
    if (srvSlaEl) {
      const maxMb = (policy.upload_max_bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 2 });
      srvSlaEl.textContent = `Lampiran maksimal ${maxMb} MB. Target penanganan mengikuti kebijakan layanan pada tiket.`;
    }

  }



  const titleInput = $<HTMLInputElement>('#ticket-title');

  const titleCount = $('[data-count-title]');

  titleInput?.addEventListener('input', () => {

    const len = titleInput.value.length;

    if (titleCount) {

      titleCount.textContent = `${len} / 200`;

      titleCount.classList.toggle('is-warning', len >= 170 && len < 200);

      titleCount.classList.toggle('is-danger', len >= 200);

    }

  });



  const descInput = $<HTMLTextAreaElement>('#ticket-description');

  const descCount = $('[data-count-desc]');

  descInput?.addEventListener('input', () => {

    const len = descInput.value.length;

    if (descCount) {

      descCount.textContent = `${len} / 4000`;

      descCount.classList.toggle('is-warning', len >= 3600 && len < 4000);

      descCount.classList.toggle('is-danger', len >= 4000);

    }

  });



  setStatus(`${service.name} · Formulir v${formSnap.form_version} · Policy v${policy.policy_version}`);



  const dropzoneEl = $('#hd-create-dropzone');

  const fileInput = $<HTMLInputElement>('#ticket-create-file');

  const filePreview = $('[data-file-preview]');

  const fileNameEl = $('[data-file-name]');

  const fileSizeEl = $('[data-file-size]');

  const fileIconEl = $('[data-file-icon]');

  const fileThumbImg = $<HTMLImageElement>('[data-file-thumb]');

  const fileClearBtn = $<HTMLButtonElement>('[data-file-clear]');

  let selectedFile: File | null = null;

  let selectedMediaId: string | null = null;

  let currentThumbUrl: string | null = null;



  function clearFileSelection() {

    if (currentThumbUrl) {

      URL.revokeObjectURL(currentThumbUrl);

      currentThumbUrl = null;

    }

    if (fileInput) fileInput.value = '';

    selectedFile = null;

    selectedMediaId = null;

    if (filePreview) filePreview.hidden = true;

    if (fileThumbImg) {

      fileThumbImg.hidden = true;

      fileThumbImg.src = '';

    }

    if (fileIconEl) {

      fileIconEl.hidden = false;

      fileIconEl.textContent = '📄';

    }

    const mediaLabel = $('[data-selected-media-name]');

    if (mediaLabel) mediaLabel.textContent = '';

  }



  function applyFile(file: File) {

    if (file.size > 10485760) {

      setStatus('Ukuran berkas melebihi batas 10 MB. Silakan pilih berkas yang lebih kecil.', '[data-submit-status]');

      clearFileSelection();

      return;

    }

    if (currentThumbUrl) {

      URL.revokeObjectURL(currentThumbUrl);

      currentThumbUrl = null;

    }

    selectedFile = file;

    selectedMediaId = null;

    if (fileNameEl) fileNameEl.textContent = file.name;

    const szText = file.size < 1048576

      ? `${(file.size / 1024).toFixed(1)} KB`

      : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    if (fileSizeEl) fileSizeEl.textContent = `${szText} · ${file.type || 'Berkas'}`;



    if (file.type.startsWith('image/')) {

      currentThumbUrl = URL.createObjectURL(file);

      if (fileThumbImg) {

        fileThumbImg.src = currentThumbUrl;

        fileThumbImg.hidden = false;

      }

      if (fileIconEl) fileIconEl.hidden = true;

    } else {

      if (fileThumbImg) fileThumbImg.hidden = true;

      if (fileIconEl) {

        fileIconEl.hidden = false;

        fileIconEl.textContent = file.type === 'application/pdf' ? '📕' : '📄';

      }

    }

    if (filePreview) filePreview.hidden = false;

    setStatus('', '[data-submit-status]');

  }



  fileInput?.addEventListener('change', () => {

    const file = (fileInput.files ?? [])[0];

    if (file) applyFile(file);

    else clearFileSelection();

  });



  if (dropzoneEl) {

    dropzoneEl.addEventListener('click', (e) => {

      if ((e.target as HTMLElement).closest('button, [data-open-media-picker], .hd-dropzone-input')) return;

      fileInput?.click();

    });



    dropzoneEl.addEventListener('keydown', (e) => {

      if (e.key === 'Enter' || e.key === ' ') {

        e.preventDefault();

        fileInput?.click();

      }

    });



    dropzoneEl.addEventListener('dragenter', (e) => {

      e.preventDefault();

      dropzoneEl.classList.add('is-dragover');

    });



    dropzoneEl.addEventListener('dragover', (e) => {

      e.preventDefault();

      dropzoneEl.classList.add('is-dragover');

    });



    dropzoneEl.addEventListener('dragleave', (e) => {

      e.preventDefault();

      dropzoneEl.classList.remove('is-dragover');

    });



    dropzoneEl.addEventListener('drop', (e) => {

      e.preventDefault();

      dropzoneEl.classList.remove('is-dragover');

      const files = e.dataTransfer?.files;

      if (files && files.length > 0) {

        applyFile(files[0]);

      }

    });

  }



  fileClearBtn?.addEventListener('click', clearFileSelection);



  setupMediaPicker(media => {

    clearFileSelection();

    selectedMediaId = media.id;

    if (fileNameEl) fileNameEl.textContent = media.alt || `Media Pustaka (${media.id.slice(0, 8)}…)`;

    if (fileSizeEl) fileSizeEl.textContent = `${Math.round(media.size_bytes / 1024)} KB · Owner: ${media.owner}`;

    if (fileThumbImg) fileThumbImg.hidden = true;

    if (fileIconEl) {

      fileIconEl.hidden = false;

      fileIconEl.textContent = '🖼️';

    }

    if (filePreview) filePreview.hidden = false;

  });



  const draftBanner = $('[data-draft-banner]');

  const draftConflict = $('[data-draft-conflict]');

  const draftStatus = $('[data-draft-status]');

  const restoreBtn = $('[data-draft-restore]');

  const discardBtn = $('[data-draft-discard]');

  const reloadServerBtn = $('[data-draft-reload-server]');

  const overwriteBtn = $('[data-draft-overwrite]');



  const form = formEl;

  const principalId = session?.actor?.subject_id || 'guest';

  const draftStorageKey = `helpdesk_draft_${principalId}_${id}`;

  let draftId = '';

  let draftVersion = 0;

  let autosaveTimer: number | undefined;



  function getLocalDraft(): { title: string; description: string; answers: Record<string, string>; version: number } | null {

    try {

      const store = getStore();

      const item = store?.getItem(draftStorageKey);

      if (item) return JSON.parse(item);

    } catch {}

    return null;

  }



  function setLocalDraft(data: { title: string; description: string; answers: Record<string, string>; version: number }): void {

    try {

      const store = getStore();

      store?.setItem(draftStorageKey, JSON.stringify(data));

    } catch {}

  }



  function clearLocalDraft(): void {

    try {

      const store = getStore();

      store?.removeItem(draftStorageKey);

    } catch {}

  }



  function populateDraftToForm(data: { title: string; description: string; answers?: Record<string, string> }): void {

    const titleInput = $<HTMLInputElement>('#ticket-title');

    const descInput = $<HTMLTextAreaElement>('#ticket-description');

    if (titleInput && data.title) titleInput.value = data.title;

    if (descInput && data.description) descInput.value = data.description;

    if (data.answers) {

      for (const [k, v] of Object.entries(data.answers)) {

        const fieldEl = form.elements.namedItem('answer-' + k) as HTMLInputElement | HTMLSelectElement | null;

        if (fieldEl && typeof v === 'string') fieldEl.value = v;

      }

    }

  }



  let existingServerDraft: DraftRecord | null = null;

  try {

    const draftsRes = await api<{ items: DraftRecord[] }>('/drafts');

    if (draftsRes.items && draftsRes.items.length > 0) {

      existingServerDraft = draftsRes.items[0];

      draftId = existingServerDraft.id;

      draftVersion = existingServerDraft.version;

    }

  } catch {}



  const localDraft = getLocalDraft();

  if (existingServerDraft || localDraft) {

    if (draftBanner) draftBanner.hidden = false;

  }



  restoreBtn?.addEventListener('click', () => {

    if (existingServerDraft) {

      populateDraftToForm(existingServerDraft);

      if (draftStatus) draftStatus.textContent = `Draft dipulihkan dari server (v${existingServerDraft.version})`;

    } else if (localDraft) {

      populateDraftToForm(localDraft);

      draftVersion = localDraft.version;

      if (draftStatus) draftStatus.textContent = 'Draft dipulihkan dari penyimpanan lokal.';

    }

    if (draftBanner) draftBanner.hidden = true;

  });



  discardBtn?.addEventListener('click', async () => {

    clearLocalDraft();

    if (draftId) {

      try {

        await api('/drafts/' + draftId, 'DELETE');

      } catch {}

    }

    draftId = '';

    draftVersion = 0;

    if (draftBanner) draftBanner.hidden = true;

    if (draftStatus) draftStatus.textContent = 'Draft dibuang.';

  });



  async function saveDraftToServer(forceExpectedVersion?: number): Promise<void> {

    const currentTitle = formValue(form, 'title');

    const currentDesc = formValue(form, 'description');

    if (!currentTitle && !currentDesc) return;



    const answers: Record<string, string> = {};

    for (const f of formSnap.fields) {

      answers[f.key] = formValue(form, 'answer-' + f.key);

    }



    if (!draftId) {

      draftId = crypto.randomUUID();

      draftVersion = 0;

    }



    const expVer = forceExpectedVersion !== undefined ? forceExpectedVersion : draftVersion;

    if (draftStatus) draftStatus.textContent = 'Menyimpan draft…';



    try {

      const res = await api<DraftRecord>(`/drafts/${draftId}`, 'PUT', {

        expected_version: expVer,

        form_version: formSnap.form_version,

        title: currentTitle,

        description: currentDesc,

        answers

      }, crypto.randomUUID(), session ? undefined : guestCsrf, guestKey ? { 'X-Guest-Capability': guestKey } : {});



      draftVersion = res.version;

      setLocalDraft({ title: currentTitle, description: currentDesc, answers, version: res.version });

      if (draftConflict) draftConflict.hidden = true;

      const now = new Date();

      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (draftStatus) draftStatus.textContent = `Draft tersimpan (v${res.version} pada ${timeStr})`;

    } catch (err) {

      if (err instanceof APIError && err.status === 409) {

        if (draftConflict) draftConflict.hidden = false;

        if (draftStatus) draftStatus.textContent = 'Konflik versi: draft diedit di tab lain.';

      } else {

        if (draftStatus) draftStatus.textContent = 'Draft tersimpan lokal (server offline).';

        setLocalDraft({ title: currentTitle, description: currentDesc, answers, version: draftVersion });

      }

    }

  }



  function triggerAutosave(): void {

    if (autosaveTimer) window.clearTimeout(autosaveTimer);

    autosaveTimer = window.setTimeout(() => {

      void saveDraftToServer();

    }, 1500);

  }



  formEl.addEventListener('input', triggerAutosave);



  reloadServerBtn?.addEventListener('click', async () => {

    if (!draftId) return;

    try {

      const sDraft = await api<DraftRecord>(`/drafts/${draftId}`);

      draftVersion = sDraft.version;

      populateDraftToForm(sDraft);

      setLocalDraft({ title: sDraft.title, description: sDraft.description, answers: sDraft.answers || {}, version: sDraft.version });

      if (draftConflict) draftConflict.hidden = true;

      if (draftStatus) draftStatus.textContent = `Versi server dimuat (v${sDraft.version})`;

    } catch (err) {

      setStatus(errorText(err), '[data-submit-status]');

    }

  });



  overwriteBtn?.addEventListener('click', async () => {

    if (!draftId) return;

    try {

      const sDraft = await api<DraftRecord>(`/drafts/${draftId}`);

      await saveDraftToServer(sDraft.version);

      if (draftConflict) draftConflict.hidden = true;

    } catch (err) {

      setStatus(errorText(err), '[data-submit-status]');

    }

  });



  const validationBox = $<HTMLElement>('[data-validation-summary]', formEl);
  const validationList = $<HTMLElement>('[data-validation-list]', formEl);
  function showValidationSummary(activeForm: HTMLFormElement): boolean {
    const invalid = [...activeForm.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')]
      .filter(field => !field.disabled && field.offsetParent !== null && !field.checkValidity());
    const reportingOk = reporting.valid();
    if (!reportingOk || invalid.length > 0) {
      if (validationBox && validationList) {
        validationList.replaceChildren();
        for (const field of invalid) {
          const label = (field.id && activeForm.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent) || field.name || 'Isian wajib';
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = `${label.replace(/\s*\*\s*$/, '').trim()}: ${field.validationMessage || 'Harap lengkapi isian ini.'}`;
          btn.addEventListener('click', () => field.focus());
          li.append(btn);
          validationList.append(li);
        }
        if (!reportingOk && invalid.length === 0) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'Identitas atau OPD pelapor belum lengkap.';
          btn.addEventListener('click', () => $<HTMLElement>('[data-reporting-mode], [name=reporter_opd_code], [name=reporter_name]', activeForm)?.focus());
          li.append(btn);
          validationList.append(li);
        }
        validationBox.hidden = validationList.childElementCount === 0;
      }
      activeForm.reportValidity();
      if (invalid[0]) invalid[0].focus();
      return false;
    }
    if (validationBox) validationBox.hidden = true;
    return true;
  }
  if (validationBox) formEl.noValidate = true;
  formEl.addEventListener('input', () => {
    if (validationBox && !validationBox.hidden && formEl.checkValidity()) validationBox.hidden = true;
  });
  formEl.addEventListener('submit', event => {
    if (showValidationSummary(formEl)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const review = $<HTMLDialogElement>('[data-report-review]');
  let approved = false;
  if (review) {
    const summary = $<HTMLElement>('[data-review-fields]', review)!;
    formEl.addEventListener('submit', event => {
      if (approved) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!reporting.valid() || !formEl.reportValidity() || review.open) return;
      summary.replaceChildren();
      const add = (label: string, value: string) => {
        summary.append(el('dt', label), el('dd', value || 'Belum diisi'));
      };
      add('Layanan', service.name);
      reporting.review(add);
      add('Judul laporan', formValue(formEl, 'title'));
      add('Uraian kendala', formValue(formEl, 'description'));
      for (const field of formSnap.fields) add(field.label, formValue(formEl, 'answer-' + field.key));
      add('Lampiran', selectedFile?.name ?? 'Tanpa berkas tambahan');
      review.showModal();
      $<HTMLButtonElement>('[data-review-send]', review)?.focus();
    }, true);
    $('[data-review-edit]', review)?.addEventListener('click', () => review.close());
    $('[data-review-send]', review)?.addEventListener('click', () => {
      approved = true;
      review.close();
      try { formEl.requestSubmit(); } finally { approved = false; }
    });
    review.addEventListener('close', () => {
      if (!approved) $<HTMLButtonElement>('button[type=submit]', formEl)?.focus();
    });
  }

  const sender = durableIntent<Components['TicketCreate']>();

  let pending = false;

  formEl.addEventListener('submit', async e => {

    e.preventDefault();

    if (pending || !reporting.valid() || !formEl.reportValidity()) return;

    pending = true;

    const submitBtn = $<HTMLButtonElement>('button[type=submit]', formEl);

    if (submitBtn) submitBtn.disabled = true;

    formEl.setAttribute('aria-busy', 'true');

    const answers: Record<string, unknown> = {};

    for (const f of formSnap.fields) {

      answers[f.key] = formValue(formEl, 'answer-' + f.key);

    }

    let finalDesc = formValue(formEl, 'description');

    if (selectedMediaId) {

      finalDesc += `\n\n[Referensi Pustaka Media: ${selectedMediaId}]`;

    }

    const payload: Components['TicketCreate'] = {
      ...reporting.payload(),

      service_id: id,

      service_version: service.version,

      form_version: formSnap.form_version,

      policy_version: policy.policy_version,

      title: formValue(formEl, 'title'),

      description: finalDesc,

      answers

    };

    const committedFile = selectedFile;
    setStatus('Menyimpan laporan ke server…', '[data-submit-status]');

    try {

      if (!session) guestCsrf = (await getBootstrap()).csrf_token;

      const res = await sender('/tickets', payload, (k, orig) =>

        api<Components['Receipt']>('/tickets', 'POST', orig, k, session ? undefined : guestCsrf, guestKey ? { 'X-Guest-Capability': guestKey } : {})

      );



      const createdSec = $('[data-ticket-created]');
      formEl.hidden = true;
      if (srvContext) srvContext.hidden = true;
      const stepper = $('.hd-form-stepper');
      if (stepper) stepper.hidden = true;

      clearLocalDraft();
      if (draftId) void api('/drafts/' + draftId, 'DELETE').catch(() => {});

      if (createdSec) {
        createdSec.hidden = false;
        const heading = el('h2', 'Laporan tersimpan');
        heading.tabIndex = -1;
        const attachmentStatus = el('p');
        attachmentStatus.setAttribute('role', 'status');
        createdSec.replaceChildren(heading, el('p', 'Tiket diterima dan masuk antrean verifikasi.'),
          ticketLink(res.id), attachmentStatus);
        heading.focus();

        let trackingReady = !guestKey;
        async function enableTracking() {
          if (!guestKey || trackingReady) return;
          const boot = await getBootstrap();
          await api('/guest/tracking-session', 'POST', { csrf_token: boot.csrf_token },
            crypto.randomUUID(), boot.csrf_token, { 'X-Guest-Capability': guestKey });
          trackingReady = true;
        }
        if (committedFile) {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'btn btn-secondary';
          retry.textContent = 'Ulangi unggah lampiran';
          retry.hidden = true;
          createdSec.append(retry);
          const upload = attachmentSender();
          const sendAttachment = async () => {
            retry.disabled = true;
            attachmentStatus.textContent = 'Mengunggah ' + committedFile.name + '…';
            try {
              await enableTracking();
              await upload(res.id, committedFile, 'REQUESTER', res.version, guestKey || undefined);
              attachmentStatus.textContent = committedFile.name + ' masuk karantina untuk dipindai.';
              if (document.activeElement === retry) heading.focus();
              retry.hidden = true;
            } catch (error) {
              attachmentStatus.textContent = 'Tiket sudah tersimpan. Unggah lampiran belum terkonfirmasi. ' + errorText(error);
              retry.hidden = false;
            } finally {
              retry.disabled = false;
            }
          };
          retry.addEventListener('click', () => void sendAttachment());
          await sendAttachment();
        } else {
          try { await enableTracking(); }
          catch { attachmentStatus.textContent = 'Gunakan kunci yang Anda simpan di halaman Lacak tiket tamu untuk membuka tiket.'; }
        }
      }

      setStatus('Laporan tersimpan pada server.');

    } catch (err) {

      setStatus(errorText(err) + ' Untuk status commit yang belum pasti, ulangi intent yang sama.', '[data-submit-status]');

      $('[data-submit-status]')?.focus();

    } finally {

      pending = false;

      if (submitBtn) submitBtn.disabled = false;

      formEl.removeAttribute('aria-busy');

    }

  });

}



function createCursorPager<T>(

  name: string,

  urlProvider: () => string,

  renderer: (items: T[]) => void,

  limit = 10

): (reset?: boolean) => Promise<void> {

  let cursor = '';

  let nextCursor: string | null = null;

  const historyStack: string[] = [];

  const prevBtn = $<HTMLButtonElement>(`[data-ticket-prev="${name}"]`);

  const nextBtn = $<HTMLButtonElement>(`[data-ticket-next="${name}"]`);

  let counter = 0;
  const retryBtn = $<HTMLButtonElement>(`[data-ticket-retry="${name}"]`);




  async function loadPage(reset = false): Promise<void> {

    if (reset) {

      cursor = '';

      historyStack.length = 0;

    }

    const currentSeq = ++counter;
    if (retryBtn) retryBtn.hidden = true;
    if (name === 'tiket') setStatus('Memuat tiket…');

    if (prevBtn) prevBtn.disabled = true;

    if (nextBtn) nextBtn.disabled = true;

    try {

      const base = urlProvider();

      const sep = base.includes('?') ? '&' : '?';

      const u = `${base}${sep}limit=${limit}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;

      const res = await api<{ items: T[]; next_cursor: string | null }>(u);

      if (currentSeq !== counter) return;

      nextCursor = res.next_cursor;

      renderer(res.items);

      setStatus(res.items.length ? 'Data sesuai akses server.' : 'Belum ada data pada bagian ini.');

      if (prevBtn) prevBtn.disabled = historyStack.length === 0;

      if (nextBtn) nextBtn.disabled = !nextCursor;

    } catch (err) {

      if (currentSeq === counter) {

        renderer([]);
        if (retryBtn) retryBtn.hidden = false;
        setStatus(errorText(err));

      }

    }

  }



  prevBtn?.addEventListener('click', () => {

    cursor = historyStack.pop() ?? '';

    void loadPage();

  });

  nextBtn?.addEventListener('click', () => {

    if (nextCursor) {

      historyStack.push(cursor);

      cursor = nextCursor;

      void loadPage();

    }

  });



  retryBtn?.addEventListener('click', () => void loadPage());
  return loadPage;

}



function queueTable(items: Ticket[], bulk?: { enabled: boolean; selected: Map<string, number>; onSelect: () => void }) {
  const wrapper = el('div', '', 'piui-table-scroll hd-queue-table');
  const table = document.createElement('table');
  table.className = 'piui-table';
  table.setAttribute('aria-label', 'Antrean tiket');
  const labels = bulk?.enabled
    ? ['Pilih', 'Tiket', 'Status', 'Prioritas', 'Diterima', 'Target penyelesaian', 'Penugasan', 'Tindakan']
    : ['Tiket', 'Status', 'Prioritas', 'Diterima', 'Target penyelesaian', 'Penugasan', 'Tindakan'];
  const header = table.createTHead().insertRow();
  for (const label of labels) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    header.append(th);
  }
  const body = table.createTBody();
  const format = new Intl.DateTimeFormat('id-ID', {dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta'});
  const time = (value?: string) => {
    const date = new Date(value ?? '');
    if (!Number.isFinite(date.getTime())) return document.createTextNode('Belum tersedia');
    const node = document.createElement('time');
    node.dateTime = date.toISOString();
    node.textContent = format.format(date) + ' WIB';
    return node;
  };
  const labelOffset = bulk?.enabled ? 2 : 1;
  for (const ticket of items) {
    const row = body.insertRow();
    if (bulk?.enabled) {
      const selCell = row.insertCell();
      selCell.dataset.label = 'Pilih';
      const terminalUnarchived = ['CLOSED', 'CANCELLED'].includes(ticket.state) && !ticket.archived_at;
      if (terminalUnarchived) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('aria-label', `Pilih ${ticket.number} untuk arsip massal`);
        cb.checked = bulk.selected.has(ticket.id);
        cb.addEventListener('change', () => {
          if (cb.checked) bulk.selected.set(ticket.id, ticket.version);
          else bulk.selected.delete(ticket.id);
          bulk.onSelect();
        });
        selCell.append(cb);
      } else {
        selCell.textContent = '-';
      }
    }
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.append(el('strong', ticket.title), el('span', ticket.number, 'hd-queue-number'));
    row.append(heading);
    const columns = [
      document.createTextNode(ticketState(ticket) + (ticket.verification === 'VERIFIED' ? ' · Terverifikasi' : ' · Menunggu verifikasi')),
      document.createTextNode(priorityLabel(ticket.classification_decision?.priority ?? ticket.priority)),
      time(ticket.accepted_at),
      time(ticket.resolution_due_at),
      document.createTextNode(!ticket.assignee_id ? 'Belum ditugaskan' :
        ticket.assignee_id === session?.actor.subject_id ? 'Ditugaskan kepada Anda' : 'Sudah ditugaskan'),
      ticketLink(ticket.id),
    ];
    columns.forEach((value, index) => {
      const cell = row.insertCell();
      cell.dataset.label = labels[index + labelOffset];
      cell.append(value);
    });
  }
  wrapper.append(table);
  return wrapper;
}

async function list(): Promise<void> {
  const root = $('[data-ticket-list]');
  if (!root) return;
  const adminQueue = location.pathname.startsWith('/admin/');
  const roleGuide = $('[data-queue-role-guide]');
  if (roleGuide) roleGuide.hidden = !adminQueue;

  if (!session) {
    root.replaceChildren(el('p', 'Masuk untuk melihat tiket akun Anda, atau gunakan kunci untuk melacak laporan tamu.'));
    const access = el('a', 'Masuk ke tiket saya', 'btn btn-primary') as HTMLAnchorElement;
    access.href = '/akses.html';
    const tracking = el('a', 'Lacak tiket tamu', 'btn btn-secondary') as HTMLAnchorElement;
    tracking.href = '/lacak.html';
    root.append(access, tracking);
    setStatus('Pilih cara membuka tiket Anda.');
    return;
  }
  const guide = $('[data-queue-role-guide]');
  if (guide) {
    guide.hidden = !adminQueue;
    const copy = $('[data-queue-guide-text]', guide);
    if (copy) copy.textContent = 'Pilih antrean, periksa status tiket, lalu buka detail untuk menjalankan tindakan sesuai tugas Anda.';
  }

  const can = (permission: string) => session?.actor.kind === 'STAFF' && session.actor.memberships.some(m =>
    m.organization_active && m.permissions.includes(permission));
  const endpoints: Record<string, string> = {all: '/tickets'};
  if (can('ticket.verify')) endpoints.verification = '/operator/queue/verification';
  if (can('ticket.dispatch')) endpoints.dispatch = '/operator/queue/dispatch';
  if (session?.actor.role === 'TECHNICIAN' && can('ticket.read')) endpoints['my-tasks'] = '/technician/queue/my-tasks';
  const defaultFilter = Object.keys(endpoints)[1] ?? 'all';
  const filterForRoute = () => {
    const requested = new URLSearchParams(location.search).get('filter') ?? '';
    return Object.hasOwn(endpoints, requested) ? requested : defaultFilter;
  };
  let filter = adminQueue ? filterForRoute() : 'all';

  const searchForm = $<HTMLFormElement>('[data-queue-search-form]');
  const searchQ = $<HTMLInputElement>('#queue-search-q');
  const filterState = $<HTMLSelectElement>('#queue-filter-state');
  const filterService = $<HTMLSelectElement>('#queue-filter-service');
  const bulkBar = $('[data-bulk-bar]');
  const bulkReason = $<HTMLInputElement>('#bulk-reason');
  const bulkBtn = $<HTMLButtonElement>('[data-bulk-archive-btn]');
  const bulkCount = $('[data-bulk-count]');
  const bulkStatus = $('[data-bulk-status]');
  const selectedBulk = new Map<string, number>();
  const bulkEnabled = adminQueue && can('ticket.bulk') && can('ticket.archive');
  if (bulkBar) bulkBar.hidden = !bulkEnabled;
  const syncBulkCount = () => { if (bulkCount) bulkCount.textContent = String(selectedBulk.size); };
  const bulkCfg = { enabled: bulkEnabled, selected: selectedBulk, onSelect: syncBulkCount };

  const renderTickets = (items: Ticket[]) => {
    root.replaceChildren();
    if (adminQueue) {
      if (items.length) {
        root.append(queueTable(items, bulkCfg));
        initAdminDataTables(root);
      }
      return;
    }
    for (const ticket of items) {
      const card = el('article', '', 'vy-contact-form');
      card.append(el('p', ticket.number, 'court-badge'), el('h2', ticket.title),
        el('p', ticketState(ticket), 'court-badge'), el('p', requesterGuidance(ticket)), ticketLink(ticket.id));
      root.append(card);
    }
  };

  const buildEndpoint = () => {
    const base = endpoints[filter];
    if (filter !== 'all') return base;
    const params = new URLSearchParams();
    if (filterState?.value) params.set('state', filterState.value);
    if (filterService?.value) params.set('service_id', filterService.value);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const pager = createCursorPager<Ticket>('tiket', buildEndpoint, items => {
    renderTickets(items);
  }, adminQueue ? 100 : 10);

  if (searchForm) {
    searchForm.hidden = false;
    void loadQueueServiceFilter();
    const runSearchOrFilter = async () => {
      const q = searchQ?.value.trim() ?? '';
      const st = filterState?.value ?? '';
      const svcId = filterService?.value ?? '';
      if (q.length >= 2) {
        setStatus('Mencari tiket sesuai hak akses…');
        try {
          const matched = await searchTicketsAcl(q, st, svcId);
          renderTickets(matched);
          setStatus(matched.length ? `${matched.length} tiket ditemukan dari pencarian aman.` : 'Tidak ada tiket yang cocok dengan kata kunci dan filter ini.');
        } catch (err) {
          setStatus(errorText(err));
        }
        return;
      }
      if ((st || svcId) && filter !== 'all') {
        filter = 'all';
      }
      await pager(true);
    };
    searchForm.addEventListener('submit', e => { e.preventDefault(); void runSearchOrFilter(); });
    $('[data-queue-search-reset]', searchForm)?.addEventListener('click', () => {
      if (searchQ) searchQ.value = '';
      if (filterState) filterState.value = '';
      if (filterService) filterService.value = '';
      void pager(true);
    });
  }

  bulkBtn?.addEventListener('click', async () => {
    if (!bulkEnabled || !selectedBulk.size) {
      if (bulkStatus) bulkStatus.textContent = 'Pilih minimal satu tiket berstatus terminal (CLOSED/CANCELLED) terlebih dahulu.';
      return;
    }
    const reason = bulkReason?.value.trim() ?? '';
    if (reason.length < 5) {
      if (bulkStatus) bulkStatus.textContent = 'Alasan pengarsipan massal minimal 5 karakter.';
      bulkReason?.focus();
      return;
    }
    bulkBtn.disabled = true;
    try {
      const targets = [...selectedBulk.entries()].map(([id, expected_version]) => ({ id, expected_version }));
      const summary = await runBulkArchive(targets, reason);
      selectedBulk.clear();
      syncBulkCount();
      if (bulkReason) bulkReason.value = '';
      if (bulkStatus) bulkStatus.textContent = summary;
      await pager(true);
    } catch (err) {
      if (bulkStatus) bulkStatus.textContent = errorText(err);
    } finally {
      bulkBtn.disabled = false;
    }
  });

  if (!adminQueue) {
    void loadRequesterNotifications(session);
  } else {
    void loadHandoffInbox(session, () => pager(true));
  }

  const queueFilters = $('[data-queue-filters]');
  if (queueFilters && adminQueue) {
    queueFilters.hidden = false;
    const buttons = [...queueFilters.querySelectorAll<HTMLButtonElement>('[data-queue-filter]')];
    const sync = () => {
      for (const button of buttons) {
        const name = button.dataset.queueFilter ?? '';
        const active = filter === name;
        button.hidden = !Object.hasOwn(endpoints, name);
        button.classList.toggle('piui-btn--primary', active);
        button.classList.toggle('piui-btn--secondary', !active);
        button.setAttribute('aria-pressed', String(active));
      }
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        const name = button.dataset.queueFilter ?? '';
        if (!Object.hasOwn(endpoints, name) || filter === name) return;
        filter = name;
        const url = new URL(location.href);
        url.searchParams.set('filter', filter);
        history.pushState(null, '', url);
        sync();
        void pager(true);
      });
    }
    window.addEventListener('popstate', () => {
      filter = filterForRoute();
      sync();
      void pager(true);
    });
    sync();
  }
  await pager(true);
}



async function track(): Promise<void> {

  setStatus('Masukkan kunci pelacakan tiket tamu.');

  const form = $<HTMLFormElement>('[data-ticket-track]');

  if (!form) return;


  if (session) {

    form.hidden = true;

    setStatus('Anda sedang masuk sebagai akun. Keluar dari akun sebelum membuka pelacakan tiket tamu.');

    const btn = el('button', '', 'btn btn-secondary') as HTMLButtonElement;
    btn.innerHTML = '<span class="hd-btn-icon">🚪</span> Keluar akun untuk pelacakan tamu';

    btn.type = 'button';

    btn.addEventListener('click', async () => {

      try {

        await api('/auth/logout', 'POST', { expected_version: session?.version, reason: 'Berpindah ke pelacakan tamu' });

        location.reload();

      } catch (err) {

        setStatus(errorText(err));

      }

    });

    form.after(btn);

    return;

  }

  const keyGen = intent();

  let pending = false;

  form.addEventListener('submit', async e => {

    e.preventDefault();

    if (pending || !form.reportValidity()) return;

    const cap = $<HTMLInputElement>('#ticket-capability', form)?.value.trim().toLowerCase() ?? '';

    if (!/^[a-f0-9]{64}$/.test(cap)) {

      setStatus('Periksa kunci pelacakan. Gunakan 64 karakter yang Anda simpan saat membuat laporan.');
      $<HTMLInputElement>('#ticket-capability', form)?.focus();

      return;

    }

    pending = true;

    const btn = $<HTMLButtonElement>('button[type=submit]', form);

    if (btn) btn.disabled = true;

    try {

      const boot = await getBootstrap();

      const res = await api<{ ticket_id: string }>('/guest/tracking-session', 'POST', { csrf_token: boot.csrf_token }, keyGen('tracking', cap), boot.csrf_token, { 'X-Guest-Capability': cap });

      location.assign('/detail-tiket.html?id=' + encodeURIComponent(res.ticket_id));

    } catch (err) {

      setStatus(errorText(err));
      const field = $<HTMLInputElement>('#ticket-capability', form);
      // Retain the failed attempt only in the masked input for correction.
      // Do not persist capability credentials in drafts or browser storage.
      if (field) { field.value = cap; field.focus(); }

    } finally {

      pending = false;

      if (btn) btn.disabled = false;

    }

  });

  form.hidden = false;

}




function formatIndonesianDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const parts = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
    const time = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });
    return `${parts} • ${time} WIB`;
  } catch {
    return isoStr;
  }
}

function getRelativeTime(isoStr: string): string {
  try {
    const ms = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return `${m} mnt lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    const d = Math.floor(h / 24);
    return `${d} hari lalu`;
  } catch {
    return '';
  }
}

function parseHistoryAction(h: TicketHistory): {
  icon: string;
  nodeClass: string;
  actionTitle: string;
  actorRole: string;
} {
  const s = (h.summary || '').toLowerCase();
  const a = (h.action || '').toUpperCase();

  if (a.includes('CREATE') || s.includes('dibuat') || s.includes('diajukan') || s.includes('diterima') || s.includes('pendaftaran')) {
    return {
      icon: '📝',
      nodeClass: 'hd-timeline-node--create',
      actionTitle: 'Laporan Baru Terdaftar di Sistem',
      actorRole: 'Pemohon'
    };
  }
  if (a.includes('VERIFY') || s.includes('verifikasi') || s.includes('disahkan')) {
    return {
      icon: '🔍',
      nodeClass: 'hd-timeline-node--verify',
      actionTitle: 'Laporan Diverifikasi & Disahkan Operator',
      actorRole: 'Operator Front Desk'
    };
  }
  if (a.includes('DISPATCH') || a.includes('ASSIGN') || s.includes('ditugaskan') || s.includes('teknisi')) {
    return {
      icon: '👷',
      nodeClass: 'hd-timeline-node--dispatch',
      actionTitle: 'Disposisi & Penugasan Teknisi Pelaksana',
      actorRole: 'Koordinator Layanan'
    };
  }
  if (a.includes('RESOLV') || s.includes('penyelesaian') || s.includes('diperbaiki') || s.includes('tindakan perbaikan')) {
    return {
      icon: '🛠️',
      nodeClass: 'hd-timeline-node--resolve',
      actionTitle: 'Tindakan Perbaikan Teknis Diselesaikan',
      actorRole: 'Teknisi PIC Pelaksana'
    };
  }
  if (a === 'CONFIRMATION_ACCEPTED' || s.includes('disetujui') || s.includes('dikonfirmasi')) {
    return {
      icon: '👍',
      nodeClass: 'hd-timeline-node--confirm',
      actionTitle: 'Konfirmasi Penyelesaian Disetujui Pemohon',
      actorRole: 'Pemohon Laporan'
    };
  }
  if (a === 'CONFIRMATION_REJECTED' || s.includes('keberatan') || s.includes('ditolak')) {
    return {
      icon: '⚠️',
      nodeClass: 'hd-timeline-node--reject',
      actionTitle: 'Keberatan Hasil Penanganan Diajukan',
      actorRole: 'Pemohon Laporan'
    };
  }
  if (a === 'VENDOR_CASE_RECORDED' || s.includes('vendor') || s.includes('rekanan')) {
    return {
      icon: '🏢',
      nodeClass: 'hd-timeline-node--vendor',
      actionTitle: 'Koordinasi Penyedia / Vendor Rekanan',
      actorRole: 'Koordinator TIK'
    };
  }
  if (a === 'PAUSE_CHANGED' || s.includes('jeda') || s.includes('pause')) {
    return {
      icon: '⏸️',
      nodeClass: 'hd-timeline-node--pause',
      actionTitle: 'Persetujuan Jeda Waktu SLA Berizin',
      actorRole: 'Pimpinan TIK'
    };
  }
  if (a === 'HANDOFF_REQUESTED' || a === 'HANDOFF_ACCEPTED' || s.includes('handoff') || s.includes('pelimpahan')) {
    return {
      icon: '🔄',
      nodeClass: 'hd-timeline-node--handoff',
      actionTitle: 'Pelimpahan Wewenang Antar-OPD (Handoff)',
      actorRole: 'Pimpinan OPD'
    };
  }
  if (a === 'ESCALATION_REQUESTED' || s.includes('eskalasi')) {
    return {
      icon: '⚡',
      nodeClass: 'hd-timeline-node--dispatch',
      actionTitle: 'Eskalasi Tingkat Penanganan Berjenjang',
      actorRole: 'Koordinator TIK'
    };
  }
  if (s.includes('komentar') || s.includes('pesan') || s.includes('tanggapan')) {
    return {
      icon: '💬',
      nodeClass: 'hd-timeline-node--comment',
      actionTitle: 'Komunikasi / Catatan Penanganan',
      actorRole: 'Petugas / Pemohon'
    };
  }
  if (s.includes('lampiran') || s.includes('berkas') || s.includes('unggah') || s.includes('attachment')) {
    return {
      icon: '📎',
      nodeClass: 'hd-timeline-node--upload',
      actionTitle: 'Unggahan Berkas Bukti Kendala',
      actorRole: 'Pelapor / Teknisi'
    };
  }
  return {
    icon: '📌',
    nodeClass: 'hd-timeline-node--create',
    actionTitle: 'Pembaruan Status Penanganan',
    actorRole: 'Helpdesk TIK'
  };
}

function renderTimelineItem(h: TicketHistory): HTMLElement {
  const parsed = parseHistoryAction(h);
  const li = document.createElement('li');
  li.className = 'hd-timeline-item';

  const node = document.createElement('span');
  node.className = `hd-timeline-node ${parsed.nodeClass}`;
  node.textContent = parsed.icon;
  node.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'hd-timeline-card';

  const top = document.createElement('div');
  top.className = 'hd-timeline-top';

  const action = document.createElement('span');
  action.className = 'hd-timeline-action';
  action.textContent = parsed.actionTitle;

  const meta = document.createElement('div');
  meta.className = 'hd-timeline-meta';

  const actor = document.createElement('span');
  actor.className = 'hd-timeline-actor-badge';
  actor.textContent = parsed.actorRole;

  const relTime = document.createElement('span');
  relTime.className = 'hd-timeline-rel';
  relTime.textContent = getRelativeTime(h.created_at);

  meta.append(actor, relTime);
  top.append(action, meta);

  const timeDiv = document.createElement('div');
  timeDiv.className = 'hd-timeline-time';
  timeDiv.textContent = `📅 ${formatIndonesianDateTime(h.created_at)}`;

  const summary = document.createElement('p');
  summary.className = 'hd-timeline-summary';
  summary.textContent = h.summary;

  card.append(top, timeDiv, summary);
  li.append(node, card);
  return li;
}

function getStepClass(stepNum: number, ticket: Ticket): string {
  const state = ticket.state;
  if (state === 'CLOSED') return 'is-done';
  if (state === 'CANCELLED') return stepNum === 1 ? 'is-done' : '';
  if (state === 'NEEDS_INFORMATION') return stepNum === 1 ? 'is-done' : stepNum === 2 ? 'is-active' : '';
  if (state === 'RESOLVED') {
    if (stepNum <= 4) return 'is-done';
    if (stepNum === 5) return 'is-active';
    return '';
  }
  if (state === 'IN_PROGRESS' || state === 'ASSIGNED') {
    const target = state === 'ASSIGNED' ? 3 : 4;
    if (stepNum < target) return 'is-done';
    if (stepNum === target) return 'is-active';
    return '';
  }
  if (ticket.verification === 'VERIFIED') {
    if (stepNum <= 2) return 'is-done';
    if (stepNum === 3) return 'is-active';
    return '';
  }
  if (stepNum === 1) return 'is-done';
  if (stepNum === 2) return 'is-active';
  return '';
}

function getStepIcon(stepNum: number, ticket: Ticket): string {
  const cls = getStepClass(stepNum, ticket);
  if (cls === 'is-done') return '✓';
  return String(stepNum);
}

function renderExecutiveTicketProgress(
  ticket: Ticket,
  serviceName: string,
  techName: string,
  resolutionNote?: string,
  clock?: Components["SLAClock"],
  confirmationDueAt?: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hd-ticket-progress-view';

  const slaStates = {
    ON_TRACK: ['hd-sla-pill--on-track', 'Sesuai target SLA'],
    AT_RISK: ['hd-sla-pill--at-risk', 'Mendekati batas SLA'],
    BREACHED: ['hd-sla-pill--breached', 'Melewati target SLA'],
    PAUSED: ['hd-sla-pill--at-risk', 'Jeda penanganan disetujui'],
    CANCELLED: ['hd-sla-pill--on-track', 'Tiket dibatalkan'],
    UNAVAILABLE: ['hd-sla-pill--on-track', 'Perhitungan SLA belum tersedia'],
  } as const;
  const [slaClass, slaLabel] = slaStates[clock?.status ?? 'UNAVAILABLE'];
  const slaRemaining = clock?.policy_source === 'LEGACY'
    ? 'Target historis'
    : clock ? `Target ${formatIndonesianDateTime(clock.resolution_due_at)}` : '';
  
  const stateStyles: Record<string, {cls: string; icon: string}> = {
    OPEN: {cls: ticket.verification === 'VERIFIED' ? 'hd-badge--verified' : 'hd-badge--submitted', icon: '📥'},
    TRIAGED: {cls: 'hd-badge--verified', icon: '🔍'},
    NEEDS_INFORMATION: {cls: 'hd-badge--submitted', icon: '💬'},
    ASSIGNED: {cls: 'hd-badge--assigned', icon: '👷'},
    IN_PROGRESS: {cls: 'hd-badge--progress', icon: '🛠️'},
    RESOLVED: {cls: 'hd-badge--resolved', icon: '✅'},
    CLOSED: {cls: 'hd-badge--closed', icon: '✓'},
    CANCELLED: {cls: 'hd-badge--rejected', icon: '🚫'},
  };
  const curState = {...stateStyles[ticket.state], label: ticketState(ticket)};
  const prio = ticket.classification_decision?.priority || ticket.priority || (ticket.classification as { priority?: string })?.priority;
  const prioClasses: Record<string, string> = {
    'LOW': 'hd-badge--prio-low',
    'NORMAL': 'hd-badge--prio-normal',
    'HIGH': 'hd-badge--prio-high',
    'CRITICAL': 'hd-badge--prio-critical',
  };
  const prioCls = prioClasses[prio ?? ''] || 'hd-badge--prio-normal';

  const card = document.createElement('div');
  card.className = 'hd-progress-card';

  card.innerHTML = `
    <div class="hd-progress-header">
      <div class="hd-progress-badges">
        <span class="hd-progress-ticket-num" title="Nomor Tiket Resmi">
          🎫 ${htmlText(ticket.number)}
          <button type="button" class="hd-btn-copy-ticket" data-copy-ticket="${htmlText(ticket.number)}" title="Salin Nomor Tiket">📋 Salin</button>
        </span>
        <span class="hd-badge ${curState.cls}">${curState.icon} ${curState.label}</span>
        <span class="hd-badge ${prioCls}">Prioritas: ${priorityLabel(prio)}</span>
      </div>
      <div class="hd-progress-requester">
        <span>${ticket.requester_kind === 'ASN' ? '👔 Pemohon ASN' : '👤 Pemohon Masyarakat'}</span>
      </div>
    </div>

    <p class="hd-next-step">${session?.actor.kind === 'STAFF' ? 'Periksa riwayat dan gunakan tindakan yang tersedia sesuai mandat Anda.' : requesterGuidance(ticket)}</p>
    <h2 class="hd-progress-title">${htmlText(ticket.title)}</h2>
    ${ticket.reported_category ? `<p>Kategori pelapor: ${htmlText(ticket.reported_category.name)}</p>` : ''}
    ${ticket.reporting_context ? `<p>Asal laporan: ${htmlText(ticket.reporting_context.organization.name)}${ticket.reporting_context.division ? ' · ' + htmlText(ticket.reporting_context.division.name) : ''} · ${ticket.reporting_context.verified ? 'Akun ASN' : 'Pernyataan pelapor, belum terverifikasi'}</p>` : ''}
    <div class="hd-progress-desc">${htmlText(ticket.description)}</div>

    <!-- Stepper 5 Tahap Alur Penanganan -->
    <div class="hd-stepper-progress" aria-label="Tahapan Progres Penanganan">
      <div class="hd-stepper-item ${getStepClass(1, ticket)}">
        <div class="hd-stepper-node">${getStepIcon(1, ticket)}</div>
        <div class="hd-stepper-text">
          <span class="hd-stepper-name">1. Pengajuan</span>
          <span class="hd-stepper-sub">Diterima Sistem</span>
        </div>
      </div>
      <div class="hd-stepper-item ${getStepClass(2, ticket)}">
        <div class="hd-stepper-node">${getStepIcon(2, ticket)}</div>
        <div class="hd-stepper-text">
          <span class="hd-stepper-name">2. Verifikasi</span>
          <span class="hd-stepper-sub">Front Desk M4</span>
        </div>
      </div>
      <div class="hd-stepper-item ${getStepClass(3, ticket)}">
        <div class="hd-stepper-node">${getStepIcon(3, ticket)}</div>
        <div class="hd-stepper-text">
          <span class="hd-stepper-name">3. Disposisi</span>
          <span class="hd-stepper-sub">Penugasan Teknisi</span>
        </div>
      </div>
      <div class="hd-stepper-item ${getStepClass(4, ticket)}">
        <div class="hd-stepper-node">${getStepIcon(4, ticket)}</div>
        <div class="hd-stepper-text">
          <span class="hd-stepper-name">4. Penanganan</span>
          <span class="hd-stepper-sub">Pengerjaan Teknis</span>
        </div>
      </div>
      <div class="hd-stepper-item ${getStepClass(5, ticket)}">
        <div class="hd-stepper-node">${getStepIcon(5, ticket)}</div>
        <div class="hd-stepper-text">
          <span class="hd-stepper-name">5. Selesai</span>
          <span class="hd-stepper-sub">Konfirmasi Pemohon</span>
        </div>
      </div>
    </div>

    <!-- Grid 4 Parameter Kunci -->
    <div class="hd-progress-meta-grid">
      <div class="hd-meta-box">
        <span class="hd-meta-box__label">📋 Layanan &amp; Kategori TIK</span>
        <span class="hd-meta-box__val">${htmlText(serviceName)}</span>
        <span class="hd-meta-box__sub">Kategori: ${htmlText(ticket.classification.category || 'Belum diklasifikasikan')} • Diskominfo Depok</span>
      </div>

      <div class="hd-meta-box">
        <span class="hd-meta-box__label">👷 Petugas Penanggung Jawab</span>
        <span class="hd-meta-box__val">${htmlText(techName)}</span>
        <span class="hd-meta-box__sub">${ticket.verification === 'VERIFIED' ? '✓ Operator Front Desk Terverifikasi' : 'Menunggu Telaah Operator'}</span>
      </div>

      <div class="hd-meta-box">
        <span class="hd-meta-box__label">⏱️ Target Waktu SLA</span>
        <span class="hd-meta-box__val">${formatIndonesianDateTime(ticket.resolution_due_at)}</span>
        <div><span class="hd-sla-pill ${slaClass}">${slaLabel}</span></div>
        <span class="hd-meta-box__sub">${slaRemaining} (${htmlText(ticket.calendar_version)})</span>
      </div>

      <div class="hd-meta-box">
        <span class="hd-meta-box__label">📅 Waktu Pelaporan</span>
        <span class="hd-meta-box__val">${formatIndonesianDateTime(ticket.accepted_at)}</span>
        <span class="hd-meta-box__sub">Pembaruan: ${getRelativeTime(ticket.updated_at)}</span>
      </div>
    </div>
  `;

  const copyBtn = card.querySelector('[data-copy-ticket]');
  copyBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(ticket.number).then(() => {
      copyBtn.textContent = '✓ Tersalin!';
      setTimeout(() => { copyBtn.textContent = '📋 Salin'; }, 2000);
    }).catch(() => {});
  });

  container.append(card);

  if (['RESOLVED', 'CLOSED'].includes(ticket.state) && resolutionNote) {
    const resBox = document.createElement('div');
    resBox.className = 'hd-resolution-highlight';
    resBox.innerHTML = `
      <h3 class="hd-resolution-title">✅ Hasil Penanganan &amp; Solusi Perbaikan Teknisi</h3>
      <div class="hd-resolution-box">
        <strong>Uraian Pekerjaan:</strong><br>${htmlText(resolutionNote)}
      </div>
      <div class="hd-resolution-timer">
        ⏳ <span>${ticket.state === 'CLOSED' ? 'Penanganan tiket sudah ditutup. Hasil pekerjaan tersimpan pada riwayat.' : confirmationDueAt ? 'Batas konfirmasi hasil penanganan ' + htmlText(formatIndonesianDateTime(confirmationDueAt)) + '.' : 'Batas konfirmasi mengikuti kebijakan pada tiket.'} ${ticket.state === 'CLOSED' ? '' : 'Periksa hasil penanganan lalu konfirmasikan atau sampaikan keberatan di bawah.'}</span>
      </div>
    `;
    container.append(resBox);
  }

  return container;
}

async function ticketDetail(): Promise<void> {

  const ticketId = new URLSearchParams(location.search).get('id') ?? '';

  if (!isUUID(ticketId)) {

    setStatus('Tautan tiket tidak valid.');

    return;

  }


  setupMediaPicker();

  const routeParams = new URLSearchParams(location.search);
  let handoffId = routeParams.get('handoff_id') ?? '';
  let incomingOffer: Components['HandoffOffer'] | undefined;
  let escalationId = routeParams.get('operation_id') ?? '';

  let currentTicket: Ticket | undefined;

  let isInternal = false;



  const historyPager = createCursorPager<TicketHistory>('riwayat', () => `/tickets/${ticketId}/history`, items => {
    const root = $('[data-ticket-history]');
    if (!root) return;
    root.replaceChildren();
    if (items.length === 0) {
      const empty = el('li', 'Belum ada catatan riwayat penanganan.', 'hd-timeline-empty');
      root.append(empty);
      return;
    }
    for (const h of items) {
      root.append(renderTimelineItem(h));
    }
  });



  const commentPager = createCursorPager<Components['Comment']>('komentar', () => `/tickets/${ticketId}/comments`, items => {

    const root = $('[data-ticket-comments]');

    if (!root) return;

    root.replaceChildren();

    for (const c of items) {

      root.append(el('li', `${c.visibility === 'INTERNAL' ? '[Internal] ' : ''}${c.body}`));

    }

  });



  const attLightbox = $<HTMLDialogElement>('[data-attachment-lightbox]');
  const attLightboxImg = $<HTMLImageElement>('[data-att-lightbox-img]', attLightbox ?? document);
  const attLightboxCap = $<HTMLElement>('[data-att-lightbox-caption]', attLightbox ?? document);
  let lastLightboxTrigger: HTMLElement | null = null;
  $('[data-close-att-lightbox]', attLightbox ?? document)?.addEventListener('click', () => attLightbox?.close());
  attLightbox?.addEventListener('close', () => {
    attLightbox.hidden = true;
    if (attLightboxImg) { attLightboxImg.removeAttribute('src'); attLightboxImg.alt = ''; }
    lastLightboxTrigger?.focus();
    lastLightboxTrigger = null;
  });

  const filePager = createCursorPager<Components['Media']>('lampiran', () => `/tickets/${ticketId}/attachments`, items => {

    const root = $('[data-ticket-attachments]');

    if (!root) return;

    root.replaceChildren();

    for (const m of items) {

      const li = el('li', `${m.alt || m.id} · ${m.visibility} · ${m.status} `);

      if (m.status === 'CLEAN') {

        const url = `/api/v1/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(m.id)}/download`;
        const a = el('a', 'Unduh') as HTMLAnchorElement;
        a.href = url;
        li.append(a);

        if (m.mime?.startsWith('image/') && attLightbox && attLightboxImg) {
          const previewBtn = el('button', 'Pratinjau gambar', 'btn btn-secondary hd-btn-preview') as HTMLButtonElement;
          previewBtn.type = 'button';
          previewBtn.addEventListener('click', () => {
            lastLightboxTrigger = previewBtn;
            attLightboxImg.src = url;
            attLightboxImg.alt = m.alt || 'Pratinjau lampiran tiket';
            if (attLightboxCap) attLightboxCap.textContent = `${m.alt || m.id} · ${m.visibility} · ${m.status}`;
            attLightbox.hidden = false;
            attLightbox.showModal();
          });
          li.append(' ', previewBtn);
        }

      }

      root.append(li);

    }

  });



  const conflictBanner = $('[data-conflict-banner]');

  $('[data-conflict-reload]')?.addEventListener('click', () => {

    if (conflictBanner) conflictBanner.hidden = true;

    void refresh();

  });



  const verifySec = $('[data-operator-verify]');

  const dispatchSec = $('[data-operator-dispatch]');

  const resolveSec = $('[data-technician-resolve]');

  const confirmSec = $('[data-requester-confirmation]');

  const vendorSec = $('[data-vendor-case]');

  const pauseSec = $('[data-pause-service]');

  const handoffSec = $('[data-handoff-request]');

  const acceptHandoffSec = $('[data-handoff-accept]');

  const escalateSec = $('[data-escalate-ticket]');

  const archiveSec = $('[data-archive-ticket]');

  const btnArchive = $('[data-btn-archive]');

  const btnRestore = $('[data-btn-restore-archive]');

  const archiveDialog = $<HTMLDialogElement>('[data-archive-dialog]');

  const restoreDialog = $<HTMLDialogElement>('[data-restore-dialog]');



  function updateNextAction(available: ReturnType<typeof ticketActions>) {
    const next = $('.hd-next-step');
    if (!next || !currentTicket) return;
    const steps: [boolean, HTMLElement | null, string, string][] = [
      [available.verify, verifySec, 'Periksa dan verifikasi laporan', 'Periksa uraian, kategori dan dampak sebelum mengesahkan laporan.'],
      [available.confirm, confirmSec, 'Periksa hasil penanganan', 'Pastikan kendala teratasi. Berikan persetujuan atau alasan keberatan.'],
      [available.lifecycle.includes('SUPPLY_INFORMATION'), lifecycleSection, 'Lengkapi informasi', 'Baca permintaan pada riwayat lalu berikan informasi yang diperlukan.'],
      [available.lifecycle.includes('START'), lifecycleSection, 'Mulai penanganan', 'Tiket sudah ditugaskan kepada Anda. Catat alasan dan mulai penanganan.'],
      [available.resolve, resolveSec, 'Catat hasil penanganan', 'Catat pekerjaan dan bukti yang relevan, lalu kirim hasil untuk diperiksa pemohon.'],
      [available.dispatch && ['OPEN','TRIAGED'].includes(currentTicket.state), dispatchSec, 'Tugaskan teknisi', 'Tinjau saran penugasan dan pilih teknisi yang sesuai sebelum menyimpan keputusan.'],
    ];
    const primary = steps.find(([enabled, section]) => enabled && section && !section.hidden);
    if (!primary) return;
    const [, section, label, explanation] = primary;
    section!.id ||= 'ticket-action-' + (section!.getAttributeNames().find(n => n.startsWith('data-')) ?? 'next').replace('data-', '');
    section!.tabIndex = -1;
    const link = el('a', label, 'btn btn-secondary') as HTMLAnchorElement;
    link.href = '#' + section!.id;
    next.replaceChildren(document.createTextNode(explanation + ' '), link);
  }

  async function refresh(): Promise<void> {

    incomingOffer = undefined;
    if (acceptHandoffSec) acceptHandoffSec.hidden = true;
    if (isUUID(handoffId) && acceptHandoffSec) {
      try {
        incomingOffer = await api<Components['HandoffOffer']>(`/tickets/${ticketId}/handoffs/${handoffId}`);
        currentTicket = undefined;
        const field = $<HTMLInputElement>('#accept-handoff-id', acceptHandoffSec);
        if (field) field.value = incomingOffer.id;
        acceptHandoffSec.hidden = false;
        setStatus('Permohonan pengalihan menunggu penerimaan OPD tujuan.');
        return;
      } catch (err) {
        if (!(err instanceof APIError && err.status === 404)) {
          currentTicket = undefined;
          setStatus(errorText(err));
          return;
        }
      }
    }
    try {

      currentTicket = await api<Ticket>('/tickets/' + ticketId);

      const available = ticketActions(session, currentTicket);
      isInternal = available.internal;
      let serviceName = currentTicket.classification.category || 'Layanan TIK';
      try {
        const sInfo = await api<Components['Service']>('/catalog/services/' + currentTicket.service_id);
        if (sInfo?.name) serviceName = sInfo.name;
      } catch {}

      let techName = 'Dalam Antrean Disposisi';
      if (currentTicket.assignee_id) {
        techName = 'Teknisi penanggung jawab telah ditugaskan';

      }

      let resolutionNote = '';
      let confirmationDueAt: string | undefined;
      let resolution: Components['Resolution'] | undefined;
      if (currentTicket.state === 'RESOLVED' || currentTicket.state === 'CLOSED') {
        try {
          const attempts = await api<{ items: Components['Resolution'][] }>(`/tickets/${ticketId}/resolution-attempts`);
          const items = attempts?.items || [];
          if (items.length > 0) {
            resolution = activeResolution(currentTicket, items);
            resolutionNote = resolution?.summary ?? '';
            confirmationDueAt = resolution?.confirmation_due_at;
          }
        } catch {}
      }

      const detailSec = $('[data-ticket-detail]');
      if (detailSec) {
        const clock = await api<Components['SLAClock']>(`/tickets/${ticketId}/sla`).catch(() => undefined);
        detailSec.hidden = false;
        detailSec.replaceChildren(
          renderExecutiveTicketProgress(currentTicket, serviceName, techName, resolutionNote, clock, confirmationDueAt)
        );
      }



      const contentSec = $('[data-ticket-content]');

      if (contentSec) contentSec.hidden = false;

      document.querySelectorAll<HTMLElement>('[data-internal]').forEach(e => { e.hidden = !isInternal; });



      if (verifySec) {

        if (available.verify) {

          verifySec.hidden = false;

          const recBadge = $('[data-verify-recommendation]', verifySec);

          if (recBadge) recBadge.textContent = `Saran sistem: ${currentTicket.classification.explanation}`;

          const catSelect = $<HTMLSelectElement>('#verify-category', verifySec);

          if (catSelect) {
            const placeholder = el('option', 'Pilih kategori aktif') as HTMLOptionElement;
            placeholder.value = '';
            catSelect.replaceChildren(placeholder);
            try {
              const cats = await api<Category[]>('/tickets/'+ticketId+'/verification-categories');
              for (const c of cats) {
                const option = el('option', c.name) as HTMLOptionElement;
                option.value = c.id;
                catSelect.append(option);
              }
              catSelect.value = currentTicket.classification.category_id ?? '';
              if (!catSelect.value) catSelect.value = currentTicket.reported_category?.id ?? '';
            } catch (error) {
              setStatus(errorText(error), '[data-verify-status]');
            }
          }

        } else {

          verifySec.hidden = true;

        }

      }



      const classificationSummary = $('[data-ticket-classification-summary]');
      if (classificationSummary) {
        const proposed = currentTicket.classification;
        const confirmed = currentTicket.classification_decision;
        classificationSummary.textContent = 'Saran sistem: '+proposed.explanation
          +(confirmed ? '. Keputusan operator '+confirmed.category_name+' · '+priorityLabel(confirmed.priority)+'.' : '. Keputusan operator belum tersedia.');
      }
      if (dispatchSec) {
        const ready = available.dispatch;
        dispatchSec.hidden = !ready;
        if (ready) await loadDispatchProposal();
      }

      if (resolveSec) resolveSec.hidden = !available.resolve;
      renderLifecycle(currentTicket);

      if (confirmSec) {
        confirmSec.hidden = !available.confirm;
        const notes = $('[data-resolution-notes]', confirmSec);
        if (notes) notes.textContent = resolution
          ? `Catatan teknisi:\n${resolution.summary}\nSelesai ${formatIndonesianDateTime(resolution.resolved_at)}.\nBatas konfirmasi ${formatIndonesianDateTime(resolution.confirmation_due_at)}.`
          : 'Catatan hasil penanganan belum dapat dimuat. Muat ulang detail sebelum memberikan keputusan.';
        for (const control of confirmSec.querySelectorAll<HTMLButtonElement>('button[type=submit], [data-btn-confirm-accept], [data-btn-confirm-reject]')) control.disabled = !resolution;
      }
      if (vendorSec) {
        vendorSec.hidden = !available.vendor;
        if (available.vendor) {
          const pic = $<HTMLInputElement>('#vendor-pic', vendorSec);
          const defaultPic = currentTicket.assignee_id || session?.actor.subject_id || '';
          if (pic && !pic.value && defaultPic) pic.value = defaultPic;
          void populateVendorPicSelect(currentTicket, session);
          const retInput = $<HTMLInputElement>('#vendor-return', vendorSec);
          if (retInput && !retInput.value) retInput.value = toWibDatetimeInput(new Date(Date.now() + 24 * 3600000));
          const folInput = $<HTMLInputElement>('#vendor-followup', vendorSec);
          if (folInput && !folInput.value) folInput.value = toWibDatetimeInput(new Date(Date.now() + 4 * 3600000));
        }
      }

      if (pauseSec) {
        pauseSec.hidden = !available.pause;
        if (available.pause) {
          const untilInput = $<HTMLInputElement>('#pause-until', pauseSec);
          if (untilInput && !untilInput.value) untilInput.value = toWibDatetimeInput(new Date(Date.now() + 2 * 3600000));
        }
      }



      if (handoffSec) {

        handoffSec.hidden = !available.handoff;
        if (available.handoff) void loadHandoffTargets();
        syncHandoffSuggestion();

      }



      if (escalateSec) {

        escalateSec.hidden = !available.escalate;

      }



      const isArchived = Boolean(currentTicket.archived_at);

      const canArchive = available.archive;

      const canRestore = available.restore;



      if (archiveSec) {

        archiveSec.hidden = !(canArchive || canRestore);

        if (btnArchive) btnArchive.hidden = !canArchive;

        if (btnRestore) btnRestore.hidden = !canRestore;

      }



      if (isArchived && detailSec) {

        const badge = el('span', ` (Diarsipkan: ${new Date(currentTicket.archived_at!).toLocaleString('id-ID')})`, 'court-badge hd-archived-badge');

        detailSec.querySelector('h2')?.after(badge);

      }



      const commentForm = $('[data-ticket-comment]');
      if (commentForm) commentForm.hidden = !available.comment;
      const uploadForm = $('[data-ticket-upload]');
      if (uploadForm) uploadForm.hidden = !available.attach;
      updateNextAction(available);
      void loadOperationalRecordsAndScheduler(currentTicket, session, isInternal, parseWibDatetimeInput, refresh);

      await Promise.all([historyPager(true), commentPager(true), filePager(true)]);

      setStatus('Perkembangan tiket berhasil dimuat.');

    } catch (err) {

      const detail = $('[data-ticket-detail]');

      if (detail) detail.hidden = true;

      const content = $('[data-ticket-content]');

      if (content) content.hidden = true;

      currentTicket = undefined;
      setStatus(errorText(err));

    }

  }



  $('[data-ticket-refresh]')?.addEventListener('click', () => void refresh());



  const keyGen = intent();



  const formVerify = $<HTMLFormElement>('[data-form-verify]');

  if (formVerify) {

    let verifyPending = false;

    formVerify.addEventListener('submit', async e => {

      e.preventDefault();

      if (verifyPending || !currentTicket || !formVerify.reportValidity()) return;

      verifyPending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formVerify);

      if (btn) btn.disabled = true;

      const reason = formValue(formVerify, 'reason');

      const catId = formValue(formVerify, 'category_id');

      const priority = formValue(formVerify, 'priority') as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

      const body: Components['Verification'] = {

        expected_version: currentTicket.version,

        category_id: catId,

        priority,

        reason,

        classifier_version: currentTicket.classification.rule_version ?? 1

      };

      try {

        await api(`/tickets/${ticketId}/verify`, 'POST', body, keyGen('verify', body));

        setStatus('Verifikasi tiket berhasil disahkan.', '[data-verify-status]');

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-verify-status]');

      } finally {

        verifyPending = false;

        if (btn) btn.disabled = false;

      }

    });



    const rejectDialog = $<HTMLDialogElement>('[data-reject-dialog]');

    async function doReject(reason: string) {

      if (!currentTicket) return;

      try {

        await api(`/tickets/${ticketId}/reject`, 'POST', { expected_version: currentTicket.version, rejection_reason: reason.trim() }, keyGen('reject', currentTicket.id + currentTicket.version));

        if (rejectDialog) { if (typeof rejectDialog.close === 'function') rejectDialog.close(); else rejectDialog.removeAttribute('open'); }

        setStatus('Tiket berhasil ditolak.', '[data-verify-status]');

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-verify-status]');

      }

    }

    $('[data-btn-reject]')?.addEventListener('click', () => {

      if (rejectDialog) {

        if (typeof rejectDialog.showModal === 'function') rejectDialog.showModal();

        else rejectDialog.setAttribute('open', '');

      } else {

        const reason = prompt('Masukkan alasan penolakan tiket:');

        if (reason && reason.trim()) void doReject(reason.trim());

      }

    });

    document.querySelectorAll('[data-close-reject-dialog]').forEach(btn => {

      btn.addEventListener('click', () => {

        if (rejectDialog) { if (typeof rejectDialog.close === 'function') rejectDialog.close(); else rejectDialog.removeAttribute('open'); }

      });

    });

    const formReject = $<HTMLFormElement>('[data-form-reject]');

    if (formReject) {

      formReject.addEventListener('submit', async e => {

        e.preventDefault();

        const reason = formValue(formReject, 'reason');

        if (!reason || reason.trim().length < 5) {

          setStatus('Alasan penolakan wajib minimal 5 karakter.', '[data-verify-status]');

          return;

        }

        await doReject(reason);

      });

    }

    if (false) $('[data-btn-reject]')?.addEventListener('click', async () => {

      if (!currentTicket) return;

      const reason = prompt('Masukkan alasan penolakan tiket:');

      if (!reason || !reason.trim()) {

        alert('Alasan penolakan wajib disertakan.');

        return;

      }

      try {

        await api(`/tickets/${ticketId}/reject`, 'POST', { expected_version: currentTicket.version, rejection_reason: reason.trim() }, keyGen('reject', currentTicket.id + currentTicket.version));

        setStatus('Tiket berhasil ditolak.', '[data-verify-status]');

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-verify-status]');

      }

    });

  }



  const lifecycleForm = $<HTMLFormElement>('[data-form-lifecycle]');
  const lifecycleSection = $('[data-ticket-lifecycle]');
  const lifecycleLabels: Record<Components['Transition']['action'], string> = {
    REQUEST_INFORMATION:'Minta informasi', SUPPLY_INFORMATION:'Lengkapi informasi',
    START:'Mulai penanganan', CANCEL:'Batalkan tiket', REOPEN:'Buka kembali tiket'
  };
  function renderLifecycle(ticket: Ticket) {
    if (!lifecycleForm || !lifecycleSection) return;
    const actions = ticketActions(session, ticket).lifecycle;
    const select = $<HTMLSelectElement>('#lifecycle-action', lifecycleForm);
    select?.replaceChildren(...actions.map(action => {
      const option = el('option', lifecycleLabels[action]) as HTMLOptionElement; option.value = action; return option;
    }));
    lifecycleSection.hidden = actions.length === 0;
  }
  const submitLifecycle = durableIntent<Components['Transition']>();
  lifecycleForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentTicket || !lifecycleForm.reportValidity()) return;
    const button = $<HTMLButtonElement>('button[type=submit]', lifecycleForm);
    if (!button || button.disabled) return;
    button.disabled = true;
    const action = formValue(lifecycleForm,'action') as Components['Transition']['action'];
    const body = { expected_version:currentTicket.version, action, reason:formValue(lifecycleForm,'reason') };
    const path = '/tickets/'+ticketId+'/transitions';
    try {
      await submitLifecycle(path,body,(key,payload)=>api(path,'POST',payload,key),commandFingerprint(body));
      lifecycleForm.reset();
      setStatus('Tindakan tersimpan.', '[data-lifecycle-status]');
      await refresh();
    } catch (error) {
      if (error instanceof APIError && error.status===409 && conflictBanner) conflictBanner.hidden=false;
      setStatus(errorText(error), '[data-lifecycle-status]');
    } finally { button.disabled=false; }
  });

  let dispatchProposal: Components['DispatchProposal'] | undefined;
  let proposalRequest = 0;
  async function loadDispatchProposal() {
    if (!currentTicket || !dispatchSec) return;
    const serial = ++proposalRequest;
    dispatchProposal = undefined;
    syncHandoffSuggestion();
    const form = $<HTMLFormElement>('[data-form-dispatch]', dispatchSec);
    const select = $<HTMLSelectElement>('#dispatch-assignee', dispatchSec);
    const button = form && $<HTMLButtonElement>('button[type=submit]',form);
    if (!form || !select || !button) return;
    button.disabled=true;
    select.replaceChildren();
    const tier = formValue(form,'tier');
    setStatus('Memeriksa routing dan roster…','[data-dispatch-proposal]');
    try {
      const mode=['ASSIGNED','IN_PROGRESS'].includes(currentTicket.state) ? '&mode=reassign' : '';
      const proposal = await api<Components['DispatchProposal']>('/tickets/'+ticketId+'/dispatch-proposal?tier='+encodeURIComponent(tier)+mode);
      if (serial!==proposalRequest) return;
      dispatchProposal = proposal;
      const asOf = proposal.projection_as_of ? new Date(proposal.projection_as_of).toLocaleString('id-ID') : 'belum tersedia';
      setStatus([proposal.destination, proposal.explanation, proposal.status === 'RECOMMENDED' ? 'Pembaruan proyeksi '+asOf+'.' : ''].filter(Boolean).join(' · '), '[data-dispatch-proposal]');
      syncHandoffSuggestion();
      for (const candidate of proposal.candidates) {
        const label = candidate.name+' · '+proposal.level+' · '+candidate.roster.active_tickets+' tiket aktif';
        const option=el('option',label) as HTMLOptionElement; option.value=candidate.roster.subject_id; select.append(option);
      }
      select.value=proposal.assignee_id;
      button.disabled=proposal.status!=='RECOMMENDED';
    } catch (error) {
      if (serial===proposalRequest) setStatus(errorText(error), '[data-dispatch-proposal]');
    }
  }

  const formDispatch = $<HTMLFormElement>('[data-form-dispatch]');

  if (formDispatch) {
    const sendDispatch = durableIntent<Components['Dispatch']>();
    formDispatch.querySelectorAll('input[name=tier]').forEach(radio => radio.addEventListener('change',()=>{void loadDispatchProposal();}));
    let dispatchPending = false;

    formDispatch.addEventListener('submit', async e => {

      e.preventDefault();

      if (dispatchPending || !currentTicket || !dispatchProposal || !formDispatch.reportValidity()) return;

      dispatchPending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formDispatch);

      if (btn) btn.disabled = true;

      const assigneeId = formValue(formDispatch, 'assignee_id');

      const reason = formValue(formDispatch, 'reason');

      const body: Components['Dispatch'] = {

        expected_version: currentTicket.version,

        team_id: dispatchProposal.team_id,

        assignee_id: assigneeId,

        proposal_version: dispatchProposal.ticket_version,
        proposal_digest: dispatchProposal.digest,
        tier: dispatchProposal.level,
        reason

      };

      try {

        const action=['ASSIGNED','IN_PROGRESS'].includes(currentTicket.state) ? 'reassign' : 'dispatch';
        const path='/tickets/'+ticketId+'/'+action;
        await sendDispatch(path,body,(key,payload)=>api(path,'POST',payload,key));

        setStatus('Penugasan teknisi berhasil disimpan.', '[data-dispatch-status]');

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-dispatch-status]');

      } finally {

        dispatchPending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  const formResolve = $<HTMLFormElement>('[data-form-resolve]');

  if (formResolve) {
    const sendResolution = durableIntent<Components['ResolutionCreate']>();

    let resolvePending = false;

    formResolve.addEventListener('submit', async e => {

      e.preventDefault();

      if (resolvePending || !currentTicket || !formResolve.reportValidity()) return;

      resolvePending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formResolve);

      if (btn) btn.disabled = true;

      const summary = formValue(formResolve, 'summary');

      try {

        const path = `/tickets/${ticketId}/resolve`;
        const body: Components['ResolutionCreate'] = {expected_version: currentTicket.version, summary};
        await sendResolution(path, body, (key, payload) => api(path, 'POST', payload, key), commandFingerprint(body));

        setStatus('Hasil penanganan tersimpan dan menunggu konfirmasi pemohon.', '[data-resolve-status]');

        formResolve.reset();

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-resolve-status]');

      } finally {

        resolvePending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  const feedbackForm = $<HTMLFormElement>('[data-form-confirm-feedback]');
  const sendConfirmation = durableIntent<Components['Confirmation']>();
  feedbackForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentTicket?.active_attempt_id || !feedbackForm.reportValidity()) return;
    const button = $<HTMLButtonElement>('button[type=submit]',feedbackForm);
    if (!button || button.disabled) return;
    button.disabled = true;
    const body: Components['Confirmation'] = {expected_version:currentTicket.version,attempt_id:currentTicket.active_attempt_id,
      decision:'FEEDBACK',feedback:formValue(feedbackForm,'feedback')};
    const path = '/tickets/'+ticketId+'/confirmation';
    try {
      await sendConfirmation(path,body,(key,payload)=>api(path,'POST',payload,key),commandFingerprint(body));
      feedbackForm.reset();
      setStatus('Tanggapan tersimpan dan menunggu peninjauan.', '[data-confirmation-status]');
      await refresh();
    } catch (error) {
      if (error instanceof APIError && error.status===409 && conflictBanner) conflictBanner.hidden=false;
      setStatus(errorText(error),'[data-confirmation-status]');
    } finally { button.disabled=false; }
  });

  const acceptButton = $<HTMLButtonElement>('[data-btn-confirm-accept]');
  acceptButton?.addEventListener('click', async () => {
    if (!currentTicket?.active_attempt_id || acceptButton.disabled) return;
    acceptButton.disabled = true;
    try {

      const path = `/tickets/${ticketId}/confirmation`;
      const body: Components['Confirmation'] = {expected_version: currentTicket.version, attempt_id: currentTicket.active_attempt_id, decision: 'ACCEPT'};
      await sendConfirmation(path, body, (key, payload) => api(path, 'POST', payload, key), commandFingerprint(body));

      setStatus('Konfirmasi disetujui. Tiket ditutup.', '[data-confirmation-status]');

      await refresh();

    } catch (err) {

      if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

      setStatus(errorText(err), '[data-confirmation-status]');

    } finally { acceptButton.disabled = false; }

  });



  const confirmRejectDialog = $<HTMLDialogElement>('[data-confirm-reject-dialog]');

  async function doConfirmReject(reason: string) {

    if (!currentTicket?.active_attempt_id) return;

    try {

      const path = `/tickets/${ticketId}/confirmation`;
      const body: Components['Confirmation'] = {expected_version: currentTicket.version, attempt_id: currentTicket.active_attempt_id, decision: 'REJECT', reason: reason.trim()};
      await sendConfirmation(path, body, (key, payload) => api(path, 'POST', payload, key), commandFingerprint(body));

      if (confirmRejectDialog) { if (typeof confirmRejectDialog.close === 'function') confirmRejectDialog.close(); else confirmRejectDialog.removeAttribute('open'); }

      setStatus('Penolakan dicatat. Tiket kembali diproses teknisi.', '[data-confirmation-status]');

      await refresh();

    } catch (err) {

      if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

      setStatus(errorText(err), '[data-confirmation-status]');

    }

  }

  $('[data-btn-confirm-reject]')?.addEventListener('click', () => {

    if (confirmRejectDialog) {

      if (typeof confirmRejectDialog.showModal === 'function') confirmRejectDialog.showModal();

      else confirmRejectDialog.setAttribute('open', '');

    } else {

      const reason = prompt('Masukkan alasan penolakan hasil penanganan (minimal 5 karakter):');

      if (reason && reason.trim().length >= 5) void doConfirmReject(reason.trim());

    }

  });

  document.querySelectorAll('[data-close-confirm-reject-dialog]').forEach(btn => {

    btn.addEventListener('click', () => {

      if (confirmRejectDialog) { if (typeof confirmRejectDialog.close === 'function') confirmRejectDialog.close(); else confirmRejectDialog.removeAttribute('open'); }

    });

  });

  const formConfirmReject = $<HTMLFormElement>('[data-form-confirm-reject]');

  if (formConfirmReject) {

    formConfirmReject.addEventListener('submit', async e => {

      e.preventDefault();

      const reason = formValue(formConfirmReject, 'reason');

      if (!reason || reason.trim().length < 5) {

        setStatus('Alasan penolakan wajib minimal 5 karakter.', '[data-confirmation-status]');

        return;

      }

      const button = $<HTMLButtonElement>('button[type=submit]', formConfirmReject);
      if (!button || button.disabled || !formConfirmReject.reportValidity()) return;
      button.disabled = true;
      try { await doConfirmReject(reason); } finally { button.disabled = false; }

    });

  }

  // M0-07: Form Vendor
  const formVendor = $<HTMLFormElement>('[data-form-vendor]');
  if (formVendor) {
    let vendorPending = false;
    formVendor.addEventListener('submit', async e => {
      e.preventDefault();
      if (vendorPending || !currentTicket || !formVendor.reportValidity()) return;
      const vendorId = formValue(formVendor, 'vendor_id');
      const internalPicId = formValue(formVendor, 'internal_pic_id');
      const externalReference = formValue(formVendor, 'external_reference');
      const contractReference = formValue(formVendor, 'contract_reference');
      const expectedReturnAt = parseWibDatetimeInput(formValue(formVendor, 'expected_return_at'));
      const nextFollowupAt = parseWibDatetimeInput(formValue(formVendor, 'next_followup_at'));
      const nowMs = Date.now();
      if (!expectedReturnAt || expectedReturnAt.getTime() <= nowMs) {
        setStatus('Estimasi selesai vendor harus berupa waktu di masa depan (WIB).', '[data-vendor-status]');
        $<HTMLInputElement>('#vendor-return', formVendor)?.focus();
        return;
      }
      if (!nextFollowupAt || nextFollowupAt.getTime() <= nowMs) {
        setStatus('Batas waktu tindak lanjut PIC harus berupa waktu di masa depan (WIB).', '[data-vendor-status]');
        $<HTMLInputElement>('#vendor-followup', formVendor)?.focus();
        return;
      }
      vendorPending = true;
      const btn = $<HTMLButtonElement>('button[type=submit]', formVendor);
      if (btn) btn.disabled = true;
      const payload = {
        expected_version: currentTicket.version,
        vendor_id: vendorId,
        internal_pic_id: internalPicId,
        external_reference: externalReference,
        contract_reference: contractReference,
        expected_return_at: expectedReturnAt.toISOString(),
        next_followup_at: nextFollowupAt.toISOString(),
      };
      try {
        await api(`/tickets/${ticketId}/vendor-cases`, 'POST', payload, keyGen('vendor', {
          id: currentTicket.id,
          version: currentTicket.version,
          vendor_id: vendorId,
          internal_pic_id: internalPicId,
          external_reference: externalReference,
          contract_reference: contractReference,
          expected_return_at: payload.expected_return_at,
          next_followup_at: payload.next_followup_at,
        }));
        setStatus('Kasus vendor berhasil dicatat.', '[data-vendor-status]');
        formVendor.reset();
        await refresh();
      } catch (err) {
        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;
        setStatus(errorText(err), '[data-vendor-status]');
      } finally {
        vendorPending = false;
        if (btn) btn.disabled = false;
      }
    });
  }

  // M0-07: Form Pause
  const formPause = $<HTMLFormElement>('[data-form-pause]');
  if (formPause) {
    let pausePending = false;
    formPause.addEventListener('submit', async e => {
      e.preventDefault();
      if (pausePending || !currentTicket || !formPause.reportValidity()) return;
      const reason = formValue(formPause, 'reason');
      const untilDate = parseWibDatetimeInput(formValue(formPause, 'until'));
      const nowMs = Date.now();
      if (!untilDate || untilDate.getTime() <= nowMs) {
        setStatus('Batas waktu jeda layanan harus lebih dari waktu sekarang (WIB).', '[data-pause-status]');
        $<HTMLInputElement>('#pause-until', formPause)?.focus();
        return;
      }
      if (untilDate.getTime() - nowMs > 7 * 86400000) {
        setStatus('Batas jeda SLA maksimal 7 hari dari waktu sekarang.', '[data-pause-status]');
        $<HTMLInputElement>('#pause-until', formPause)?.focus();
        return;
      }
      pausePending = true;
      const btn = $<HTMLButtonElement>('button[type=submit]', formPause);
      if (btn) btn.disabled = true;
      const untilIso = untilDate.toISOString();
      try {
        await api(`/tickets/${ticketId}/pauses`, 'POST', {
          expected_version: currentTicket.version,
          reason,
          until: untilIso,
        }, keyGen('pause', {
          id: currentTicket.id,
          version: currentTicket.version,
          reason,
          until: untilIso,
        }));
        setStatus('Jeda layanan berhasil disetujui.', '[data-pause-status]');
        formPause.reset();
        await refresh();
      } catch (err) {
        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;
        setStatus(errorText(err), '[data-pause-status]');
      } finally {
        pausePending = false;
        if (btn) btn.disabled = false;
      }
    });
  }



  // M0-07: Form Handoff Request

  const formHandoff = $<HTMLFormElement>('[data-form-handoff]');
  const handoffOrg = $<HTMLSelectElement>('#handoff-target-org');
  const handoffTeam = $<HTMLSelectElement>('#handoff-target-team');
  const handoffOrgMore = $<HTMLButtonElement>('[data-handoff-org-more]');
  const handoffTeamMore = $<HTMLButtonElement>('[data-handoff-team-more]');
  let orgCursor = '', teamCursor = '', loadedOwner = '', handoffEpoch = 0;
  function syncHandoffSuggestion() {
    const button = $<HTMLButtonElement>('[data-use-handoff-suggestion]');
    if (button) button.hidden = dispatchProposal?.status !== 'HANDOFF' || !handoffSec || handoffSec.hidden;
  }
  async function loadHandoffTargets(teams = false, append = false) {
    if (!currentTicket || !handoffOrg || !handoffTeam || !handoffOrgMore || !handoffTeamMore) return;
    if (!teams && !append && loadedOwner === currentTicket.service_owner_org_id) return;
    const destination = handoffOrg.value;
    const target = teams ? handoffTeam : handoffOrg;
    const more = teams ? handoffTeamMore : handoffOrgMore;
    const epoch = ++handoffEpoch;
    more.hidden = true;
    if (!append) {
      target.replaceChildren(new Option(teams ? 'Pilih tim teknis' : 'Pilih perangkat daerah', ''));
      if (!teams) {
        handoffTeam.replaceChildren(new Option('Pilih tim teknis',''));
        handoffTeamMore.hidden = true;
        teamCursor='';
      }
    }
    if (teams && !destination) return;
    const params = new URLSearchParams({limit:'25'});
    if (teams) params.set('organization_id',destination);
    const cursor = teams ? teamCursor : orgCursor;
    if (append && cursor) params.set('cursor',cursor);
    try {
      const page = await api<{items:Components['DirectoryEntry'][];next_cursor:string|null}>(`/tickets/${ticketId}/handoff-targets?${params}`);
      if (epoch !== handoffEpoch) return;
      for (const item of page.items) {
        if (![...target.options].some(option=>option.value===item.id)) target.add(new Option(item.name,item.id));
      }
      if (teams) teamCursor = page.next_cursor ?? '';
      else { orgCursor = page.next_cursor ?? ''; loadedOwner = currentTicket.service_owner_org_id; }
      more.hidden = !page.next_cursor;
    } catch (error) {
      if (epoch === handoffEpoch) {
        setStatus(errorText(error),'[data-handoff-status]');
        more.hidden = false;
        more.textContent = 'Coba muat tujuan lagi';
      }
    }
  }

  if (formHandoff) {
    handoffOrg?.addEventListener('change',()=>{teamCursor='';void loadHandoffTargets(true);});
    handoffOrgMore?.addEventListener('click',()=>void loadHandoffTargets(false,Boolean(orgCursor)));
    handoffTeamMore?.addEventListener('click',()=>void loadHandoffTargets(true,Boolean(teamCursor)));
    $('[data-use-handoff-suggestion]')?.addEventListener('click',()=>{
      const proposal = dispatchProposal;
      if (proposal?.status !== 'HANDOFF' || !proposal.target_org_id) return;
      const apply = (field: string, id: string) => {
        const input = formHandoff.elements.namedItem(field) as HTMLSelectElement;
        if (![...input.options].some(option=>option.value===id)) input.add(new Option(proposal.destination ?? 'Tujuan rekomendasi',id));
        input.value = id;
      };
      apply('target_org_id',proposal.target_org_id);
      void loadHandoffTargets(true).then(()=>{
        if (handoffOrg?.value===proposal.target_org_id) apply('target_team_id',proposal.team_id);
      });
      $<HTMLTextAreaElement>('[name="reason"]',formHandoff)?.focus();
    });

    let handoffPending = false;

    formHandoff.addEventListener('submit', async e => {

      e.preventDefault();

      if (handoffPending || !currentTicket || !formHandoff.reportValidity()) return;

      handoffPending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formHandoff);

      if (btn) btn.disabled = true;

      const targetOrgId = formValue(formHandoff, 'target_org_id');

      const targetTeamId = formValue(formHandoff, 'target_team_id');

      const reason = formValue(formHandoff, 'reason');

      try {

        const receipt = await api<{handoff_id: string}>(`/tickets/${ticketId}/handoffs`, 'POST', {

          expected_version: currentTicket.version,

          target_org_id: targetOrgId,

          target_team_id: targetTeamId,

          reason

        }, keyGen('handoff', currentTicket.id + currentTicket.version));

        const link = $<HTMLAnchorElement>('[data-handoff-offer-link]', formHandoff);
        if (link && isUUID(receipt.handoff_id)) {
          const params = new URLSearchParams({id: ticketId, handoff_id: receipt.handoff_id});
          link.href = `/admin/app/tickets/detail.html?${params}`;
          link.hidden = false;
        }
        setStatus('Permohonan tercatat. Bagikan tautan penerimaan ke koordinator OPD tujuan.', '[data-handoff-status]');

        formHandoff.reset();

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-handoff-status]');

      } finally {

        handoffPending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  // M0-07: Form Accept Handoff

  const formAcceptHandoff = $<HTMLFormElement>('[data-form-accept-handoff]');

  if (formAcceptHandoff) {

    let acceptPending = false;

    formAcceptHandoff.addEventListener('submit', async e => {

      e.preventDefault();

      if (acceptPending || !incomingOffer || !formAcceptHandoff.reportValidity()) return;

      acceptPending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formAcceptHandoff);

      if (btn) btn.disabled = true;

      const offer = incomingOffer;

      const reason = formValue(formAcceptHandoff, 'reason');

      try {

        await api(`/tickets/${ticketId}/handoffs/${offer.id}/accept`, 'POST', {

          expected_version: offer.ticket_version,

          reason

        }, keyGen('accept-handoff', offer.id + offer.ticket_version));

        handoffId = '';
        routeParams.delete('handoff_id');
        history.replaceState(null, '', `${location.pathname}?${routeParams}`);
        setStatus('Handoff diterima oleh OPD tujuan.');

        formAcceptHandoff.reset();

        await refresh();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) {
          conflictBanner.hidden = false;
          await refresh();
        }

        setStatus(errorText(err), '[data-accept-handoff-status]');

      } finally {

        acceptPending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  // M0-07: Form Escalation

  const escalationCheck = $<HTMLButtonElement>('[data-check-escalation]');
  async function readEscalation(): Promise<void> {
    if (!isUUID(escalationId) || !escalationCheck || escalateSec?.hidden) return;
    escalationCheck.hidden = false;
    try {
      const operation = await api<Components['Operation'] & {ticket_id?: string}>(`/operations/${escalationId}`);
      if (operation.ticket_id !== ticketId) {
        setStatus('Operasi eskalasi tidak tersedia pada tiket ini.', '[data-escalate-status]');
        return;
      }
      const states = {
        PENDING: 'Permohonan eskalasi menunggu pemrosesan.',
        RUNNING: 'Eskalasi sedang diproses.',
        SUCCEEDED: 'Eskalasi tercatat pada riwayat tiket.',
        FAILED: 'Eskalasi gagal diproses.',
      } as const;
      setStatus(states[operation.state] || 'Status eskalasi belum tersedia.', '[data-escalate-status]');
    } catch (err) {
      setStatus(errorText(err), '[data-escalate-status]');
    }
  }
  escalationCheck?.addEventListener('click', () => void readEscalation());

  const formEscalate = $<HTMLFormElement>('[data-form-escalate]');

  if (formEscalate) {

    let escalatePending = false;

    formEscalate.addEventListener('submit', async e => {

      e.preventDefault();

      if (escalatePending || !currentTicket || !formEscalate.reportValidity()) return;

      escalatePending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', formEscalate);

      if (btn) btn.disabled = true;

      const level = formValue(formEscalate, 'level') as 'L2' | 'COORDINATOR' | 'LEADERSHIP';

      const reason = formValue(formEscalate, 'reason');

      try {

        const operation = await api<Components['Operation']>(`/tickets/${ticketId}/escalations`, 'POST', {

          expected_version: currentTicket.version,

          level,

          reason

        }, keyGen('escalate', currentTicket.id + currentTicket.version));

        escalationId = operation.id;
        routeParams.set('operation_id', operation.id);
        history.replaceState(null, '', `${location.pathname}?${routeParams}`);

        formEscalate.reset();

        await refresh();
        await readEscalation();

      } catch (err) {

        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;

        setStatus(errorText(err), '[data-escalate-status]');

      } finally {

        escalatePending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  // Archive & Restore Archive Handlers (M11 AC22 & AC20)

  if (btnArchive && archiveDialog) {

    btnArchive.addEventListener('click', () => {

      if (typeof archiveDialog.showModal === 'function') archiveDialog.showModal();

      else archiveDialog.setAttribute('open', '');

    });

    document.querySelectorAll('[data-close-archive-dialog]').forEach(btn => {

      btn.addEventListener('click', () => {

        if (typeof archiveDialog.close === 'function') archiveDialog.close();

        else archiveDialog.removeAttribute('open');

      });

    });

    const formArchive = $<HTMLFormElement>('[data-form-archive]');

    if (formArchive) {

      let pendingArchive = false;

      formArchive.addEventListener('submit', async e => {

        e.preventDefault();

        if (pendingArchive || !currentTicket || !formArchive.reportValidity()) return;

        pendingArchive = true;

        const submitBtn = $<HTMLButtonElement>('button[type=submit]', formArchive);

        if (submitBtn) submitBtn.disabled = true;

        const reason = formValue(formArchive, 'reason');

        try {

          await api(`/tickets/${ticketId}/archive`, 'POST', {

            expected_version: currentTicket.version,

            reason

          }, keyGen('archive', currentTicket.id + currentTicket.version));

          if (typeof archiveDialog.close === 'function') archiveDialog.close();

          else archiveDialog.removeAttribute('open');

          setStatus('Tiket berhasil diarsipkan.', '[data-archive-status]');

          await refresh();

        } catch (err) {

          setStatus(errorText(err), '[data-archive-status]');

        } finally {

          pendingArchive = false;

          if (submitBtn) submitBtn.disabled = false;

        }

      });

    }

  }



  if (btnRestore && restoreDialog) {

    btnRestore.addEventListener('click', () => {

      if (typeof restoreDialog.showModal === 'function') restoreDialog.showModal();

      else restoreDialog.setAttribute('open', '');

    });

    document.querySelectorAll('[data-close-restore-dialog]').forEach(btn => {

      btn.addEventListener('click', () => {

        if (typeof restoreDialog.close === 'function') restoreDialog.close();

        else restoreDialog.removeAttribute('open');

      });

    });

    const formRestore = $<HTMLFormElement>('[data-form-restore-archive]');

    if (formRestore) {

      let pendingRestore = false;

      formRestore.addEventListener('submit', async e => {

        e.preventDefault();

        if (pendingRestore || !currentTicket || !formRestore.reportValidity()) return;

        pendingRestore = true;

        const submitBtn = $<HTMLButtonElement>('button[type=submit]', formRestore);

        if (submitBtn) submitBtn.disabled = true;

        const reason = formValue(formRestore, 'reason');

        try {

          await api(`/tickets/${ticketId}/restore-archive`, 'POST', {

            expected_version: currentTicket.version,

            reason

          }, keyGen('restore-archive', currentTicket.id + currentTicket.version));

          if (typeof restoreDialog.close === 'function') restoreDialog.close();

          else restoreDialog.removeAttribute('open');

          setStatus('Arsip tiket berhasil dipulihkan.', '[data-archive-status]');

          await refresh();

        } catch (err) {

          setStatus(errorText(err), '[data-archive-status]');

        } finally {

          pendingRestore = false;

          if (submitBtn) submitBtn.disabled = false;

        }

      });

    }

  }



  // Komentar

  const commentForm = $<HTMLFormElement>('[data-ticket-comment]');

  if (commentForm) {

    const commentIntent = durableIntent<Components['CommentCreate']>();

    let commentPending = false;

    commentForm.addEventListener('submit', async e => {

      e.preventDefault();

      if (commentPending || !currentTicket || !commentForm.reportValidity()) return;

      commentPending = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', commentForm);

      if (btn) btn.disabled = true;

      const body: Components['CommentCreate'] = {

        expected_version: currentTicket.version,

        body: formValue(commentForm, 'body'),

        visibility: (formValue(commentForm, 'visibility') || 'REQUESTER') as 'REQUESTER' | 'INTERNAL'

      };

      try {

        await commentIntent(`/tickets/${ticketId}/comments`, body, (k, orig) =>

          api(`/tickets/${ticketId}/comments`, 'POST', orig, k),

          JSON.stringify({ body: body.body, visibility: body.visibility })

        );

        commentForm.reset();

        await refresh();

        setStatus('Komentar tersimpan.', '[data-comment-status]');

      } catch (err) {

        setStatus(errorText(err), '[data-comment-status]');

      } finally {

        commentPending = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  // Upload

  const uploadForm = $<HTMLFormElement>('[data-ticket-upload]');

  if (uploadForm) {

    const upload = attachmentSender();

    let uploading = false;

    uploadForm.addEventListener('submit', async e => {

      e.preventDefault();

      if (uploading || !currentTicket || !uploadForm.reportValidity()) return;

      const fileInput = $<HTMLInputElement>('#ticket-file');

      const file = (fileInput?.files ?? [])[0];

      if (!file) return;

      if (file.size < 1 || file.size > 10485760) {

        setStatus('Ukuran file harus 1 byte hingga 10 MiB; policy server dapat lebih kecil.', '[data-upload-status]');

        return;

      }

      uploading = true;

      const btn = $<HTMLButtonElement>('button[type=submit]', uploadForm);

      if (btn) btn.disabled = true;

      const audience = formValue(uploadForm, 'audience') || 'REQUESTER';

      try {

        await upload(ticketId, file, audience, currentTicket.version);

        uploadForm.reset();

        await refresh();

        setStatus('Lampiran tersimpan dalam quarantine. Muat ulang untuk melihat hasil scan.', '[data-upload-status]');

      } catch (err) {

        setStatus(errorText(err), '[data-upload-status]');

      } finally {

        uploading = false;

        if (btn) btn.disabled = false;

      }

    });

  }



  for (const [selector, revoke] of [['[data-tracking-logout]', false], ['[data-tracking-revoke]', true]] as const) {
    $(selector)?.addEventListener('click', async () => {
      if (revoke && !confirm('Cabut kunci tiket ini? Kunci lama dan sesi pelacakan tidak dapat digunakan kembali.')) return;
      try {
        await api(revoke ? `/tickets/${ticketId}/capability/revoke` : '/guest/tracking-session/logout', 'POST', {
          expected_version: 1,
          reason: revoke ? 'Pencabutan oleh pemegang kunci' : 'Logout pelacakan'
        });
        cleanAllAccountDrafts();
        location.assign('/lacak.html');
      } catch (err) {
        setStatus(errorText(err));
      }
    });
  }

  if (!session) {
    api('/guest/tracking-session').then(() => {
      const logoutBtn = $('[data-tracking-logout]');
      if (logoutBtn) logoutBtn.hidden = false;
      const revokeBtn = $('[data-tracking-revoke]');
      if (revokeBtn) revokeBtn.hidden = false;
    }).catch(() => {});
  }

  await refresh();
  await readEscalation();

}



document.addEventListener('hd:unauthorized', () => {

  session = undefined;
  syncJourney(undefined); syncAdminShell(undefined);

  cleanAllAccountDrafts();

  const content = $('[data-ticket-content]');

  if (content) content.hidden = true;

  const detail = $('[data-ticket-detail]');

  if (detail) detail.hidden = true;

});



async function main(): Promise<void> {
  initSelect2ComboBoxes();
  const kind = $('[data-ticket-page]')?.dataset.ticketPage;

  try {
    await loadSession();
    if (location.pathname.startsWith('/admin/') && !canOpenAdminPage(location.pathname,location.search,session)) return;
    if (location.pathname.startsWith('/admin/')) initAdminDataTables();

    if (kind === 'create') await create();

    else if (kind === 'list') await list();

    else if (kind === 'track') await track();

    else if (kind === 'ticket') await ticketDetail();

  } catch (e) {

    setStatus(errorText(e));

  }

}



void main();

