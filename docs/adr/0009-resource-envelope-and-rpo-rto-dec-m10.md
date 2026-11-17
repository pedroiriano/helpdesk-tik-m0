# ADR 0009 — Keputusan Anggaran Sumber Daya Dua-Tier dan Target Pemulihan Lab (DEC-M10)

- **ID Keputusan**: `DEC-M10`
- **Status**: `DECIDED_LAB_ENVELOPE` (Ditetapkan pada 17 November 2026 untuk penutupan `R3-I / F15`; penetapan kapasitas server produksi permanen tetap menjadi otorisasi Infrastruktur Pemkot Depok sebelum go-live).
- **Keterkaitan**: `F15`, `R3-I`, `AC10`, `AC25`, `docs/01_BLUEPRINT_M0.md` §12, `planning/technology-lock.json`, `compose.yaml`, `configs/M0.json`.

## 1. Konteks dan Konflik yang Diselesaikan

Audit 10 November (`F15`) dan fase awal `RM0-03` (`R3-I`) menemukan ketidakselarasan angka batas sumber daya:
1. `docs/01_BLUEPRINT_M0.md` §12 menetapkan baseline awal pilot riset sebesar **4.000 milivCPU dan 8.192 MiB RAM** (`app 2.500m/4.608 MiB`, `db 1.000m/2.560 MiB`, `web gateway 400m/768 MiB`, `exporter 100m/256 MiB`).
2. `compose.yaml` mengaktifkan kontainer pemindai antivirus nyata **ClamAV 1.4.6** (`scanner: 1.000m / 3.072 MiB`) tanpa `exporter`, sehingga total limit kontainer tetap pada runtime adalah **4.900 milivCPU dan 11.008 MiB RAM** (selisih `+900m CPU / +2.816 MiB RAM`).

Sesuai `docs/01_BLUEPRINT_M0.md` §12, pemindai antivirus tambahan tidak boleh disembunyikan dengan memeras anggaran `app` (`2.500m / 4.608 MiB`) atau menurunkan RAM ClamAV di bawah kebutuhan basis data tanda tangan virus (~3 GiB) hanya demi memaksa total tampak 8.192 MiB.

## 2. Keputusan Arsitektural (Two-Tier Comparable Resource Envelope)

Menetapkan **dua profil sumber daya eksplisit** yang mengikat konfigurasi `M0` sekaligus menjadi spesifikasi kesetaraan wajib untuk arsitektur pembanding (`C3`, `F9`, `G-OPT`):

### Profil R1 — Envelope Inti Komputasi Riset (`4.000m CPU / 8.192 MiB RAM`)
Digunakan sebagai batas perbandingan inti bila eksperimen beban kerja membandingkan komputasi aplikasi + database + gateway + telemetry tanpa beban resident ClamAV:
- `app` (single-process `M1..M9` pada M0; total kredit gabungan seluruh grup layanan pada C3/F9/G-OPT): **2.500 milivCPU / 4.608 MiB RAM**, `GOMEMLIMIT=4096MiB`, pool DB `4` per owner (`total 36`), `pids_limit=150`. Tercermin kanonis di `configs/M0.json` (`app_budget`) dan `contracts/module_registry.csv`.
- `db` (`postgres:16.14-alpine`): **1.000 milivCPU / 2.560 MiB RAM**, `pids_limit=150`.
- `web` (Nginx static & reverse gateway): **400 milivCPU / 768 MiB RAM**, `pids_limit=50`.
- `exporter` (telemetri eksperimen): **100 milivCPU / 256 MiB RAM**.

### Profil R2 — Envelope Operasional Lab Compose Penuh (`4.900m CPU / 11.008 MiB RAM` tetap; `5.000m / 11.264 MiB` bila ditambah exporter)
Digunakan sebagai envelope kanonis untuk stack lokal terpadu Helpdesk TIK yang menjalankan perlindungan karantina antivirus nyata:
- Seluruh layanan tetap R1 (`app` + `db` + `web` = `3.900m / 7.936 MiB`), **ditambah**
- `scanner` (`clamav/clamav:1.4.6` pada jaringan internal terisolasi): **1.000 milivCPU / 3.072 MiB RAM**, `pids_limit=100`.
- Bila penelitian lanjutan menjalankan uji unggah/pindai aktif pada C3/F9/G-OPT, kontainer `scanner` dengan batas identik (`1.000m / 3.072 MiB`) wajib disertakan pada semua kandidat di dalam Profil R2 agar perbandingan tetap adil.

### Pekerjaan Sementara (Di Luar Jendela Pengukuran Primer)
Kontainer satu-kali pakai berikut dieksekusi di luar jendela pengukuran stabil dan tidak dijumlahkan ke steady-state budget:
- `migrate`: `250m CPU / 128 MiB RAM`
- `upload-init`: `100m CPU / 32 MiB RAM`
- `seed-lab`: `250m CPU / 128 MiB RAM`
- `db-test` / suite verifikasi: `1.000m CPU / 1.024 MiB RAM`

## 3. Target RPO dan RTO Pemulihan (Lab vs Produksi)

- **Baseline Terverifikasi Lab (`scripts/drill_rm0_03_restore.py` & `BACKUP_MANIFEST`)**:
  - **RPO**: **0 transaksi terkomit** pada fixture snapshot terisolasi (konsistensi dump PostgreSQL + verifikasi digest SHA-256 `BACKUP_MANIFEST` terhadap `intake.attachments`, `knowledge.media`, `configs/M0.json`, dan `migrations/manifest.json`).
  - **RTO**: **<= 180 detik** untuk pemulihan penuh ke instans disposable terisolasi (pengukuran nyata sebelumnya `148.096 detik` sudah mencakup kompilasi Go dari sumber; `< 30 detik` untuk startup binary terkompilasi).
- **Batas Produksi**: Kapasitas server produksi (misal rekomendasi host minimum 8 vCPU / 16 GB RAM NVMe pada `docs/releases/M0_RELEASE_AUTHORIZATION.md`), retensi backup lintas situs, dan SLA pemulihan kedinasan tetap memerlukan pengesahan resmi Dinas Komunikasi dan Informatika Kota Depok sebelum deployment produksi.

## 4. Konsekuensi

1. `configs/M0.json` tetap mengunci `app_budget` (`2500m / 4608 MiB`, 36 koneksi pool) agar kesetaraan kode M0 dan batas manifest Go tidak berubah.
2. `compose.yaml` mempertahankan limit `4.900m / 11.008 MiB` sesuai Profil R2 sebagai konfigurasi Compose resmi yang sah.
3. `planning/technology-lock.json` dan `planning/decisions.csv` mencatat `DEC-M10` sebagai `DECIDED_LAB_ENVELOPE` (Profil R1 4.000m/8.192 MiB vs Profil R2 Compose+ClamAV 4.900m/11.008 MiB).
