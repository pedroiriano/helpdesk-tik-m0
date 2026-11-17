import { isPortable } from './core/environment.js';
/** Minimal native shell; feature modules are loaded only for matching consumers. */
import { initAdaptiveShell } from './components/shell.js';
import { initPopupLayers } from './components/popup-layer.js';
import { initForms } from './components/forms.js';
import { showToast } from './core/session-guard.js';
import { initFeatures } from './components/feature-registry.js';
import { validateWorkerUrl } from './core/worker-policy.js';

let workerScript='/sw.js';
if (!isPortable() && window.trustedTypes) {
 try { const policy=window.trustedTypes.createPolicy('piui-dom-policy',{createHTML(){throw new TypeError('Raw HTML insertion is disabled');},createScriptURL(value){return validateWorkerUrl(value,location.origin);}});workerScript=policy.createScriptURL('/sw.js'); } catch { /* A policy collision must fail closed, not weaken CSP. */ }
}
function registerShellWorker() {
 const status=document.createElement('p');status.className='piui-product-credit';status.setAttribute('data-offline-status','');status.setAttribute('role','status');document.querySelector('footer')?.append(status);
 const sync=(state,message)=>{document.documentElement.setAttribute('data-sw-state',state);status.textContent=message;};
 if(isPortable()){sync('portable','Mode portabel: seluruh aset tersedia lokal; pembaruan PWA membutuhkan hosting.');return;}
 if(!('serviceWorker' in navigator)){sync('unsupported','Cadangan offline tidak didukung browser ini.');return;}
 if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname)){sync('unsupported','Cadangan offline membutuhkan HTTPS.');return;}
 sync('installing','Menyiapkan cadangan offline…');
 navigator.serviceWorker.addEventListener('controllerchange',()=>sync('active','Cadangan shell offline aktif; data operasional tidak di-cache.'));
 navigator.serviceWorker.register(workerScript,{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>sync(navigator.serviceWorker.controller?'active':'installed',navigator.serviceWorker.controller?'Cadangan shell offline aktif; data operasional tidak di-cache.':'Shell terpasang; menunggu kendali halaman.')).catch(error=>sync('unavailable',`Cadangan offline belum tersedia: ${error.message}`));
}
async function bootstrap() {
 initPopupLayers();initAdaptiveShell();
 await initFeatures('shell');
 await initFeatures('entity');
 initForms();
 // Palette initialization is deferred until the first explicit command action.
 let palette;
 const openPalette=async()=>{try{palette ||= import('./components/cmd-palette.js').then(module=>module.initCommandPalette());await palette;document.getElementById('btn-open-cmd')?.click();}catch{palette=null;document.getElementById('btn-open-cmd')?.addEventListener('click',openPalette,{once:true});showToast('Pencarian belum dimuat. Gunakan navigasi utama; coba kembali.');}};
 document.getElementById('btn-open-cmd')?.addEventListener('click',openPalette,{once:true});
 document.addEventListener('keydown',async event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!palette){event.preventDefault();await openPalette();}});
 await initFeatures();
 document.documentElement.setAttribute('data-ui-ready','true');
 registerShellWorker();
}
const start=()=>bootstrap().catch(error=>{console.error("[PIUI] Component initialization failed",error);showToast('Sebagian komponen gagal dimuat. Muat ulang halaman; draf yang masih terbuka tidak dikirim.');document.documentElement.setAttribute('data-ui-ready','error');});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
