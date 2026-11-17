import { requestDialogDismiss } from './popup-layer.js';
/**
 * Modul Komponen: Executive Command Center Controller (KPI, Tabel Audit, CSV Export, & Konfirmasi Destruktif)
 */

import { getValidatedUrlState, updateUrlState, onUrlStateChange, matchesDateRange, paginate } from "../core/url-state.js";
import { announce, showToast } from "../core/session-guard.js";
import { downloadCsv } from '../core/csv.js';
import { copyText } from '../core/clipboard.js';
import { renderOperationalChart } from "./svg-chart.js";
import { renderPaginationButtons } from "./data-table.js";

const KPI_DATA_BY_RANGE = {
  today: {
    activeUsers: "1.420",
    activeUsersTrend: "▲ +6,8% vs kemarin",
    txVolume: "Rp 842.500.000",
    txVolumeTrend: "▲ +12,4% vs kemarin",
    apiLatency: "42 ms",
    apiLatencyTrend: "▼ -4 ms (Target <= 100ms)",
    pendingQueue: "14",
    pendingQueueTrend: "3 butuh tindakan segera"
  },
  "7d": {
    activeUsers: "4.892",
    activeUsersTrend: "▲ +9,2% vs pekan lalu",
    txVolume: "Rp 5.910.400.000",
    txVolumeTrend: "▲ +15,1% vs pekan lalu",
    apiLatency: "41 ms",
    apiLatencyTrend: "Stabil (Target <= 100ms)",
    pendingQueue: "29",
    pendingQueueTrend: "Rata-rata selesai 18 mnt"
  },
  "30d": {
    activeUsers: "12.640",
    activeUsersTrend: "▲ +18,5% vs bulan lalu",
    txVolume: "Rp 24.380.000.000",
    txVolumeTrend: "▲ +21,0% vs bulan lalu",
    apiLatency: "43 ms",
    apiLatencyTrend: "99,98% dalam SLA",
    pendingQueue: "64",
    pendingQueueTrend: "Seluruh SLA terpenuhi"
  }
};

const AUDIT_LOGS = [
  {
    id: "AUD-20261021-0094",
    timeWib: "21 Okt 2026, 08:02:14 WIB",
    timeUtc: "2026-10-21 01:02:14 UTC",
    actor: "rina.ops (Operational Admin)",
    action: "Memperbarui batas kuota API organisasi ORG-881",
    ip: "10.24.18.92",
    severity: "info",
    severityLabel: "INFO"
  },
  {
    id: "AUD-20261021-0093",
    timeWib: "21 Okt 2026, 07:54:09 WIB",
    timeUtc: "2026-10-21 00:54:09 UTC",
    actor: "budi.sec (Super Admin)",
    action: "Mencabut akses sesi paksa pada 2 akun mencurigakan",
    ip: "10.24.10.04",
    severity: "high-risk",
    severityLabel: "HIGH-RISK"
  },
  {
    id: "AUD-20261021-0092",
    timeWib: "21 Okt 2026, 07:41:50 WIB",
    timeUtc: "2026-10-21 00:41:50 UTC",
    actor: "system.guard (Automated Policy)",
    action: "Mendeteksi 5 percobaan OTP gagal beruntun dari IP eksternal",
    ip: "103.144.22.19",
    severity: "warning",
    severityLabel: "WARNING"
  },
  {
    id: "AUD-20261021-0091",
    timeWib: "21 Okt 2026, 07:19:33 WIB",
    timeUtc: "2026-10-21 00:19:33 UTC",
    actor: "andi.audit (Internal Auditor)",
    action: "Mengekspor laporan kepatuhan RBAC kuartal III",
    ip: "10.24.12.55",
    severity: "info",
    severityLabel: "INFO"
  },
  {
    id: "AUD-20261021-0090",
    timeWib: "21 Okt 2026, 06:58:10 WIB",
    timeUtc: "2026-10-20 23:58:10 UTC",
    actor: "budi.sec (Super Admin)",
    action: "Mengaktifkan kebijakan Strict CSP & Trusted Types v2.0",
    ip: "10.24.10.04",
    severity: "high-risk",
    severityLabel: "HIGH-RISK"
  },
  {
    id: "AUD-20261021-0089",
    timeWib: "21 Okt 2026, 06:30:00 WIB",
    timeUtc: "2026-10-20 23:30:00 UTC",
    actor: "scheduler.batch (System)",
    action: "Sinkronisasi agregasi metrik harian selesai dalam 410ms",
    ip: "127.0.0.1",
    severity: "info",
    severityLabel: "INFO"
  },
  {
    id: "AUD-20261021-0088",
    timeWib: "21 Okt 2026, 05:45:12 WIB",
    timeUtc: "2026-10-20 22:45:12 UTC",
    actor: "hendra.finops (FinOps Lead)",
    action: "Otorisasi pencairan batch kliring RTGS sesi subuh",
    ip: "10.24.09.10",
    severity: "info",
    severityLabel: "INFO"
  },
  {
    id: "AUD-20261021-0087",
    timeWib: "21 Okt 2026, 04:12:05 WIB",
    timeUtc: "2026-10-20 21:12:05 UTC",
    actor: "nadia.appsec (AppSec Lead)",
    action: "Rotasi sertifikat mTLS klaster Surabaya DRC-1",
    ip: "10.24.08.42",
    severity: "warning",
    severityLabel: "WARNING"
  }
];

export function initDashboardController() {
  const dashboardRoot = document.getElementById("piui-dashboard-workspace");
  if (!dashboardRoot) return;

  const rangeBtns = document.querySelectorAll("[data-range-select]");
  const tzBtn = document.getElementById("btn-tz-toggle");
  const filterForm = document.getElementById("audit-filter-form");
  const searchInput = document.getElementById("audit-search-q");
  const severitySelect = document.getElementById("audit-filter-severity");
  const resetFilterBtn = document.getElementById("btn-reset-audit-filter");
  const emptyResetBtn = document.getElementById("btn-empty-reset");
  const auditTbody = document.getElementById("audit-log-tbody");
  const auditRowTpl = document.getElementById("tpl-audit-row");
  const auditEmptyBox = document.getElementById("audit-empty-state");
  const auditCountLabel = document.getElementById("audit-count-summary");
  const exportBtn = document.getElementById("btn-export-summary");

  let auditPageSize = 4;
  let auditCurrentPage = 1;

  // Buat Masterpiece Pagination Bar di bawah Tabel Audit Dashboard
  const auditScrollWrap = auditTbody?.closest(".piui-table-scroll");
  let auditPagesNav = null;
  let auditSizeSelect = null;
  let auditRangeBadge = null;

  if (auditScrollWrap && auditScrollWrap.parentNode) {
    const paginationEl = document.createElement("div");
    paginationEl.className = "piui-pagination";

    const infoBox = document.createElement("div");
    infoBox.className = "piui-pagination__info";
    auditRangeBadge = document.createElement("span");
    auditRangeBadge.className = "piui-badge tabular-nums";
    auditRangeBadge.setAttribute("data-status", "info");
    infoBox.appendChild(auditRangeBadge);

    const controlsHost = document.createElement("div");
    controlsHost.className = "piui-pagination__controls";

    const sizeWrapper = document.createElement("div");
    sizeWrapper.className = "piui-pagination__size";
    const sizeLabel = document.createElement("span");
    sizeLabel.textContent = "Tampilkan:";
    const sizeSelect = document.createElement("select");
    auditSizeSelect = sizeSelect;
    sizeSelect.className = "piui-select";
    sizeSelect.setAttribute("aria-label", "Pilih jumlah log audit per halaman");
    for (const optVal of [
      { v: "3", label: "3 Data / Hal" },
      { v: "4", label: "4 Data / Hal" },
      { v: "6", label: "6 Data / Hal" },
      { v: "99", label: "Maksimal 99 baris" }
    ]) {
      const o = document.createElement("option");
      o.value = optVal.v;
      o.textContent = optVal.label;
      if (optVal.v === String(auditPageSize)) o.selected = true;
      sizeSelect.appendChild(o);
    }
    sizeWrapper.appendChild(sizeLabel);
    sizeWrapper.appendChild(sizeSelect);

    auditPagesNav = document.createElement("nav");
    auditPagesNav.className = "piui-pagination__pages";
    auditPagesNav.setAttribute("aria-label", "Navigasi halaman audit");

    controlsHost.appendChild(sizeWrapper);
    controlsHost.appendChild(auditPagesNav);
    paginationEl.appendChild(infoBox);
    paginationEl.appendChild(controlsHost);
    auditScrollWrap.parentNode.insertBefore(paginationEl, auditScrollWrap.nextSibling);

    sizeSelect.addEventListener("change", () => {
      auditPageSize = Number.parseInt(sizeSelect.value, 10) || 4;
      auditCurrentPage = 1;
      updateUrlState({limit:auditPageSize,page:1});
      renderAuditRows(getValidatedUrlState());
      showToast(`Menampilkan ${sizeSelect.options[sizeSelect.selectedIndex]?.textContent || auditPageSize} pada log audit.`);
    });
  }

  // Elemen Dialog Konfirmasi Destruktif
  const lockdownDialog = document.getElementById("dialog-security-lockdown");
  const openLockdownBtn = document.getElementById("btn-open-lockdown");
  const closeLockdownBtn = document.getElementById("btn-cancel-lockdown");
  const lockdownForm = document.getElementById("form-security-lockdown");
  const reasonInput = document.getElementById("lockdown-reason");
  const confirmCodeInput = document.getElementById("lockdown-confirm-code");
  const submitLockdownBtn = document.getElementById("btn-submit-lockdown");

  const applyStateToUI = (state) => {
    // 1. Update tombol periode waktu
    rangeBtns.forEach((btn) => {
      const r = btn.getAttribute("data-range-select");
      btn.setAttribute("aria-pressed", String(r === state.range));
    });

    // 2. Update nilai Kartu KPI
    const kpi = KPI_DATA_BY_RANGE[state.range] || KPI_DATA_BY_RANGE.today;
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setText("kpi-val-users", kpi.activeUsers);
    setText("kpi-trend-users", kpi.activeUsersTrend);
    setText("kpi-val-tx", kpi.txVolume);
    setText("kpi-trend-tx", kpi.txVolumeTrend);
    setText("kpi-val-latency", kpi.apiLatency);
    setText("kpi-trend-latency", kpi.apiLatencyTrend);
    setText("kpi-val-queue", kpi.pendingQueue);
    setText("kpi-trend-queue", kpi.pendingQueueTrend);

    // 3. Render ulang Grafik SVG Native + Tabel Data Pendamping
    renderOperationalChart(state.range);

    // 4. Update sakelar Zona Waktu (WIB vs UTC)
    if (tzBtn) {
      tzBtn.textContent = state.tz === "UTC" ? "Zona: UTC (Klik ke WIB)" : "Zona: WIB UTC+7 (Klik ke UTC)";
    }

    // 5. Sinkronkan nilai input filter tabel audit
    if (searchInput && searchInput.value !== state.q) {
      searchInput.value = state.q;
    }
    if (severitySelect && severitySelect.value !== state.severity) {
      severitySelect.value = state.severity;
    }

    // 6. Filter dan Render baris Tabel Audit menggunakan <template> + DocumentFragment
    renderAuditRows(state);
  };

  const renderAuditRows = (state) => {
    if (!auditTbody || !(auditRowTpl instanceof HTMLTemplateElement)) return;

    auditPageSize = state.limit || 4;
    auditCurrentPage = state.page;
    if(auditSizeSelect) { auditSizeSelect.value=String(auditPageSize); auditSizeSelect.dispatchEvent(new Event("piui:select-sync")); }
    const qLower = state.q.toLowerCase();
    const matched = AUDIT_LOGS.filter((row) => {
      const matchSev = state.severity === "all" || row.severity === state.severity;
      const matchQ =
        !qLower ||
        row.id.toLowerCase().includes(qLower) ||
        row.actor.toLowerCase().includes(qLower) ||
        row.action.toLowerCase().includes(qLower) ||
        row.ip.toLowerCase().includes(qLower);
      return matchSev && matchQ && matchesDateRange("2026-10-21",state);
    });

    const page = paginate(matched,{page:auditCurrentPage,limit:auditPageSize});
    const totalMatched=page.total,totalPages=page.totalPages,startIdx=page.start,endIdx=page.end,pagedRows=page.items;
    auditCurrentPage=page.page;
    if(state.page!==page.page) updateUrlState({page:page.page},{replace:true});

    const frag = document.createDocumentFragment();
    pagedRows.forEach((row) => {
      const clone = auditRowTpl.content.cloneNode(true);
      const idEl = clone.querySelector("[data-col='id']");
      const timeEl = clone.querySelector("[data-col='time']");
      const actorEl = clone.querySelector("[data-col='actor']");
      const actionEl = clone.querySelector("[data-col='action']");
      const ipEl = clone.querySelector("[data-col='ip']");
      const sevBadge = clone.querySelector("[data-col='severity']");
      const copyBtn = clone.querySelector("[data-action='copy-audit-id']");

      if (idEl) idEl.textContent = row.id;
      if (timeEl) {
        timeEl.textContent = state.tz === "UTC" ? row.timeUtc : row.timeWib;
      }
      if (actorEl) actorEl.textContent = row.actor;
      if (actionEl) actionEl.textContent = row.action;
      if (ipEl) ipEl.textContent = row.ip;
      if (sevBadge) {
        sevBadge.textContent = row.severityLabel;
        sevBadge.setAttribute("data-status", row.severity);
      }
      if (copyBtn) {
        copyBtn.setAttribute("data-audit-id", row.id);
        copyBtn.setAttribute("aria-label", `Salin kode audit ${row.id}`);
      }

      frag.appendChild(clone);
    });

    auditTbody.replaceChildren(frag);

    if (auditEmptyBox) {
      auditEmptyBox.hidden = matched.length > 0;
    }
    if (auditCountLabel) {
      auditCountLabel.textContent =
        totalMatched === 0
          ? "0 aktivitas cocok dengan filter"
          : `Menampilkan ${startIdx + 1}–${endIdx} dari ${totalMatched} aktivitas (Total: ${AUDIT_LOGS.length})`;
    }
    if (auditRangeBadge) {
      auditRangeBadge.textContent =
        totalMatched === 0
          ? "0 Log"
          : `Log ${startIdx + 1}–${endIdx} dari ${totalMatched}`;
    }
    if (auditPagesNav) {
      renderPaginationButtons(auditPagesNav, auditCurrentPage, totalPages, (nextP) => {
        updateUrlState({page:nextP});
        renderAuditRows(getValidatedUrlState());
        announce(`Halaman tabel audit ${auditCurrentPage} dari ${totalPages}`);
      });
    }
  };

  // Event Delegation tunggal pada <tbody> untuk tombol Copy ID Audit
  if (auditTbody) {
    auditTbody.addEventListener("click", async (e) => {
      const target = e.target instanceof Element ? e.target.closest("[data-action='copy-audit-id']") : null;
      if (!target) return;
      const auditId = target.getAttribute("data-audit-id") || "";
      if (!auditId) return;

      try {
        await copyText(auditId);
        const originalText = target.textContent;
        target.textContent = "Tersalin ✓";
        showToast(`Kode audit ${auditId} berhasil disalin ke clipboard`);
        window.setTimeout(() => {
          target.textContent = originalText;
        }, 1800);
      } catch {
        showToast(`Kode audit: ${auditId}`);
      }
    });
  }

  // Event Pemilih Rentang Waktu (Hari Ini / 7 Hari / 30 Hari)
  rangeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedRange = btn.getAttribute("data-range-select") || "today";
      const next = updateUrlState({ range: selectedRange });
      applyStateToUI(next);
      announce(`Rentang waktu diperbarui ke ${btn.textContent}`);
    });
  });

  // Event Sakelar Zona Waktu WIB <-> UTC
  if (tzBtn) {
    tzBtn.addEventListener("click", () => {
      const current = getValidatedUrlState();
      const nextTz = current.tz === "UTC" ? "WIB" : "UTC";
      const next = updateUrlState({ tz: nextTz });
      applyStateToUI(next);
      showToast(`Zona waktu tampilan diubah ke ${nextTz}`);
    });
  }

  // Event Filter Tabel Audit
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = updateUrlState({
        q: searchInput ? searchInput.value.trim() : "",
        severity: severitySelect ? severitySelect.value : "all"
      });
      applyStateToUI(next);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const next = updateUrlState(
        { q: searchInput.value.trim(), page:1 },
        { replace: true }
      );
      applyStateToUI(next);
    });
  }

  if (severitySelect) {
    severitySelect.addEventListener("change", () => {
      const next = updateUrlState({ severity: severitySelect.value, page:1 });
      applyStateToUI(next);
      announce(`Filter tingkat risiko diubah ke ${severitySelect.value}`);
    });
  }

  const handleResetFilters = () => {
    const next = updateUrlState({ q: "", severity: "all", from:"", to:"", page:1 });
    applyStateToUI(next);
    showToast("Filter tabel log audit telah direset");
  };

  if (resetFilterBtn) resetFilterBtn.addEventListener("click", handleResetFilters);
  if (emptyResetBtn) emptyResetBtn.addEventListener("click", handleResetFilters);

  // Event Ekspor CSV Lokal
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const state = getValidatedUrlState();
      const csvRows = [
        ["Audit_ID", "Waktu_WIB", "Waktu_UTC", "Aktor", "Tindakan", "IP_Sumber", "Tingkat_Risiko"],
        ...AUDIT_LOGS.filter(row=>(state.severity==="all"||row.severity===state.severity)&&(!state.q||[row.id,row.actor,row.action,row.ip].some(value=>value.toLowerCase().includes(state.q.toLowerCase())))&&matchesDateRange("2026-10-21",state)).map((r) => [
          r.id,
          r.timeWib,
          r.timeUtc,
          r.actor,
          r.action,
          r.ip,
          r.severityLabel
        ])
      ];
      downloadCsv(`piui-zero-audit-${state.range}.csv`,csvRows);
      showToast("Laporan CSV berhasil diunduh secara lokal");
    });
  }

  const exportJsonBtn = document.getElementById("btn-export-json");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", async () => {
      const state = getValidatedUrlState();
      const matched = AUDIT_LOGS.filter(row=>(state.severity==="all"||row.severity===state.severity)&&(!state.q||[row.id,row.actor,row.action,row.ip].some(value=>value.toLowerCase().includes(state.q.toLowerCase())))&&matchesDateRange("2026-10-21",state));
      try {
        await copyText(JSON.stringify(matched, null, 2));
        showToast(`${matched.length} log audit disalin dalam format JSON ke clipboard!`);
      } catch {
        showToast("Gagal menyalin JSON");
      }
    });
  }

  const printBtn = document.getElementById("btn-print-report");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Event Dialog Konfirmasi Aksi Destruktif (Isolasi Sesi Darurat)
  if (lockdownDialog instanceof HTMLDialogElement) {
    const validateLockdownForm = () => {
      const hasReason = reasonInput && reasonInput.value.trim().length >= 10;
      const matchesCode = confirmCodeInput && confirmCodeInput.value.trim() === "ISOLASI-SESI";
      if (submitLockdownBtn) {
        submitLockdownBtn.disabled = !(hasReason && matchesCode);
      }
    };

    if (openLockdownBtn) {
      openLockdownBtn.addEventListener("click", () => {
        if (reasonInput) reasonInput.value = "";
        if (confirmCodeInput) confirmCodeInput.value = "";
        validateLockdownForm();
        lockdownDialog.showModal();
        document.body.classList.add("is-modal-open");
        if (reasonInput) reasonInput.focus();
      });
    }

    if (closeLockdownBtn) {
      closeLockdownBtn.addEventListener("click", () => requestDialogDismiss(lockdownDialog));
    }

    lockdownDialog.addEventListener("close", () => {
      document.body.classList.remove("is-modal-open");
      if (openLockdownBtn) openLockdownBtn.focus();
    });

    if (reasonInput) reasonInput.addEventListener("input", validateLockdownForm);
    if (confirmCodeInput) confirmCodeInput.addEventListener("input", validateLockdownForm);

    if (lockdownForm) {
      lockdownForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!reasonInput || !confirmCodeInput) return;
        if (confirmCodeInput.value.trim() !== "ISOLASI-SESI") return;

        const newAuditEntry = {
          id: `AUD-20261021-0095`,
          timeWib: "21 Okt 2026, 08:55:00 WIB",
          timeUtc: "2026-10-21 01:55:00 UTC",
          actor: "admin.oncall (Super Admin)",
          action: `Isolasi sesi darurat dieksekusi (Alasan: ${reasonInput.value.trim()})`,
          ip: "10.24.10.01",
          severity: "high-risk",
          severityLabel: "HIGH-RISK"
        };
        AUDIT_LOGS.unshift(newAuditEntry);
        lockdownDialog.close();
        applyStateToUI(getValidatedUrlState());
        showToast("Simulasi lokal isolasi selesai; sesi dan audit server tidak diubah.");
      });
    }
  }

  // Pulihkan state saat tombol Back / Forward ditekan
  onUrlStateChange(() => {
    applyStateToUI(getValidatedUrlState());
  });

  // Inisialisasi pertama dari URL
  applyStateToUI(getValidatedUrlState());
}
