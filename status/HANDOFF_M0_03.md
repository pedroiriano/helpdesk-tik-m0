# Handoff M0-03 — identitas, katalog dan master

4 November 2026. Scope M1/M2 lab lokal selesai; bukti penutupan dan hash final ada pada [completion.json](../qa/m0-03/completion.json). Tidak ada Git/SHA/PR/CI; jangan menyatakan checkpoint ini sebagai rilis atau UAT. M0-04 belum dimulai.

Implementasi memakai satu proses Go, satu build frontend PIUI Modern/Zero asli dan satu PostgreSQL sembilan owner/role/pool. M1 mempunyai session lab, membership/grant ceiling dan master organisasi/tim. M2 mempunyai katalog sesuai audience, master layanan/kategori dan form/policy berversi. UI menerima data server melalui client typed, dengan pagination, validasi, conflict dan state gagal. Role/org/kind klien tidak menjadi authority. Lihat [ADR 0004](../docs/adr/0004-identitas-lab-katalog-master.md) dan [runbook lab](../runbooks/m0-03-lab.md).

Migrasi historis 001–010 dipertahankan; 011–012 additive telah diterapkan dengan migrator terpisah. Ledger 12 dan marker domain versi 3 diperiksa pada DB kerja lokal. Seed sintetis ber-guard tidak menimpa edit yang ada. Secret lokal yang lama dipertahankan. Port tetap 127.0.0.1:18080; kontainer/volume proyek lain tidak diubah.

| Pemeriksaan | Bukti / batas |
|---|---|
| Go/HTTP/PostgreSQL M1/M2 positif dan negatif | integration.json; delapan subtest, resource disposable dibersihkan |
| Migrasi/ledger/sembilan role/constraint/drift/rollback/order | migrations.json; PostgreSQL disposable, tanpa port host/volume persisten |
| Kontrak, ceiling kanonis, boundaries, vet/unit, frontend build/PIUI | contracts.json dan verification.json; perintah, exit code dan hash dicatat |
| Browser representatif | browser.json; guest/ASN catalog, login/logout keyboard, forbidden admin, master/service/form/policy, native validation, desktop/mobile, refresh dan restart aplikasi |
| Runtime lokal | environment.json; health, port binding, image ID, ledger/marker dan fixture inactive setelah restart |

Data kerja tambahan hanya fixture nonaktif LAB-BROWSER-M003 milik OPD Lab 1, layanan versi 3, form/policy versi 2. Fixture ini membuktikan create/read-back serta versi baru dan tidak muncul pada katalog tamu. Tidak dilakukan purge/reset. Session browser terakhir telah logout. Formulir publik masih preview; pengiriman tiket belum tersedia.

DB kerja sempat ditemukan berhenti dengan exit 255 dan OOM false; sebab eksternal tidak dapat dipastikan dari log yang tersedia. Kontainer yang sama dijalankan kembali, aplikasi dipulihkan, ledger/marker/data tetap ada. Ini bukan recovery drill/restore. Percobaan runner awal timeout saat kompilasi kemudian diperbaiki batas waktunya; laporan final integration PASS. Argumen rahasia runner kini tidak dicetak saat timeout; credential sementara milik resource tes yang sudah dibersihkan, bukan secret kerja. Pemeriksaan loopback pertama pernah diblokir sandbox dan lulus setelah izin tool yang sesuai.

AC06/AC11 global tetap PARTIAL; [traceability](../contracts/M0_03_TRACEABILITY.md) menjelaskan batasnya. Audit intent dan outbox durable terbentuk atomik, namun delivery worker M9 belum ada. Tidak ada tiket/capability M3 operasional, SSO/identitas resmi, notifikasi nyata, upload/scan, benchmark atau UAT. Halaman admin template lain masih contoh.

Keputusan organisasi pada planning/decisions.csv tetap OPEN, termasuk katalog/scope resmi, identitas/SSO, mandat/delegasi, kalender/SLA dan retensi. HTTP tanpa Secure cookie dibatasi loopback lab; bukan konfigurasi produksi. Lab ini dapat memilih delapan identitas sintetis tanpa password dan tidak boleh diekspos sebagai login produksi.

Fase berikut yang direncanakan ialah M0-04 (tiket dan durable events), sesuai backlog dan blueprint, hanya setelah instruksi tersendiri. M3 tetap satu-satunya writer tiket. Jangan menjalankan eksperimen/freeze kontrak atau memilih arsitektur optimal dari bukti fase ini. Evidence M0-02 dipertahankan sebagai snapshot historis.
