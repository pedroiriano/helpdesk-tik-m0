## 15 Aturan pembangunan yang wajib ditegakkan

Gunakan bahasa Indonesia untuk UI dan komunikasi. Identifier, schema, permission, status dan API memakai nama English canonical. Requirement berasal dari blueprint M0 dan seluruh kemampuan produk v3.2. Bedakan aturan wajib, usulan teknis dan keputusan organisasi terbuka. Konflik yang mengubah ownership, transaksi, permission atau kontrak harus memiliki ADR serta otorisasi sesuai risikonya. Keputusan teknis kecil yang reversibel cukup dicatat dan dikerjakan tanpa menghentikan tugas.

### Backend dan batas modul

Handler hanya melakukan parsing, validasi bentuk, mengambil principal tepercaya, memanggil use case dan memetakan error. Aturan bisnis serta authorization objek berada pada use case/domain sehingga pemanggilan lokal dan worker tidak membypass guard. Store hanya menjalankan query owner. Jangan menulis SQL di handler atau React. Dependency flow dari bootstrap ke factory, app ke domain/port, dan store mengimplementasikan port repository. Domain tidak bergantung pada framework HTTP/driver.

Terapkan pemeriksaan import yang membaca package Go setelah bootstrap. Tolak impor sibling internal/domain/store dan siklus. contracts/dependencies.json mengatur dependency sinkron bisnis. Event subscription diatur terpisah; jangan menambahkan edge sinkron balik hanya untuk menunggu projection. Sebagai contoh, M3 memakai M2/M4/M5/M6 public ports; M7 memakai M3 command port; M5/M6/M9 menerima event M3 secara asinkron. Auth context disediakan platform/M1 tanpa roundtrip jaringan atau import store identitas.

Repository constructor menerima pool khusus owner, bukan satu superuser pool yang dipakai sembilan modul. Query literal maupun query builder tidak boleh mengakses schema owner lain. Verifikasi melalui role DB dan negative integration tests, bukan hanya regex SQL. Migrator mempunyai role administratif terpisah. Helpers transaksi tidak boleh membuka nested transaction owner lain. Port lokal memakai value/copy dan tidak mengembalikan entity mutable milik repository.

Semua operasi I/O menerima context; deadline dan cancellation diwariskan. Error dikategorikan menjadi validation, unauthorized, forbidden, not found, conflict, rate limited dan dependency error tanpa membocorkan detail internal. Retries hanya untuk kelas yang aman dengan key idempoten dan batas total deadline. Tidak retry buta pada semua 4xx atau mengganti key ketika timeout. Log terstruktur menyensor token/cookie/password dan payload pribadi.

### Database dan event

Migrasi diberi ID monoton, owner, checksum dan tujuan. Forward-only additive menjadi default; backfill bounded dengan observabilitas. Jangan menjalankan drop/rename destruktif di lingkungan berdata tanpa otorisasi, backup dan strategi pemulihan. Seed lab dapat diulang pada database disposable yang diberi guard lingkungan. Tidak melakukan truncate atau reset database hanya agar test lulus.

Role runtime tidak memiliki CREATE pada schema lain, DDL atau hak migrator. Permission ownership berlaku walaupun semua modul ada dalam satu proses. Migration test membuktikan role M3 tidak dapat membaca tabel identity dan M9 tidak dapat mengubah intake.tickets. Query dan indeks disusun dari pola list/filter yang nyata, termasuk tie-breaker ID dan visibility. CHECK serta foreign key dalam owner melengkapi validasi aplikasi, bukan menggantikannya.

M3 write atomic mencakup aggregate, version/history, intent event serta hasil idempotency. Outbox local menyimpan target consumer pada saat commit. Consumer hanya ACK setelah inbox dan efek commit. Crash sebelum commit tidak menghasilkan event durable; crash sesudah commit/lost ACK tidak menggandakan efek. Retry lease dapat dipulihkan sesudah restart. Dead-letter mempunyai reason dan prosedur replay berizin; replay tidak mengubah event_id/digest diam-diam.

Bukti notifikasi untuk auto-close harus dapat diverifikasi oleh M3. Gunakan event NotificationStored dari M9 yang disimpan pada confirmation notification projection milik M3 dengan inbox dedup, berisi ticket_id, resolution_attempt_id dan notification_id. Event itu hanya terbit setelah pusat notifikasi durable, melalui outbox M9. Ini edge event balik yang sah, bukan transaksi atau query lintas owner. M3 menolak auto-close bila bukti untuk attempt aktif belum ada. Pengiriman Telegram tidak menjadi bukti ini. Definisikan stream/subscription per event sehingga gap versi palsu tidak memblokir consumer.

Bukti permission yang dapat berubah tidak dipercaya dari snapshot lama. Saat write atau file download, periksa revocation sesuai policy. Background command memakai service principal terbatas serta origin actor jika ada, bukan Super Admin. Event payload diminimalkan dan tidak memberi consumer hak baru yang tidak dimiliki. Trace correlation bukan credential.

### Frontend dan pengalaman pengguna

Bangun design tokens dan komponen bersama sebelum halaman turunan. Jika pada saat implementasi sudah ada design system proyek yang sah, reuse komponen tersebut dan catat penyesuaian; jangan membuat sistem visual kedua. State domain berasal dari API typed. Client tidak menghitung sendiri izin final, deadline resmi atau kepemilikan tiket. Status loading, empty, pending, conflict, forbidden dan offline merupakan bagian acceptance.

Setiap feature selesai harus memiliki UI operasional, API yang benar dan persistence yang bertahan setelah refresh/restart sesuai kontrak. Array dummy, localStorage sebagai database tiket, tombol no-op dan success toast tanpa server effect tidak dianggap implementasi. Adapter lab identitas/notifikasi merupakan pengecualian eksplisit dengan tujuan dan status terlihat. Jangan menampilkan kredensial fixture sebagai akun produksi.

Form menggunakan skema berversi, validasi field serta error summary. Pada dynamic form, perubahan master tidak memaksa draft lama diterima tanpa migrasi/review. Autosave menyatakan revision terakhir yang diakui server. Recovery tidak mengirim tiket otomatis. Handler UI mempertahankan idempotency key untuk intent yang sama dan memisahkan simpan draft dari submit final. UI mengingatkan risiko perangkat bersama tanpa menyimpan secret dalam draft.

Bulk action menyimpan daftar target/snapshot filter dan memastikan izin/version per item. Hasil partial failure menampilkan mana yang berhasil/gagal. Pagination server memakai cursor stabil; total yang belum tersedia tidak direkayasa. Search suggestion dan histogram grafik tidak boleh mengungkap objek tanpa hak. Export job tetap memeriksa permission ketika file diambil. Aksi nonreversibel mempunyai dialog dengan objek, akibat, dan alasan yang jelas.

### Pengamanan dependensi dan operasi

Pada bootstrap catat versi Go, Node, React, TypeScript, Vite, pgx, PostgreSQL, tool migrasi/test, image base dan OS/runtime. Pin lockfile/digest dan dokumentasikan sumber verifikasi. Jangan memakai latest dalam image release. Dependency baru memiliki justifikasi fungsi, lisensi dan maintenance; upgrade mayor atau perubahan framework memerlukan keputusan eksplisit. Tidak menjalankan npm audit fix --force.

Konfigurasi publik frontend tidak memuat secret. Contoh environment hanya nama key dan placeholder, tanpa token nyata. Secret scanning tidak membenarkan pencetakan seluruh env/log. Test Telegram menggunakan sink dan verified fake bindings. Aktivasi kanal nyata memerlukan otorisasi serta target yang jelas. Hal yang sama berlaku untuk SSO, data asli, deployment, purge dan restore.

Proxy hanya mempercayai header IP dari upstream terkonfigurasi. Gunakan batas ukuran body/file, request timeout, concurrency dan rate limit sesuai konteks. Upload tidak mengambil URL arbitrer, mengeksekusi file atau menyajikan HTML aktif dari storage privat. Rich text disanitasi server. API client scopes diperiksa pada owner. Runner operasi hanya menerima job kind allowlist dan parameter tervalidasi; tidak ada endpoint exec atau SQL console umum.

## 16 Pengujian proporsional dan bukti kelulusan

Minimum test set harus membuktikan requirement yang berubah. Tes unit memeriksa invariants/policy, tes integrasi PostgreSQL memeriksa transaksi/constraint/role, tes kontrak memeriksa OpenAPI dan error, serta browser smoke memeriksa perjalanan pengguna. Mock DB tidak membuktikan concurrency atau SQL permissions. Tidak perlu menjalankan seluruh suite keamanan berulang untuk perubahan teks atau UI sederhana.

| Jenis perubahan | Pemeriksaan minimum | Perluasan bila risikonya muncul |
|---|---|---|
| Dokumen dan aturan agent | Link/ID, JSON/CSV, konsistensi canonical dan render Word bila diubah | Konflik policy atau requirement perlu review domain |
| Pure rule M4/M6 | Fixture batas, input invalid dan determinisme | Kalender/timezone, confidence atau SLA berubah memerlukan regression |
| API/use case | Contract dan affected-module integration | Auth, idempotency, concurrency dan SQL menambah negative tests |
| Identitas/permission | Cross-user, cross-OPD, forged role, revoked/expired akses | List/search/count/export/download serta background jobs |
| Transaksi/event | Commit/rollback, lost response, duplicate/reorder/ACK/restart | Race detector pada jalur concurrent dan queue load bounded |
| Upload/media/editor | ACL, MIME/signature, oversize, quarantine, sanitasi | Reuse privat/publik, orphan dan revocation link |
| UI shared component | Keyboard, error/empty/loading, desktop/mobile representatif | Browser tambahan hanya jika bug atau kompatibilitas belum terbukti |
| Dependency/container/config | Build lockfile, scan relevan dan permission config | Full candidate gate pada final source yang akan dirilis |

Tiga fixture inti adalah G01 guest melaporkan tautan rusak, P01 publik login meminta bantuan akun dan A01 ASN melaporkan gangguan aplikasi internal. Gunakan pemohon kedua dan OPD kedua untuk negative pair. Tambahkan L1/L2, supervisor dan vendor scope terpisah. Jam bisnis dapat dibekukan, tetapi latency teknis memakai monotonic clock. Auto-close 24 jam diuji dengan clock fixture, bukan menunggu sehari atau mengubah policy produksi menjadi satu menit.

Tidak ada command aplikasi yang dianggap tersedia pada paket awal. planning/command_registry.json mencatat status NOT_IMPLEMENTED sampai M0-01 membuat script nyata. Command yang direncanakan mencakup backend format/vet/test, import boundary, DB/migration integration, frontend lint/typecheck/test/build, contract, E2E smoke dan security/recovery. Tulis command aktual setelah memeriksa go.mod/package.json; jangan menjalankan nama script rekaan lalu melaporkan PASS. Validator paket scripts/verify_package.py hanya memeriksa dokumen dan konsistensi, bukan aplikasi.

Gate kandidat final menggabungkan affected tests yang relevan, backend build/race pada jalur concurrent, frontend typecheck/build, kontrak, migration/DB roles, authorization negatif, media, recovery worker, browser smoke, dependency/image/secret checks dan resource config. Full gate dilakukan pada source final yang tercatat. Jika ada perubahan sesudahnya, jalankan ulang cakupan terdampak dan gate sesuai risiko. CI terlindungi menjadi otoritas broad verification saat tersedia; saat belum ada CI, catat NOT_CONFIGURED dan jangan mengarang status remote.

Selesai implementasi berarti seluruh acceptance M0 yang in scope mempunyai test/evidence dan tidak ada blocker. Review keamanan produksi, UAT, legal/retensi organisasi, backup restore produksi serta persetujuan release adalah gate berbeda. DEFERRED_RESEARCH tidak berarti semua model telah diverifikasi. Jangan menggunakan hasil validator dokumen sebagai hasil benchmark atau aplikasi.

## 17 Dokumentasi perubahan dan aturan selesai

Setiap task menghubungkan requirement AC/FR, modul, data/API/UI yang berubah, risiko, test command dan hasil. Gunakan status/evidence.jsonl untuk bukti ringkas dengan waktu, agent, task, source reference, command, exit code dan lokasi output tersensor. Jika belum Git, catat hash file relevan; jika sudah Git, catat SHA aktual serta dirty state. Screenshot UI menyimpan viewport dan fixture tanpa data asli.

Task definition of done mencakup kontrak/schema yang sinkron, implementasi utuh, handling gagal/izin, persistence, test sesuai risiko, dokumentasi dan daftar keputusan terbuka yang tidak disembunyikan. Subset fitur boleh diserahkan sebagai PARTIAL dengan daftar acceptance yang tersisa. Tidak ada klaim “production ready” berdasarkan pemeriksaan source saja. Issue yang diketahui tidak dihapus dari handoff saat agent berganti.

Untuk bug, lakukan reproduksi dan temukan akar masalah sebelum fix yang terarah serta regression test. Untuk refactor, buat shared abstraction, pindahkan consumer representatif, lalu migrasikan sisanya tanpa mengubah perilaku. Preserve unrelated changes. Jangan menulis ulang sejarah Git, reset working tree, mengganti framework atau melonggarkan permission untuk mempercepat penyelesaian. Jika tindakan berisiko belum diotorisasi, tandai BLOCKED_<ALASAN> untuk tindakan tersebut dan lanjutkan pekerjaan aman yang independen.
