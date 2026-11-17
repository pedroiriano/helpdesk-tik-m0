# Handoff M0-02

4 November 2026, Asia/Jakarta. Dari Codex untuk pelaksana fase selanjutnya. Workspace tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Git belum diinisialisasi. Identitas source memakai hash pada laporan QA, bukan SHA yang dibuat-buat. Perubahan UI/aset pengguna tetap dipertahankan.

## Hasil aktual

M0-02 menambahkan OpenAPI bisnis executable, event/subscription, pemetaan operasi/owner/FR/AC, model policy/state/kalender dengan fixture terpisah, DDL sembilan owner, runner/ledger/checksum dan gate PostgreSQL disposable. Daftar file/hashes dan hasil penutupan berada pada `qa/m0-02/completion.json`. AC02 AC03 AC06 AC08 baru terbukti untuk scope kontrak/model/constraint fase ini, sehingga acceptance end-to-end tetap PARTIAL.

API bisnis/login/tiket, enforcement Go, transaksi retry/lost response, worker dan scheduler belum diimplementasikan oleh fase ini. DDL domain belum diterapkan pada DB kerja. Tiga kontainer kerja tetap healthy dan satu port publik 127.0.0.1:18080. Tidak ada perubahan UI, integrasi kanal nyata atau benchmark. C3/F9/G-OPT tetap DEFERRED_RESEARCH. UAT dan CI belum dilakukan/dikonfigurasi.

## Verifikasi

- `python scripts/verify_m0_02.py` memeriksa hasil generator, OAS/schema/contoh/negative cases dan 15 metode tes, termasuk 31 kasus ACL, 34 state dan 7 kalender. Exact argv, hasil dan hash tersimpan di `qa/m0-02/contracts.json`.
- `python scripts/test_owner_migrations.py` menguji apply 10 migrasi, ulang apply melalui entrypoint Compose, sembilan login role dan 81 pasangan privilege schema, DDL/ledger/audit protections, FK lokal, constraint, checksum lock/ledger drift, rollback SQL+ledger dan out-of-order. Laporan `qa/m0-02/migrations.json` juga mencatat cleanup kontainer tes.
- `docker compose config --quiet`, daftar kontainer/port dan SELECT read-only pada DB kerja memverifikasi konfigurasi serta batas penerapan. Bukti penutupan mencatat hasil aktual.
- `python scripts/verify_package.py` merupakan konsistensi paket, bukan bukti aplikasi bisnis. Hasil akhir dicatat pada completion/evidence.

Temuan pengembangan yang diperbaiki adalah dangling schema reference yang tidak ditangkap validator struktur OAS, serta normalisasi newline Windows pada fixture SQL checksum. Tes negatif tetap dipertahankan. Tidak ada broad browser/Go/security/benchmark suite karena frontend/Go runtime tidak diubah; negative SQL/API-schema/policy dan integrasi PostgreSQL dijalankan sesuai risiko fase ini.

## Lanjutan yang direncanakan

M0-03 belum dimulai. Sebelum membangunnya, verifikasi checkpoint dan source, kemudian bangun session/identity lab, guest/publik/ASN scopes, katalog/form serta master admin dengan persistence dan negative access tests. Gunakan kontrak/fixture sekarang untuk menguji enforcement Go/API nyata. Tambahkan domain migration requirements pada readiness ketika consumer diaktifkan. Periksa manifest dan jalankan migrator secara terarah bila penerapan DB lokal diperlukan; jangan menganggap task ini sudah menerapkannya.

Saat fase berikutnya menemukan kebutuhan kontrak baru yang sah, gunakan perubahan additive/berversi dan migrasi baru. Kontrak belum merupakan freeze penelitian. Snapshot event canonical dan intent stream berbeda watermark, sehingga consumer parsial tidak menunggu versi yang tidak disubscribe. Fase M0-04/M0-06 tetap wajib membuktikan durable effects, idempotency dan race/restart nyata.

Keputusan organisasi pada decisions.csv tetap terbuka. Role/kalender/media/reopen fixture bukan kebijakan resmi. Scanner/upload core sudah harus aman saat M0-04 membuka unggahan, sebelum perluasan pustaka media M0-08. Tidak ada proses agent atau kontainer tes yang sengaja dibiarkan berjalan setelah penutupan. Jangan otomatis memulai M0-03, mengirim pesan nyata, deploy, reset/purge/restore, atau melakukan Git delivery.
