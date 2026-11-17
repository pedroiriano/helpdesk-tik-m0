import { appHref } from '../core/environment.js';
import { showToast } from '../core/session-guard.js';
import { el, button, field } from '../core/dom.js';
import { getNotifications, subscribeNotifications, markNotifications, addNotification } from '../core/notifications-store.js';
const initialized=new WeakSet();
export function initNotificationsPageController(root=document) {
 const tbody=root.querySelector('#notif-page-tbody');if(!tbody||initialized.has(tbody))return;initialized.add(tbody);
 const detail=document.getElementById('dialog-notif-detail');
 const inspect=item=>{
  for(const [id,value] of Object.entries({'notif-detail-code':`${item.id} • ${item.date}`,'notif-detail-cat':item.cat,'notif-detail-heading':item.title,'notif-detail-sender':item.sender,'notif-detail-message':item.body})) {const node=document.getElementById(id);if(node)node.textContent=value;}
  const link=document.getElementById('notif-detail-action-link');if(link)link.href=appHref(item.link||'/app/dashboard/index.html');
  detail?.querySelector('[data-read-toggle]')?.remove();
  const toggle=button('Tandai belum dibaca',()=>{markNotifications([item.id],true);detail.close();});toggle.setAttribute('data-read-toggle','');detail?.querySelector('.piui-dialog__footer')?.append(toggle);
  markNotifications([item.id]);if(detail&&!detail.open)detail.showModal();
 };
 subscribeNotifications(items=>{
  const selected=new Set([...tbody.querySelectorAll('[data-row-select]:checked')].map(input=>input.closest('tr').getAttribute('data-row-id')));
  const frag=document.createDocumentFragment();
  for(const item of items){
   const row=el('tr');for(const [key,value] of Object.entries({'data-row-id':item.id,'data-row-date':item.date,'data-status':item.unread?'unread':'read','data-role':item.category,'data-priority':item.priority,'data-unread':String(item.unread)}))row.setAttribute(key,value);
   const id=el('th','is-sticky-col');id.scope='row';const label=el('label','piui-field__label'),check=el('input');check.type='checkbox';check.checked=selected.has(item.id);check.setAttribute('data-row-select','');check.setAttribute('aria-label',`Pilih notifikasi ${item.id}`);label.append(check,el('span','text-mono',item.id));id.append(label,el('small','',item.date));
   const cat=el('td','',`${item.priority==='high'?'Penting • ':''}${item.cat}`),content=el('td');content.append(el('strong','',item.title),el('p','piui-page-subtitle',item.body));
   const actions=el('td'),open=button('Lihat Detail',()=>inspect(item));open.setAttribute('data-notif-inspect','');open.setAttribute('data-inspect-bound','true');actions.append(open,button(item.unread?'Baca':'Belum dibaca',()=>markNotifications([item.id],!item.unread)));
   row.append(id,cat,content,el('td','',item.sender),el('td','',item.unread?'Belum dibaca':'Sudah dibaca'),actions);frag.append(row);
  }
  tbody.replaceChildren(frag);const count=items.filter(item=>item.unread).length;
  const kpi=document.getElementById('kpi-notif-unread-count');if(kpi)kpi.textContent=`${count} Pesan`;
  const badge=document.getElementById('kpi-notif-unread-badge');if(badge)badge.textContent=count?'Perlu dicek':'Semua terbaca';
  document.dispatchEvent(new Event('piui:table-data-change'));
 });
 document.getElementById('btn-page-notif-read-all')?.addEventListener('click',()=>markNotifications(getNotifications().map(item=>item.id)));
 document.getElementById('btn-bulk-notif-read')?.addEventListener('click',()=>markNotifications([...tbody.querySelectorAll('[data-row-select]:checked')].map(input=>input.closest('tr').getAttribute('data-row-id'))));
 const form=document.getElementById('form-notif-broadcast');
 form?.setAttribute('data-local-ready','');
 form?.addEventListener('submit',event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const category=document.getElementById('broadcast-category-select').value;
  const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  addNotification({title:document.getElementById('broadcast-title-input').value.trim(),body:document.getElementById('broadcast-body-input').value.trim(),category,cat:category,sender:'Operator demo lokal',priority:'info',date,time:'Baru saja',link:'/app/notifications/index.html'});
  form.dispatchEvent(new Event('piui:draft-committed'));form.closest('dialog')?.close();showToast('Pengumuman ditambahkan lokal; belum dikirim ke server.');
 });
 const host=tbody.closest('section')||tbody.closest('.piui-card');const panel=el('details','piui-card'),summary=el('summary','','Preferensi notifikasi lokal');panel.append(summary,el('p','piui-page-subtitle','Pilihan hanya berlaku pada halaman ini. Pengiriman email/push memerlukan adapter server.'));
 for(const [name,label,type] of [['email','Ringkasan email','checkbox'],['browser','Notifikasi browser','checkbox'],['quiet','Aktifkan jam tenang','checkbox'],['quietStart','Mulai jam tenang','time'],['quietEnd','Selesai jam tenang','time']]){const f=field(label,{type,name});panel.append(f.wrap);}host?.append(panel);
}
