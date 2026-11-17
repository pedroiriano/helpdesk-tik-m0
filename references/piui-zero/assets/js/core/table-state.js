import { normalizeUrlState, readUrlState, updateUrlState } from './url-state.js';
export function selectionSummary(checks){const count=checks.filter(c=>c.checked).length;return {checked:checks.length>0&&count===checks.length,mixed:count>0&&count<checks.length,count};}
export function pageWindow(current,total){return [...new Set([1,total,current-1,current,current+1].filter(p=>p>=1&&p<=total))].sort((a,b)=>a-b);}
export function tableState(table,scope,index=0) {
 const prefix=index?`t${index+1}.`:'';
 const schema={};for(const [key,selector] of [['status','[data-table-status], [data-table-filter="status"]'],['role','[data-table-role]']]) {const select=scope.querySelector(selector);if(select)schema[key]=[...select.options].map(o=>o.value);}
 const read=()=>prefix?normalizeUrlState(Object.fromEntries([...new URLSearchParams(location.search)].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.slice(prefix.length),value])),schema):normalizeUrlState(readUrlState(),schema);
 const write=(updates,{replace=false}={})=>{
  if(!prefix)return updateUrlState(updates,{replace});
  const state=normalizeUrlState({...read(),...updates},schema),defaults=normalizeUrlState({}),params=new URLSearchParams(location.search);
  for(const [key,value] of Object.entries(state)){params.delete(prefix+key);if(value!==defaults[key]&&value!=='')params.set(prefix+key,String(value));}
  const url=location.pathname+(params.size?`?${params}`:'');if(url!==location.pathname+location.search){history[replace?'replaceState':'pushState'](null,'',url);document.dispatchEvent(new Event('piui:url-state-change'));}
 };return {read,write};
}
