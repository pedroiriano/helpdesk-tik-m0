/** Canonical paths stay /app/...; only file delivery resolves them against its package root. */
export function isPortable() { return typeof location!=='undefined' && location.protocol==='file:'; }
export function resolveAppHref(value,base,portable=false) {
 if(!portable||!/^\/(?!\/)/.test(value))return value;
 const target=new URL(`.${value}`,base).href;
 return target.startsWith(base)?target:'';
}
export function appBase() {
 return isPortable() ? new URL(document.querySelector('meta[name="piui-root"]').content,location.href).href : location.origin+'/';
}
export function appHref(value) { return isPortable()?resolveAppHref(value,appBase(),true):value; }
export function routePath() {
 if(!isPortable())return location.pathname;
 const root=new URL(appBase()).pathname;
 return location.pathname.startsWith(root)?'/'+location.pathname.slice(root.length):'';
}
export function routeContext() { return routePath()+location.search; }
export function iconHref(symbolId) { return isPortable()?`#${symbolId}`:`/assets/icons/piui-sprite.svg#${symbolId}`; }
