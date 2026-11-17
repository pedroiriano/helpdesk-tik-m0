import { appHref } from '../core/environment.js';
import { showToast, announce } from "../core/session-guard.js";
import { watchDraft, attachSettingsReview } from './drafts.js';
import { runAdapter } from '../core/adapters.js';
import { requestDialogDismiss } from './popup-layer.js';

export function initForms(root=document) {
  root.querySelectorAll("[data-open-dialog], [data-dialog-open]").forEach(button=>{
    if(button.hasAttribute("data-dialog-bound"))return;button.setAttribute("data-dialog-bound","");
    button.addEventListener("click",()=>{
      const dialog=document.getElementById(button.getAttribute("data-open-dialog")||button.getAttribute("data-dialog-open"));
      if(dialog instanceof HTMLDialogElement&&!dialog.open){
        const selected=[...(button.closest('[data-table-scope], .piui-panel')||document).querySelectorAll('[data-row-select]:checked')].map(check=>check.closest('tr')?.getAttribute('data-row-id')).filter(Boolean);
        if(selected.length){let summary=dialog.querySelector('[data-bulk-summary]');if(!summary){summary=document.createElement('p');summary.setAttribute('data-bulk-summary','');summary.className='piui-alert';dialog.querySelector('.piui-dialog__body')?.prepend(summary);}summary.textContent=`Dampak pilihan lokal: ${selected.length} entitas, termasuk pilihan di luar halaman aktif: ${selected.join(', ')}. Server belum dieksekusi.`;}
        dialog.showModal();announce(dialog.getAttribute("aria-label")||"Formulir dibuka");}
    });
  });
  root.querySelectorAll("[data-close-dialog], [data-dialog-close]").forEach(button=>{
    if(button.hasAttribute("data-dialog-bound"))return;button.setAttribute("data-dialog-bound","");
    button.addEventListener("click",()=>requestDialogDismiss(button.closest('dialog')));
  });
  root.querySelectorAll("dialog form, form[data-settings-form]").forEach(form=>{
    watchDraft(form);
    if(form.hasAttribute("data-form-bound"))return;
    if(form.hasAttribute('data-local-mutation')){if(!form.hasAttribute('data-local-guard')){form.setAttribute('data-local-guard','');form.addEventListener('submit',event=>{if(!form.hasAttribute('data-local-ready')){event.preventDefault();showToast('Fitur lokal belum siap. Draf tidak dikirim; coba muat ulang fitur.');}});}return;}
    form.setAttribute("data-form-bound","");
    const phrase=form.querySelector("[data-phrase-input]"),reason=form.querySelector("[data-reason-input]"),submit=form.querySelector('[type="submit"]');
    const expected=form.getAttribute("data-confirm-phrase");
    const validConfirmation=()=>!!phrase&&!!reason&&phrase.value.trim().toUpperCase()===expected?.toUpperCase()&&reason.value.trim().length>=8;
    if(expected){
      const sync=()=>{if(submit)submit.disabled=!validConfirmation();};
      form.addEventListener("input",sync);sync();
    }
    let advance=()=>true;
    if(form.closest("[data-wizard]"))advance=bindWizard(form);
    const review=form.hasAttribute('data-settings-form')||location.pathname.includes('/settings/')?attachSettingsReview(form):()=>true;
    let pending=false;
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(pending||!form.reportValidity()||(expected&&!validConfirmation())||!advance()||!review())return;
      if(form.hasAttribute("data-demo-login")) {
        form.reset();form.dispatchEvent(new Event('piui:draft-committed'));location.assign(appHref("/app/dashboard/index.html"));return;
      }
      const request=new CustomEvent("piui:form-submit",{bubbles:true,cancelable:true,detail:{form}});
      if(!form.dispatchEvent(request))return;
      // No server adapter: keep the draft and never claim a persisted mutation.
      let message;
      pending=true;if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');}
      try{const result=await runAdapter(form.getAttribute('data-adapter')||form.id||'form.submit',Object.fromEntries(new FormData(form)));message=result.persisted?'Server mengonfirmasi perubahan.':expected ? "Konfirmasi lokal valid. Aksi server belum dijalankan; alasan tetap tersedia." : "Validasi lokal selesai. Data belum dikirim atau disimpan ke server; draf tetap tersedia.";if(result.persisted)form.dispatchEvent(new Event('piui:draft-committed'));}
      catch(error){message=error.message;}
      finally{pending=false;if(submit){submit.removeAttribute('aria-busy');submit.disabled=expected?!validConfirmation():false;}}
      let feedback=form.querySelector("[data-form-feedback]");
      if(!feedback){feedback=document.createElement("p");feedback.className="piui-alert";feedback.setAttribute("role","status");feedback.setAttribute("data-form-feedback","");(form.querySelector(".piui-dialog__body")||form).append(feedback);}
      feedback.textContent=message;showToast(message);
    });
  });
}
function bindWizard(form) {
  const steps=[...form.querySelectorAll("[data-wizard-step]")];
  if(steps.length<2)return ()=>true;
  let current=0;
  const nav=document.createElement("div");nav.className="piui-page-actions";
  const prev=document.createElement("button"),next=document.createElement("button"),status=document.createElement("span");
  for(const button of [prev,next]){button.type="button";button.className="piui-btn piui-btn--secondary";}
  prev.textContent="Langkah sebelumnya";next.textContent="Langkah berikutnya";status.setAttribute("role","status");
  const submit=form.querySelector('[type="submit"]');
  const render=()=>{steps.forEach((step,index)=>{step.hidden=index!==current;});prev.disabled=current===0;next.hidden=current===steps.length-1;if(submit)submit.hidden=current!==steps.length-1;status.textContent=`Tahap ${current+1} dari ${steps.length}`;};
  const advance=()=>{
    const valid=[...steps[current].querySelectorAll("input, select, textarea")].every(input=>input.reportValidity());
    if(!valid)return false;
    if(current===steps.length-1)return true;
    current++;render();steps[current].querySelector("button, input:not(.sr-only), textarea")?.focus();return false;
  };
  prev.addEventListener("click",()=>{current=Math.max(0,current-1);render();});next.addEventListener("click",advance);
  form.addEventListener("invalid",event=>{const index=steps.findIndex(step=>step.contains(event.target));if(index>=0){current=index;render();}},true);
  nav.append(prev,status,next);form.querySelector(".piui-dialog__footer")?.prepend(nav);render();return advance;
}
