# Penyempurnaan katalog, identitas pelapor dan penugasan

## Kategori dan sumber data

Lima belas pilihan lama dipetakan satu per satu ke kategori baru. Tambahan delapan pilihan mencakup perangkat kerja, identitas/autentikasi, integrasi data dan API, pencadangan/pemulihan, tanda tangan elektronik, CCTV, aplikasi publik dan bantuan TIK lainnya. Nama kategori konsisten pada input pelapor dan verifikasi. SIPD Penganggaran, Perencanaan dan Penatausahaan tetap terpisah. ID historis tetap dapat dirujuk. Enam belas layanan yang sudah ada diarahkan ke kategori yang lebih tepat apabila masih memakai kategori payung awal.

Direktori lab berisi 37 nama perangkat daerah termasuk 11 kecamatan. Contoh Bidang awal tersedia untuk Diskominfo dan Dinkes. Tambah, perbarui, aktifkan atau nonaktifkan melalui Web Admin. Struktur Bidang yang belum tersedia perlu dimasukkan dari master yang disahkan. Konfigurasi ini tidak membuat pegawai atau memberi akses ke tiket instansi.

## Fitur yang ditonjolkan

| Fitur | Alur dan bukti |
|---|---|
| Smart Dispatch | Judul dan deskripsi memberi saran awal. Operator melihat pilihan pelapor dan saran, lalu menetapkan kategori/prioritas. Aturan per kategori memilih tim/Bidang. Kandidat yang memenuhi mandat dan roster diurutkan dari proyeksi beban. |
| Pelimpahan lintas OPD | Aturan lintas OPD menghasilkan saran yang dapat mengisi tujuan. Koordinator memilih atau meninjau OPD/tim aktif dan mengirim alasan. OPD tujuan menerima melalui tautan. Uji HTTP mencakup pergantian pemilik dan pencabutan akses OPD asal. |
| Pelaporan terarah | Laporan umum memberi jalur saat layanan belum diketahui. Pemohon melihat ringkasan kategori dan asal laporan sebelum kirim. Pemohon tanpa login tetap memakai kunci pelacakan sebagai tamu. |
| SLA, hasil, dan audit | Penugasan dan pelimpahan memakai lifecycle yang sudah ada. SLA, histori, konfirmasi 24 jam, lampiran privat, laporan pimpinan, dan panduan mandiri tetap menjadi fitur andalan dengan batas pembuktian masing-masing. Lihat bukti lifecycle dan handoff RM0-03/RM0-04. |

Administrator membuka **Perangkat daerah dan unit kerja**, **Bidang**, **Tim teknis**, serta **Kategori layanan** dari menu yang sesuai mandat. Di **Layanan TIK → Ubah → Aturan Smart Dispatch**, pilih kategori, tingkat, OPD, tim dan kompetensi. Aturan lintas OPD memerlukan mandat konfigurasi pada kedua OPD. Direktori referensi baru sendiri tidak menyediakan tim, roster, atau mandat lintas OPD.

Nama dan peran pada sidebar menggunakan baris yang dapat membungkus serta mempertahankan tinggi di dalam flex sidebar. Pengujian struktur PIUI mencakup menu baru. Visual browser lokal pada kandidat ini belum dapat dibuktikan karena akses browser tidak tersedia.
