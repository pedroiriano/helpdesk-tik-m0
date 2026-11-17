import { appHref, iconHref } from '../core/environment.js';
/**
 * @fileoverview PIUI Zero — WAI-ARIA Tabs Controller, Masterpiece Return-Context Breadcrumb, & Right-Drawer Form Handler
 */

import { readUrlState, writeUrlState, onUrlStateChange, safeReturnTo } from "../core/url-state.js";
import { announceStatus } from "../core/session-guard.js";
import { copyText } from '../core/clipboard.js';

const SVG_NS = "http://www.w3.org/2000/svg";

export function initTabsAndDetailViews() {
  initAriaTablists();
  initReturnBreadcrumbs();
  initAutoOpenRightModals();
}

function initAriaTablists() {
  const tablists = document.querySelectorAll('[role="tablist"]');
  if (tablists.length === 0) return;

  for (const tablist of tablists) {
    const tabs = /** @type {HTMLButtonElement[]} */ (Array.from(tablist.querySelectorAll('[role="tab"]')));
    if (tabs.length === 0 || tablist.hasAttribute("data-tabs-bound")) continue;
    tablist.setAttribute("data-tabs-bound", "true");

    const activateTab = (targetTab, focusTab = false, syncUrl = true) => {
      const tabId = targetTab.getAttribute("data-tab-key") || targetTab.id;
      for (const tab of tabs) {
        const isSelected = tab === targetTab;
        tab.setAttribute("aria-selected", String(isSelected));
        tab.setAttribute("tabindex", isSelected ? "0" : "-1");
        const panelId = tab.getAttribute("aria-controls");
        if (panelId) {
          const panel = document.getElementById(panelId);
          if (panel) {
            panel.hidden = !isSelected;
          }
        }
      }
      if (focusTab) {
        targetTab.focus();
      }
      if (syncUrl && tabId) {
        writeUrlState({ tab: tabId });
      }
    };

    for (const [idx, tab] of tabs.entries()) {
      tab.addEventListener("click", () => {
        activateTab(tab, false, true);
        announceStatus(`Tab ${tab.textContent?.trim() || ""} diaktifkan.`);
      });

      tab.addEventListener("keydown", (event) => {
        let nextIdx = idx;
        if (event.key === "ArrowRight") {
          nextIdx = (idx + 1) % tabs.length;
        } else if (event.key === "ArrowLeft") {
          nextIdx = (idx - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIdx = 0;
        } else if (event.key === "End") {
          nextIdx = tabs.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        activateTab(tabs[nextIdx], true, true);
      });
    }

    const syncFromUrl = () => {
      const state = readUrlState();
      const matched = tabs.find(
        (t) => t.getAttribute("data-tab-key") === state.tab || t.id === state.tab
      );
      activateTab(matched || tabs[0], false, false);
    };

    onUrlStateChange(syncFromUrl);
    syncFromUrl();
  }
}

/**
 * Enhances all <nav class="piui-breadcrumb"> with Home Icon, Return-Context Query Preservation,
 * Quick Parent Back Button, and 1-Click Deep-Link Copy
 */
function initReturnBreadcrumbs() {
  const breadcrumbs = document.querySelectorAll("nav.piui-breadcrumb");
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get("returnTo"));
  params.delete("id");
  params.delete("tab");
  params.delete("returnTo");
  const qs = params.toString();

  // 1. Update semua tautan [data-return-breadcrumb] di halaman
  const returnLinks = document.querySelectorAll("a[data-return-breadcrumb]");
  if (qs || returnTo) {
    for (const link of returnLinks) {
      const baseHref = (link.getAttribute("href") || "").split("?")[0];
      link.setAttribute("href", appHref(returnTo || `${baseHref}?${qs}`));
    }
  }

  // 2. Perkaya elemen <nav class="piui-breadcrumb">
  for (const nav of breadcrumbs) {
    const firstLink = nav.querySelector("ol li:first-child a");
    if (firstLink && !firstLink.querySelector("svg")) {
      const homeSvg = document.createElementNS(SVG_NS, "svg");
      homeSvg.setAttribute("width", "14");
      homeSvg.setAttribute("height", "14");
      homeSvg.setAttribute("aria-hidden", "true");
      const useEl = document.createElementNS(SVG_NS, "use");
      useEl.setAttribute("href", iconHref("icon-home"));
      homeSvg.appendChild(useEl);
      firstLink.insertBefore(homeSvg, firstLink.firstChild);
    }

    // Jika ada parameter ?id=... pada halaman detail, tampilkan ID aktual pada item aktif breadcrumb
    const currentItem = nav.querySelector('ol li[aria-current="page"]');

    if (!nav.querySelector(".piui-breadcrumb__tools")) {
      const toolsDiv = document.createElement("div");
      toolsDiv.className = "piui-breadcrumb__tools";

      // Tombol Kembali ke Induk
      const allLinks = nav.querySelectorAll("ol li a");
      const parentLink = allLinks.length > 0 ? allLinks[allLinks.length - 1] : null;
      if (parentLink) {
        const backBtn = document.createElement("a");
        backBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
        backBtn.setAttribute("href", appHref(parentLink.getAttribute("href") || "/app/dashboard/index.html"));
        backBtn.textContent = "‹ Kembali";
        backBtn.title = `Kembali ke ${(parentLink.textContent || "halaman sebelumnya").trim()}`;
        toolsDiv.appendChild(backBtn);
      }

      // Tombol Salin Deep-Link Tautan
      const copyRouteBtn = document.createElement("button");
      copyRouteBtn.type = "button";
      copyRouteBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
      copyRouteBtn.textContent = "Salin Tautan";
      copyRouteBtn.title = "Salin alamat tautan halaman beserta filter aktif ke clipboard";
      copyRouteBtn.addEventListener("click", async () => {
        try {
          await copyText(window.location.href);
          announceStatus("Tautan rute dan state filter berhasil disalin ke clipboard.");
        } catch {
          announceStatus(`Rute aktif: ${window.location.pathname}${window.location.search}`);
        }
      });

      toolsDiv.appendChild(copyRouteBtn);
      nav.appendChild(toolsDiv);
    }
  }
}

/**
 * Open explicitly configured standalone dialogs (for example the prototype login)
 */
function initAutoOpenRightModals() {
  const autoDialogs = document.querySelectorAll("dialog[data-auto-open]");
  for (const dlg of autoDialogs) {
    if (dlg instanceof HTMLDialogElement && !dlg.open) {
      dlg.showModal();
    }
  }
}
