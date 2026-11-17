/**
 * @fileoverview PIUI Zero — WOW Smooth Animation & Scroll-Reveal Engine
 * Menghadirkan animasi masuk bertingkat (Staggered Scroll-Reveal seperti WOW.js / Animate.css)
 * dan penghitung angka animasi halus (Smooth Number Counter) berbasis IntersectionObserver & rAF.
 * 100% Bebas inline style & patuh prefers-reduced-motion.
 */

import { announceStatus } from "../core/session-guard.js";

/** @type {IntersectionObserver | null} */
let wowObserver = null;

/**
 * Menganimasikan nilai angka pada kartu KPI secara halus (Cubic-Out Easing)
 * @param {HTMLElement} el
 */
function animateNumberValue(el) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rawText = (el.getAttribute("data-wow-target-text") || el.textContent || "").trim();
  if (!rawText) return;
  el.setAttribute("data-wow-target-text", rawText);

  // Cari urutan digit pertama yang bermakna (mis: "1.420", "42 ms", "Rp 842.500.000")
  const match = rawText.match(/^(.*?)(\d[\d.]*)(.*)$/);
  if (!match) return;

  const prefix = match[1];
  const numStr = match[2];
  const suffix = match[3];

  // Abaikan jika string memiliki beberapa titik desimal versi semver seperti v2.0.0
  if ((numStr.match(/\./g) || []).length > 1 && numStr.length <= 6) return;

  const cleanDigits = numStr.replace(/\./g, "");
  const targetNum = Number.parseInt(cleanDigits, 10);
  if (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum > 999999999999) return;

  const hasThousandDots = numStr.includes(".");
  const duration = 620;
  const startTime = performance.now();

  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(targetNum * eased);

    const formatted = hasThousandDots
      ? currentVal.toLocaleString("id-ID")
      : String(currentVal);

    el.textContent = `${prefix}${formatted}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = rawText;
    }
  };

  requestAnimationFrame(step);
}

/**
 * Mendaftarkan elemen ke pengamat animasi WOW Scroll-Reveal
 * @param {Document | Element} [root=document]
 */
export function observeWowElements(root = document) {
  if (!wowObserver && "IntersectionObserver" in window) {
    wowObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("is-wow-visible");

          // Jika kartu memiliki nilai KPI, jalankan animasi counter angka halus
          if (el instanceof HTMLElement) {
            const valEl = el.querySelector("[data-count-up]");
            if (valEl instanceof HTMLElement && el.getAttribute("data-wow-counted") !== "true") {
              el.setAttribute("data-wow-counted", "true");
              animateNumberValue(valEl);
            }
          }

          observer.unobserve(el);
        });
      },
      {
        rootMargin: "0px 0px -20px 0px",
        threshold: 0.06
      }
    );
  }

  const wowTargets = root.querySelectorAll("[data-wow]");
  wowTargets.forEach((el) => {
    if (el.classList.contains("is-wow-visible")) return;
    if (wowObserver) {
      wowObserver.observe(el);
    } else {
      el.classList.add("is-wow-visible");
    }
  });
}

/**
 * Memutar ulang seluruh animasi WOW Scroll-Reveal dan Counter Angka pada halaman aktif
 */
export function replayWowAnimations() {
  const allWow = document.querySelectorAll("[data-wow]");
  allWow.forEach((el) => {
    el.classList.remove("is-wow-visible");
    el.removeAttribute("data-wow-counted");
  });

  // Paksa reflow lalu amati kembali
  void document.body.offsetHeight;
  window.setTimeout(() => {
    observeWowElements(document);
    announceStatus("Animasi halus WOW Scroll-Reveal & Counter diputar ulang.");
  }, 40);
}

export function initWowAnimations() {
  observeWowElements(document);

  const replayBtns = document.body.hasAttribute("data-component-catalog") ? document.querySelectorAll("[data-wow-replay]") : [];
  replayBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      replayWowAnimations();
    });
  });
}
