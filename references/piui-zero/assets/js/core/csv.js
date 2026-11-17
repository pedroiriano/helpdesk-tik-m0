/** Quote every cell; formula protection also covers leading whitespace/control chars. */
export function csvCell(value) {
 let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function serializeCsv(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function downloadCsv(name, rows) {
 const url=URL.createObjectURL(new Blob([serializeCsv(rows)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
