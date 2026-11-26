# Ketersediaan, beban kerja, dan kinerja teknis M0

## Alur petugas

1. Di **Ketersediaan Tim**, pilih PD/Bidang/Tim dan teknisi dari direktori akun. Koordinator dengan mandat disposisi pada tim tersebut dapat memperbarui roster. Pemegang mandat pengelolaan roster yang sudah ada tetap dapat menggunakannya. Teknisi dengan mandat baca dan resolusi melihat **Jadwal Saya** dan dapat mencatat atau membatalkan ketidakhadiran sendiri.
2. Di **Antrean Tiket**, buka tiket terverifikasi dan lihat tim, kandidat, beban aktif, dan status kapasitas. Konfirmasi penugasan dengan alasan. Jika tidak ada rekomendasi, gunakan jalur manual sesuai mandat. Tiket aktif dengan PIC berhalangan ditandai untuk peninjauan alih tugas.
3. Di **Laporan Kinerja**, pilih periode dan cakupan. Teknisi melihat **Pencapaian Saya**. Petugas dengan `report.read` melihat agregat dalam mandatnya. Unduhan ringkasan memerlukan izin ekspor pada cakupan yang sama.

## Definisi dan batas data

- Roster memakai interval `[mulai, selesai)` dengan tampilan WIB. Akun dan mandat harus aktif. Ketidakhadiran akun berlaku lintas jadwal dan tim. Pembatalan tercatat sebagai perubahan versi. Status berhalangan tidak membagikan alasan kepada operator.
- Kapasitas adalah batas tiket aktif pada roster organisasi/tim. Beban satu akun dihitung dari seluruh penugasan aktifnya. Sisa untuk satu jadwal adalah selisih kapasitas dan beban, minimal nol. Dalam ringkasan beberapa tim, pakai sisa terbesar pada jadwal yang memenuhi syarat untuk setiap akun dan hitung akun sekali. Kapasitas rosters sebelum migrasi dapat kosong dan harus dikonfigurasi oleh petugas berizin.
- Beban aktif mencakup `ASSIGNED` dan `IN_PROGRESS`. Menunggu vendor merupakan bagian dari beban aktif. `RESOLVED` adalah tiket menunggu konfirmasi dan dihitung terpisah. Snapshot lama yang belum memuat status vendor tetap masuk total beban sesuai state; jumlah menunggu vendor pada kandidat tersebut belum terukur sampai ada snapshot baru.
- M5 membaca backlog durable M3→M5. Event tertunda atau gagal permanen membuat beban sementara belum terukur untuk pemeringkatan. Antrean sepi dengan backlog kosong tetap dapat menghasilkan nol yang sah. Smart Dispatch mengurutkan kandidat terukur menurut utilisasi terendah, sisa kapasitas terbesar, dan ID akun. Rekomendasi diperiksa lagi sebelum mutasi M3. Beban mengikuti proyeksi dan tidak mengunci slot pada transaksi tiket lain. CAS dan idempotensi M3 berlaku per tiket.
- Laporan teknis memakai cohort aktivitas dalam interval `[from,to)`. Resolusi memakai waktu tercatat pada upaya, penerimaan dan penutupan otomatis memakai waktu perubahan hasil upaya, reopen memakai pembukaan episode baru, dan work log memakai waktu akhir catatan. Jumlah unik resolusi menghitung ID tiket sekali. Capaian resolusi memakai pelaksana upaya tersebut. Konfirmasi, penutupan otomatis, dan reopen diatribusikan ke upaya yang mendasarinya. Catatan pekerjaan dihitung ke akun yang mencatatnya.
- SLA teknis memakai target, endpoint, dan bruto/neto dari snapshot M3 berbasis aturan M6 saat resolusi. Penyebut mencakup upaya dengan target dan endpoint; pembilang mencakup endpoint pada atau sebelum target. Bruto/neto dijumlahkan per upaya terukur. Tanpa penyebut, persentase kosong. M9 memperoleh fakta historis terbatasi dari port M3. Watermark menunjukkan aktivitas paling baru dari fakta yang masuk laporan; waktu baca tersedia terpisah.
- Laporan memeriksa pemilik tiket saat dibaca dan atribut unit/tim historis saat fakta tersedia. Fakta tanpa atribusi tim tidak diklaim sebagai capaian sebuah tim. CSV ringkasan dihitung melalui query yang sama dalam permintaan baru dan memeriksa ulang mandat; perubahan aktivitas di antara dua permintaan dapat mengubah angka. Ekspor asinkron laporan SLA yang sudah ada tetap tersedia bagi mandat organisasi.
- Migrasi `044–046` aditif dan diuji pada data sintetis. Definisi, kontrak API/event, dan fixture dapat dipakai untuk pembandingan M0/C3/F9/G-OPT. Implementasi fitur dan pemeriksaan pada pekerjaan ini berjalan di M0.

## Batas kandidat

Versi pengembangan lokal tersedia di [Web Admin 18090](http://127.0.0.1:18090/admin/auth/login.html) melalui proyek Compose `helpdesk-m0`. Verifikasi fitur pada 18193 merupakan bukti historis. UAT petugas, keputusan domain, dan persetujuan rilis memiliki gerbang sendiri.
