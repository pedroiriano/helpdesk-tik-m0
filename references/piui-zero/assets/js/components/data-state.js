import { el, button, actionGroup, contentStack } from '../core/dom.js';
const instances=new WeakMap();
export function createDataState(host,{retry=()=>{},reset=()=>{}}={}) {
 if(instances.has(host))return instances.get(host);
 const status=contentStack();status.classList.add('piui-data-feedback');status.hidden=true;status.setAttribute('role','status');host.prepend(status);
 const api={set(state,{message='',updatedAt='',traceId=''}={}){
  host.setAttribute('data-data-state',state);status.replaceChildren();status.hidden=state==='populated'&&!message;
  const defaults={loading:'Sedang memuat data…',empty:'Tidak ada hasil. Ubah atau reset filter.',error:'Data gagal dimuat. Nilai terakhir dan draf tidak dihapus.',stale:'Offline / data terakhir. Belum tersinkron ke server.'};
  status.append(el('p','',message||defaults[state]||''));if(updatedAt)status.append(el('small','',`Sumber: ${updatedAt}`));if(traceId)status.append(el('code','',`Trace-ID server: ${traceId}`));
  if(state==='error')status.append(actionGroup(button('Coba lagi',retry)));if(state==='empty')status.append(actionGroup(button('Reset filter',reset)));
 }};instances.set(host,api);return api;
}
