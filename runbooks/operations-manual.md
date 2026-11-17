# Panduan Operasional Harian Helpdesk TIK Kota Depok (M0)

Buku panduan ini diperuntukkan bagi tim Administrator Sistem, Operator Helpdesk, dan Koordinator TIK dalam mengelola operasional harian.

---

## 1. Pemantauan Kesehatan Sistem & Diagnostik Teredaksi

Administrator Platform dapat memeriksa status kesehatan sistem secara menyeluruh melalui:
- **Endpoint**: `GET /api/v1/admin/health` (Wajib otorisasi `system.health`).
- **Data yang Disajikan**:
  - Status keseluruhan (`HEALTHY` / `DEGRADED` / `UNAVAILABLE`).
  - Status kesiapan 9 modul internal (M1 `identity` s/d M9 `notify_audit`).
  - Status antivirus scanner ClamAV (`HEALTHY`).
  - Status media storage volume (`HEALTHY`).
  - Metrik lag antrean durable outbox dan inbox (`outbox_lag: 0`, `inbox_lag: 0`).
- **Prinsip Redaksi Keamanan**:
  - Respon diagnosa kesehatan sistem secara mutlak diredaksi dari informasi sensitif (tidak menampilkan string koneksi database `postgres://`, password, token autentikasi, maupun direktori absolut root).

---

## 2. Manajemen Jendela Pemeliharaan Sistem (*Maintenance Windows*)

Jika diperlukan pemeliharaan terencana (misal upgrade infrastruktur atau migrasi jaringan), administrator dapat mengaktifkan jendela pemeliharaan melalui `POST /api/v1/admin/maintenance`:

### A. Mode `READ_ONLY`
- **Kegunaan**: Mengizinkan pengguna membaca status tiket, katalog layanan, dan artikel portal, namun memblokir mutasi tulis baru.
- **Dampak Teknis**: Seluruh permintaan `POST`, `PUT`, `DELETE` pada scope terkait akan ditolak dengan respons HTTP `503 Service Unavailable` disertai pesan informatif bagi warga/staf.
- **Payload Aktivasi**:
  ```json
  {
    "expected_version": 1,
    "mode": "READ_ONLY",
    "starts_at": "2026-11-08T00:00:00Z",
    "ends_at": "2026-11-08T04:00:00Z",
    "message": "Pemeliharaan infrastruktur pusat data Kota Depok"
  }
  ```

### B. Mode `DRAIN`
- **Kegunaan**: Menghentikan penerimaan tiket baru oleh warga/OPD, namun membiarkan teknisi menyelesaikan tiket yang sedang berjalan (*in-progress*).

### C. Pengembalian ke Mode `NORMAL`
- Untuk mengakhiri masa pemeliharaan sebelum waktunya atau mereset sistem:
  Kirim request dengan `mode: "NORMAL"` dan rentang waktu di masa lampau. Sistem akan secara otomatis menghentikan jendela aktif dan membuka kembali seluruh lalu lintas mutasi tulis.

---

## 3. Eksekusi Scoped Operational Runner (AC24)

Operasi pemeliharaan batch dijalankan melalui endpoint terkontrol `POST /api/v1/admin/operations`:
- **Jenis Pekerjaan yang Diizinkan (*Allowlist*)**:
  1. `BACKUP_MANIFEST`: Membuat salinan manifes metadata sistem, katalog layanan, dan checksum skema.
  2. `HEALTH_REPORT`: Menjalankan evaluasi diagnosa mendalam seluruh modul.
  3. `PURGE_REQUEST`: Pengajuan pemusnahan retensi (dengan penegakan kontrol ganda dan status disabled default).
- **Larangan Eksekusi Ilegal**:
  Permintaan pekerjaan dengan jenis di luar allowlist (misal `SHELL_EXEC`, `SQL_CONSOLE`) akan seketika ditolak dengan HTTP `400 Bad Request`.

---

## 4. Pengarsipan & Pemulihan Tiket (AC22)

1. **Pengarsipan Tiket Terminal**:
   - Hanya tiket dengan status `CLOSED` atau `CANCELLED` yang dapat diarsipkan (`POST /api/v1/tickets/{id}/archive`).
   - Tiket aktif (`OPEN`, `IN_PROGRESS`, `RESOLVED`) yang dicoba diarsipkan akan ditolak dengan HTTP `409 Conflict`.
   - Pengarsipan tidak menghapus data; timestamp `archived_at` dicatat dan seluruh histori/catatan/lampiran tetap utuh.
2. **Pemulihan Tiket Terarsip**:
   - Jika tiket diperlukan kembali untuk pembuktian audit, koordinator dapat memulihkannya via `POST /api/v1/tickets/{id}/restore-archive`.

---

## 5. Penanganan Insiden Operasional (*Incident Handling*)

1. **Antrean Outbox/Inbox Tertahan (*Lag / Dead Letter*)**:
   - Periksa status pengiriman pada dasbor notifikasi M9.
   - Jika pengiriman notifikasi gagal mencapai tujuan, status `DEAD_LETTER` akan terlihat secara transparan pada riwayat job delivery tanpa membocorkan kredensial.
   - Lakukan restart proses aplikasi; worker durable delivery secara otomatis melanjutkan pemrosesan event dari titik ACK terakhir.
2. **Karantina Berkas Malware**:
   - Jika pengguna mengunggah berkas yang terdeteksi berbahaya oleh ClamAV (status `QUARANTINED`), berkas tersebut segera dipindahkan ke direktori isolasi dan diblokir mutlak dari unduhan pengguna.
   - Buat salinan tersanitasi jika dokumen tersebut valid secara administratif namun perlu pembersihan format.
