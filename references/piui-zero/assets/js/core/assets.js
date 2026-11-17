import { appHref } from './environment.js';
const styles=new Map();
export function loadStyle(path) {
 path=appHref(path);
 if(styles.has(path))return styles.get(path);
 const existing=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>link.getAttribute('href')===path);if(existing?.sheet)return Promise.resolve();
 const promise=new Promise((resolve,reject)=>{const link=existing||document.createElement('link');link.rel='stylesheet';link.href=path;link.addEventListener('load',resolve,{once:true});link.addEventListener('error',()=>{styles.delete(path);link.remove();reject(new Error('Stylesheet belum tersedia. Coba lagi.'));},{once:true});if(!existing)document.head.append(link);});styles.set(path,promise);return promise;
}
