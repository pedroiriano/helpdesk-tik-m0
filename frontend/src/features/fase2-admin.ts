import { api, errorText } from './transport';
import type { Components } from './business-types.generated';
import { openAdminConfirmDialog } from './admin-confirm';

type Page<T> = { items: T[]; next_cursor: string | null; as_of: string };
type DeliveryJobItem = Components['DeliveryJobRecord'];

interface NotificationItem {
  id: string;
  version: number;
  title: string;
  created_at: string;
  read: boolean;
  delivery_state: string;
}

interface SystemJobItem {
  id: string;
  version: number;
  kind: string;
  requested_by: string;
  target_id: string;
  state: string;
  reason: string;
  created_at: string;
}

interface SchedulerJobItem {
  id: string;
  ticket_id: string;
  kind: string;
  state: string;
  version: number;
  expected_version: number;
  attempts: number;
  due_at: string;
  retry_at?: string | null;
  last_error_code?: string | null;
}

interface MediaApprovalItem {
  id: string;
  version: number;
  source_id: string;
  source_owner: string;
  copy_id: string;
  target_id: string;
  target_audience: string;
  reason: string;
  used_at?: string | null;
  revoked_at?: string | null;
}

interface RuleItem {
  id: string;
  owner: string;
  code: string;
  version: number;
  rule_version: number;
  active: boolean;
  summary: string;
}

const $ = <T extends HTMLElement = HTMLElement>(s: string, p: ParentNode = document): T | null => p.querySelector<T>(s);
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const fmtWib = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' }) + ' WIB' : iso;
};
const emptyRow = (cols: number, msg: string) => {
  const tr = el('tr');
  const td = el('td', msg);
  td.colSpan = cols;
  tr.append(td);
  return tr;
};

export async function loadNotificationsInbox(): Promise<void> {
  const rows = $('[data-hd-notif-rows]');
  const stat = $('[data-hd-notif-status]');
  if (!rows) return;
  if (stat) stat.textContent = 'Memuat notifikasi dari server…';
  try {
    const res = await api<Page<NotificationItem>>('/notifications?limit=100');
    rows.replaceChildren();
    if (!res.items.length) {
      rows.append(emptyRow(4, 'Belum ada notifikasi pada akun Anda.'));
      if (stat) stat.textContent = 'Kotak masuk notifikasi kosong.';
      return;
    }
    for (const item of res.items) {
      const tr = el('tr');
      const statusText = item.read ? 'Sudah dibaca' : `Belum dibaca (${item.delivery_state})`;
      const actTd = el('td');
      if (!item.read) {
        const markBtn = el('button', 'Tandai dibaca', 'piui-btn piui-btn--secondary piui-btn--sm');
        markBtn.type = 'button';
        markBtn.addEventListener('click', async () => {
          markBtn.disabled = true;
          try {
            await api(`/notifications/${encodeURIComponent(item.id)}/read`, 'POST', {
              expected_version: item.version,
              reason: 'Dibaca melalui konsol petugas'
            });
            await loadNotificationsInbox();
          } catch (err) {
            if (stat) stat.textContent = errorText(err);
            markBtn.disabled = false;
          }
        });
        actTd.append(markBtn);
      } else {
        actTd.textContent = 'Dibaca';
      }
      tr.append(el('td', item.title), el('td', fmtWib(item.created_at)), el('td', statusText), actTd);
      rows.append(tr);
    }
    if (stat) stat.textContent = `Menampilkan ${res.items.length} notifikasi terbaru.`;
  } catch (err) {
    if (stat) stat.textContent = errorText(err);
  } finally {
    await loadDeliveryJobs();
  }
}

const DELIVERY_STATE_LABELS: Record<string, string> = {
  PENDING: 'Menunggu kirim',
  LEASED: 'Sedang dikirim',
  ACKED: 'Terkirim',
  FAILED: 'Gagal sementara (Retry)',
  DEAD_LETTER: 'Dead Letter (Butuh Replay)',
};

export async function loadDeliveryJobs(): Promise<void> {
  const panel = $('[data-hd-delivery-panel]');
  const rows = $('[data-hd-delivery-rows]');
  const stat = $('[data-hd-delivery-status]');
  if (!panel || !rows) return;
  const filter = ($('#hd-delivery-state') as HTMLSelectElement | null)?.value ?? '';
  const query = filter ? `?limit=100&state=${encodeURIComponent(filter)}` : '?limit=100';
  try {
    const res = await api<Page<DeliveryJobItem>>(`/admin/delivery-jobs${query}`);
    panel.hidden = false;
    rows.replaceChildren();
    if (!res.items.length) {
      rows.append(emptyRow(5, 'Tidak ada antrean pengiriman saluran untuk filter ini.'));
      if (stat) stat.textContent = 'Antrean pengiriman saluran bersih.';
      return;
    }
    for (const job of res.items) {
      const tr = el('tr');
      const errText = job.last_error_code ? ` · ${job.last_error_code}` : '';
      const attemptsTd = el('td', `${job.attempts}/5${errText}`);
      const actTd = el('td');
      if (job.state === 'FAILED' || job.state === 'DEAD_LETTER') {
        const replayBtn = el('button', 'Replay', 'piui-btn piui-btn--secondary piui-btn--sm');
        replayBtn.type = 'button';
        replayBtn.addEventListener('click', async () => {
          replayBtn.disabled = true;
          try {
            await api(`/admin/delivery-jobs/${encodeURIComponent(job.id)}/replay`, 'POST', {
              expected_version: job.version,
              reason: 'Replay antrean notifikasi melalui konsol admin',
            });
            await loadDeliveryJobs();
          } catch (err) {
            if (stat) stat.textContent = errorText(err);
            replayBtn.disabled = false;
          }
        });
        actTd.append(replayBtn);
      } else {
        actTd.textContent = job.delivered_at ? fmtWib(job.delivered_at) : '-';
      }
      tr.append(
        el('td', job.channel),
        el('td', job.target_masked || '***'),
        el('td', DELIVERY_STATE_LABELS[job.state] ?? job.state),
        attemptsTd,
        actTd,
      );
      rows.append(tr);
    }
    if (stat) stat.textContent = `Menampilkan ${res.items.length} job pengiriman saluran (target teredaksi).`;
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && Number((err as { status?: number }).status) === 403) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    if (stat) stat.textContent = errorText(err);
  }
}

export async function pollReportExport(exportId: string, dlLink: HTMLAnchorElement | null, statusFn: (msg: string) => void): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 750));
    try {
      const current = await api<{ id: string; state: string }>(`/reports/exports/${encodeURIComponent(exportId)}`);
      if (current.state === 'SUCCEEDED') {
        if (dlLink) {
          dlLink.href = `/api/v1/reports/exports/${encodeURIComponent(current.id)}/file`;
          dlLink.hidden = false;
        }
        statusFn('Berkas ekspor siap diunduh.');
        return;
      }
      if (current.state === 'FAILED') {
        statusFn('Pembuatan berkas ekspor gagal di server.');
        return;
      }
      statusFn(`Memproses berkas ekspor (${current.state})…`);
    } catch (err) {
      statusFn(errorText(err));
      return;
    }
  }
  statusFn('Ekspor masih diproses; buka ulang dialog atau muat status beberapa saat lagi.');
}

export async function loadOperationsList(): Promise<void> {
  const rows = $('[data-hd-ops-rows]');
  const stat = $('[data-hd-runner-status]');
  if (!rows) return;
  try {
    const res = await api<{ items: SystemJobItem[] }>('/admin/operations?limit=100');
    rows.replaceChildren();
    if (!res.items.length) {
      rows.append(emptyRow(5, 'Belum ada pekerjaan sistem pada scope Anda.'));
      return;
    }
    const jobField = $<HTMLInputElement>('#hd-runner-job');
    for (const job of res.items) {
      const tr = el('tr');
      const tdAct = el('td');
      const pickBtn = el('button', 'Pilih ke Runner', 'piui-btn piui-btn--secondary piui-btn--sm');
      pickBtn.type = 'button';
      pickBtn.addEventListener('click', () => {
        if (jobField) {
          jobField.value = job.id;
          jobField.focus();
        }
        if (stat) stat.textContent = `Pekerjaan ${job.id.slice(0, 8)}… (${job.kind} · ${job.state}) dimuat ke Runner.`;
      });
      tdAct.append(pickBtn);
      tr.append(
        el('td', job.id.slice(0, 8) + '…'),
        el('td', job.kind),
        el('td', `${job.state} (v${job.version})`),
        el('td', job.reason),
        tdAct
      );
      rows.append(tr);
    }
  } catch (err) {
    rows.replaceChildren(emptyRow(5, errorText(err)));
  }
}

export async function loadSchedulerJobs(): Promise<void> {
  const rows = $('[data-hd-scheduler-rows]');
  const stat = $('[data-hd-scheduler-status]');
  const stateSelect = $<HTMLSelectElement>('#hd-scheduler-state');
  if (!rows) return;
  const st = stateSelect?.value ?? '';
  if (stat) stat.textContent = 'Memuat antrean penjadwalan M7…';
  try {
    const res = await api<{ items: SchedulerJobItem[] }>(`/admin/scheduler-jobs?limit=100${st ? '&state=' + encodeURIComponent(st) : ''}`);
    rows.replaceChildren();
    if (!res.items.length) {
      rows.append(emptyRow(5, 'Tidak ada job penjadwalan pada filter ini.'));
      if (stat) stat.textContent = 'Tidak ada job M7 ditemukan.';
      return;
    }
    for (const job of res.items) {
      const tr = el('tr');
      const ticketCell = el('td');
      const link = el('a', job.ticket_id.slice(0, 8) + '…', 'piui-btn piui-btn--secondary piui-btn--sm');
      link.href = `/admin/app/tickets/detail.html?id=${encodeURIComponent(job.ticket_id)}`;
      ticketCell.append(link);
      const actTd = el('td');
      if (job.state === 'DEAD_LETTER') {
        const replayBtn = el('button', 'Replay Job', 'piui-btn piui-btn--primary piui-btn--sm');
        replayBtn.type = 'button';
        replayBtn.addEventListener('click', async () => {
          const reason = prompt(`Konfirmasi replay job ${job.kind} (${job.id.slice(0, 8)}…). Alasan replay (min. 5 karakter):`, 'Pemulihan jadwal dead-letter');
          if (!reason || reason.trim().length < 5) return;
          replayBtn.disabled = true;
          try {
            await api(`/tickets/${encodeURIComponent(job.ticket_id)}/scheduler-jobs/${encodeURIComponent(job.id)}/replay`, 'POST', {
              expected_version: job.version,
              reason: reason.trim()
            });
            if (stat) stat.textContent = `Job ${job.id.slice(0, 8)}… dijadwalkan ulang ke PENDING.`;
            await loadSchedulerJobs();
          } catch (err) {
            if (stat) stat.textContent = errorText(err);
            replayBtn.disabled = false;
          }
        });
        actTd.append(replayBtn);
      } else {
        actTd.textContent = fmtWib(job.due_at);
      }
      tr.append(
        ticketCell,
        el('td', job.kind),
        el('td', `${job.state} (v${job.version})`),
        el('td', `${job.attempts}x · ${job.last_error_code || '-'}`),
        actTd
      );
      rows.append(tr);
    }
    if (stat) stat.textContent = `Menampilkan ${res.items.length} job penjadwalan M7.`;
  } catch (err) {
    if (stat) stat.textContent = errorText(err);
  }
}

export async function loadMediaPickersAndApprovals(): Promise<void> {
  const srcPick = $<HTMLSelectElement>('#media-source-pick');
  const copyPick = $<HTMLSelectElement>('#media-copy-pick');
  const targetPick = $<HTMLSelectElement>('#media-target-pick');
  const approvalRows = $('[data-hd-media-approvals-rows]');
  const pubStatus = $('[data-hd-media-publication-status]');

  const srcInput = $<HTMLInputElement>('#media-source-id');
  const verInput = $<HTMLInputElement>('#media-source-version');
  const copyInput = $<HTMLInputElement>('#media-copy-id');
  const targetInput = $<HTMLInputElement>('#media-target-id');
  const audSelect = $<HTMLSelectElement>('#media-target-audience');
  const approvalInput = $<HTMLInputElement>('#media-approval-id');

  const fillMediaOptions = (select: HTMLSelectElement | null, items: { id: string; version: number; owner: string; alt?: string; status: string }[], blankLabel: string) => {
    if (!select) return;
    select.replaceChildren(new Option(blankLabel, ''));
    for (const m of items.filter(i => i.status === 'CLEAN')) {
      const opt = new Option(`[${m.owner}] ${m.alt || m.id.slice(0, 8)} (v${m.version})`, m.id);
      opt.dataset.version = String(m.version);
      select.append(opt);
    }
  };

  if (srcPick && copyPick && !srcPick.dataset.boundSync) {
    srcPick.dataset.boundSync = '1';
    srcPick.addEventListener('change', () => {
      const opt = srcPick.selectedOptions[0];
      if (srcPick.value && srcInput) srcInput.value = srcPick.value;
      if (opt?.dataset.version && verInput) verInput.value = opt.dataset.version;
    });
    copyPick.addEventListener('change', () => {
      if (copyPick.value && copyInput) copyInput.value = copyPick.value;
    });
  }
  if (targetPick && !targetPick.dataset.boundSync) {
    targetPick.dataset.boundSync = '1';
    targetPick.addEventListener('change', () => {
      const opt = targetPick.selectedOptions[0];
      if (targetPick.value && targetInput) targetInput.value = targetPick.value;
      if (opt?.dataset.audience && audSelect) audSelect.value = opt.dataset.audience;
    });
  }

  try {
    const [m8, m3] = await Promise.allSettled([
      api<Page<{ id: string; version: number; owner: 'M8'; alt?: string; status: string }>>('/media?owner=M8&limit=40'),
      api<Page<{ id: string; version: number; owner: 'M3'; alt?: string; status: string }>>('/media?owner=M3&limit=40')
    ]);
    const allMedia = [
      ...(m8.status === 'fulfilled' ? m8.value.items : []),
      ...(m3.status === 'fulfilled' ? m3.value.items : [])
    ];
    fillMediaOptions(srcPick, allMedia, 'Pilih media sumber CLEAN…');
    fillMediaOptions(copyPick, m8.status === 'fulfilled' ? m8.value.items : [], 'Pilih salinan hasil redaksi CLEAN (M8)…');
  } catch {}

  if (targetPick) {
    try {
      const [arts, pgs] = await Promise.allSettled([
        api<Page<{ id: string; kind: string; title: string; audience?: string }>>('/knowledge/articles?limit=40'),
        api<Page<{ id: string; kind: string; title: string; audience?: string }>>('/portal/pages?limit=40')
      ]);
      targetPick.replaceChildren(new Option('Pilih artikel/halaman M8 tujuan…', ''));
      for (const list of [arts, pgs]) {
        if (list.status !== 'fulfilled') continue;
        for (const item of list.value.items) {
          const opt = new Option(`[${item.kind}] ${item.title}`, item.id);
          opt.dataset.audience = item.audience ?? 'PUBLIC_GUEST';
          targetPick.append(opt);
        }
      }
    } catch {}
  }

  if (approvalRows) {
    try {
      const res = await api<{ items: MediaApprovalItem[] }>('/media/approvals?limit=100');
      approvalRows.replaceChildren();
      if (!res.items.length) {
        approvalRows.append(emptyRow(5, 'Belum ada persetujuan media pada organisasi Anda.'));
        return;
      }
      for (const a of res.items) {
        const tr = el('tr');
        const stateText = a.revoked_at ? 'Dicabut' : a.used_at ? 'Terhubung' : 'Siap dihubungkan';
        const tdAct = el('td', '', 'hd-actions');
        if (!a.revoked_at && !a.used_at) {
          const useBtn = el('button', 'Gunakan ID', 'piui-btn piui-btn--secondary piui-btn--sm');
          useBtn.type = 'button';
          useBtn.addEventListener('click', () => {
            if (approvalInput) approvalInput.value = a.id;
            if (srcInput) srcInput.value = a.source_id;
            if (copyInput) copyInput.value = a.copy_id;
            if (targetInput) targetInput.value = a.target_id;
            if (audSelect) audSelect.value = a.target_audience;
            if (pubStatus) pubStatus.textContent = `Persetujuan ${a.id.slice(0, 8)}… dimuat ke formulir.`;
          });
          tdAct.append(useBtn);
        }
        if (!a.revoked_at) {
          const revBtn = el('button', 'Cabut Persetujuan', 'piui-btn piui-btn--secondary piui-btn--sm');
          revBtn.type = 'button';
          revBtn.addEventListener('click', async () => {
            const reason = prompt('Alasan pencabutan persetujuan media (min. 5 karakter):', 'Dibatalkan melalui tinjauan redaksi');
            if (!reason || reason.trim().length < 5) return;
            revBtn.disabled = true;
            try {
              await api(`/media/approvals/${encodeURIComponent(a.id)}/revoke`, 'POST', {
                expected_version: a.version,
                reason: reason.trim()
              });
              if (pubStatus) pubStatus.textContent = `Persetujuan ${a.id.slice(0, 8)}… berhasil dicabut.`;
              await loadMediaPickersAndApprovals();
            } catch (err) {
              if (pubStatus) pubStatus.textContent = errorText(err);
              revBtn.disabled = false;
            }
          });
          tdAct.append(revBtn);
        }
        tr.append(
          el('td', `${a.id.slice(0, 8)}… (v${a.version})`),
          el('td', `${a.source_owner}:${a.source_id.slice(0, 6)}… -> ${a.target_id.slice(0, 6)}…`),
          el('td', stateText),
          el('td', a.reason),
          tdAct
        );
        approvalRows.append(tr);
      }
    } catch (err) {
      approvalRows.replaceChildren(emptyRow(5, errorText(err)));
    }
  }
}

export function bindAdminRulesPanel(): () => Promise<void> {
  const sec = $('[data-hd-rules-section]');
  const ownerSel = $<HTMLSelectElement>('#hd-rule-owner');
  const rows = $('[data-hd-rules-rows]');
  const stat = $('[data-hd-rules-status]');
  const form = $<HTMLFormElement>('[data-hd-rule-form]');
  const formTitle = $('[data-hd-rule-form-title]');
  const formBadge = $('[data-hd-rule-badge]');
  const codeEl = $<HTMLInputElement>('#hd-rule-code');
  const verEl = $<HTMLInputElement>('#hd-rule-ver');
  const rvEl = $<HTMLInputElement>('#hd-rule-rv');
  const actEl = $<HTMLSelectElement>('#hd-rule-active');
  const reasonEl = $<HTMLInputElement>('#hd-rule-reason');

  const resetRuleForm = (focusForm = false) => {
    form?.reset();
    if (codeEl) codeEl.value = '';
    if (verEl) verEl.value = '1';
    if (rvEl) rvEl.value = '1';
    if (actEl) actEl.value = 'true';
    if (reasonEl) reasonEl.value = '';
    if (formTitle) formTitle.textContent = 'Tambah Aturan Baru';
    if (formBadge) formBadge.textContent = 'Data Baru';
    form?.classList.remove('is-editing');
    form?.classList.add('is-creating');
    if (focusForm) {
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      codeEl?.focus({ preventScroll: true });
    }
  };

  const loadRules = async () => {
    if (!sec || sec.hidden || !ownerSel || !rows) return;
    const owner = ownerSel.value || 'classification';
    if (stat) stat.textContent = `Memuat daftar aturan ${owner}…`;
    try {
      const res = await api<{ items: RuleItem[] }>(`/admin/${encodeURIComponent(owner)}-rules`);
      rows.replaceChildren();
      if (!res.items.length) {
        rows.append(emptyRow(5, 'Belum ada aturan tersimpan untuk domain ini. Klik "+ Tambah Aturan Baru" untuk membuat aturan.'));
        if (stat) stat.textContent = `0 aturan ditemukan pada ${owner}.`;
        return;
      }
      for (const r of res.items) {
        const tr = el('tr');
        const tdAct = el('td');
        const actWrap = el('div', '', 'hd-row-actions');
        const pickBtn = el('button', 'Ubah', 'piui-btn piui-btn--secondary piui-btn--sm');
        pickBtn.type = 'button';
        pickBtn.addEventListener('click', () => {
          if (codeEl) codeEl.value = r.code;
          if (verEl) verEl.value = String(r.version);
          if (rvEl) rvEl.value = String(r.rule_version);
          if (actEl) actEl.value = String(r.active);
          if (formTitle) formTitle.textContent = `Ubah Aturan: ${r.code}`;
          if (formBadge) formBadge.textContent = `Mengedit · v${r.version}`;
          form?.classList.remove('is-creating');
          form?.classList.add('is-editing');
          form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          reasonEl?.focus({ preventScroll: true });
        });
        const nextActive = !r.active;
        const toggleBtn = el(
          'button',
          r.active ? 'Nonaktifkan' : 'Aktifkan',
          r.active ? 'piui-btn piui-btn--secondary piui-btn--sm hd-btn-warn-outline' : 'piui-btn piui-btn--secondary piui-btn--sm'
        );
        toggleBtn.type = 'button';
        toggleBtn.addEventListener('click', () => {
          openAdminConfirmDialog({
            title: r.active ? `Nonaktifkan aturan ${r.code}?` : `Aktifkan kembali aturan ${r.code}?`,
            description: r.active
              ? `Aturan "${r.code}" (v${r.version}) akan dinonaktifkan/diarsipkan dari pemrosesan otomatis domain ${owner}.`
              : `Aturan "${r.code}" (v${r.version}) akan diaktifkan kembali pada domain ${owner}.`,
            confirmLabel: r.active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
            confirmTone: r.active ? 'warn' : 'primary',
            requireReason: true,
            defaultReason: r.active ? 'Penonaktifan aturan operasional sementara' : 'Aktivasi kembali aturan operasional',
            onConfirm: async (reasonText: string) => {
              await api(`/admin/${encodeURIComponent(owner)}-rules`, 'POST', {
                expected_version: r.version,
                code: r.code,
                rule_version: r.rule_version,
                active: nextActive,
                reason: reasonText
              });
              if (stat) stat.textContent = `Aturan ${r.code} berhasil ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`;
              await loadRules();
            }
          });
        });
        actWrap.append(pickBtn, toggleBtn);
        tdAct.append(actWrap);
        tr.append(
          el('td', r.code),
          el('td', r.summary),
          el('td', `v${r.version} (aturan v${r.rule_version})`),
          el('td', r.active ? 'Aktif' : 'Nonaktif'),
          tdAct
        );
        rows.append(tr);
      }
      if (stat) stat.textContent = `${res.items.length} aturan dimuat untuk domain ${owner}.`;
    } catch (err) {
      if (stat) stat.textContent = errorText(err);
    }
  };

  ownerSel?.addEventListener('change', () => {
    resetRuleForm(false);
    void loadRules();
  });
  $('[data-hd-new-rule]')?.addEventListener('click', () => resetRuleForm(true));
  $('[data-hd-cancel-rule]')?.addEventListener('click', () => resetRuleForm(false));
  $('[data-hd-refresh-rules]')?.addEventListener('click', () => void loadRules());
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!ownerSel || !form.reportValidity()) return;
    const owner = ownerSel.value || 'classification';
    const btn = $<HTMLButtonElement>('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      await api(`/admin/${encodeURIComponent(owner)}-rules`, 'POST', {
        expected_version: Number(verEl?.value ?? 1),
        code: codeEl?.value.trim() ?? '',
        rule_version: Number(rvEl?.value ?? 1),
        active: (actEl?.value ?? 'true') === 'true',
        reason: reasonEl?.value.trim() ?? ''
      });
      if (reasonEl) reasonEl.value = '';
      if (stat) stat.textContent = 'Perubahan aturan tersimpan dan diaudit.';
      await loadRules();
    } catch (err) {
      if (stat) stat.textContent = errorText(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  return loadRules;
}
