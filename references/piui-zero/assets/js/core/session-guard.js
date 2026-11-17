import { appHref, isPortable } from './environment.js';
/**
 * Modul Core: Live Announcer, Toast Notification, & Multi-Tab BroadcastChannel Sync
 */

const channel = (()=>{try{return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("piui_zero_channel")
  : null;}catch{return null;}})();

export function announce(message) {
  const announcer = document.getElementById("piui-live-announcer");
  if (!announcer) return;
  announcer.textContent = "";
  window.requestAnimationFrame(() => {
    announcer.textContent = String(message);
  });
}

export function showToast(message) {
  const region = document.getElementById("piui-toast-region");
  const tpl = document.getElementById("tpl-toast");
  if (!region || !(tpl instanceof HTMLTemplateElement)) {
    announce(message);
    return;
  }

  const clone = tpl.content.cloneNode(true);
  const toastEl = clone.querySelector(".piui-toast");
  const textEl = clone.querySelector("[data-toast-text]");
  const closeBtn = clone.querySelector("[data-toast-close]");

  if (textEl) {
    textEl.textContent = String(message);
  }

  const removeToast = () => {
    if (toastEl && toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
    if (!region.childElementCount && region.matches(":popover-open")) region.hidePopover();
  };

  if (closeBtn) {
    closeBtn.addEventListener("click", removeToast, { once: true });
  }

  // Keep toast controls in the active modal's interactive subtree and top layer.
  const owner = document.activeElement?.closest("dialog:modal") || [...document.querySelectorAll("dialog:modal")].at(-1) || document.body;
  if (region.matches(":popover-open")) region.hidePopover();
  if (region.parentElement !== owner) owner.appendChild(region);
  region.setAttribute("popover", "manual");
  region.appendChild(clone);
  region.showPopover();
  announce(message);
  window.setTimeout(removeToast, 4000);
}

export const announceStatus = showToast;

export function broadcastEvent(type, payload = {}) {
  if (channel) {
    channel.postMessage({ type, payload, timestamp: Date.now() });
  }
}

export function initSessionGuard({ onThemeSync } = {}) {
  if (!channel) return;
  channel.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "THEME_CHANGE" && typeof onThemeSync === "function") {
      onThemeSync(data.payload.theme);
    } else if (data.type === "SESSION_LOGOUT") {
      window.location.assign(appHref("/auth/login.html?reason=remote_logout"));
    }
  });
}
