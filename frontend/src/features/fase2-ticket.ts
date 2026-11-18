import { api, errorText } from './transport';
import type { Components } from './business-types.generated';

type Session = Components['Session'] | undefined;
type Ticket = Components['Ticket'] & { archived_at?: string | null };

interface NotificationItem {
  id: string;
  version: number;
  title: string;
  created_at: string;
  read: boolean;
  delivery_state: string;
}

interface HandoffItem {
  id: string;
  version: number;
  direction?: 'INCOMING' | 'OUTGOING';
  ticket_id: string;
  ticket_number?: string;
  ticket_title?: string;
  ticket_version: number;
  from_org_id: string;
  target_org_id: string;
  reason: string;
  state: string;
  response_reason?: string;
}

interface VendorCaseItem {
  id: string;
  version: number;
  external_reference: string;
  contract_reference: string;
  state: string;
  resolution_note?: string;
}

interface PauseItem {
  id: string;
  version: number;
  starts_at: string;
  ends_at: string;
  reason: string;
  resumed_early_at?: string | null;
}

interface WorkLogItem {
  id: string;
  started_at: string;
  ended_at: string;
  summary: string;
}

interface SchedulerJobItem {
  id: string;
  ticket_id: string;
  kind: string;
  state: string;
  version: number;
  attempts: number;
  due_at: string;
  last_error_code?: string | null;
}

interface OperationalRecordsResponse {
  vendor_cases: VendorCaseItem[];
  pauses: PauseItem[];
  handoffs: HandoffItem[];
  work_logs: WorkLogItem[];
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
const toWibLocal = (d: Date) => {
  const wib = new Date(d.getTime() + 7 * 3600000);
  return wib.toISOString().slice(0, 16);
};

async function runPromptPost(
  button: HTMLButtonElement,
  promptMsg: string,
  defaultVal: string,
  path: string,
  expectedVersion: number,
  statEl: HTMLElement | null,
  doneMsg: string,
  onDone: () => Promise<void>
): Promise<void> {
  const reason = prompt(promptMsg, defaultVal);
  if (!reason || reason.trim().length < 5) {
    if (reason !== null && statEl) statEl.textContent = 'Alasan wajib minimal 5 karakter.';
    return;
  }
  button.disabled = true;
  try {
    await api(path, 'POST', { expected_version: expectedVersion, reason: reason.trim() });
    if (statEl) statEl.textContent = doneMsg;
    await onDone();
  } catch (err) {
    if (statEl) statEl.textContent = errorText(err);
    button.disabled = false;
  }
}

export function hasAnyOrgPerm(session: Session, perm: string): boolean {
  return Boolean(session?.actor.memberships.some(m => m.organization_active && m.permissions.includes(perm)));
}

export async function loadRequesterNotifications(session: Session): Promise<void> {
  const sec = $('[data-requester-notif]');
  const list = $('[data-requester-notif-list]');
  const stat = $('[data-requester-notif-status]');
  if (!sec || !list) return;
  const allowed = Boolean(session && (session.actor.role === 'PUBLIC' || session.actor.role === 'ASN' || hasAnyOrgPerm(session, 'notification.read')));
  sec.hidden = !allowed;
  if (!allowed) return;
  const reload = async () => {
    if (stat) stat.textContent = 'Memuat notifikasi terbaru…';
    try {
      const res = await api<{ items: NotificationItem[] }>('/notifications?limit=10');
      list.replaceChildren();
      if (!res.items.length) {
        if (stat) stat.textContent = 'Belum ada notifikasi pada akun Anda.';
        return;
      }
      for (const n of res.items) {
        const li = el('li', '', 'hd-ops-item');
        const info = el('div');
        info.append(el('strong', n.title), el('span', ` · ${fmtWib(n.created_at)} (${n.read ? 'Dibaca' : 'Belum dibaca'})`));
        li.append(info);
        if (!n.read) {
          const btn = el('button', 'Tandai dibaca', 'btn btn-secondary');
          btn.type = 'button';
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              await api(`/notifications/${encodeURIComponent(n.id)}/read`, 'POST', {
                expected_version: n.version,
                reason: 'Dibaca oleh pelapor'
              });
              await reload();
            } catch (err) {
              if (stat) stat.textContent = errorText(err);
              btn.disabled = false;
            }
          });
          li.append(btn);
        }
        list.append(li);
      }
      if (stat) stat.textContent = `${res.items.length} notifikasi terbaru dimuat.`;
    } catch (err) {
      if (stat) stat.textContent = errorText(err);
    }
  };
  if (!sec.dataset.boundRefresh) {
    sec.dataset.boundRefresh = '1';
    $('[data-requester-notif-refresh]', sec)?.addEventListener('click', () => void reload());
  }
  await reload();
}

export async function loadHandoffInbox(session: Session, onRefreshQueue: () => Promise<void>): Promise<void> {
  const sec = $('[data-handoff-inbox]');
  const rows = $('[data-handoff-inbox-rows]');
  const stat = $('[data-handoff-inbox-status]');
  if (!sec || !rows) return;
  const allowed = hasAnyOrgPerm(session, 'ticket.handoff') || hasAnyOrgPerm(session, 'ticket.handoff.accept');
  sec.hidden = !allowed;
  if (!allowed) return;
  const reload = async () => {
    try {
      const res = await api<{ items: HandoffItem[] }>('/handoffs?limit=100');
      rows.replaceChildren();
      if (!res.items.length) {
        const tr = el('tr');
        const td = el('td', 'Tidak ada permohonan handoff lintas-OPD yang menunggu keputusan.');
        td.colSpan = 4;
        tr.append(td);
        rows.append(tr);
        if (stat) stat.textContent = 'Antrean handoff bersih.';
        return;
      }
      for (const h of res.items) {
        const tr = el('tr');
        const label = h.direction === 'INCOMING' ? 'Masuk ke OPD Anda' : 'Keluar ke OPD Lain';
        const tdAct = el('td', '', 'hd-actions');
        const openLink = el('a', h.ticket_number || h.ticket_id.slice(0, 8), 'piui-btn piui-btn--secondary piui-btn--sm');
        openLink.href = h.direction === 'INCOMING'
          ? `/admin/app/tickets/detail.html?id=${encodeURIComponent(h.ticket_id)}&handoff_id=${encodeURIComponent(h.id)}`
          : `/admin/app/tickets/detail.html?id=${encodeURIComponent(h.ticket_id)}`;
        tdAct.append(openLink);
        if (h.direction === 'INCOMING') {
          const rejBtn = el('button', 'Tolak', 'piui-btn piui-btn--secondary piui-btn--sm');
          rejBtn.type = 'button';
          rejBtn.addEventListener('click', () => void runPromptPost(
            rejBtn, 'Alasan penolakan handoff (min. 5 karakter):', 'Kewenangan layanan bukan pada OPD penerima',
            `/tickets/${encodeURIComponent(h.ticket_id)}/handoffs/${encodeURIComponent(h.id)}/reject`,
            h.ticket_version, stat, 'Permohonan handoff ditolak.', async () => { await reload(); await onRefreshQueue(); }
          ));
          tdAct.append(rejBtn);
        } else {
          const canBtn = el('button', 'Batalkan', 'piui-btn piui-btn--secondary piui-btn--sm');
          canBtn.type = 'button';
          canBtn.addEventListener('click', () => void runPromptPost(
            canBtn, 'Alasan pembatalan handoff (min. 5 karakter):', 'Penanganan dilanjutkan oleh OPD pengirim',
            `/tickets/${encodeURIComponent(h.ticket_id)}/handoffs/${encodeURIComponent(h.id)}/cancel`,
            h.ticket_version, stat, 'Permohonan handoff dibatalkan.', async () => { await reload(); await onRefreshQueue(); }
          ));
          tdAct.append(canBtn);
        }
        tr.append(el('td', label), el('td', h.ticket_title || h.ticket_number || h.ticket_id), el('td', h.reason), tdAct);
        rows.append(tr);
      }
      if (stat) stat.textContent = `${res.items.length} permohonan handoff aktif.`;
    } catch (err) {
      if (stat) stat.textContent = errorText(err);
    }
  };
  if (!sec.dataset.boundRefresh) {
    sec.dataset.boundRefresh = '1';
    $('[data-handoff-inbox-refresh]', sec)?.addEventListener('click', () => void reload());
  }
  await reload();
}

export async function loadQueueServiceFilter(): Promise<void> {
  const select = $<HTMLSelectElement>('#queue-filter-service');
  if (!select || select.dataset.loaded) return;
  select.dataset.loaded = '1';
  try {
    const res = await api<{ items: Components['Service'][] }>('/catalog/services?limit=100');
    for (const s of res.items) select.append(new Option(`${s.code} · ${s.name}`, s.id));
  } catch {}
}

export async function searchTicketsAcl(q: string, state: string, serviceId: string): Promise<Ticket[]> {
  const res = await api<{ items: { id: string }[] }>(`/search?owner=M3&q=${encodeURIComponent(q)}&limit=12`);
  if (!res.items.length) return [];
  const fetched = await Promise.allSettled(res.items.map(hit => api<Ticket>(`/tickets/${encodeURIComponent(hit.id)}`)));
  return fetched
    .filter((r): r is PromiseFulfilledResult<Ticket> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(t => (!state || t.state === state) && (!serviceId || t.service_id === serviceId));
}

export async function runBulkArchive(targets: { id: string; expected_version: number }[], reason: string): Promise<string> {
  const res = await api<{ items: { id: string; outcome: string }[] }>('/tickets/bulk', 'POST', {
    action: 'ARCHIVE',
    targets,
    reason
  });
  const counts: Record<string, number> = {};
  for (const it of res.items) counts[it.outcome] = (counts[it.outcome] ?? 0) + 1;
  return `Arsip massal selesai — Berhasil: ${counts.SUCCESS ?? 0}, Konflik/Status belum terminal: ${counts.CONFLICT ?? 0}, Ditolak: ${counts.FORBIDDEN ?? 0}, Tidak ditemukan: ${counts.NOT_FOUND ?? 0}.`;
}

export async function populateVendorPicSelect(ticket: Ticket, session: Session): Promise<void> {
  const select = $<HTMLSelectElement>('#vendor-pic-select');
  const input = $<HTMLInputElement>('#vendor-pic');
  if (!select || !input) return;
  if (!select.dataset.boundSync) {
    select.dataset.boundSync = '1';
    select.addEventListener('change', () => {
      if (select.value) input.value = select.value;
    });
  }
  try {
    const res = await api<{ items: { id: string; name: string; role: string }[] }>(`/staff/directory?organization_id=${encodeURIComponent(ticket.service_owner_org_id)}`);
    select.replaceChildren(new Option('Pilih staf penanggung jawab…', ''));
    for (const st of res.items) select.append(new Option(`${st.name} (${st.role})`, st.id));
    select.hidden = res.items.length === 0;
    const def = input.value || ticket.assignee_id || session?.actor.subject_id || '';
    if (def && [...select.options].some(o => o.value === def)) {
      select.value = def;
      input.value = def;
    }
  } catch {
    select.hidden = true;
  }
}

export async function loadOperationalRecordsAndScheduler(
  ticket: Ticket,
  session: Session,
  isInternal: boolean,
  parseWib: (raw: string) => Date | undefined,
  onRefresh: () => Promise<void>
): Promise<void> {
  const opsSec = $('[data-ops-records]');
  const hasOrgPerm = (p: string) => Boolean(session?.actor.kind === 'STAFF' && session.actor.memberships.some(m =>
    m.organization_active && m.organization_id === ticket.service_owner_org_id && m.permissions.includes(p)));

  if (opsSec) {
    opsSec.hidden = !isInternal;
    if (isInternal) {
      const stat = $('[data-ops-records-status]', opsSec);
      try {
        const rec = await api<OperationalRecordsResponse>(`/tickets/${encodeURIComponent(ticket.id)}/operational-records`);
        const vRoot = $('[data-ops-vendor-list]', opsSec);
        if (vRoot) {
          vRoot.replaceChildren(el('h3', 'Kasus Vendor'));
          if (!rec.vendor_cases.length) vRoot.append(el('p', 'Belum ada kasus vendor pada tiket ini.'));
          for (const vc of rec.vendor_cases) {
            const box = el('div', '', 'hd-ops-item');
            box.append(el('span', `${vc.external_reference} (${vc.contract_reference}) · ${vc.state}${vc.resolution_note ? ' — ' + vc.resolution_note : ''}`));
            if (vc.state === 'OPEN' && !ticket.archived_at && (hasOrgPerm('ticket.vendor') || ticket.assignee_id === session?.actor.subject_id)) {
              const btn = el('button', 'Tutup Kasus Vendor', 'btn btn-secondary');
              btn.type = 'button';
              btn.addEventListener('click', () => void runPromptPost(
                btn, 'Ringkasan penutupan kasus vendor (min. 5 karakter):', 'Tindak lanjut vendor selesai diverifikasi',
                `/tickets/${encodeURIComponent(ticket.id)}/vendor-cases/${encodeURIComponent(vc.id)}/close`,
                ticket.version, stat, 'Kasus vendor ditutup.', onRefresh
              ));
              box.append(btn);
            }
            vRoot.append(box);
          }
        }

        const pRoot = $('[data-ops-pause-list]', opsSec);
        if (pRoot) {
          pRoot.replaceChildren(el('h3', 'Riwayat Jeda SLA'));
          if (!rec.pauses.length) pRoot.append(el('p', 'Belum ada jeda SLA pada tiket ini.'));
          const nowMs = Date.now();
          for (const p of rec.pauses) {
            const activePause = !p.resumed_early_at && Date.parse(p.ends_at) > nowMs;
            const box = el('div', '', 'hd-ops-item');
            box.append(el('span', `${p.reason} · ${fmtWib(p.starts_at)} s.d. ${fmtWib(p.ends_at)} (${activePause ? 'Aktif' : p.resumed_early_at ? 'Diakhiri lebih awal' : 'Berakhir'})`));
            if (activePause && !ticket.archived_at && hasOrgPerm('ticket.pause')) {
              const btn = el('button', 'Akhiri Jeda Lebih Awal', 'btn btn-warning');
              btn.type = 'button';
              btn.addEventListener('click', () => void runPromptPost(
                btn, 'Alasan mengakhiri jeda lebih awal (min. 5 karakter):', 'Kendala eksternal teratasi lebih cepat',
                `/tickets/${encodeURIComponent(ticket.id)}/pauses/${encodeURIComponent(p.id)}/resume`,
                ticket.version, stat, 'Jeda SLA diakhiri lebih awal.', onRefresh
              ));
              box.append(btn);
            }
            pRoot.append(box);
          }
        }

        const hRoot = $('[data-ops-handoff-list]', opsSec);
        if (hRoot) {
          hRoot.replaceChildren(el('h3', 'Riwayat Pelimpahan Lintas-OPD'));
          if (!rec.handoffs.length) hRoot.append(el('p', 'Belum ada riwayat pelimpahan lintas-OPD.'));
          for (const h of rec.handoffs) {
            const box = el('div', '', 'hd-ops-item');
            box.append(el('span', `${h.state} · ${h.reason}${h.response_reason ? ' (' + h.response_reason + ')' : ''}`));
            if (h.state === 'PENDING' && !ticket.archived_at && hasOrgPerm('ticket.handoff')) {
              const btn = el('button', 'Batalkan Handoff', 'btn btn-secondary');
              btn.type = 'button';
              btn.addEventListener('click', () => void runPromptPost(
                btn, 'Alasan pembatalan handoff (min. 5 karakter):', 'Penanganan tetap di OPD pengirim',
                `/tickets/${encodeURIComponent(ticket.id)}/handoffs/${encodeURIComponent(h.id)}/cancel`,
                ticket.version, stat, 'Permohonan handoff dibatalkan.', onRefresh
              ));
              box.append(btn);
            }
            hRoot.append(box);
          }
        }

        const wRoot = $('[data-ops-worklog-list]', opsSec);
        if (wRoot) {
          wRoot.replaceChildren(el('h3', 'Log Kerja Teknisi'));
          if (!rec.work_logs.length) wRoot.append(el('p', 'Belum ada log kerja tercatat.'));
          for (const wl of rec.work_logs) {
            const box = el('div', '', 'hd-ops-item');
            box.append(el('span', `${fmtWib(wl.started_at)} - ${fmtWib(wl.ended_at)}: ${wl.summary}`));
            wRoot.append(box);
          }
        }
      } catch (err) {
        if (stat) stat.textContent = errorText(err);
      }

      const worklogForm = $<HTMLFormElement>('[data-form-worklog]', opsSec);
      if (worklogForm) {
        const canLog = !ticket.archived_at && !['CLOSED', 'CANCELLED'].includes(ticket.state) && hasOrgPerm('ticket.worklog');
        worklogForm.hidden = !canLog;
        if (canLog) {
          const sEl = $<HTMLInputElement>('#worklog-start', worklogForm);
          const eEl = $<HTMLInputElement>('#worklog-end', worklogForm);
          if (sEl && !sEl.value) sEl.value = toWibLocal(new Date(Date.now() - 1800000));
          if (eEl && !eEl.value) eEl.value = toWibLocal(new Date());
          worklogForm.onsubmit = async e => {
            e.preventDefault();
            if (!worklogForm.reportValidity()) return;
            const st = parseWib(sEl?.value ?? '');
            const en = parseWib(eEl?.value ?? '');
            const wStat = $('[data-worklog-status]', worklogForm);
            if (!st || !en || en.getTime() <= st.getTime()) {
              if (wStat) wStat.textContent = 'Waktu selesai kerja harus setelah waktu mulai (WIB).';
              return;
            }
            const btn = $<HTMLButtonElement>('button[type=submit]', worklogForm);
            if (btn) btn.disabled = true;
            try {
              await api(`/tickets/${encodeURIComponent(ticket.id)}/work-logs`, 'POST', {
                expected_version: ticket.version,
                started_at: st.toISOString(),
                ended_at: en.toISOString(),
                summary: ($<HTMLTextAreaElement>('#worklog-summary', worklogForm)?.value ?? '').trim()
              });
              worklogForm.reset();
              if (wStat) wStat.textContent = 'Log kerja berhasil disimpan.';
              await onRefresh();
            } catch (err) {
              if (wStat) wStat.textContent = errorText(err);
            } finally {
              if (btn) btn.disabled = false;
            }
          };
        }
      }
    }
  }

  const schedSec = $('[data-ticket-scheduler]');
  if (schedSec) {
    const canJobs = hasOrgPerm('system.job');
    schedSec.hidden = !canJobs;
    if (canJobs) {
      const stat = $('[data-ticket-scheduler-status]', schedSec);
      const rows = $('[data-ticket-scheduler-rows]', schedSec);
      const loadJobs = async () => {
        if (!rows) return;
        try {
          const res = await api<{ items: SchedulerJobItem[] }>(`/tickets/${encodeURIComponent(ticket.id)}/scheduler-jobs`);
          rows.replaceChildren();
          if (!res.items.length) {
            const tr = el('tr');
            const td = el('td', 'Belum ada job penjadwalan untuk tiket ini.');
            td.colSpan = 5;
            tr.append(td);
            rows.append(tr);
            return;
          }
          for (const j of res.items) {
            const tr = el('tr');
            const tdAct = el('td');
            if (j.state === 'DEAD_LETTER') {
              const btn = el('button', 'Replay Job', 'btn btn-primary');
              btn.type = 'button';
              btn.addEventListener('click', () => void runPromptPost(
                btn, `Konfirmasi replay job ${j.kind}. Alasan replay (min. 5 karakter):`, 'Pemulihan jadwal otomatis',
                `/tickets/${encodeURIComponent(ticket.id)}/scheduler-jobs/${encodeURIComponent(j.id)}/replay`,
                j.version, stat, 'Job penjadwalan dijadwalkan ulang ke PENDING.', loadJobs
              ));
              tdAct.append(btn);
            } else {
              tdAct.textContent = '-';
            }
            tr.append(
              el('td', j.kind),
              el('td', `${j.state} (v${j.version})`),
              el('td', `${j.attempts}x · ${j.last_error_code || '-'}`),
              el('td', fmtWib(j.due_at)),
              tdAct
            );
            rows.append(tr);
          }
        } catch (err) {
          if (stat) stat.textContent = errorText(err);
        }
      };
      if (!schedSec.dataset.boundRefresh) {
        schedSec.dataset.boundRefresh = '1';
        $('[data-ticket-scheduler-refresh]', schedSec)?.addEventListener('click', () => void loadJobs());
      }
      await loadJobs();
    }
  }
}
