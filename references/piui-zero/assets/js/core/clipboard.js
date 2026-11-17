export async function copyText(value) {
 if(!navigator.clipboard?.writeText)throw new Error('Clipboard tidak tersedia. Pilih teks lalu gunakan perintah Salin perangkat.');
 await navigator.clipboard.writeText(String(value));
}
