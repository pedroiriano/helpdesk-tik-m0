# Aset Visual Helpdesk TIK Kota Depok (Edisi Pastel M0)

Paket ini berisi aset visual berpalet pastel lembut dengan pencahayaan matte yang tenang (tidak menyilaukan) serta ilustrasi vektor transparan murni tanpa artefak potong latar (*white-fringe*).

## Struktur Folder & Daftar Aset

### 1. `01_Hero` (6 banner `1536×524` PNG)
Banner siap pakai dengan emblem dan judul Bahasa Indonesia tertanam di sisi kiri:
- `hero-01-bantuan-tik-terpadu.png` *(diperbarui)*
- `hero-02-tiket-layanan.png` *(diperbarui)*
- `hero-03-dukungan-kinerja.png` *(diperbarui)*
- `hero-04-layanan-terintegrasi.png` *(diperbarui)*
- `hero-05-pusat-panduan-mandiri.png` *(baru)*
- `hero-06-kolaborasi-perangkat-daerah.png` *(baru)*

### 2. `02_Hero_Tanpa_Teks` (6 kanvas `1600×600` PNG)
Komposisi ilustrasi pastel utuh tanpa teks tertanam, dengan ruang negatif lembut di sisi kiri untuk tipografi dan CTA HTML/React:
- `hero-01-bantuan-tik-terpadu-tanpa-teks.png` *(diperbarui)*
- `hero-02-tiket-layanan-tanpa-teks.png` *(diperbarui)*
- `hero-03-dukungan-kinerja-tanpa-teks.png` *(diperbarui)*
- `hero-04-layanan-terintegrasi-tanpa-teks.png` *(diperbarui)*
- `hero-05-pusat-panduan-mandiri-tanpa-teks.png` *(baru)*
- `hero-06-kolaborasi-perangkat-daerah-tanpa-teks.png` *(baru)*

### 3. `03_Ilustrasi_Pendukung` (15 ikon/ilustrasi `512×512` RGBA PNG transparan)
Dirender langsung di atas kanvas transparan dengan kontur slate rapi (`#324960`) sehingga bersih pada mode terang maupun mode gelap:
- `ilustrasi-bantuan-operator.png` *(diperbarui)*
- `ilustrasi-cloud-layanan.png` *(diperbarui)*
- `ilustrasi-dashboard-monitoring.png` *(diperbarui)*
- `ilustrasi-gedung-pemerintah.png` *(diperbarui)*
- `ilustrasi-keamanan-siber.png` *(diperbarui)*
- `ilustrasi-perawatan-tik.png` *(diperbarui)*
- `ilustrasi-server-infrastruktur.png` *(diperbarui)*
- `ilustrasi-tiket-helpdesk.png` *(diperbarui)*
- `ilustrasi-wifi-jaringan.png` *(diperbarui)*
- `ilustrasi-akun-identitas.png` *(baru)*
- `ilustrasi-aplikasi-digital.png` *(baru)*
- `ilustrasi-kolaborasi-opd.png` *(baru)*
- `ilustrasi-notifikasi-audit.png` *(baru)*
- `ilustrasi-panduan-pengetahuan.png` *(baru)*
- `ilustrasi-pelacakan-sla.png` *(baru)*

### 4. `04_Preview` (2 lembar tinjauan desain `1600×1360` PNG)
- `preview-paket-aset.png` *(diperbarui — ringkasan `02_Hero_Tanpa_Teks` & 15 ilustrasi pendukung)*
- `preview-hero-dan-mode-gelap.png` *(baru — ringkasan `01_Hero` & uji transparansi pada latar gelap)*

### 5. `05_Brand` (6 aset mark/wordmark kreatif non-resmi)
- `logo-dark.png`, `logo-light.png`, `logo-full.png`, `logo-favicon.png` *(kompatibilitas awal)*
- `logo-pastel-mark.png` *(baru — `512×512` RGBA selaras palet pastel)*
- `logo-pastel-full.png` *(baru — `1200×480` RGBA wordmark pastel)*

## Saran Penggunaan
- **Frontend/React**: Gunakan `02_Hero_Tanpa_Teks` sebagai latar hero (`object-fit: cover; object-position: right center;`) dan letakkan teks serta tombol di HTML untuk aksesibilitas.
- **Scrim/Permukaan**: Hindari lapisan putih menyilaukan di atas hero; gunakan kabut pastel lembut (mis. `#DCE7F2` / `#E7EFF6`) agar kontras teks tetap memenuhi WCAG tanpa membuat layar terlalu terang.
- **Batas Identitas**: Seluruh gambar ini adalah aset kreatif proyek pengembangan dan **bukan** lambang/identitas resmi Pemerintah Kota Depok.
