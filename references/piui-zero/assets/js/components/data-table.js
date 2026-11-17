import { appHref, routeContext } from '../core/environment.js';
/**
 * @fileoverview PIUI Zero — Generic Interactive Data Table, Masterpiece Pagination, Page-Size Selector,
 * Bulk Selection, Sort, PII Masking, & 5-State Controller
 */

import { readUrlState, writeUrlState, onUrlStateChange, matchesDateRange, paginate } from "../core/url-state.js";
import { announceStatus, showToast } from "../core/session-guard.js";
import { tableState, selectionSummary, pageWindow } from '../core/table-state.js';
import { createTableTools } from './table-tools.js';
import { downloadCsv } from '../core/csv.js';
import { copyText } from '../core/clipboard.js';
import { el, field } from '../core/dom.js';
import { createDataState } from './data-state.js';
import { initSelect2Comboboxes } from "./select2.js";
let nextTableStateIndex=0;

export function initDataTables(root=document) {
  enhanceAllResponsiveTables(root);

  const tables = root.querySelectorAll("[data-piui-table]");
  for (const [index,table] of [...tables].entries()) {
    if (table instanceof HTMLTableElement) {
      setupSingleTable(table,index);
    }
  }

  // Pasang juga Masterpiece Pagination pada tabel statis lainnya (selain tabel dashboard yang punya controller sendiri)
  const staticTables = document.querySelectorAll("table.piui-table[data-table-pagination]");
  for (const stTable of staticTables) {
    if (!(stTable instanceof HTMLTableElement)) continue;
    if (stTable.querySelector("#audit-log-tbody") || stTable.querySelector("#chart-data-tbody")) continue;
    setupStaticTablePagination(stTable);
  }

  // Upgrade seluruh select (termasuk pemilih jumlah data pagination) ke Select2
  initSelect2Comboboxes();
}

/**
 * Mengaktifkan fitur Responsif Ganda (Stacked Card View di HP + Sticky Horizontal Scroll di Tablet/Desktop)
 * pada SELURUH tabel (.piui-table) di aplikasi secara otomatis dan reusable.
 */
export function enhanceAllResponsiveTables(root = document) {
  const allTables = [...root.querySelectorAll("table.piui-table")];
  if (root.matches?.("table.piui-table")) allTables.unshift(root);
  allTables.forEach((table) => {
    if (!(table instanceof HTMLTableElement) || table.hasAttribute("data-table-enhanced")) return;
    const scrollWrap = table.closest(".piui-table-scroll");
    const tbody = table.querySelector("tbody");
    if (!scrollWrap || !tbody) return;
    table.setAttribute("data-table-enhanced", "true");
    const headers = [...table.querySelectorAll("thead th")];
    const actionColumns = new Set();
    headers.forEach((header, index) => {
      if (header.getAttribute("data-table-column") === "actions") {
        header.classList.add("piui-table-column--actions");
        actionColumns.add(index);
      }
    });

    const getHeaderLabels = () =>
      Array.from(table.querySelectorAll("thead th")).map((th) =>
        (th.textContent || "")
          .replace(/[↕▲▼]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      );

    const applyCellLabels = () => {
      const labels = getHeaderLabels();
      tbody.querySelectorAll("tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, idx) => {
          if (cell instanceof HTMLElement && labels[idx] && !cell.hasAttribute("data-label")) {
            cell.setAttribute("data-label", labels[idx]);
          }
          if (!(cell instanceof HTMLElement) || cell.colSpan > 1) return;
          const actions = actionColumns.has(idx);
          if (actions) cell.classList.add("piui-table-cell--actions");
          if (cell.querySelector(":scope > .piui-table-actions, :scope > .piui-table-controls")) return;
          if (!cell.querySelector(".piui-btn, .piui-icon-btn, select")) return;
          const controls = document.createElement("div");
          controls.className = actions ? "piui-table-actions" : "piui-table-controls";
          // Move the existing nodes: retain listeners, form values, links and masking.
          controls.append(...cell.childNodes);
          cell.appendChild(controls);
        });
      });
    };

    applyCellLabels();

    // Pantau perubahan baris dinamis (mis. tabel Dashboard, Grafik, atau Notifikasi baru)
    if (typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => applyCellLabels());
      obs.observe(tbody, { childList: true });
    }

    // Sisipkan bar pengalih mode responsif (Otomatis HP/Tablet | Mode Kartu | Tabel Geser) bila belum ada
    if (
      document.body.hasAttribute("data-component-catalog") && scrollWrap.parentNode &&
      !scrollWrap.previousElementSibling?.classList.contains("piui-table-responsive-bar")
    ) {
      const respBar = document.createElement("div");
      respBar.className = "piui-table-responsive-bar";

      const hint = document.createElement("span");
      hint.className = "piui-table-responsive-bar__hint";
      hint.textContent = "📱 Tampilan Tabel Responsif (HP & Tablet):";

      const seg = document.createElement("div");
      seg.className = "piui-segmented";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Pilih mode tampilan tabel responsif");

      const modes = [
        { id: "auto", label: "Otomatis (Kartu di HP)" },
        { id: "cards", label: "Mode Kartu" },
        { id: "scroll", label: "Tabel Geser (Sticky)" }
      ];

      modes.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "piui-segmented__btn";
        b.setAttribute("aria-pressed", String(m.id === "auto"));
        b.textContent = m.label;
        b.addEventListener("click", () => {
          scrollWrap.setAttribute("data-table-view", m.id);
          seg.querySelectorAll("button").forEach((peer, pIdx) => {
            peer.setAttribute("aria-pressed", String(modes[pIdx].id === m.id));
          });
          showToast(`Tampilan tabel diubah ke: ${m.label}`);
        });
        seg.appendChild(b);
      });

      respBar.appendChild(hint);
      respBar.appendChild(seg);
      scrollWrap.parentNode.insertBefore(respBar, scrollWrap);
    }
  });
}

/**
 * @param {HTMLTableElement} table
 */
function setupSingleTable(table) {
  if(table.hasAttribute("data-table-initialized"))return;table.setAttribute("data-table-initialized","");
  const index=nextTableStateIndex++;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const container = table.closest("[data-table-scope], .piui-panel, section") || table.parentElement;
  table.setAttribute('data-table-state-index',String(index));
  const {read:readUrlState,write:writeUrlState}=tableState(table,container,index);
  const updateTools=createTableTools(table,container,{read:readUrlState,write:writeUrlState});
  const dataState=createDataState(container,{reset:()=>writeUrlState({q:"",status:"all",role:"all",priority:"all",from:"",to:"",page:1})});
  const searchInput = /** @type {HTMLInputElement|null} */ (container.querySelector("[data-table-search]"));
  const statusSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('[data-table-status], [data-table-filter="status"]'));
  const roleSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector("[data-table-role]"));
  const resetButtons = container.querySelectorAll("[data-table-reset]");
  const countBadge = container.querySelector("[data-table-count]");

  // 5-State Panels
  const emptyBox = container.querySelector('[data-state-panel="empty"]');
  const loadingBox = container.querySelector('[data-state-panel="loading"]');
  const errorBox = container.querySelector('[data-state-panel="error"]');
  const offlineBox = container.querySelector('[data-state-panel="offline"]');
  const scrollWrap = table.closest(".piui-table-scroll");

  const priority=field("Prioritas",{tag:"select",options:[["all","Semua prioritas"],["high","Penting"],["info","Informasi"]]});
  if(container.querySelector("#notif-page-tbody")){container.querySelector(".piui-filter-bar")?.append(priority.wrap);priority.input.addEventListener("change",()=>writeUrlState({priority:priority.input.value,page:1}));}
  let pageSize = readUrlState().limit || 3; // Default 3 baris per halaman agar multi-page langsung interaktif
  let currentPage = readUrlState().page || 1;

  // Pastikan kontainer pagination tersedia dan berdesain Masterpiece
  let paginationEl = container.querySelector(".piui-pagination");
  if (!paginationEl && scrollWrap && scrollWrap.parentNode) {
    paginationEl = document.createElement("div");
    paginationEl.className = "piui-pagination";
    scrollWrap.parentNode.insertBefore(paginationEl, scrollWrap.nextSibling);
  }

  const controlsHost = document.createElement("div");
  controlsHost.className = "piui-pagination__controls";

  const sizeWrapper = document.createElement("div");
  sizeWrapper.className = "piui-pagination__size";
  const sizeLabel = document.createElement("span");
  sizeLabel.textContent = "Tampilkan:";
  const sizeSelect = document.createElement("select");
  sizeSelect.className = "piui-select";
  sizeSelect.setAttribute("aria-label", "Pilih jumlah baris data yang tampil per halaman");
  for (const optVal of [
    { v: "3", label: "3 Data / Hal" },
    { v: "5", label: "5 Data / Hal" },
    { v: "10", label: "10 Data / Hal" },
    { v: "25", label: "25 Data / Hal" },
    { v: "999", label: "Maksimal 999 baris" }
  ]) {
    const o = document.createElement("option");
    o.value = optVal.v;
    o.textContent = optVal.label;
    if (optVal.v === String(pageSize)) o.selected = true;
    sizeSelect.appendChild(o);
  }
  sizeWrapper.appendChild(sizeLabel);
  sizeWrapper.appendChild(sizeSelect);

  const pagesNav = document.createElement("nav");
  pagesNav.className = "piui-pagination__pages";
  pagesNav.setAttribute("aria-label", "Navigasi halaman tabel");

  const rangeInfoSpan = document.createElement("span");
  rangeInfoSpan.className = "piui-badge tabular-nums";
  rangeInfoSpan.setAttribute("data-status", "info");

  controlsHost.appendChild(rangeInfoSpan);
  controlsHost.appendChild(sizeWrapper);
  controlsHost.appendChild(pagesNav);

  if (paginationEl) {
    // Pertahankan checkbox Select All jika sudah ada di dalam .piui-pagination
    const existingInfo = paginationEl.querySelector(".piui-page-actions");
    const infoBox = document.createElement("div");
    infoBox.className = "piui-pagination__info";
    if (existingInfo) {
      infoBox.appendChild(existingInfo);
    }
    paginationEl.replaceChildren(infoBox, controlsHost);
  }

  const applyFilterAndSort = () => {
    const state = readUrlState();
    pageSize = state.limit || 3;
    currentPage = state.page;
    sizeSelect.value = String(pageSize);
    sizeSelect.dispatchEvent(new Event("piui:select-sync"));
    const query = (state.q || "").toLowerCase().trim();
    priority.input.value=state.priority;priority.input.dispatchEvent(new Event("piui:select-sync"));
    const status = (state.status || "all").toLowerCase();
    const role = (state.role || "all").toLowerCase();

    if (searchInput && searchInput.value !== state.q) {
      searchInput.value = state.q;
    }
    if (statusSelect && statusSelect.value !== state.status) {
      statusSelect.value = state.status;
      statusSelect.dispatchEvent(new Event("piui:select-sync"));
    }
    if (roleSelect && roleSelect.value !== (state.role || "all")) {
      roleSelect.value = state.role || "all";
      roleSelect.dispatchEvent(new Event("piui:select-sync"));
    }

    if (state.sort) {
      sortTableRows(table, tbody, state.sort, state.dir);
    }

    const allRows = Array.from(tbody.querySelectorAll("tr[data-row-id]"));
    const matchedRows = [];

    for (const row of allRows) {
      const text = (row.textContent || "").toLowerCase();
      const rowStatus = (row.getAttribute("data-status") || "").toLowerCase();
      const rowRole = (row.getAttribute("data-role") || "").toLowerCase();

      const matchQuery = !query || text.includes(query);
      const matchStatus = status === "all" || rowStatus === status;
      const matchRole = role === "all" || !rowRole || rowRole === role;

      if (matchQuery && matchStatus && matchRole && (state.priority==="all"||row.getAttribute("data-priority")===state.priority) && matchesDateRange(row.getAttribute("data-row-date"), state)) {
        matchedRows.push(row);
      } else {
        row.hidden = true;
      }
    }

    const page = paginate(matchedRows, {page:currentPage, limit:pageSize});
    const totalMatched = page.total, totalPages = page.totalPages;
    currentPage = page.page;
    const startIdx = page.start, endIdx = page.end;
    if (state.page !== currentPage) writeUrlState({page:currentPage}, {replace:true});

    matchedRows.forEach((row, idx) => {
      row.hidden = !(idx >= startIdx && idx < endIdx);
    });

    if (emptyBox) {
      emptyBox.hidden = totalMatched > 0;
    }
    if (scrollWrap) {
      scrollWrap.hidden = totalMatched === 0;
    }
    if (countBadge) {
      countBadge.textContent =
        totalMatched === 0
          ? "0 baris cocok dengan filter"
          : `Menampilkan ${startIdx + 1}–${endIdx} dari ${totalMatched} entitas (Total: ${allRows.length})`;
    }
    rangeInfoSpan.textContent =
      totalMatched === 0
        ? "0 Data"
        : `Data ${startIdx + 1}–${endIdx} dari ${totalMatched}`;

    renderPaginationButtons(pagesNav, currentPage, totalPages, (nextPage) => {
      currentPage = nextPage;
      writeUrlState({ page: currentPage });
      applyFilterAndSort();
      announceStatus(`Beralih ke halaman ${currentPage} dari ${totalPages}.`);
    });

    updateTools();
    syncSelectionState();
    dataState.set(totalMatched?"populated":"empty");
    // Update return-context links
    const returnLinks = tbody.querySelectorAll("a[data-preserve-return]");
    const currentSearch = window.location.search;
    for (const link of returnLinks) {
      const baseHref = link.getAttribute("data-base-href") || link.getAttribute("href") || "";
      if (!link.hasAttribute("data-base-href")) link.setAttribute("data-base-href", baseHref);
      const target = new URL(appHref(baseHref), location.href);
      // Preserve the destination ID, especially transaction -> audit links.
      target.searchParams.set("returnTo", routeContext());
      link.setAttribute("href", target.href);
    }
  };

  sizeSelect.addEventListener("change", () => {
    pageSize = Number.parseInt(sizeSelect.value, 10) || 5;
    currentPage = 1;
    writeUrlState({ page: 1, limit: pageSize });
    applyFilterAndSort();
    announceStatus(`Jumlah data per halaman diubah ke ${sizeSelect.options[sizeSelect.selectedIndex]?.textContent || pageSize}.`);
  });

  searchInput?.addEventListener("input", () => {
    currentPage = 1;
    writeUrlState({ q: searchInput.value, page: 1 }, {replace:true});
    applyFilterAndSort();
  });

  statusSelect?.addEventListener("change", () => {
    currentPage = 1;
    writeUrlState({ status: statusSelect.value, page: 1 });
    applyFilterAndSort();
    announceStatus(`Filter status diubah ke ${statusSelect.value}.`);
  });

  roleSelect?.addEventListener("change", () => {
    currentPage = 1;
    writeUrlState({ role: roleSelect.value, page: 1 });
    applyFilterAndSort();
    announceStatus(`Filter peran diubah ke ${roleSelect.value}.`);
  });

  for (const btn of resetButtons) {
    btn.addEventListener("click", () => {
      currentPage = 1;
      writeUrlState({ q: "", status: "all", role: "all", sort: "", from:"", to:"", page: 1 });
      if (loadingBox) loadingBox.hidden = true;
      if (errorBox) errorBox.hidden = true;
      if (offlineBox) offlineBox.hidden = true;
      applyFilterAndSort();
      announceStatus("Seluruh filter tabel berhasil direset.");
    });
  }

  // Column Sorting
  const sortButtons = table.querySelectorAll("[data-sort-col]");
  for (const btn of sortButtons) {
    btn.addEventListener("click", () => {
      const colIndex = btn.getAttribute("data-sort-col") || "0";
      const current = readUrlState();
      const nextDir = current.sort === colIndex && current.dir === "asc" ? "desc" : "asc";
      writeUrlState({ sort: colIndex, dir: nextDir });
      applyFilterAndSort();
      announceStatus(`Tabel diurutkan berdasarkan kolom ${btn.textContent?.trim() || colIndex} (${nextDir === "asc" ? "naik" : "turun"}).`);
    });
  }

  // Bulk Selection (Select All + Indeterminate)
  const selectAll = /** @type {HTMLInputElement|null} */ (container.querySelector("[data-select-all]"));
  const rowChecks = ()=>[...tbody.querySelectorAll("[data-row-select]")];
  const bulkBar = container.querySelector("[data-bulk-bar]");
  const selectedCountEl = container.querySelector("[data-selected-count]");
  const clearSelectionBtn = container.querySelector("[data-clear-selection]");

  const syncSelectionState = () => {
    const checks = rowChecks();
    const checkedCount = checks.filter((c) => c.checked).length;
    const visible=checks.filter(c=>!c.closest("tr").hidden),selection=selectionSummary(visible);
    if (selectAll && checks.length > 0) {
      selectAll.checked = selection.checked;
      selectAll.indeterminate = selection.mixed;
    }
    if (bulkBar) {
      bulkBar.hidden = checkedCount === 0;
    }
    if (selectedCountEl) {
      selectedCountEl.textContent = `${checkedCount} (di luar halaman: ${checks.filter(c=>c.checked&&c.closest("tr").hidden).length})`;
    }
  };

  selectAll?.addEventListener("change", () => {
    for (const check of rowChecks()) {
      const row = check.closest("tr");
      if (row && !row.hidden) {
        check.checked = selectAll.checked;
      }
    }
    syncSelectionState();
    announceStatus(selectAll.checked ? "Semua baris aktif dipilih." : "Pilihan baris dibatalkan.");
  });

  tbody.addEventListener("change", event=>{if(event.target.matches("[data-row-select]"))syncSelectionState();});

  clearSelectionBtn?.addEventListener("click", () => {
    for (const check of rowChecks()) {
      check.checked = false;
    }
    syncSelectionState();
    announceStatus("Pilihan baris dibersihkan.");
  });

  tbody.querySelectorAll("[data-pii-toggle]").forEach(button=>{
    button.disabled=true;button.textContent="Tidak tersedia";
    button.title="Prototipe hanya menyediakan nilai tersamar; pembukaan data memerlukan backend berotorisasi.";
  });

  const densityButtons = container.querySelectorAll("[data-density-toggle]");
  let savedDensity;try{savedDensity=localStorage.getItem("piui-table-density");}catch{}
  if (savedDensity === "compact") {
    table.classList.add("piui-table--compact");
  }
  for (const btn of densityButtons) {
    const mode = btn.getAttribute("data-density-toggle");
    btn.setAttribute("aria-pressed", String((savedDensity || "comfortable") === mode));
    btn.addEventListener("click", () => {
      const isCompact = mode === "compact";
      table.classList.toggle("piui-table--compact", isCompact);
      localStorage.setItem("piui-table-density", isCompact ? "compact" : "comfortable");
      for (const peer of densityButtons) {
        peer.setAttribute("aria-pressed", String(peer === btn));
      }
      announceStatus(`Kepadatan tabel diubah ke mode ${isCompact ? "Ringkas (Compact)" : "Nyaman (Comfortable)"}.`);
    });
  }

  // 5-State QA Switcher
  const stateButtons = document.body.hasAttribute("data-component-catalog") ? container.querySelectorAll("[data-state-switch]") : [];
  for (const btn of stateButtons) {
    btn.addEventListener("click", () => {
      const targetState = btn.getAttribute("data-state-switch") || "populated";
      for (const peer of stateButtons) {
        peer.setAttribute("aria-pressed", String(peer === btn));
      }
      if (loadingBox) loadingBox.hidden = targetState !== "loading";
      if (errorBox) errorBox.hidden = targetState !== "error";
      if (offlineBox) offlineBox.hidden = targetState !== "offline";

      if (targetState === "empty") {
        if (emptyBox) emptyBox.hidden = false;
        if (scrollWrap) scrollWrap.hidden = true;
      } else if (targetState === "loading" || targetState === "error") {
        if (emptyBox) emptyBox.hidden = true;
        if (scrollWrap) scrollWrap.hidden = true;
      } else {
        applyFilterAndSort();
      }
      announceStatus(`State komponen tabel dialihkan ke: ${targetState}.`);
    });
  }

  // Explicit data extraction excludes controls and shares formula-safe CSV serialization.
  const exportBtn=container.querySelector('[data-table-export]') || (table.id?document.querySelector(`[data-table-export][data-table-for="${CSS.escape(table.id)}"]`):null);
  const exportScope=field('Cakupan ekspor CSV',{tag:'select',options:[['filtered','Seluruh hasil filter'],['page','Halaman aktif'],['selected','Baris terpilih']]});
  container.querySelector('.piui-filter-bar')?.append(exportScope.wrap);
  exportBtn?.addEventListener('click',()=>{
    const state=readUrlState(),all=[...tbody.querySelectorAll('tr[data-row-id]')];
    const rows=all.filter(row=>exportScope.input.value==='selected'?row.querySelector('[data-row-select]:checked'):exportScope.input.value==='page'?!row.hidden:(!state.q||row.textContent.toLowerCase().includes(state.q.toLowerCase()))&&(state.status==='all'||row.getAttribute('data-status')===state.status)&&(state.role==='all'||row.getAttribute('data-role')===state.role)&&(state.priority==='all'||row.getAttribute('data-priority')===state.priority)&&matchesDateRange(row.getAttribute('data-row-date'),state));
    const indexes=[...table.querySelectorAll('thead th')].map((th,i)=>({th,i})).filter(({th})=>th.getAttribute('data-table-column')!=='actions');
    const text=node=>{const clone=node.cloneNode(true);clone.querySelectorAll('button,input,select,textarea').forEach(n=>n.remove());return clone.textContent.replace(/\s+/g,' ').trim();};
    downloadCsv('piui-export.csv',[indexes.map(({th})=>text(th)),...rows.map(row=>indexes.map(({i})=>text(row.children[i])))]);showToast(`${rows.length} baris diekspor (${exportScope.input.options[exportScope.input.selectedIndex].textContent}).`);
  });

  if (exportBtn && exportBtn.parentElement && !exportBtn.parentElement.querySelector('[data-table-export-json]')) {
    const jsonBtn = document.createElement('button');
    jsonBtn.type = 'button';
    jsonBtn.className = 'piui-btn piui-btn--secondary piui-btn--sm';
    jsonBtn.setAttribute('data-table-export-json', '');
    jsonBtn.textContent = 'Salin JSON';
    jsonBtn.addEventListener('click', async () => {
      const state=readUrlState(),all=[...tbody.querySelectorAll('tr[data-row-id]')];
      const rows=all.filter(row=>exportScope.input.value==='selected'?row.querySelector('[data-row-select]:checked'):exportScope.input.value==='page'?!row.hidden:(!state.q||row.textContent.toLowerCase().includes(state.q.toLowerCase()))&&(state.status==='all'||row.getAttribute('data-status')===state.status)&&(state.role==='all'||row.getAttribute('data-role')===state.role)&&(state.priority==='all'||row.getAttribute('data-priority')===state.priority)&&matchesDateRange(row.getAttribute('data-row-date'),state));
      const indexes=[...table.querySelectorAll('thead th')].map((th,i)=>({name:th.textContent.trim(),i})).filter(({name})=>name&&name!=='Aksi'&&name!=='Pilih');
      const text=node=>{const clone=node.cloneNode(true);clone.querySelectorAll('button,input,select,textarea').forEach(n=>n.remove());return clone.textContent.replace(/\s+/g,' ').trim();};
      const data = rows.map(row => {
        const item = {};
        for (const {name, i} of indexes) {
          item[name] = text(row.children[i]);
        }
        return item;
      });
      try {
        await copyText(JSON.stringify(data, null, 2));
        showToast(`${rows.length} baris disalin dalam format JSON!`);
      } catch {
        showToast('Gagal menyalin JSON');
      }
    });

    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'piui-btn piui-btn--secondary piui-btn--sm';
    printBtn.setAttribute('data-table-print', '');
    printBtn.textContent = 'Cetak PDF';
    printBtn.addEventListener('click', () => {
      window.print();
    });

    exportBtn.parentElement.append(jsonBtn, printBtn);
  }

  onUrlStateChange((st) => {
    currentPage = st.page || 1;
    applyFilterAndSort();
  });
  document.addEventListener("piui:table-data-change", applyFilterAndSort);
  applyFilterAndSort();
}

/**
 * Pasang Masterpiece Pagination pada tabel statis (seperti Katalog Rute, Matriks RBAC, Status Layanan)
 * @param {HTMLTableElement} table
 */
function setupStaticTablePagination(table) {
  if(table.hasAttribute("data-static-pagination-ready"))return;table.setAttribute("data-static-pagination-ready","");
  const tbody = table.querySelector("tbody");
  const scrollWrap = table.closest(".piui-table-scroll");
  if (!tbody || !scrollWrap || !scrollWrap.parentNode) return;

  let allRows = Array.from(tbody.querySelectorAll("tr"));

  let pageSize = 5;
  let currentPage = 1;

  const paginationEl = document.createElement("div");
  paginationEl.className = "piui-pagination";

  const infoBox = document.createElement("div");
  infoBox.className = "piui-pagination__info";
  const summaryText = document.createElement("span");
  summaryText.className = "tabular-nums";
  infoBox.appendChild(summaryText);

  const controlsHost = document.createElement("div");
  controlsHost.className = "piui-pagination__controls";

  const sizeWrapper = document.createElement("div");
  sizeWrapper.className = "piui-pagination__size";
  const sizeLabel = document.createElement("span");
  sizeLabel.textContent = "Tampilkan:";
  const sizeSelect = document.createElement("select");
  sizeSelect.className = "piui-select";
  sizeSelect.setAttribute("aria-label", "Pilih jumlah baris tabel per halaman");
  for (const optVal of [
    { v: "3", label: "3 Data / Hal" },
    { v: "5", label: "5 Data / Hal" },
    { v: "10", label: "10 Data / Hal" },
    { v: "999", label: "Maksimal 999 baris" }
  ]) {
    const o = document.createElement("option");
    o.value = optVal.v;
    o.textContent = optVal.label;
    if (optVal.v === String(pageSize)) o.selected = true;
    sizeSelect.appendChild(o);
  }
  sizeWrapper.appendChild(sizeLabel);
  sizeWrapper.appendChild(sizeSelect);

  const pagesNav = document.createElement("nav");
  pagesNav.className = "piui-pagination__pages";
  pagesNav.setAttribute("aria-label", "Navigasi halaman");

  controlsHost.appendChild(sizeWrapper);
  controlsHost.appendChild(pagesNav);
  paginationEl.appendChild(infoBox);
  paginationEl.appendChild(controlsHost);

  scrollWrap.parentNode.insertBefore(paginationEl, scrollWrap.nextSibling);

  const updateStaticView = () => {
    allRows = [...tbody.querySelectorAll("tr")];
    const state=readUrlState();pageSize=state.limit || 5;currentPage=state.page;
    sizeSelect.value=String(pageSize);sizeSelect.dispatchEvent(new Event("piui:select-sync"));
    const page=paginate(allRows,{page:currentPage,limit:pageSize});currentPage=page.page;
    allRows.forEach((row,index)=>{row.hidden=index<page.start || index>=page.end;});
    summaryText.textContent=page.total ? `Menampilkan ${page.start+1}–${page.end} dari ${page.total} baris data` : "Belum ada data";
    renderPaginationButtons(pagesNav,page.page,page.totalPages,next=>writeUrlState({page:next}));
  };
  sizeSelect.addEventListener("change",()=>writeUrlState({limit:Number(sizeSelect.value),page:1}));
  onUrlStateChange(updateStaticView);
  new MutationObserver(updateStaticView).observe(tbody,{childList:true});
  updateStaticView();
}

/**
 * Merender tombol-tombol halaman (« ‹ 1 2 3 › ») secara aman tanpa innerHTML
 * @param {HTMLElement} navEl
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {(page: number) => void} onSelectPage
 */
export function renderPaginationButtons(navEl, currentPage, totalPages, onSelectPage) {
  const frag = document.createDocumentFragment();

  const makeBtn = (label, targetPage, disabled, isCurrent = false, ariaLabel = "") => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piui-page-btn";
    btn.textContent = label;
    btn.disabled = disabled;
    if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
    if (isCurrent) btn.setAttribute("aria-current", "page");
    if (!disabled && !isCurrent) {
      btn.addEventListener("click", () => onSelectPage(targetPage));
    }
    return btn;
  };

  frag.appendChild(makeBtn("«", 1, currentPage <= 1, false, "Halaman pertama"));
  frag.appendChild(makeBtn("‹", currentPage - 1, currentPage <= 1, false, "Halaman sebelumnya"));

  let previous=0;
  for (const p of pageWindow(currentPage,totalPages)) {
    if(previous&&p>previous+1)frag.appendChild(el("span","piui-pagination__ellipsis","…"));previous=p;
    frag.appendChild(makeBtn(String(p), p, false, p === currentPage, `Halaman ${p}`));
  }

  frag.appendChild(makeBtn("›", currentPage + 1, currentPage >= totalPages, false, "Halaman berikutnya"));
  frag.appendChild(makeBtn("»", totalPages, currentPage >= totalPages, false, "Halaman terakhir"));

  navEl.replaceChildren(frag);
}

/**
 * @param {HTMLTableElement} table
 * @param {HTMLTableSectionElement} tbody
 * @param {string} colIndexStr
 * @param {'asc' | 'desc'} dir
 */
function sortTableRows(table, tbody, colIndexStr, dir) {
  const colIndex = Number.parseInt(colIndexStr, 10);
  if (Number.isNaN(colIndex)) return;

  const headers = table.querySelectorAll("thead th");
  headers.forEach((th, idx) => {
    if (th.hasAttribute("aria-sort")) {
      th.setAttribute("aria-sort", idx === colIndex ? (dir === "asc" ? "ascending" : "descending") : "none");
    }
  });

  const rows = Array.from(tbody.querySelectorAll("tr[data-row-id]"));
  rows.sort((a, b) => {
    const cellA = (a.children[colIndex]?.textContent || "").trim();
    const cellB = (b.children[colIndex]?.textContent || "").trim();
    const cmp = cellA.localeCompare(cellB, "id", { numeric: true, sensitivity: "base" });
    return dir === "asc" ? cmp : -cmp;
  });

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    fragment.appendChild(row);
  }
  tbody.appendChild(fragment);
}

/**
 * Sets up generic destructive & form right-drawer dialogs
 */
