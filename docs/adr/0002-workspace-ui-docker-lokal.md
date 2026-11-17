# ADR 0002 — Workspace tetap, PIUI, dan Docker lokal

Tanggal: 3 November 2026. Status: diterapkan dalam scope fondasi yang diotorisasi pengguna.

Root implementasi tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`.
Rujukan riset tetap `D:\Jurnal\Microservices`; sumber metode berada di `Penyempurnaan/v3.1`, penyempurnaan produk v3.2 di `Penyempurnaan/sources`, dan paket M0 asal di `Helpdesk-TIK-Depok-Monolith-Modular`.
Folder jurnal dan sumber blueprint tidak diubah oleh bootstrap ini.

Backend mengikuti struktur blueprint, satu executable Go dan sembilan factory modul.
Factory saat ini hanya komposisi fondasi; use case bisnis belum diimplementasikan.
Perbandingan C3/F9/G-OPT kelak harus menggunakan source, schema, seed, API/auth, frontend build, gateway, versi stack dan total resource yang sama. Tidak membuat salinan aplikasi per model. Hanya pengelompokan proses dan konsekuensi komunikasi alaminya yang berubah. M0 tetap kandidat hasil yang sah; bootstrap bukan benchmark.

**Revisi UI sesuai arahan pemilik.** Nginx menyajikan HTML sumber PIUI Modern pada portal dan dashboard PIUI Zero pada `/admin/`. Build tunggal menyalin seluruh paket web dari `references/piui-modern` dan `references/piui-zero`, menerapkan teks Helpdesk dan memasang ulang URL Zero di bawah `/admin/`. CSS, gambar, ikon, dan struktur kontrol PIUI dipertahankan. JavaScript asli menangani navigasi, drawer, hero, FAQ, tabel, grafik, galeri, dan kalkulator. React hanya memiliki area status koneksi yang membaca API health.

Konten layanan, panduan dan simulasi ditetapkan di `frontend/public-copy.json`, `frontend/guide-copy.json` serta adapter build. Sumber referensi dipertahankan. Build menambahkan fungsi aksen yang hilang dari shell Zero dan membatasi cache worker publik pada berkas statis publik. Form kontak lokal menyusun draf tanpa alamat penerima. Dashboard dan login template menggunakan contoh lokal. Aktivasi akses petugas dan data bisnis mengikuti backlog. Bukti bootstrap sebelumnya merekam shell React terdahulu; bukti UI aktif ada di `qa/bootstrap/piui-direct.json`.

Compose project bernama `helpdesk-m0`; kontainer aplikasi tepat `helpdesk-m0`.
Nginx `helpdesk-m0-nginx` melayani satu React build dan `/api/`, PostgreSQL `helpdesk-m0-db` mempunyai volume khusus. Hanya `127.0.0.1:18080` yang diterbitkan. Database tidak membuka port host. Job `helpdesk-m0-migrate` terpisah dari aplikasi, berakhir setelah bootstrap additive, dan tidak merotasi role yang telah ada.

Runtime Go dan Nginx non-root, read-only, drop capabilities, no-new-privileges.
DB admin secret hanya diberikan ke DB dan migrator; aplikasi menerima sembilan secret runtime. Schema dimiliki migrator; setiap runtime role hanya USAGE schema sendiri dan SELECT marker versi. DML domain akan diberikan spesifik saat tabel domain ditambahkan. Tidak ada akun aplikasi atau data pribadi di tahap ini.

Budget aplikasi 2.5 CPU/4608 MiB, DB 1 CPU/2560 MiB, Nginx 0.4 CPU/768 MiB sesuai baseline. Slot exporter 0.1 CPU/256 MiB masih dicadangkan, belum dijalankan. Migrator/test adalah job persiapan di luar steady state; jangan memasukkannya dalam run benchmark. Go memakai GOMAXPROCS otomatis cgroup; GOMEMLIMIT 4096 MiB. Pool maksimum 4 per owner, total 36.

Versi package dipilih dari registry resmi dan dipin dengan lockfile; image dengan digest aktual. Kompatibilitas Node mengikuti [dokumentasi Vite](https://vite.dev/guide/); penggunaan password file mengikuti [dokumentasi image PostgreSQL](https://hub.docker.com/_/postgres). Detail versi ada di `planning/technology-lock.json`.

M0-01 hanya fondasi. Scanner/storage/telemetry penuh, API bisnis, autentikasi, durable events, CI terlindungi, UAT dan gate produksi tetap mengikuti backlog. Tidak ada klaim parity runtime empat model atau pemenang riset.
