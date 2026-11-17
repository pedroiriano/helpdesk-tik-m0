import { requestDialogDismiss } from './popup-layer.js';
/**
 * Modul Komponen: Adaptive Admin Shell (Sidebar Collapsible Icon-Only Rail, Tema Monokrom Light/Dark, & Right-Drawer Modal Dismiss)
 */

import { announce, broadcastEvent, initSessionGuard, showToast } from "../core/session-guard.js";
import { appHref, iconHref } from '../core/environment.js';

const STORAGE_THEME_KEY = "piui_theme";
const STORAGE_SIDEBAR_KEY = "piui_sidebar_collapsed";

export function applyTheme(theme, { persist = true, broadcast = false } = {}) {
  const validTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", validTheme);

  const themeBtn = document.getElementById("btn-theme-toggle");
  if (themeBtn) {
    const label = validTheme === "dark"
      ? "Mode Monokrom Gelap aktif. Klik untuk beralih ke Mode Monokrom Terang"
      : "Mode Monokrom Terang aktif. Klik untuk beralih ke Mode Monokrom Gelap";
    themeBtn.setAttribute("aria-label", label);
    themeBtn.setAttribute("title", label);
  }

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_THEME_KEY, validTheme);
    } catch {
      /* Abaikan bila storage dikunci */
    }
  }

  if (broadcast) {
    broadcastEvent("THEME_CHANGE", { theme: validTheme });
  }
}

export function initAdaptiveShell() {
  const shellEl = document.querySelector(".piui-app-shell");
  const toggleBtn = document.getElementById("btn-sidebar-toggle");
  const sidebarEl = document.getElementById("piui-sidebar");
  const mobileDrawer = document.getElementById("piui-mobile-drawer");
  const closeDrawerBtn = document.getElementById("btn-close-mobile-drawer");
  const themeBtn = document.getElementById("btn-theme-toggle");
  const logoutBtn = document.getElementById("btn-session-logout");
  const profile = document.getElementById("popover-profile");
  profile?.classList.add('piui-profile-menu');
  const desktopViewport = window.matchMedia("(min-width: 64rem)");
  // Keep IDs and existing listeners on controls moved into the shared menu.
  const timezone = document.getElementById("btn-tz-toggle");
  if (profile && timezone) profile.append(timezone);
  if (profile && themeBtn && !profile.querySelector("[data-menu-theme]")) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "piui-btn piui-btn--secondary";
    action.setAttribute("data-menu-theme", "");
    action.textContent = "Ganti Tema Terang / Gelap";
    action.addEventListener("click", () => themeBtn.click());
    profile.append(action);
  }

  // Pulihkan preferensi Aksen Brand
  let initialAccent = "default";
  try {
    const savedAccent = window.localStorage.getItem(STORAGE_ACCENT_KEY);
    if (savedAccent) initialAccent = savedAccent;
  } catch {
    initialAccent = "default";
  }
  applyAccent(initialAccent, { persist: false });

  if (profile && !profile.querySelector(".piui-accent-picker")) {
    const accentWrap = document.createElement("div");
    accentWrap.className = "piui-field";
    const accentTitle = document.createElement("strong");
    accentTitle.textContent = "Aksen Warna Brand";
    const picker = document.createElement("div");
    picker.className = "piui-accent-picker";
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Pilihan aksen warna brand");

    const accents = [
      { id: "default", name: "Zinc Charcoal", cls: "piui-accent-dot--default" },
      { id: "blue", name: "Sapphire Blue", cls: "piui-accent-dot--blue" },
      { id: "emerald", name: "Emerald Green", cls: "piui-accent-dot--emerald" },
      { id: "violet", name: "Amethyst Violet", cls: "piui-accent-dot--violet" },
      { id: "amber", name: "Amber Gold", cls: "piui-accent-dot--amber" }
    ];

    accents.forEach((acc) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `piui-accent-dot ${acc.cls}`;
      dot.setAttribute("data-accent-choice", acc.id);
      dot.setAttribute("title", acc.name);
      dot.setAttribute("aria-label", acc.name);
      dot.setAttribute("aria-pressed", String(acc.id === initialAccent));
      dot.addEventListener("click", () => applyAccent(acc.id, { persist: true }));
      picker.appendChild(dot);
    });

    accentWrap.appendChild(accentTitle);
    accentWrap.appendChild(picker);
    profile.append(accentWrap);
  }

  // Pintasan Global '?' untuk membuka Bantuan Keyboard
  window.addEventListener("keydown", (e) => {
    const tag = (e.target instanceof Element ? e.target.tagName : "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      triggerShortcutsModal();
    }
  });

  // 1. Pulihkan preferensi Tema Light/Dark
  let initialTheme = "dark";
  try {
    const savedTheme = window.localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      initialTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      initialTheme = "light";
    }
  } catch {
    initialTheme = "dark";
  }
  applyTheme(initialTheme, { persist: false, broadcast: false });

  // 2. Sinkronisasi fungsi Ciutkan/Perluas Sidebar Kiri (Hanya Ikon Saja saat Collapsed)
  const syncSidebarControls = (state) => {
    const isExpanded = state === "expanded";
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", String(isExpanded));
      toggleBtn.setAttribute(
        "title",
        isExpanded ? "Kecilkan sidebar menjadi ikon saja" : "Perluas sidebar"
      );
    }
    const collapseBtns = document.querySelectorAll("[data-sidebar-collapse-btn]");
    for (const btn of collapseBtns) {
      btn.setAttribute("aria-expanded", String(isExpanded));
      btn.setAttribute(
        "title",
        isExpanded ? "Kecilkan menu menjadi ikon saja" : "Perluas menu navigasi"
      );
      const labelSpan = btn.querySelector(".piui-sidebar__collapse-label");
      if (labelSpan) {
        labelSpan.textContent = isExpanded ? "Kecilkan Menu" : "Perluas";
      }
    }
  };

  if (shellEl) {
    try {
      const savedCollapsed = window.localStorage.getItem(STORAGE_SIDEBAR_KEY);
      const initialState = savedCollapsed === "true" || !desktopViewport.matches ? "collapsed" : "expanded";
      shellEl.setAttribute("data-sidebar", initialState);
      syncSidebarControls(initialState);
    } catch {
      shellEl.setAttribute("data-sidebar", desktopViewport.matches ? "expanded" : "collapsed");
      syncSidebarControls(shellEl.getAttribute("data-sidebar"));
    }
  }

  desktopViewport.addEventListener("change", () => {
    if (!shellEl) return;
    let collapsed = false;
    try { collapsed = window.localStorage.getItem(STORAGE_SIDEBAR_KEY) === "true"; } catch { /* Optional preference. */ }
    const state = desktopViewport.matches && !collapsed ? "expanded" : "collapsed";
    shellEl.setAttribute("data-sidebar", state);
    syncSidebarControls(state);
    if (desktopViewport.matches && mobileDrawer instanceof HTMLDialogElement && mobileDrawer.open) mobileDrawer.close();
  });

  const toggleDesktopSidebar = () => {
    if (!shellEl) return;
    const isCollapsed = shellEl.getAttribute("data-sidebar") === "collapsed";
    const nextState = isCollapsed ? "expanded" : "collapsed";
    shellEl.setAttribute("data-sidebar", nextState);
    syncSidebarControls(nextState);
    try {
      window.localStorage.setItem(STORAGE_SIDEBAR_KEY, String(nextState === "collapsed"));
    } catch {
      /* Abaikan */
    }
    showToast(
      nextState === "collapsed"
        ? "Sidebar dikecilkan (Mode Ikon Saja)"
        : "Sidebar diperluas"
    );
  };

  // 3. Tombol Sidebar Toggle di Topbar & di Kaki Sidebar
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isMobile = !desktopViewport.matches;
      if (isMobile && mobileDrawer instanceof HTMLDialogElement) {
        mobileDrawer.showModal();
        document.body.classList.add("is-modal-open");
        toggleBtn.setAttribute("aria-expanded", "true");
        announce("Menu navigasi utama dibuka");
      } else {
        toggleDesktopSidebar();
      }
    });
  }

  // Tambahkan tombol Kecilkan Menu di bagian bawah Sidebar jika belum ada
  if (sidebarEl && !sidebarEl.querySelector("[data-sidebar-collapse-btn]")) {
    const footerDiv = document.createElement("div");
    footerDiv.className = "piui-sidebar__footer";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "piui-sidebar__collapse-btn";
    collapseBtn.setAttribute("data-sidebar-collapse-btn", "");
    collapseBtn.setAttribute("aria-label", "Kecilkan atau perluas sidebar navigasi kiri");

    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = document.createElementNS(svgNS, "svg");
    svgEl.setAttribute("width", "18");
    svgEl.setAttribute("height", "18");
    svgEl.setAttribute("aria-hidden", "true");
    const useEl = document.createElementNS(svgNS, "use");
    useEl.setAttribute("href", iconHref("icon-sidebar-collapse"));
    svgEl.appendChild(useEl);

    const textSpan = document.createElement("span");
    textSpan.className = "piui-sidebar__collapse-label";
    textSpan.textContent = "Kecilkan Menu";

    collapseBtn.appendChild(svgEl);
    collapseBtn.appendChild(textSpan);
    footerDiv.appendChild(collapseBtn);
    sidebarEl.appendChild(footerDiv);

    const currentState = shellEl?.getAttribute("data-sidebar") || "expanded";
    syncSidebarControls(currentState);
  }

  const collapseBtns = document.querySelectorAll("[data-sidebar-collapse-btn]");
  for (const btn of collapseBtns) {
    btn.addEventListener("click", toggleDesktopSidebar);
  }

  if (mobileDrawer instanceof HTMLDialogElement) {
    const handleDrawerClose = () => {
      document.body.classList.remove("is-modal-open");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.focus();
      }
    };

    mobileDrawer.addEventListener("close", handleDrawerClose);

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener("click", () => {
        requestDialogDismiss(mobileDrawer);
      });
    }


  }



  // 4. Sakelar Tema Light / Dark
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next, { persist: true, broadcast: true });
      showToast(next === "dark" ? "Tema Monokrom Abu-abu Tua diaktifkan" : "Tema Monokrom Abu-abu Muda diaktifkan");
    });
  }

  // 5. Tombol Logout dengan BroadcastChannel ke tab lain
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      broadcastEvent("SESSION_LOGOUT");
      window.location.assign(appHref("/auth/login.html?reason=logged_out"));
    });
  }

  initSessionGuard({
    onThemeSync: (syncedTheme) => applyTheme(syncedTheme, { persist: false, broadcast: false })
  });
}
