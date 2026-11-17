# Audit dan penyempurnaan UX Web Admin

13 November 2026. Slice RM0-04 atas permintaan perbaikan menu/sidebar dan orientasi kerja petugas. Shell PIUI Zero asli dipertahankan melalui adapter proyek.

| Temuan | Akar masalah | Perbaikan |
| --- | --- | --- |
| Sidebar desktop, drawer, footer dan pemilih halaman berbeda | Daftar menu ditulis terpisah pada generator | Satu task map kanonis memuat label, target, kelompok, deskripsi dan permission untuk seluruh permukaan |
| Penanda aktif membingungkan pada halaman yang menggunakan query | Pembandingan pathname saja dan hook khusus sidebar | Konteks membaca kind/filter, menandai induk antrean pada detail dan memberi judul/breadcrumb yang konsisten |
| Tombol Kembali dan pergantian modul dapat tidak selaras | Sidebar memakai pushState, pemilih memakai replaceState, tanpa popstate consumer | Keduanya memakai navigasi native; tidak ada lagi simulasi perpindahan sebagian halaman |
| Operator ditawari pilihan pengelolaan di luar mandat | Pemilih hanya memeriksa sebagian permission; halaman tamu menampilkan konsol preview | Opsi dan akses halaman mengikuti jenis akun/organisasi aktif; kondisi tanpa akses menghentikan consumer sebelum memuat data privat |
| Profil template menyebut Super Admin untuk semua pengguna | Identitas dan role statis dari template | Nama/peran aktual dan konteks organisasi aktif pada shell; tidak ada profil admin palsu |
| Tombol profil Keluar hanya berpindah halaman | Handler prototipe tidak memanggil auth/logout | Handler aplikasi memakai POST logout nyata, CSRF, versi sesi, pending state dan broadcast perubahan sesi |
| Logout dapat memuat ulang halaman yang sama | Kanal tambahan mengirim pesan ke listener pada dokumen pengirim sendiri | Satu instance kanal sesi digunakan login/logout; redirect halaman masuk dibuktikan melalui browser |
| Pergantian akun menguasai halaman master | Form lab besar muncul di setiap modul | Identitas kerja ringkas; pergantian akun berada pada profil/halaman masuk |
| Pencarian cepat memakai rute dan label lama | Command palette memiliki daftar tersendiri | Hasil berasal dari task map dan difilter mengikuti menu yang tersedia pada sesi aktif; mekanisme keyboard asli dipertahankan |
| Pemilih halaman kadang tidak berpindah | Kontrol aktif sebelum listener terpasang setelah beberapa request data | Kontrol disabled saat awal dan binder dipasang sebelum await data; navigasi langsung dibuktikan di mobile |
| Label drawer mobile hilang | CSS mode rail desktop menyembunyikan span label pada drawer | Override terbatas pada drawer; label lengkap dan penempatan ikon kiri kembali terlihat |
| Kelompok kosong pada halaman masuk | Menu privat hidden, tetapi label/daftar kelompok tetap terlihat | Kelompok privat tersembunyi pada keadaan awal dan diperbarui berdasarkan sesi |
| Halaman masuk penuh rincian protokol dan akun pemohon bercampur | Salinan demo keamanan dan bootstrap picker seluruh identitas | Panduan tugas Operator/Teknisi/Koordinator/Pimpinan, label peran manusia dan picker petugas; mode lab tetap dijelaskan |
| Badge notifikasi contoh muncul setelah dashboard siap | Guard pemicu demo hanya mencakup halaman pengelolaan/tiket, sehingga dashboard masih menjalankan launcher fixture | Semua halaman aplikasi Helpdesk mengecualikan launcher notifikasi demo; profil memakai nama/peran aktual tanpa hitungan rekaan |
| Escape pada pencarian hanya mempertahankan fokus di field search | Perilaku native input search dapat mendahului penutupan dialog | Handler Escape pada adapter palette menutup dialog dan memakai pengembalian fokus native |
| Nama modul teknis tidak membantu orientasi | Label memakai M1/M8/M9 dan kode role | Nama halaman berbasis tugas serta aturan Admin kanonis untuk kontributor berikutnya |

Tidak ada perubahan backend, hak akses server, kontrak, migrasi, dependency, data tiket atau resource penelitian. Tidak ada penulisan data bisnis selama smoke browser. Aktivasi identitas lab serta logout merupakan perubahan sesi pengujian yang dicatat terpisah dari mutasi bisnis.

Sumber menu tunggal adalah `frontend/admin-navigation.mjs`, consumer shell pada `frontend/src/features/admin-shell.ts`, dan aturan pada `docs/06_ATURAN_UI_UX_WEB_ADMIN.md`. Bukti aktual per kandidat, hasil browser, hash dan batas verifikasi berada pada completion dan manifest folder ini. Acceptance keseluruhan RM0-04 tetap IN_PROGRESS; RM0-05 tidak dimulai.
