import { requestDialogDismiss } from './popup-layer.js';
/**
 * @fileoverview PIUI Zero — Enterprise Component & Operational UX Suite (Items 1–9)
 * Mencakup:
 * 1. Notification Center (Lonceng Topbar + Unread Badge + Slide-Over Inbox Drawer)
 * 2. Custom Date Range Picker (Kalender Bulanan Interaktif + Preset Cepat)
 * 3. Multi-Step Form Wizard (Stepper 1-2-3) & Vertical Activity Timeline
 * 4. Interactive Kanban Board (Drag & Drop Antar Kolom + Tombol Aksesibel)
 * 5. RBAC Permission Tree View (Checkbox Induk-Anak Indeterminate + Expand/Collapse)
 * 6. Rich-Text / Markdown Editor Ringan & API Key Secret Masking Box (CSPRNG Rotation)
 * 7. Print / PDF Executive Report View (@media print Header & Trigger)
 * 8. Lock Screen & Session Idle Timeout Guard (Buka Kunci PIN 2026)
 * 9. UI Density Switcher (Compact / Normal / Comfortable) & Keyboard Shortcuts Cheat-Sheet (?)
 */

import { announce, showToast } from "../core/session-guard.js";

import { createSpriteIcon } from "../core/icons.js";
import { copyText } from '../core/clipboard.js';
const boundTrees=new WeakSet(),boundSecrets=new WeakSet(),boundShowcases=new WeakSet();
let utilitiesReady=false;
const DENSITY_STORAGE_KEY = "piui_zero_ui_density";

/**
 * Helper membuat ikon SVG dari sprite internal secara aman
 * @param {string} symbolId
 * @param {number} [size=18]
 */

/* =========================================================================
   1. NOTIFICATION CENTER (LONCENG TOPBAR & DRAWER INBOX)
   ========================================================================= */
function initPermissionTreeViews() {
  const treeHosts = document.querySelectorAll("[data-piui-rbac-tree]");
  treeHosts.forEach((host) => {
    if(boundTrees.has(host))return;boundTrees.add(host);
    const groups = [
      {
        title: "Modul Komando & Transaksi Keuangan",
        perms: ["Lihat Transaksi (Read)", "Buat Settlement Baru (Write)", "Otorisasi Kliring RTGS (Approve)", "Batalkan Transaksi (Delete)"]
      },
      {
        title: "Contoh Modul Keamanan, Audit & KMS",
        perms: ["Ekspor Jurnal Audit CSV", "Rotasi Kunci mTLS & KMS", "Eksekusi Isolasi Sesi Darurat", "Kelola Kebijakan Strict CSP"]
      }
    ];

    const frag = document.createDocumentFragment();

    groups.forEach((g, gIdx) => {
      const details = document.createElement("details");
      details.className = "piui-tree__branch";
      details.open = true;

      const summary = document.createElement("summary");
      summary.className = "piui-tree__summary";

      const parentLabel = document.createElement("label");
      const parentCb = document.createElement("input");
      parentCb.type = "checkbox";
      parentCb.checked = true;
      parentCb.setAttribute("aria-label", `Pilih semua izin pada ${g.title}`);
      parentLabel.appendChild(parentCb);
      parentLabel.appendChild(document.createTextNode(` ${g.title}`));

      const countBadge = document.createElement("span");
      countBadge.className = "piui-badge tabular-nums";
      countBadge.setAttribute("data-status", "success");

      summary.appendChild(parentLabel);
      summary.appendChild(countBadge);

      const childrenBox = document.createElement("div");
      childrenBox.className = "piui-tree__children";

      const childCbs = [];
      const syncTreeState = () => {
        const checkedCount = childCbs.filter((c) => c.checked).length;
        parentCb.checked = checkedCount === childCbs.length;
        parentCb.indeterminate = checkedCount > 0 && checkedCount < childCbs.length;
        countBadge.textContent = `${checkedCount}/${childCbs.length} Izin Aktif`;
        countBadge.setAttribute("data-status", checkedCount > 0 ? "success" : "warning");
      };

      g.perms.forEach((pText, pIdx) => {
        const cLabel = document.createElement("label");
        const cInput = document.createElement("input");
        cInput.type = "checkbox";
        cInput.checked = !(gIdx === 1 && pIdx === 2);
        cInput.setAttribute("aria-label", pText);
        cInput.addEventListener("change", syncTreeState);
        childCbs.push(cInput);

        cLabel.appendChild(cInput);
        cLabel.appendChild(document.createTextNode(` ${pText}`));
        childrenBox.appendChild(cLabel);
      });

      parentCb.addEventListener("change", () => {
        childCbs.forEach((c) => {
          c.checked = parentCb.checked;
        });
        syncTreeState();
        showToast(`Pilihan izin lokal ${g.title} ${parentCb.checked ? "diaktifkan" : "dinonaktifkan"}`);
      });

      syncTreeState();
      details.appendChild(summary);
      details.appendChild(childrenBox);
      frag.appendChild(details);
    });

    host.replaceChildren(frag);
  });
}

/* =========================================================================
   6. RICH-TEXT / MARKDOWN EDITOR RINGAN & API KEY SECRET MASKING BOX
   ========================================================================= */
function initSecretBoxes() {
  // A. API Key Secret Masking Box
  const secretHosts = document.querySelectorAll("[data-piui-secret-box]");
  secretHosts.forEach((host) => {
    if(boundSecrets.has(host))return;boundSecrets.add(host);
    let rawKey = "piui_demo_98f4a21c7e09b3d6412a88c5e9f4a";
    let isRevealed = false;
    let remaskTimer;

    const codeEl = host.querySelector("[data-secret-value]");
    const toggleBtn = host.querySelector("[data-secret-toggle]");
    const copyBtn = host.querySelector("[data-secret-copy]");
    const rotateBtn = host.querySelector("[data-secret-rotate]");

    const renderKey = () => {
      clearTimeout(remaskTimer);
      if(isRevealed)remaskTimer=setTimeout(()=>{isRevealed=false;renderKey();},10000);
      if (!codeEl) return;
      codeEl.textContent = isRevealed
        ? rawKey
        : `${rawKey.slice(0, 10)}••••••••••••••••••••${rawKey.slice(-4)}`;
      if (toggleBtn) {
        toggleBtn.textContent = isRevealed ? "Sembunyikan" : "Tampilkan 10d";
      }
    };

    toggleBtn?.addEventListener("click", () => {
      isRevealed = !isRevealed;
      renderKey();
    });

    copyBtn?.addEventListener("click", async () => {
      try {
        await copyText(rawKey);
        showToast("Kunci API contoh disalin ke clipboard.");
      } catch {
        showToast("Kunci belum disalin. Pilih teks dan gunakan perintah Salin perangkat.");
      }
    });

    rotateBtn?.addEventListener("click", () => {
      const rand = new Uint32Array(3);
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(rand);
      }
      rawKey = `piui_demo_${Array.from(rand).map((n) => n.toString(16)).join("")}`;
      isRevealed = true;
      renderKey();
      showToast("Contoh kunci lokal diganti. Tidak merotasi kredensial server.");
    });

    renderKey();
  });

}

/* =========================================================================
   7, 8 & 9. LOCK SCREEN, UI DENSITY SWITCHER, PRINT PDF, & SHORTCUTS (?)
   ========================================================================= */
export function triggerLockScreen() {
  const lockDlg = document.getElementById("piui-lock-screen-modal");
  if (lockDlg instanceof HTMLDialogElement && !lockDlg.open) {
    lockDlg.showModal();
    announce("Demonstrasi kunci layar dibuka. Ini bukan proteksi sesi server.");
  }
}

export function triggerShortcutsModal() {
  const shortDlg = document.getElementById("piui-shortcuts-modal");
  if (shortDlg instanceof HTMLDialogElement && !shortDlg.open) {
    shortDlg.showModal();
  }
}

export function applyUiDensity(mode = "normal") {
  const valid = mode === "compact" || mode === "comfortable" ? mode : "normal";
  document.documentElement.setAttribute("data-density", valid);
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, valid);
  } catch {
    /* abaikan */
  }
}

function initEnterpriseGuardsAndUtilities() {
  if (!document.body.hasAttribute("data-component-catalog") || utilitiesReady) return;utilitiesReady=true;
  // Pulihkan kerapatan UI (UI Density)
  try {
    const savedDensity = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (savedDensity) applyUiDensity(savedDensity);
  } catch {
    /* abaikan */
  }

  // 7. Sisipkan Print Report Header Resmi di dalam <main>
  const mainEl = document.querySelector("main.piui-main");
  if (mainEl && !mainEl.querySelector(".piui-print-banner")) {
    const printBanner = document.createElement("div");
    printBanner.className = "piui-print-banner";
    const leftTitle = document.createElement("strong");
    leftTitle.textContent = "LAPORAN EKSEKUTIF RESMI — PIUI ZERO ADMIN DASHBOARD";
    const rightMeta = document.createElement("span");
    rightMeta.textContent = "Klasifikasi: INTERNAL TERBATAS • Terverifikasi SHA-256";
    printBanner.appendChild(leftTitle);
    printBanner.appendChild(rightMeta);
    mainEl.insertBefore(printBanner, mainEl.firstChild);
  }

  // Tambahkan kontrol UI Density, Kunci Layar, Pintasan Keyboard & Cetak PDF ke Popover Profil
  const profilePopover = document.getElementById("popover-profile");
  if (profilePopover && !profilePopover.querySelector("[data-density-group]")) {
    const densityBox = document.createElement("div");
    densityBox.className = "piui-field";
    densityBox.setAttribute("data-density-group", "true");

    const dLabel = document.createElement("span");
    dLabel.className = "piui-field__label";
    dLabel.textContent = "Kerapatan Tampilan (UI Density)";

    const dGroup = document.createElement("div");
    dGroup.className = "piui-segmented";
    [
      { id: "compact", label: "Rapat" },
      { id: "normal", label: "Normal" },
      { id: "comfortable", label: "Lega" }
    ].forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "piui-segmented__btn";
      b.textContent = d.label;
      b.addEventListener("click", () => {
        applyUiDensity(d.id);
        showToast(`Kerapatan tampilan diubah ke mode ${d.label}`);
      });
      dGroup.appendChild(b);
    });

    const utilActions = document.createElement("div");
    utilActions.className = "piui-page-actions";

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
    lockBtn.textContent = "🔒 Kunci Layar";
    lockBtn.addEventListener("click", () => {
      profilePopover.hidePopover?.();
      triggerLockScreen();
    });

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
    printBtn.textContent = "🖨️ Cetak PDF";
    printBtn.addEventListener("click", () => {
      profilePopover.hidePopover?.();
      window.print();
    });

    const kbBtn = document.createElement("button");
    kbBtn.type = "button";
    kbBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
    kbBtn.textContent = "⌨️ Pintasan (?)";
    kbBtn.addEventListener("click", () => {
      profilePopover.hidePopover?.();
      triggerShortcutsModal();
    });

    utilActions.appendChild(lockBtn);
    utilActions.appendChild(printBtn);
    utilActions.appendChild(kbBtn);

    densityBox.appendChild(dLabel);
    densityBox.appendChild(dGroup);
    profilePopover.insertBefore(densityBox, profilePopover.lastElementChild);
    profilePopover.insertBefore(utilActions, profilePopover.lastElementChild);
  }

  // 8. Buat Modal Lock Screen (<dialog id="piui-lock-screen-modal">)
  if (!document.getElementById("piui-lock-screen-modal")) {
    const lockDlg = document.createElement("dialog");
    lockDlg.id = "piui-lock-screen-modal";
    lockDlg.className = "piui-lightbox";
    lockDlg.setAttribute("aria-label", "Layar Kunci Keamanan Sesi");

    const frame = document.createElement("div");
    frame.className = "piui-card";

    const h = document.createElement("h2");
    h.className = "piui-card__title";
    h.textContent = "🔒 Sesi Kerja Terkunci (Idle Timeout Guard)";

    const sub = document.createElement("p");
    sub.className = "piui-page-subtitle";
    sub.textContent = "Masukkan PIN Otorisasi Admin (ketik: 2026) untuk membuka kembali ruang kerja tanpa kehilangan data form.";

    const pinInput = document.createElement("input");
    pinInput.type = "password";
    pinInput.required = true;
    lockDlg.addEventListener("cancel", event=>event.preventDefault());
    pinInput.className = "piui-input text-mono";
    pinInput.placeholder = "Ketik PIN: 2026";
    pinInput.setAttribute("aria-label", "PIN Pembuka Kunci Layar");

    const unlockBtn = document.createElement("button");
    unlockBtn.type = "button";
    unlockBtn.className = "piui-btn piui-btn--primary";
    unlockBtn.textContent = "Buka Kunci Sesi";

    const handleUnlock = () => {
      if (pinInput.value.trim() === "2026") {
        pinInput.value = "";
        lockDlg.close();
        showToast("Demonstrasi kunci layar ditutup.");
      } else {
        showToast("PIN tidak cocok. Gunakan PIN demo: 2026");
      }
    };

    unlockBtn.addEventListener("click", handleUnlock);
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUnlock();
    });

    frame.appendChild(h);
    frame.appendChild(sub);
    frame.appendChild(pinInput);
    frame.appendChild(unlockBtn);
    lockDlg.appendChild(frame);
    document.body.appendChild(lockDlg);
  }

  // 9. Buat Modal Cheat-Sheet Pintasan Keyboard (<dialog id="piui-shortcuts-modal">)
  if (!document.getElementById("piui-shortcuts-modal")) {
    const shortDlg = document.createElement("dialog");
    shortDlg.id = "piui-shortcuts-modal";
    shortDlg.className = "piui-dialog";
    shortDlg.setAttribute("aria-label", "Daftar Pintasan Keyboard");

    const sHead = document.createElement("div");
    sHead.className = "piui-dialog__header";
    const sTitle = document.createElement("strong");
    sTitle.textContent = "⌨️ Cheat-Sheet Pintasan Keyboard Power-User";
    const sClose = document.createElement("button");
    sClose.type = "button";
    sClose.className = "piui-icon-btn";
    sClose.setAttribute("aria-label", "Tutup daftar pintasan");
    sClose.appendChild(createSpriteIcon("icon-close", 18));
    sClose.addEventListener("click", () => requestDialogDismiss(shortDlg));
    sHead.appendChild(sTitle);
    sHead.appendChild(sClose);

    const sBody = document.createElement("div");
    sBody.className = "piui-dialog__body";
    const sList = document.createElement("ul");
    sList.className = "piui-notif-list";

    [
      { key: "Ctrl + K", desc: "Buka Command Palette & Pencarian Global" },
      { key: "?", desc: "Buka Modal Daftar Pintasan Keyboard Ini" },
      { key: "ArrowLeft / ArrowRight", desc: "Navigasi Media Sebelumnya / Berikutnya di Lightbox" },
      { key: "Escape", desc: "Tutup dialog, pratinjau media, atau daftar pilihan" },
      { key: "Ctrl + P", desc: "Cetak Laporan Eksekutif Resmi (Mode PDF Bersih)" }
    ].forEach((sc) => {
      const li = document.createElement("li");
      li.className = "piui-notif-item";
      const row = document.createElement("div");
      row.className = "piui-notif-item__header";
      const d = document.createElement("strong");
      d.textContent = sc.desc;
      const k = document.createElement("kbd");
      k.className = "piui-cmd-trigger__kbd text-mono";
      k.textContent = sc.key;
      row.appendChild(d);
      row.appendChild(k);
      li.appendChild(row);
      sList.appendChild(li);
    });

    sBody.appendChild(sList);
    shortDlg.appendChild(sHead);
    shortDlg.appendChild(sBody);
    document.body.appendChild(shortDlg);
  }

  // Pintasan Global '?' untuk membuka Cheat-Sheet Keyboard
  window.addEventListener("keydown", (e) => {
    const tag = (e.target instanceof Element ? e.target.tagName : "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      triggerShortcutsModal();
    }
  });
}

/* =========================================================================
   10. THEMEFOREST-STYLE UI KIT SHOWCASE FILTER & 1-CLICK HTML SNIPPET COPY
   ========================================================================= */
function initUiKitShowcase() {
  const filterBtns = document.querySelectorAll("[data-uikit-filter]");
  const sections = document.querySelectorAll("[data-uikit-section]");

  if (filterBtns.length > 0 && sections.length > 0) {
    filterBtns.forEach((btn) => {
      if(boundShowcases.has(btn))return;boundShowcases.add(btn);
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-uikit-filter") || "all";
        filterBtns.forEach((b) => {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        sections.forEach((sec) => {
          const secCat = sec.getAttribute("data-uikit-section");
          const show = cat === "all" || secCat === cat;
          if (sec instanceof HTMLElement) {
            sec.hidden = !show;
          }
        });
        showToast(
          cat === "all"
            ? "Menampilkan seluruh kategori komponen UI Kit."
            : `Menyaring komponen kategori: ${btn.textContent}`
        );
      });
    });
  }

  const copyBtns = document.querySelectorAll("[data-copy-target]");
  copyBtns.forEach((btn) => {
    if(boundShowcases.has(btn))return;boundShowcases.add(btn);
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target") || "";
      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;
      const snippet = codeEl.textContent || "";
      try {
        await copyText(snippet);
        const orig = btn.textContent;
        btn.textContent = "Tersalin ✓";
        showToast("Snippet kode HTML komponen berhasil disalin ke clipboard!");
        window.setTimeout(() => {
          btn.textContent = orig;
        }, 1600);
      } catch {
        showToast("Snippet kode HTML siap disalin.");
      }
    });
  });
}

/* =========================================================================
   11. HALAMAN LENGKAP PUSAT NOTIFIKASI (/app/notifications/index.html)
   ========================================================================= */
export function initEnterpriseSuite() {

  initPermissionTreeViews();
  initSecretBoxes();
  initEnterpriseGuardsAndUtilities();
  initUiKitShowcase();
}
