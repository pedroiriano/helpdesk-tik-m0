// Same-origin transport shared by native PIUI consumers. No credentials are persisted here.
export class APIError extends Error { status:number;constructor(status:number,message:string){super(message);this.status=status;} }
const cookie = (name:string) => document.cookie.split('; ').find(v=>v.startsWith(name+'='))?.slice(name.length+1) ?? '';
export const csrf = () => cookie('helpdesk_csrf') || cookie('helpdesk_tracking_csrf');
export async function api<T>(path:string,method='GET',body?:unknown,key?:string,token?:string,extra:Record<string,string>={},signal?:AbortSignal):Promise<T>{
 const timeout=AbortSignal.timeout(15000);
 const response=await fetch('/api/v1'+path,{method,credentials:'same-origin',cache:'no-store',signal:signal?AbortSignal.any([timeout,signal]):timeout,headers:method==='GET'?extra:{'Content-Type':'application/json','Idempotency-Key':key??crypto.randomUUID(),'X-CSRF-Token':token??csrf(),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 return json<T>(response);
}
export async function json<T>(response:Response):Promise<T>{const result:unknown=await response.json();if(!response.ok){if(response.status===401)document.dispatchEvent(new Event('hd:unauthorized'));throw new APIError(response.status,(result as {message?:string}).message??'Permintaan belum berhasil')}return result as T}
export const errorText=(e:unknown):string=>e instanceof APIError?(e.status===409?e.message+'. Muat ulang dan tinjau data sebelum mencoba lagi.':e.message):'Koneksi terputus atau waktu tunggu habis. Isian dipertahankan; coba kembali untuk intent yang sama.';
export function intent(){let previous='',key='';return(path:string,payload:unknown)=>{const serialized=path+JSON.stringify(payload);if(serialized!==previous){previous=serialized;key=crypto.randomUUID()}return key}}
// Hold both key and original expected_version while commit status is unknown, even after a read refresh.
export function durableIntent<T>(){
 let active:{path:string;fingerprint:string;key:string;payload:T}|undefined;
 return async<R>(path:string,payload:T,send:(key:string,original:T)=>Promise<R>,fingerprint=JSON.stringify(payload)):Promise<R>=>{
  if(active&&(active.path!==path||active.fingerprint!==fingerprint))throw new APIError(409,'Status pengiriman sebelumnya belum pasti. Ulangi isian/file yang sama untuk rekonsiliasi sebelum membuat intent lain');
  active??={path,fingerprint,key:crypto.randomUUID(),payload:structuredClone(payload)};
  try{const result=await send(active.key,active.payload);active=undefined;return result}
  catch(e){if(e instanceof APIError&&e.status>=400&&e.status<500)active=undefined;throw e}
 };
}
