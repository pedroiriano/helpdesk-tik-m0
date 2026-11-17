# Penyederhanaan peran dan akses — 13 November 2026

Requirement slice: R4-UX-ACCESS dalam RM0-04. Pengguna menyetujui lima profil utama, formulir akses sederhana, halaman awal sesuai tugas dan pemeriksaan akses diizinkan/ditolak. RM0-04 tetap IN_PROGRESS; RM0-05 NOT_STARTED.

## Temuan dan perbaikan

1. Kontrak memuat 15 kode, termasuk tamu, service principal dan vendor disabled. Lima profil presentasi: Operator, Teknisi, Koordinator, Pimpinan, Administrator. Peran teknis tidak digabung/dihapus. Editor/Penerbit/Auditor dan pemohon menjadi akses khusus; L1/L2 tetap satu profil Teknisi.
2. Pintasan Admin sebelumnya memilih SUPER_ADMIN. Kini memilih ADMIN_OPD yang tersedia, kemudian PLATFORM_ADMIN; tidak fallback ke SUPER_ADMIN. Akun khusus dipilih eksplisit pada akun lab lainnya. Label Administrator menyertakan lingkup OPD/Platform/Super Admin.
3. Form membership sebelumnya meminta kode permission dan subject mentah. Kini profil menyaring akun, diikuti akun/OPD/tim/masa berlaku, ringkasan dan alasan. Profil tidak mengubah role identitas. Kode teknis serta checkbox izin berlabel manusia berada pada pengaturan lanjutan.
4. Akses standar merupakan irisan policy peran kanonis dan grant ceiling pada organisasi aktif berizin identity.grant. Purge request, system job, maintenance dan organization create tidak otomatis ditambahkan. Tombol menyiapkan pratinjau; Simpan memakai API yang sama, CSRF, intent/idempotency, alasan dan expected_version.
5. Ubah mempertahankan izin tersimpan dan mengunci akun/organisasi sesuai kontrak API. Izin di luar mandat ditandai, bukan diam-diam dibuang. Validasi klien tidak menggantikan otoritas server.
6. Dasbor menjelaskan tugas dan memberi pintasan utama berizin. Administrator tanpa akses tiket tidak lagi mendapat anjuran membaca antrean. Teknisi menuju tugas sendiri, Operator menuju verifikasi, Koordinator menuju disposisi dan Pimpinan menuju laporan bila berizin.
7. Browser menemukan form awal menampilkan semua kolom generik karena configure() belum dipanggil saat inisialisasi. Kini field dikonfigurasi sebelum workspace ditampilkan; tanpa perubahan API.
8. Build Docker pertama gagal karena policy kanonis belum tersedia di build stage. Dockerfile web menambahkan COPY satu JSON non-secret di build stage. Base image/resource/port/runtime user/Nginx/backend/database tidak berubah. Kegagalan tersimpan di build-web-before.txt; kandidat koreksi lulus.

## Verifikasi aktual

- Build/typecheck, regresi lima profil/scope/ceiling, navigasi Admin, PIUI dan alur UX: PASS. Tes Go domain/API M1 yang sudah ada: PASS. Exact commands/output pada checks.json.
- Hanya web lokal diperbarui. Gateway readiness dan 15 hash aset cocok; web/app healthy. App image sama dengan kandidat sebelum slice.
- Browser Administrator OPD: lima pilihan utama, pratinjau standar Teknisi, warning identity.grant di luar peran Teknisi tanpa submit. Ubah mempertahankan empat izin Administrator OPD; akun/OPD terkunci. Ubah pemohon ASN membuka akses khusus dan mempertahankan 14 izin lama.
- Form awal final hanya memuat field akses. Desktop 1280×900 dan mobile 390×844 tidak overflow halaman; form mobile tidak overflow. Disclosure lanjutan dapat dibuka/ditutup lewat Enter. Screenshot aktual tersimpan.
- Login lima profil, akun tambahan tertutup. Teknisi menuju Tugas saya; menu akses absen dan URL langsung ditolak dengan form tersembunyi. Operator menuju Antrean verifikasi. Sesi Operator dipulihkan, tab QA ditutup, viewport direset. Console error kandidat yang diperiksa kosong.

## Kontrol dan batas

Policy, backend, kontrak API, seed/migrasi, dependency/lockfile, asset/reference dan resource tidak diubah. Tidak ada Simpan membership, penugasan atau tiket selama QA; mutasi hanya sesi lab. Tidak memprovisikan identitas produksi, menyatukan kewenangan atau mengaktifkan vendor/purge. Tidak menjalankan benchmark, full lifecycle/integration/DB suite atau UAT manusia; tidak mengklaim produksi. Peran identitas tetap disediakan M1; formulir mengatur akses organisasi akun yang tersedia. Bukti lama dipertahankan sebagai snapshot.

## Penyelesaian lanjutan

- Formulir memakai baris dan versi pada saat Simpan. Setelah membuat akses, record yang baru tersimpan terbuka dalam mode Ubah. Setelah membuat atau mengubah akses, konfirmasi sukses tampil setelah penyegaran daftar dan konfigurasi formulir selesai.
- Regresi menjalankan listener Simpan dengan transport terkontrol dan membuktikan POST diikuti PUT pada ID dan versi yang benar. Lihat [uji profil](test-profiles-resume.txt).
- HTTP pada PostgreSQL disposable membuktikan pemberian akses standar, baca kembali, pengurangan dan pencabutan izin, serta efek pencabutan pada sesi. Izin di luar peran, organisasi di luar mandat, aktor tanpa mandat, dan versi usang ditolak. Lab dibersihkan. Lihat [hasil HTTP](membership-http.json) dan [status lab](browser-lab-state.json).
- Browser desktop/mobile pada kandidat sebelum koreksi Simpan tercatat di [browser](browser.json). Akses browser lokal tidak tersedia pada sesi lanjutan. Koreksi Simpan diuji lewat regresi listener, API nyata secara terpisah, dan kecocokan aset gateway final.
