# Aturan kanonis UI/UX Web Admin Helpdesk

Berlaku untuk ruang kerja petugas, pengelolaan, dashboard, antrean/detail tiket dan halaman masuk. Gunakan shell, drawer, popover, komponen, CSS dan interaksi asli PIUI Zero melalui adapter build proyek. Sumber pada `references/piui-zero` dipertahankan.

## Peta menu tunggal

- `frontend/admin-navigation.mjs` menjadi sumber label, URL, kelompok, deskripsi halaman, permission dan konteks navigasi. Desktop, drawer mobile, footer, navigasi kerja tiket, pemilih halaman dan pencarian menu mengambil data dari sumber ini.
- Gunakan kelompok Pekerjaan, Layanan dan konten, Organisasi dan akses, Pengawasan dan sistem, serta Bantuan dan portal. Kelompok Layanan dan konten disederhanakan ke sub menu **Katalog & Portal** dan **Konten & Media**; Organisasi dan akses disederhanakan ke **Struktur Organisasi** dan **Pengguna & Akses**; serta Bantuan dan portal memakai sub menu **Portal & Bantuan**. Sub menu aktif terbuka otomatis, dan kelompok/sub menu tanpa izin disembunyikan.
- Setiap menu maupun induk sub menu wajib memakai **ikon SVG unik tanpa duplikasi** (gabungan `/admin/assets/icons/piui-sprite.svg` untuk shell standar dan `/helpdesk/admin-icons.svg` untuk ikon semantik Helpdesk), agar tetap terbaca meski sidebar diciutkan ke mode ikon.
- Label memakai Bahasa Indonesia yang menjelaskan tugas. ID modul M1–M9, kode role, nama tabel dan rincian implementasi tidak menjadi nama menu.
- Menu mengikuti jenis akun serta permission pada organisasi aktif. Administrator konfigurasi tidak otomatis memperoleh `ticket.read`. API tetap memeriksa izin per objek dan tindakan.
- Jangan mengaktifkan launcher/badge notifikasi fixture pada halaman kerja nyata. Jumlah notifikasi hanya boleh berasal dari API berizin.
- Identitas/peran awal tidak boleh memakai profil contoh Super Admin. Label petugas, scope organisasi aktif dan mode lab mengikuti sesi aktual. Kontrol privat disembunyikan selama sesi diperiksa.

## Orientasi dan perpindahan halaman

- Judul H1, judul tab, breadcrumb dan penanda aktif mengikuti konteks yang sama. Query `kind` membedakan halaman pengelolaan; query antrean membedakan filter tugas.
- Antrean menjadi induk detail tiket. Gunakan `aria-current="location"` pada menu induk saat membaca detail, dan `aria-current="page"` untuk halaman menu langsung.
- Perpindahan modul menggunakan navigasi URL native. Hindari pergantian sebagian halaman dengan `pushState` tanpa pemulihan state dan penanganan tombol Kembali.
- Kontrol navigasi yang memerlukan JavaScript tetap disabled sampai handler siap; pemasangan handler tidak menunggu pemuatan data master.
- Pemilih Halaman pengelolaan memuat label dan hak akses yang sama dengan sidebar. Menu yang tidak diizinkan tidak menjadi opsi aktif.
- Pintasan dashboard menjelaskan pekerjaan, misalnya verifikasi, disposisi atau tugas teknisi. Jangan menampilkan tombol modul tanpa mandat.

## Akun dan keadaan tanpa akses

- Super Admin mengelola batas tindakan per peran di **Peran dan Akses Modul**. Penugasan izin akun tetap melalui **Akun dan hak akses** pada OPD yang dipilih. Pilihan izin diambil dari kebijakan server. Cantumkan alasan dan versi saat menyimpan perubahan.
- Pada kebijakan peran, pilih peran dan modul. Modul yang sedang tidak ditampilkan tetap mempertahankan pilihan izinnya. Dialog tinjauan menyebut izin yang ditambahkan atau dicabut, alasan, serta seluruh akun peran tersebut dalam PD pada mandat masing-masing.
- Struktur organisasi mengikuti **PD / Unit Kerja → Bidang → Tim teknis → Roster Teknisi**. Daftar tim memakai filter organisasi dan bidang dari server sebelum paginasi. Roster menerima cakupan dari baris tim dan hanya menawarkan teknisi berizin pada tim tersebut.
- Tinjau data terkait sebelum menonaktifkan master. Tampilkan bidang, tim, layanan, roster atau aturan bawaan sejauh tersedia dalam mandat. Jelaskan bila pemeriksaan gagal, di luar mandat, atau hanya mencakup halaman pertama. Tinjauan tidak memperkirakan dampak konfigurasi di seluruh PD.
- Pada Konten dan Media, gunakan tautan lintas modul sesuai mandat. Pratinjau panduan/FAQ memakai penyaring konten yang sama dengan pembaca publik. Tindakan publikasi dan arsip melalui dialog tinjauan sesuai izin.
- Hero menyediakan lima slot pratinjau draf dan versi tayang dengan bingkai Desktop/Mobile. Status CLEAN ditampilkan dari daftar kandidat server. Tautan dari unggahan media ke Banner Hero muncul setelah pemindaian berhasil dan akun dapat menyunting Hero.
- **Banner Hero** berada dalam **Layanan dan konten**. Gunakan lima slot, judul dan teks alternatif setiap gambar, serta kontrol urutan yang dapat dipakai dengan keyboard. Pustaka media menandai calon gambar Hero pada saat unggah. Draf dan terbit memiliki tindakan dan izin terpisah.
- **Tanya Jawab (FAQ)** tersedia pada menu khusus `?kind=faqs` maupun tab `FAQ` di **Panduan dan artikel** (`M8` `/api/v1/knowledge/faqs`), lengkap dengan kolom topik (`category_label`), urutan tampil (`sort_order`), target audience, alur editorial `DRAFT -> PUBLISHED -> ARCHIVED -> RESTORE`, dan pengamanan `expected_version` CAS.
- Pengelola berizin dapat menambah, menyunting, dan mengarsipkan master data termasuk **Akun pengguna (`?kind=subjects`)**, **Layanan**, **Kategori**, **PD / Unit Kerja** (penamaan ringkas konsisten menggantikan klausa panjang "Perangkat Daerah dan Unit Kerja"), **Bidang**, **Tim teknis**, dan **Pemeliharaan sistem** (jendela *Under Maintenance* Terjadwal maupun Tidak Terjadwal di `M1`).
- Seluruh dropdown/combo box pada Web Admin menggunakan komponen setara **Select2** dengan pencarian instan dan navigasi keyboard, serta tabel pengelolaan menggunakan **DataTables** (`admin-datatable.ts`) untuk pencarian tabel, pengurutan kolom, dan jumlah baris tampil.
- Konsistensi Margin, Padding, dan Gap 8-point di seluruh Web Admin: padding kartu/sub-formulir `24px 28px`, padding sel tabel `12px 16px`, setiap sel tindakan wajib membungkus tombol di dalam `.hd-row-actions` dengan `gap: 8px 10px` (tidak boleh saling menempel saat sejajar maupun ter-wrap), toolbar tidak memakai margin `.hd-actions` bersarang ganda, dan field di dalam `.hd-form-grid` mengandalkan grid `gap: 20px 24px` secara simetris.

### Lima profil tugas

- Pilihan utama mengikuti `frontend/admin-profiles.mjs`: Operator, Teknisi, Koordinator, Pimpinan dan Administrator. L1/L2 merupakan tingkat kompetensi teknisi, bukan profil login tambahan.
- Pelapor tetap memakai Web Publik. Editor, Penerbit, Auditor serta pengaturan akses pemohon berada pada bagian akses khusus. Akun otomatis dan vendor disabled tidak menjadi pilihan profil manusia.
- Administrator menaungi ADMIN_OPD, PLATFORM_ADMIN dan SUPER_ADMIN hanya sebagai kelompok tampilan. Label lingkup tetap ditampilkan. Jangan menyatukan permission atau otomatis memilih Super Admin pada akses cepat.
- Formulir akses mengikuti Profil tugas akun → Akun pengguna → OPD/organisasi → Tim opsional → Masa berlaku → Ringkasan → Alasan dan Simpan. Profil menyaring akun yang perannya sudah disediakan oleh M1; formulir ini tidak mengubah role identitas atau membuat akun petugas baru.
- Akses standar adalah irisan izin peran kanonis dengan grant ceiling Administrator pada organisasi aktif yang memiliki `identity.grant`. Tombol menyiapkan pratinjau; perubahan baru dikirim melalui Simpan ke server. Tidak memberikan akses lintas OPD secara implisit.
- `system.purge.request`, `system.job`, `system.maintenance` dan `identity.organization.create` tidak ditambahkan melalui akses standar. Bila masih diizinkan server, kebutuhan tersebut dipilih secara eksplisit pada pengaturan lanjutan.
- Saat Ubah, pertahankan seluruh izin tersimpan dan kunci akun/organisasi sebagaimana kontrak API. Jangan menerapkan ulang template otomatis. Izin di luar mandat saat ini ditandai dan tidak diam-diam dibuang.
- Halaman awal menjelaskan pekerjaan sesuai profil dan memberi satu pintasan utama yang lolos pemeriksaan mandat. Menu lain tetap memakai peta kanonis dan API tetap menjadi otoritas izin final.

- Halaman yang memerlukan petugas menyediakan keadaan masuk atau penjelasan di luar tugas, dengan tautan kembali yang jelas. Jangan menampilkan konsol master sebagai pratinjau tamu atau memuat data privat untuk kemudian disembunyikan.
- Ganti akun lab berada pada profil atau halaman masuk. Hindari pemilih identitas lab di setiap halaman kerja.
- Pemilih akun Admin hanya menampilkan identitas petugas. Jalur pemohon publik/ASN tetap melalui portal. Adapter lab tidak dianggap integrasi identitas produksi.
- Keluar akun memanggil logout server melalui transport CSRF yang sama, menonaktifkan tombol selama permintaan, memberitahukan pergantian sesi ke tab lain, dan kembali ke halaman masuk Admin.
- Halaman masuk menjelaskan langkah masuk dan tugas peran. Rincian cookie, protokol dan implementasi keamanan ditempatkan pada dokumentasi teknis.

## Titik masuk pekerjaan dan roster

- Dasbor mendahulukan nama, peran, pintasan tugas, dan ringkasan yang tersedia sesuai mandat. Ringkasan memakai empat kolom bila ruang cukup dan dua kolom pada viewport sempit. Periode, rincian SLA dan diagnostik koneksi dibuka saat diperlukan.
- Kisi KPI, judul, pesan status dan pengungkapan rincian SLA mengikuti lebar dalam kartu Kinerja tiket. Padding kiri dan kanan tetap seimbang.
- Aksi utama per peran dan seluruh KPI yang diizinkan harus terlihat pada layar awal pada sampel ponsel 320 × 568 dan desktop 1440 × 900. Nama akun, nama PD dan judul KPI membungkus teks. Kartu dengan hasil yang dapat dirinci dapat diaktifkan lewat area kartu atau keyboard.
- Bedakan keadaan memuat, kosong dan gagal dengan teks dan tampilan. Sembunyikan hasil lama saat berpindah filter. Saat permintaan gagal karena koneksi, tampilkan aksi coba lagi di area yang gagal. Saat 7 hari kosong, sediakan pintasan ke 30 hari. Warna status selalu disertai label teks dan berlaku pada tema terang serta gelap.
- Empat kartu memakai respons laporan yang sama untuk satu PD dan periode penerimaan 7 atau 30 hari. Tampilkan nama PD jika tersedia dari direktori serta periode dan rentang di WIB. Hanya mandat aktif tingkat PD dengan `report.read` yang dapat dipilih. Perubahan periode atau PD memperbarui kartu serta rincian SLA bersama. Jika gagal, sembunyikan angka lama dan sediakan tindakan coba lagi.
- **Masih aktif dalam periode** menghitung laporan yang diterima dalam periode terpilih dan masih dalam proses. **Seluruh tiket aktif saat ini** juga mencakup laporan aktif yang diterima sebelum periode itu. **Selesai ditangani** mencakup tiket yang menunggu konfirmasi pelapor dan yang sudah ditutup. Tampilkan pembilang, penyebut, jumlah terlambat dan jumlah selesai tanpa pengukuran dari API. Gunakan **Belum terukur** jika penyebut kosong. **0%** berlaku apabila ada penyelesaian yang terukur dan semuanya terlambat. Rincian menyertakan waktu pembaruan/baca dan versi kebijakan bila tersedia.
- Analisis menggunakan kelompok penerimaan yang sama dengan kartu. Grafik dan tabel tren harian memakai tanggal WIB dari server. Kartu dan segmen grafik membuka rincian dengan PD, periode, tanggal atau kelompok yang sama. Usia adalah selisih kalender sejak diterima. Tenggat jatuh tempo dalam 24 jam kalender dinilai dari target SLA terakhir, dengan kelompok terpisah untuk jeda dan target yang belum terukur.
- Panel tren mengisi lebar Analisis. Grafik bertumpuk memperlihatkan komposisi aktif, selesai, dan dibatalkan serta memberi skala dan tabel angka per tanggal. Saat kohor kosong, gantikan grafik dengan pesan ringkas. Panel usia dan tenggat berdampingan jika ruang cukup dan bertumpuk pada ponsel.
- Analisis membuka **Data sistem**. Sesi staf sintetis dengan laporan dapat memilih **Data contoh**. Beri penanda simulasi dan periode contoh, pertahankan KPI sistem di luar Analisis, serta sembunyikan rincian tiket, tindakan operasional dan ekspor pada tampilan contoh.
- Tabel rincian memerlukan izin baca laporan dan tiket tingkat PD. Pencarian nomor atau judul serta navigasi dengan cursor berjalan di server. Pada ponsel, grafik harian dan tabel bergulir di dalam wadahnya. Tautan grafik dapat difokuskan dengan keyboard dan memindahkan fokus ke judul tabel.
- Grafik harian interaktif memakai satu hentian Tab. Panah kiri/kanan dan Home/End memindahkan fokus antarhari. Setelah membuka tabel dari KPI atau grafik, **Kembali ke ringkasan** mengembalikan fokus ke kontrol asal. Aksi ulang muat dan pergantian halaman memindahkan fokus ke judul area hasil.
- Kapasitas menggunakan waktu penilaian saat ini dan tim dalam mandat pengelolaan jadwal. Kinerja teknis menggunakan waktu aktivitas pada periode terpilih. Tautan laporan dan ekspor mempertahankan PD dan waktu. Ekspor cohort mencakup seluruh periode dan memakai job yang sudah ada. Ekspor kinerja teknis mempertahankan izin API yang sama.
- Dasbor menampilkan satu pintasan utama sesuai peran dan mandat. Operator membuka “Perlu Verifikasi”, Teknisi membuka “Tugas Saya”, Koordinator membuka “Perlu Keputusan”, Pimpinan membuka “SLA dan Hambatan”, dan Admin membuka “Master dan Akses”. Detail tiket memakai tindakan berikutnya dari status dan izin yang sama.
- Antrean menampilkan cakupan PD aktif dan jumlah hasil dalam satu blok. Pencarian nomor atau judul dan filter status/layanan memakai **Semua tiket** yang dapat diakses akun. Jelaskan perpindahan cakupan sebelum pencarian. Pada 390 × 844, kartu pertama dan tombol buka terlihat sebelum menggulir untuk hasil representatif. Kartu ponsel mengelompokkan status, prioritas, target dan peringatan PIC. Waktu diterima dan status penugasan lengkap tersedia pada detail dan tabel desktop.
- Pencarian nomor atau judul tetap terbuka. Kelompokkan filter status dan layanan dalam satu kontrol pengungkapan yang bisa dibuka dengan keyboard. Buka kembali kontrol tersebut bila filter aktif dipulihkan. Letakkan tindakan massal dalam kelompok tersendiri sebelum hasil dan tampilkan hanya sesuai izin.
- Pengaturan tabel yang hanya bekerja pada halaman hasil saat ini berada di **Atur tampilan halaman ini**. Pembedaan ini menjaga pencarian seluruh cakupan tetap mudah ditemukan.
- Saat kembali dari detail, gunakan entri antrean sebelumnya untuk mempertahankan filter, halaman berdasarkan cursor, dan posisi daftar. Entri harus cocok dengan akun serta mandat yang masih aktif. Kata kunci dan cursor tetap pada riwayat tab. Gunakan tautan antrean standar jika browser tidak dapat membaca entri navigasi sebelumnya.
- Detail mendahulukan status, PIC, target dan tindakan utama sesuai status serta peran. Sediakan pintasan berfokus ke Percakapan, Riwayat dan Lampiran. Tautan Penugasan muncul saat tindakan penugasan tersedia. Label input, penjelasan pembaca, dan tombol kirim membedakan **Balasan kepada pelapor** dan **Catatan internal**.
- Smart Dispatch menampilkan tujuan, kategori yang dipakai, alasan rekomendasi, dan informasi roster kandidat yang dipilih. **Tetapkan Manual** tersedia saat ada kandidat manual. **Ajukan Handoff** mengikuti izin dan menjelaskan bahwa PD asal bertanggung jawab sampai pengalihan diterima.
- Kelola jadwal melalui **Ketersediaan Tim → Jadwal dan kapasitas tim**. Ringkas PD, bidang dan tim pada kontrol cakupan yang dapat dibuka kembali. Tampilkan kapasitas dan jadwal sebelum editor. **Tambah jadwal** dan **Ubah** membuka editor. Batal mengembalikan fokus ke aksi pembuka. Mutasi memerlukan alasan dan versi.
- Pengelolaan pemeliharaan menampilkan cakupan kota atau PD sebelum aktivasi. Portal umum menampilkan pengumuman global. Mutasi tiket lokal mengikuti PD penanggung jawab dan API menyampaikan status pemeliharaan saat aksi tertahan.

## Mobile, keyboard dan pencarian

- Desktop dan mobile mempertahankan urutan, label, target dan permission yang sama. Drawer mobile menampilkan label lengkap meskipun sidebar desktop menggunakan mode ikon.
- Sidebar desktop mode ikon menampilkan seluruh tujuan yang diizinkan, termasuk anggota grup yang sedang tertutup pada mode lebar. Setiap ikon membawa nama aksesibel dan judul menu. Saat diperluas, kembalikan pengungkapan grup ke pengaturan sebelumnya.
- Pertahankan mekanisme drawer, penutupan Escape, fokus, popover profil dan pencarian native PIUI. Tooltip memberi nama menu pada sidebar yang diciutkan.
- Pencarian cepat menampilkan hanya menu yang tersedia untuk sesi aktif, tanpa duplikasi atau rute contoh yang sudah tidak dipakai. Pertahankan navigasi keyboard native untuk mencari dan membuka hasil.
- Gunakan token PIUI, ukuran kontrol sentuh minimum 44 px, pembungkusan teks yang wajar, dan scroll hanya pada pembungkus yang memerlukannya.
- Uji target sentuh minimal 44 × 44 px pada tombol aksi, paginasi, pemilih, dan nomor pratinjau Hero. Beri fokus yang terlihat pada kotak pilih, tombol, dan area tabel. Susun kembali form menjadi satu kolom dan batasi scroll horizontal pada pembungkus tabel.
- Nama produk lengkap dapat membungkus di bilah atas ponsel. Beri ruang untuk label akun, peran, dan mandat saat membuka sidebar.
- Pada halaman master, dahulukan tombol tambah, pencarian dan hasil. Tempatkan pemilih modul, struktur organisasi, serta opsi tabel dalam kontrol tersendiri. Formulir hanya muncul saat Tambah, Ubah, atau saat tautan `#new` yang diizinkan dibuka. Aksi akun tersedia melalui profil.
- Pada Hak Akses, tampilkan cakupan peran dan jumlah izin pada kelompok modul yang bisa dibuka. Perubahan yang belum disimpan tetap tersedia saat filter modul berubah. Tinjauan dan alasan mendahului penyimpanan.
- Pada Pustaka Media, dahulukan pemilih **Media editorial** dan **Lampiran tiket privat**, status berkas, dan galeri. Tinjauan dan publikasi salinan berada pada panel terpisah yang memiliki pintasan. Tampilkan status scan dengan istilah operasional dan pisahkan jenis berkas dari akses publikasinya.
- Uji empat tugas praktis pelapor, Operator, Koordinator, dan Super Admin untuk penerimaan pengguna. Gunakan lembar observasi dan catat keberhasilan percobaan pertama, bantuan, salah klik, dan durasi. [Panduan uji kemudahan](releases/RM0_05_UJI_KEMUDAHAN_PENGGUNAAN.md)

## Pembuktian perubahan

- Gunakan istilah pekerjaan seperti Klasifikasi tiket, Aturan penugasan teknisi dan Panduan dan konten portal. Kode modul tetap dipakai pada kontrak, blueprint, log, dan jejak audit. Pesan koneksi menyatakan hasil pemeriksaan aktual. Identitas lingkungan uji mengikuti konfigurasi server.

Perubahan menu diuji terhadap kesamaan desktop/mobile/palette/pemilih halaman, penanda query/detail, role tanpa mandat, organisasi nonaktif, serta logout server. Browser mewakili peran dan breakpoint yang terdampak. Pisahkan hasil visual lokal dari UAT, matriks bisnis penuh dan keputusan rilis.
