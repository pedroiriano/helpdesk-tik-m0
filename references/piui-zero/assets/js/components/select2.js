/**
 * @fileoverview PIUI Zero — Select2-Style Searchable Combobox Progressive Enhancer
 * Mengubah setiap <select class="piui-select"> menjadi komponen combobox dengan pencarian instan,
 * navigasi keyboard (Panah Atas/Bawah, Enter, Escape), indikator centang, dan tombol reset cepat.
 */

import { bindPopup, hidePopup } from "./popup-layer.js";
import { iconHref } from '../core/environment.js';

const SVG_NS = "http://www.w3.org/2000/svg";
let nextSelectId = 0;

export function initSelect2Comboboxes(root = document) {
  const selects = [...root.querySelectorAll("select.piui-select:not([data-select2-upgraded])")];
  if (root.matches?.("select.piui-select:not([data-select2-upgraded])")) selects.unshift(root);
  if (selects.length === 0) return;

  for (const selectEl of selects) {
    if (selectEl instanceof HTMLSelectElement && !selectEl.multiple) {
      upgradeSingleSelect(selectEl);
    }
  }

}

/**
 * @param {HTMLSelectElement} selectEl
 */
function upgradeSingleSelect(selectEl) {
  const key = `piui-select-${++nextSelectId}`;
  selectEl.setAttribute("data-select2-upgraded", "true");

  const wrapper = document.createElement("div");
  wrapper.className = "piui-select2";
  wrapper.setAttribute("data-piui-component", "searchable-select");
  wrapper.setAttribute("data-open", "false");

  const parent = selectEl.parentNode;
  if (!parent) return;
  parent.insertBefore(wrapper, selectEl);
  selectEl.classList.add("sr-only");
  selectEl.tabIndex = -1;
  selectEl.setAttribute("aria-hidden", "true");
  wrapper.appendChild(selectEl);

  // Trigger Button
  const triggerBtn = document.createElement("button");
  triggerBtn.type = "button";
  triggerBtn.className = "piui-select2__trigger";
  triggerBtn.setAttribute("aria-haspopup", "listbox");
  triggerBtn.setAttribute("aria-expanded", "false");

  const valueSpan = document.createElement("span");
  valueSpan.className = "piui-select2__value";
  valueSpan.id = `${key}-value`;

  const iconsBox = document.createElement("span");
  iconsBox.className = "piui-select2__icons";

  const clearBadge = document.createElement("button");
  clearBadge.type = "button";
  clearBadge.className = "piui-select2__clear";
  clearBadge.textContent = "×";
  clearBadge.title = "Kembalikan ke pilihan awal";
  clearBadge.hidden = true;

  const chevronSvg = document.createElementNS(SVG_NS, "svg");
  chevronSvg.setAttribute("width", "14");
  chevronSvg.setAttribute("height", "14");
  chevronSvg.setAttribute("aria-hidden", "true");
  const useEl = document.createElementNS(SVG_NS, "use");
  useEl.setAttribute("href", iconHref("icon-chevron-down"));
  chevronSvg.appendChild(useEl);

  iconsBox.appendChild(chevronSvg);
  triggerBtn.appendChild(valueSpan);
  triggerBtn.appendChild(iconsBox);

  // Dropdown Panel
  const dropdown = document.createElement("div");
  dropdown.className = "piui-select2__dropdown";
  dropdown.hidden = true;

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "piui-select2__search";
  searchInput.placeholder = "Ketik untuk menyaring pilihan...";
  searchInput.setAttribute("aria-label", "Saring daftar pilihan");
  searchInput.autocomplete = "off";
  searchInput.setAttribute("role", "combobox");
  searchInput.setAttribute("aria-autocomplete", "list");
  searchInput.setAttribute("aria-expanded", "false");

  const listEl = document.createElement("ul");
  listEl.className = "piui-select2__list";
  listEl.id = `${key}-options`;
  listEl.setAttribute("role", "listbox");
  triggerBtn.setAttribute("aria-controls", listEl.id);
  searchInput.setAttribute("aria-controls", listEl.id);

  dropdown.appendChild(searchInput);
  dropdown.appendChild(listEl);

  const control = document.createElement("div");
  control.className = "piui-select2__control";
  control.append(triggerBtn, clearBadge);
  wrapper.appendChild(control);
  wrapper.appendChild(dropdown);

  const popup = bindPopup({ panel: dropdown, trigger: triggerBtn, onChange: (open) => {
    wrapper.setAttribute("data-open", String(open));
    searchInput.setAttribute("aria-expanded", String(open));
    if (!open) searchInput.removeAttribute("aria-activedescendant");
  } });

  let activeIdx = 0;

  const syncFromSelect = () => {
    const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
    valueSpan.textContent = selectedOpt ? selectedOpt.textContent || "" : "Pilih opsi...";
    clearBadge.hidden = selectEl.selectedIndex <= 0 || selectEl.required;
    const label = Array.from(selectEl.labels).map((item) => item.textContent.trim()).join(" ") || selectEl.getAttribute("aria-label") || "Pilihan";
    triggerBtn.setAttribute("aria-label", label);
    triggerBtn.setAttribute("aria-describedby", [valueSpan.id, selectEl.getAttribute("aria-describedby")].filter(Boolean).join(" "));
    clearBadge.setAttribute("aria-label", `Atur ulang ${label}`);
    searchInput.setAttribute("aria-label", `Saring ${label}`);
    listEl.setAttribute("aria-label", label);
    triggerBtn.disabled = selectEl.disabled;
    clearBadge.disabled = selectEl.disabled;
    searchInput.setAttribute("aria-required", String(selectEl.required));
    triggerBtn.setAttribute("aria-invalid", String(!selectEl.validity.valid));
    if (selectEl.disabled) closeDropdown(wrapper);
  };

  const renderOptions = (filterText = "") => {
    const q = filterText.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    const allOptions = Array.from(selectEl.options).filter((opt) => !opt.disabled && !opt.parentElement?.disabled);
    const matching = allOptions.filter((opt) => (opt.textContent || "").toLowerCase().includes(q));

    if (matching.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "piui-select2__option";
      emptyLi.textContent = "Tidak ditemukan pilihan yang cocok";
      frag.appendChild(emptyLi);
    } else {
      matching.forEach((opt, idx) => {
        const li = document.createElement("li");
        li.className = "piui-select2__option";
        if (idx === activeIdx) li.classList.add("is-active");
        li.setAttribute("role", "option");
        li.id = `${key}-option-${idx}`;
        const isSelected = opt.value === selectEl.value;
        li.setAttribute("aria-selected", String(isSelected));

        const textSpan = document.createElement("span");
        textSpan.textContent = opt.textContent || "";

        const checkSpan = document.createElement("span");
        checkSpan.textContent = isSelected ? "✓" : "";

        li.appendChild(textSpan);
        li.appendChild(checkSpan);

        li.addEventListener("click", (e) => {
          e.stopPropagation();
          selectOption(opt.value);
        });

        frag.appendChild(li);
      });
    }

    listEl.replaceChildren(frag);
    if (matching[activeIdx]) {
      searchInput.setAttribute("aria-activedescendant", `${key}-option-${activeIdx}`);
      listEl.children[activeIdx]?.scrollIntoView({ block: "nearest" });
    } else searchInput.removeAttribute("aria-activedescendant");
  };

  const selectOption = (val) => {
    if (selectEl.disabled) return;
    selectEl.value = val;
    syncFromSelect();
    closeDropdown(wrapper);
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    triggerBtn.focus();
  };

  const openDropdown = () => {
    if (selectEl.disabled) return;
    popup.show();
    searchInput.value = "";
    activeIdx = Math.max(0, Array.from(selectEl.options).filter((opt) => !opt.disabled && !opt.parentElement?.disabled).findIndex((opt) => opt.selected));
    renderOptions("");
    searchInput.focus();
  };

  triggerBtn.addEventListener("click", (e) => {
    e.preventDefault(); // The shared controller opens with an explicit native anchor.
    e.stopPropagation();
    const isOpen = wrapper.getAttribute("data-open") === "true";
    if (isOpen) {
      closeDropdown(wrapper);
    } else {
      openDropdown();
    }
  });

  clearBadge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectEl.options.length > 0) {
      const option = Array.from(selectEl.options).find((opt) => !opt.disabled && !opt.parentElement?.disabled);
      if (option) selectOption(option.value);
    }
  });

  searchInput.addEventListener("input", () => {
    activeIdx = 0;
    renderOptions(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    const q = searchInput.value.trim().toLowerCase();
    const matching = Array.from(selectEl.options).filter((opt) => !opt.disabled && !opt.parentElement?.disabled).filter((opt) =>
      (opt.textContent || "").toLowerCase().includes(q)
    );
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (matching.length > 0) {
        activeIdx = (activeIdx + 1) % matching.length;
        renderOptions(searchInput.value);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (matching.length > 0) {
        activeIdx = (activeIdx - 1 + matching.length) % matching.length;
        renderOptions(searchInput.value);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matching[activeIdx]) {
        selectOption(matching[activeIdx].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown(wrapper);
      triggerBtn.focus();
    } else if (e.key === "Tab") {
      closeDropdown(wrapper);
    }
  });

  selectEl.addEventListener("change", syncFromSelect);
  selectEl.addEventListener("piui:select-sync", syncFromSelect);
  selectEl.addEventListener("focus", () => triggerBtn.focus());
  selectEl.addEventListener("invalid", (event) => { event.preventDefault(); syncFromSelect(); triggerBtn.focus(); });
  selectEl.form?.addEventListener("reset", () => requestAnimationFrame(syncFromSelect));
  triggerBtn.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openDropdown(); }
  });
  const observer = new MutationObserver(syncFromSelect);
  observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "required", "selected"] });

  // Sinkronkan juga ketika tombol reset filter diklik
  const resetBtns = document.querySelectorAll("[data-table-reset], #btn-audit-reset, #btn-empty-reset");
  for (const rBtn of resetBtns) {
    rBtn.addEventListener("click", () => {
      window.requestAnimationFrame(syncFromSelect);
    });
  }

  window.addEventListener("popstate", () => {
    window.requestAnimationFrame(syncFromSelect);
  });

  syncFromSelect();
}

/**
 * @param {Element} wrapper
 */
function closeDropdown(wrapper) {
  wrapper.setAttribute("data-open", "false");
  const trigger = wrapper.querySelector(".piui-select2__trigger");
  const dropdown = /** @type {HTMLElement|null} */ (wrapper.querySelector(".piui-select2__dropdown"));
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (dropdown) hidePopup(dropdown);
  const search = wrapper.querySelector(".piui-select2__search");
  search?.setAttribute("aria-expanded", "false");
  search?.removeAttribute("aria-activedescendant");
}
