import { el,button,field,actionGroup,contentStack } from '../core/dom.js';
import { copyText } from '../core/clipboard.js';
import { showToast } from '../core/session-guard.js';
export function createTableTools(table,scope,{read,write}) {
 const tools=el('div','piui-table-tools'),chips=el('div','piui-page-actions');chips.setAttribute('aria-label','Filter aktif');
 const columns=el('details'),summary=el('summary','','Kolom yang ditampilkan'),columnFields=contentStack();columns.append(summary,columnFields);const checks=[];
 [...table.querySelectorAll('thead th')].forEach((th,index)=>{
  if(index===0||th.getAttribute('data-table-column')==='actions')return;
  const f=field(th.textContent.replace(/[↕▲▼]/g,'').trim(),{type:'checkbox'});f.input.checked=true;checks.push([f.input,index]);columnFields.append(f.wrap);
  f.input.addEventListener('change',applyColumns);
 });
 function applyColumns(){for(const [check,index] of checks)for(const row of table.rows)row.cells[index]?.toggleAttribute('hidden',!check.checked);}
 const view=field('Nama tampilan tersimpan',{value:'Tampilan saya'}),saved=field('Tampilan sesi ini',{tag:'select',options:[['','Pilih tampilan']]});const views=new Map();
 saved.input.addEventListener('change',()=>{const state=views.get(saved.input.value);if(state)write(state);});
 const save=button('Simpan tampilan sesi',()=>{
  const name=view.input.value.trim().slice(0,40);if(!name)return;views.set(name,{...read()});
  if(![...saved.input.options].some(o=>o.value===name)){const opt=el('option','',name);opt.value=name;saved.input.append(opt);}saved.input.value=name;showToast('Tampilan disimpan dalam memori halaman; tidak menyimpan query/PII di penyimpanan perangkat.');
 });
 const copy=button('Salin URL filter',async()=>{try{await copyText(location.href);showToast('URL filter disalin. Periksa data pada query sebelum membagikan.');}catch(error){showToast(error.message);}});
 const viewsPanel=el('details');viewsPanel.append(el('summary','','Tampilan dan tautan'),contentStack(view.wrap,actionGroup(save),saved.wrap,actionGroup(copy)));
 tools.append(chips,columns,viewsPanel);table.closest('.piui-table-scroll')?.before(tools);
 return ()=>{
  const state=read();chips.replaceChildren();
  for(const key of ['q','status','role','priority','from','to','sort'])if(state[key]&&state[key]!=='all')chips.append(button(`${key}: ${state[key]} ×`,()=>write({[key]:key==='status'||key==='role'||key==='priority'?'all':'',page:1})));
  applyColumns();
 };
}
