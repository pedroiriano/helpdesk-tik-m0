# M0-04 — Operasi tiket lab lokal

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Gunakan hanya profil sintetis M0-03. Jangan masukkan data pribadi, password produksi atau file operasional. Port host tetap `127.0.0.1:18090`.

- Publik: `/layanan.html` → pilih layanan → **Buat laporan layanan ini**. `/tiket.html` menampilkan daftar sesuai hak. `/lacak.html` menukar kunci tamu untuk sesi tracking singkat. Nomor tiket bukan kunci. Simpan kunci secara pribadi; kehilangan kunci tidak dipulihkan lewat nomor tiket. Kunci tidak disimpan dalam evidence/draft/URL.
- Petugas: `/admin/auth/login.html` → pilih Operator OPD A → klik **Antrean Tiket Petugas** pada halaman Master layanan dan akses atau pada menu **Kelola Data & Media**. Palet `Ctrl+K` juga menyediakan perintah **Buka Antrean Tiket Petugas**. Rute langsung `/admin/app/tickets/index.html`. Daftar/detail dan catatan internal dibatasi server. Admin konfigurasi tidak memperoleh izin tiket implisit. Master operasional tetap pada rute M0-03. Grafik dasbor contoh bukan bukti data tiket.
- Lampiran: PNG/JPEG/PDF sesuai policy snapshot, maksimal 10 MiB, 25 file/50 MiB per tiket, maksimal dua unggahan simultan per proses. Data berada di volume privat `helpdesk-m0_private-uploads`, tidak dipublikasikan melalui gateway static. Pending/quarantine ditolak saat download. Muat ulang tiket untuk melihat hasil scan. Scanner error mengarantina file dan worker mencoba ulang secara terbatas.
- ClamAV 1.5.4 terpin, tanpa port host, signature bawaan image. Catat versi/age sebelum acceptance/operasi. Restart app mempertahankan DB dan volume file. Jangan pakai `down -v`, reset, purge, pemindahan volume, atau penghapusan blob manual untuk memperbaiki scan.

Migrasi 001–017 telah dijalankan melalui job terpisah; 001–012 tetap historis. Readiness mencakup identity/catalog v3 dan intake/notify_audit v4. Lihat [ADR 0005](../docs/adr/0005-ticket-durable-audit-private-uploads.md) untuk storage, scanner, proposal M4 dan kalender M6. Periksa ledger/source sebelum migrasi atau rebuild lanjutan; tidak perlu menerapkan ulang DDL yang sudah sesuai.

Worker M9 memproses audit M1/M2/M3 dan snapshot yang in scope. Target lain tetap durable PENDING. Jika DEAD_LETTER, periksa metadata tersensor dan penyebab; requeue hanya lewat pemulihan owner yang disetujui, setelah koreksi. Pertahankan event ID/digest dan histori; jangan melakukan ACK manual, replay payload bebas atau retry tak terbatas. Tidak ada pengiriman notifikasi nyata.

Verifikasi terarah dari root:

```powershell
python scripts/verify_m0_04.py
python scripts/test_m0_04.py
python scripts/test_m0_03.py --report qa/m0-04/m0-03-regression.json
python scripts/test_owner_migrations.py --report qa/m0-04/migrations.json
npm.cmd --prefix frontend run build
python scripts/test_piui_build.py
node scripts/test_public_cache.mjs
node scripts/test_business_intent.mjs
```

Jalankan hanya gate terdampak jika bukti yang lain masih sesuai source. Setelah hardening runtime terbaru lulus integrasi, rebuild **app/web saja**, tanpa reset DB/volume:

```powershell
docker compose up -d --no-deps --build --pull never --wait --wait-timeout 120 app web
python scripts/smoke_local.py
python scripts/smoke_m0_04_local.py --allow-lab-writes --restart-proof
```

Smoke terakhir membuat fixture tiket/lampiran sintetis, restart **app** lokal, membandingkan sesi/tiket/blob dan mencabut capability uji. Ia tidak menghapus data dan bukan pengganti browser. Perintah ini lulus pada kandidat final setelah review otomatis kembali tersedia. Bukti tracking/pergantian akun pada build final berada di `qa/m0-04/browser-hardening.json`; evidence browser representatif sebelumnya dipertahankan terpisah.
