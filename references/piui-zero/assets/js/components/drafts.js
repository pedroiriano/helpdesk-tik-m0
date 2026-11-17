import { el,button } from '../core/dom.js';
const states=new WeakMap(),dirty=new Set();let listening=false;
function installGuards(){
 if(listening)return;listening=true;
 window.addEventListener('beforeunload',event=>{if([...dirty].some(host=>host.isConnected)){event.preventDefault();event.returnValue='';}});
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&dirty.size&&link.origin===location.origin&&link.pathname!==location.pathname&&!confirm('Ada draf yang belum dikirim. Tetap tinggalkan halaman ini?'))event.preventDefault();});
}
export function watchEditorDraft(host,textarea) {
 if(textarea.form||textarea.readOnly||textarea.disabled||states.has(host))return;installGuards();let baseline=textarea.value;
 const sync=()=>{if(textarea.value!==baseline){dirty.add(host);host.setAttribute('data-editor-dirty','');const feedback=host.querySelector('[data-md-feedback]');if(feedback)feedback.textContent='Draf berubah; belum diunduh atau disimpan ke server.';}else{dirty.delete(host);host.removeAttribute('data-editor-dirty');}};
 states.set(host,{commit(){baseline=textarea.value;sync();}});host.addEventListener('piui:editor-change',sync);host.addEventListener('piui:draft-exported',()=>states.get(host).commit());
}
function values(form){return JSON.stringify([...form.elements].filter(n=>['INPUT','SELECT','TEXTAREA'].includes(n.tagName)&&!n.closest('.piui-select2__dropdown')).map(n=>[n.name||n.id,n.type==='checkbox'||n.type==='radio'?n.checked:n.value]));}
export function watchDraft(form) {
 if(states.has(form))return states.get(form);
 const status=el('p','piui-page-subtitle','Belum ada perubahan.');status.setAttribute('role','status');status.setAttribute('data-draft-status','');(form.querySelector('.piui-dialog__body')||form).append(status);
 let baseline=values(form);const sync=()=>{const changed=values(form)!==baseline;form.toggleAttribute('data-dirty',changed);if(changed)dirty.add(form);else dirty.delete(form);status.textContent=changed?'Draf berubah • belum dikirim ke server.':'Tidak ada perubahan yang belum dikirim.';};
 const api={commit(){baseline=values(form);sync();},isDirty(){return dirty.has(form);}};states.set(form,api);
 form.addEventListener('input',sync);form.addEventListener('change',sync);form.addEventListener('reset',()=>requestAnimationFrame(()=>api.commit()));form.addEventListener('piui:draft-committed',()=>api.commit());
 form.closest('dialog')?.addEventListener('cancel',event=>{if(api.isDirty()&&!confirm('Tutup formulir? Draf tetap ada pada halaman ini, tetapi belum disimpan ke server.'))event.preventDefault();});
 installGuards();
 return api;
}
export function attachSettingsReview(form) {
 const baseline=new Map(new FormData(form));let reviewed='';const panel=el('section','piui-card');panel.hidden=true;panel.setAttribute('aria-label','Ringkasan perubahan');form.append(panel);
 form.addEventListener('input',()=>{reviewed='';panel.hidden=true;});
 const draft=button('Unduh draf pengaturan',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(Object.fromEntries(new FormData(form)),null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='piui-settings-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });form.querySelector('.piui-dialog__footer')?.prepend(draft);
 return ()=>{
  const current=new FormData(form),key=JSON.stringify([...current]);if(key===reviewed)return true;
  panel.hidden=false;panel.replaceChildren(el('h2','piui-panel__title','Tinjau perubahan sebelum menerbitkan'),el('p','','Dampak: konfigurasi akses/sesi dapat berubah setelah adapter server mengonfirmasi. Mode sekarang hanya validasi lokal.'));
  for(const [name,value] of current){if(typeof value==='string'&&value!==baseline.get(name))panel.append(el('p','overflow-anywhere',`${name}: ${baseline.get(name)||'(kosong)'} → ${value}`));}
  panel.append(el('p','','Periksa ringkasan, lalu tekan Terbitkan sekali lagi untuk mengonfirmasi.'));reviewed=key;panel.scrollIntoView({block:'nearest'});return false;
 };
}
