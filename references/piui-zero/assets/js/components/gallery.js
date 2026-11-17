import { requestDialogDismiss } from './popup-layer.js';
/**
 * @fileoverview PIUI Zero — Masonry Image & Video Gallery, Drag-and-Drop File Dropzone,
 * Size & MIME Type Validator, and Lightbox ("Lighthouse") Preview Modal Controller
 */

import { readUrlState, updateUrlState, onUrlStateChange } from "../core/url-state.js";
import { announceStatus } from "../core/session-guard.js";
import { el,button,field,actionGroup,contentStack } from '../core/dom.js';
import { mediaBudget,MEDIA_LIMITS } from '../core/media-policy.js';
import { createDataState } from './data-state.js';
import { observeLazyMedia } from "./lazy-media.js";
import { observeWowElements } from "./wow-motion.js";

/**
 * Menghasilkan SVG Data URI Monokrom Halus dengan rasio dimensi bervariasi untuk tata letak Masonry
 * @param {string} title
 * @param {string} subtitle
 * @param {number} width
 * @param {number} height
 * @param {string} code
 */
const svgDimensions = new Map();
function createMonochromeSvgDataUri(title, subtitle, width, height, code) {
  const ns="http://www.w3.org/2000/svg", svg=document.createElementNS(ns,"svg");
  for(const [key,value] of Object.entries({width,height,viewBox:`0 0 ${width} ${height}`}))svg.setAttribute(key,String(value));
  const rect=document.createElementNS(ns,"rect");
  for(const [key,value] of Object.entries({width,height,fill:"#27272A",rx:12}))rect.setAttribute(key,String(value));
  svg.append(rect);
  for(const [text,y,size] of [[`${code} • ${width}×${height}`,48,14],[title,height-66,18],[subtitle,height-34,13]]) {
    const label=document.createElementNS(ns,"text");
    for(const [key,value] of Object.entries({x:24,y,fill:"#F4F4F5","font-family":"sans-serif","font-size":size}))label.setAttribute(key,String(value));
    label.textContent=text;svg.append(label);
  }
  const uri=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  svgDimensions.set(uri,{width,height});return uri;
}
async function decodeLocalMedia(file,url) {
  if(!file.type.startsWith("video/")) {
    const image=new Image();image.src=url;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};
  }
  return new Promise((resolve,reject)=>{
    const video=document.createElement("video");video.preload="metadata";
    const finish=(error)=>{clearTimeout(timeout);const size={width:video.videoWidth,height:video.videoHeight};video.removeAttribute("src");video.load();if(error)reject(new Error("Media cannot be decoded"));else resolve(size);};
    const timeout=setTimeout(()=>finish(true),5000);
    video.addEventListener("loadedmetadata",()=>finish(false),{once:true});video.addEventListener("error",()=>finish(true),{once:true});video.src=url;
  });
}

const INITIAL_MEDIA_ITEMS = [
  {
    id: "MED-2026-01",
    title: "Topologi Jaringan Zero-Trust DC-1 Jakarta",
    category: "image",
    categoryLabel: "Gambar Arsitektur",
    mime: "image/svg+xml",
    sizeBytes: 428500,
    dimensions: "640 x 420 px",
    src: createMonochromeSvgDataUri("Topologi Zero-Trust DC-1", "Arsitektur Klaster Utama", 640, 420, "IMG-ARC-01")
  },
  {
    id: "MED-2026-02",
    title: "Rekaman Telemetri Trafik WAF & Mitigasi DDoS",
    category: "video",
    categoryLabel: "Rekaman Video",
    mime: "video/webm",
    sizeBytes: 3840200,
    dimensions: "640 x 360 px (30fps)",
    src: createMonochromeSvgDataUri("Rekaman Telemetri WAF", "Stream Forensik 60 Detik", 640, 360, "VID-WAF-02")
  },
  {
    id: "MED-2026-03",
    title: "Audit Rak Server HSM & Kunci Kriptografi FIDO2",
    category: "image",
    categoryLabel: "Bukti Forensik",
    mime: "image/png",
    sizeBytes: 1290400,
    dimensions: "460 x 620 px (Portrait)",
    src: createMonochromeSvgDataUri("Inspeksi Rak HSM", "Ruang Brankas Kriptografi", 460, 620, "IMG-HSM-03")
  },
  {
    id: "MED-2026-04",
    title: "Visualisasi Rantai Blok Merkle Audit WORM",
    category: "image",
    categoryLabel: "Gambar Arsitektur",
    mime: "image/webp",
    sizeBytes: 612000,
    dimensions: "520 x 520 px (Square)",
    src: createMonochromeSvgDataUri("Rantai Hash SHA-256", "Blok WORM #48.912", 520, 520, "IMG-WRM-04")
  },
  {
    id: "MED-2026-05",
    title: "Simulasi Failover Otomatis DRC Surabaya",
    category: "video",
    categoryLabel: "Rekaman Video",
    mime: "video/mp4",
    sizeBytes: 6420000,
    dimensions: "640 x 380 px (HD)",
    src: createMonochromeSvgDataUri("Rekaman Latihan Failover", "DRC Surabaya < 40ms", 640, 380, "VID-DRC-05")
  },
  {
    id: "MED-2026-06",
    title: "Matriks Kepatuhan Kontras Monokrom WCAG 2.2 AA",
    category: "image",
    categoryLabel: "Bukti Forensik",
    mime: "image/png",
    sizeBytes: 890100,
    dimensions: "480 x 660 px (Portrait)",
    src: createMonochromeSvgDataUri("Audit Kontras WCAG 2.2", "Rasio Kontras >= 7.2:1", 480, 660, "IMG-A11Y-06")
  }
];

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm"
]);

/**
 * @param {number} bytes
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const initialized=new WeakSet();
export function initMediaGallery(root=document) {
  const galleryGrid = root.querySelector("#piui-masonry-grid");
  const cardTpl = document.getElementById("tpl-media-card");
  if (!galleryGrid || !(cardTpl instanceof HTMLTemplateElement)||initialized.has(galleryGrid)) return;initialized.add(galleryGrid);

  const mediaItems = INITIAL_MEDIA_ITEMS.map(item=>({...item}));
  const hashes=new Set(),removed=[];let retainedBytes=0,retainedFiles=0;
  const feedback=createDataState(galleryGrid.parentElement,{reset:()=>updateUrlState({q:"",media:"all",page:1})});
  const undo=button("Batalkan hapus preview",()=>{const item=removed.pop();if(item){mediaItems.unshift(item);renderGallery();}});undo.hidden=true;galleryGrid.before(undo);
  let activeCategory = "all";
  let searchQuery = "";
  let currentLightboxIndex = 0;

  const filterSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("gallery-filter-type"));
  const searchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("gallery-search-input"));
  const maxSizeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("gallery-max-size"));
  const countBadge = document.getElementById("gallery-count-badge");
  const validationTbody = document.getElementById("gallery-validation-tbody");

  // Elemen Lightbox Modal
  const lightboxDialog = /** @type {HTMLDialogElement|null} */ (document.getElementById("piui-lightbox"));
  const lbStage = document.getElementById("lightbox-stage");
  const lbTitle = document.getElementById("lightbox-title");
  const lbMeta = document.getElementById("lightbox-meta");
  const lbCounter = document.getElementById("lightbox-counter");
  const lbPrevBtn = document.getElementById("btn-lightbox-prev");
  const lbNextBtn = document.getElementById("btn-lightbox-next");
  const lbCloseBtn = document.getElementById("btn-lightbox-close");

  const getFilteredItems = () => {
    const q = searchQuery.trim().toLowerCase();
    return mediaItems.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchQ =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.mime.toLowerCase().includes(q)||(item.tags||"").toLowerCase().includes(q)||(item.caption||"").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  };

  const renderGallery = () => {
    const filtered = getFilteredItems();
    const frag = document.createDocumentFragment();

    filtered.forEach((item, index) => {
      const clone = cardTpl.content.cloneNode(true);
      const previewBtn = clone.querySelector("[data-media-preview]");
      const imgEl = clone.querySelector("[data-media-img]");
      const badgeEl = clone.querySelector("[data-media-badge]");
      const titleEl = clone.querySelector("[data-media-title]");
      const metaEl = clone.querySelector("[data-media-meta]");
      const inspectBtn = clone.querySelector("[data-media-open]");

      if (imgEl instanceof HTMLImageElement) {
        imgEl.setAttribute("data-lazy-src", item.src);
        imgEl.alt = item.alt || item.title;
        imgEl.width=svgDimensions.get(item.src)?.width||item.width||640;imgEl.height=svgDimensions.get(item.src)?.height||item.height||480;
      }
      if (badgeEl) {
        badgeEl.textContent = `${item.category === "video" ? "▶ VIDEO" : "GAMBAR"} • ${item.mime.split("/")[1].toUpperCase()}`;
        badgeEl.setAttribute("data-status", item.category === "video" ? "warning" : "info");
      }
      if (titleEl) titleEl.textContent = item.title;
      if (metaEl) {
        metaEl.textContent = `${item.id} • ${item.dimensions} • ${formatFileSize(item.sizeBytes)}`;
      }

      const openInLightbox = () => openLightboxAt(index);
      previewBtn?.addEventListener("click", openInLightbox);
      inspectBtn?.addEventListener("click", openInLightbox);

      const card=clone.querySelector('article')||clone.firstElementChild;
      if(card){const meta=el('details','piui-media-card__metadata'),summary=el('summary','','Metadata media (lokal)'),fields=contentStack();meta.append(summary,fields);
        for(const [key,label] of [['alt','Teks alternatif'],['caption','Caption'],['tags','Tag']]){const f=field(label,{value:item[key]||(key==='alt'?item.title:''),name:key});f.input.maxLength=200;f.input.addEventListener('input',()=>{item[key]=f.input.value;if(key==='alt'&&imgEl)imgEl.alt=item.alt;});fields.append(f.wrap);}
        if(item.id.startsWith('UPL-'))fields.append(actionGroup(button('Hapus preview lokal',()=>{mediaItems.splice(mediaItems.indexOf(item),1);removed.push(item);renderGallery();undo.focus();})));(card.querySelector('.piui-media-card__body')||card).append(meta);
      }
      frag.appendChild(clone);
    });

    galleryGrid.replaceChildren(frag);undo.hidden=!removed.length;feedback.set(filtered.length?"populated":"empty");
    observeLazyMedia(galleryGrid);
    observeWowElements(galleryGrid);
    if (countBadge) {
      countBadge.textContent = `Menampilkan ${filtered.length} dari ${mediaItems.length} berkas media`;
    }
  };

  const openLightboxAt = (index) => {
    const filtered = getFilteredItems();
    if (!lightboxDialog || !lbStage || filtered.length === 0) return;

    currentLightboxIndex = (index + filtered.length) % filtered.length;
    const item = filtered[currentLightboxIndex];

    const stageFrag = document.createDocumentFragment();
    if (item.category === "video" && item.isBlobVideo && item.videoSrc) {
      const videoEl = document.createElement("video");
      videoEl.src = item.videoSrc;
      videoEl.poster = item.src;
      videoEl.controls = true;
      videoEl.autoplay = true;
      stageFrag.appendChild(videoEl);
    } else if (item.category === "video") {
      const info=document.createElement("p");info.className="piui-page-subtitle";info.textContent="Contoh ini hanya menyediakan poster. Berkas video belum tersedia.";stageFrag.append(info);
    } else {
      const imgEl = document.createElement("img");
      imgEl.src = item.src;
      imgEl.alt = item.alt || item.title;
        imgEl.width=svgDimensions.get(item.src)?.width||item.width||640;imgEl.height=svgDimensions.get(item.src)?.height||item.height||480;
      stageFrag.appendChild(imgEl);
    }

    lbStage.replaceChildren(stageFrag);
    if (lbTitle) lbTitle.textContent = `${item.title} (${item.id})`;
    if (lbMeta) {
      lbMeta.textContent = `Tipe: ${item.mime} • Dimensi: ${item.dimensions} • Ukuran: ${formatFileSize(item.sizeBytes)}`;
    }
    if (lbCounter) {
      lbCounter.textContent = `Media ${currentLightboxIndex + 1} dari ${filtered.length}`;
    }

    if (!lightboxDialog.open) {
      lightboxDialog.showModal();
    }
  };

  lbPrevBtn?.addEventListener("click", () => openLightboxAt(currentLightboxIndex - 1));
  lbNextBtn?.addEventListener("click", () => openLightboxAt(currentLightboxIndex + 1));
  lightboxDialog?.addEventListener("close",()=>{lbStage?.querySelectorAll("video").forEach(video=>video.pause());lbStage?.replaceChildren();});
  window.addEventListener("pagehide",event=>{if(event.persisted)return;[...mediaItems,...removed].forEach(item=>{for(const url of [item.src,item.videoSrc])if(url?.startsWith("blob:"))URL.revokeObjectURL(url);});});

  lbCloseBtn?.addEventListener("click", () => requestDialogDismiss(lightboxDialog));



  window.addEventListener("keydown", (e) => {
    if (!lightboxDialog || !lightboxDialog.open) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      openLightboxAt(currentLightboxIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      openLightboxAt(currentLightboxIndex + 1);
    }
  });

  let renderedFilterKey='';
  const syncGallery=()=>{
    const state=readUrlState();activeCategory=state.media;searchQuery=state.q;
    if(filterSelect){filterSelect.value=state.media;filterSelect.dispatchEvent(new Event("piui:select-sync"));}
    if(searchInput)searchInput.value=state.q;
    if(maxSizeSelect){maxSizeSelect.value=state.maxSize;maxSizeSelect.dispatchEvent(new Event("piui:select-sync"));}
    const filterKey=JSON.stringify([state.media,state.q,state.maxSize,state.from,state.to]);
    if(filterKey!==renderedFilterKey){renderedFilterKey=filterKey;renderGallery();}
  };
  filterSelect?.addEventListener("change",()=>updateUrlState({media:filterSelect.value,page:1}));
  maxSizeSelect?.addEventListener("change",()=>updateUrlState({maxSize:maxSizeSelect.value}));
  searchInput?.addEventListener("input",()=>updateUrlState({q:searchInput.value,page:1},{replace:true}));
  onUrlStateChange(syncGallery);
  // Setup Drag & Drop Dropzone + Validasi Ukuran & Tipe Berkas
  const dropzones = document.querySelectorAll("[data-piui-dropzone]");
  const fileInputs = document.querySelectorAll("input[data-dropzone-input]");

  /**
   * @param {FileList | File[]} files
   */
  const processFilesUpload = async (files) => {
    const maxMb = Number.parseFloat(maxSizeSelect?.value || "10") || 10;
    const maxBytes = maxMb * 1024 * 1024;
    let addedCount = 0;
    if(files.length>MEDIA_LIMITS.batch)announceStatus("Maksimal 20 berkas per batch; berkas setelah urutan 20 tidak diproses.");

    for (const file of Array.from(files).slice(0,MEDIA_LIMITS.batch)) {
      const isAllowedType = ALLOWED_MIME_TYPES.has(file.type);
      const isAllowedSize = file.size <= maxBytes && file.size > 0;
      let isValid = isAllowedType && isAllowedSize;
      let blobUrl="", decoded={},hash="",budgetReason="";
      if(isValid){hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,"0")).join("");if(hashes.has(hash)){isValid=false;budgetReason="Berkas identik sudah dipratinjau pada sesi ini.";}}
      if(isValid) {
        blobUrl=URL.createObjectURL(file);
        try{decoded=await decodeLocalMedia(file,blobUrl);budgetReason=mediaBudget({bytes:retainedBytes+file.size,files:retainedFiles+1,...decoded});if(budgetReason){isValid=false;URL.revokeObjectURL(blobUrl);blobUrl="";}}catch{isValid=false;URL.revokeObjectURL(blobUrl);blobUrl="";}
      }

      let statusReason = "LOLOS VALIDASI ✓";
      if (!isAllowedType) {
        statusReason = `DITOLAK: Tipe ${file.type || "tidak dikenal"} dilarang`;
      } else if (!isAllowedSize) {
        statusReason = `DITOLAK: Ukuran ${formatFileSize(file.size)} melebihi batas ${maxMb} MB`;
      }

      if(isAllowedType && isAllowedSize && !isValid) statusReason="DITOLAK: "+(budgetReason||"Berkas tidak dapat didekode sebagai media");

      // Catat ke tabel log validasi
      if (validationTbody) {
        const tr = document.createElement("tr");
        const tdName = document.createElement("th");
        tdName.scope = "row";
        tdName.className = "is-sticky-col text-mono";
        tdName.textContent = file.name;

        const tdType = document.createElement("td");
        tdType.className = "text-mono";
        tdType.textContent = file.type || "unknown";

        const tdSize = document.createElement("td");
        tdSize.className = "tabular-nums";
        tdSize.textContent = formatFileSize(file.size);

        const tdStatus = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "piui-badge";
        badge.setAttribute("data-status", isValid ? "success" : "danger");
        badge.textContent = statusReason;
        tdStatus.appendChild(badge);

        tr.appendChild(tdName);
        tr.appendChild(tdType);
        tr.appendChild(tdSize);
        tr.appendChild(tdStatus);
        validationTbody.insertBefore(tr, validationTbody.firstChild);
      }

      if (isValid) {
        hashes.add(hash);retainedBytes+=file.size;retainedFiles++;
        const isVideo = file.type.startsWith("video/");

        mediaItems.unshift({
          id: `UPL-${crypto.randomUUID()}`,
          title: file.name,
          category: isVideo ? "video" : "image",
          categoryLabel: isVideo ? "Video Unggahan" : "Gambar Unggahan",
          mime: file.type,
          sizeBytes: file.size,
          dimensions: "Preview lokal, belum diunggah ke server",
          width:decoded.width,height:decoded.height,
          src: isVideo
            ? createMonochromeSvgDataUri(file.name, "Klik untuk memutar video unggahan", 640, 380, "VID-UPLOAD")
            : blobUrl,
          videoSrc: isVideo ? blobUrl : "",
          isBlobVideo: isVideo
        });
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      renderGallery();
      const parentDialog = document.getElementById("dialog-upload-media");
      if (parentDialog instanceof HTMLDialogElement && parentDialog.open) {
        parentDialog.close();
      }
      announceStatus(`${addedCount} berkas dapat dipratinjau secara lokal. Belum diunggah ke server.`);
    } else {
      announceStatus("Tidak ada berkas yang dapat dipratinjau. Periksa alasan penolakan pada jurnal.");
    }
  };

  let uploadBusy=false;
  const handleFilesUpload=async files=>{if(uploadBusy){announceStatus("Un batch masih diproses; coba lagi setelah selesai.");return;}uploadBusy=true;try{await processFilesUpload(files);}catch{announceStatus("Preview gagal diproses. Berkas tidak dikirim ke server; coba lagi.");}finally{uploadBusy=false;}};

  const simBtn = document.getElementById("btn-simulate-validation");
  simBtn?.addEventListener("click", () => {
    const svgValid = createMonochromeSvgDataUri("Arsitektur Enklave KMS", "Simulasi Unggahan Valid", 540, 640, "IMG-SIM-07");
    const validFile = new File([decodeURIComponent(svgValid.split(",")[1])], "arsitektur-enklave-kms.svg", {
      type: "image/svg+xml"
    });
    const invalidMimeFile = new File(["#!/bin/sh\necho exploit"], "payload-script.sh", {
      type: "application/x-sh"
    });
    handleFilesUpload([validFile, invalidMimeFile]);
  });

  for (const dz of dropzones) {
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("is-dragover");
    });
    dz.addEventListener("dragleave", () => {
      dz.classList.remove("is-dragover");
    });
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("is-dragover");
      const dt = /** @type {DragEvent} */ (e).dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFilesUpload(dt.files);
      }
    });
    dz.addEventListener("click", () => {
      const input = dz.querySelector("input[type='file']");
      if (input instanceof HTMLInputElement) input.click();
    });
  }

  for (const fInput of fileInputs) {
    fInput.addEventListener("change", () => {
      if (fInput instanceof HTMLInputElement && fInput.files && fInput.files.length > 0) {
        handleFilesUpload(fInput.files);
        fInput.value = "";
      }
    });
  }

  syncGallery();
}
