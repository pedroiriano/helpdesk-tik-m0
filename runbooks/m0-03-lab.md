# M0-03 — Penggunaan lab lokal

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Aplikasi memakai data sintetis, bukan identitas atau kebijakan resmi Pemerintah Kota Depok.

| Halaman | URL lokal |
|---|---|
| Masuk publik | http://127.0.0.1:18090/akses.html |
| Katalog | http://127.0.0.1:18090/layanan.html |
| Detail/formulir | Buka dari kartu katalog. Formulir merupakan pratinjau; pengiriman tiket belum tersedia. |
| Masuk admin | http://127.0.0.1:18090/admin/auth/login.html |
| Master operasional | http://127.0.0.1:18090/admin/app/helpdesk/index.html |

Pilih identitas lab pada formulir. Publik A/B hanya memperoleh audience publik; ASN OPD A/B sesuai membership; operator/teknisi hanya audience petugas sesuai organisasi. Admin Lab OPD A dan Admin OPD B mengelola master pada mandatnya. Admin konfigurasi tidak otomatis membaca tiket. Halaman template lain di admin masih contoh dan bukan fitur bisnis yang telah selesai.

Jangan memasukkan password, data pribadi atau credential produksi. Delapan profil adalah fixture server. Memilih profil lab bukan bukti SSO/verifikasi ASN nyata. Logout mencabut sesi server; expiry/revocation berlaku pada request berikutnya. Browser tidak menyimpan database master atau token di localStorage.

## Penerapan lokal

Periksa checkpoint dan target terlebih dahulu. Tidak perlu mengulang migrasi/seed yang sudah terbukti terpasang. Jika DB berhenti, jalankan kembali kontainer yang sama tanpa reset volume. Task ini pernah menemukan DB exit 255; menjalankan kontainer yang sama mempertahankan marker dan ledger.

```powershell
python scripts/prepare_local.py
docker compose ps
docker compose up -d --wait db
docker compose up -d --no-deps --force-recreate migrate
docker wait helpdesk-m0-migrate
docker compose --profile lab run --rm --no-deps --pull never seed-lab
docker compose up -d --no-deps --build --pull never --wait --wait-timeout 120 app
docker compose up -d --no-deps --build --pull never --wait --wait-timeout 120 web
```

Lanjutkan seed/app hanya jika exit job migrator adalah 0. prepare_local hanya membuat secret yang belum ada. Seed memakai guard synthetic_lab dan ON CONFLICT DO NOTHING, sehingga tidak menimpa perubahan master. Jangan memakai down -v, truncate, drop atau rotasi secret. Readiness memeriksa sembilan marker foundation dan dua domain marker versi 3, bukan semua fitur produk.

Seed lab bawaan menambahkan izin baca laporan pada mandat PD Diskominfo milik fixture Super Admin. Untuk stack lab yang sudah berjalan, jalankan `docker compose --profile lab run --rm --no-deps --pull never seed-lab dashboard`. Izin berlaku pada sesi sintetis dengan mandat PD aktif dan tidak menambahkan izin ekspor.

## Verifikasi terarah

```powershell
python scripts/verify_m0_03.py
python scripts/test_m0_03.py
python scripts/test_owner_migrations.py --report qa/m0-03/migrations.json
python scripts/check_boundaries.py
npm.cmd --prefix frontend run build
python scripts/test_piui_build.py
python scripts/smoke_local.py
```

Gate Go/HTTP menggunakan network Docker internal sementara, tanpa port host/volume persisten, lalu membersihkan resource tes sendiri. Ia tidak mengubah DB kerja. Gate migrasi menulis laporan M0-03 agar evidence historis M0-02 tetap dipertahankan. Validator schema bukan bukti HTTP runtime; keduanya mempunyai evidence berbeda.

Untuk sinkronisasi ceiling Go sesudah perubahan policy yang telah ditinjau, gunakan `python scripts/sync_identity_roles.py --write`, lalu affected tests. Tanpa --write tool hanya memeriksa drift dan tidak mengubah grant DB. File migrasi yang sudah dipakai tetap immutable; kebutuhan berikutnya memakai migrasi baru. Keputusan organisasi pada planning/decisions.csv tetap terbuka. Jangan mulai M0-04 atau eksperimen hanya karena lab ini dapat dibuka.
