# Aset dan landing Helpdesk TIK

Analisis 4 November 2026. Paket assets berisi 22 PNG. Gambar merupakan ilustrasi kreatif sesuai keterangan sumber pada assets/README.md.

| Kelompok | Analisis | Penggunaan |
|---|---|---|
| 01_Hero, 4 gambar | RGB, 1536 × 524. Judul sudah tertanam. | Materi banner siap pakai. |
| 02_Hero_Tanpa_Teks, 4 gambar | RGB, 1600 × 600, sekitar 460–621 KiB per gambar. Ruang kosong di sisi kiri. | Slider utama. Judul, deskripsi dan CTA menjadi HTML. |
| 03_Ilustrasi_Pendukung, 9 gambar | RGBA, 512 × 512, sekitar 77–161 KiB. | Akses pengguna, kategori bantuan, galeri, dan ilustrasi pengantar. |
| 04_Preview | RGB, 1600 × 1180. | Lembar tinjauan desain. |
| 05_Brand, 4 gambar | RGBA. logo-full 1672 × 941. Varian lainnya 1254 × 1254 dengan ruang transparan. | logo-light untuk navigasi gelap, logo-favicon untuk ikon browser. logo-full lebih sesuai pada latar terang. |

Logo dark mempunyai tepi putih tidak seragam pada batas transparansinya. Gunakan logo-light pada header gelap yang sekarang aktif. Favicon master hampir 1 MiB untuk tampilan kecil. Derivatif ukuran web menjadi pekerjaan optimasi berikutnya. Master PNG disalin tanpa perubahan gambar.

Landing memakai HTML komponen PIUI Modern dan pengendali navigasi, slider, filter galeri serta FAQ aslinya. Adapter frontend/landing-page.mjs memilih konten yang relevan. frontend/landing.css menyesuaikan komposisi untuk hero berwarna dan logo. CSS referensi tetap menjadi fondasi.

Urutan halaman adalah hero, akses masyarakat/ASN/petugas, kategori bantuan, alur penanganan, contoh laporan, FAQ, dan ajakan menyiapkan informasi kendala. Simulasi beban, grafik sintetis, dan testimonial contoh tidak ditampilkan pada index. Tautan akun/tiket menampilkan status pengembangan secara eksplisit.

Hero dibatasi 100svh dengan maksimum 100vh, termasuk navigasi cepat. Susunan mobile mempertahankan judul, CTA dan kontrol slider dalam batas hero.

Rute utama adalah http://127.0.0.1:18080/. Build menyalin aset yang dipakai ke assets/helpdesk. Catatan bukti dan hash berada di qa/bootstrap/landing-assets.json.

Penyempurnaan proporsi memakai heading section 28–44 px, isi 16 px, judul kartu 18–22 px, padding section 48–88 px, gap 16–24 px, dan padding kartu 20–28 px. Grid galeri dua kolom pada desktop dan satu pada mobile. Metadata memakai pasangan label/nilai sejajar. Kontrol interaktif minimal 44 px. Thumbnail mobile berada di atas gradasi hero dan terpisah dari navigasi cepat. Bukti terbaru ada di qa/bootstrap/landing-spacing.json.

Revisi hero memakai lima banner tanpa teks, termasuk hero-05-pusat-panduan-mandiri-tanpa-teks.png. Kontrol dan thumbnail sejajar, dengan rail horizontal pada mobile. Acuan terbaru ada pada aturan kanonis versi 1.1 dan bukti qa/bootstrap/hero-five.json.
