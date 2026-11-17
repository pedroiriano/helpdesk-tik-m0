import { requestDialogDismiss } from './popup-layer.js';
import { appHref } from '../core/environment.js';
import { el, button, actionGroup } from '../core/dom.js';
import { createSpriteIcon } from '../core/icons.js';
import { announce } from '../core/session-guard.js';
import { getNotifications, subscribeNotifications, markNotifications, getNotificationSummary } from '../core/notifications-store.js';
let controller,announcerBound=false;
const indicators=new WeakSet();
export function initNotificationLaunchers(root=document) {
 // Keep the four compact mobile shell elements; unread status lives on the visible profile trigger.
 const shell=root.matches?.('.piui-app-shell')?root:root.querySelector('.piui-app-shell');
 if(shell){
  const profile=root.querySelector('#popover-profile'),end=shell.querySelector('.piui-topbar__end');
  for(const parent of [end,profile]){
   if(!parent||parent.querySelector('[data-open-notifications]'))continue;
   const trigger=button('',null,parent===end?'piui-icon-btn piui-notif-btn piui-topbar-extra':'piui-btn piui-btn--secondary');
   trigger.setAttribute('data-open-notifications','');trigger.append(createSpriteIcon('icon-bell',20));
   if(parent===profile)trigger.append(document.createTextNode('Pusat notifikasi'));
   if(parent===end){const profileTrigger=end.querySelector('[popovertarget="popover-profile"]');if(profileTrigger)profileTrigger.before(trigger);else end.append(trigger);}else parent.append(trigger);
  }
 }
 root.querySelectorAll('[data-open-notifications]').forEach(trigger=>{
  if(trigger.hasAttribute('data-notification-bound'))return;trigger.setAttribute('data-notification-bound','');
  bindIndicator(trigger,'Pusat notifikasi',Boolean(trigger.closest('#popover-profile')));
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.addEventListener('click',()=>{trigger.closest('[popover]:popover-open')?.hidePopover();openNotificationCenter();});
 });
 root.querySelectorAll('[popovertarget="popover-profile"]').forEach(trigger=>bindIndicator(trigger,'Buka menu profil dan sesi administrator'));
 if(!announcerBound){announcerBound=true;let previous;
  subscribeNotifications(items=>{const unread=new Set(items.filter(item=>item.unread).map(item=>item.id));if(previous){const added=[...unread].filter(id=>!previous.has(id)).length;if(added)announce(`${added} notifikasi ditandai belum dibaca. Total ${getNotificationSummary(items).label}.`);}previous=unread;});
 }
}
function bindIndicator(trigger,label,inline=false){
 if(indicators.has(trigger))return;indicators.add(trigger);
 if(!inline)trigger.classList.add('piui-notif-indicator');
 const badge=el('span',`piui-notif-badge${inline?' piui-notif-badge--inline':''}`);badge.setAttribute('aria-hidden','true');trigger.append(badge);
 subscribeNotifications(items=>{const summary=getNotificationSummary(items);badge.textContent=inline?`${summary.badge} belum dibaca`:summary.badge;badge.hidden=!summary.count;trigger.setAttribute('aria-label',`${label}. ${summary.label}`);trigger.setAttribute('title',`${label}. ${summary.label}`);});
}
export function openNotificationCenter(){controller ||= createCenter();controller.open();}
function createCenter() {
 const dialog=el('dialog','piui-dialog');dialog.setAttribute('aria-label','Pusat Notifikasi — contoh lokal');
 const header=el('div','piui-dialog__header');header.append(el('strong','','Pusat Notifikasi'),button('Tutup',()=>requestDialogDismiss(dialog)));
 const body=el('div','piui-dialog__body'),list=el('div','piui-notif-list'),tabs=el('div','piui-page-actions');let category='all';
 const render=()=>{
  const active=document.activeElement?.getAttribute('data-message-id');list.replaceChildren();let date='';
  for(const item of getNotifications().filter(item=>category==='all'||(category==='unread'?item.unread:item.priority==='high'))) {
   if(item.date!==date){date=item.date;list.append(el('h2','piui-panel__title',date));}
   const card=el('article',`piui-notif-item${item.unread?' is-unread':''}`),toggle=button(item.unread?'Tandai dibaca':'Tandai belum dibaca',()=>markNotifications([item.id],!item.unread));
   const actions=actionGroup(toggle);toggle.setAttribute('data-message-id',item.id);card.append(el('strong','',item.title),el('p','',item.body),el('small','',`${item.priority==='high'?'Penting • ':''}${item.time} • ${item.sender}`),actions);
   if(item.link){const link=el('a','piui-btn piui-btn--secondary piui-btn--sm','Buka entitas terkait');link.href=appHref(item.link);actions.append(link);}list.append(card);
  }
  if(!list.childElementCount)list.append(el('p','','Tidak ada pesan dalam kelompok ini.'));
  if(active)list.querySelector(`[data-message-id="${CSS.escape(active)}"]`)?.focus();
 };
 for(const [key,label] of [['all','Semua'],['unread','Belum dibaca'],['high','Penting']]){const b=button(label,()=>{category=key;tabs.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));render();});b.setAttribute('aria-pressed',String(key===category));tabs.append(b);}
 body.append(el('p','piui-page-subtitle','Data contoh lokal; perubahan baca berlaku pada halaman ini dan direset saat navigasi penuh. Tidak ada pengiriman push/email.'),tabs,button('Tandai semua dibaca',()=>markNotifications(getNotifications().map(item=>item.id))),list);
 const footer=el('div','piui-dialog__footer'),link=el('a','piui-btn piui-btn--primary','Halaman Notifikasi');link.href=appHref('/app/notifications/index.html');footer.append(link);
 dialog.append(header,body,footer);document.body.append(dialog);subscribeNotifications(render);
 return {open(){if(!dialog.open)dialog.showModal();}};
}
