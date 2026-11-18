(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (location.pathname.startsWith('/admin/')) return;

  const fmtWib = iso => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || '');
      return (
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d) + ' WIB'
      );
    } catch {
      return String(iso || '');
    }
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const scheduleText = item =>
    item.schedule_kind === 'UNSCHEDULED'
      ? 'Tidak Terjadwal / Darurat'
      : 'Pemeliharaan Terjadwal';

  const modeHint = item => {
    if (item.display_mode === 'FULL_SCREEN') {
      return 'Portal publik ditutup sementara hingga pemeliharaan selesai.';
    }
    return item.mode === 'DRAIN'
      ? 'Pengajuan tiket baru ditutup sementara; pemantauan & penanganan tiket berjalan tetap aktif.'
      : 'Portal dalam mode baca saja; seluruh pengiriman & perubahan data ditangguhkan sementara.';
  };

  function updateStatusTile(data) {
    const tile = document.querySelector('[data-hd-status-maintenance]');
    if (!tile) return;
    const dot = tile.querySelector('[data-hd-status-maint-dot]');
    const title = tile.querySelector('[data-hd-status-maint-state]');
    const desc = tile.querySelector('[data-hd-status-maint-desc]');
    if (data.active) {
      const a = data.active;
      tile.classList.add('is-warn');
      if (dot) dot.classList.add('is-warn');
      if (title) {
        title.textContent =
          a.display_mode === 'FULL_SCREEN'
            ? `Under Maintenance (${scheduleText(a)})`
            : `Pemeliharaan Aktif · ${a.mode} (${scheduleText(a)})`;
      }
      if (desc) {
        desc.textContent = `${a.message} · Estimasi selesai ${fmtWib(a.ends_at)}.`;
      }
      return;
    }
    if (Array.isArray(data.upcoming) && data.upcoming.length > 0) {
      const u = data.upcoming[0];
      tile.classList.add('is-scheduled');
      if (title) title.textContent = `Terjadwal · ${fmtWib(u.starts_at)}`;
      if (desc) desc.textContent = `${u.message} (s.d. ${fmtWib(u.ends_at)}).`;
      return;
    }
    tile.classList.remove('is-warn', 'is-scheduled');
    if (dot) dot.classList.remove('is-warn');
    if (title) title.textContent = 'Normal · Beroperasi Penuh';
    if (desc) desc.textContent = 'Tidak ada jendela pemeliharaan aktif maupun terjadwal.';
  }

  function lockPublicForms(active) {
    const readOnly = active.mode === 'READ_ONLY';
    const drain = active.mode === 'DRAIN';
    const selector = readOnly
      ? 'form[data-ticket-create], form[data-ticket-comment], form[data-ticket-upload], form[data-form-lifecycle], form[data-hd-register]'
      : drain
        ? 'form[data-ticket-create]'
        : '';
    if (!selector) return;

    const applyLock = () => {
      document.querySelectorAll(selector).forEach(form => {
        if (form.dataset.maintLocked === '1') return;
        form.dataset.maintLocked = '1';
        const notice = el(
          'div',
          'hd-maint-form-notice',
          readOnly
            ? `Pengiriman formulir ditutup sementara karena pemeliharaan sistem (${scheduleText(active)}) s.d. ${fmtWib(active.ends_at)}: ${active.message}`
            : `Pembuatan tiket baru ditutup sementara (Mode DRAIN) s.d. ${fmtWib(active.ends_at)}: ${active.message}`
        );
        notice.setAttribute('role', 'alert');
        form.prepend(notice);
        form.querySelectorAll('button[type="submit"]').forEach(btn => {
          btn.disabled = true;
          btn.dataset.maintDisabled = '1';
        });
      });
    };

    applyLock();
    const obs = new MutationObserver(() => applyLock());
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }

  function renderFullScreenOverlay(active) {
    const main = document.querySelector('main#main-content') || document.querySelector('main');
    if (main) main.hidden = true;

    document.querySelector('[data-hd-maint-overlay]')?.remove();
    const section = el('section', 'hd-maint-overlay');
    section.setAttribute('data-hd-maint-overlay', '');
    section.setAttribute('role', 'region');
    section.setAttribute('aria-labelledby', 'hd-maint-overlay-title');

    const card = el('div', 'hd-maint-card');
    const isEmergency = active.schedule_kind === 'UNSCHEDULED';
    const badgeRow = el('div', 'hd-maint-badges');
    badgeRow.append(
      el(
        'span',
        `hd-maint-pill ${isEmergency ? 'hd-maint-pill--danger' : 'hd-maint-pill--scheduled'}`,
        isEmergency ? '⛔ Pemeliharaan Tidak Terjadwal / Darurat' : '🛠️ Pemeliharaan Terjadwal Sedang Berlangsung'
      ),
      el('span', 'hd-maint-pill hd-maint-pill--mode', `Mode ${active.mode}`)
    );

    const heading = el('h1', 'hd-maint-title', 'Sistem Sedang Dalam Pemeliharaan (Under Maintenance)');
    heading.id = 'hd-maint-overlay-title';

    const msg = el('p', 'hd-maint-message', active.message || 'Sistem Helpdesk TIK Kota Depok sedang menjalani pemeliharaan.');
    const hint = el('p', 'hd-maint-hint', modeHint(active));

    const times = el('dl', 'hd-maint-times');
    const row1 = el('div', 'hd-maint-time-item');
    row1.append(el('dt', '', 'Waktu Mulai'), el('dd', '', fmtWib(active.starts_at)));
    const row2 = el('div', 'hd-maint-time-item');
    row2.append(el('dt', '', 'Estimasi Selesai'), el('dd', '', fmtWib(active.ends_at)));
    times.append(row1, row2);

    const actions = el('div', 'hd-maint-actions');
    const reloadBtn = el('button', 'hd-maint-btn hd-maint-btn--primary', '🔄 Muat Ulang Halaman');
    reloadBtn.type = 'button';
    reloadBtn.addEventListener('click', () => location.reload());

    const statusLink = el('a', 'hd-maint-btn hd-maint-btn--secondary', '📊 Cek Status Layanan');
    statusLink.href = '/status.html';

    const adminLink = el('a', 'hd-maint-admin-link', '🔐 Masuk Petugas / Admin');
    adminLink.href = '/admin/auth/login.html';

    actions.append(reloadBtn, statusLink);
    card.append(badgeRow, heading, msg, hint, times, actions, adminLink);
    section.append(card);

    if (main?.parentNode) {
      main.parentNode.insertBefore(section, main);
    } else {
      document.body.append(section);
    }
  }

  function renderBanner(item, isActive) {
    document.querySelector('[data-hd-maint-banner]')?.remove();
    const banner = el(
      'aside',
      `hd-maint-banner ${isActive ? 'hd-maint-banner--active' : 'hd-maint-banner--scheduled'}`
    );
    banner.setAttribute('data-hd-maint-banner', '');
    banner.setAttribute('role', isActive ? 'alert' : 'status');

    const inner = el('div', 'hd-maint-banner__inner');
    const content = el('div', 'hd-maint-banner__text');
    const label = isActive
      ? `${item.schedule_kind === 'UNSCHEDULED' ? '⛔ Pemeliharaan Darurat / Tidak Terjadwal' : '🛠️ Pemeliharaan Terjadwal Aktif'} (${item.mode})`
      : '📅 Pemberitahuan Pemeliharaan Sistem Terjadwal';
    const title = el('strong', 'hd-maint-banner__title', label);

    const windowInfo = isActive
      ? `Berlangsung s.d. ${fmtWib(item.ends_at)} · ${item.message}. ${modeHint(item)}`
      : `Dijadwalkan ${fmtWib(item.starts_at)} – ${fmtWib(item.ends_at)} · ${item.message}`;
    const body = el('span', 'hd-maint-banner__desc', windowInfo);

    content.append(title, body);

    const links = el('div', 'hd-maint-banner__actions');
    if (location.pathname !== '/status.html') {
      const statusA = el('a', 'hd-maint-banner__link', 'Status Layanan');
      statusA.href = '/status.html';
      links.append(statusA);
    }
    if (!isActive) {
      const closeBtn = el('button', 'hd-maint-banner__close', '×');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Tutup pemberitahuan jadwal pemeliharaan');
      closeBtn.addEventListener('click', () => banner.remove());
      links.append(closeBtn);
    }

    inner.append(content, links);
    banner.append(inner);

    const header = document.querySelector('header');
    if (header?.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  async function initPublicMaintenance() {
    try {
      const res = await fetch('/api/v1/maintenance/status', {
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      updateStatusTile(data);

      if (data.active) {
        const isStatusPage = location.pathname === '/status.html' || location.pathname === '/status';
        if (data.active.display_mode === 'FULL_SCREEN' && !isStatusPage) {
          renderFullScreenOverlay(data.active);
        } else {
          renderBanner(data.active, true);
          lockPublicForms(data.active);
        }
        return;
      }

      if (Array.isArray(data.upcoming) && data.upcoming.length > 0) {
        renderBanner(data.upcoming[0], false);
      }
    } catch {
      // Do not break public rendering if maintenance endpoint is temporarily unreachable.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void initPublicMaintenance());
  } else {
    void initPublicMaintenance();
  }
})();
