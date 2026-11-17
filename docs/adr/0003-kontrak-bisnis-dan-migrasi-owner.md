# ADR 0003 — Kontrak executable dan migrasi owner M0-02

4 November 2026. Keputusan teknis lokal dalam scope M0-02. Boundary modul, permission organisasi, stack runtime dan ruang penelitian tidak berubah.

## Keputusan

Health OpenAPI, dua event resolusi dan bootstrap owner sudah tersedia. M0-02 menambahkan kontrak bisnis sebelum handler/consumer, DDL additive dan fixture executable. HTTP mengikuti [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0), dengan JSON Schema 2020-12. Tidak ada endpoint bisnis dummy.

- `scripts/build_business_contracts.py` menjadi sumber definisi API, event/subscription dan traceability. JSON/CSV hasilnya diperiksa dengan `--check`. Policy/state/calendar JSON menjadi sumber rule referensi. Expected outcomes dan kasus negatif ditulis terpisah pada tes/fixture.
- Validator OpenAPI 0.9.0 dipasang pada `.local/openapi-tools`, dengan versi transitif dipin pada `tests/contract/openapi-requirements.txt`. Validator berlisensi Apache-2.0 dan hanya digunakan untuk development. Pilihan awal 0.7.2 berbenturan dengan referencing lama, sedangkan 0.9.0 memerlukan jsonschema berbeda. Tooling terpisah mempertahankan lock event lama. Regresi event lama tetap dijalankan pada gate baru. Pemeriksaan eager referensi lokal melengkapi validasi struktur OAS; gate tidak mengambil remote `$ref`.
- `scripts/build_owner_migrations.py` menghasilkan DDL domain awal, manifest dan checksum lock. Foundation 001 dipertahankan byte-identik dan diperiksa digest-nya. Setelah suatu migrasi dipakai, perubahan berikutnya harus berupa migrasi baru. Generator bukan izin menulis ulang histori untuk menghilangkan drift.
- Runner memeriksa checksum lock, kemudian memakai advisory transaction lock serta ledger per migrasi. DDL dan ledger commit atomik. Apply identik dilewati; checksum/path/owner drift dan penyisipan ID lebih kecil ditolak. `migration_control` adalah schema metadata migrator, bukan owner bisnis kesepuluh. Runtime tetap sembilan role/pool, tanpa DDL, DELETE umum atau akses ledger.
- Compose memasang infra dan owner migrations read-only. Wrapper secret yang sudah ada memanggil runner baru. DDL domain dan perubahan job ini belum dijalankan pada DB kerja dalam task ini.
- Gate DB memakai image PostgreSQL terpin dan kontainer berlabel dengan nama acak, `network none`, tmpfs, tanpa port host/volume persisten. Cleanup hanya menghapus kontainer yang dibuat invocation tersebut setelah verifikasi label. Kredensial/data DB kerja tidak digunakan.

## Delivery dan projection

M3 menerbitkan snapshot `TicketCreated`/`TicketStateChanged` dalam transaksi yang sama dengan state/history/idempotency/outbox. Snapshot membawa UUID scope/pemohon, assignment, state, clock/policy dan endpoint resolusi untuk projection. M5/M6/M9 membandingkan aggregate snapshot version dan mengabaikan snapshot lebih lama. Intent specialized tidak memajukan watermark snapshot dari payload parsial. Perubahan assignment, pause, handoff dan hasil resolusi yang mengubah snapshot juga harus menerbitkan snapshot terkini.

Dua event resolusi v1 dipertahankan. Pada NotificationStored, `aggregate_id` adalah notification ID, sedangkan `payload.ticket_id` dan `payload.attempt_id` mengikat bukti ke upaya M3. Intent yang tiba sebelum context snapshot dipertahankan secara durable untuk retry/reconciliation, tanpa ACK sukses sebelum efek commit dan tanpa menunggu versi yang tidak disubscribe. M9 memeriksa penerima berhak melalui actor/policy tepercaya sebelum menyimpan notifikasi. Tidak ada query/transaksi lintas owner untuk mendapatkan context.

Producer menyimpan daftar consumer wajib saat commit. Inbox memeriksa event ID dan digest; ID sama dengan digest berbeda merupakan integrity error. ACK sesudah inbox dan efek lokal commit. M9 menangani audit sendiri secara lokal tanpa self-relay. Bukti schema/subscription belum membuktikan runtime crash/replay/ordering.

## Batas bukti

Evaluator Python adalah model kontrak murni, bukan auth atau writer tiket aplikasi kedua. Ia tidak terhubung HTTP, DB atau worker. Fase bisnis harus membangun enforcement Go dan menguji kasus yang sama terhadap use case/API nyata. Kalender CAL-1 dan role/scope fixture adalah lab sintetis. Keputusan organisasi tetap OPEN sesuai decisions.csv.

Validasi kontrak/fixture/constraint DB tidak membuktikan UAT, keamanan produksi, concurrency transaksi tiket, auto-close runtime atau parity empat arsitektur. Tidak ada perubahan UI, benchmark, kanal nyata atau deployment.
