/** The only permitted TrustedScriptURL is the fixed same-origin root SW. */
export function validateWorkerUrl(value,origin) {
 const url=new URL(value,origin);
 if(url.origin!==origin||url.pathname!=='/sw.js'||url.search||url.hash||url.username||url.password)throw new TypeError('Worker URL is not allowlisted');
 return url.href;
}
