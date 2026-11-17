# Migrasi owner dan ledger

Manifest memuat foundation 001, DDL kontrak 002–010 untuk M1–M9 serta tambahan identity 011/catalog 012, intake 013/017, owner delivery 014/015 dan notify_audit 016. Migrasi historis dipertahankan. Cross-owner IDs adalah UUID/snapshot, bukan FK. Runtime memperoleh DML terbatas pada owner sendiri. History, audit, event payload, inbox dan hasil idempotency tidak mendapat UPDATE/DELETE umum.

Definisi awal ada pada `scripts/build_owner_migrations.py`. Periksa dengan `python scripts/build_owner_migrations.py --check`. **Setelah migrasi diterapkan, jangan mengubah atau regenerate isi historis.** Tambahkan migrasi additive dengan ID global monoton, manifest dan checksum baru. Perluas generator/runner secara terkontrol jika pola nama migrasi baru diperlukan. M0-02 tidak memberikan izin reset/drop DB kerja.

`apply.sh` dijalankan job migrator melalui wrapper infra PostgreSQL, bukan proses aplikasi. Mount SQL read-only. Checksum lock terikat manifest dan diperiksa gate source. Runner memeriksa checksum, mengambil advisory transaction lock, menolak drift/out-of-order, lalu mengomit SQL dan ledger dalam satu transaksi per migrasi. Ledger hanya diakses migrator. Kegagalan satu migrasi tidak membatalkan migrasi sebelumnya yang sudah commit, dan migrasi gagal tidak dicatat berhasil.

M0-03 menerapkan 001–012 melalui job migrator ke DB kerja lokal. Readiness memeriksa sembilan marker foundation versi 1 serta identity.domain_version/catalog.domain_version versi 3. Marker ini bukan bukti seluruh fitur produk. Lihat qa/m0-03/environment.json dan runbooks/m0-03-lab.md.

Gate saat ini dari root proyek adalah `python scripts/test_owner_migrations.py --report qa/m0-04/migrations.json`. Script membuat PostgreSQL sementara dengan image terpin, tanpa network/port host/volume persisten. Fixture drift/rollback hanya ditulis pada kontainer tes. Cleanup memeriksa label kontainer sendiri. Bukti terkini berada pada `qa/m0-04/migrations.json`; qa/m0-02 dan qa/m0-03 adalah snapshot historis yang dipertahankan.

M0-04 menerapkan 013–017 melalui migrator pada DB kerja yang sama setelah gate PostgreSQL disposable. Readiness juga memeriksa intake/notify_audit domain versi 4. Lihat qa/m0-04/migrations.json dan qa/m0-04/completion.json; bukti disposable dan penerapan DB kerja terpisah.
