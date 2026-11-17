import { appHref, iconHref } from '../core/environment.js';
/** Canonical Markdown editor: one template, scoped state, safe DOM preview. */
import { watchEditorDraft } from './drafts.js';
import { copyText } from '../core/clipboard.js';

const instances = new WeakMap();
let template;
let nextId = 0;
const COMMANDS = [
  ["bold", "Tebal", "bold"], ["italic", "Miring", "italic"], ["code", "Kode", "code"],
  ["h3", "Judul H3", "heading"], ["list", "Daftar", "list"], ["quote", "Kutipan", "quote"],
  ["h2","Judul H2","heading"], ["ordered","Nomor","list"], ["checklist","Checklist","list"],
  ["link","Tautan","code"], ["fence","Blok kode","code"]
];
const MODES = new Set(["write", "split", "preview"]);

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function editorTemplate() {
  if (template) return template;
  template = document.createElement("template");
  const heading = createNode("div", "piui-md-heading");
  const identity = createNode("div", "piui-md-identity");
  const emblem = createNode("span", "piui-md-emblem");
  emblem.append(editorIcon("edit"));
  const caption = createNode("div");
  caption.append(createNode("strong", "piui-md-title", "Ruang menulis"), createNode("p", "piui-md-description", "Rapikan ide. Tinjau hasilnya. Siap dibagikan."));
  identity.append(emblem, caption);
  const modes = createNode("div", "piui-md-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Tampilan editor");
  for (const [mode, label, icon] of [["write", "Tulis", "edit"], ["split", "Dua panel", "split"], ["preview", "Pratinjau", "eye"]]) {
    const button = editorButton(label, icon, "piui-md-mode");
    button.setAttribute("data-md-mode", mode);
    button.setAttribute("aria-pressed", "false");
    if (mode === "preview") button.setAttribute("data-md-toggle-preview", "");
    modes.append(button);
  }
  heading.append(identity, modes);
  const toolbar = createNode("div", "piui-md-toolbar");
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "Pemformatan Markdown");
  for (let groupIndex = 0; groupIndex < Math.ceil(COMMANDS.length/3); groupIndex += 1) {
    const formats = createNode("div", "piui-md-format-group");
    formats.setAttribute("role", "group");
    formats.setAttribute("aria-label", groupIndex === 0 ? "Gaya teks" : "Struktur dokumen");
    for (const [command, label, icon] of COMMANDS.slice(groupIndex * 3, groupIndex * 3 + 3)) {
      const button = editorButton(label, icon, "piui-md-tool");
      button.setAttribute("data-md-cmd", command);
      button.title = command === "bold" ? "Tebal (Ctrl/⌘+B)" : command === "italic" ? "Miring (Ctrl/⌘+I)" : label;
      formats.append(button);
    }
    toolbar.append(formats);
  }
  const canvases = createNode("div", "piui-md-canvases");
  const inputPane = createNode("div", "piui-md-pane piui-md-input-pane");
  const sourceHeading = createNode("div", "piui-md-pane-heading");
  sourceHeading.append(createNode("span", "", "Naskah Anda"), createNode("span", "piui-md-pane-note", "Pilih teks untuk memformat"));
  inputPane.append(sourceHeading);
  const previewPane = createNode("div", "piui-md-pane piui-md-preview-pane");
  const previewHeading = createNode("div", "piui-md-pane-heading");
  previewHeading.append(createNode("span", "", "Hasil akhir"), createNode("span", "piui-md-live", "Pratinjau langsung"));
  const preview = createNode("div", "piui-md-preview");
  preview.setAttribute("data-md-preview", "");
  preview.setAttribute("role", "region");
  preview.setAttribute("aria-label", "Pratinjau Markdown");
  preview.tabIndex = 0;
  previewPane.append(previewHeading, preview);
  canvases.append(inputPane, previewPane);
  const footer = createNode("div", "piui-md-statusbar");
  const stats = createNode("span", "tabular-nums");
  stats.setAttribute("data-md-stats", "");
  const summary = createNode("div", "piui-md-summary");
  const reading = createNode("span", "piui-md-reading");
  reading.setAttribute("data-md-reading", "");
  summary.append(stats, reading);
  const actions = createNode("div", "piui-md-actions");
  for (const [action, label] of [["undo","Urungkan"],["redo","Ulangi"],["copy", "Salin Teks"], ["save", "Unduh Draf"]]) {
    const button = editorButton(label, action === "save" ? "download" : "copy", action === "save" ? "piui-md-btn piui-md-btn--primary" : "piui-md-btn");
    button.setAttribute("data-md-action", action);
    actions.append(button);
  }
  const feedback = createNode("span", "piui-md-feedback");
  feedback.setAttribute("data-md-feedback", "");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  footer.append(summary, actions, feedback);
  const guide = createNode("details", "piui-md-guide");
  const guideToggle = createNode("summary", "", "Panduan singkat & pintasan");
  const tips = createNode("div", "piui-md-tips");
  for (const [syntax, meaning] of [["**Teks tebal**", "Ctrl/⌘ + B"], ["_Teks miring_", "Ctrl/⌘ + I"], ["### Judul bagian", "Membuat judul"], ["- Item daftar", "Menyusun daftar"], ["> Catatan penting", "Menandai kutipan"], ["Ctrl/⌘ + Enter", "Buka pratinjau"]]) {
    const tip = createNode("div");
    tip.append(createNode("code", "", syntax), createNode("span", "", meaning));
    tips.append(tip);
  }
  guide.append(guideToggle, tips);
  template.content.append(heading, toolbar, canvases, footer, guide);
  return template;
}

function editorIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", iconHref(`icon-${name}`));
  svg.append(use);
  return svg;
}

function editorButton(label, icon, className) {
  const button = createNode("button", className);
  button.type = "button";
  button.append(editorIcon(icon), createNode("span", "", label));
  return button;
}

/** Pure edit operation, shared by toolbar and regression tests. */
export function formatMarkdownSelection(value, start, end, command) {
  if (!COMMANDS.some(([key]) => key === command)) return { value, start, end };
  const selected = value.slice(start, end) || "teks contoh";
  const markers = { bold: "**", italic: "_", code: "`" };
  const marker = markers[command];
  if (marker && value.slice(Math.max(0, start - marker.length), start) === marker && value.slice(end, end + marker.length) === marker) {
    return { value: value.slice(0, start - marker.length) + selected + value.slice(end + marker.length), start: start - marker.length, end: end - marker.length };
  }
  if (marker && selected.length > marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const plain = selected.slice(marker.length, -marker.length);
    return { value: value.slice(0, start) + plain + value.slice(end), start, end: start + plain.length };
  }
  let replacement;
  let selectionOffset;
  if(command==='link') {replacement=`[${selected}](/index.html)`;selectionOffset=1;}
  else if(command==='fence') {replacement=`\n\`\`\`\n${selected}\n\`\`\`\n`;selectionOffset=5;}
  else if (marker) {
    replacement = `${marker}${selected}${marker}`;
    selectionOffset = marker.length;
  } else {
    const prefix = { h2:'## ', h3: "### ", list: "- ", quote: "> ", ordered:'1. ',checklist:'- [ ] ' }[command];
    const newLine = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    replacement = newLine + selected.split("\n").map((line) => prefix + line).join("\n");
    if (end < value.length && value[end] !== "\n") replacement += "\n";
    selectionOffset = newLine.length + prefix.length;
  }
  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    start: start + selectionOffset,
    end: ['link','fence'].includes(command)?start+selectionOffset+selected.length:start + replacement.length - (marker ? marker.length : 0)
  };
}

export function safeMarkdownUrl(value) {
 if(!value||/[\u0000-\u0020\\]/.test(value)||value.startsWith('//'))return '';
 if(value.startsWith('/')&&!value.startsWith('//'))return value;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
function appendInline(parent, text) {
 const tokens=/(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;let offset=0;
 for(const match of text.matchAll(tokens)) {
  parent.append(document.createTextNode(text.slice(offset,match.index)));const raw=match[0],link=/^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
  if(link){const safe=safeMarkdownUrl(link[2]);if(safe){const a=createNode('a','',link[1]);a.setAttribute('href',appHref(safe));if(!safe.startsWith('/'))a.setAttribute('rel','noopener noreferrer');parent.append(a);}else parent.append(document.createTextNode(raw));}
  else{const tag=raw.startsWith('**')?'strong':raw.startsWith('_')?'em':'code',width=tag==='strong'?2:1;parent.append(createNode(tag,'',raw.slice(width,-width)));}
  offset=match.index+raw.length;
 }parent.append(document.createTextNode(text.slice(offset)));
}
export function renderMarkdownPreview(target,value) {
 const fragment=document.createDocumentFragment();let list=null,listTag='',fenced=false,code=[];
 const flush=()=>{const pre=createNode('pre','piui-code-block');pre.append(createNode('code','',code.join('\n')));fragment.append(pre);code=[];};
 for(const line of String(value).slice(0,200000).split(/\r?\n/)) {
  const text=line.trim();if(/^```/.test(text)){if(fenced)flush();fenced=!fenced;list=null;continue;}if(fenced){code.push(line);continue;}
  if(!text){list=null;continue;}
  const task=/^[-*] \[([ xX])\] (.*)$/.exec(text),unordered=/^[-*] (.*)$/.exec(text),ordered=/^\d+\. (.*)$/.exec(text);
  if(task||unordered||ordered){const tag=ordered?'ol':'ul';if(!list||listTag!==tag){list=createNode(tag);listTag=tag;fragment.append(list);}const item=createNode('li');if(task)item.append(document.createTextNode(task[1].toLowerCase()==='x'?'☑ ':'☐ '));appendInline(item,task?task[2]:ordered?ordered[1]:unordered[1]);list.append(item);continue;}
  list=null;const heading=/^(#{2,4}) (.*)$/.exec(text),tag=heading?`h${heading[1].length}`:text.startsWith('> ')?'blockquote':'p',node=createNode(tag);appendInline(node,heading?heading[2]:tag==='blockquote'?text.slice(2):text);fragment.append(node);
 }
 if(fenced)flush();if(!fragment.childNodes.length)fragment.append(createNode('p','piui-md-empty','Tulis naskah untuk melihat pratinjau.'));target.replaceChildren(fragment);
}

/** Accepts a document, fragment, container, or an individual editor host. */
export function initMarkdownEditors(root = document) {
  const hosts = [...root.querySelectorAll("[data-piui-md-editor]")];
  if (root.matches?.("[data-piui-md-editor]")) hosts.unshift(root);
  for (const host of hosts) {
    if (instances.has(host)) continue;
    const textarea = host.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) continue;
    host.classList.add("piui-md-editor");
    host.setAttribute("data-piui-component", "markdown-editor");
    if (!textarea.id) textarea.id = `piui-md-input-${++nextId}`;
    textarea.classList.add("piui-textarea", "piui-md-textarea");
    // Preserve the original textarea and its value, name, label, validation, and form owner.
    const clone = editorTemplate().content.cloneNode(true);
    const inputPane = clone.querySelector(".piui-md-input-pane");
    const previewPane = clone.querySelector(".piui-md-preview-pane");
    const preview = clone.querySelector("[data-md-preview]");
    const modes = clone.querySelectorAll("[data-md-mode]");
    const stats = clone.querySelector("[data-md-stats]");
    const reading = clone.querySelector("[data-md-reading]");
    const feedback = clone.querySelector("[data-md-feedback]");
    preview.id = `${textarea.id}-preview`;
    modes.forEach((button) => button.setAttribute("aria-controls", `${textarea.id} ${preview.id}`));
    const initialMode = host.getAttribute("data-editor-mode");
    let viewMode = MODES.has(initialMode) ? initialMode : host.getBoundingClientRect().width >= 768 ? "split" : "write";
    host.replaceChildren(clone);
    inputPane.append(textarea);
    if (!textarea.placeholder) textarea.placeholder = "Mulai menulis di sini… Pilih teks, lalu gunakan tombol format di atas.";
    let clipboardPending = false;
    const history=[{value:textarea.value,start:0,end:0}];let historyIndex=0,restoring=false,composing=false,previewFrame;
    textarea.maxLength=textarea.maxLength>0?Math.min(textarea.maxLength,200000):200000;
    const restore=direction=>{const next=historyIndex+direction;if(next<0||next>=history.length)return;historyIndex=next;restoring=true;textarea.value=history[next].value;textarea.setSelectionRange(history[next].start,history[next].end);changed();restoring=false;textarea.focus();};
    const update = () => {
      const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
      stats.textContent = `${words.toLocaleString("id-ID")} kata · ${textarea.value.length.toLocaleString("id-ID")} karakter`;
      reading.textContent = words ? `± ${Math.ceil(words / 200)} menit baca` : "Ide besar dimulai dari satu kalimat.";
      host.setAttribute("data-md-view", viewMode);
      inputPane.hidden = viewMode === "preview";
      textarea.hidden = viewMode === "preview";
      previewPane.hidden = viewMode === "write";
      const disabled = textarea.disabled || textarea.readOnly || viewMode === "preview";
      host.querySelectorAll("[data-md-cmd]").forEach((button) => { button.disabled = disabled; });
      host.querySelectorAll("[data-md-action]").forEach((button) => { button.disabled = textarea.disabled || (clipboardPending && button.getAttribute("data-md-action") === "copy"); });
      modes.forEach((button) => {
        button.disabled = textarea.disabled;
        button.setAttribute("aria-pressed", String(button.getAttribute("data-md-mode") === viewMode));
      });
      if (viewMode !== "write") {cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(()=>renderMarkdownPreview(preview, textarea.value));}
      host.querySelector('[data-md-action="undo"]').disabled=textarea.disabled||textarea.readOnly||historyIndex===0;
      host.querySelector('[data-md-action="redo"]').disabled=textarea.disabled||textarea.readOnly||historyIndex>=history.length-1;
    };
    const setMode = (mode) => { if (MODES.has(mode)) { viewMode = mode; update(); } };
    const changed = () => {
      if(composing)return;
      if(!restoring&&history[historyIndex].value!==textarea.value){history.splice(historyIndex+1);history.push({value:textarea.value,start:textarea.selectionStart,end:textarea.selectionEnd});if(history.length>100)history.shift();historyIndex=history.length-1;}
      feedback.textContent = "";
      update();
      host.dispatchEvent(new CustomEvent("piui:editor-change", {
        bubbles: true, detail: { id: textarea.id, value: textarea.value }
      }));
    };
    host.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button || !host.contains(button) || button.disabled) return;
      const command = button.getAttribute("data-md-cmd");
      if (command && viewMode !== "preview" && !textarea.disabled && !textarea.readOnly) {
        const result = formatMarkdownSelection(textarea.value, textarea.selectionStart, textarea.selectionEnd, command);
        textarea.setRangeText(result.value, 0, textarea.value.length, "preserve");
        textarea.setSelectionRange(result.start, result.end);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
      } else if (button.hasAttribute("data-md-mode")) {
        setMode(button.getAttribute("data-md-mode"));
      } else if (["undo","redo"].includes(button.getAttribute("data-md-action"))) {restore(button.getAttribute("data-md-action")==="undo"?-1:1);
      } else if (button.getAttribute("data-md-action") === "copy" && !clipboardPending) {
        clipboardPending = true;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
          await copyText(textarea.value);
          feedback.textContent = "Teks berhasil disalin.";
        } catch {
          feedback.textContent = "Teks belum disalin. Pilih teks dan gunakan pintasan salin perangkat.";
        } finally {
          clipboardPending = false;
          button.removeAttribute("aria-busy");
          update();
        }
      } else if (button.getAttribute("data-md-action") === "save") {
        const request = new CustomEvent("piui:editor-save", {
          bubbles: true, cancelable: true, detail: { id: textarea.id, value: textarea.value }
        });
        if (!host.dispatchEvent(request)) return;
        const url = URL.createObjectURL(new Blob([textarea.value], { type: "text/markdown;charset=utf-8" }));
        const link = createNode("a");
        link.href = url;
        link.download = `draft-${textarea.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.md`;
        link.hidden = true;
        host.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        feedback.textContent = "Unduhan draf Markdown diminta.";
        host.dispatchEvent(new Event('piui:draft-exported'));
      }
    });
    textarea.addEventListener("input", changed);
    textarea.addEventListener("compositionstart",()=>{composing=true;});textarea.addEventListener("compositionend",()=>{composing=false;changed();});
    textarea.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {event.preventDefault();restore(key==="y"||event.shiftKey?1:-1);}
      else if (key === "enter") { event.preventDefault(); setMode("preview"); preview.focus(); }
      else if ((key === "b" || key === "i") && !textarea.disabled && !textarea.readOnly) {
        event.preventDefault();
        host.querySelector(`[data-md-cmd="${key === "b" ? "bold" : "italic"}"]`).click();
      }
    });
    preview.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMode("write"); textarea.focus(); }
    });
    textarea.addEventListener("invalid", (event) => { event.preventDefault(); setMode("write"); textarea.focus(); });
    textarea.form?.addEventListener("reset", () => requestAnimationFrame(()=>{history.splice(0,history.length,{value:textarea.value,start:0,end:0});historyIndex=0;update();}));
    const observer = new MutationObserver(update);
    observer.observe(textarea, { attributes: true, attributeFilter: ["disabled", "readonly"] });
    const api = {
      getValue: () => textarea.value,
      setValue(value) { const next=String(value);if(next.length>textarea.maxLength)throw new RangeError('Dokumen melebihi batas editor; tidak ada data yang diubah.');textarea.value = next; changed(); },
      setMode,
      focus() { if (viewMode === "preview") setMode("write"); textarea.focus(); }
    };
    instances.set(host, api);
    update();
    queueMicrotask(()=>watchEditorDraft(host,textarea));
  }
}

export function getMarkdownEditor(host) { return instances.get(host); }

/** Programmatic consumer; labels and data are the only per-instance inputs. */
export function createMarkdownEditor({ id, label, value = "", name = "", required = false, readOnly = false, disabled = false, mode } = {}) {
  const field = createNode("div", "piui-field");
  const input = createNode("textarea", "piui-textarea");
  input.id = id || `piui-md-input-${++nextId}`;
  input.name = name;
  input.value = value;
  input.required = required;
  input.readOnly = readOnly;
  input.disabled = disabled;
  const caption = createNode("label", "piui-field__label", label || "Editor Markdown");
  caption.htmlFor = input.id;
  const host = createNode("div", "piui-md-editor");
  host.setAttribute("data-piui-md-editor", "");
  if (MODES.has(mode)) host.setAttribute("data-editor-mode", mode);
  host.append(input);
  field.append(caption, host);
  initMarkdownEditors(field);
  return field;
}
