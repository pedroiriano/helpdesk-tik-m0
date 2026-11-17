/**
 * @fileoverview PIUI Zero — Progressive Lazy-Load Media Engine (Images, Videos, & SVG/Deferred Widgets)
 * Menggunakan IntersectionObserver native + Image.decode() + Shimmer Skeleton & Blur-Up Transition.
 * Bebas innerHTML dan bebas inline style (100% Strict CSP Compliant).
 */

import { announceStatus } from "../core/session-guard.js";

const PLACEHOLDER_SVG_URI =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='48' viewBox='0 0 64 48'%3E%3Crect width='64' height='48' fill='%2327272A'/%3E%3C/svg%3E";

/** @type {IntersectionObserver | null} */
let sharedLazyObserver = null;

/**
 * Mengaktifkan sebuah elemen media saat masuk ke dalam viewport
 * @param {Element} el
 */
function hydrateMediaElement(el) {
  const wrap = el.closest(".piui-lazy-wrap") || el.parentElement;

  if (el instanceof HTMLImageElement) {
    const targetSrc = el.getAttribute("data-lazy-src") || el.getAttribute("src") || "";
    const finishImageLoad = () => {
      el.classList.add("is-lazy-loaded");
      wrap?.classList.remove("is-lazy-loading");
      wrap?.classList.add("is-lazy-ready");
      const statusBadge = wrap?.parentElement?.querySelector("[data-lazy-badge]");
      if (statusBadge) {
        statusBadge.textContent = "Media siap";
      }
    };

    const failImageLoad=()=>{
      el.classList.add("is-lazy-error");wrap?.classList.remove("is-lazy-loading");
      const badge=wrap?.parentElement?.querySelector("[data-lazy-badge]");if(badge)badge.textContent="Pratinjau gagal dimuat";
      if(wrap&&!wrap.querySelector(".piui-media-error")){const text=document.createElement("p");text.className="piui-media-error";text.setAttribute("role","status");text.textContent="Gambar tidak dapat dimuat. Coba berkas lain atau muat ulang.";wrap.append(text);}
    };
    if (el.getAttribute("data-lazy-src")) {
      el.src = targetSrc;
      el.removeAttribute("data-lazy-src");
    }

    if (typeof el.decode === "function") {
      el.decode().then(finishImageLoad).catch(failImageLoad);
    } else if (el.complete) {
      if(el.naturalWidth>0)finishImageLoad();else failImageLoad();
    } else {
      el.addEventListener("load", finishImageLoad, { once: true });
      el.addEventListener("error", failImageLoad, { once: true });
    }
    return;
  }

  if (el instanceof HTMLVideoElement) {
    const lazyPoster = el.getAttribute("data-lazy-poster");
    const lazySrc = el.getAttribute("data-lazy-src");
    if (lazyPoster) {
      el.poster = lazyPoster;
      el.removeAttribute("data-lazy-poster");
    }
    if (lazySrc) {
      el.src = lazySrc;
      el.removeAttribute("data-lazy-src");
      el.load();
    }
    el.classList.add("is-lazy-loaded");
    wrap?.classList.remove("is-lazy-loading");
    return;
  }

  // Elemen media lain (SVG Chart, Iframe, atau Kontainer Media Deferred)
  el.classList.add("is-lazy-loaded");
  wrap?.classList.remove("is-lazy-loading");
}

/**
 * Mengamati seluruh elemen gambar, video, dan komponen media tertunda di dalam root
 * @param {Document | Element} [root=document]
 */
export function observeLazyMedia(root = document) {
  if (!sharedLazyObserver && "IntersectionObserver" in window) {
    sharedLazyObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target;
          observer.unobserve(target);
          // Beri jeda mikro 90ms agar efek transisi Shimmer -> Blur-Up terlihat mulus
          window.setTimeout(() => {
            hydrateMediaElement(target);
          }, 90);
        });
      },
      {
        rootMargin: "140px 0px",
        threshold: 0.04
      }
    );
  }

  const mediaCandidates = root.querySelectorAll(
    "img[data-lazy-src], img[loading='lazy'], video[data-lazy-src], video[data-lazy-poster], [data-lazy-media]"
  );

  mediaCandidates.forEach((el) => {
    if (el.getAttribute("data-lazy-bound") === "true") return;
    el.setAttribute("data-lazy-bound", "true");
    el.classList.add("piui-lazy-media");

    const parent = el.parentElement;
    if (parent && !parent.classList.contains("piui-lazy-wrap")) {
      parent.classList.add("piui-lazy-wrap", "is-lazy-loading");
    } else if (parent) {
      parent.classList.add("is-lazy-loading");
    }

    if (el instanceof HTMLImageElement && !el.getAttribute("data-lazy-src") && el.src) {
      el.setAttribute("data-lazy-src", el.src);
      el.src = PLACEHOLDER_SVG_URI;
    }

    if (sharedLazyObserver) {
      sharedLazyObserver.observe(el);
    } else {
      hydrateMediaElement(el);
    }
  });
}

/**
 * Memicu ulang simulasi Lazy-Load Shimmer & Blur-Up pada halaman aktif
 */
export function replayLazyLoadMedia() {
  const loadedMedia = document.querySelectorAll(".piui-lazy-media");
  loadedMedia.forEach((el) => {
    el.classList.remove("is-lazy-loaded");
    el.removeAttribute("data-lazy-bound");
    if (el instanceof HTMLImageElement && el.src && !el.src.startsWith("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64'")) {
      el.setAttribute("data-lazy-src", el.src);
    }
  });
  observeLazyMedia(document);
  announceStatus("Simulasi Lazy-Load Media (Gambar, Video & Grafik) diputar ulang.");
}

export function initLazyMedia() {
  observeLazyMedia(document);

  const retestBtn = document.getElementById("btn-retest-lazyload");
  retestBtn?.addEventListener("click", () => {
    replayLazyLoadMedia();
  });
}
