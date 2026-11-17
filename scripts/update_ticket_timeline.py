#!/usr/bin/env python3
"""
Pembaruan UI/UX Progres Laporan dan Penanganannya dengan Timeline Interaktif (M3/M4/M5/M6)
"""

with open('frontend/src/features/m0-04.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Definisikan helper functions sebelum ticketDetail()
helpers = '''
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

  if (a === 'TICKET_CREATED' || s.includes('dibuat') || s.includes('diajukan') || s.includes('pendaftaran')) {
    return {
      icon: '📝',
      nodeClass: 'hd-timeline-node--create',
      actionTitle: 'Laporan Baru Terdaftar di Sistem',
      actorRole: 'Pemohon'
    };
  }
  if (a === 'TICKET_VERIFIED' || s.includes('verifikasi') || s.includes('disahkan')) {
    return {
      icon: '🔍',
      nodeClass: 'hd-timeline-node--verify',
      actionTitle: 'Laporan Diverifikasi & Disahkan Operator',
      actorRole: 'Operator Front Desk'
    };
  }
  if (a === 'ASSIGNMENT_CHANGED' || a === 'TICKET_DISPATCHED' || s.includes('ditugaskan') || s.includes('teknisi')) {
    return {
      icon: '👷',
      nodeClass: 'hd-timeline-node--dispatch',
      actionTitle: 'Disposisi & Penugasan Teknisi Pelaksana',
      actorRole: 'Koordinator Layanan'
    };
  }
  if (a === 'RESOLUTION_PROPOSED' || s.includes('penyelesaian') || s.includes('diperbaiki') || s.includes('tindakan perbaikan')) {
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
  timeDiv.style.fontSize = '11.5px';
  timeDiv.style.color = '#8b949e';
  timeDiv.style.marginBottom = '6px';
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
  if (stepNum === 1) return 'is-active';
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
  resolutionNote?: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hd-ticket-progress-view';

  const now = Date.now();
  const due = new Date(ticket.resolution_due_at).getTime();
  const isDone = ticket.state === 'RESOLVED' || ticket.state === 'CLOSED';
  let slaClass = 'hd-sla-pill--on-track';
  let slaLabel = '🟢 Target Sesuai (On Track)';
  let slaRemaining = '';

  if (isDone) {
    slaClass = 'hd-sla-pill--resolved';
    slaLabel = '✓ Target SLA Terpenuhi';
    slaRemaining = 'Penyelesaian tuntas dalam koridor waktu resmi.';
  } else {
    const diffHours = (due - now) / (1000 * 60 * 60);
    if (diffHours < 0) {
      slaClass = 'hd-sla-pill--breached';
      slaLabel = '⚠️ Melewati Target SLA';
      slaRemaining = `Terlambat ${Math.abs(Math.floor(diffHours))} jam dari batas waktu.`;
    } else if (diffHours <= 4) {
      const remMin = Math.floor((due - now) / 60000);
      slaClass = 'hd-sla-pill--at-risk';
      slaLabel = '⏳ Mendekati Batas SLA';
      slaRemaining = `Sisa waktu ${Math.floor(remMin / 60)}j ${remMin % 60}m.`;
    } else {
      slaClass = 'hd-sla-pill--on-track';
      slaLabel = '🟢 Sesuai Target (On Track)';
      slaRemaining = `Sisa waktu penanganan ${Math.floor(diffHours)} jam.`;
    }
  }

  const stateLabels: Record<string, { label: string; cls: string; icon: string }> = {
    'SUBMITTED':   { label: 'Menunggu Verifikasi', cls: 'hd-badge--submitted', icon: '📥' },
    'OPEN':        { label: 'Terverifikasi (Siap Ditugaskan)', cls: 'hd-badge--verified', icon: '🔍' },
    'ASSIGNED':    { label: 'Teknisi Ditugaskan', cls: 'hd-badge--assigned', icon: '👷' },
    'IN_PROGRESS': { label: 'Sedang Dikerjakan Teknisi', cls: 'hd-badge--progress', icon: '🛠️' },
    'RESOLVED':    { label: 'Penanganan Selesai (Menunggu Konfirmasi)', cls: 'hd-badge--resolved', icon: '✅' },
    'CLOSED':      { label: 'Tuntas Resmi (Selesai)', cls: 'hd-badge--closed', icon: '🎉' },
    'REJECTED':    { label: 'Laporan Ditolak', cls: 'hd-badge--rejected', icon: '❌' },
    'CANCELLED':   { label: 'Dibatalkan', cls: 'hd-badge--rejected', icon: '🚫' },
  };

  const curState = stateLabels[ticket.state] || { label: ticket.state, cls: 'hd-badge--submitted', icon: '📌' };
  const prio = ticket.classification.priority || 'NORMAL';
  const prioClasses: Record<string, string> = {
    'LOW': 'hd-badge--prio-low',
    'NORMAL': 'hd-badge--prio-normal',
    'HIGH': 'hd-badge--prio-high',
    'CRITICAL': 'hd-badge--prio-critical',
  };
  const prioCls = prioClasses[prio] || 'hd-badge--prio-normal';

  const card = document.createElement('div');
  card.className = 'hd-progress-card';

  card.innerHTML = `
    <div class="hd-progress-header">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span class="hd-progress-ticket-num" title="Nomor Tiket Resmi">
          🎫 ${ticket.number}
          <button type="button" class="hd-btn-copy-ticket" data-copy-ticket="${ticket.number}" title="Salin Nomor Tiket">📋 Salin</button>
        </span>
        <span class="hd-badge ${curState.cls}">${curState.icon} ${curState.label}</span>
        <span class="hd-badge ${prioCls}">Prioritas: ${prio}</span>
      </div>
      <div style="font-size:12px;color:#8b949e;display:flex;align-items:center;gap:8px;">
        <span>Versi CAS #${ticket.version}</span>
        <span>•</span>
        <span>${ticket.requester_kind === 'ASN' ? '👔 Pemohon ASN' : '👤 Pemohon Masyarakat'}</span>
      </div>
    </div>

    <h2 class="hd-progress-title">${ticket.title}</h2>
    <div class="hd-progress-desc">${ticket.description}</div>

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
        <span class="hd-meta-box__val">${serviceName}</span>
        <span class="hd-meta-box__sub">Kategori: ${ticket.classification.category || 'Umum'} • Diskominfo Depok</span>
      </div>

      <div class="hd-meta-box">
        <span class="hd-meta-box__label">👷 Petugas Penanggung Jawab</span>
        <span class="hd-meta-box__val">${techName}</span>
        <span class="hd-meta-box__sub">${ticket.verification === 'VERIFIED' ? '✓ Operator Front Desk Terverifikasi' : 'Menunggu Telaah Operator'}</span>
      </div>

      <div class="hd-meta-box">
        <span class="hd-meta-box__label">⏱️ Target Waktu SLA</span>
        <span class="hd-meta-box__val">${formatIndonesianDateTime(ticket.resolution_due_at)}</span>
        <div><span class="hd-sla-pill ${slaClass}">${slaLabel}</span></div>
        <span class="hd-meta-box__sub">${slaRemaining} (${ticket.calendar_version})</span>
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

  if (ticket.state === 'RESOLVED' && resolutionNote) {
    const resBox = document.createElement('div');
    resBox.className = 'hd-resolution-highlight';
    resBox.innerHTML = `
      <h3 class="hd-resolution-title">✅ Hasil Penanganan &amp; Solusi Perbaikan Teknisi</h3>
      <div class="hd-resolution-box">
        <strong>Uraian Pekerjaan:</strong><br>${resolutionNote}
      </div>
      <div class="hd-resolution-timer">
        ⏳ <span>Laporan ini akan ditutup otomatis dalam <strong>24 jam kalender</strong> bila tidak ada sanggahan. Silakan berikan konfirmasi di bawah jika kendala telah teratasi.</span>
      </div>
    `;
    container.append(resBox);
  }

  return container;
}
'''

# Masukkan helpers sebelum "async function ticketDetail(): Promise<void> {"
anchor = 'async function ticketDetail(): Promise<void> {'
assert anchor in code, "Anchor ticketDetail not found"
code = code.replace(anchor, helpers + '\n' + anchor)

# Perbarui historyPager
old_history = '''  const historyPager = createCursorPager<TicketHistory>('riwayat', () => `/tickets/${ticketId}/history`, items => {

    const root = $('[data-ticket-history]');

    if (!root) return;

    root.replaceChildren();

    for (const h of items) {

      root.append(el('li', `${h.summary} · ${new Date(h.created_at).toLocaleString('id-ID')}`));

    }

  });'''

new_history = '''  const historyPager = createCursorPager<TicketHistory>('riwayat', () => `/tickets/${ticketId}/history`, items => {
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
  });'''

code = code.replace(old_history, new_history)

# Perbarui refresh() detailSec
old_detail_sec = '''      const detailSec = $('[data-ticket-detail]');

      if (detailSec) {

        detailSec.hidden = false;

        detailSec.replaceChildren(

          el('p', currentTicket.number, 'court-badge'),

          el('h2', currentTicket.title),

          el('p', `${currentTicket.state} · ${currentTicket.verification} · Versi ${currentTicket.version}`),

          el('p', currentTicket.description),

          el('p', `Diterima ${new Date(currentTicket.accepted_at).toLocaleString('id-ID')} · Target lab ${new Date(currentTicket.resolution_due_at).toLocaleString('id-ID')}`),

          el('p', `Usulan awal: ${currentTicket.classification.category} · ${currentTicket.classification.explanation} · ${currentTicket.classification.classifier_version}`)

        );

      }'''

new_detail_sec = '''      let serviceName = currentTicket.classification.category || 'Layanan TIK';
      try {
        const sInfo = await api<Components['Service']>('/catalog/services/' + currentTicket.service_id);
        if (sInfo?.name) serviceName = sInfo.name;
      } catch {}

      let techName = 'Dalam Antrean Disposisi';
      if (currentTicket.assignee_id) {
        techName = `Teknisi PIC (${currentTicket.assignee_id.slice(0, 8)}...)`;
        try {
          const techs = await api<{ items: { id: string; name: string; level: string }[] }>('/technicians');
          const items = Array.isArray(techs) ? techs : techs?.items || [];
          const found = items.find(t => t.id === currentTicket?.assignee_id);
          if (found) {
            techName = `${found.name} (${found.level})`;
          }
        } catch {}
      }

      let resolutionNote = '';
      if (currentTicket.state === 'RESOLVED' || currentTicket.state === 'CLOSED') {
        try {
          const attempts = await api<{ items: { summary: string; resolved_at: string }[] }>(`/tickets/${ticketId}/resolution-attempts`);
          const items = attempts?.items || [];
          if (items.length > 0) {
            resolutionNote = items[0].summary;
          }
        } catch {}
      }

      const detailSec = $('[data-ticket-detail]');
      if (detailSec) {
        detailSec.hidden = false;
        detailSec.replaceChildren(
          renderExecutiveTicketProgress(currentTicket, serviceName, techName, resolutionNote)
        );
      }'''

code = code.replace(old_detail_sec, new_detail_sec)

with open('frontend/src/features/m0-04.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("m0-04.ts UPDATED SUCCESSFULLY")
