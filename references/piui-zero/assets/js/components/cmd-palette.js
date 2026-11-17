import { requestDialogDismiss } from './popup-layer.js';
import { appHref } from '../core/environment.js';
/**
 * Modul Komponen: Global Command Palette (Ctrl+K / Cmd+K) berbasis <dialog> Native
 */

import { announce, showToast } from "../core/session-guard.js";
import { applyTheme } from "./shell.js";
import { replayWowAnimations } from "./wow-motion.js";
import { replayLazyLoadMedia } from "./lazy-media.js";
const triggerLockScreen=()=>import("./enterprise-suite.js").then(m=>{m.initEnterpriseSuite();m.triggerLockScreen();});
const triggerShortcutsModal=()=>import("./enterprise-suite.js").then(m=>{m.initEnterpriseSuite();m.triggerShortcutsModal();});

const COMMAND_ITEMS = [
  {
    id: "cmd-nav-dashboard",
    title: "Buka Beranda Dashboard Utama",
    category: "Menu Utama",
    shortcut: "G D",
    type: "route",
    href: "/app/dashboard/index.html"
  },
  {
    id: "cmd-nav-analytics",
    title: "Buka Analitik & Grafik Kinerja",
    category: "Menu Utama",
    shortcut: "G N",
    type: "route",
    href: "/app/analytics/index.html"
  },
  {
    id: "cmd-nav-notifications",
    title: "Buka Halaman Pusat Notifikasi & Peringatan",
    category: "Menu Utama",
    shortcut: "G B",
    type: "route",
    href: "/app/notifications/index.html"
  },
  {
    id: "cmd-nav-users",
    title: "Buka Data Pengguna & Hak Akses",
    category: "Kelola Data & Media",
    shortcut: "G U",
    type: "route",
    href: "/app/users/index.html"
  },
  {
    id: "cmd-nav-users-detail",
    title: "Buka Detail Pengguna (Profil & Linimasa)",
    category: "Kelola Data & Media",
    shortcut: "G I",
    type: "route",
    href: "/app/users/detail.html"
  },
  {
    id: "cmd-nav-transactions",
    title: "Buka Data Transaksi Keuangan",
    category: "Kelola Data & Media",
    shortcut: "G T",
    type: "route",
    href: "/app/transactions/index.html"
  },
  {
    id: "cmd-nav-gallery",
    title: "Buka Galeri Foto & Video",
    category: "Kelola Data & Media",
    shortcut: "G M",
    type: "route",
    href: "/app/gallery/index.html"
  },
  {
    id: "cmd-nav-components",
    title: "Buka Katalog Komponen (UI Kit Lengkap)",
    category: "Komponen & Tampilan",
    shortcut: "G K",
    type: "route",
    href: "/app/components/index.html"
  },
  {
    id: "cmd-nav-audit",
    title: "Buka Riwayat Aktivitas (Log Audit)",
    category: "Sistem & Keamanan",
    shortcut: "G L",
    type: "route",
    href: "/app/audit/index.html"
  },
  {
    id: "cmd-nav-audit-detail",
    title: "Buka Detail Riwayat Aktivitas (Perbandingan Perubahan)",
    category: "Sistem & Keamanan",
    shortcut: "G F",
    type: "route",
    href: "/app/audit/detail.html"
  },
  {
    id: "cmd-nav-settings",
    title: "Buka Pengaturan Sistem & Keamanan",
    category: "Sistem & Keamanan",
    shortcut: "G S",
    type: "route",
    href: "/app/settings/index.html"
  },
  {
    id: "cmd-nav-status",
    title: "Buka Status Server & Layanan",
    category: "Sistem & Keamanan",
    shortcut: "G H",
    type: "route",
    href: "/status/index.html"
  },
  {
    id: "cmd-nav-portal",
    title: "Buka Panduan & Dokumentasi Sistem",
    category: "Sistem & Keamanan",
    shortcut: "G P",
    type: "route",
    href: "/index.html"
  },
  {
    id: "cmd-nav-login",
    title: "Buka Halaman Masuk Akun Admin (Login)",
    category: "Sistem & Keamanan",
    shortcut: "G A",
    type: "route",
    href: "/auth/login.html"
  },
  {
    id: "cmd-act-theme-dark",
    title: "Aktifkan Tema Gelap (Dark Mode)",
    category: "Preferensi UI",
    shortcut: "T D",
    type: "action",
    action: () => {
      applyTheme("dark", { persist: true, broadcast: true });
      showToast("Tema Gelap diaktifkan melalui Command Palette");
    }
  },
  {
    id: "cmd-act-theme-light",
    title: "Aktifkan Tema Terang (Light Mode)",
    category: "Preferensi UI",
    shortcut: "T L",
    type: "action",
    action: () => {
      applyTheme("light", { persist: true, broadcast: true });
      showToast("Tema Terang diaktifkan melalui Command Palette");
    }
  },
  {
    id: "cmd-act-export-csv",
    title: "Ekspor Ringkasan Eksekutif ke Berkas CSV",
    category: "Tindakan Cepat",
    shortcut: "E C",
    type: "action",
    action: () => {
      const exportBtn = document.getElementById("btn-export-summary");
      if (exportBtn) exportBtn.click();
    }
  },
  {
    id: "cmd-act-wow-replay",
    title: "Putar Ulang Animasi Halus (WOW Scroll-Reveal & Counter)",
    category: "Preferensi UI",
    shortcut: "W A",
    type: "action",
    action: () => {
      replayWowAnimations();
      showToast("Animasi halus WOW Scroll-Reveal & Counter diputar ulang");
    }
  },
  {
    id: "cmd-act-lazy-replay",
    title: "Simulasikan Ulang Lazy-Load Media (Shimmer & Blur-Up)",
    category: "Preferensi UI",
    shortcut: "L M",
    type: "action",
    action: () => {
      replayLazyLoadMedia();
      showToast("Lazy-Load Media (Gambar, Video & Grafik) diputar ulang");
    }
  },
  {
    id: "cmd-act-lock-screen",
    title: "Kunci Layar Sesi Kerja (Idle Timeout Lock Screen)",
    category: "Keamanan Kritis",
    shortcut: "L K",
    type: "action",
    action: () => {
      triggerLockScreen();
    }
  },
  {
    id: "cmd-act-shortcuts",
    title: "Buka Cheat-Sheet Pintasan Keyboard Power-User",
    category: "Preferensi UI",
    shortcut: "?",
    type: "action",
    action: () => {
      triggerShortcutsModal();
    }
  },
  {
    id: "cmd-act-print-pdf",
    title: "Cetak Laporan Eksekutif Resmi / Simpan PDF",
    category: "Tindakan Cepat",
    shortcut: "P R",
    type: "action",
    action: () => {
      window.print();
    }
  },
  {
    id: "cmd-act-lockdown",
    title: "Darurat: Buka Dialog Isolasi Sesi Mencurigakan",
    category: "Keamanan Kritis",
    shortcut: "S L",
    type: "action",
    action: () => {
      const lockdownBtn = document.getElementById("btn-open-lockdown");
      if (lockdownBtn) lockdownBtn.click();
    }
  }
];

export function initCommandPalette() {
  const dialogEl = document.getElementById("piui-cmd-palette");
  const openBtn = document.getElementById("btn-open-cmd");
  const closeBtn = document.getElementById("btn-close-cmd");
  const searchInput = document.getElementById("cmd-search-input");
  const listEl = document.getElementById("cmd-results-list");
  const itemTpl = document.getElementById("tpl-cmd-item");
  const emptyEl = document.getElementById("cmd-empty-state");

  if (!(dialogEl instanceof HTMLDialogElement) || !searchInput || !listEl || !(itemTpl instanceof HTMLTemplateElement)) {
    return;
  }

  const commandItems=COMMAND_ITEMS.filter(item=>document.body.hasAttribute("data-component-catalog")||!/wow|lazy|lock|shortcut|print|emergency/i.test(item.id));
  let filteredItems = [...commandItems];
  let activeIndex = 0;
  let lastTriggerEl = null;

  const renderResults = () => {
    const fragment = document.createDocumentFragment();

    filteredItems.forEach((item, index) => {
      const clone = itemTpl.content.cloneNode(true);
      const li = clone.querySelector("li");
      const titleEl = clone.querySelector("[data-cmd-title]");
      const catEl = clone.querySelector("[data-cmd-category]");
      const kbdEl = clone.querySelector("[data-cmd-shortcut]");

      if (li) {
        li.id = item.id;
        li.setAttribute("aria-selected", String(index === activeIndex));
        li.addEventListener("click", () => executeItem(item));
      }
      if (titleEl) titleEl.textContent = item.title;
      if (catEl) catEl.textContent = item.category;
      if (kbdEl) kbdEl.textContent = item.shortcut;

      fragment.appendChild(clone);
    });

    listEl.replaceChildren(fragment);

    if (emptyEl) {
      emptyEl.hidden = filteredItems.length > 0;
    }

    if (filteredItems[activeIndex]) {
      searchInput.setAttribute("aria-activedescendant", filteredItems[activeIndex].id);
    } else {
      searchInput.removeAttribute("aria-activedescendant");
    }
  };

  const executeItem = (item) => {
    dialogEl.close();
    if (item.type === "route" && item.href) {
      window.location.assign(appHref(item.href));
    } else if (item.type === "action" && typeof item.action === "function") {
      item.action();
    }
  };

  const openPalette = (trigger) => {
    lastTriggerEl = trigger || document.activeElement;
    searchInput.value = "";
    filteredItems = [...commandItems];
    activeIndex = 0;
    renderResults();
    dialogEl.showModal();
    document.body.classList.add("is-modal-open");
    searchInput.focus();
    announce("Palet perintah cepat dibuka. Ketik untuk mencari rute atau perintah.");
  };

  if (openBtn) {
    openBtn.addEventListener("click", () => openPalette(openBtn));
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => requestDialogDismiss(dialogEl));
  }

  dialogEl.addEventListener("close", () => {
    document.body.classList.remove("is-modal-open");
    if (lastTriggerEl && typeof lastTriggerEl.focus === "function") {
      lastTriggerEl.focus();
    }
  });



  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    filteredItems = commandItems.filter(
      (item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
    activeIndex = 0;
    renderResults();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        activeIndex = (activeIndex + 1) % filteredItems.length;
        renderResults();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
        renderResults();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[activeIndex]) {
        executeItem(filteredItems[activeIndex]);
      }
    }
  });

  // Pintasan Global Ctrl+K / Cmd+K
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (dialogEl.open) {
        dialogEl.close();
      } else {
        openPalette(document.activeElement);
      }
    }
  });
}
