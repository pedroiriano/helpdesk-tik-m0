import { el,button,actionGroup,contentStack } from '../core/dom.js';
import { createSpriteIcon } from '../core/icons.js';
import { COLLECTION_VIEWS,readUrlState,updateUrlState,onUrlStateChange } from '../core/url-state.js';

export const COLLECTION_MODES=[
 {value:'cards',label:'Card Simetris',icon:'icon-layout-cards',description:'Sampul seragam dan tinggi kartu setara.'},
 {value:'masonry',label:'Masonry',icon:'icon-layout-masonry',description:'Rasio media asli; urutan mengalir dari atas ke bawah per kolom.'},
 {value:'grid',label:'Grid',icon:'icon-layout-grid',description:'Pratinjau persegi yang menampilkan media utuh tanpa potongan.'}
];
const instances=new WeakMap();let sequence=0;
export function initCollectionLayouts(root=document) {
 const hosts=[...root.querySelectorAll('[data-collection]')];if(root.matches?.('[data-collection]'))hosts.unshift(root);
 for(const host of hosts){if(instances.has(host))continue;instances.set(host,createLayout(host));}
}
export function getCollectionLayout(host){return instances.get(host);}
function createLayout(host) {
 const index=++sequence,key=host.getAttribute('data-collection-param')||(index===1?'view':`c${index}.view`);
 if(!/^(?:view|c[1-9]\d*\.view)$/.test(key))throw new Error('Collection URL key is invalid');
 host.id ||= `piui-collection-${index}`;host.setAttribute('data-collection-param',key);host.classList.add('piui-collection');
 let frame=host.parentElement;
 if(!frame.classList.contains('piui-collection-frame')){frame=el('div','piui-collection-frame');host.before(frame);frame.append(host);}
 const toolbar=el('div','piui-collection-toolbar'),hint=el('output','piui-field__hint'),controls=actionGroup(),buttons=new Map();
 hint.id=`${host.id}-layout-hint`;controls.setAttribute('role','group');controls.setAttribute('aria-label',`Pilihan tampilan ${host.getAttribute('aria-label')||'koleksi'}`);controls.setAttribute('aria-describedby',hint.id);
 for(const mode of COLLECTION_MODES){const control=button(mode.label,()=>updateUrlState({[key]:mode.value}));control.prepend(createSpriteIcon(mode.icon));control.setAttribute('data-collection-mode',mode.value);control.setAttribute('aria-controls',host.id);buttons.set(mode.value,control);controls.append(control);}
 toolbar.append(contentStack(el('strong','','Tampilan koleksi'),hint),controls);frame.before(toolbar);
 const label=frame.closest('[data-collection-scope]')?.querySelector('[data-collection-label]');let current;
 const read=()=>{const value=key==='view'?readUrlState().view:new URLSearchParams(location.search).get(key);return COLLECTION_VIEWS.includes(value)?value:'masonry';};
 const sync=()=>{
  const view=read(),mode=COLLECTION_MODES.find(item=>item.value===view);if(view===current)return;current=view;
  host.setAttribute('data-collection-view',view);for(const [value,control] of buttons)control.setAttribute('aria-pressed',String(value===view));
  hint.textContent=mode.description;if(label)label.textContent=mode.label;
  host.dispatchEvent(new CustomEvent('piui:collection-layout-change',{bubbles:true,detail:{view,key}}));
 };
 const unsubscribe=onUrlStateChange(sync);sync();
 return {getView:read,setView(view){updateUrlState({[key]:COLLECTION_VIEWS.includes(view)?view:'masonry'});},destroy(){unsubscribe();toolbar.remove();instances.delete(host);}};
}
