# Handoff RM0-04

**Peran dan Banner Hero.** Kebijakan peran staf dan keanggotaan akun dipisah. Editor menyimpan draf lima banner. Penerbit atau Super Admin dengan mandat portal dapat menerbitkan versi. Pustaka Media menerima tanda calon Hero saat unggah. [ADR 0008](../docs/adr/0008-role-module-policy-and-hero.md) dan [bukti](../qa/remediation/rm0-04/role-hero/completion.json) menjelaskan batas izin, publikasi dan pengujian.

**Kategori dan penugasan.** [ADR 0011](../docs/adr/0011-reporting-directory-and-category-routing.md) menjelaskan pemisahan kategori pelapor, kategori terverifikasi, OPD pelapor dan tujuan penanganan. Master OPD, Bidang, Tim, dan Aturan Smart Dispatch sudah terhubung. Uji terisolasi membuktikan batas mandat, rekomendasi tim, saran pelimpahan, penerimaan dan pencabutan akses asal. Migrasi 031–033 aktif pada port 18080. Browser lokal tidak tersedia untuk pemeriksaan visual akhir. [Bukti dan cakupan](../qa/remediation/rm0-04/catalog-routing/completion.json). *(Catatan: ADR ini direkonsiliasi penomorannya dari `0007` menjadi `0011` pada 17 Nov 2026; hash historis manifest `catalog-routing` dipertahankan apa adanya).*

## Lima profil tugas — 13 November 2026

Penyelesaian lanjutan memperbaiki hasil Simpan. Grant baru dibuka sebagai record tersimpan dan konfirmasi tetap tampil setelah daftar dimuat ulang. API diuji pada PostgreSQL disposable untuk membuat, membaca kembali, mengubah, menolak versi lama dan mencabut akses. Gateway final cocok dengan 15 aset build. Smoke browser sebelumnya mencakup profil dan pratinjau, sedangkan koreksi Simpan dibuktikan lewat regresi listener dan uji HTTP terpisah.

Slice R4-UX-ACCESS menyederhanakan tampilan menjadi Operator, Teknisi, Koordinator, Pimpinan dan Administrator. Model frontend/admin-profiles.mjs memakai policy kanonis tanpa menyatukan role server. Akses khusus disimpan pada disclosure. Form akses menyaring akun, memilih organisasi/tim, memberi ringkasan dan pratinjau standar sesuai peran/grant ceiling; pengaturan teknis lanjutan tetap tersedia. Ubah mempertahankan izin lama serta mengunci akun/organisasi. Inisialisasi form generik diperbaiki. Dasbor memberi pintasan kerja berizin dan login cepat tidak memilih Super Admin otomatis.

Build Docker membutuhkan tambahan COPY policy JSON non-secret ke build stage web. Base image, resource, port, backend, database, kontrak dan seed tetap. Build/typecheck, regresi profil/navigasi/PIUI/UX, tes domain/API M1, gateway serta browser desktop/mobile representatif lulus. Tidak ada mutasi akses/tiket selama QA; hanya sesi lab. Akun petugas tetap mengikuti identitas yang sudah disediakan, bukan provisioning produksi. [Bukti](../qa/remediation/rm0-04/access-profiles/completion.json), [analisis](../qa/remediation/rm0-04/access-profiles/analysis.md), [panduan](../runbooks/peran-dan-akses.md). RM0-04 tetap IN_PROGRESS dan RM0-05 NOT_STARTED.

Status **IN_PROGRESS**. Kandidat lab tersedia pada gateway lokal port 18080. Lihat [completion](../qa/remediation/rm0-04/completion.json), [inventaris rute dan matriks UI](../qa/remediation/rm0-04/component-route-matrix.md), serta [checkpoint](../qa/remediation/rm0-04/checkpoint.json). RM0-05 berstatus NOT_STARTED.

## Perubahan dan pembuktian

- Hero PIUI Modern mempertahankan lima banner dan menempatkan CTA serta navigasi dalam alur layout. Mobile memakai satu CTA primer, dua sekunder, empat kontrol, dan lima thumbnail. Aturan kanonis memuat ukuran sentuh, akses keyboard, batas tinggi, serta penggunaan ikon Helpdesk.
- Panduan mengambil artikel terbit dari M8. Daftar, hasil pencarian dan halaman detail berbagi sumber data, filter izin dan cursor. Tautan lama dipetakan ke slug M8. Respons konten memakai no-store dan halaman membersihkan konten saat kehilangan jaringan. Pembaca membangun markup dari allowlist elemen dan atribut.
- Editor panduan dapat menulis, menyunting, menerbitkan, mengarsipkan dan memulihkan draf berdasarkan izin dan versi. Database disposable membuktikan transisi editorial, filter audience, konflik versi, pencabutan akses serta penolakan skrip.
- Dashboard PIUI Zero memakai KPI M9 menurut periode dan organisasi, tabel angka, denominator dan watermark. Antrean petugas memakai tabel PIUI Zero dengan tampilan kartu saat kontainer sempit dan filter yang mengikuti mandat serta URL.
- Receipt tampil segera setelah tiket diterima. Percobaan ulang lampiran tetap memakai ID tiket yang sama dan mempertahankan intent upload saat respons hilang. Media picker memakai dialog native, metadata, filter CLEAN, cursor server dan tautan unduh dengan ACL. Memilih referensi media mencatat referensi dalam uraian, sedangkan unggah berkas menciptakan lampiran.
- Katalog memakai combobox aksesibel dengan hasil M2 dan artikel M8 yang terbit, pembatalan kueri lama, navigasi keyboard dan tautan detail. Pipeline PIUI, aset brand dan modul sumber tetap dipakai.

## Gap sebelum fase dapat ditutup

- RM0-03 belum tuntas pada keputusan vendor dan eskalasi (DEC-M04), eksekusi artefak backup melalui runner, dan envelope penelitian (DEC-M10). Verifikasi UI yang bergantung pada operasi itu masih terbuka.
- R4-B dan R4-I memerlukan migrasi sisa inline style dan token lama, serta bukti contrast, zoom, reduced-motion dan footer di seluruh konsumen yang berlaku.
- R4-D dan R4-E memerlukan pembuktian UI end-to-end untuk review sebelum kirim, unggah parsial dan rekonsiliasi lost response, draft lintas akun, kedaluwarsa tracking, konflik petugas, serta aksi vendor/handoff/eskalasi yang berlaku.
- R4-F memerlukan smoke ekspor, keterlambatan proyeksi serta revokasi unduh di UI kandidat. R4-G membuktikan ARTICLE, dengan editor dan pembaca PAGE serta mutasi editorial dari browser disposable masih terbuka. R4-H memerlukan verifikasi lightbox penuh, pengikatan media ke target yang tepat, serta download dan reuse setelah pencabutan izin.
- Gateway detail panduan menyajikan shell HTTP 200. API objek hilang atau di luar scope mengembalikan 404 dan reader menunjukkan keadaan tidak tersedia.
- Browser menggunakan sesi Koordinator sintetis untuk pemeriksaan baca-saja. UAT pemilik, protected CI, kesiapan produksi dan kesetaraan arsitektur masih di luar cakupan bukti ini.

## Urutan lanjutan

Tutup prasyarat RM0-03 yang terkait dan lanjutkan skenario RM0-04 yang masih terbuka pada kandidat terisolasi. Gunakan completion dan matriks untuk menentukan pemeriksaan berikutnya. Mulai RM0-05 hanya setelah ada instruksi fase tersendiri.

## Pembaruan mobile 13 November 2026

[Bukti mobile](../qa/remediation/rm0-04/mobile/completion.json) memuat baseline, ukuran viewport, rute, interaksi dan hash build yang disajikan. Grid akses sekarang mengikuti 3/2/1 kolom. Kontrol utama berukuran setidaknya 44 px pada ponsel, input teks 16 px, tab Warga/ASN mengikuti keyboard, dan tombol tutup login Admin tersambung kembali ke dialog PIUI. Hero pendek serta landscape mempertahankan semua CTA dan lima thumbnail di dalam viewport. Toolbar galeri membungkus dengan fokus kembali ke pemicu. API dan data tiket tetap mengikuti mandat server. Cakupan ini memakai akun Operator sintetis dan pemeriksaan presentasi. Acceptance fase serta UAT manusia masih mengikuti gap dalam completion fase.

## Pembaruan navigasi Hero 13 November 2026

Arahan terbaru mengganti kelompok panah, penghitung dan jeda dengan pemilihan langsung melalui kelima thumbnail. Pergantian manual menjadi perilaku awal saat tombol jeda dihapus. Banner utama ponsel berukuran adaptif 56–160 px, memakai object-fit contain, dan mempertahankan gambar, teks, CTA serta thumbnail dalam Hero maksimum 100VH tanpa scroll internal pada ukuran yang diuji. Lihat [laporan Hero](../qa/remediation/rm0-04/hero-thumbnails/completion.json). Aturan kanonis menyesuaikan arahan ini.

## Pembaruan alur UX 13 November 2026

Entry laporan dimulai dari katalog dan login mempertahankan pilihan layanan melalui tujuan lokal tetap. Navigasi, sidebar dan footer mengikuti sesi/mandat organisasi aktif. Dialog review native mendahului handler commit yang sama. Pelacakan tamu membaca input ID yang benar dan mengirim capability hanya pada header. Daftar/detail memakai status berbahasa Indonesia, waktu konfirmasi berasal dari attempt server dan teks detail di-escape. Dashboard operator menawarkan pekerjaan yang tersedia.

Lihat [analisis](../qa/remediation/rm0-04/ux-flow/analysis.md), [manifest sumber](../qa/remediation/rm0-04/ux-flow/source-manifest.json) dan [bukti pemeriksaan](../qa/remediation/rm0-04/ux-flow/completion.json). Pengujian dibatasi pada komponen/alur terdampak, tanpa penulisan tiket bisnis baru ke database aktif. Review-to-send, idempotensi, capability positif dan input tidak tepercaya diperiksa dengan fixture terisolasi. Smoke browser memeriksa akun sintetis dan galat capability. Acceptance penuh RM0-04, gap RM0-03 serta UAT manusia tetap terbuka. RM0-05 tidak dimulai.

## Audit lifecycle sampai CLOSED 13 November 2026

Pengiriman akun login yang terhenti oleh checkbox required tersembunyi sudah diperbaiki. Ketersediaan aksi memakai helper bersama sesuai owner/role/mandat aktif/state. Vendor Koordinator, buka kembali, arsip, komentar dan unggah mengikuti hak akses. Konfirmasi memakai attempt aktif dan WIB; hasil tetap terlihat setelah CLOSED. Resolve dan konfirmasi memakai durable intent dengan CAS asli saat retry.

M3 mencatat balasan petugas kepada pemohon sebagai respons manusia pertama secara atomik. Catatan internal dan komentar pemohon tidak mengisi clock tersebut. Balasan petugas pada RESOLVED tidak lagi dianggap feedback pemohon. Regresi HTTP/PostgreSQL baru membuktikan keduanya dan guard auto-close tetap berlaku.

Browser memakai satu tiket pada database disposable hingga CLOSED, termasuk informasi tambahan, eskalasi Pimpinan, penugasan Koordinator dan dua upaya perbaikan dengan REJECT/ACCEPT. Bukti query persisten dan deadline 24 jam kalender tersimpan sebelum cleanup. Ini menutup gap jalur utama/keberatan R4-D/R4-E untuk cakupan tersebut. Gap upload parsial, lost-response browser, draft/account recovery, ekspor/editorial dan cabang vendor/handoff UI tetap mengikuti acceptance fase. Cabang vendor/handoff/auto-close memiliki bukti integrasi, bukan klaim smoke semua cabang UI.

Lihat [completion](../qa/remediation/rm0-04/lifecycle-review/completion.json), [analisis](../qa/remediation/rm0-04/lifecycle-review/analysis.md) dan [persistensi browser](../qa/remediation/rm0-04/lifecycle-review/browser-ticket-persistence.json). Port kerja tetap 18080; database kerja tidak dipakai untuk mutasi tiket uji. RM0-04 IN_PROGRESS dan RM0-05 NOT_STARTED.

## Konsistensi Web Admin 13 November 2026

Peta frontend/admin-navigation.mjs menyatukan label/URL/kelompok/permission bagi sidebar desktop, drawer mobile, footer, pencarian, pemilih halaman dan pintasan kanonis. Konteks H1/tab/breadcrumb mengikuti kind/filter dan menandai induk antrean pada detail. Perpindahan halaman native menggantikan hook pushState yang tidak mengikuti Back. Picker tetap disabled sampai binder siap, sebelum pemuatan data master.

Profil memakai sesi/peran aktual. Tombol Keluar memanggil auth/logout server dan kembali ke halaman masuk Admin. Akun tamu atau tanpa mandat memperoleh keadaan akses yang jelas; consumer tidak memuat modul privat tersebut. Admin konfigurasi tetap tidak otomatis mempunyai izin membaca tiket. Halaman masuk menjelaskan tugas peran dan picker lab hanya memuat petugas. Drawer mobile memiliki label lengkap sekalipun rail desktop diciutkan.

Lihat [analisis](../qa/remediation/rm0-04/admin-navigation/analysis.md), [completion](../qa/remediation/rm0-04/admin-navigation/completion.json) dan [aturan kanonis Admin](../docs/06_ATURAN_UI_UX_WEB_ADMIN.md). Backend, kontrak, migrasi, dependency, resource dan data bisnis tidak diubah. Verifikasi browser serta batas cakupan tercatat pada kandidat.

## Penutupan UI Matrix & Verifikasi Browser Lengkap — 17 November 2026

- **Stack Compose port `18090`:** Seluruh layanan Helpdesk berjalan sehat di `http://127.0.0.1:18090` (`helpdesk-m0`, `helpdesk-m0-db`, `helpdesk-m0-scanner`, `helpdesk-m0-nginx`) tanpa mengganggu kontainer lain pada host (`teman-dinamis-gateway-1` pada `18080`).
- **Audit & perbaikan kanonis:** Menghapus 100% HTML `style="..."` agar patuh CSP `style-src 'self'`; menambahkan ringkasan validasi per-field (`formEl.noValidate = true` + `[data-validation-summary]`); menambahkan klaim `min-inline-size: 0` pada `fieldset.hd-report-context` agar `/lapor.html` bebas overflow horizontal di ponsel `390x844`; memperbaiki modal ekspor M9 (`timezone: 'Asia/Jakarta'` dan `res.state`); mengembalikan `faq.js` byte-identik referensi sambil menjaga single-accordion landing melalui `hero-public.js`; menambahkan mode `PAGE` di M8 `/halaman` & `/halaman/{slug}`, sistem modal terpusat di `business.css`, dan pratinjau/lightbox lampiran tiket.
- **Verifikasi Microsoft Edge Headless CDP (`11/11 PASS` di [browser-final.json](../qa/remediation/rm0-04/browser-final.json)):**
  - `R4-B`: 25 cek rute desktop/mobile tanpa overflow maupun pelanggaran CSP/console/exception + accordion `/` & `/faq.html`.
  - Kandidat 13 Nov (`access-profiles`, `catalog-routing`, `role-hero`): 5 profil login, `grant_ceiling` negatif + Edit/Simpan reopens & persist, 25+ kategori pelaporan & 37 OPD via cursor, aturan Smart Dispatch persist lintas reload, kebijakan peran, serta 5 banner Hero tersinkron `<= 100vh` (`hero-desktop.png`, `hero-mobile.png`).
  - `R4-D`: Validasi fokus per-field, modal review, simulasi **CDP Fetch lost-response** unggah lampiran dengan retry `Idempotency-Key` identik, logout/revoke capability `/lacak.html`, serta autosave draft ASN terisolasi antar-akun.
  - `R4-E` & `R4-F`: Antrean admin desktop/mobile (`admin-tickets-mobile.png`), UI banner `409 Conflict` + reload saat dispatch bersaing, transisi Teknisi `START` -> `RESOLVE`, laporan & unduh CSV M9 HTTP 200 dengan tolak lintas-OPD (404) & pasca-logout (401).
  - `R4-G`, `R4-H`, `R4-I`: Authoring & terbit `PAGE`, temuan combobox di `/layanan.html`, render publik `/halaman/{slug}`, arsip menolak akses publik, galeri lightbox keyboard/zoom 125%/Esc (`lightbox-desktop.png`), tab media `M3`/`M8`, pratinjau lightbox lampiran `CLEAN` & penolakan lintas-OPD, footer 2-tier Admin bersih, reflow zoom 200% (`640px`), dan `prefers-reduced-motion`.
- **Gate pendukung:** `test_rm0_04_editorial.py`, `test_piui_build.py`, `test_ux_flow.mjs`, `test_admin_navigation.mjs`, `test_admin_profiles.mjs`, `test_ticket_actions.mjs`, `test_business_intent.mjs`, `test_public_cache.mjs`, `test_m0_13_links.py`, `test_m0_12_shutdown.py`, `test_modal_and_mobile.py` (100% PASS). Phase `RM0-04` berstatus `DONE_VERIFIED` untuk lab lokal; `RM0-05` tetap `NOT_STARTED`.
