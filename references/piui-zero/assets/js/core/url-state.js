/** Validated route state, shared pagination and calendar filtering. */
export const COLLECTION_VIEWS=['cards','masonry','grid'];
const VALUES = {
 range: ['today','7d','30d'], tz: ['WIB','UTC'], severity: ['all','high-risk','warning','info'], dir: ['asc','desc'],
 status: ['all','active','suspended','pending','settled','processing','failed','high','medium','low','unread','read','stable','verified','healthy','warning','critical'],
 role: ['all','super-admin','appsec','finops','sre','auditor','qris','bi-fast','rtgs','policy','iam','ledger','keamanan','transaksi','server','pengumuman'],
 media:['all','image','video'], maxSize:['2','5','10','25'], priority:['all','high','medium','low','info'],
 tab: ['','profil','rbac','sesi'], view:COLLECTION_VIEWS
};
const LIMITS = [3,4,5,6,10,25,99,999];
export function isDate(value) {
 return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function safeReturnTo(value) {
 if(typeof value!=='string'||value.length>2048||!value.startsWith('/app/')||/[\\\u0000-\u001f#]/.test(value))return '';
 const parsed=new URL(value,'https://piui.invalid');
 if(parsed.origin!=='https://piui.invalid')return '';
 const list=/^\/app\/(?:users|audit|transactions|notifications|analytics|components)\/index\.html$/.test(parsed.pathname);
 const detail=/^\/app\/(?:users|audit)\/detail\.html$/.test(parsed.pathname)&&/^[A-Z]+-[A-Za-z0-9-]{1,60}$/.test(parsed.searchParams.get('id')||'');
 return list||detail?parsed.pathname+parsed.search:'';
}
export function normalizeUrlState(input, schema = {}) {
 const get = key => input instanceof URLSearchParams ? input.get(key) : input[key];
 const pick = (key, fallback) => (schema[key] || VALUES[key]).includes(get(key)) ? get(key) : fallback;
 const page = Number(get('page')), limit = Number(get('limit'));
 let from = isDate(get('from')) ? get('from') : '', to = isDate(get('to')) ? get('to') : '';
 if (from && to && from > to) { from=''; to=''; }
 return {
  range:pick('range','today'), tz:pick('tz','WIB'), severity:pick('severity','all'), status:pick('status','all'), role:pick('role','all'), dir:pick('dir','asc'),
  sort:(schema.sort || ['','0','1','2','3','4','5','6']).includes(get('sort')) ? get('sort') : '',
  page:Number.isSafeInteger(page) && page>=1 && page<=100000 ? page : 1, limit:LIMITS.includes(limit) ? limit : 0,
  media:pick('media','all'), maxSize:pick('maxSize','10'), priority:pick('priority','all'), view:pick('view','masonry'),
  tab:pick('tab',''), from,to, id:/^[A-Z]+-[A-Za-z0-9-]{1,60}$/.test(get('id') || '') ? get('id') : '',
  q:String(get('q') || '').trim().slice(0,80), returnTo:safeReturnTo(get('returnTo'))
 };
}
function pageSchema() {
 const schema={};
 for (const [key,selector] of Object.entries({status:'[data-table-status], [data-table-filter="status"]',role:'[data-table-role]'})) {
  const select=document.querySelector(selector);
  if(select) schema[key]=[...select.options].map(o=>o.value);
 }
 const tabs=[...document.querySelectorAll('[role="tab"]')].map(t=>t.getAttribute('data-tab-key') || t.id);
 if(tabs.length) schema.tab=['',...tabs];
 return schema;
}
export function getValidatedUrlState() {return normalizeUrlState(new URLSearchParams(location.search),pageSchema());}
export const readUrlState=getValidatedUrlState;
export function updateUrlState(updates,{replace=false}={}) {
 const next=normalizeUrlState({...getValidatedUrlState(),...updates},pageSchema()), defaults=normalizeUrlState({}), params=new URLSearchParams();
 for(const [key,value] of new URLSearchParams(location.search))if(/^t\d+\.(?:q|page|limit|sort|dir|status|role|from|to|priority)$/.test(key))params.set(key,value);
 for(const [key,value] of [...new URLSearchParams(location.search),...Object.entries(updates)])if(/^c[1-9]\d*\.view$/.test(key)){
  if(COLLECTION_VIEWS.includes(value)&&value!=='masonry')params.set(key,value);else params.delete(key);
 }
 for(const [key,value] of Object.entries(next)) if(value!==defaults[key] && value!=='') params.set(key,String(value));
 const url=location.pathname+(params.size ? `?${params}` : '');
 if(url!==location.pathname+location.search) {
  history[replace ? 'replaceState' : 'pushState'](null,'',url);
  document.dispatchEvent(new Event('piui:url-state-change'));
 }
 return next;
}
export const writeUrlState=updateUrlState;
export function onUrlStateChange(callback) {
 const sync=()=>callback(getValidatedUrlState());
 window.addEventListener('popstate',sync);
 document.addEventListener('piui:url-state-change',sync);
 return ()=>{window.removeEventListener('popstate',sync);document.removeEventListener('piui:url-state-change',sync);};
}
export function matchesDateRange(date,state) {
 if(!state.from && !state.to) return true;
 return isDate(date) && (!state.from || date>=state.from) && (!state.to || date<=state.to);
}
export function paginate(items,{page=1,limit=3}={}) {
 const size=LIMITS.includes(limit) ? limit : 3, totalPages=Math.max(1,Math.ceil(items.length/size));
 const current=Math.max(1,Math.min(page,totalPages)), start=(current-1)*size;
 return {items:items.slice(start,start+size),page:current,totalPages,start,end:Math.min(start+size,items.length),total:items.length};
}
