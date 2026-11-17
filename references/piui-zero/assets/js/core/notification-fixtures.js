/* Synthetic demo records; never replace with private production data. */
export const NOTIFICATIONS = [
  {
    "title": "Deteksi 5 Percobaan Login Gagal Beruntun",
    "cat": "Keamanan & Login (Prioritas Tinggi)",
    "sender": "Sistem Pelindung Login Otomatis",
    "time": "21 Okt 2026, 11:02:14 WIB",
    "body": "Sistem mendeteksi 5 kali percobaan kata sandi & kode OTP yang salah secara beruntun dari alamat IP eksternal 103.144.22.19. Alamat IP tersebut telah dikarantina otomatis selama 30 menit dan dicatat ke dalam Riwayat Aktivitas.",
    "link": "/app/audit/index.html",
    "id": "NTF-2026-091",
    "unread": true,
    "category": "keamanan",
    "date": "2026-10-21",
    "priority": "high"
  },
  {
    "title": "Pencairan Dana Batch QRIS Rp 428.500.000 Berhasil",
    "cat": "Transaksi & Pembayaran",
    "sender": "Mesin Kliring Pembayaran",
    "time": "21 Okt 2026, 10:54:08 WIB",
    "body": "Pencairan dana kolektif (Batch #QRS-1021) senilai Rp 428.500.000 untuk 64 transaksi telah berhasil diverifikasi dan diselesaikan tanpa selisih saldo.",
    "link": "/app/transactions/index.html",
    "id": "NTF-2026-090",
    "unread": true,
    "category": "transaksi",
    "date": "2026-10-21",
    "priority": "info"
  },
  {
    "title": "Penggunaan Memori Server Cadangan Surabaya Mencapai 78%",
    "cat": "Sistem & Server",
    "sender": "Pemantau Server Otomatis",
    "time": "21 Okt 2026, 10:43:19 WIB",
    "body": "Beban memori pada node SBY-DRC-02 naik ke 78% karena sinkronisasi cadangan harian. Kecepatan layanan utama tetap normal (41 ms).",
    "link": "/app/analytics/index.html",
    "id": "NTF-2026-089",
    "unread": true,
    "category": "server",
    "date": "2026-10-21",
    "priority": "info"
  },
  {
    "title": "Pemeliharaan Terjadwal Akhir Pekan (Sabtu, 01:00–02:00 WIB)",
    "cat": "Pengumuman Tim",
    "sender": "Budi Santoso (Super Admin)",
    "time": "21 Okt 2026, 10:15:00 WIB",
    "body": "Tim Infrastruktur akan melakukan pembaruan sertifikat keamanan TLS pada hari Sabtu pukul 01:00–02:00 WIB dengan metode Zero-Downtime.",
    "link": "/status/index.html",
    "id": "NTF-2026-088",
    "unread": true,
    "category": "pengumuman",
    "date": "2026-10-21",
    "priority": "info"
  },
  {
    "title": "Persetujuan Hak Akses Baru untuk Akun Rina Wulandari (USR-9041)",
    "cat": "Keamanan & Login",
    "sender": "Nadia Putri (Kepala Keamanan)",
    "time": "21 Okt 2026, 09:10:42 WIB",
    "body": "Perubahan hak akses untuk pengguna Rina Wulandari (USR-9041) telah disetujui dan tercatat pada Riwayat Aktivitas.",
    "link": "/app/users/detail.html?id=USR-9041",
    "id": "NTF-2026-087",
    "unread": false,
    "category": "keamanan",
    "date": "2026-10-21",
    "priority": "info"
  },
  {
    "title": "Rekonsiliasi Laporan Transaksi Harian Selesai 100%",
    "cat": "Transaksi & Pembayaran",
    "sender": "Hendra Wijaya (Keuangan)",
    "time": "21 Okt 2026, 08:05:11 WIB",
    "body": "Laporan pencocokan transaksi harian telah selesai diverifikasi otomatis dan siap diunduh dalam format CSV.",
    "link": "/app/transactions/index.html",
    "id": "NTF-2026-086",
    "unread": false,
    "category": "transaksi",
    "date": "2026-10-21",
    "priority": "info"
  },
  {
    "title": "Cadangan Otomatis (Backup) Database Utama Berhasil Disimpan",
    "cat": "Sistem & Server",
    "sender": "Penjadwal Sistem Otomatis",
    "time": "20 Okt 2026, 22:30:00 WIB",
    "body": "Proses pencadangan database harian selesai dalam 14 detik tanpa gangguan layanan.",
    "link": "/app/settings/index.html",
    "id": "NTF-2026-085",
    "unread": false,
    "category": "server",
    "date": "2026-10-20",
    "priority": "info"
  }
];
