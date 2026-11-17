import { el,button,field } from '../core/dom.js';
import { showToast } from '../core/session-guard.js';
import { loadStyle } from '../core/assets.js';
import { watchDraft } from './drafts.js';
import { createDataState } from './data-state.js';
import { INITIAL_KANBAN_TASKS } from '../core/kanban-fixtures.js';
import { requestDialogDismiss } from './popup-layer.js';
const boards=new WeakMap();
const COLUMNS=[['backlog','Backlog & triase'],['investigate','Investigasi'],['mitigate','Mitigasi'],['done','Selesai']];
export function initKanbanBoards(root=document) {
 const hosts=[...root.querySelectorAll('#piui-kanban-board, [data-kanban]')];if(root.matches?.('[data-kanban]'))hosts.unshift(root);
 hosts.forEach(host=>{if(!boards.has(host))boards.set(host,createBoard(host));});
}
function createBoard(host) {
 let tasks=INITIAL_KANBAN_TASKS.map(task=>({...task,priority:task.priority==='danger'?'high':task.priority==='warning'?'medium':'info',description:'',due:'',history:[],archived:false})),dragId='',lastArchived;
 const scope=host.closest('[data-kanban-scope],section,[role="tabpanel"]')||host.parentElement;
 const toolbar=el('div','piui-workflow-toolbar'),q=field('Cari tiket',{type:'search'}),owner=field('Filter PIC',{tag:'select',options:[['','Semua PIC']]}),priority=field('Prioritas',{tag:'select',options:[['','Semua prioritas'],['high','Tinggi'],['medium','Sedang'],['low','Rendah'],['info','Informasi']]}),undo=button('Batalkan arsip',()=>{if(lastArchived){lastArchived.archived=false;lastArchived.history.push('Arsip dibatalkan');lastArchived=null;render();}});
 undo.hidden=true;toolbar.append(q.wrap,owner.wrap,priority.wrap,undo);host.before(toolbar);
 const state=createDataState(host.parentElement,{reset:()=>{q.input.value=owner.input.value=priority.input.value='';render();}});
 let dialog,form,title,fields,descriptionApi,currentTask;
 async function edit(task) {
  try {
   if(!dialog){
    await loadStyle('/assets/css/markdown-editor.css');const {createMarkdownEditor,getMarkdownEditor}=await import('./markdown-editor.js');
    dialog=el('dialog','piui-dialog');dialog.setAttribute('aria-label','Tiket Kanban lokal');form=el('form');form.method='dialog';form.setAttribute('data-local-mutation','');form.setAttribute('data-local-ready','');
    const header=el('div','piui-dialog__header');title=el('strong');header.append(title,button('Tutup',()=>requestDialogDismiss(dialog)));
    const body=el('div','piui-dialog__body');fields={};
    for(const [key,label,config] of [['title','Judul tiket',{required:true}],['owner','PIC',{required:true}],['priority','Prioritas',{tag:'select',options:[['high','Tinggi'],['medium','Sedang'],['low','Rendah'],['info','Informasi']]}],['due','Tenggat',{type:'date'}]]) {fields[key]=field(label,{...config,name:key});body.append(fields[key].wrap);}
    const editor=createMarkdownEditor({label:'Deskripsi tiket',name:'description',mode:'write'});descriptionApi=getMarkdownEditor(editor.querySelector('[data-piui-md-editor]'));body.append(editor);
    const history=el('ol');history.setAttribute('data-task-history','');body.append(el('h2','piui-panel__title','Riwayat lokal'),history);
    const footer=el('div','piui-dialog__footer'),save=el('button','piui-btn piui-btn--primary','Simpan tiket lokal');save.type='submit';footer.append(save,el('small','','Tidak disimpan ke server.'));form.append(header,body,footer);dialog.append(form);document.body.append(dialog);watchDraft(form);
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;
     const record=currentTask||{id:`TSK-DEMO-${crypto.randomUUID()}`,col:'backlog',history:[],archived:false};for(const [key,f] of Object.entries(fields))record[key]=f.input.value.trim();record.description=descriptionApi.getValue();record.history.push(`${new Date().toISOString()} • ${currentTask?'Tiket diperbarui':'Tiket dibuat'}`);if(!currentTask)tasks.unshift(record);
     form.dispatchEvent(new Event('piui:draft-committed'));dialog.close();render();showToast('Tiket tersimpan pada memori halaman, belum ke server.');
    });
   }
   if(form.hasAttribute('data-dirty')){
    if(currentTask===task){dialog.showModal();fields.title.input.focus();return;}
    if(!confirm('Buka tiket lain? Draf tiket saat ini belum disimpan.'))return;
   }
   currentTask=task;title.textContent=task?`Detail / edit ${task.id}`:'Tambah tiket Kanban';
   for(const [key,f] of Object.entries(fields))f.input.value=task?.[key]|| (key==='priority'?'info':'');descriptionApi.setValue(task?.description||'');
   const history=form.querySelector('[data-task-history]');history.replaceChildren(...(task?.history||[]).map(text=>el('li','',text)));
   form.dispatchEvent(new Event('piui:draft-committed'));dialog.showModal();fields.title.input.focus();
  }catch(error){showToast(`Form tiket belum siap: ${error.message} Silakan coba lagi.`);}
 }
 function move(task,position) {task.col=COLUMNS[position][0];task.history.push(`${new Date().toISOString()} • Dipindah ke ${COLUMNS[position][1]}`);render(task.id);showToast(`Tiket dipindah ke ${COLUMNS[position][1]} (lokal).`);}
 function render(focusId) {
  const previousOwner=owner.input.value;owner.input.replaceChildren();const all=el('option','','Semua PIC');all.value='';owner.input.append(all);for(const name of [...new Set(tasks.filter(t=>!t.archived).map(t=>t.owner))]){const opt=el('option','',name);opt.value=name;owner.input.append(opt);}owner.input.value=previousOwner;
  const filtered=tasks.filter(task=>!task.archived&&(!q.input.value||`${task.id} ${task.title} ${task.description}`.toLowerCase().includes(q.input.value.toLowerCase()))&&(!owner.input.value||task.owner===owner.input.value)&&(!priority.input.value||task.priority===priority.input.value));
  const fragment=document.createDocumentFragment();for(const [index,[key,label]] of COLUMNS.entries()){
   const column=el('section','piui-kanban__col');column.setAttribute('data-kanban-col',key);const heading=el('h3','piui-kanban__header',`${label} (${filtered.filter(task=>task.col===key).length})`),list=el('div','piui-kanban__list');
   for(const task of filtered.filter(task=>task.col===key)){
    const card=el('article','piui-kanban__card');card.draggable=true;card.setAttribute('data-task-id',task.id);const open=button(task.title,()=>edit(task));open.setAttribute('data-task-open',task.id);
    const actions=el('div','piui-kanban__actions'),prev=button('‹ Geser',()=>move(task,index-1)),next=button('Geser ›',()=>move(task,index+1));prev.disabled=!index;next.disabled=index===3;prev.setAttribute('aria-label',`Geser ${task.id} ke kolom sebelumnya`);next.setAttribute('aria-label',`Geser ${task.id} ke kolom berikutnya`);
    actions.append(prev,next,button('Arsip',()=>{task.archived=true;task.history.push(`${new Date().toISOString()} • Diarsipkan`);lastArchived=task;render();undo.focus();}));
    card.append(el('small','text-mono',task.id),open,el('p','piui-page-subtitle',`PIC: ${task.owner} • ${task.priority}`),el('p','',task.due?`Tenggat ${task.due}${task.due<new Date().toLocaleDateString('en-CA')&&key!=='done'?' • Melewati tenggat':''}`:'Tanpa tenggat'),actions);
    card.addEventListener('dragstart',()=>{dragId=task.id;});list.append(card);
   }
   column.addEventListener('dragover',event=>event.preventDefault());column.addEventListener('drop',event=>{event.preventDefault();const task=tasks.find(t=>t.id===dragId);if(task)move(task,index);dragId='';});column.append(heading,list);fragment.append(column);
  }
  host.replaceChildren(fragment);undo.hidden=!lastArchived;state.set(filtered.length?'populated':'empty');if(focusId)host.querySelector(`[data-task-open="${CSS.escape(focusId)}"]`)?.focus();
 }
 const add=scope.querySelector('[data-add-kanban], #btn-add-kanban-task');add?.addEventListener('click',()=>edit(null));
 for(const f of [q,owner,priority])f.input.addEventListener(f===q?'input':'change',()=>render());render();return {getTasks:()=>structuredClone(tasks)};
}
