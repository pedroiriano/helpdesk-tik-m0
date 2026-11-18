# ADR 0012 — Pengelolaan FAQ Dinamis (M8) dan Paritas Rancangan Arsitektur M0, C3, dan F9

- **Status**: Diterapkan pada M0 (Rancangan C3 & F9 diselaraskan; eksekusi multi-model tetap `DEFERRED_RESEARCH`).
- **Tanggal**: 18 November 2026
- **Keterkaitan**: `AC01`, `AC02`, `AC09`, `AC10`, `AC25`, `FR05`, `FR09`, `FR12`, `FR17`, `FR18`, [ADR 0001](0001-m0-dan-ownership.md), [ADR 0009](0009-resource-envelope-and-rpo-rto-dec-m10.md), [ARCHITECTURE_M0_C3_F9.md](../ARCHITECTURE_M0_C3_F9.md).

## 1. Konteks

Sebelumnya, halaman Tanya Jawab (`/faq.html` dan bagian `#vy-faq` di landing page `/`) menyajikan isi FAQ statis pada HTML shell tanpa CRUD backend maupun kontrol editorial. Di sisi lain, beberapa penyempurnaan produk telah ditambahkan pada aplikasi M0 setelah fase fondasi awal, yaitu:
1. **Pengelolaan Tanya Jawab (FAQ) dinamis** di modul **M8 (`knowledge`)** (`ARTICLE | PAGE | FAQ`).
2. **Pemeliharaan Sistem Terjadwal & Tidak Terjadwal (*Under Maintenance*)** di modul **M1 (`identity`)**.
3. **CRUD penuh Akun Pengguna / Subjek (`?kind=subjects`)** serta penyeragaman label `PD / Unit Kerja` pada **M1 (`identity`)**.
4. **Combo Box setara Select2 & DataTables Admin** pada lapisan Web Publik dan Web Admin.

Agar aplikasi tetap memelihara kesetaraan kontrak untuk studi perbandingan arsitektur (**M0**, **C3**, **F9** — serta `G-OPT` bila dieksekusi di luar ruang lingkup paket M0 ini), seluruh perluasan skema, kontrak API, aturan otorisasi, dan pemetaan partisi harus tercatat secara kanonis tanpa memecah M0 menjadi proses terpisah atau melanggar batas ownership.

## 2. Keputusan

### A. Pengelolaan FAQ Tetap Berada di Owner M8 (`knowledge`)
- FAQ dimodelkan sebagai varian `kind = 'FAQ'` pada tabel `knowledge.content` melalui migrasi aditif [042-faq-management.sql](../../migrations/m8/042-faq-management.sql) dengan atribut tambahan `category_label` (default `'Umum'`) dan `sort_order` (default `100`), serta seed idempoten 5 FAQ kanonis Pemkot Depok.
- Kontrak API menggunakan jalur `/api/v1/knowledge/faqs` (`GET`, `GET /{id}`, `POST`, `PUT /{id}`, `POST /{id}/transitions`) dengan ACL audiens langsung (`PUBLIC_GUEST`, `PUBLIC_AUTH`, `ASN_AUTH`, `STAFF_ONLY`), kontrol konkurensi optimistik (`expected_version`), sanitasi anti-XSS sisi server/klien, `Cache-Control: no-store`, dan penulisan audit transaksional ke `knowledge.outbox -> M9`.
- Frontend menyajikan menu khusus Web Admin (`?kind=faqs` pada [admin-navigation.mjs](../../frontend/admin-navigation.mjs)) serta tab `FAQ` terpadu pada konsol editorial, dan melakukan hidrasi langsung pada `/faq.html` (`search` + filter topik `Select2` + tautan `#<slug>`), landing `#vy-faq`, serta saran pencarian global dengan fallback offline yang aman.

### B. Penyelarasan Rancangan M0, C3, dan F9
1. **M0 (Baseline Aktif Saat Ini)**: Satu binary/proses Go (`backend/cmd/helpdesk`), `G1 = {M1..M9}`, satu React/Vite build, satu PostgreSQL 18.7 dengan 9 schema/role/pool terpisah (`4` koneksi/owner, total `36`), anggaran komputasi Profil R1 `2.500m CPU / 4.608 MiB RAM` aplikasi (`4.000m / 8.192 MiB` inti) dan Profil R2 Compose + ClamAV `4.900m / 11.008 MiB` sesuai [ADR 0009](0009-resource-envelope-and-rpo-rto-dec-m10.md) & [M0.json](../../configs/M0.json).
2. **C3 (3 Cluster Services)**:
   - **`Platform = {M1, M2, M8}`** (`833m CPU / 1.536 MiB RAM`, DB pool `12`): menangani autentikasi/subjek/pemeliharaan (`M1`), katalog/form/navigasi (`M2`), serta artikel/halaman/FAQ/media editorial (`M8`). Pemanggilan `M8 -> M1/M2` dan `M2 -> M1` tetap in-process di dalam cluster `Platform`, sedangkan jejak audit/notifikasi `M8 -> M9` bergerak melintasi batas cluster melalui `knowledge.outbox -> broker -> Operations (M9)`.
   - **`Case = {M3, M4, M5}`** (`834m CPU / 1.536 MiB RAM`, DB pool `12`): mengelola siklus hidup tiket tunggal, lampiran privat, klasifikasi, dan penugasan teknisi (`M3 -> M1/M2/M6` lintas cluster lewat port HTTP/JSON terautentikasi & ber-deadline).
   - **`Operations = {M6, M7, M9}`** (`833m CPU / 1.536 MiB RAM`, DB pool `12`): mengelola perhitungan SLA, eskalasi scheduler, notifikasi, laporan, dan audit (`M7 -> M3`, `M9 -> M1/M3` lintas cluster).
3. **F9 (9 Layanan Independen `M1..M9`)**:
   - Setiap modul `M1..M9` berjalan pada proses/layanan masing-masing sesuai anggaran [module_registry.csv](../../contracts/module_registry.csv) (`M1..M7`: `278m / 512 MiB / pool 4`; `M8 & M9`: `277m / 512 MiB / pool 4`).
   - API Gateway merutekan `/api/v1/knowledge/faqs`, `/api/v1/knowledge/articles`, `/api/v1/portal/pages` ke `knowledge-service (M8)`, dan `/api/v1/maintenance/status` serta `/api/v1/admin/subjects` ke `identity-service (M1)`.
   - Di dalam layanan M8 (`F9`), validasi audiens/izin dan pengesahan metadata kategori dilakukan lewat port `M8 -> {M1, M2}` dengan konteks aktor, deadline, pembatalan, dan semantik nilai yang sama seperti port lokal M0; pencarian terfederasi `/api/v1/search` dan pemeriksaan *maintenance mode* di gateway tetap mematuhi kontrak yang sama tanpa fast-path SQL lintas schema.

## 3. Konsekuensi & Batas

1. Aplikasi produksi/lab yang berjalan di repository ini **tetap satu proses Go M0** ([M0.json](../../configs/M0.json)); tidak ada server C3 atau F9 nyata yang dijalankan pada runtime M0.
2. Kontrak bisnis, DDL per owner, aturan otorisasi, dan komponen UI tidak digandakan antar model arsitektur; perbedaan topologi C3/F9 hanya terletak pada lapisan partisi, konfigurasi gateway, dan adapter transport (`local` vs `http_json` + event broker).
3. Kriteria perbandingan multi-model pada `AC02` dan `AC25` tetap berstatus `DEFERRED_RESEARCH` / `PARTIAL` sampai eksperimen komparatif terpisah dijalankan sesuai protokol penelitian.
