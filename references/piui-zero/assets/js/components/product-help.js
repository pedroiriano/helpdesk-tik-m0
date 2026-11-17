import { appHref, routePath } from '../core/environment.js';
import { el,button,actionGroup,contentStack } from '../core/dom.js';
const bound=new WeakSet();
export function initProductHelp(root=document) {
 const main=root.querySelector('main');if(!main||bound.has(main))return;bound.add(main);
 const guide=el('details','piui-product-help'),body=contentStack();guide.append(el('summary','','Bantuan halaman & pintasan'),body);
 const tips={dashboard:'Tambah tiket membuka form. Klik judul tiket untuk mengedit, Geser untuk pindah tahap dan Batalkan arsip untuk memulihkan aksi terakhir.',notifications:'Buka Detail menandai pesan dibaca. Status baca terpisah dari prioritas; counter drawer dan halaman mengikuti model yang sama.',users:'Pilih Semua hanya memilih halaman aktif. Periksa jumlah pilihan di luar halaman sebelum aksi massal.',analytics:'Bandingkan agregasi melalui panel definisi metrik. Enter/Space dapat memilih klaster atau baris grafik.',gallery:'Tambahkan berkas untuk preview lokal. Metadata dapat diedit; tombol Sebelumnya/Berikutnya atau panah mengubah media pada lightbox.',settings:'Terbitkan pertama kali menampilkan before/after. Konfirmasi berikutnya tetap lokal bila adapter server belum dipasang.'};
 const key=routePath().split('/').filter(Boolean)[1];if(tips[key])body.append(el('p','',tips[key]));
 const text=el('p','','Tab / Shift+Tab: pindah kontrol. Enter / Space: aktifkan tombol. Escape: tutup popup. Ctrl/⌘+K: cari menu. Filter tabel dapat dibagikan melalui URL. Perubahan data contoh hanya ada pada memori halaman.');
 const link=el('a','piui-btn piui-btn--secondary piui-btn--sm','Tentang PIUI Zero');link.href=appHref('/about/index.html');main.append(guide);
 const preferences=button('Tutup panduan',()=>{guide.open=false;guide.querySelector('summary').focus();});body.append(text,actionGroup(link,preferences));
}
