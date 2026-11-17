import { isPortable } from './environment.js';
/** No network calls until the integrator explicitly registers an adapter. */
const adapters=new Map();
export function registerAdapter(name,adapter){if(typeof adapter!=='function')throw new TypeError('Adapter must be a function');adapters.set(name,adapter);return ()=>adapters.delete(name);}
export async function runAdapter(name,payload,{signal}={}) {
 const adapter=adapters.get(name);if(!adapter)return {mode:'demo',persisted:false};
 const result=await adapter(payload,{signal});if(!result||result.persisted!==true)throw new Error('Server belum mengonfirmasi penyimpanan. Draf tetap tersedia.');
 return {...result,mode:'integrated'};
}
export async function sameOriginMutation(path,{method='POST',body,csrfToken,signal,version}={}) {
 if(isPortable())throw new Error('Koneksi API server memerlukan versi hosting HTTP/HTTPS. Draf tetap tersedia.');
 const url=new URL(path,location.origin);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||!['POST','PUT','PATCH','DELETE'].includes(method)||!csrfToken)throw new Error('Konfigurasi mutasi tidak diizinkan');
 const response=await fetch(url,{method,credentials:'same-origin',signal,headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken,'Idempotency-Key':crypto.randomUUID(),...(version?{'If-Match':version}:{})},body:JSON.stringify(body)});
 if(![200,201,204].includes(response.status))throw new Error(`HTTP ${response.status}. Perubahan belum dikonfirmasi selesai; draf tetap tersedia.`);
 return {persisted:true,data:response.status===204?null:await response.json()};
}
