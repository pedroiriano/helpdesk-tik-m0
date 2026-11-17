/** Native top-layer contract for every anchored popup; no page-local positioning. */
let nextPopupId = 0;
let initialized = false;
const bindings = new WeakMap();

/** Route dismissal through cancel, preserving draft guards and non-dismissible dialogs. */
export function requestDialogDismiss(dialog) {
  if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return false;
  if (!dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) return false;
  dialog.close();
  return true;
}

function outsideDialog(dialog,event) {
  const rect=dialog.getBoundingClientRect();
  return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
}

export function initPopupLayers() {
  if (initialized) return;
  initialized = true;
  let press=null;
  // Delegation also covers dialogs created after bootstrap. Both ends of the gesture
  // must originate on the backdrop: dragging text or clicking empty dialog padding is safe.
  document.addEventListener('pointerdown',event=>{
    const dialog=event.target;press=null;
    if(event.button!==0||event.isPrimary===false||!(dialog instanceof HTMLDialogElement)||!dialog.matches(':modal')||!outsideDialog(dialog,event))return;
    // Let native popover light-dismiss consume this gesture before closing its modal.
    if(dialog.querySelector('[popover]:popover-open'))return;
    press={dialog,pointerId:event.pointerId,released:false};
  },true);
  document.addEventListener('pointerup',event=>{
    if(!press)return;
    if(event.target!==press.dialog||event.pointerId!==press.pointerId||!outsideDialog(press.dialog,event)){press=null;return;}
    press.released=true;
  },true);
  document.addEventListener('pointercancel',()=>{press=null;},true);
  document.addEventListener('click',event=>{
    const gesture=press;press=null;
    if(!gesture?.released||event.target!==gesture.dialog||!gesture.dialog.matches(':modal')||!outsideDialog(gesture.dialog,event))return;
    event.preventDefault();requestDialogDismiss(gesture.dialog);
  },true);
  // A closed modal must never leave its child popup floating over the page.
  document.addEventListener("close", (event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    press=null;
    event.target.querySelectorAll("[popover]:popover-open").forEach(hidePopup);
  }, true);
}

export function bindPopup({ panel, trigger, onChange = () => {} }) {
  if (bindings.has(panel)) return bindings.get(panel);
  initPopupLayers();
  panel.id ||= `piui-popup-${++nextPopupId}`;
  panel.classList.add("piui-popup");
  panel.setAttribute("popover", "auto");
  panel.hidden = false;
  trigger.setAttribute("popovertarget", panel.id);
  trigger.setAttribute("aria-controls", panel.id);
  trigger.setAttribute("aria-expanded", "false");

  panel.addEventListener("beforetoggle", (event) => {
    const open = event.newState === "open";
    trigger.setAttribute("aria-expanded", String(open));
    onChange(open);
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    hidePopup(panel);
    trigger.focus();
  });
  const controller = {
    show() {
      if (!trigger.disabled && !panel.matches(":popover-open")) panel.showPopover({ source: trigger });
    },
    close() { hidePopup(panel); },
    isOpen() { return panel.matches(":popover-open"); }
  };
  bindings.set(panel, controller);
  return controller;
}

export function hidePopup(panel) {
  if (panel.matches(":popover-open")) panel.hidePopover();
}
