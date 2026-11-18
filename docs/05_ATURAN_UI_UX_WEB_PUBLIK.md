# Aturan kanonis UI/UX Web Publik Helpdesk TIK Kota Depok

Versi 1.1. Berlaku sejak 4 November 2026 berdasarkan arahan pemilik. Berlaku untuk landing, halaman umum, daftar, formulir, halaman detail statis, dan halaman detail yang diperbarui JavaScript pada Web Publik.

## Sumber acuan dan prioritas

1. Aturan ini menetapkan proporsi dan perilaku UI Web Publik.
2. frontend/public-ui.css adalah stylesheet kanonis yang mengembangkan token dan komponen PIUI Modern. frontend/public-pages.css melengkapi konsumen halaman dan detail.
3. frontend/public-ui.mjs memasang header, footer, stylesheet, favicon, dan penanda versi yang sama melalui build.
4. frontend/landing-page.mjs mengomposisi landing dari markup PIUI asli. Hero layar penuh adalah komponen khusus landing.
5. HTML, CSS, JavaScript dan aset referensi tetap berada pada references/piui-modern. Perubahan implementasi dilakukan pada adapter atau stylesheet proyek.

Seluruh halaman hasil build wajib memuat data-helpdesk-public, data-public-ui-version="1.1" dan /helpdesk/public-ui.css. landing.css menjadi URL kompatibilitas yang mengimpor stylesheet kanonis. Halaman admin mengikuti PIUI Zero pada scope terpisah.

## Token dan proporsi wajib

| Elemen | Ukuran dan perilaku |
|---|---|
| Container | Maksimum 1200 px, gutter fluid 16–48 px |
| Isi | 16 px, line-height 1.65–1.7 |
| Judul hero landing | Fluid sesuai ruang viewport, line-height 1.08 |
| H1 halaman/detail | 32–48 px, line-height 1.15, maksimal 22 karakter tipografis per baris sebagai batas lebar awal |
| H2 section | 28–44 px, line-height 1.2 |
| H2 panel detail | 22–28 px, line-height 1.3 |
| Judul kartu | 18–22 px, line-height 1.3–1.35 |
| Label dan metadata | 12–15 px, line-height minimal 1.5 |
| Padding section | 48–88 px |
| Gap grid | 16–24 px |
| Padding kartu | 20–28 px, simetris |
| Gap isi kartu | 12–16 px |
| Tombol, filter, tab, input | Area interaksi minimal 44 px |
| Paragraf penjelasan | Lebar maksimal 64ch, konten artikel 72ch |
| Radius dan font | Gunakan token PIUI yang sudah tersedia |

Ukuran berbasis rem/clamp harus tetap mengikuti preferensi ukuran font browser. Gunakan hierarki H1/H2/H3 sesuai struktur informasi. Judul memakai sentence case, label navigasi pendek boleh uppercase. Hindari huruf besar penuh untuk uraian panjang.

Gap mengatur jarak antaranak komponen. Margin mengatur hubungan antarblok. Padding mengatur batas konten terhadap tepi. Jangan menumpuk gap dan margin untuk menghasilkan jarak yang sama.

## Header dan footer

Semua halaman memakai header/footer dari createPublicUI. Tautan bersama memakai path absolut dari root agar bekerja pada detail bertingkat. Menu asli mempertahankan keyboard, Escape, fokus kembali ke pemicu, aria-expanded, serta pemisahan area latar saat terbuka.

Footer desktop terdiri dari branding, navigasi, dan koneksi layanan. Tablet memakai dua kolom, mobile satu kolom. Footer mengikuti tinggi konten. Branding maksimal 20 px dan ikon 56 px. Tautan biasa memakai 15 px. Hak informasi dan tautan sekunder berada pada baris bawah.

Status API memiliki kelas hd-service-status sendiri, satu mount, tombol minimal 44 px dan teks yang mengikuti hasil API. Jangan memakai kelas signature branding atau kontrol hero pada widget status.

## Landing dan hero

Hero maksimal 100vh, dengan 100svh untuk kestabilan viewport mobile. Konten hero desktop memakai grid normal sehingga tinggi teks diperhitungkan. Mobile menyusun gambar, judul/uraian/CTA, lalu satu kelompok navigasi banner.

Kelompok banner menyediakan tepat lima slide dari aset tanpa teks. Sesuai arahan 13 November 2026, pengguna memilih banner langsung melalui kelima thumbnail. Kelompok thumbnail memenuhi satu baris desktop.

Di bawah 640 px, gambar banner utama memakai ukuran adaptif 56–160 px dengan object-fit contain. Kelima thumbnail berukuran fleksibel tampil dalam satu baris setelah CTA. Tombol CTA dan thumbnail memiliki target sentuh setidaknya 44 × 44 px pada viewport ponsel yang didukung. Pertahankan label aksesibel lengkap, fokus terlihat, roving tabindex dan aria-selected. Pemilihan banner mendukung sentuh dan keyboard.

Progress bar, garis separator kelompok kontrol, serta caption slide terpisah ditiadakan. Status aktif ditunjukkan melalui thumbnail, nomor slide dan aria-selected. Navigasi cepat berada di bawah kelompok banner. CTA tidak boleh bertumpuk dengan kelompok navigasi.

Jarak CTA ke thumbnail minimal 10 px pada viewport pendek yang diuji. Thumbnail harus terlihat di atas scrim. Gambar memakai aset Helpdesk dari assets. Judul dan CTA tetap berupa HTML. Area gambar memiliki dimensi/aspect-ratio untuk menjaga kestabilan layout.

## Halaman, kartu dan detail

Halaman umum memakai banner judul dengan clearance header. Detail memakai breadcrumb, judul/ringkasan, aksi, ilustrasi, metadata, isi panduan, dan navigasi terkait. Header halaman detail mengikuti tinggi konten.

Gunakan komponen PIUI yang sama untuk tombol, kartu, daftar, filter, accordion, breadcrumb dan navigasi terkait. Konten spesifik fitur mengisi slot komponen. Halaman detail statis dan dinamis harus mengikuti token yang sama.

Kartu langkah memakai padding 24 px pada semua sisi, gap nomor ke isi 12 px dan gap judul ke uraian 12 px. Kartu pendukung memakai gap 16 px dan justify-content flex-start. Hindari space-between yang menghasilkan ruang kosong besar di antara judul dan uraian.

Metadata label/nilai sejajar pada grid. Uraian panjang harus membungkus. Kartu tidak memakai tinggi tetap yang memotong teks. Gunakan minmax(0, 1fr) dan min-width 0 pada grid yang menampung konten panjang. Jangan menyembunyikan overflow dokumen untuk menutupi kesalahan layout.

## Formulir, daftar dan tabel

Form memakai label terhubung, jarak label-field 8 px, jarak grup 24 px, error dekat field dan ringkasan error bila relevan. Pertahankan validasi dan indikator loading/error/success yang benar. Textarea dapat diperbesar vertikal.

Daftar memakai struktur ul/ol/dl yang sesuai. Tabel menyediakan heading/caption dan area scroll horizontal bila lebar dibutuhkan. Halaman tidak boleh ikut meluber. Data besar mengikuti pagination server-side saat API tersedia. Filter aktif ditandai secara visual serta melalui atribut aksesibilitas.

Jangan mengklaim simpan atau kirim berhasil dari tombol UI tanpa konfirmasi server. Status pengembangan dan data contoh harus terlihat pada fitur yang masih memakai fixture.

## Aturan kanonis tombol aksi dan interaksi (Button Design System)

1. **Button Affordance Wajib**: Setiap elemen tombol interaktif (`.btn`, `<button>`, atau `<a>` yang difungsikan sebagai aksi) wajib memiliki kontur visual yang tegas berupa latar belakang terisi (*filled/glassmorphic surface*), batas tepi (*border* kontras halus minimal 1 px), radius sudut terukur (6–8 px), ketinggian sentuh minimal 40–44 px, padding proporsional (8–18 px), dan bayangan halus (*box-shadow*). Dilarang keras menampilkan tombol berupa teks polos melayang (*naked text*) tanpa kontur atau latar belakang.
2. **Ikon Semantik Kontekstual**: Seluruh tombol aksi portal, navigasi modul tiket, pemuatan ulang, paginasi antrean/komentar, dan aksi formulir wajib dilengkapi ikon semantik (`.hd-btn-icon`) untuk mempercepat identifikasi visual pengguna dan menghilangkan ambiguitas (misal: 📋 Katalog Layanan, 📑 Daftar Tiket, 🔍 Lacak Tiket Tamu, 🔐 Masuk SSO ASN, 🔄 Muat Ulang Tiket, ← Sebelumnya, Berikutnya →, 🚀 Kirim Laporan, ✓ Sahkan, ✕ Tolak, 👷 Tugaskan Teknisi, 👍 Setuju, ⚠️ Keberatan).
3. **Standar Tipografi & Huruf**: Teks tombol menggunakan sentence case atau Title Case wajar dengan bobot font semi-bold/bold (font-weight 600) dan letter-spacing proporsional. Dilarang memaksakan huruf kapital penuh (*forced full uppercase*) yang mengurangi keterbacaan (*readability*).
4. **Hierarki Semantik Varian**:
   - **Primary (`.btn-primary`)**: Menggunakan gradien biru kedinasan Pemkot Depok (`linear-gradient(135deg, #1f6feb 0%, #0d419d 100%)`) untuk aksi utama formulir dan komitmen operasional (kirim laporan, simpan, sahkan verifikasi, buka pelacakan).
   - **Secondary (`.btn-secondary`)**: Permukaan netral gelap dengan kontur terang (`rgba(240, 246, 252, 0.22)`) untuk aksi pelengkap (muat ulang, buka pustaka media, batal, pratinjau).
   - **Success (`.btn-success`)**: Gradien hijau kedinasan untuk persetujuan atau penyelesaian positif (disposisi teknisi, konfirmasi selesai tiket, terima handoff OPD, pulihkan arsip).
   - **Danger (`.btn-danger`)**: Gradien merah peringatan untuk aksi penolakan, terminasi, atau pencabutan (tolak laporan, ajukan keberatan, cabut kunci pelacakan, konfirmasi arsip).
   - **Warning (`.btn-warning`)**: Gradien amber/oranye untuk jeda operasional berizin (pause SLA) atau eskalasi berjenjang.
   - **Pager Navigation (`.hd-pager-nav`)**: Toolbar paginasi rounded glassmorphic dengan navigasi panah semantik `← Sebelumnya` dan `Berikutnya →`.
   - **Filter Antrean (`.hd-queue-filters`)**: Kapsul filter peran (`.hd-btn-filter`) dengan sorotan aktif biru menyala (`.is-active`) dan ikon peran yang membedakan tugas Operator, Pimpinan, dan Teknisi.
5. **State Interaktif & Aksesibilitas**: Setiap tombol wajib memiliki state `:hover` (translasi naik 1 px, elevasi bayangan, border lebih cerah), `:active` (skala 0.98), `:focus-visible` (kontur fokus biru tegas 2 px dengan offset), dan `:disabled` (opasitas 0.45, kursor not-allowed, tanpa bayangan). Tombol yang memicu dialog wajib memuat `aria-haspopup="dialog"`.

## Aturan kanonis margin, padding dan sistem spacing (Layout Spacing System)

1. **Prinsip "Breathing Room" (Ruang Bernapas Visual)**: Seluruh elemen antarmuka dilarang keras berhimpitan (*glued/touching borders*) tanpa jarak pemisah visual yang proporsional. Spacing mengatur ritme hierarki informasi dari tingkat mikro (ikon ke teks) hingga tingkat makro (section ke section).
2. **Skala Spacing Kanonis**:
   - `4 px` (micro): Jarak ikon ke teks pada badge atau label mikro.
   - `8 px` (tight): Jarak label form ke kontrol input, margin ikon ke teks tombol, gap badge metadata.
   - `12 px` (compact): Gap elemen kompak, radius kartu standar, margin bawah judul kartu ke deskripsi.
   - `16 px` (regular): Gap standar tombol aksi (`.hd-actions`, `.hd-hero-cta-wrap`), padding horizontal input, margin antar-paragraf panduan.
   - `20 px` (comfortable): Margin bawah setiap grup formulir (`.vy-input-group`), padding kartu konten standar, margin vertikal toolbar.
   - `24 px` (spacious): Gap grid kartu antarmuka desktop, margin atas kelompok tombol aksi formulir, padding kartu dokumen kedinasan.
   - `28–32 px` (large): Margin pemisah teks deskripsi hero ke tombol CTA (`.hd-hero-cta-wrap`), padding area dropzone berkas (`.hd-dropzone`), padding modal dialog.
   - `48–88 px` (section): Padding vertikal blok section utama (`padding-block: clamp(48px, 6vw, 88px)`).
3. **Standar Spacing Tombol Hero Utama (`.hd-hero-cta-wrap`)**:
   - **Gap Antar-Tombol**: Wajib `gap: 16px` pada desktop dan tablet, adaptif `gap: 12px` pada mobile. Dilarang keras menempel (`gap: 0`).
   - **Margin Pemisah**: `margin-top: 28px` dari teks deskripsi `.vy-ref-hero__mobile-value` dan `margin-bottom: 24px` sebelum kontrol stage banner.
   - **Dimensi & Padding**: Padding tombol `12px 24px`, tinggi sentuh `min-height: 48px`, dan radius `border-radius: 10px`.
   - **Kontras Visual Tinggi**: Tombol utama (`.hd-hero-btn--primary`) bergradien biru royal dengan bayangan elevasi; tombol sekunder (`.hd-hero-btn--secondary`) berlatar gelap kontras tinggi (`rgba(18, 24, 34, 0.92)`) dengan border `rgba(255, 255, 255, 0.28)` dan teks putih `#ffffff` tajam yang kontras di atas seluruh varian ilustrasi latar hero.
4. **Standar Spacing Komponen Inti**:
   - **Formulir (`.vy-contact-form`, `.vy-input-group`)**: Margin antar input group `20 px`, jarak label ke input `8 px`, padding dalam kontrol input/select/textarea `10px 14px`, margin status submission `16 px`.
   - **Kartu & Panel (`.vy-path-card`, `.piui-card`, `.hd-progress-card`)**: Padding kartu simetris minimal `24 px` (mobile) hingga `28 px` (desktop), gap grid kartu `20–24 px`, pemisah tombol aksi bawah kartu menggunakan `margin-top: auto` dan `padding-top: 14px`.
   - **Toolbar Aksi (`.hd-actions`, `.hd-ticket-nav`, `.hd-pager-nav`)**: Padding container toolbar `8px 14px`, gap tombol `10–12 px`, margin blok toolbar `margin-block: 18px 24px`.
   - **Dropzone Berkas (`.hd-dropzone`)**: Padding area dropzone `32px 24px`, margin atas ke label `8 px`, margin bawah ke opsi pustaka media `12 px`.
   - **Timeline Riwayat (`.hd-timeline-feed`)**: Padding kiri feed `28 px`, jarak vertikal antar-node item `24 px`, padding kartu riwayat `16px 20px`.
   - **Modal Dialog (`.hd-modal-card`, `.piui-dialog`)**: Padding container dialog `24px 28px`, jarak header ke body `16 px`, margin grup tombol aksi dialog `margin-top: 20px` dengan `gap: 12px`.
   - **Footer (`.vy-footer`)**: Padding atas `48 px`, padding bawah `32 px`, gap grid kolom `32 px`, margin antartautan `10–12 px`.

5. **Standar Spacing, Margin, Padding & Anti-Tumpang-Tindih Web Admin (PIUI Zero & Helpdesk Master)**:
   - **Kartu Sesi Lab & Quick Login Header (`.hd-session`)**:
     - Padding kartu simetris `20px 24px`, margin pemisah `margin-block: 16px 24px`, border-radius `10px`.
     - Tata letak dua sisi terorganisasi (`.hd-session-inner`): Info identitas (`.hd-session-identity`) dan formulir login peran cepat (`.hd-admin-quick-form`).
     - Grup dropdown peran (`.hd-quick-select-group`): Label dan dropdown `<select>` dikelompokkan dengan `gap: 10px`, lebar select adaptif proporsional (`min-width: 240px; max-width: 360px;`), dilarang melar ke 100% pada quick login agar tidak memotong baris tombol.
     - Grup tombol aksi peran (`.hd-quick-btn-group`): Tombol `[Aktifkan Sesi]`, `[Antrean Tiket Petugas]`, dan `[Keluar]` dibungkus dalam container terpisah dengan `display: inline-flex; gap: 10px; flex-wrap: wrap;` sehingga tidak ada border yang berhimpitan/menempel (`touching borders`).
   - **Standardisasi Kartu Admin (`.piui-card`)**: Padding simetris `24px 28px`, margin antar-kartu `margin-bottom: 24px`, radius sudut `10px`, elevasi bayangan halus.
   - **Toolbar & Tombol Aksi Admin (`.hd-actions`, `.piui-btn`)**:
     - Jarak pemisah antar-tombol aksi wajib `gap: 12px`, dilarang keras menempel (`gap: 0`).
     - Dimensi tombol admin standar: `min-height: 38px`, padding `8px 16px`, radius `6px`. Untuk varian kecil (`.piui-btn--sm`): `min-height: 34px`, padding `6px 12px`.
   - **Tab Navigasi Sub-Modul Admin (`[data-hd-m9-tabs]`, `[data-hd-m11-tabs]`, `[data-hd-media-tabs]`)**:
     - Wadah tab menggunakan `display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;` dengan border pemisah bawah `1px solid var(--piui-border-subtle)`.
   - **Grid & Field Formulir Admin (`.hd-form-grid`, `.piui-field`)**:
     - Grid formulir responsif: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` dengan `gap: 18px 24px` dan `margin-bottom: 22px`.
     - Jarak margin vertikal antar-field: `margin-bottom: 16px`, jarak label ke input `8 px`. Kontrol input/select/textarea admin: `min-height: 40px`, padding `8px 12px`.
   - **Tabel Data Master & Tombol Aksi Baris (`.hd-table-wrap`, `.piui-table`)**:
     - Padding sel tabel: `padding: 12px 16px`.
     - Tombol aksi pada kolom Tindakan (`.hd-row-actions`): dibungkus dalam container `display: flex; gap: 8px; flex-wrap: wrap; align-items: center;` sehingga tombol aksi tidak berhimpitan.
     - Paginasi tabel (`nav[aria-label="Halaman master"]`): `display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px;`.
   - **Pesan Status & Notifikasi Admin (`p[data-hd-status]`, `p[data-hd-login-status]`)**:
     - Tidak boleh menempel langsung ke kartu atas/bawah. Diberikan `margin: 14px 0 20px 0`, padding `10px 16px`, border-left `4px solid #3b82f6`, dan latar `var(--piui-bg-elevated)`.
   - **Branding & Navigasi Footer Web Admin (`.piui-footer`, `.piui-product-credit`)**:
     - **Eliminasi Credit Non-Kedinasan**: Seluruh credit bawaan PIUI Zero atau nama personal wajib dieliminasi dari seluruh halaman Web Admin.
     - **Signature Resmi Kedinasan**: Sisi kanan footer memuat ikon produk Helpdesk (`logo-pastel-mark.png`, 24 × 24 px), nama portal `Helpdesk TIK Kota Depok`, identitas instansi `Diskominfo Kota Depok · Pemerintah Kota Depok · © 2026`, serta tautan status sistem.
     - **Akses Cepat Portal Publik**: Tombol sekunder `.hd-admin-footer-btn` disediakan untuk navigasi langsung ke portal masyarakat (`/`).
     - **Tautan Operasional Sisi Kiri (`.piui-footer__links`)**: Standarisasi 5 tautan fungsional: Pusat Komando, Antrean Tiket Petugas, Jejak Audit (M9), Status Layanan SPBE, dan Basis Pengetahuan SPBE.

## Standar Komponen Modal & Dialog Kanonis (Centered Modal Design System)

1. **Backdrop & Elevasi**: Seluruh modal dan dialog interaktif wajib menggunakan backdrop overlay semi-transparan `background: rgba(10, 12, 16, 0.75)` dengan `backdrop-filter: blur(6px)`.
2. **Posisi & Proporsi Terpusat**:
   - Modal diposisikan terpusat sempurna pada viewport: `position: fixed; inset: 0; margin: auto;`.
   - Dimensi desktop: `width: min(560px, calc(100% - 32px)); max-height: min(88vh, calc(100dvh - 48px));`.
   - Padding internal simetris: `24px 28px` (desktop) dan `18px 16px` (mobile).
   - Sudut tumpul konsisten: `border-radius: 12px` (desktop) dan `10px` (mobile).
3. **Anatomi Struktur Modal**:
   - **Header Modal**: Memuat judul modal tebal (`font-size: 1.15rem; font-weight: 700;`) dan tombol tutup aksesibel (`min-width: 36px; min-height: 36px;`). Pemisah bawah menggunakan `border-bottom: 1px solid var(--piui-border-subtle); padding-bottom: 14px; margin-bottom: 16px;`.
   - **Body Modal**: Field formulir tersusun vertikal dengan jarak `12px–14px`. Teks penjelasan kedinasan menggunakan warna sekunder kontras tinggi `font-size: 13px; line-height: 1.55;`.
   - **Footer Modal (Aksi)**: Tombol aksi dibungkus flex rata kanan dengan `gap: 12px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--piui-border-subtle);`.
4. **Perilaku Responsif Mobile First**:
   - Pada resolusi mobile (viewport <= 640px), modal otomatis menyesuaikan diri: lebar `calc(100% - 24px)`, margin aksi membalik vertikal (`flex-direction: column-reverse; gap: 10px;`) sehingga tombol aksi utama berada di atas tombol batal dengan lebar sentuh 100%.

## Standar Kanonis Mobile First Web Publik & Web Admin

1. **Prinsip Mobile First**: Tata letak dimulai dari ukuran layar mobile (360px–480px) tanpa ada elemen yang memicu horizontal scroll tidak terkendali, lalu berkembang proporsional pada tablet (768px) dan desktop (1024px+).
2. **Spesifikasi Web Publik di Resolusi Mobile**:
   - **Header / Navbar**: Kapsul melayang proporsional `width: min(520px, calc(100% - 32px))`, navigasi drawer penuh dengan tinggi sentuh tombol `min-height: 44px`.
   - **Hero Utama**: CTA primer mengisi satu baris di mobile. Dua CTA sekunder berbagi baris berikutnya, dengan label yang dapat membungkus. Tinggi ilustrasi menyesuaikan ruang yang tersisa setelah teks, CTA dan navigasi.
   - **Alur 3-Langkah & Katalog**: Grid berubah menjadi 1 kolom (`grid-template-columns: 1fr; gap: 16px;`) dengan kartu yang tidak terpotong.
   - **Formulir Laporan & Dropzone**: Stepper menyusun vertikal rapi, area dropzone adaptif `min-height: 140px; padding: 24px 16px;`, kartu kunci tamu responsif.
   - **Detail Tiket & Timeline**: Grid metrik 1 kolom, stepper alur 5-tahap vertikal, feed riwayat dengan jarak nyaman tanpa node saling bertabrakan.
3. **Spesifikasi Web Admin di Resolusi Mobile**:
   - **Kartu Sesi Lab**: Di layar mobile menyusun vertikal penuh (`.hd-session-inner` column), dropdown peran adaptif 100%, grup tombol tersusun rapi tanpa border menempel.
   - **Tabel Data Master & Antrean Tiket**: Kontainer `.hd-table-wrap` wajib `overflow-x: auto; max-width: calc(100vw - 32px); -webkit-overflow-scrolling: touch;` sehingga dapat digeser halus tanpa merusak viewport halaman.
   - **Toolbar & Tab Modul**: Tab modul membungkus rapi 2 kolom atau inline wrap dengan `gap: 8px`.
   - **Footer Admin**: Tautan operasional, status PWA, tombol portal publik, dan identitas Helpdesk TIK Kota Depok menyusun vertikal seimbang di tengah.

## Responsif dan aksesibilitas

- Periksa desktop, desktop pendek, tablet, dan mobile representatif sesuai area berubah.
- Desktop pendek 1280×600 menjadi regresi wajib saat mengubah hero.
- Mobile 390×844 atau 375×667 membuktikan wrapping, fokus dan kontrol dalam viewport.
- Heading, kartu, gambar, input dan footer harus membungkus tanpa luapan horizontal.
- Galeri memakai dua kolom desktop dan satu kolom mobile. Kartu akses memakai tiga, dua, lalu satu kolom sesuai breakpoint.
- Fokus keyboard terlihat. Interaksi tidak boleh bergantung hanya pada hover atau warna.
- Pertahankan prefers-reduced-motion, alt yang sesuai dan urutan DOM. Hero dengan navigasi thumbnail memakai pergantian manual.
- Pembesaran teks tidak boleh memotong informasi. Pada ruang sempit, bungkus atau susun ulang komponen.

## Pembaruan aset dan cache publik

Halaman dan aset publik memakai network-first; cache hanya fallback saat jaringan gagal. Gambar dengan URL yang sama harus diperiksa ke server pada pemuatan berikutnya. Service worker diperbarui tanpa HTTP cache, membersihkan hanya namespace cache publik Helpdesk/CourtSpec lama, lalu mengambil kontrol halaman. Pergantian worker memuat ulang halaman yang sudah dikontrol paling banyak satu kali, kecuali pengguna sedang mengisi formulir. Cache admin, cookie/session, draft dan penyimpanan lain tidak ikut dibersihkan. API, halaman identitas/katalog dinamis dan rute admin tidak boleh masuk cache publik.

Regresi perilaku cache diverifikasi dengan `node scripts/test_public_cache.mjs` sesudah build. Pemeriksaan ini mengeksekusi worker/client hasil build dengan fixture cache lama; bukan klaim pengujian offline browser menyeluruh.

## Prosedur perubahan dan gate

Perubahan bersama dimulai dari token/komponen kanonis. Perubahan per halaman harus memakai slot atau modifier yang jelas kebutuhannya. Jangan menyalin satu sistem tipografi atau footer baru ke setiap halaman. Catat revisi aturan bila mengubah nilai kanonis.

Jalankan dari frontend npm.cmd run build, lalu dari root python scripts/test_piui_build.py. Validator wajib memeriksa seluruh halaman publik, kesamaan header/footer, stylesheet tunggal, target tautan lokal dan preservasi komponen utama PIUI. Kegagalan salah satu halaman menggagalkan gate.

Verifikasi browser mewakili landing, satu halaman umum berformulir, satu detail statis, dan detail dinamis bila pengendalinya berubah. Uji desktop/mobile serta keyboard pada komponen terdampak. Catat ukuran viewport, hasil, hash sumber, dan tangkapan layar dalam status/evidence.jsonl dan qa/bootstrap. Build saja tidak membuktikan hasil visual.

Deployment tetap mengikuti otorisasi dan runbook proyek. Bukti lokal UI dipisahkan dari UAT, pengujian akun lain, keamanan produksi, dan perbandingan arsitektur penelitian.

## Aturan Portal Basis Pengetahuan M8

- Daftar `/panduan.html` dan detail `/panduan/{slug}` memakai shell PIUI Modern. Judul, metadata audiens, versi dan tanggal pembaruan berasal dari M8. Gunakan ilustrasi pendukung yang tersedia sesuai konteks atau metadata sumber. Tampilkan estimasi waktu baca atau kategori hanya jika sumber datanya tersedia.
- Kartu dan panduan unggulan menggunakan hasil `GET /api/v1/knowledge/articles?view=published`. Pencarian judul dan slug memakai parameter `q`; gunakan cursor server dan batalkan permintaan lama saat pengguna mengganti kueri atau halaman. Daftar dan detail memiliki pesan pemuatan, kosong, akses ditolak atau objek hilang, serta gagal jaringan dengan percobaan ulang.
- Slug detail stabil dan dapat dibagikan. Tautan lama yang terpetakan menyelesaikan slug artikel M8 yang sama. API detail mengembalikan 404 untuk artikel yang hilang atau di luar cakupan. Konten diproses lewat allowlist elemen dan atribut; tautan eksternal menggunakan HTTPS.
- Cakupan publikasi dan audiens diputuskan server. Browser mengambil ulang respons saat kembali ke halaman dan mengosongkan konten saat kehilangan jaringan. Respons editorial memakai `Cache-Control: no-store`. Aplikasi dapat memuat shell offline dengan pesan yang sesuai.
- Editor dan penerbit memakai aksi yang sesuai izin organisasi serta versi artikel. Setelah publikasi, perubahan atau pengarsipan, pembacaan ulang publik mengikuti keadaan M8.
- Halaman Tanya Jawab (`/faq.html`) dan akordeon FAQ beranda (`#vy-faq`) dihidrasi langsung dari `GET /api/v1/knowledge/faqs?view=published` (`Cache-Control: no-store`), mendukung filter kata kunci, dropdown topik setara **Select2**, tautan jangkar `#<slug>`, sanitasi konten allowlist, serta mempertahankan daftar ringkas bawaan saat server tidak dapat dijangkau.
- Seluruh `<select>` fungsional pada Web Publik (pemilihan layanan, kategori/topik FAQ, wilayah/instansi `PD / Unit Kerja`, dan form filter) menggunakan komponen combobox aksesibel keyboard setara **Select2** (`select2-combobox.ts`) tanpa menghilangkan kontrol `<select>` native yang dapat dipulihkan.
- Saat **Pemeliharaan Sistem** aktif atau terjadwal dari M1 (`GET /api/v1/maintenance/status`), portal menampilkan informasi *Under Maintenance* (banner jadwal atau halaman pemberitahuan sesuai mode terjadwal/tidak terjadwal) tanpa membocorkan detail infrastruktur.

## Identitas produk

`logo-pastel-mark.png` adalah ikon produk Helpdesk TIK. Saat ikon berdampingan dengan nama portal yang terbaca, gunakan alt kosong untuk menghindari nama ganda. Penggunaan lambang pemerintah mengikuti aset yang disahkan oleh pemilik identitas.

## Pencarian dan lampiran

- Combobox katalog meminta saran dari M2 dan artikel terbit dari M8. Pindahkan penanda aktif dengan panah dan buka detail dengan Enter. Tampilkan hasil kosong atau kegagalan sumber. Batalkan kueri lama saat teks berubah, pengguna menekan Escape atau menutup saran.
- Saat tiket sudah tersimpan, tampilkan receipt dan tautan detail sebelum unggahan lampiran. Pertahankan file pada percobaan ulang selama halaman terbuka. Ulangi unggah dengan intent lampiran yang sama jika hasil sebelumnya belum pasti.
- Pustaka media menampilkan hasil CLEAN dengan filter dan cursor server. Download tetap memeriksa izin terkini. Aksi catat referensi mencatat identitas media pada uraian laporan. Upload berkas menghasilkan lampiran tiket yang dipindai.

## Pemeriksaan mobile 13 November 2026

- Kartu akses memakai tiga kolom mulai 1024 px, dua kolom pada 640–1023 px, dan satu kolom di bawah 640 px. Aturan breakpoint mengubah grid yang sama. Hindari deklarasi penting pada grid desktop yang menimpa breakpoint.
- Header ponsel menyediakan kolom 44 px untuk kontak dan menu dengan identitas produk di tengah. Panel menu memiliki satu judul, tinggi maksimum mengikuti viewport dinamis, scroll internal, dan fokus keyboard yang terlihat.
- Kontrol utama publik dan Admin memakai area sentuh minimal 44 × 44 px. Token ukuran kontrol mengatur varian kecil dan pagination pada breakpoint ponsel. Input teks dan kata sandi memakai 16 px agar mudah dibaca. Tab akses menampilkan Warga dan ASN dengan nama aksesibel lengkap.
- Kartu dan isi panduan memakai seluruh lebar kontainer yang tersedia. Teks membungkus secara alami, paragraf memakai line-height 1.65–1.7, dan tabel lebar memiliki scroll di pembungkusnya.
- Hero tetap maksimum 100VH. Pada ponsel pendek dan landscape, padatkan judul, ilustrasi serta salinan identitas yang sudah tersedia di header. Pertahankan ketiga CTA dan kelima thumbnail. Area banner memakai overflow clip dengan seluruh gambar, teks dan tindakan muat di dalam layout yang diuji. Periksa clearance header dan kontrol dari batas section.
- Toolbar galeri membungkus dengan kontrol minimal 44 px dan tombol tutup di sisi kanan. Penampil memakai 100dvh dan menyediakan scroll vertikal jika kontennya melebihi viewport.
- Form login Admin mempertahankan tombol tutup yang terhubung ke dialog PIUI. Pilihan peran lab menjadi satu kolom pada lebar maksimum 400 px.
- Pemeriksaan representatif mencakup 320 × 568, 400 × 498, 375 × 667, 390 × 844, tablet 768 × 1024, desktop 1280 × 720, serta landscape 844 × 390. Bukti tiap kandidat mencatat rute, ukuran, state, build, dan batas cakupan.

## Navigasi banner melalui thumbnail

Arahan 13 November 2026 mengganti kelompok panah, penghitung serta jeda dengan pemilihan langsung melalui thumbnail. Pergantian manual menjadi perilaku awal. Perubahan pada adapter sumber PIUI mempertahankan tombol thumbnail, navigasi panah keyboard, Home/End dan penanda slide aktif. Pembatas tinggi Hero tetap maksimum 100VH. Ukuran gambar banner mobile beradaptasi terhadap ruang yang tersedia agar ilustrasi selalu terlihat bersama teks, CTA dan thumbnail pada viewport yang diverifikasi.

## Alur tugas dan orientasi sesi 13 November 2026

- Entry laporan umum memilih layanan terlebih dahulu. Tautan laporan layanan membawa ID atau slug yang dapat diselesaikan server.
- Navigasi layanan mengikuti sesi tamu, pemohon, atau petugas. Menu internal dan pintasan mengikuti permission pada organisasi aktif. Penyaringan visual melengkapi otorisasi server. Hindari kelompok menu kosong.
- Login dari layanan mempertahankan service dan intent report/detail. Gunakan tujuan lokal tetap yang ditentukan kode; jangan menerima URL tujuan bebas dari query.
- Sebelum commit laporan, sediakan ringkasan layanan, judul, uraian, isian khusus dan lampiran. Gunakan dialog native, validasi wajib, fokus yang terlihat, serta tombol kembali mengedit dengan isian tetap tersimpan. Ringkasan memakai textContent dan tidak memuat kunci rahasia.
- Tampilkan label status dan prioritas melalui helper bersama. Pisahkan status workflow dan hasil verifikasi. Prioritas tanpa keputusan tampil sebagai belum ditetapkan. Petunjuk berikutnya mengikuti state dan jenis pengguna.
- Target SLA, ukuran berkas serta batas konfirmasi mengikuti policy/tiket/attempt aktif dari server. Bila data belum tersedia, jelaskan keterbatasan tanpa angka rekaan.
- Tamu yang membuka Tiket saya memperoleh pilihan masuk akun atau pelacakan tamu. Input kunci pelacakan bertopeng, dapat dikoreksi saat gagal, dan tidak masuk URL, ringkasan, draft atau storage browser.
- Kegagalan daftar memiliki tindakan coba lagi pada cursor yang sama. Pertahankan pagination server, status loading/empty/error dan pencegahan kirim ganda.
- Escape semua teks dan atribut dari data tidak tepercaya pada shell HTML lama. Gunakan textContent pada komponen baru. Konten panjang dan baris uraian harus terbaca pada ponsel.

## Pelaporan, respons dan penyelesaian

- Kontrol yang hanya berlaku untuk tamu harus dinonaktifkan bagi akun login. Menyembunyikan kontrol required saja masih dapat menghentikan validasi native.
- Satu helper ketersediaan aksi mengikuti owner, mandat aktif, state, penugasan, arsip dan window. Buka kembali memerlukan pemohon sah atau Operator berizin. Backend memeriksa ulang setiap command.
- Petunjuk tindakan berikut menyediakan tautan ke verifikasi, penugasan, mulai penanganan, informasi tambahan, hasil pekerjaan atau konfirmasi yang sedang berlaku.
- Teknisi mengirim hasil penanganan untuk diperiksa. RESOLVED tampil sebagai menunggu konfirmasi; CLOSED tampil sebagai selesai. Hasil upaya yang relevan tetap terbaca setelah ditutup.
- Catatan konfirmasi memakai attempt aktif dan waktu WIB. Jika hasil gagal dimuat, jelaskan keterbatasannya dan hentikan keputusan sampai data tersedia. Batas 24 jam adalah waktu kalender dari server dan penutupan otomatis memerlukan guard pemberitahuan serta feedback.
- Respons manusia pertama mencakup balasan petugas yang terlihat pemohon. Catatan INTERNAL serta komentar pemohon tidak dihitung sebagai respons petugas. Komentar petugas pada masa konfirmasi tidak boleh disebut feedback pemohon.
- Retry untuk intent yang sama mempertahankan idempotency key, payload dan expected_version asli. Fingerprint tindakan memisahkan metadata CAS dari isi keputusan. Perubahan intent menunggu hasil sebelumnya dapat direkonsiliasi.
