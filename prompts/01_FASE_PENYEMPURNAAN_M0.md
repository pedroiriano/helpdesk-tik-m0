# Fase 1 — Penuntasan teknis Helpdesk TIK M0

Jalankan fase ini di `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Selesaikan implementasi dan buktikan acceptance teknis di bawah. Mulai dari keadaan aktual dan lanjutkan perbaikan yang belum tuntas. Setelah fase ini selesai, serahkan hasil untuk Fase 2.

## 1. Tetapkan sumber dan baseline

- Baca `AGENTS.md`, `README.md`, checkpoint terbaru `status/PROJECT_STATE.md`, `planning/remediation_backlog.csv`, audit `qa/audit-helpdesk-2026-11-24.md`, blueprint, kontrak acceptance/fitur, aturan UI publik/admin, serta runbook cutover. Pakai aturan riset di `D:\Jurnal\Microservices` sebagai acuan paritas. Catat bila temuan audit sudah diperbaiki dan buktikan dengan tes relevan.
- Catat branch, SHA, perubahan lokal, konfigurasi runtime tanpa rahasia, status kontainer dan port. Pertahankan pekerjaan yang sudah ada. Kalau ada perbedaan antara tag lama, bukti, kode, dan image, catat sebagai baseline. Kandidat final dikunci setelah perbaikan.
- Pertahankan M0 satu proses dan sembilan owner. M3 tetap penulis tunggal status tiket. Pakai public port, transaksi owner, versi, idempotensi dan outbox yang ada sesuai operasi. Migrasi baru harus aditif/forward-only. Kontrak, generator, dokumentasi dan consumer disinkronkan bersama.
- Jalankan pengujian yang membuat tiket, akun, roster, konten, maintenance atau job pada database/volume uji sekali pakai. Tempatkan Compose, port, volume, image tag uji dan folder bukti secara terisolasi. Periksa konflik nama kontainer eksplisit dan origin HTTPS/loopback sebelum menyalakan. Jaga data aktif, volume lama dan kontainer proyek lain. Pakai penyedia palsu/sink untuk SSO, SMTP dan Telegram. Perintah yang mengirim ke pihak luar memerlukan otorisasi terkait.

```powershell
Set-Location -LiteralPath 'C:\Datas\Proyek\Aplikasi\helpdesk-monolith'
git status --short
git rev-parse HEAD
docker compose ps -a
docker compose config --quiet
docker compose -f compose.yaml -f compose.prod.yml config --quiet
```

## 2. Kerjakan paket 1 sampai 4 secara berurutan

| Paket | Perintah implementasi | Acceptance minimum |
|---|---|---|
| **1. Pemeliharaan per OPD (A02)** | Telusuri konfigurasi, query, status publik, middleware dan entry point mutasi. Bedakan kebijakan global dan lokal, tentukan cakupan dari target tepercaya di server, dan dokumentasikan kebijakan bila jadwal aktif bertumpuk. Untuk tiket gunakan konteks otoritatif sesuai aksi, termasuk handoff dan operasi massal. Tampilkan cakupan dan dampak serta pertahankan jalur pemulihan admin. | Pada dua OPD, READ_ONLY dan DRAIN memengaruhi tindakan yang ditetapkan hanya dalam cakupannya. Uji OPD lain, global, jadwal bertumpuk, awal/akhir jadwal, konteks lintas OPD, hak admin lain, serta keselarasan UI/status publik. Aksi lintas cakupan tidak melampaui mandat. |
| **2. Smart Dispatch dan roster (A05)** | Tambahkan pengelolaan jadwal aktif dan keahlian di M5 melalui API dan UI PIUI kanonis, dengan izin delegasi per OPD/tim, audit alasan, validasi relasi, versi dan penonaktifan/pengakhiran yang menjaga histori. Pakai kebijakan M1 untuk keanggotaan. Tampilkan alasan saran, PD/Bidang atau tim tujuan, kandidat teknisi dan jalur penugasan manual berizin. | Tambah teknisi sampai dapat direkomendasikan setelah VERIFIED. Jadwal kedaluwarsa, keahlian tidak cocok, keanggotaan dicabut dan OPD salah tidak menjadi kandidat. Konflik versi gagal secara jelas. Uji aturan kategori dan fallback layanan, kategori ambigu, nihil kandidat, serta handoff dengan penerimaan. Pertahankan kamus/aturan yang bisa dijelaskan. |
| **3. Alur kerja petugas (paket UX)** | Gunakan dasbor, filter antrean, peta navigasi tunggal dan aksi detail kanonis. Beri titik masuk Operator “Perlu Verifikasi”, Teknisi “Tugas Saya”, Koordinator “Perlu Keputusan”, Pimpinan “SLA dan Hambatan”, dan Admin “Master dan Akses” sesuai izin. Utamakan tindakan berikutnya di detail. Integrasikan empty/loading/error, konflik dan transisi tanpa tindakan ganda. | Uji alur representatif untuk lima profil memakai akun uji. Periksa judul, filter yang benar, tautan ke tiket, status, aksi utama, sidebar, drawer mobile dan keyboard. Pengguna tanpa hak tidak melihat aksi dan ditolak server. Admin konfigurasi tidak mendapat hak baca tiket melalui pintasan. |
| **4a. Pencarian (A07)** | Gunakan pagination server, urutan stabil dan cursor yang terikat pencarian/filter. Tambah hasil Media menggunakan ACL owner yang sama dengan pustaka, tanpa membuka blob privat atau metadata terlarang. Pertahankan API kompatibel, UI saran cepat, navigasi keyboard dan pembatalan respons usang. | Ada hasil lanjutan jika data melebihi limit, tanpa hilang/duplikat pada dataset stabil. Uji owner M2/M3/M8, hasil Media, anonim, lintas OPD, izin dicabut di antara halaman, unduhan dan cursor tidak sah. |
| **4b. Integrasi (A03/A04)** | Samakan nama callback SSO, konfigurasi dan mount secret untuk SSO/SMTP/Telegram di backend, overlay dan runbook. Pertahankan kompatibilitas konfigurasi yang masih dipakai atau catat migrasi terkontrol. Sediakan jalur pembaruan definisi ClamAV via mirror/egress scanner yang sesuai kebijakan, sambil mempertahankan isolasi DB, karantina dan akses berkas. Tambahkan diagnostik teredaksi untuk konfigurasi dan umur definisi. | Compose valid dan option efektif dapat dibuktikan tanpa mencetak data rahasia. Pada lingkungan uji, pastikan SSO callback dan penolakan yang sah, pengiriman/retry via sink, pengambilan definisi oleh scanner serta penanganan saat update gagal. Uji unggahan hanya dapat diakses setelah CLEAN sesuai izin. Catat verifikasi yang masih perlu penyedia atau infrastruktur resmi untuk Fase 2. |

Jika perbaikan berpengaruh pada perilaku bersama, perbarui kontrak dan matriks M0/C3/F9/G-OPT, beserta fixture dan skenario yang perlu disejajarkan. Jaga ketentuan paritas data, fitur, aturan bisnis, resource, dan lingkungan uji. Catat implementasi lintas model yang masih tertunda.

## 3. Verifikasi dan serah terima

Jalankan pemeriksaan terdekat setelah setiap paket. Jalankan perintah satu per satu dan periksa exit code. Gunakan runtime dan versi tool dari lock proyek. Perintah contoh yang sudah tersedia:

```powershell
python -X utf8 scripts/build_business_contracts.py --check
python -X utf8 scripts/check_boundaries.py
python -X utf8 -m unittest discover -s tests/contract
npm.cmd --prefix frontend run build
python -X utf8 scripts/test_piui_build.py
node scripts/test_admin_navigation.mjs
node scripts/test_ticket_actions.mjs
python -X utf8 scripts/test_fase2_backend.py --report qa/remediation/rm0-05/penyempurnaan/fase1-fase2-backend.json
python -X utf8 scripts/test_fase3_backend.py --report qa/remediation/rm0-05/penyempurnaan/fase1-fase3-backend.json
```

- Buat direktori hasil sebelum menjalankan runner. Pasangkan uji yang sudah tersedia dengan kasus regresi baru yang diperlukan untuk acceptance tabel. Hasil tes integrasi lama hanya berlaku pada cakupan yang benar-benar dijalankan. Uji go package yang berubah dengan toolchain terpin. Untuk perubahan UI, buktikan alur desktop, mobile dan keyboard secara representatif dari image/hasil build kandidat. Cocokkan origin/port setiap runner sebelum tes browser.
- Apabila tes gagal, perbaiki akar masalah dan ulangi uji yang terdampak. Jangan melemahkan assertion, permission, audit, atau aturan bisnis. Lakukan uji luas final di Fase 2 sekali per kandidat akhir.
- Tulis `qa/remediation/rm0-05/penyempurnaan/fase1-completion.json` dengan baseline/kandidat, pemetaan paket dan temuan, file, migrasi, perintah/cwd/exit, fixture, bukti browser, cacat, serta gerbang yang belum terbukti. Perbarui status dan evidence sesuai AGENTS. Status teknis `DONE_VERIFIED_LAB` memerlukan seluruh acceptance yang dapat dibuktikan di lab lulus serta nol cacat pemblokir terbuka untuk paket 1–4. Bila ada kekurangan teknis sesi ini, catat FAIL/NOT_RUN/BLOCKED beserta langkah spesifik. Berikan jalur serah terima ke Fase 2.
