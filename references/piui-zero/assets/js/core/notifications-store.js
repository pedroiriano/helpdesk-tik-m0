import { NOTIFICATIONS } from './notification-fixtures.js';
const listeners=new Set();let records=NOTIFICATIONS.map(item=>({...item}));
const emit=()=>listeners.forEach(callback=>callback(getNotifications()));
export function getNotifications(){return records.map(item=>({...item}));}
export function subscribeNotifications(callback){listeners.add(callback);callback(getNotifications());return ()=>listeners.delete(callback);}
export function markNotifications(ids,unread=false){const keys=new Set(ids);records=records.map(item=>keys.has(item.id)?{...item,unread}:item);emit();}
export function addNotification(record){records=[{...record,id:`NTF-DEMO-${crypto.randomUUID()}`,unread:true},...records];emit();}
export function notificationCount(){return records.filter(item=>item.unread).length;}
export function getNotificationSummary(items=getNotifications()) {
 const count=items.filter(item=>item.unread).length;
 return {count,badge:count>99?'99+':String(count),label:count?`${count} notifikasi belum dibaca`:'Tidak ada notifikasi belum dibaca'};
}
