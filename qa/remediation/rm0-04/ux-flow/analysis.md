# Analisis dan penyempurnaan alur UX Helpdesk

Tanggal 13 November 2026. Slice lanjutan RM0-04, berdasarkan sumber aktual serta sesi lab sintetis pada port 18080. Fokus pada orientasi, kelanjutan tugas, pemeriksaan laporan, pelacakan dan pemahaman status. Ini bukan acceptance seluruh fase atau UAT organisasi.

| Titik alur | Temuan | Perubahan |
| --- | --- | --- |
| Mulai laporan | Tautan umum langsung menuju formulir tanpa layanan terpilih | Entry laporan umum menuju katalog; URL formulir tanpa pilihan kembali ke katalog |
| Navigasi sesi | Menu publik dan internal bercampur; tautan menawarkan tugas di luar mandat | Navigasi bersama mengikuti jenis akun dan organisasi aktif; sidebar dan footer petugas mengikuti permission; kelompok kosong disembunyikan |
| Layanan membutuhkan login | Pilihan layanan hilang setelah login | Bawa service dan intent terstruktur menuju login lalu kembali ke halaman layanan; tujuan selalu path lokal yang ditentukan kode |
| Mengirim laporan | Tidak ada kesempatan memeriksa rangkuman sebelum commit | Dialog native merangkum layanan, uraian, isian khusus dan nama berkas; kembali mengedit mempertahankan isian dan fokus; konfirmasi meneruskan handler idempotensi yang sama |
| Tiket akun | Tamu bertemu permintaan API yang membutuhkan akun | Empty state menjelaskan pilihan masuk akun atau pelacakan tamu |
| Pelacakan tamu | Pembaca FormData mencari nama yang tidak ada pada input kunci | Baca input bertopeng melalui ID kanonis, validasi hex 64 karakter, normalisasi dan kirim melalui header; koreksi gagal tetap berada pada input tanpa persistensi |
| Dashboard operator | Akun tanpa report.read memperoleh pesan kekurangan mandat meskipun memiliki pekerjaan tiket | Tampilkan orientasi tugas dan pintasan verifikasi/disposisi sesuai mandat; pintasan tugas teknisi mengikuti peran server |
| Daftar dan detail tiket | Kode status/prioritas teknis; OPEN dianggap terverifikasi pada detail | Label bersama mengikuti state aktual, verifikasi terpisah, prioritas kosong disebut belum ditetapkan dan petunjuk langkah berikut tersedia |
| Informasi waktu | Form menyebut SLA tetap 24 jam; detail menyebut auto-close tetap 24 jam | Batas berkas dari policy; SLA mengikuti data tiket; batas konfirmasi memakai resolution attempt aktif dan waktu server, dengan fallback jujur |
| Detail berbasis HTML | Teks tiket, layanan, nomor dan hasil pekerjaan masuk ke template HTML | Escape teks serta atribut pada renderer ringkasan detail; baris dan teks panjang tetap terbaca |
| Pemuatan daftar | Kegagalan daftar tidak memiliki tindakan ulang yang jelas | Tindakan coba lagi memakai cursor saat ini dengan status pemuatan dan tombol terkunci |

Alur pelapor sekarang **pilih layanan → pahami syarat → login bila perlu → isi kendala → periksa ringkasan → kirim → receipt/detail → pantau dan tanggapi**. Pelacakan tamu tetap memakai kunci pribadi melalui jalur tersendiri.

Alur petugas sekarang **masuk → pilih pintasan tugas → antrean sesuai peran → detail dan riwayat → tindakan berizin → pemeriksaan hasil oleh pemohon**. Persetujuan, CAS/version, idempotensi, SLA, attempt guard, ACL dan persistence tetap milik backend yang sudah ada.

Verifikasi dibatasi pada build/typecheck, kontrak sumber PIUI, uji regresi logika terdampak serta smoke browser representatif. Pengiriman tiket/hasil penanganan baru pada database aktif tidak dijalankan; review-to-send diuji melalui listener terisolasi. Positive-path capability diuji dengan fixture dan mock, sementara browser memakai kunci sintetis tidak berlaku. Integrasi identitas nyata dan UAT lintas peran organisasi masih memerlukan proses fase dan otorisasi terpisah.
