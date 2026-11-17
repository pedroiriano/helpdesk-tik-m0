# Handoff RM0-03

Status pekerjaan dan hasil pemeriksaan berada di [completion.json](../qa/remediation/rm0-03/completion.json). RM0-02 diverifikasi sebagai checkpoint berdasarkan 671 file yang cocok dengan manifest sebelum perubahan RM0-03. RM0-04 tetap NOT_STARTED.

## Perubahan

- M3/M6 mengambil target respons dan resolusi dari snapshot SLA. Detail tiket dan event proyeksi memakai jam episode, jeda disetujui, serta endpoint resolusi yang sama.
- M7 menambahkan reclaim lease, fence, retry, dead-letter, replay berizin dan rekonsiliasi lost ACK.
- M9 menyimpan fakta SLA terukur, memisahkan penyelesaian terlambat, dan mengunci isi ekspor terhadap snapshot. Izin dan kepemilikan tiket diperiksa kembali saat ekspor diakses. Sink lab menggunakan kode verifikasi terbitan server.
- M1 menjalankan probe diagnostik dan menyimpan receipt laporan kesehatan. Persetujuan backup memerlukan aktor kedua pada scope yang sama. Purge dinonaktifkan. Backup dan restore sintetis dijalankan melalui drill terisolasi.
- UI memakai hasil SLA dan health server serta menyediakan formulir persetujuan terautentikasi. Perubahan terbatas pada alur fase ini dan memakai komponen yang sudah ada.

## Bukti dan batas

Lihat [runbook](../runbooks/rm0-03-lab.md) untuk definisi metrik, fixture dan langkah pengujian. Scope fase adalah lab lokal dan disposable. Pengesahan target SLA, kewenangan proses, retensi dan kanal nyata tetap berada pada keputusan pemilik masing-masing.

Limit runtime 4.900 milivCPU dan 11.008 MiB telah diukur dari konfigurasi kontainer aktif. Baseline pilot penelitian 4.000 milivCPU dan 8.192 MiB mencakup exporter. DEC-M10 masih diperlukan untuk menutup F15. Belum ada benchmark empat model, UAT organisasi, protected CI atau hasil produksi.

## Checkpoint aktual

Gateway port 18080 berstatus ready. Empat kontainer sehat pada probe Compose, dan browser admin menampilkan diagnostik DEGRADED sesuai 26 dead-letter transport historis M3 ke M7. Inventaris read-only mengklasifikasikan 28 job auto-close historis. Sebanyak 26 sudah stale dan dua masih memenuhi guard untuk replay berizin. Keduanya masih tercatat untuk peninjauan petugas.

Integration final mencocokkan 212 file source tanpa drift. Skenario tambahan membuktikan rollback sink saat penyimpanan receipt gagal, retry yang menghasilkan satu notifikasi/bukti durable, dan satu pemenang antara feedback dan auto-close. M3 membatasi proyeksi laporan berdasarkan OPD pemilik aktual sebelum agregasi. Snapshot ekspor lama ditolak setelah perpindahan. Verifikasi UI mencakup login admin dengan keyboard, probe ClamAV/storage/scheduler pada desktop, dan laporan OPD melalui keyboard pada viewport 390 × 844.

R3-E membuktikan receipt eskalasi manual L2/koordinator/pimpinan serta pencabutan akses detail, pencarian, daftar lampiran, laporan dan ekspor. UI koordinator dapat memeriksa status eskalasi dan memberikan tautan penerimaan yang berisi referensi minimal. Target menerima melalui mandat yang tepat dan tim aktif. Receipt baru dan receipt versi lama diuji ulang terhadap owner aktual. Pembuktian penerimaan lewat browser memakai API disposable dan smoke UI read-only karena database kerja tidak memiliki tawaran aktif. Aturan tindak lanjut vendor dan eskalasi otomatis menunggu DEC-M04.

## Penutupan teknis RM0-03 — 17 November 2026

- **R3-H (`BACKUP_MANIFEST` eksekusi nyata & bukti artefak):** Diimplementasikan `POST /api/v1/admin/operations/{id}/execute` (`APPROVED -> RUNNING -> SUCCEEDED/FAILED`, `execution_receipt` teredaksi) dan `GET /api/v1/admin/operations/{id}/artifact` (`X-Manifest-SHA256`, `no-store`, `nosniff`, ACL organisasi/izin). Runner mengkueri kesembilan schema/pool terpisah (`pools[0..8]`), memverifikasi checksum SHA-256 berkas fisik M3 (`intake.attachments`) & M8 (`knowledge.media`), dan mencerna `configs/M0.json` serta ledger migrasi (`migrations/manifest.json`, `migrations/checksums.sha256` yang turut disalin ke citra runtime). Terbukti via unit test (`blob`, `database`, `m1`), `python -X utf8 scripts/test_rm0_03.py --report qa/remediation/rm0-03/integration-final.json` (`PASS`), drill pemulihan (`scripts/drill_rm0_03_restore.py` -> `recovery.json`, `rpo_fixture_missing_commits: 0`, `rto_seconds_to_first_http_read: 155.772`), dan alur end-to-end UI Scoped Runner (`REQUESTED -> APPROVED -> SUCCEEDED -> unduh HTTP 200 kecocokan SHA-256`) di [browser-final.json](../qa/remediation/rm0-04/browser-final.json).
- **R3-I (`DEC-M10` dua profil lab setara):** [ADR 0009](../docs/adr/0009-resource-envelope-and-rpo-rto-dec-m10.md), [technology-lock.json](../planning/technology-lock.json), dan [decisions.csv](../planning/decisions.csv) memisahkan **Profil R1** (`4.000m / 8.192 MiB`: app+db+web+exporter) dan **Profil R2** (`4.900m / 11.008 MiB`: app+db+web+ClamAV scanner) dengan kontainer `app` invarian (`2.500m / 4.608 MiB`).
- **Migrasi 001–035:** Diverifikasi utuh dan deterministik via `scripts/test_owner_migrations.py --report qa/remediation/rm0-03/migrations-final.json` (`PASS`). Gateway lokal dipindah dari `18080` ke `18090` karena port `18080` ditempati kontainer eksternal `teman-dinamis-gateway-1`. Keputusan kebijakan bisnis (`DEC-M03..M09`) dan UAT manusia dicatat untuk fase RM0-05.
