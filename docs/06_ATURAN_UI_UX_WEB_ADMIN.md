# Aturan kanonis UI/UX Web Admin Helpdesk

Berlaku untuk ruang kerja petugas, pengelolaan, dashboard, antrean/detail tiket dan halaman masuk. Gunakan shell, drawer, popover, komponen, CSS dan interaksi asli PIUI Zero melalui adapter build proyek. Sumber pada `references/piui-zero` dipertahankan.

## Peta menu tunggal

- `frontend/admin-navigation.mjs` menjadi sumber label, URL, kelompok, deskripsi halaman, permission dan konteks navigasi. Desktop, drawer mobile, footer, navigasi kerja tiket, pemilih halaman dan pencarian menu mengambil data dari sumber ini.
- Gunakan kelompok Pekerjaan, Layanan dan konten, Organisasi dan akses, Pengawasan dan sistem, serta Bantuan dan portal. Kelompok tanpa menu yang diizinkan disembunyikan.
- Label memakai Bahasa Indonesia yang menjelaskan tugas. ID modul M1–M9, kode role, nama tabel dan rincian implementasi tidak menjadi nama menu.
- Menu mengikuti jenis akun serta permission pada organisasi aktif. Administrator konfigurasi tidak otomatis memperoleh `ticket.read`. API tetap memeriksa izin per objek dan tindakan.
- Jangan mengaktifkan launcher/badge notifikasi fixture pada halaman kerja nyata. Jumlah notifikasi hanya boleh berasal dari API berizin.
- Identitas/peran awal tidak boleh memakai profil contoh Super Admin. Label petugas, scope organisasi aktif dan mode lab mengikuti sesi aktual. Kontrol privat disembunyikan selama sesi diperiksa.

## Orientasi dan perpindahan halaman

- Judul H1, judul tab, breadcrumb dan penanda aktif mengikuti konteks yang sama. Query `kind` membedakan halaman pengelolaan; query antrean membedakan filter tugas.
- Antrean menjadi induk detail tiket. Gunakan `aria-current="location"` pada menu induk saat membaca detail, dan `aria-current="page"` untuk halaman menu langsung.
- Perpindahan modul menggunakan navigasi URL native. Hindari pergantian sebagian halaman dengan `pushState` tanpa pemulihan state dan penanganan tombol Kembali.
- Kontrol navigasi yang memerlukan JavaScript tetap disabled sampai handler siap; pemasangan handler tidak menunggu pemuatan data master.
- Pemilih Halaman pengelolaan memuat label dan hak akses yang sama dengan sidebar. Menu yang tidak diizinkan tidak menjadi opsi aktif.
- Pintasan dashboard menjelaskan pekerjaan, misalnya verifikasi, disposisi atau tugas teknisi. Jangan menampilkan tombol modul tanpa mandat.

## Akun dan keadaan tanpa akses

- Super Admin mengelola batas tindakan per peran di **Peran dan Akses Modul**. Penugasan izin akun tetap melalui **Akun dan hak akses** pada OPD yang dipilih. Pilihan izin diambil dari kebijakan server. Cantumkan alasan dan versi saat menyimpan perubahan.
- **Banner Hero** berada dalam **Layanan dan konten**. Gunakan lima slot, judul dan teks alternatif setiap gambar, serta kontrol urutan yang dapat dipakai dengan keyboard. Pustaka media menandai calon gambar Hero pada saat unggah. Draf dan terbit memiliki tindakan dan izin terpisah.
- **Tanya Jawab (FAQ)** tersedia pada menu khusus `?kind=faqs` maupun tab `FAQ` di **Panduan dan artikel** (`M8` `/api/v1/knowledge/faqs`), lengkap dengan kolom topik (`category_label`), urutan tampil (`sort_order`), target audience, alur editorial `DRAFT -> PUBLISHED -> ARCHIVED -> RESTORE`, dan pengamanan `expected_version` CAS.
- Pengelola berizin dapat menambah, menyunting, dan mengarsipkan master data termasuk **Akun pengguna (`?kind=subjects`)**, **Layanan**, **Kategori**, **PD / Unit Kerja** (penamaan ringkas konsisten menggantikan klausa panjang "Perangkat Daerah dan Unit Kerja"), **Bidang**, **Tim teknis**, dan **Pemeliharaan sistem** (jendela *Under Maintenance* Terjadwal maupun Tidak Terjadwal di `M1`).
- Seluruh dropdown/combo box pada Web Admin menggunakan komponen setara **Select2** dengan pencarian instan dan navigasi keyboard, serta tabel pengelolaan menggunakan **DataTables** (`admin-datatable.ts`) untuk pencarian tabel, pengurutan kolom, dan jumlah baris tampil.
- Konsistensi Margin, Padding, dan Gap 8-point di seluruh Web Admin: padding kartu/sub-formulir `24px 28px`, padding sel tabel `12px 16px`, setiap sel tindakan wajib membungkus tombol di dalam `.hd-row-actions` dengan `gap: 8px 10px` (tidak boleh saling menempel saat sejajar maupun ter-wrap), toolbar tidak memakai margin `.hd-actions` bersarang ganda, dan field di dalam `.hd-form-grid` mengandalkan grid `gap: 20px 24px` secara simetris.

### Lima profil tugas

- Pilihan utama mengikuti `frontend/admin-profiles.mjs`: Operator, Teknisi, Koordinator, Pimpinan dan Administrator. L1/L2 merupakan tingkat kompetensi teknisi, bukan profil login tambahan.
- Pelapor tetap memakai Web Publik. Editor, Penerbit, Auditor serta pengaturan akses pemohon berada pada bagian akses khusus. Akun otomatis dan vendor disabled tidak menjadi pilihan profil manusia.
- Administrator menaungi ADMIN_OPD, PLATFORM_ADMIN dan SUPER_ADMIN hanya sebagai kelompok tampilan. Label lingkup tetap ditampilkan. Jangan menyatukan permission atau otomatis memilih Super Admin pada akses cepat.
- Formulir akses mengikuti Profil tugas akun → Akun pengguna → OPD/organisasi → Tim opsional → Masa berlaku → Ringkasan → Alasan dan Simpan. Profil menyaring akun yang perannya sudah disediakan oleh M1; formulir ini tidak mengubah role identitas atau membuat akun petugas baru.
- Akses standar adalah irisan izin peran kanonis dengan grant ceiling Administrator pada organisasi aktif yang memiliki `identity.grant`. Tombol menyiapkan pratinjau; perubahan baru dikirim melalui Simpan ke server. Tidak memberikan akses lintas OPD secara implisit.
- `system.purge.request`, `system.job`, `system.maintenance` dan `identity.organization.create` tidak ditambahkan melalui akses standar. Bila masih diizinkan server, kebutuhan tersebut dipilih secara eksplisit pada pengaturan lanjutan.
- Saat Ubah, pertahankan seluruh izin tersimpan dan kunci akun/organisasi sebagaimana kontrak API. Jangan menerapkan ulang template otomatis. Izin di luar mandat saat ini ditandai dan tidak diam-diam dibuang.
- Halaman awal menjelaskan pekerjaan sesuai profil dan memberi satu pintasan utama yang lolos pemeriksaan mandat. Menu lain tetap memakai peta kanonis dan API tetap menjadi otoritas izin final.

- Halaman yang memerlukan petugas menyediakan keadaan masuk atau penjelasan di luar tugas, dengan tautan kembali yang jelas. Jangan menampilkan konsol master sebagai pratinjau tamu atau memuat data privat untuk kemudian disembunyikan.
- Ganti akun lab berada pada profil atau halaman masuk. Hindari pemilih identitas lab di setiap halaman kerja.
- Pemilih akun Admin hanya menampilkan identitas petugas. Jalur pemohon publik/ASN tetap melalui portal. Adapter lab tidak dianggap integrasi identitas produksi.
- Keluar akun memanggil logout server melalui transport CSRF yang sama, menonaktifkan tombol selama permintaan, memberitahukan pergantian sesi ke tab lain, dan kembali ke halaman masuk Admin.
- Halaman masuk menjelaskan langkah masuk dan tugas peran. Rincian cookie, protokol dan implementasi keamanan ditempatkan pada dokumentasi teknis.

## Mobile, keyboard dan pencarian

- Desktop dan mobile mempertahankan urutan, label, target dan permission yang sama. Drawer mobile menampilkan label lengkap meskipun sidebar desktop menggunakan mode ikon.
- Pertahankan mekanisme drawer, penutupan Escape, fokus, popover profil dan pencarian native PIUI. Tooltip memberi nama menu pada sidebar yang diciutkan.
- Pencarian cepat menampilkan hanya menu yang tersedia untuk sesi aktif, tanpa duplikasi atau rute contoh yang sudah tidak dipakai. Pertahankan navigasi keyboard native untuk mencari dan membuka hasil.
- Gunakan token PIUI, ukuran kontrol sentuh minimum 44 px, pembungkusan teks yang wajar, dan scroll hanya pada pembungkus yang memerlukannya. Jangan menutupi label demi memaksakan kesamaan layout desktop.

## Pembuktian perubahan

Perubahan menu diuji terhadap kesamaan desktop/mobile/palette/pemilih halaman, penanda query/detail, role tanpa mandat, organisasi nonaktif, serta logout server. Browser mewakili peran dan breakpoint yang terdampak. Pisahkan hasil visual lokal dari UAT, matriks bisnis penuh dan keputusan rilis.
