# Panduan Pemulihan Bencana (Disaster Recovery) Helpdesk TIK Kota Depok (M0)

Buku panduan ini menguraikan prosedur resmi pencadangan (*backup*), pengujian pemulihan (*restore drill*), dan target pemulihan sistem dalam skenario bencana infrastruktur.

---

## 1. Definisi Target Pemulihan (RTO & RPO)

- **Recovery Time Objective (RTO)**: Target durasi pemulihan sistem hingga siap melayani kembali adalah **< 60 detik** (pada pengujian dril aktual tercapai **0.7 detik**).
- **Recovery Point Objective (RPO)**: Kehilangan data maksimal dibatasi pada transaksi yang terjadi setelah titik pencadangan snapshot terakhir (*point-in-time snapshot*).
- **Integritas Sembilan Skema**: Seluruh sembilan skema PostgreSQL (`identity`, `catalog`, `intake`, `classification`, `assignment`, `sla`, `escalation`, `knowledge`, `notify_audit`) beserta ledger migrasi (`migration_control.ledger`) wajib pulih 100% tanpa inkonsistensi relasional.

---

## 2. Prosedur Pencadangan Terjadwal (*Backup Procedure*)

Pencadangan dilakukan secara berkala menggunakan utilitas standar `pg_dump` dengan hak akses administratif terisolasi:

```bash
docker exec helpdesk-m0-db pg_dump -U postgres -d helpdesk --clean --if-exists > /backup/helpdesk_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Parameter Kunci:
- `--clean`: Menyertakan perintah pembersihan DDL sebelum pembuatan ulang objek.
- `--if-exists`: Mencegah error jika objek belum ada pada database target pemulihan.
- **Penyimpanan Luar Lokasi (*Off-Site Storage*)**: File dump dienkripsi menggunakan AES-256 dan ditransmisikan ke media penyimpanan cadangan sekunder di luar pusat data utama.

---

## 3. Prosedur Dril Pemulihan Terisolasi (*Isolated Restore Drill*)

Pengujian pemulihan bencana wajib dilakukan secara berkala pada basis data terisolasi tanpa pernah menyentuh atau mematikan basis data kerja utama:

1. **Jalankan Skrip Dril Otomatis**:
   ```bash
   python scripts/drill_m0_11_restore.py
   ```
2. **Tahapan yang Dijalankan oleh Dril**:
   - Membaca dataset primer dan mencatat jumlah baris (*row counts*) tabel penting (`identity.subjects`, `catalog.services`, `migration_control.ledger`).
   - Mencatat checksum rantai ledger migrasi primer.
   - Mengambil dump SQL via `pg_dump`.
   - Membuat basis data temporer baru: `helpdesk_restore_drill`.
   - Melakukan restore data dump ke dalam `helpdesk_restore_drill` dan mencatat durasi waktu (RTO).
   - Memverifikasi keberadaan seluruh 9 skema PostgreSQL.
   - Membandingkan jumlah baris dan checksum ledger migrasi pada database hasil restore terhadap data primer (wajib cocok 100%).
   - Menghapus basis data temporer `helpdesk_restore_drill`.
3. **Pencatatan Hasil**: Bukti hasil uji dril dicatat secara durable pada `qa/m0-11/restore_drill.json` dan wajib berstatus `PASS`.

---

## 4. Prosedur Pemulihan Penuh Saat Terjadi Bencana Riil (*Emergency Restore*)

Jika terjadi kerusakan fisik atau kompromi total pada basis data kerja:

1. **Hentikan Layanan Aplikasi Terlebih Dahulu**:
   ```bash
   docker compose stop app web
   ```
2. **Siapkan Instance Basis Data Bersih**:
   Pastikan container `helpdesk-m0-db` aktif dan sehat.
3. **Pulihkan Data dari Berkas Cadangan Terverifikasi**:
   ```bash
   cat /backup/helpdesk_backup_YYYYMMDD_HHMMSS.sql | docker exec -i helpdesk-m0-db psql -U postgres -d helpdesk -v ON_ERROR_STOP=1
   ```
4. **Verifikasi Integritas Pasca-Pemulihan**:
   ```sql
   -- Verifikasi seluruh 9 skema ada
   SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('identity','catalog','intake','classification','assignment','sla','escalation','knowledge','notify_audit');

   -- Verifikasi ledger migrasi
   SELECT count(*) FROM migration_control.ledger;
   ```
5. **Nyalakan Kembali Aplikasi dan Periksa Kesiapan**:
   ```bash
   docker compose start app web
   curl -i http://127.0.0.1:18090/api/v1/health/ready
   ```
   Pastikan HTTP status mengembalikan `200 OK` `{"status":"ready"}` sebelum membuka akses ke pengguna publik.
