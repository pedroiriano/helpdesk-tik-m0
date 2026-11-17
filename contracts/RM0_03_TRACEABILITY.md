# Traceability RM0-03

Status per kriteria, hasil pemeriksaan, dan batas kandidat tercatat di [completion.json](../qa/remediation/rm0-03/completion.json).

| Kriteria | Jalur implementasi | Bukti yang digunakan |
|---|---|---|
| R3-A / F08 | M3 CreateTicket dan VerifyTicket memanggil policy M6. Snapshot mencatat target, hari libur, kalender dan versi. | HTTP lintas CAL-1/CAL-247 dan perubahan prioritas pada fixture terkontrol. |
| R3-B / F09 | ReadTicketSLA dan snapshot event menggunakan clock episode M3 dengan evaluator M6. Jeda tetap terikat pada episode. | Jam kalender dan kerja, irisan jeda, endpoint resolusi, vendor/PIC, reject, reopen. |
| R3-C / F10 | M3 menyelesaikan auto-close melalui CAS upaya aktif, waktu konfirmasi, dan bukti yang tersimpan setelah event M9. | Penolakan tanpa bukti, batas 24 jam, dua pelaksana concurrent dan upaya kedaluwarsa. |
| R3-D / F10 | M7 claim/reclaim, retry, fence dan replay dead-letter tercatat secara durable. | Kedaluwarsa lease, rekonsiliasi lost ACK, backoff, audit replay dan akses. |
| R3-E / F09 | M3 menjaga OPD asal sampai penerimaan, mencabut penugasan asal, dan menerbitkan snapshot ownership. M5/M9 memproyeksikan versi terbaru. UI tujuan membaca tawaran terbatas, UI koordinator membaca receipt eskalasi. | Detail, pencarian, daftar lampiran, laporan, ekspor, tawaran dan replay receipt lintas OPD. Eskalasi manual L2/koordinator/pimpinan diuji. |
| R3-F / F11 | M9 mengukur endpoint dibanding due, menyimpan snapshot CSV/JSON, dan memeriksa pemilik aktual melalui port M3. | Cohort tepat waktu/terlambat, backlog, watermark fakta, isolasi scope, serta penolakan snapshot lama setelah handoff. |
| R3-G / F11 | M9 sink lokal dan challenge terbitan server untuk pengikatan sintetis. | Receipt durable, kode sembarang dan replay ditolak, pencabutan binding. Kanal nyata menunggu DEC-M09. |
| R3-H / F12 | M1 menjalankan probe health dan mencatat approval versi job oleh petugas kedua. Drill menyalin dump dan blob ke target tersendiri. | Status scanner gagal yang teredaksi, storage probe, scope approval, checksum dan verifikasi dua proses aplikasi sesudah pemulihan. |
| R3-I / F15 | Limit Compose/runtime dan baseline penelitian dicatat sebagai pengukuran terpisah. | Perbandingan limit dan digest dengan keputusan DEC-M10 terbuka. |
| R3-J | DDL 023–030 menambah kolom/tabel, tanpa mengubah checksum 001–022. Kontrak dan UI memakai hasil server. | Gate migrasi role dan rollback DDL, kontrak, build, smoke lokal sesuai hasil final. |

Skenario pengujian HTTP menggunakan `TestRM003Integration`. Pengujian recovery memakai `TestRM003RecoveryRead`. Definisi detik, cohort, dan operasi ada pada [runbook RM0-03](../runbooks/rm0-03-lab.md).
