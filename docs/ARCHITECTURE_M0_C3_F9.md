# Matriks Rancangan Arsitektur Helpdesk TIK Kota Depok (M0, C3, dan F9)

Dokumen ini merangkum rancangan lintas topologi **M0 (Modular Monolith — Baseline Aktif)**, **C3 (Three-Cluster Services)**, dan **F9 (Nine Fine-Grained Services)** agar seluruh fitur aplikasi — termasuk perluasan **Pengelolaan FAQ Dinamis (M8)**, **Pemeliharaan Sistem Terjadwal & Tidak Terjadwal (M1)**, **CRUD Akun/Subjek & label `PD / Unit Kerja` (M1)**, serta **Combo Box Select2 & DataTables UI** — tetap mematuhi kontrak tunggal, isolasi data 9 owner PostgreSQL, dan kesetaraan anggaran sumber daya ([ADR 0009](adr/0009-resource-envelope-and-rpo-rto-dec-m10.md), [ADR 0012](adr/0012-faq-management-and-m0-c3-f9-architecture-parity.md)).

> [!NOTE]
> Implementasi executable di repository ini **wajib tetap M0 satu proses Go** (`configs/M0.json`). Pemetaan C3 dan F9 di bawah adalah spesifikasi desain dan kesetaraan kontrak tanpa membuat 3 atau 9 proses runtime baru di M0.

---

## 1. Pemetaan Modul, Schema DB, Pool, dan Anggaran Komputasi (Profil R1)

Semua angka CPU, memori, dan batas koneksi database diturunkan langsung dari `contracts/module_registry.csv` dan `docs/adr/0009-resource-envelope-and-rpo-rto-dec-m10.md` (Profil R1 komputasi inti aplikasi `2.500m CPU / 4.608 MiB RAM / 36 koneksi DB`; Profil R2 Compose + ClamAV menambah `1.000m / 3.072 MiB` pada kontainer terpisah `scanner`).

| Model | Unit Layanan / Proses | Anggota Modul & Schema Owner | Kuota CPU (mCPU) | Kuota Memori (MiB) | Max Pool DB | Transpor Sinkron Internal | Event Asinkron (`outbox -> consumer`) |
|---|---|---|---|---|---|---|---|
| **M0** | `G1` (`cmd/helpdesk`, proses tunggal) | `M1 (identity)`, `M2 (catalog)`, `M3 (intake)`, `M4 (classification)`, `M5 (assignment)`, `M6 (sla)`, `M7 (escalation)`, `M8 (knowledge)`, `M9 (notify_audit)` | `2.500m` | `4.608` | `36` (`4`/owner) | Port Go in-process dengan salinan DTO/value, batas deadline & `actor` context | PG durable outbox per owner + wake-up goroutine internal |
| **C3** | `Platform` (Service 1/3) | `M1 (identity)`, `M2 (catalog)`, `M8 (knowledge)` | `833m` (`278+278+277`) | `1.536` (`512×3`) | `12` (`4×3`) | `M2->M1`, `M8->M1`, `M8->M2` via port lokal; pemanggil masuk ke `M3/M9` via HTTP/JSON internal | `outbox` internal cluster vs broker terkelola untuk `Platform <-> Case / Operations` |
| **C3** | `Case` (Service 2/3) | `M3 (intake)`, `M4 (classification)`, `M5 (assignment)` | `834m` (`278×3`) | `1.536` (`512×3`) | `12` (`4×3`) | `M3->M4`, `M3->M5` lokal; `M3->M1/M2/M6` & `M5->M1` via HTTP/JSON internal | `M3.outbox -> Case(M5)` & `Operations(M6,M7,M9)` |
| **C3** | `Operations` (Service 3/3) | `M6 (sla)`, `M7 (escalation)`, `M9 (notify_audit)` | `833m` (`278+278+277`) | `1.536` (`512×3`) | `12` (`4×3`) | `M7->M6` lokal; `M7->M3`, `M9->M1/M3` via HTTP/JSON internal | `M9.outbox -> Case(M3)` (`NotificationStored`) & `ALL_OWNERS -> Operations(M9)` audit |
| **F9** | 9 layanan independen (`M1..M9`) | Masing-masing 1 schema/role PostgreSQL eksklusif (`identity` s.d. `notify_audit`) | `M1..M7`: `278m` / modul; `M8..M9`: `277m` / modul (Total `2.500m`) | `512` / modul (Total `4.608`) | `4` / layanan (Total `36`) | Seluruh panggilan di `contracts/dependencies.json` (`sync_business_ports`) melewati HTTP/JSON atau RPC internal terautentikasi & bounded | Seluruh langganan di `contracts/dependencies.json` melewati `owner.outbox -> broker -> inbox dedup consumer` |

---

## 2. Perbandingan Pola Interaksi, Gateway, dan Fitur Terbaru Across M0 / C3 / F9

### A. Routing API Gateway & Frontend Tunggal (`React TypeScript + PIUI Modern/Zero`)

Satu build frontend (`/api/v1/*`) melayani ketiga arsitektur tanpa membedakan kode bisnis UI:

| Kelompok Endpoint API | Pemilik Data Canonical | Target Gateway di **M0** | Target Gateway di **C3** | Target Gateway di **F9** |
|---|---|---|---|---|
| `/api/v1/auth/*`, `/api/v1/admin/subjects*`, `/api/v1/maintenance/*` | `M1` (`identity`) | Proses `G1` (`cmd/helpdesk`) | Cluster `Platform` | `identity-service (M1)` |
| `/api/v1/catalog/*`, `/api/v1/admin/portal-navigation*` | `M2` (`catalog`) | Proses `G1` | Cluster `Platform` | `catalog-service (M2)` |
| `/api/v1/knowledge/articles*`, `/api/v1/knowledge/faqs*`, `/api/v1/portal/pages*` | `M8` (`knowledge`) | Proses `G1` | Cluster `Platform` | `knowledge-service (M8)` |
| `/api/v1/tickets*`, `/api/v1/drafts*`, `/api/v1/guest/*` | `M3` (`intake`) | Proses `G1` | Cluster `Case` | `intake-service (M3)` |
| `/api/v1/admin/classification*` | `M4` (`classification`) | Proses `G1` | Cluster `Case` | `classification-service (M4)` |
| `/api/v1/admin/teams*`, `/api/v1/staff/*`, dispatch routing | `M5` (`assignment`) | Proses `G1` | Cluster `Case` | `assignment-service (M5)` |
| `/api/v1/admin/sla*`, kalender & SLO | `M6` (`sla`) | Proses `G1` | Cluster `Operations` | `sla-service (M6)` |
| `/api/v1/admin/scheduler-jobs*`, eskalasi | `M7` (`escalation`) | Proses `G1` | Cluster `Operations` | `escalation-service (M7)` |
| `/api/v1/notifications*`, `/api/v1/reports*`, `/api/v1/admin/audit*` | `M9` (`notify_audit`) | Proses `G1` | Cluster `Operations` | `notify-audit-service (M9)` |
| `/api/v1/media*` | `M3` (tiket privat) atau `M8` (editorial publik) | Proses `G1` | `Case` (`owner=M3`) atau `Platform` (`owner=M8`) | `intake-service` atau `knowledge-service` |
| `/api/v1/search` | Agregator berizin (`M2`, `M3`, `M8`) | Proses `G1` (fan-out port lokal) | Gateway/BFF atau `Platform` memanggil `Case` | Gateway/BFF terautentikasi ke `M2 + M3 + M8` |

### B. Paritas Fitur Terbaru pada M0, C3, dan F9

| Fitur / Kapabilitas | Owner & Skema DB | Perilaku di **M0** | Implikasi Desain di **C3** | Implikasi Desain di **F9** | Invarian Kesetaraan Wajib |
|---|---|---|---|---|---|
| **Pengelolaan FAQ Dinamis** (`ARTICLE \| PAGE \| FAQ`, `category_label`, `sort_order`, `/api/v1/knowledge/faqs`) | `M8` (`knowledge.content`, migrasi `042`) | Handler HTTP + port lokal `M8 -> M1/M2` dan outbox audit `M8 -> M9` dalam satu proses | `M8` berada satu cluster dengan `M1/M2` di **Platform**; baca/tulis FAQ & izin cepat lokal, audit publish/archive dikirim asinkron ke **Operations (`M9`)** | `knowledge-service (M8)` berdiri sendiri; pembacaan publik tetap cek JWT/session lokal atau port `M1`; mutasi FAQ kirim event terurut ke broker menuju `M9` | Tidak ada query SQL lintas schema; live audience ACL (`PUBLIC_GUEST`, `PUBLIC_AUTH`, `ASN_AUTH`, `STAFF_ONLY`), `expected_version` CAS (`409`), sanitasi anti-XSS, dan `Cache-Control: no-store` identik |
| **Pemeliharaan Sistem Terjadwal & Tidak Terjadwal (*Under Maintenance*)** | `M1` (`identity.maintenance_policies`, migrasi `041`) | `/api/v1/maintenance/status` dibaca oleh portal Web Publik & Admin (`maintenance-banner.js`) dan dievaluasi middleware satu proses | `Platform` memiliki `M1`; `Case` & `Operations` menegakkan policy yang direplikasi/di-poll via port `-> M1` atau header snapshot terverifikasi dari gateway/cache ber-TTL pendek | Setiap layanan `M2..M9` tetap membaca kebijakan atau menolak mutasi saat mode aktif sesuai aturan `read_only / block_all`, sementara halaman *Under Maintenance* disajikan seragam di gateway/frontend | Pengguna publik maupun petugas melihat jadwal/mode *Under Maintenance* terjadwal maupun insidental konsisten tanpa menampilkan rahasia sistem |
| **CRUD Akun Pengguna & Label `PD / Unit Kerja`** (`?kind=subjects`) | `M1` (`identity.subjects`, `identity.organizations`) | Konsol `?kind=subjects` & API `/api/v1/admin/subjects` dikelola di `M1` | Tetap di dalam cluster **Platform** (`M1`) dengan cache invalidation lokal ke `M2/M8` | Perubahan status akun / pencabutan sesi pada `M1` harus mengefektifkan *Dynamic Revocation Gate* di gateway serta `M2..M9` tanpa menaikkan role secara sepihak | Akun nonaktif/tercabut ditolak seketika di semua topologi; penamaan UI `PD / Unit Kerja` seragam pada satu bundle React/Vite |
| **Combo Box Select2 & DataTables Admin** | Lapisan UI tunggal (`frontend/src/features/{select2-combobox,admin-datatable}.ts`) | Dirender sekali dari `helpdesk-web`, berinteraksi dengan API `/api/v1/*` berpaginasi cursor & filter | Identik dengan M0 (hanya satu frontend untuk seluruh arsitektur) | Identik dengan M0 | Seluruh `<select>` fungsional memakai kontrol aksesibel keyboard setara Select2; DataTables mempertahankan pencarian, pengurutan kolom & ukuran halaman |

---

## 3. Batasan Ketat Kesetaraan & Penelitian

1. **Kesetaraan Port (`sync_business_ports` & `event_subscriptions`)**:
   - Daftar ketergantungan pada [contracts/dependencies.json](../contracts/dependencies.json) (`M8 -> [M1, M2]`, `ALL_OWNERS -> M9`, tanpa siklus sinkron, tanpa SQL/FK lintas schema) mengikat M0, C3, maupun F9 secara setara.
   - Penambahan kemampuan `faq` pada M8 tidak mengubah graf `dependencies.json`, karena M8 sudah diizinkan memanggil `M1` dan `M2` secara sinkron serta menerbitkan event outbox ke `M9`.
2. **Status Pembuktian Saat Ini**:
   - Pada repository ini, **hanya M0 yang diimplementasikan dan dijalankan**.
   - Validasi runtime komparatif C3, F9, maupun optimasi partisi `G-OPT` tetap berstatus **`DEFERRED_RESEARCH`** sesuai `contracts/acceptance.csv` (`AC02`, `AC09`, `AC10`, `AC12`, `AC25`) dan tidak diklaim sebagai lulus runtime di lingkungan lab M0.
