# Cakupan bukti M0-04

5 November 2026. OpenAPI 1.2.0 dan DTO typed memuat handler tiket/guest tracking M0-04. Operasi verifikasi, dispatch, resolve, confirm, search/export tiket dan workflow fase berikutnya tetap NOT_IMPLEMENTED. Status implementasi operasi tidak sama dengan acceptance fase.

| Acceptance | Bukti kandidat lokal / disposable | Batas verifikasi |
|---|---|---|
| AC03 | Create atomik, lost HTTP response, same-intent concurrency, perubahan intent/versi 409, rollback producer, perubahan snapshot sebelum commit, retry UI menjaga key dan versi; read-back setelah restart proses lokal | Dibuktikan pada mutasi M0-04 yang tersedia; mutasi workflow lanjutan belum diimplementasikan. |
| AC05 | Audit M9 dan inbox durable, fault sesudah commit sebelum ACK, lease expiry, retry bounded/dead-letter/recovery, rollback consumer, digest mismatch dan projection monoton | M5/M6/M7 tetap PENDING. Laporan environment memuat jumlah ACK M9 terverifikasi per owner. Tidak mengklaim tepat sekali di jaringan atau pengiriman nyata. |
| AC06 | Cookie/session lab, guest exchange/scope/expiry/revocation, ACL live public/ASN/operator/config admin, cross-ticket/OPD, CSRF/Origin regresi M0-03; browser guest lain ditolak | Hardening final lulus: form tracking inert sebelum JS, field rahasia tidak terserialisasi dan cookie guest dilepas saat login/logout akun. Otoritas produksi dan permukaan fase lain belum diverifikasi. |
| AC07 | Catatan/lampiran internal terpisah di server; upload privat, signature/checksum, quarantine, scan ClamAV nyata, akses CLEAN, file hilang, kegagalan scanner dan rekonsiliasi orphan; download browser cocok byte fixture | Search/export dan pustaka media terpadu belum tersedia. ClamAV tidak menjadi klaim jaminan bebas malware. |
| AC11 | 12 pemeriksaan browser representatif: keyboard, validasi, publik/ASN/tamu, daftar/detail, konflik dua tab, komentar/internal note, upload/download, refresh dan mobile. Empat retest tracking/pergantian akun lulus pada build final; restart proses dibuktikan terpisah lewat HTTP. | Resolve, audit aksesibilitas penuh dan UAT domain di luar scope ini. |

FR02, FR11, FR13, FR15, FR19, FR20, FR28 dan FR29 disentuh pada subset terkait. AC03/AC05/AC06/AC07/AC11 global tetap PARTIAL. M0-04 DONE_VERIFIED untuk slice tiket lab ini. Laporan detail: `qa/m0-04/integration.json`, `migrations.json`, `m0-03-regression.json`, `contracts.json`, `browser.json`, `browser-hardening.json`, `local-http.json`, `environment.json` dan `completion.json`.
