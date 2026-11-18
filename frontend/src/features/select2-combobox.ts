interface Select2OptionNode {
  kind: 'option';
  option: HTMLOptionElement;
  label: string;
  value: string;
  disabled: boolean;
  selected: boolean;
  groupLabel: string;
}

interface Select2GroupHeader {
  kind: 'group';
  label: string;
}

type Select2RenderNode = Select2OptionNode | Select2GroupHeader;

const selectProtoValueDesc =
  typeof HTMLSelectElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
    : undefined;
const selectProtoIndexDesc =
  typeof HTMLSelectElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex')
    : undefined;
const optionProtoSelectedDesc =
  typeof HTMLOptionElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype, 'selected')
    : undefined;

const instances = new WeakMap<HTMLSelectElement, Select2ComboBox>();
let bodyObserver: MutationObserver | null = null;
let optionSelectedHooked = false;
let s2Counter = 0;

function hookGlobalOptionSelected(): void {
  if (optionSelectedHooked || !optionProtoSelectedDesc?.get || !optionProtoSelectedDesc?.set) return;
  optionSelectedHooked = true;
  const origGet = optionProtoSelectedDesc.get;
  const origSet = optionProtoSelectedDesc.set;
  Object.defineProperty(HTMLOptionElement.prototype, 'selected', {
    configurable: true,
    get() {
      return origGet.call(this);
    },
    set(next: boolean) {
      origSet.call(this, next);
      const owner = (this as HTMLOptionElement).closest('select');
      if (owner) instances.get(owner)?.scheduleSync();
    },
  });
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function canEnhanceSelect(el: Element): el is HTMLSelectElement {
  if (!(el instanceof HTMLSelectElement)) return false;
  if (el.hasAttribute('data-select2-ignore') || el.classList.contains('hd-s2-native')) return false;
  return !instances.has(el);
}

class Select2ComboBox {
  private readonly select: HTMLSelectElement;
  private readonly wrap: HTMLElement;
  private readonly control: HTMLElement;
  private readonly tagsHost: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly valueHost: HTMLElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly dropdown: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly listbox: HTMLUListElement;

  private isOpen = false;
  private filterText = '';
  private highlightedIndex = -1;
  private visibleOptionItems: Select2OptionNode[] = [];
  private syncQueued = false;
  private suppressFocusForward = false;
  private observer: MutationObserver | null = null;

  constructor(select: HTMLSelectElement) {
    this.select = select;
    const uid = ++s2Counter;

    this.wrap = document.createElement('div');
    this.wrap.className = 'hd-s2';
    this.wrap.dataset.s2Wrap = '1';
    if (select.closest('.hd-dt-control--pagesize')) {
      this.wrap.classList.add('hd-s2--compact');
    }
    if (select.multiple) {
      this.wrap.classList.add('hd-s2--multiple');
    }

    const listId = `hd-s2-list-${uid}`;

    this.control = document.createElement('div');
    this.control.className = 'hd-s2-control';

    this.tagsHost = document.createElement('div');
    this.tagsHost.className = 'hd-s2-tags';
    this.tagsHost.hidden = true;

    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'hd-s2-trigger';
    this.trigger.setAttribute('role', 'combobox');
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.setAttribute('aria-controls', listId);
    const labelText = this.resolveAriaLabel();
    if (labelText) this.trigger.setAttribute('aria-label', labelText);

    this.valueHost = document.createElement('span');
    this.valueHost.className = 'hd-s2-value';
    this.trigger.append(this.valueHost);

    this.clearBtn = document.createElement('button');
    this.clearBtn.type = 'button';
    this.clearBtn.className = 'hd-s2-clear';
    this.clearBtn.setAttribute('aria-label', 'Hapus pilihan');
    this.clearBtn.textContent = '×';
    this.clearBtn.hidden = true;

    const caret = document.createElement('span');
    caret.className = 'hd-s2-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';

    this.control.append(this.tagsHost, this.trigger, this.clearBtn, caret);

    this.dropdown = document.createElement('div');
    this.dropdown.className = 'hd-s2-dropdown';
    this.dropdown.hidden = true;

    const searchWrap = document.createElement('div');
    searchWrap.className = 'hd-s2-search-wrap';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'hd-s2-search';
    this.searchInput.placeholder = 'Ketik untuk mencari…';
    this.searchInput.autocomplete = 'off';
    this.searchInput.setAttribute('aria-label', 'Cari dalam daftar pilihan');
    // Guard against generic field loops (`wrapper.querySelectorAll('input')`) marking the internal search box as required/disabled
    Object.defineProperty(this.searchInput, 'required', { configurable: true, get: () => false, set: () => {} });
    Object.defineProperty(this.searchInput, 'disabled', { configurable: true, get: () => false, set: () => {} });
    searchWrap.append(this.searchInput);

    this.listbox = document.createElement('ul');
    this.listbox.id = listId;
    this.listbox.className = 'hd-s2-list';
    this.listbox.setAttribute('role', 'listbox');
    if (select.multiple) this.listbox.setAttribute('aria-multiselectable', 'true');

    this.dropdown.append(searchWrap, this.listbox);

    const parent = select.parentElement;
    if (parent) {
      parent.insertBefore(this.wrap, select);
    }
    select.classList.add('hd-s2-native');
    select.tabIndex = -1;
    this.wrap.append(select, this.control, this.dropdown);

    this.hookSelectAccessors();
    this.bindEvents();
    this.observeNativeSelect();
    this.syncFromNative();
  }

  private resolveAriaLabel(): string {
    const aria = this.select.getAttribute('aria-label');
    if (aria) return aria;
    if (this.select.id) {
      const safeId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(this.select.id) : this.select.id;
      const lbl = document.querySelector<HTMLLabelElement>(`label[for="${safeId}"]`);
      if (lbl) return normalize(lbl.textContent);
    }
    const parentLabel = this.select.closest('label');
    if (parentLabel) return normalize(parentLabel.textContent);
    return 'Pilih opsi';
  }

  private hookSelectAccessors(): void {
    const self = this;
    if (selectProtoValueDesc?.get && selectProtoValueDesc?.set) {
      Object.defineProperty(this.select, 'value', {
        configurable: true,
        get() {
          return selectProtoValueDesc.get!.call(this);
        },
        set(next: string) {
          selectProtoValueDesc.set!.call(this, next);
          self.scheduleSync();
        },
      });
    }
    if (selectProtoIndexDesc?.get && selectProtoIndexDesc?.set) {
      Object.defineProperty(this.select, 'selectedIndex', {
        configurable: true,
        get() {
          return selectProtoIndexDesc.get!.call(this);
        },
        set(idx: number) {
          selectProtoIndexDesc.set!.call(this, idx);
          self.scheduleSync();
        },
      });
    }
  }

  private bindEvents(): void {
    this.control.addEventListener('click', event => {
      if (this.select.disabled) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('.hd-s2-trigger, .hd-s2-clear, .hd-s2-tag__remove')) return;
      if (this.isOpen) this.close(true);
      else this.open();
    });

    this.trigger.addEventListener('click', () => {
      if (this.select.disabled) return;
      if (this.isOpen) this.close(false);
      else this.open();
    });

    this.trigger.addEventListener('keydown', event => {
      if (this.select.disabled) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!this.isOpen) this.open();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (this.isOpen) this.close(false);
        else this.open();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.open(event.key);
      }
    });

    this.clearBtn.addEventListener('click', event => {
      event.stopPropagation();
      if (this.select.disabled) return;
      if (this.select.multiple) {
        for (const opt of Array.from(this.select.options)) opt.selected = false;
      } else {
        this.select.value = '';
      }
      this.wrap.classList.remove('is-invalid');
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
      this.syncFromNative();
      this.trigger.focus();
    });

    this.searchInput.addEventListener('input', () => {
      this.filterText = normalize(this.searchInput.value).toLowerCase();
      this.highlightedIndex = 0;
      this.renderOptions();
    });

    this.searchInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.moveHighlight(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.moveHighlight(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.highlightedIndex = 0;
        this.updateHighlightClass();
      } else if (event.key === 'End') {
        event.preventDefault();
        this.highlightedIndex = Math.max(0, this.visibleOptionItems.length - 1);
        this.updateHighlightClass();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = this.visibleOptionItems[this.highlightedIndex];
        if (target && !target.disabled) {
          this.chooseOption(target.option);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      } else if (event.key === 'Tab') {
        this.close(false);
      }
    });

    this.dropdown.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.activeElement !== this.searchInput) {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      }
    });

    document.addEventListener('pointerdown', event => {
      if (!this.isOpen) return;
      const target = event.target;
      if (target instanceof Node && !this.wrap.contains(target)) {
        this.close(false);
      }
    });

    this.select.addEventListener('change', () => {
      this.wrap.classList.remove('is-invalid');
      this.syncFromNative();
    });

    this.select.addEventListener('invalid', () => {
      this.wrap.classList.add('is-invalid');
      this.suppressFocusForward = true;
      this.trigger.focus();
      queueMicrotask(() => {
        this.suppressFocusForward = false;
      });
    });

    this.select.addEventListener('focus', () => {
      if (this.suppressFocusForward || this.select.disabled) return;
      this.trigger.focus({ preventScroll: true });
    });

    this.select.form?.addEventListener('reset', () => {
      this.wrap.classList.remove('is-invalid');
      queueMicrotask(() => this.syncFromNative());
    });
  }

  private observeNativeSelect(): void {
    this.observer = new MutationObserver(() => {
      this.scheduleSync();
    });
    this.observer.observe(this.select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'multiple', 'required', 'aria-label', 'class'],
    });
  }

  public scheduleSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      this.syncFromNative();
    });
  }

  public syncFromNative(): void {
    this.wrap.hidden = this.select.hidden;
    this.wrap.classList.toggle('is-disabled', this.select.disabled);
    this.wrap.classList.toggle('hd-s2--multiple', this.select.multiple);
    this.trigger.disabled = this.select.disabled;
    this.trigger.setAttribute('aria-disabled', String(this.select.disabled));
    if (this.select.multiple) this.listbox.setAttribute('aria-multiselectable', 'true');
    else this.listbox.removeAttribute('aria-multiselectable');

    if (this.select.multiple) {
      this.renderMultipleValue();
    } else {
      this.renderSingleValue();
    }

    if (this.isOpen) {
      this.renderOptions();
    }
  }

  private renderSingleValue(): void {
    this.tagsHost.hidden = true;
    this.tagsHost.replaceChildren();
    const selectedOpt = this.select.selectedOptions[0] ?? this.select.options[this.select.selectedIndex];
    const label = selectedOpt ? normalize(selectedOpt.textContent) : '';
    const isBlank = !selectedOpt || selectedOpt.value === '';

    this.valueHost.className = isBlank ? 'hd-s2-value is-placeholder' : 'hd-s2-value';
    this.valueHost.textContent = label || 'Pilih opsi';

    const hasEmptyOption = Array.from(this.select.options).some(o => !o.hidden && o.value === '');
    this.clearBtn.hidden = this.select.disabled || !hasEmptyOption || isBlank;
  }

  private renderMultipleValue(): void {
    const selected = Array.from(this.select.options).filter(o => o.selected && !o.hidden);
    this.tagsHost.replaceChildren();
    this.tagsHost.hidden = selected.length === 0;
    this.valueHost.className = 'hd-s2-value is-placeholder';
    this.valueHost.textContent = selected.length ? '+ Tambah pilihan…' : 'Pilih satu atau lebih opsi…';

    for (const opt of selected) {
      const chip = document.createElement('span');
      chip.className = 'hd-s2-tag';
      const txt = document.createElement('span');
      txt.className = 'hd-s2-tag__text';
      txt.textContent = normalize(opt.textContent);
      chip.append(txt);

      if (!this.select.disabled) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'hd-s2-tag__remove';
        rm.setAttribute('aria-label', `Hapus ${txt.textContent}`);
        rm.textContent = '×';
        rm.addEventListener('click', event => {
          event.stopPropagation();
          opt.selected = false;
          this.select.dispatchEvent(new Event('change', { bubbles: true }));
          this.syncFromNative();
        });
        chip.append(rm);
      }
      this.tagsHost.append(chip);
    }
    this.clearBtn.hidden = this.select.disabled || selected.length === 0;
  }

  private open(initialFilter = ''): void {
    if (this.select.disabled || this.isOpen) return;
    this.isOpen = true;
    this.filterText = initialFilter.toLowerCase();
    this.searchInput.value = initialFilter;

    // Position upward cleanly when near viewport bottom
    const rect = this.wrap.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    this.wrap.classList.toggle('is-dropup', spaceBelow < 270 && spaceAbove > spaceBelow);

    this.wrap.classList.add('is-open');
    this.dropdown.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');

    this.renderOptions(true);
    this.searchInput.focus({ preventScroll: true });
    if (initialFilter) {
      const len = initialFilter.length;
      this.searchInput.setSelectionRange(len, len);
    }
  }

  private close(restoreFocus: boolean): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.filterText = '';
    this.searchInput.value = '';
    this.wrap.classList.remove('is-open', 'is-dropup');
    this.dropdown.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.highlightedIndex = -1;
    if (restoreFocus) {
      this.trigger.focus({ preventScroll: true });
    }
  }

  private collectRenderNodes(): Select2RenderNode[] {
    const out: Select2RenderNode[] = [];
    const query = this.filterText;

    const appendOption = (opt: HTMLOptionElement, groupLabel: string) => {
      if (opt.hidden) return;
      const label = normalize(opt.textContent);
      if (query && !label.toLowerCase().includes(query) && !groupLabel.toLowerCase().includes(query)) {
        return;
      }
      out.push({
        kind: 'option',
        option: opt,
        label,
        value: opt.value,
        disabled: opt.disabled,
        selected: opt.selected,
        groupLabel,
      });
    };

    for (const child of Array.from(this.select.children)) {
      if (child instanceof HTMLOptGroupElement) {
        if (child.hidden) continue;
        const gLabel = normalize(child.label);
        const before = out.length;
        out.push({ kind: 'group', label: gLabel });
        for (const opt of Array.from(child.children)) {
          if (opt instanceof HTMLOptionElement) appendOption(opt, gLabel);
        }
        if (out.length === before + 1) out.pop();
      } else if (child instanceof HTMLOptionElement) {
        appendOption(child, '');
      }
    }
    return out;
  }

  private renderOptions(scrollSelectedIntoView = false): void {
    const nodes = this.collectRenderNodes();
    this.listbox.replaceChildren();
    this.visibleOptionItems = [];

    for (const node of nodes) {
      if (node.kind === 'group') {
        const li = document.createElement('li');
        li.className = 'hd-s2-group';
        li.setAttribute('role', 'presentation');
        li.textContent = node.label;
        this.listbox.append(li);
        continue;
      }

      const optIndex = this.visibleOptionItems.length;
      this.visibleOptionItems.push(node);

      const li = document.createElement('li');
      li.className = 'hd-s2-option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(node.selected));
      li.dataset.s2Idx = String(optIndex);
      if (node.selected) li.classList.add('is-selected');
      if (node.disabled) {
        li.classList.add('is-disabled');
        li.setAttribute('aria-disabled', 'true');
      }

      const txt = document.createElement('span');
      txt.className = 'hd-s2-option__label';
      txt.textContent = node.label;
      li.append(txt);

      if (node.selected) {
        const mark = document.createElement('span');
        mark.className = 'hd-s2-option__check';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '✓';
        li.append(mark);
      }

      li.addEventListener('mouseenter', () => {
        if (!node.disabled) {
          this.highlightedIndex = optIndex;
          this.updateHighlightClass();
        }
      });

      li.addEventListener('mousedown', event => {
        // Prevent search blur race before click triggers selection
        event.preventDefault();
      });

      li.addEventListener('click', () => {
        if (!node.disabled) {
          this.chooseOption(node.option);
        }
      });

      this.listbox.append(li);
    }

    if (!this.visibleOptionItems.length) {
      const empty = document.createElement('li');
      empty.className = 'hd-s2-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'Tidak ada pilihan yang cocok.';
      this.listbox.append(empty);
      this.highlightedIndex = -1;
      return;
    }

    if (scrollSelectedIntoView) {
      const selectedIdx = this.visibleOptionItems.findIndex(o => o.selected && !o.disabled);
      this.highlightedIndex = selectedIdx >= 0 ? selectedIdx : this.visibleOptionItems.findIndex(o => !o.disabled);
    } else if (this.highlightedIndex < 0 || this.highlightedIndex >= this.visibleOptionItems.length) {
      this.highlightedIndex = this.visibleOptionItems.findIndex(o => !o.disabled);
    }
    this.updateHighlightClass();
  }

  private moveHighlight(delta: number): void {
    const count = this.visibleOptionItems.length;
    if (!count) return;
    let cursor = this.highlightedIndex;
    for (let step = 0; step < count; step++) {
      cursor = (cursor + delta + count) % count;
      if (!this.visibleOptionItems[cursor]?.disabled) {
        this.highlightedIndex = cursor;
        this.updateHighlightClass();
        return;
      }
    }
  }

  private updateHighlightClass(): void {
    const optionEls = this.listbox.querySelectorAll<HTMLLIElement>('.hd-s2-option');
    optionEls.forEach(li => {
      const idx = Number(li.dataset.s2Idx ?? '-1');
      const active = idx === this.highlightedIndex;
      li.classList.toggle('is-highlighted', active);
      if (active) li.scrollIntoView({ block: 'nearest' });
    });
  }

  private chooseOption(opt: HTMLOptionElement): void {
    if (this.select.multiple) {
      opt.selected = !opt.selected;
      this.wrap.classList.remove('is-invalid');
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
      this.syncFromNative();
      this.renderOptions();
      this.searchInput.focus({ preventScroll: true });
      return;
    }

    const prev = this.select.value;
    this.select.value = opt.value;
    this.wrap.classList.remove('is-invalid');
    if (prev !== opt.value) {
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.syncFromNative();
    this.close(true);
  }
}

export function enhanceSelect2(select: HTMLSelectElement): void {
  if (!canEnhanceSelect(select)) return;
  hookGlobalOptionSelected();
  instances.set(select, new Select2ComboBox(select));
}

export function initSelect2ComboBoxes(root: ParentNode = document): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  if (canEnhanceSelect(root as Element)) {
    enhanceSelect2(root as HTMLSelectElement);
  } else {
    root.querySelectorAll('select').forEach(el => {
      if (canEnhanceSelect(el)) enhanceSelect2(el);
    });
  }

  if (!bodyObserver && document.body) {
    bodyObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.dataset.s2Wrap) continue;
          if (canEnhanceSelect(node)) {
            enhanceSelect2(node);
          } else {
            node.querySelectorAll('select').forEach(el => {
              if (canEnhanceSelect(el)) enhanceSelect2(el);
            });
          }
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
}
