# Cakupan bukti kontrak M0-02

`business_traceability.csv` memetakan operasi, command canonical, owner, permission, FR/AC dan referensi data/event/fixture. Daftar tabel tiap baris merupakan inventaris owner terkait, bukan izin melakukan semua query atau transaksi lintas owner.

| Deliverable | Artefak | Bukti fase ini | Belum dibuktikan |
|---|---|---|---|
| API | openapi/business.json dan scripts/build_business_contracts.py | OAS 3.1, referensi lokal, schema/contoh, invalid payload, alias, error, pagination, key/version dan job 202 | Handler dan enforcement API bisnis |
| DDL | migrations/m1 sampai m9, manifest/checksums, apply.sh | Apply, ulang apply, login/privilege sembilan role, FK lokal, constraint, checksum drift, rollback dan out-of-order pada DB disposable | Penerapan DB kerja, transaksi use case dan worker recovery |
| Event | events/business.v1.schema.json dan subscriptions.v1.json | Envelope/payload/producer, invalid examples, edge dependency dan kompatibilitas dua event resolusi | Delivery/retry/lease/ACK/dedup/ordering runtime |
| State/ACL/kalender | policy/ dan tests/contract/*fixture.json | Model executable, ekspektasi terpisah, batas izin/state, attempt/deadline, kalender libur/pause | Principal asli, use case Go, race DB, scheduler dan UI |

| Acceptance | Bukti M0-02 | Kelanjutan acceptance |
|---|---|---|
| AC02 | Kontrak payload/error/command M0 executable | HTTP bisnis dan perbandingan antararsitektur |
| AC03 | Key scope/action/target, payload digest, kontrak replay dan uniqueness DB | Unknown commit, payload conflict dan satu efek bisnis pada retry di M0-04 |
| AC06 | Fixture policy dan role DB, hidden 404/visible 403, revocation/scope sebelum count/export | Enforcement auth/use case/API/list/download mulai M0-03 dan slice terkait |
| AC08 | State/guard, attempt/version, 24 jam kalender, CAL-1, libur dan pause union | SLA Go, persistensi, concurrency/restart job M0-06/M0-07 |

AC fitur lain dapat memakai fixture ini sebagai input, tetapi status end-to-end tidak otomatis PASS. Feature coverage FR01–FR29 tetap menyatakan implementasi produk belum selesai. FR04/FR05/FR07/FR08/FR09/FR14 adalah aspek presentasi/komponen tanpa endpoint khusus M0-02. FR lain ditelusuri lewat operasi API; tabel/grafik/editor tetap memerlukan acceptance UI fase konsumennya.

Idempotency-Key terikat actor/capability terverifikasi, command, target dan digest payload tervalidasi. Replay memeriksa binding serta izin saat ini; intent berbeda dengan key sama menghasilkan 409. Uniqueness tabel bukan bukti atomisitas use case. Fase bisnis harus menyediakan test vectors normalisasi payload dan implementasi hash yang setara untuk transport lokal/varian penelitian.

Event intent tidak memerlukan versi rapat. TicketCreated/TicketStateChanged merupakan snapshot lengkap untuk convergence, sedangkan intent specialized memakai stream tersendiri. Projection tetap memeriksa authorization/revocation terkini. List memfilter scope sebelum cursor/count dengan tie-breaker ID. Bulk memeriksa action permission/version per target dan mengembalikan partial failure. JSON upload hanya metadata; byte stream masuk melalui endpoint quarantine yang tetap dibatasi serta diperiksa server.

Config admin tidak otomatis membaca tiket. Vendor portal dan purge disabled. Kalender, grant ceiling, reopen, retensi dan batas media adalah default lab yang harus disahkan sebelum penggunaan nyata. C3/F9/G-OPT tetap DEFERRED_RESEARCH.
