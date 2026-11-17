# Panduan Deployment Produksi Helpdesk TIK Kota Depok (M0)

Dokumen ini adalah acuan resmi deployment kandidat final M0 untuk lingkungan pra-produksi dan produksi Pemerintah Kota Depok.

---

## 1. Arsitektur Deployment & Batasan Sumber Daya (M0 Baseline)

Aplikasi Helpdesk TIK Kota Depok pada model M0 beroperasi sebagai **satu proses Go modular monolith**, **satu web server/reverse proxy Nginx**, dan **satu instance PostgreSQL 16** dengan sembilan schema/owner database terpisah.

### Alokasi Sumber Daya (*Resource Envelope Budget*)
Sesuai `DEC-M10` ([ADR 0009](../docs/adr/0009-resource-envelope-and-rpo-rto-dec-m10.md)), lab memisahkan **Profil R1 (4.000 milivCPU / 8.192 MiB)** untuk inti riset (`app 2.500m/4.608 MiB`, `db 1.000m/2.560 MiB`, `gateway 400m/768 MiB`, `exporter 100m/256 MiB`) dan **Profil R2 (4.900 milivCPU / 11.008 MiB)** untuk komposisi Compose aktif yang menyertakan antivirus `scanner` ClamAV (`1.000m/3.072 MiB`). Lihat [inventaris RM0-03](rm0-03-lab.md) untuk rincian limit per layanan dan pekerjaan sementara. Penetapan kapasitas server produksi permanen tetap memerlukan keputusan otorisasi infrastruktur sebelum go-live.

### Prinsip Keamanan & Jaringan
1. **Container Non-Root**: Seluruh container dijalankan menggunakan user tanpa privilese superuser (UID/GID non-zero).
2. **Isolasi Jaringan Internal**: Port basis data PostgreSQL (5432) dan antivirus scanner ClamAV (3310) **DILARANG DIPAPARKAN KE JARINGAN EKSTERNAL / HOST**. Akses hanya diizinkan melalui Docker bridge network internal aplikasi.
3. **Pemberhentian Akses Shell Bebas**: Image container produksi tidak memuat SSH daemon, Docker socket binding, atau konsol debug interaktif.

---

## 2. Manajemen Kredensial & Secrets Produksi

1. **Pemisahan dari Repositori**:
   - Seluruh password untuk sembilan peran database (`helpdesk_m1` s/d `helpdesk_m9`), password `postgres`, session secret key, dan credential API pihak ketiga **DILARANG KERAS** disimpan di dalam Git atau dimasukkan ke dalam Docker image layer.
2. **Mounting Secrets**:
   - Pada deployment Docker Compose / Swarm / Kubernetes, secrets dipasang melalui volume read-only (`/run/secrets/m1`, `/run/secrets/m2`, ..., `/run/secrets/session_key`).
   - Panjang secret password minimal 32 karakter acak berbasis entropi tinggi (`crypto/rand`).
3. **Penonaktifan Mode Lab Sintetis**:
   - Environment variable `HELPDESK_LAB_AUTH` wajib bernilai `0` atau tidak disetel pada server produksi.
   - Endpoint autentikasi lab `/auth/sessions` (Subject ID login) secara otomatis non-aktif dan ditolak saat `HELPDESK_LAB_AUTH != 1`.

---

## 3. Prosedur Migrasi Skema Sebelum Startup (*Pre-Flight Migration*)

Migrasi database M0 dijalankan secara terpisah sebelum proses aplikasi utama dinyalakan:

1. **Jalankan Job Migrasi**:
   ```bash
   sh /workspace/infra/postgres/migrate.sh
   ```
2. **Verifikasi Checksum Ledger**:
   Kueri integritas ledger migrasi wajib mengonfirmasi seluruh checksum tanpa drift:
   ```sql
   SELECT id, schema_name, checksum, applied_at FROM migration_control.ledger ORDER BY id;
   ```
3. **Ketahanan Rollback**:
   Jika terdapat kegagalan pada berkas DDL baru, transaksi DDL akan dibatalkan (*rollback*) secara atomik tanpa merusak skema yang sudah ada. Jangan melanjutkan startup aplikasi jika job migrasi keluar dengan kode non-nol.

---

## 4. Pemeriksaan Kesiapan Aplikasi (*Probes & Health Checks*)

Aplikasi menyediakan probe standar HTTP:
- **Liveness Probe**: `GET /api/v1/health/live` atau `GET /livez`
  - Respons: HTTP 200 `{"status":"live"}`
  - Mengonfirmasi proses Go aktif dan runtime event loop berjalan normal.
- **Readiness Probe**: `GET /api/v1/health/ready` atau `GET /readyz`
  - Respons: HTTP 200 `{"status":"ready"}` jika seluruh 9 pool database terhubung dan versi skema cocok.
  - Respons: HTTP 503 `{"status":"unavailable"}` jika salah satu pool putus atau versi foundation/domain marker tidak cocok.
  - Reverse proxy Nginx / Ingress Controller hanya mengarahkan trafik pengguna ke aplikasi jika probe readiness bernilai 200.

---

## 5. Checklist Pra-Rilis (*Pre-Release Checklist*)

Sebelum membuka trafik pengguna ke kandidat rilis:
- [ ] Seluruh migrasi 001–017 terverifikasi pada ledger.
- [ ] Secrets database terpasang di `/run/secrets/` dengan permission `0600`.
- [ ] Volume privat upload (`/var/lib/helpdesk/uploads`) terpasang dengan kuota disk aman (> 20 GB).
- [ ] Container ClamAV aktif dan dapat dihubungi di port 3310 internal.
- [ ] Sertifikat SSL/TLS HTTPS pada Nginx valid dan terkonfigurasi HTTP Strict Transport Security (HSTS).
- [ ] Endpoint `/api/v1/health/ready` mengembalikan 200 OK.
- [ ] Mode lab sintetis non-aktif (`HELPDESK_LAB_AUTH=0`).
