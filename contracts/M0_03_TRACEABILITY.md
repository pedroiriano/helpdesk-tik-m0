# Cakupan bukti M0-03

4 November 2026. OpenAPI 1.1.0 memuat 96 operasi, dengan 28 operasi berstatus IMPLEMENTED_M0_03. Status operasi lain tetap NOT_IMPLEMENTED. Definisi generator dan DTO typed disinkronkan; business_traceability.csv tetap mengacu FR/AC sumber. Pemetaan M0-02 adalah snapshot historis, bukan hasil runtime terbaru.

| Requirement | Bagian yang terbukti pada M0-03 | Bukti | Batas yang tetap terbuka |
|---|---|---|---|
| AC06 / FR29 | Principal server, session lab persistent, expiry/logout/revoke, live membership/grant ceiling, guest/publik/ASN/staf, scope sebelum pagination, hidden 404/forbidden 403, forged role/org dan CSRF/Origin ditolak | qa/m0-03/integration.json; contracts.json; browser.json | Identitas/SSO nyata, capability tiket, cross-ticket, search/export/media dan permukaan modul selanjutnya |
| AC11 | PIUI asli untuk login/logout, katalog/detail/form preview, master layanan dan form/policy; keyboard, native required validation, desktop/mobile, refresh dan restart aplikasi lokal | qa/m0-03/browser.json; verification.json; screenshots | Create/track/resolve tiket, upload, semua halaman contoh, UAT domain dan audit aksesibilitas penuh |
| FR17 | Organisasi/tim/membership M1, layanan/kategori M2; server persistence, active/inactive, owner scope, CAS dan immutable form/policy versions | integration.json; browser.json | Master M4–M9, effective-date bisnis di luar membership expiry, roster/vendor dan workflow lanjutan |
| AC02 / AC03 sebagai regresi pendukung | Contract schema, error dan typed client; owner mutation + idempotency receipt + audit intent/outbox atomik, payload conflict dan replay | contracts.json; integration.json | Lifecycle/retry tiket dan parity antararsitektur; tidak mengubah AC global menjadi PASS |

Mutasi memakai transaksi owner dan SQL terparameter. M2 memperoleh authority melalui port publik M1, tanpa private imports atau SQL lintas owner. M3 tidak ditulis. Worker delivery M9 belum dijalankan; outbox PENDING bukan bukti notifikasi terkirim. Pengaturan ukuran/MIME pada policy adalah metadata, bukan implementasi upload/scan.

Migrasi 001–012 terbukti di PostgreSQL disposable dan diterapkan terpisah pada DB kerja lokal. Sembilan schema/role/pool tetap terpisah, maksimum empat koneksi per owner. Readiness memeriksa sembilan foundation marker versi 1 serta domain identity/catalog versi 3. Bukti deployment lokal ada pada environment.json; tes disposable tidak dianggap bukti penerapan DB kerja.

AC06/AC11 global tetap PARTIAL. FR17/FR29 juga PARTIAL untuk keseluruhan produk. UAT, CI, produksi, SSO nyata dan penelitian C3/F9/G-OPT tidak diklaim lulus. M0-04 tetap NOT_STARTED.
