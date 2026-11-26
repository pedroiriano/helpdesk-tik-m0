# ADR 0010 — Rencana Pembaruan Stack Terpin, Kompatibilitas, Migrasi PostgreSQL 16.14 → 18.7, dan Sinkronisasi Runtime Docker (`DEC-M11`)

Tanggal: 17 November 2026.  
Status: **DECIDED & APPLIED IN LOCAL LAB — Fase 0–4 Lulus Terverifikasi (Host Daemon `Engine 29.10.0 / Compose 5.7.1` Menunggu Update Installer Docker Desktop)**  
Keterkaitan: `DEC-M11`, `DEC-M10`, `docs/02_ATURAN_PEMBANGUNAN.md` § Pengamanan dependensi dan operasi, `docs/adr/0002-workspace-ui-docker-lokal.md`, `docs/adr/0005-ticket-durable-audit-private-uploads.md`, `docs/adr/0009-resource-envelope-and-rpo-rto-dec-m10.md`, `planning/technology-lock.json`, `compose.yaml`.

---

## 1. Konteks dan Latar Belakang

Audit teknologi dan catatan lingkungan terhadap `planning/technology-lock.json` serta host Docker Desktop pada 17 November 2026 menemukan dua kondisi yang perlu diselesaikan secara tertib:

1. **Deviasi catatan runtime Docker antara lockfile dan host aktual**: `planning/technology-lock.json` masih mencatat `Docker Engine 29.9.2 / Compose 5.6.1` dan `Docker Desktop Linux x86_64`, sedangkan runtime host terpasang sudah berada pada **Docker Desktop `4.99.0` (`4.99.0.245822`)**, **Docker Engine `29.9.3` (API `1.56`)**, dan **Docker Compose `v5.7.0`**. Selain itu target mutakhir telah tersedia pada **Docker Engine `29.10.0`** (16 Nov 2026) dan **Docker Compose `5.7.1`** (11 Nov 2026).
2. **Kebutuhan pembaruan komponen aplikasi dan runtime ke versi terpin terbaru**: Beberapa komponen masih dipin pada versi fondasi awal (`Go 1.26.5`, `Node.js 24.11.1`, `PostgreSQL 16.14`, `ClamAV 1.4.6`, digest rebuild `Nginx 1.30.6-alpine`), sementara versi rilis baru membawa perbaikan CVE dan keamanan kritis (termasuk `Go 1.27.4`, `Node.js 26.13.1 LTS`, `PostgreSQL 18.7`, `ClamAV 1.5.4`).

Sesuai `docs/02_ATURAN_PEMBANGUNAN.md` (§ Pengamanan dependensi dan operasi):
- Setiap image container dan dependensi wajib dipin dengan **SHA-256 multi-arch index digest** atau lockfile deterministik (**dilarang memakai tag `:latest`**).
- Upgrade mayor (`Node 24 -> 26 LTS`, `PostgreSQL 16 -> 18`) dan perubahan toolchain membutuhkan keputusan arsitektural eksplisit (`DEC-M11`) dan pembuktian kompatibilitas terlebih dahulu agar tidak merusak skema, peran DB, mekanisme enkripsi, kontainer read-only, skrip uji disposable, maupun antarmuka browser.
- Batasan arsitektur M0 (satu proses Go + sembilan owner schema/role DB `helpdesk_m1..m9` + satu web Nginx/React + `DEC-M10` anggaran kapasitas Profil R1 `4.000m / 8.192 MiB` dan Profil R2 `4.900m / 11.008 MiB`) **tetap dipertahankan identik**.

---

## 2. Matriks Target Versi, Digest SHA-256 Terverifikasi, dan Lokasi Lock

Seluruh digest OCI di bawah diverifikasi langsung melalui `docker buildx imagetools inspect` terhadap Docker Hub registry pada 17 November 2026:

| Komponen | Versi Aktif Saat Ini | Target Versi Terbaru & Kebijakan | Digest OCI Index / Lockfile Terpin | Berkas yang Terdampak Saat Eksekusi |
|---|---|---|---|---|
| **Go Toolchain & Builder** | `1.26.5` (`sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2`) | **`1.27.4`** (perbaikan 12 CVE runtime/compiler/HTTP) | `golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280` | `backend/go.mod`, `infra/docker/backend.Dockerfile`, `planning/technology-lock.json`, Go SDK host (opsional untuk local dev) |
| **Driver PG Go (`pgx/v5`)** | `v5.12.0` (`puddle/v2 v2.2.3`) | Pertahankan **`v5.12.0`** (evaluasi patch jika ada CVE baru) | `backend/go.sum` | Tidak perlu ubah; diverifikasi kompatibel PG 18 & Go 1.27 |
| **PostgreSQL Database** | `16.14-alpine` (`sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`) | **`18.7-alpine`** (rilis keamanan 12 Nov 2026; perbaikan `CVE-2026-6460` dll.) | `postgres:18.7-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015` | `compose.yaml` (`db`, `migrate`, `upload-init`, `seed-lab`), `scripts/test_owner_migrations.py`, `planning/technology-lock.json` |
| **ClamAV Scanner** | `1.4.6` (`sha256:8ad6197396974726c35d017e50aaaaf4b91745726a04faec8480c203edd98052`) | **`1.5.4`** (perbaikan thread-safety `clamd STATS`, bug memori & parser ZIP/PDF/PE) | `clamav/clamav:1.5.4@sha256:7054e3f34308c384ea43cd786ea17abf899bd44af40af9f1b099853d7a5c214e` | `compose.yaml` (`scanner`), `planning/technology-lock.json`, `runbooks/m0-04-lab.md` |
| **Node.js Builder & Test** | `24.11.1-alpine` (`sha256:682368d8253e0c3364b803956085c456a612d738bd635926d73fa24db3ce53d7`) | **`26.13.1-alpine` LTS (Lithium)** (perbaikan keamanan 11 Nov 2026 incl. HTTP/2) | `node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5` | `infra/docker/web.Dockerfile`, `frontend/package.json`, `frontend/package-lock.json`, `planning/technology-lock.json`, Node host |
| **React & ReactDOM** | `19.3.1` (`@types/* 19.3.0`) | **`19.3.1`** *(Sudah Terbaru)* | `frontend/package.json`, `frontend/package-lock.json` | Sudah sesuai; pertahankan pin |
| **TypeScript & Vite** | `typescript 7.0.2`, `vite 8.3.5` | **`7.0.2` / `8.3.5`** *(Sudah Terbaru)* | `frontend/package.json`, `frontend/package-lock.json` | Uji ulang kompilasi di Node `26.13.1` |
| **Nginx Gateway** | `1.30.6-alpine` (`sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949`) | **Tetap Cabang Stable `1.30.6-alpine`** dengan digest build ulang terbaru (5 Nov 2026) | `nginx:1.30.6-alpine@sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a` | `infra/docker/web.Dockerfile`, `planning/technology-lock.json` |
| **Python & Validator** | `3.13.7` + OpenAPI validator `0.9.0` | **Pertahankan `3.13.7`** *(stabil untuk 15+ skrip QA & kontrak)* | `tests/contract/requirements.txt`, `tests/contract/openapi-requirements.txt` | Evaluasi Python `3.15` dipisahkan agar tidak memutus wheel validator |
| **HTML & CSS Web** | HTML Living Standard / 5.2 + CSS Level 3/4 Modular | **HTML Living Standard (`HTML 5.2+`) & CSS Modular Level 3/4** | Tervalidasi CSP `'self'` + `docs/05` & `docs/06` | Klarifikasi dokumentasi saja; tiada dependensi baru |
| **Docker Host Runtime** | Lock: `Engine 29.9.2 / Compose 5.6.1` <br>Host Aktual: **`Desktop 4.99.0` (`245822`) / `Engine 29.9.3` / `Compose v5.7.0`** | Sinkron segera ke fakta host (**`4.99.0 / 29.9.3 / v5.7.0`**), target upgrade host berikutnya: **`Engine 29.10.0` / `Compose 5.7.1`** | `planning/technology-lock.json` (`operating_system`, `container_runtime`) | Tindakan instalasi/update pada host Windows Docker Desktop |

Catatan penelusuran registry untuk Nginx:
- Tag `nginx:1.30.7-alpine` **tidak tersedia** di Docker Hub (`404 not found` pada pemeriksaan `imagetools inspect`).
- Tag `nginx:1.31.0-alpine` (`sha256:2f07d83bf561b506400dc183b1b2003803e39efbd22451f848adaba14d28c7c7`, build Mei 2026) adalah cabang *mainline* lama dan berada di belakang perbaikan keamanan Oktober 2026 pada **`1.30.6` Stable**. Oleh karena itu, pilihan kanonis yang aman adalah memperbarui digest `nginx:1.30.6-alpine` ke build terbaru `sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a` tanpa pindah ke *mainline* yang tidak tervalidasi.

---

## 3. Hasil Audit Kompatibilitas dan Risiko Kerusakan

### 3.1 PostgreSQL `16.14` → `18.7` (Risiko Tinggi jika Tanpa Penanganan Khusus)

Pemeriksaan langsung terhadap container runtime `helpdesk-m0-db`, skrip uji disposable, DDL migrasi, serta image metadata `postgres:18.7-alpine` mengungkap **tiga sumber kegagalan pasti** apabila tag/digest diubah secara naif:

1. **Perubahan Breaking Path `PGDATA` dan `VOLUME` pada Docker Official Image PostgreSQL 18+**:
   - PostgreSQL `<= 17` menggunakan `PGDATA=/var/lib/postgresql/data` dan `VOLUME /var/lib/postgresql/data` (`compose.yaml:11`).
   - Inspection `postgres:18.7-alpine` menunjukkan `ENV PGDATA=/var/lib/postgresql/18/docker` dan `VOLUME /var/lib/postgresql`.
   - Memasang volume `postgres-data` (struktur PG 16 di root volume) pada `/var/lib/postgresql/data` atau `/var/lib/postgresql` di container PG 18 akan memicu *crash-loop* akibat perbedaan versi biner dan tata letak direktori `pg_ctlcluster`.
2. **Ketidaksesuaian `data_checksums` (`off` vs `on`) jika Memakai `pg_upgrade`**:
   - Audit langsung pada `helpdesk-m0-db` PG `16.14` menunjukkan: ukuran DB `75.4 MiB`, `35` migrasi `001–035` di `migration_control.ledger`, satu-satunya ekstensi terpasang `plpgsql 1.0`, dan **`data_checksums = off`**.
   - Mulai PostgreSQL 18, `initdb` menyalakan **`data_checksums = on`** secara default, sementara `pg_upgrade` gagal jika status checksum sumber dan target tidak identik.
   - **Mitigasi yang Diputuskan**: Jangan memakai `pg_upgrade` biner in-place; gunakan **Logical Dump & Restore (`pg_dumpall --clean --if-exists`)** ke **volume baru (`postgres18-data` terpasang pada `/var/lib/postgresql`)**. Pada ukuran DB `75.4 MiB`, dump & restore penuh memakan waktu hanya ~5–15 detik, langsung mengaktifkan `data_checksums = on` pada cluster PG 18.7, menghindari masalah kompatibilitas indeks/collation minor maupun ketimpangan struktur folder, serta menjaga volume lama `postgres-data` tetap utuh sebagai cadangan rollback instan.
3. **Skrip Uji Disposable `scripts/test_owner_migrations.py` dan Turunannya**:
   - `scripts/test_owner_migrations.py:18,68` meng-hardcode `IMAGE = 'postgres:16.14-alpine@...'` dan `--tmpfs /var/lib/postgresql/data:rw,size=512m`. Modul ini diimpor langsung oleh `test_rm0_01.py`, `test_rm0_02.py`, `test_rm0_03.py`, `test_rm0_04_editorial.py`, `drill_rm0_03_restore.py`, dan `drill_m0_11_restore.py`.
   - Bila hanya `IMAGE` yang diganti ke `postgres:18.7-alpine` tanpa mengubah mount tmpfs menjadi **`--tmpfs /var/lib/postgresql:rw,size=512m`**, container ephemeral tidak akan menyimpan data pada RAM tmpfs (menulis ke writable layer container atau ditolak entrypoint).
4. **Otentikasi MD5 (Aman — Tetap Diaudit)**:
   - PG 18 mendeprekasi password MD5 dan akan mencatat peringatan log bila role memakai MD5.
   - Audit `pg_authid` pada `helpdesk-m0-db` memastikan `password_encryption = scram-sha-256` dan **seluruh 10 role** (`postgres` serta `helpdesk_m1`..`helpdesk_m9`) **sudah memakai hash `SCRAM-SHA-256$`** (baris `legacy-sha256$` pada `migrations/m1/019-account-credentials.sql` adalah kolom aplikasi `identity.subjects.password_hash`, bukan mekanisme auth PostgreSQL).
5. **Penggunaan Tag `postgres` pada `compose.yaml`**:
   - Selain `db` (`compose.yaml:4`), image PostgreSQL juga dipakai oleh `migrate` (`:24`), `upload-init` (`:68`), dan `seed-lab` (`:117`). Keempatnya wajib dipin ke digest `postgres:18.7-alpine` yang sama agar hanya ada satu versi `psql`/`pg_dump`/runtime PG di seluruh stack.

### 3.2 Go `1.26.5` → `1.27.4` dan `pgx v5.12.0`

- `backend/go.mod` memakai pure Go (`CGO_ENABLED=0`) dengan `pgx/v5 v5.12.0`, `puddle/v2 v2.2.3`, `x/sync v0.22.0`, `x/text v0.41.0`.
- `infra/docker/backend.Dockerfile` menyalin `configs/M0.json` dan `migrations/manifest.json` + `checksums.sha256` ke image runtime `scratch` (`USER 65532:65532`) serta menjalankan `go vet ./... && go test ./...` pada stage `test`.
- Image `golang:1.27.4-alpine` menyertakan `GOTOOLCHAIN=local` sehingga kompilasi hermetis tidak mengunduh toolchain secara liar. Tidak ada dependensi `CGO` maupun fitur deprecated Go 1.26 yang memblokir build 169 berkas `.go`.

### 3.3 Node.js `24.11.1` → `26.13.1 LTS`, React `19.3.1`, TypeScript `7.0.2`, Vite `8.3.5`

1. **`frontend/package.json` `engines` Gate**: Baris 13 mengunci `"engines": { "node": ">=24.11.1 <25" }`, yang turut tercermin di `frontend/package-lock.json:21`. Memasang atau membuild dengan Node `26.13.1` memerlukan pembaruan `"engines": { "node": ">=26.13.1 <27" }` dan regenerasi `package-lock.json`.
2. **Perubahan Node 26 pada `module.stripTypeScriptTypes()`**: Node `v26.0.0` menghapus opsi `transform` dan `sourceMap` dari `stripTypeScriptTypes` (status tetap `Stability: 1.2`). Pemeriksaan kode pada empat skrip test repo (`scripts/test_admin_navigation.mjs`, `scripts/test_admin_profiles.mjs`, `scripts/test_ticket_actions.mjs`, `scripts/test_ux_flow.mjs`) membuktikan seluruhnya memanggil `stripTypeScriptTypes(source)` hanya dengan satu argumen tanpa opsi usang tersebut. Namun karena parser Amaro internal dapat berubah antar-rilis Node, keempat skrip wajib dijalankan langsung pada runtime Node `26.13.1`.
3. **`npm ci --ignore-scripts --no-audit --no-fund`** dan `npm run build` (`tsc --noEmit && vite build && node build-templates.mjs`) + `scripts/test_piui_build.py` menjadi gerbang wajib pembuktian build web sebelum deployment.

### 3.4 ClamAV `1.4.6` → `1.5.4` dan Anggaran Memori `DEC-M10`

- Pemeriksaan manifest OCI dan container aktual dengan digest `sha256:7054e3f34308c384ea43cd786ea17abf899bd44af40af9f1b099853d7a5c214e` membuktikan `clamav/clamav:1.5.4` menggunakan **Alpine Linux `3.24.4`**, menyediakan `/init`, `/usr/bin/nc`, dan mengekspos port internal `3310/tcp` serta `7357/tcp`.
- Go client di `backend/internal/platform/blob/files.go` menggunakan protokol TCP `zINSTREAM\x00` dengan chunk `32 KiB`, dan `compose.yaml:89` memeriksa kesiapan melalui `printf "zPING\000" | nc -w 2 127.0.0.1 3310 | grep -q PONG`. Kedua antarmuka tersebut 100% kompatibel pada `1.5.4`.
- Terkait lonjakan RAM *concurrent database reload* pada ClamAV (`~3-4 GiB`), konfigurasi `infra/scanner/clamd.conf:18` sudah mengunci `ConcurrentDatabaseReload no` dan `compose.yaml:80` mengunci `CLAMAV_NO_FRESHCLAMD: 'true'`. Observasi container `1.5.4` pada host menampilkan konsumsi ~`973.6 MiB`, tetap aman di dalam batas **`1.000m CPU / 3.072 MiB RAM`** sesuai **Profil R2 `DEC-M10`** (`ADR 0009`).

### 3.5 HTML 5.2 / Living Standard, CSS Level 3/4, Nginx, dan Docker Desktop/Engine/Compose

- **HTML & CSS**: Template menggunakan HTML5 standar (`<!doctype html>`, `<dialog>`, `<details>`, atribut `aria-*`) dan CSS standar produksi yang aman (`var(--*)`, `clamp()`, `@media`, Flexbox/Grid) tanpa bergantung pada fitur eksperimental yang tidak didukung atau menyalahi aturan CSP ketat Nginx (`default-src 'self'; script-src 'self'; style-src 'self'`).
- **Docker Engine `29.10.0` / Compose `5.7.1` / Desktop `4.99.0`**:
  - Host saat ini memakai Docker Desktop `4.99.0.245822` yang membundel Engine `29.9.3` dan Compose `v5.7.0`. Pembaruan Engine `29.10.0` dan Compose `5.7.1` dilakukan pada level aplikasi/daemon Docker Desktop di host (bukan perubahan source repo).
  - Breaking change Engine `29.10.0`: alamat loopback `127.0.0.0/8` tidak lagi diperlakukan sebagai insecure registry secara otomatis jika `insecure-registries` dikonfigurasi—tidak berdampak pada arsitektur M0 karena seluruh image berasal dari `docker.io` / build lokal tanpa loopback insecure registry. Compose `5.7.1` memperketat verifikasi OCI manifest digest pada cache sehingga selaras penuh dengan strategi pin SHA-256 kita.

---

## 4. Keputusan Arsitektur (`DEC-M11`)

1. Menetapkan target pembaruan terpin untuk seluruh runtime inti ke **Go `1.27.4`**, **Node.js `26.13.1 LTS`**, **PostgreSQL `18.7`**, **ClamAV `1.5.4`**, dan **Nginx `1.30.6-alpine` digest `sha256:901e59...`** (cabang *Stable*) dengan mempertahankan **React `19.3.1`**, **TypeScript `7.0.2`**, **Vite `8.3.5`**, **`pgx v5.12.0`**, serta **Python `3.13.7`**.
2. Mempertahankan **satu proses Go M0**, sembilan schema/pool terisolasi, anggaran kapasitas `DEC-M10` (Profil R1 `4.000m/8.192 MiB`, Profil R2 `4.900m/11.008 MiB`), dan seluruh kontrol keamanan (`read_only`, `cap_drop: [ALL]`, non-root `65532:65532` / `101:101`, `SCRAM-SHA-256`).
3. Mensyaratkan migrasi mayor PostgreSQL `16.14 → 18.7` melalui jalur **Logical Dump & Restore (`pg_dumpall`) ke volume baru (`/var/lib/postgresql` -> `PGDATA=/var/lib/postgresql/18/docker`, `data_checksums = on`)**, dilarang keras melakukan overwrite langsung terhadap volume PG 16 (`postgres-data`) maupun memakai `docker compose down -v`.
4. Segera menyinkronkan catatan kondisi host aktual (`Docker Desktop 4.99.0`, `Engine 29.9.3`, `Compose v5.7.0`) ke `planning/technology-lock.json` agar tidak menyesatkan, sedangkan pembaruan field versi aplikasi di `technology-lock.json` serta penutupan status `DEC-M11` baru dilakukan setelah seluruh fase eksekusi berikut lulus uji 100%.

---

## 5. Rencana Eksekusi Pembaruan Bertahap & Migrasi PG 16.14 → 18.7

> **Prinsip Pengaman**: Dilarang memodifikasi atau menghapus volume `helpdesk-m0_postgres-data` (PG 16) sebelum Fase 3 lulus penuh dan cadangan terverifikasi tersimpan di luar volume container.

### Fase 0 — Sinkronisasi Host & Baseline Pra-Upgrade
1. Sinkronkan catatan `container_runtime` dan `operating_system` di `planning/technology-lock.json` dengan kondisi host aktual (`4.99.0 / 29.9.3 / v5.7.0`). Jika tersedia pembaruan Docker Desktop yang membawa **Engine `29.10.0`** dan **Compose `5.7.1`**, perbarui pada host Windows dan pastikan stack tetap aktif.
2. Catat jumlah baris tabel inti dan snapshot baseline `helpdesk-m0-db` sebelum perubahan dimulai:
   ```powershell
   docker exec helpdesk-m0-db psql -U postgres -d helpdesk -c "SELECT count(*) FROM migration_control.ledger; SELECT count(*) FROM intake.tickets; SELECT count(*) FROM knowledge.contents;"
   ```
3. Ambil backup keselamatan awal PG 16 di direktori backup luar workspace (jangan melalui pipe shell Windows yang mengubah encoding ke UTF-16, dan jangan di-commit ke repo karena berisi hash peran):
   ```powershell
   New-Item -ItemType Directory -Force ..\helpdesk-pg16-backup | Out-Null
   docker exec helpdesk-m0-db pg_dumpall -U postgres --globals-only -f /tmp/pre18-globals.sql
   docker exec helpdesk-m0-db pg_dump -U postgres -d helpdesk -Fc -f /tmp/pre18.dump
   docker cp helpdesk-m0-db:/tmp/pre18-globals.sql ..\helpdesk-pg16-backup\pre18-globals.sql
   docker cp helpdesk-m0-db:/tmp/pre18.dump ..\helpdesk-pg16-backup\pre18.dump
   docker exec helpdesk-m0-db rm -f /tmp/pre18-globals.sql /tmp/pre18.dump
   ```

### Fase 1 — Pembaruan Low-Risk (Go `1.27.4`, Node `26.13.1`, Nginx Rebuild, ClamAV `1.5.4`)
1. Perbarui `backend/go.mod` (`go 1.27.4`) dan `infra/docker/backend.Dockerfile:1` ke `golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280`.
2. Perbarui `frontend/package.json` (`"engines": { "node": ">=26.13.1 <27" }`), regenerasi `frontend/package-lock.json` memakai Node `26.13.1` (`--package-lock-only`), serta perbarui `infra/docker/web.Dockerfile` ke:
   - Build stage: `node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5`
   - Runtime stage: `nginx:1.30.6-alpine@sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a`
3. Perbarui `compose.yaml` service `scanner` ke `clamav/clamav:1.5.4@sha256:7054e3f34308c384ea43cd786ea17abf899bd44af40af9f1b099853d7a5c214e`.
4. **Gerbang Uji Fase 1**:
   - Build image `app` & `web` (di dalamnya menjalankan `go vet ./...`, `go test ./...`, `tsc --noEmit`, `vite build`, `build-templates.mjs`).
   - Jalankan di container Node `26.13.1` atau host Node `26`: `test_admin_navigation.mjs`, `test_admin_profiles.mjs`, `test_ticket_actions.mjs`, `test_ux_flow.mjs`, `test_business_intent.mjs`, `test_public_cache.mjs`.
   - Jalankan `python scripts/test_piui_build.py` dan `python scripts/check_boundaries.py`.
   - Restart hanya `app`, `scanner`, `web` (`docker compose up -d --no-deps --build app scanner web`), verifikasi `clamd --version` (`1.5.4`), RSS ClamAV `< 3.072 MiB`, dan lolos `smoke` lampiran upload/scan `EICAR` + PNG bersih.

### Fase 2 — Gerbang Uji Kompatibilitas Terisolasi PostgreSQL `18.7` (Zero Impact ke DB Aktif)
1. Perbarui `scripts/test_owner_migrations.py`:
   - `IMAGE = 'postgres:18.7-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015'`
   - Ubah argumen `--tmpfs /var/lib/postgresql/data:rw,size=512m` menjadi **`--tmpfs /var/lib/postgresql:rw,size=512m`**.
2. Tarik image PG `18.7` secara eksplisit:
   ```powershell
   docker pull postgres:18.7-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015
   ```
3. Jalankan seluruh suite disposable DB berbasis PostgreSQL `18.7` tanpa menyentuh container runtime `helpdesk-m0-db`:
   - `python -X utf8 scripts/test_owner_migrations.py`
   - `python -X utf8 scripts/test_rm0_01.py`
   - `python -X utf8 scripts/test_rm0_02.py`
   - `python -X utf8 scripts/test_rm0_03.py`
   - `python -X utf8 scripts/drill_rm0_03_restore.py`
   - `python -X utf8 scripts/drill_m0_11_restore.py`
   - `python -X utf8 scripts/test_m0_04.py`
   - `python -X utf8 scripts/test_rm0_04_editorial.py`
4. Bila seluruh skrip lulus (`0` error SQL/role/migration/restore/Go test), barulah Fase 3 diizinkan.

### Fase 3 — Cutover Terkendali `helpdesk-m0-db` (`16.14 → 18.7`) & Validasi Akhir
1. Hentikan sementara writer (`app`, `web`) agar database statis saat dump final, sementara `db` tetap hidup:
   ```powershell
   docker compose stop web app
   ```
2. Ambil dump final tervalidasi di dalam container lalu salin biner ke luar workspace (memakai `pg_dump -Fc` + `--globals-only` agar terhindar dari galat `DROP ROLE postgres` saat restore dan terhindar dari korup BOM/UTF-16 PowerShell):
   ```powershell
   docker exec helpdesk-m0-db pg_dumpall -U postgres --globals-only -f /tmp/pg16-globals.sql
   docker exec helpdesk-m0-db sh -c "grep -vE '^(CREATE|ALTER) ROLE postgres\b' /tmp/pg16-globals.sql > /tmp/pg16-roles.sql"
   docker exec helpdesk-m0-db pg_dump -U postgres -d helpdesk -Fc -f /tmp/pg16-final.dump
   docker cp helpdesk-m0-db:/tmp/pg16-roles.sql ..\helpdesk-pg16-backup\pg16-roles.sql
   docker cp helpdesk-m0-db:/tmp/pg16-final.dump ..\helpdesk-pg16-backup\pg16-final.dump
   docker exec helpdesk-m0-db rm -f /tmp/pg16-globals.sql /tmp/pg16-roles.sql /tmp/pg16-final.dump
   (Get-FileHash ..\helpdesk-pg16-backup\pg16-final.dump -Algorithm SHA256).Hash
   ```
3. Hentikan `db` **tanpa flag `-v`** (mempertahankan volume `helpdesk-m0_postgres-data` PG 16 utuh untuk rollback):
   ```powershell
   docker compose stop db
   ```
4. Perbarui `compose.yaml`:
   - Ganti keempat referensi image `postgres` (`db`, `migrate`, `upload-init`, `seed-lab`) menjadi `postgres:18.7-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015`.
   - Tambahkan volume baru bernama **`postgres18-data`** di blok `volumes:` (biarkan volume lama terpisah agar tidak menimpa data PG 16) dan arahkan mount `db` ke **`postgres18-data:/var/lib/postgresql`**.
5. Nyalakan khusus service `db` PG `18.7` dan tunggu healthy (akan menjalankan `initdb` dengan `PGDATA=/var/lib/postgresql/18/docker` dan `data_checksums = on`, serta membuat database `helpdesk` kosong):
   ```powershell
   docker compose up -d --wait db
   ```
6. Restore peran non-superuser (`helpdesk_m1..m9`) beserta hash `SCRAM-SHA-256$` lalu restore schema + data `helpdesk` dari arsip `.dump` dengan `--exit-on-error`:
   ```powershell
   docker cp ..\helpdesk-pg16-backup\pg16-roles.sql helpdesk-m0-db:/tmp/pg16-roles.sql
   docker cp ..\helpdesk-pg16-backup\pg16-final.dump helpdesk-m0-db:/tmp/pg16-final.dump
   docker exec helpdesk-m0-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/pg16-roles.sql
   docker exec helpdesk-m0-db pg_restore -U postgres -d helpdesk --exit-on-error /tmp/pg16-final.dump
   docker exec helpdesk-m0-db rm -f /tmp/pg16-roles.sql /tmp/pg16-final.dump
   ```
7. Jalankan verifikasi SQL pasca-restore (`server_version` 18.7, `data_checksums = on`, `35` ledger rows, 10 role `SCRAM-SHA-256$`, jumlah tiket/konten cocok dengan baseline Fase 0), jalankan `ANALYZE;` pada database `helpdesk`, pastikan job `migrate` idempoten tidak mengubah checksum, lalu nyalakan seluruh stack (`migrate`, `app`, `scanner`, `web`):
   ```powershell
   docker exec helpdesk-m0-db psql -U postgres -d helpdesk -c "SELECT version(); SHOW data_checksums; SELECT count(*) FROM migration_control.ledger; ANALYZE;"
   docker compose up -d
   ```
   *(Sesudah seluruh Fase 3 lulus penuh, bersihkan berkas sensitif `pg16-roles.sql` dan cadangan sementara sesuai retensi lokal).*
8. **Gerbang Uji Regresi Penuh Pasca-Cutover**:
   - Jalankan `node scripts/test_rm0_04_browser.mjs` terhadap `http://127.0.0.1:18090` (wajib 11/11 PASS, `0` console error / CSP violation).
   - Verifikasi eksekusi job `BACKUP_MANIFEST` end-to-end (`APPROVED -> RUNNING -> SUCCEEDED` + verifikasi `X-Manifest-SHA256`).
   - Jalankan `python -X utf8 scripts/test_m0_13_links.py`, `python -X utf8 scripts/test_modal_and_mobile.py`, `python scripts/check_boundaries.py`, `python scripts/build_business_contracts.py --check`.

### Fase 4 — Finalisasi Dokumentasi, Lockfile, dan Evidence
1. Perbarui seluruh field versi, `migration_tool` (`psql 18.7`), digest image, `container_runtime` (`Docker Engine 29.10.0 / Compose 5.7.1` bila host sudah diperbarui), dan `status` di `planning/technology-lock.json`.
2. Perbarui baris `DEC-M11` di `planning/decisions.csv`, ringkas pembaruan pada `runbooks/local-development.md` / `runbooks/m0-04-lab.md`, catat laporan ke `status/PROJECT_STATE.md`, dan tulis catatan eksekusi aktual ke `status/evidence.jsonl`.
3. Validasi paket akhir via `python scripts/verify_package.py`.

---

## 6. Rencana Rollback Cepat (Jika Terjadi Kegagalan di Fase 3)

Karena volume lama `helpdesk-m0_postgres-data` (PG 16.14) tidak dimodifikasi maupun dihapus selama proses cutover:
1. Hentikan stack: `docker compose stop web app migrate db`.
2. Kembalikan `compose.yaml` ke digest `postgres:16.14-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` dan mount `postgres-data:/var/lib/postgresql/data` (atau via Git checkout bersih pada `compose.yaml` & `backend.Dockerfile`/`web.Dockerfile` jika kembali ke Fase 0).
3. Jalankan `docker compose up -d`, lakukan audit log `app`/`db` dan verifikasi kembali integritas data pada `18090`.
4. Volume uji `postgres18-data` baru boleh dihapus setelah rollback selesai dikonfirmasi sukses.

## 7. Patch keamanan gateway pada kandidat Penyempurnaan Fase 2

Pemindaian Trivy terhadap image `1.30.6-alpine` menemukan empat temuan kritis dan enam temuan tinggi. Kandidat lokal memperbarui pin ke `1.30.7-alpine-slim` sesuai [technology-lock.json](../../planning/technology-lock.json). Varian slim sesuai kebutuhan konfigurasi gateway yang tidak memuat modul dinamis tambahan. Versi, digest, konfigurasi proxy, dan aturan rute yang sama wajib dipakai pada semua model ketika eksperimen lintas arsitektur dijalankan. Riwayat cutover ADR ini memakai pin sebelumnya.
