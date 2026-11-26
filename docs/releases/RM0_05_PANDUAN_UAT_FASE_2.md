# Panduan UAT manusia Helpdesk TIK M0

Panduan ini mencatat skenario kandidat historis `m0-p2-20261124-c3`. Lingkungan preview 18192 sudah dipensiunkan setelah konsolidasi. Sebelum sesi manusia, cocokkan kandidat dan fixture yang ditetapkan koordinator UAT. Lihat [bukti kandidat historis](../../qa/remediation/rm0-05/penyempurnaan/fase2-completion.json) dan [checkpoint terkini](../../status/PROJECT_STATE.md).

## Persiapan

1. Koordinator UAT mencocokkan image dan ledger dari completion, menetapkan peserta serta jadwal, lalu mencatat kondisi awal. Tetapkan petugas pembuat fixture dan penguji yang berbeda untuk jalur pemohon dan petugas.
2. Gunakan akun sintetis sesuai peran yang tampil pada menu pemilih akun lab. Untuk pendaftaran publik gunakan data sintetis sesuai kriteria formulir. Pakai PNG/PDF bersih tanpa data pribadi dari penanggung jawab uji. Jangan masukkan NIK nyata, kunci tamu, token, kata sandi, atau data tiket kerja ke lembar hasil.
3. Awali judul laporan dengan kode skenario dan penanda peserta yang tidak sensitif. Siapkan tiket terpisah untuk jalur setuju, tolak, handoff, dan ketidaktersediaan teknisi. Gunakan dua profil browser untuk uji lintas akun, dua tab dalam satu profil untuk konflik versi, dan perangkat seluler atau viewport 390 × 844 untuk langkah mobile.
4. Isi [lembar hasil UAT](../../qa/remediation/rm0-05/uat-worksheets.csv). Catat kandidat, perangkat, nama penguji, OPD, tanggal, langkah, hasil aktual, referensi bukti tersensor dan keputusan. Jika ada kegagalan, catat ID cacat, tingkat dampak, rute, kondisi awal dan tindakan sampai gagal. Hindari menangkap kunci atau sesi di layar. Pindahkan pengesahan ke paket keputusan setelah semua cacat pemblokir terselesaikan.

## Jalur per peran

| Skenario | Langkah kerja dan hasil yang harus dilihat |
|---|---|
| UAT-01 · Tamu | Pada Katalog, pilih layanan yang menerima tamu, masukkan laporan dan tambah bukti. Simpan kunci di tempat aman. Lacak tanpa nomor di URL. Coba lihat media saat karantina dan setelah CLEAN. Saat teknisi menyelesaikan, pilih “Belum selesai”, periksa pekerjaan dilanjutkan, lalu setujui hasil upaya baru. Periksa status dan alasan penutupan. |
| UAT-02 · Akun masyarakat | Buat akun sintetis, masuk melalui halaman Akses, laporkan kendala, dan periksa daftar tiket pribadi. Gunakan pencarian serta halaman selanjutnya bila hasil banyak. Ulang pada akun lain dan setelah logout untuk memeriksa pembatasan detail. |
| UAT-03 · ASN | Pilih ASN fixture dan layanan khusus ASN. Pastikan pilihan PD mengikuti mandat akun. Simpan draf, ubah di tab lain hingga konflik muncul, lalu ganti akun. Periksa bahwa draf awal tidak muncul untuk akun lain. Coba akses layanan/tiket sebagai ASN PD berbeda. |
| UAT-04 · Operator | Buka “Perlu Verifikasi”; periksa bahwa laporan baru muncul. Gunakan tab dan enter untuk membuka detail, minta informasi, verifikasi dan ubah kategori dengan alasan. Pada tiket belum terverifikasi, periksa bahwa penugasan belum tersedia. |
| UAT-05 · Koordinator | Buka “Perlu Keputusan”. Pada dua tiket milik PD yang sama, bandingkan kandidat Smart Dispatch ketika roster memenuhi aturan dan ketika roster aktif tersedia tanpa kecocokan aturan. Untuk kondisi kedua, atur aturan uji lewat Admin dan pilih “Tetapkan Manual” dengan alasan. Uji PIC vendor, jeda berizin, dan waktu SLA. Ajukan handoff dan masuk sebagai petugas PD tujuan untuk menerima; sebelum diterima tanggung jawab tetap di unit asal. |
| UAT-06 · Teknisi | Buka “Tugas Saya” pada layar mobile. Periksa detail, mulai, isi log, tambah komentar publik dan catatan internal, unggah bukti lalu selesaikan. Gunakan dua tab untuk mencoba versi lama. Cocokkan tenggat 24 jam dan cek pemohon hanya melihat komentar publik. Untuk auto-close terkontrol, gunakan bukti [pengujian lifecycle](../../qa/remediation/rm0-05/penyempurnaan/m0-p2-20261124-c3/lifecycle.json); jangan mengubah jam host. |
| UAT-07 · Editor/Penerbit | Mulai di `?kind=articles`, lalu cek `?kind=faqs`, `?kind=media`, dan `?kind=hero`. Gunakan akun berbeda untuk penulisan dan publikasi bila mandat memisahkannya. Terbitkan panduan, halaman, FAQ, dan lima banner. Cek tampilan publik/mobile, hasil pencarian lanjutan, dan penolakan saat menggunakan langsung lampiran privat. |
| UAT-08 · Pimpinan/Auditor | Dari “SLA dan Hambatan” buka laporan dan periksa periode, denominator, watermark, filter PD, ekspor dan audit. Minta Admin mencabut hak akun uji, lalu ulangi dari sesi lama. Pastikan daftar/halaman berikutnya dan unduhan mengikuti izin baru. |
| UAT-09 · Admin OPD/Super Admin | Di `?kind=memberships` dan `?kind=role-policies`, atur mandat dan tinjau batas delegasi. Di `?kind=rules`, tambah roster dan nonaktifkan setelah UAT-05. Di `?kind=maintenance`, aktifkan READ_ONLY/DRAIN pada satu PD dan mintalah PD lain membuat atau melanjutkan tiket. Pulihkan jadwal pada cakupan yang sama. Uji backup manifest dan checksum. Untuk penolakan purge pakai akun tanpa hak pada fixture. |

## Titik keputusan

- Koordinator UAT menjadwalkan sembilan skenario. Catat PASS, FAIL atau TERTAHAN sesuai hasil nyata, lalu minta persetujuan per skenario dari pemilik tugas.
- Pengelola identitas dan infrastruktur menetapkan staging resmi, akun OIDC uji, tujuan notifikasi uji dan mirror definisi yang disetujui. Verifikasi kanal resmi menggunakan data sintetis dan pisahkan hasil dari sink.
- Pemilik layanan, proses, data dan infrastruktur mengisi keputusan yang masih terbuka. Lihat [paket keputusan dan berita acara](RM0_05_UAT_AND_DECISION_PACKET.md). Dokumen otorisasi rilis diisi setelah peserta menyelesaikan UAT dan bukti disetujui.
