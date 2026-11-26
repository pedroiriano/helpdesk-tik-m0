# Operasi Helpdesk lokal

Jalankan dari `C:\Datas\Proyek\Aplikasi\helpdesk-monolith` dengan Docker Desktop Linux aktif.

```powershell
python scripts/prepare_local.py
docker compose up -d --build --wait --wait-timeout 120
python scripts/smoke_local.py
```

Gunakan satu gateway Docker lokal di port 18090. Buka [Web Publik](http://127.0.0.1:18090/) atau [Web Admin](http://127.0.0.1:18090/admin/). Versi ini memakai migrasi 001–046. Riwayat konsolidasi dan pemeriksaan tersedia pada [bukti lokal](../qa/remediation/technical-operations/local-consolidation-18090.json).
Kedua rute menyajikan halaman PIUI asli dengan teks Helpdesk. Dashboard memakai data contoh, sedangkan tombol status koneksi membaca API lokal. Login lab dan master M1/M2 operasional dijelaskan pada [runbook M0-03](m0-03-lab.md). Transaksi tiket lab tersedia pada kandidat M0-04; lihat [runbook tiket dan batas verifikasi](m0-04-lab.md).
Health liveness: `/api/v1/health/live`; readiness: `/api/v1/health/ready`.
Readiness memeriksa sembilan pool/marker foundation, identity/catalog versi 3 dan intake/notify_audit versi 4. Status scanner diperiksa terpisah; file gagal scan tetap dikarantina.

Secret lokal acak dibuat sekali di `.local/secrets`, dikecualikan dari Git dan build context. Jangan menyalin folder ini ke publik, menghapusnya saat volume masih dipakai, atau menampilkan isinya dalam log. `prepare_local.py` tidak merotasi secret yang ada. Docker Compose secrets lokal berupa file host; ini bukan secret manager produksi.

```powershell
docker compose ps
docker compose stop
docker compose start
```

`stop` mempertahankan data. Jangan memakai `down -v`, prune global, atau reset database. PostgreSQL memakai volume `helpdesk-m0_postgres18-data` (volume historis PG 16 `helpdesk-m0_postgres-data` disimpan sementara sebagai cadangan rollback ADR 0010); kontainer proyek lain tidak perlu disentuh.

Jika HTML Dasbor terbuka tetapi login/health API mendapat 502, periksa `docker compose ps -a` dan status DB terlebih dahulu. Pada 5 November 2026 DB ditemukan exit 255/OOM false, aplikasi berulang kali gagal readiness dan migrator sebelumnya gagal saat DB masih startup. Sebab berhentinya DB tidak dapat dipastikan dari log. DB kini memakai `restart: unless-stopped`, seperti app/web; penghentian manual tetap dihormati. Kebijakan ini membantu pemulihan setelah gangguan runtime, bukan bukti ketahanan terhadap semua kegagalan Docker/host.

Pulihkan kontainer DB/volume yang sama dan tunggu healthy sebelum memulihkan app. Periksa ledger/checksum terhadap manifest; jangan reset atau membuat ulang secret. Jika job migrator sebelumnya gagal saat startup, replay melalui runner checksum/ledger yang sama setelah DB siap, pastikan exit 0, lalu restart app dan jalankan `python scripts/smoke_local.py`. Uji login lab melalui `/admin/auth/login.html`; master operasional berada di `/admin/app/helpdesk/index.html` dan tautan Beranda Dashboard membuka `/admin/app/dashboard/index.html`. Angka dashboard template masih data contoh. Bukti pemulihan: `qa/bootstrap/dashboard-recovery-2026-11-05.json`.

Verifikasi terarah:

```powershell
python scripts/check_boundaries.py
python scripts/test_boundaries.py
python scripts/verify_package.py
docker compose --profile test run --rm db-test
```

Tes Go dari `backend`: `go vet ./...` dan `go test ./...`; tes DB nyata dilakukan lewat service `db-test`, tidak tersirat dari test yang skip tanpa environment opt-in. Format: `gofmt -w cmd internal`.
Frontend dari `frontend`: `npm.cmd ci --ignore-scripts`, `npm.cmd run build`. Gunakan Node 26.13.1 atau container builder yang dipin. `npm.cmd run dev` hanya untuk UI lokal; untuk API dan layout terintegrasi gunakan Nginx Compose. Setelah perubahan UI, jalankan `npm.cmd run build` dari frontend, `python scripts/test_piui_build.py` dari root, lalu `docker compose up -d --no-deps --build --pull never web` dan `python scripts/smoke_local.py`. `npm.cmd run dev` membangun kedua template dan membuka preview; API diproksikan ke gateway lokal.

Migrator menggunakan `migrations/apply.sh` melalui `infra/postgres/migrate.sh`. M0-03 telah menerapkan migrasi 001–012 dan seed sintetis ber-guard ke DB kerja lokal. Ledger/checksum dan sembilan role dipertahankan tanpa reset volume/rotasi secret. Lihat `migrations/README.md` dan runbook M0-03 sebelum menerapkan perubahan berikutnya.

Gate kontrak terkini adalah `python scripts/verify_m0_03.py`; gate migrasi `python scripts/test_owner_migrations.py --report qa/m0-03/migrations.json`. Go/HTTP/PostgreSQL M1/M2 diuji dengan `python scripts/test_m0_03.py`. Kedua gate DB ini memakai PostgreSQL sementara tanpa port host/volume persisten, terpisah dari DB kerja. Evidence M0-02 tetap historis; jangan menimpanya dengan hasil source baru.

Cache Web Publik memakai network-first termasuk gambar; fallback offline tetap ada. Worker baru membersihkan cache publik lama secara otomatis tanpa menghapus cookie, session, draft atau cache admin. Uji regresi setelah build: `node scripts/test_public_cache.mjs`. Kontainer web harus dibangun ulang setelah perubahan aset/adapternya; mengubah folder source saja tidak mengganti isi image yang sedang berjalan. Halaman yang sudah dikontrol worker lama akan diperbarui satu kali saat worker baru aktif, kecuali ada formulir yang sedang diisi.

Dokumen Word dan QA lama adalah snapshot spesifikasi M0 1.0. Checkpoint implementasi terkini ada di `status/PROJECT_STATE.md`, bukan pada laporan QA dokumen lama. Repository Git, CI lokal (`scripts/ci_local.py`), workflow CI (`.github/workflows/ci.yml`), serta panduan cutover produksi (`runbooks/production-cutover.md`) dan overlay (`compose.prod.yml`) tersedia dengan migrasi owner terverifikasi `001–040`.
