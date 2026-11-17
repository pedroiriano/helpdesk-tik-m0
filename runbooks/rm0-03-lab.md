# RM0-03 — SLA, pemulihan, laporan dan operasi

## Kebijakan sintetis

- M6 membaca target berdasarkan layanan, versi kebijakan, prioritas, dan tahap. Snapshot membawa kalender versi tertentu serta daftar hari libur saat tiket diterima. CAL-1 memakai hari kerja dan jam 08.00–16.00 WIB. CAL-247 berjalan sepanjang hari.
- Penerimaan memakai prioritas sementara NORMAL. Verifikasi memakai prioritas keputusan operator. Respons pertama dicatat pada permintaan informasi atau verifikasi pertama. Pada kandidat lab, buka kembali memulai episode baru dengan jam mulai baru. `accepted_at` tetap waktu penerimaan awal.
- Gross adalah detik kalender dalam episode. Net mengurangi irisan gabungan jeda yang disetujui. Working seconds menghitung bagian net dalam jam kerja. Jeda yang dimulai setelah deadline tidak menghapus breach. Endpoint penyelesaian berasal dari upaya resolusi aktif. Penolakan mengaktifkan kembali penghitungan episode itu. Feedback menahan auto-close.
- Legacy memakai fakta yang tersimpan. Tiket tanpa snapshot kebijakan terukur dikeluarkan dari denominator SLA. Pengesahan target, pause, episode, dan notifikasi tetap tercatat pada DEC-M03–DEC-M06.
- `seeds/rm0-03-sla.sql` adalah fixture CAL-247 terisolasi dan memerlukan mode `synthetic_lab`. Hari libur 9 November 2026 disuntikkan oleh pengujian. Gunakan kalender resmi yang telah disahkan untuk data operasional.

## Scheduler dan notifikasi

- Job auto-close mempertahankan identitas tiket/upaya dan `due_at`. Lease 30 detik dan versi fence melindungi terhadap ACK lama. Percobaan berhenti setelah delapan kegagalan. Retry memakai backoff dan kode kesalahan teredaksi. Auto-close memeriksa status, upaya, batas 24 jam, dan bukti notifikasi yang durable.
- Petugas berizin `system.job` pada OPD pemilik tiket dapat membaca dan me-replay job dead-letter melalui rute scheduler. Replay memerlukan versi, alasan, dan idempotency key. Bukti replay berada di schema M7.
- Sink menyimpan notifikasi dan receipt lokal. Kode pengikatan sekali pakai berlaku lima menit dan terbatas pada subjek serta OPD. Pengujian tidak mengirim Telegram nyata. DEC-M09 mencakup kanal nyata.

## Handoff dan pantauan eskalasi

- Pada detail tiket, koordinator asal mengajukan handoff lalu memperoleh tautan penerimaan untuk koordinator tujuan. Tautan mengandung referensi tiket dan permohonan. Halaman tujuan hanya menampilkan formulir penerimaan dan versi tiket sampai server menerima handoff.
- GET permohonan memerlukan mandat `ticket.handoff.accept` pada organisasi tujuan. Penerimaan memerlukan akses tiket pada organisasi itu dan memeriksa ulang tim tujuan aktif. Replay receipt memeriksa organisasi pemilik saat ini serta ikatan permohonan pada audit.
- Koordinator atau teknisi berwenang dapat membaca status eskalasi melalui tombol **Periksa status eskalasi**. Status **Eskalasi tercatat pada riwayat tiket** berarti permintaan telah tercatat. Tindak lanjut otomatis vendor dan aturan peralihan tingkat memerlukan kebijakan DEC-M04.
- Audit read-only stack lab mengklasifikasikan 28 job auto-close historis. Sebanyak 26 sudah stale dan dua masih memenuhi guard untuk replay berizin. Petugas memeriksa ulang tiket serta proof sebelum replay melalui rute scheduler. Dead-letter transport M3 ke M7 dicatat terpisah.

## Definisi laporan dan ekspor

- Periode memakai interval `[from,to)` dengan tampilan Asia/Jakarta. Ringkasan memakai cohort tiket diterima. Ekspor juga menerima cohort waktu resolusi atau tiket aktif dalam periode penerimaan. Data diproyeksikan per tiket dan episode aktif dengan scope pemilik terkini.
- Denominator adalah tiket selesai dengan endpoint dan target yang terukur. Numerator tepat waktu mencakup endpoint pada atau sebelum target. Selesai terlambat, dibatalkan, backlog, dan selesai tanpa fakta lengkap dilaporkan terpisah. Persentase kosong bernilai null. Watermark adalah waktu event terbaru dari fakta dalam cohort.
- CSV dan JSON menyimpan isi serta digest saat ekspor dibuat. Snapshot berlaku 24 jam. Pengambilan memeriksa mandat ekspor saat ini, pemohon, scope dan kepemilikan M3. Perubahan kepemilikan menolak snapshot lama. Laporan baru menyaring baris yang sudah berpindah sebelum agregasi. OPD tujuan melihat fakta setelah proyeksi mengejar event handoff. Batasi periode maksimal 366 hari dan hasil maksimal 10.000 baris. Persempit periode jika melampaui batas.

## Diagnostik dan operasi

- `/livez` memeriksa proses. `/readyz` memeriksa dependensi kesiapan rute. `/api/v1/admin/health` memakai probe per pool owner, scan fixture ClamAV, tulis/baca/hapus probe storage, heartbeat scheduler dan antrean binding. Inbox lag tidak diukur dan bernilai null.
- `HEALTH_REPORT` menyimpan receipt pemeriksaan. `BACKUP_MANIFEST` mencatat permintaan, persetujuan petugas kedua, dan eksekusi nyata berizin `POST /api/v1/admin/operations/{id}/execute` (`APPROVED -> RUNNING -> SUCCEEDED/FAILED`) yang memverifikasi checksum `configs/M0.json`, `migrations/manifest.json`, metadata sembilan owner, dan integritas blob privat serta menyimpan artefak terverifikasi di `/private/uploads/manifests/{id}.json` (`GET /api/v1/admin/operations/{id}/artifact`). Eksekusi restore ke instans baru dilakukan melalui drill terisolasi. Purge tetap `DISABLED` selama DEC-M07 terbuka.
- Jalankan `python -X utf8 scripts/test_rm0_03.py` untuk uji HTTP/PostgreSQL terkontrol dan `python -X utf8 scripts/drill_rm0_03_restore.py` untuk pemulihan sintetis. Target harus dibuat oleh script, dengan jaringan internal, tanpa port host dan tanpa volume kerja. Periksa receipt dan status cleanup sebelum retry.

## Resource envelope F15

| Layanan | CPU milivCPU | RAM MiB |
|---|---:|---:|
| Aplikasi | 2.500 | 4.608 |
| PostgreSQL | 1.000 | 2.560 |
| Nginx | 400 | 768 |
| ClamAV | 1.000 | 3.072 |
| **Total layanan tetap (Profil R2)** | **4.900** | **11.008** |
| Migrasi, sementara | 250 | 128 |
| Inisialisasi storage, sementara | 100 | 32 |
| Seed lab, sementara | 250 | 128 |
| Test Compose, sementara | 1.000 | 1.024 |

Limit dan digest empat kontainer dicatat di [runtime-limits.txt](../qa/remediation/rm0-03/runtime-limits.txt). `DEC-M10` ditetapkan pada level lab melalui [ADR 0009](../docs/adr/0009-resource-envelope-and-rpo-rto-dec-m10.md) dengan dua profil eksplisit yang setara: **Profil R1 (4.000m / 8.192 MiB)** untuk inti riset dengan exporter tanpa ClamAV, dan **Profil R2 (4.900m / 11.008 MiB)** untuk stack Compose dengan ClamAV aktif. Model pembanding lanjutan (`C3`, `F9`, `G-OPT`) wajib menerapkan budget aplikasi `2.500m / 4.608 MiB` dan `scanner` yang identik sesuai profil uji. Kapasitas server produksi permanen tetap memerlukan otorisasi Infrastruktur sebelum deployment produksi.
