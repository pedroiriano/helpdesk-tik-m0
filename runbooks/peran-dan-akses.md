# Penggunaan peran dan akses Helpdesk

Lima profil utama: Operator memeriksa laporan; Teknisi menangani tugas; Koordinator mengatur penugasan/hambatan; Pimpinan memantau dan mengambil keputusan eskalasi; Administrator mengatur akun dan layanan. Pelapor tetap menggunakan Web Publik.

## Menjalankan pekerjaan

1. Buka `http://127.0.0.1:18090/admin/auth/login.html` dan masuk memakai akun petugas. Dalam lab sintetis tersedia lima pintasan profil. Pintasan Administrator memilih Admin OPD jika tersedia, kemudian Admin Platform; Super Admin harus dipilih secara eksplisit pada akun lab lainnya.
2. Pada dasbor, baca kartu Mulai sebagai dan buka pintasan pekerjaan. Menu mengikuti hak akses organisasi akun.
3. Alur utama: Pelapor → Operator memverifikasi → Teknisi menangani → Pelapor mengonfirmasi. Koordinator/Pimpinan masuk ketika diperlukan; Administrator tidak ikut menangani setiap tiket.

## Mengatur akses organisasi

1. Administrator membuka **Akun dan hak akses**, lalu **Tambah data**.
2. Pilih profil tugas dan akun pengguna. Profil hanya menyaring akun yang sudah memiliki peran tersebut, bukan mengganti peran akun.
3. Pilih OPD/organisasi dalam mandat, tim teknis bila perlu, serta tanggal berlaku. L1/L2 tetap satu profil Teknisi; kompetensi/routing mengikuti konfigurasi teknis yang sudah ada.
4. Tekan **Gunakan akses standar** dan baca ringkasannya. Jika perlu, buka **Pengaturan akses lanjutan** untuk mengurangi atau memilih izin yang memang boleh didelegasikan.
5. Isi alasan perubahan dan tekan **Simpan ke server**. Berhasil hanya setelah server mengonfirmasi versi tersimpan. Akses standar belum menyimpan perubahan.
6. Untuk akses yang sudah ada, pilih **Ubah**. Izin lama dipertahankan; akun dan OPD dikunci sesuai API. Mengosongkan izin atau mencabut akses adalah tindakan yang harus disengaja.

Editor, Penerbit, Auditor, serta pemohon ASN/publik tersedia melalui **Akses khusus dan pemohon**. Konfigurasi Administrator tidak otomatis membuka tiket. Grant ceiling, peran akun dan scope organisasi tetap diperiksa server.

## Batas lingkungan

Identitas petugas yang tersedia saat ini berasal dari lab sintetis; SSO dan administrasi provisioning identitas produksi belum dibuktikan. Perubahan ini tidak menggabungkan role server, melakukan migrasi akun, menambah akses pada data kerja, atau mengaktifkan vendor/purge. Gunakan bukti pengujian di `qa/remediation/rm0-04/access-profiles/` untuk cakupan kandidat lokal, bukan pengesahan UAT/produksi.
