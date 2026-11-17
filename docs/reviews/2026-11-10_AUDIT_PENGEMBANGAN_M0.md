**Audit pengembangan Helpdesk TIK Kota Depok — 10 November 2026**

Audit ini memeriksa keadaan aktual di `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`, dibandingkan dengan blueprint M0, aturan pembangunan, kontrak, checkpoint, dan bukti fase. Permintaan pengguna mencakup hasil pengembangan melalui Gemini. Jejak yang tersedia menyebut agen Antigravity, tetapi repository Git belum tersedia dan versi model tidak tercatat sebagai provenance yang dapat diverifikasi. Karena itu atribusi setiap baris kepada Gemini 3.8 Flash High belum dapat dipastikan.

**1. Posisi aktual dan keputusan audit**

Backlog menyatakan M0-01 sampai M0-13 `DONE_VERIFIED`. Implementasi aktual sudah mencakup jauh lebih banyak daripada M0-04 yang terakhir dibahas dalam percakapan. Ada kode dan antarmuka nyata untuk verifikasi, penugasan, resolusi, konfirmasi, vendor, handoff, draft, media, konten, laporan, dan administrasi. Namun status selesai menyeluruh belum didukung oleh correctness pada sejumlah jalur utama yang diperiksa. Prioritas berikutnya adalah remediasi acceptance yang sudah diklaim selesai.

Empat container layanan lokal, yaitu app, db, web, dan scanner, teramati running/healthy. `GET /readyz` menjawab `{"status":"ready"}`. Keadaan ini membuktikan kesiapan probe lokal pada saat audit. Penilaian penerimaan bisnis dan rilis memerlukan bukti tersendiri.

Prioritas P0 dalam laporan ini berarti penghalang pemakaian dengan identitas/data nyata atau penerimaan rilis. P1 berarti correctness, integritas data, atau ketahanan proses yang harus dibereskan sebelum acceptance terkait ditutup. P2 berarti penyempurnaan kegunaan, konsistensi, dan pemeliharaan. Temuan kode merupakan hasil penelusuran statis kecuali dinyatakan diamati melalui browser. Audit tidak menjalankan eksploitasi upload, mengubah tiket kerja, mengaktifkan integrasi nyata, atau mengesahkan rilis.

**2. Yang sudah tersedia dan patut dipertahankan**

| Area | Hasil yang ditemukan | Nilai yang dipertahankan |
|---|---|---|
| Arsitektur | M1–M9 berada pada satu proses Go dengan port internal dan pool/schema per owner | Struktur modular dan sumber bersama untuk penelitian |
| UI Publik | PIUI Modern, lima banner Hero, katalog layanan, pelaporan, pelacakan, FAQ, panduan, lightbox, footer bersama | Sumber template dan aset pengguna |
| UI Admin | PIUI Zero, logo Helpdesk, menu modul, pintasan peran, antrean, detail dan timeline | Shell, komponen native, navigasi keyboard |
| Intake M3 | Idempotency, history, outbox, tracking tamu, komentar, lampiran privat | Fondasi transaksi dan pemisahan pelapor/petugas |
| Workflow | Handler verify/dispatch/resolve/confirm/vendor/pause/handoff/escalation | Alur yang sudah ada untuk diperbaiki secara terarah |
| Media dan konten | Metadata media, scan, pustaka pemilih media, draft, editorial dan search | Kontrak dan konsep dua owner |
| Runtime | Compose lokal, Nginx, health probe, PostgreSQL, ClamAV, secrets dari file | Isolasi lab dan build image yang dipin |
| Tes | Kontrak, unit, integrasi fase, smoke, pemeriksaan hasil build | Kasus yang benar-benar membuktikan kebutuhan |

**3. Temuan prioritas dan perbaikan yang diperlukan**

**F01 — P0. Autentikasi berbasis kata sandi belum mempunyai enforcement yang layak**

Pada [backend/internal/modules/m1/internal/app/identity.go:255](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m1/internal/app/identity.go:255), password diperiksa hanya bila hash tersimpan dan password input sama-sama tidak kosong. Input password kosong dapat melewati perbandingan untuk identifier yang ditemukan. Pada baris 267, UUID subject yang valid diterima sebagai kandidat login. Alias peran dan pola identifier berawalan `19` juga mengarah ke identitas sintetis. Semua ini berada di jalur yang mensyaratkan mode lab, sehingga risikonya saat ini dibatasi konfigurasi lab. UI pendaftaran akun baru dan label SSO membuat batas tersebut perlu jauh lebih jelas.

Registrasi menyimpan `hex(Digest(password))` pada baris 175. Ini memakai digest cepat, tanpa salt per akun dan parameter biaya hashing password. Validasi NIK hanya memeriksa panjang, bukan seluruh karakter berupa digit. Registrasi menghasilkan ID baru sebelum idempotency sehingga replay permintaan yang sama perlu diuji khusus.

Perbaikan yang diperlukan adalah memisahkan endpoint autentikasi sintetis dan autentikasi akun, menolak password kosong pada server, memakai password hashing adaptif dengan salt dan versi, serta mempertahankan mode lab secara eksplisit. SSO memerlukan adapter dan pembuktian issuer/audience/state/nonce serta pemetaan organisasi sesuai keputusan proyek. Minimum bukti berupa password kosong/salah/benar, akun nonaktif, identifier malformed, replay registrasi dan lost response, serta penolakan jalur sintetis di konfigurasi non-lab. AC06 dan AC11 perlu ditinjau ulang untuk cakupan ini.

**F02 — P0. Jalur upload media M8 tidak memeriksa pemilik objek**

`PUT /api/v1/media/{id}/content` pada [backend/internal/modules/m8/internal/app/http.go:173](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m8/internal/app/http.go:173) memvalidasi UUID dan ukuran, lalu memanggil penyimpanan blob tanpa autentikasi/otorisasi objek di handler. Global Origin guard tetap ada, tetapi tidak menggantikan pemeriksaan aktor. `POST /media` juga memakai fallback `X-Guest-Capability` sebagai identitas tanpa validasi capability M3 pada jalur M8. Pada service, metadata baru diberi visibility PUBLIC.

Dampaknya adalah pengisian objek pending oleh pihak yang tidak berhak dan publikasi upload di luar workflow editor yang semestinya. Penyimpanan file menggunakan `O_EXCL`, sehingga laporan ini tidak mengklaim bahwa blob CLEAN yang sudah ada dapat ditimpa langsung.

Terapkan actor context tervalidasi, permission `media.write` dan ownership/scope pada metadata maupun isi file, state transition upload yang sah, serta CSRF untuk mutasi berbasis cookie. Guest harus melewati port M3 untuk lampiran tiket. Uji tanpa sesi, pengguna berbeda, OPD berbeda, replay upload, ukuran/hash tidak cocok, dan objek yang telah CLEAN. AC07 dan AC18 terdampak.

**F03 — P0. Reuse privat ke publik belum membuktikan sanitasi atau persetujuan**

[backend/internal/modules/m8/internal/domain/media.go:51](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m8/internal/domain/media.go:51) hanya menolak jika `SanitizedCopyID` dan `ApprovalID` sama-sama nil. Salah satu pointer cukup melewati guard. `ReuseMedia` di [backend/internal/modules/m8/internal/app/service.go:135](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m8/internal/app/service.go:135) kemudian membaca byte sumber dan menyalinnya, mempertahankan SHA sumber, serta memberi visibility PUBLIC dan status CLEAN. Referensi persetujuan belum dibuktikan terhadap catatan approval yang sah dalam jalur tersebut.

Salinan byte identik belum memenuhi sanitasi data pribadi. Perlu workflow salinan hasil redaksi yang benar-benar terpisah, approval server-side, pemilik/tujuan yang sah, hubungan versi sumber dan hasil sanitasi, lalu pemeriksaan ulang keamanan berkas. Uji pointer kosong/palsu, approval pengguna lain, sumber berubah, tujuan tidak sah, dan bukti file publik benar-benar berbeda bila redaksi diperlukan. AC18 harus dibuka kembali sampai bukti ini ada.

**F04 — P0. Scope organisasi hilang pada sebagian akses M8**

`actorSession` di M8 menggabungkan permission menjadi daftar umum. `GetContent`, `ListContent` dan jalur mutasinya tidak membawa himpunan organisasi yang diizinkan sampai query store. Pada [backend/internal/modules/m8/internal/store/content.go:64](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m8/internal/store/content.go:64), staf dengan akses editorial dapat membaca konten nonpublik berdasarkan boolean staf, tanpa predicate org_id pada query tersebut. Pola serupa ada pada daftar media untuk staf.

Bawa actor context dan scope organisasi ke port/service/store. Periksa hak pada organisasi objek, bukan sekadar adanya permission di salah satu membership. Pengguna editorial OPD A harus ditolak saat membaca/mengubah draft OPD B bila tidak memiliki mandat lintas-OPD. Uji detail, list, search, count, mutation dan media dengan pola yang sama. AC06 dan AC23 terdampak.

**F05 — P1. Commit penugasan lintas owner tidak konsisten saat gagal**

Di [backend/internal/modules/m3/internal/app/tickets.go:286](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m3/internal/app/tickets.go:286), M3 memanggil `Assignment.RecordAssignment` di dalam callback transaksi M3. Store M5 menulis proposal dan load projection menggunakan pool M5 sendiri, melalui dua Exec terpisah. Jika M5 sempat commit lalu M3 gagal commit, assignment/projection M5 dapat mendahului fakta tiket yang tidak jadi tersimpan.

M3 harus mengomit state tiket dan outbox atomik. M5 memperbarui projection setelah menerima event durable dengan inbox, guard source_version, dan efek yang satu transaksi pada owner M5. Proposal lintas modul sebelum commit dapat bersifat baca-saja. Buktikan crash sebelum/sesudah commit M3, lost ACK, retry dan event versi lama. AC03, AC09, AC13 dan aturan ownership terdampak.

**F06 — P1. State machine implementasi belum sesuai blueprint**

`Verify` pada [backend/internal/modules/m3/internal/store/tickets.go:182](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m3/internal/store/tickets.go:182) hanya mengubah verification menjadi VERIFIED. Blueprint mengharuskan state TRIAGED. Kategori proposed dan confirmed pada record verifikasi sama-sama diisi kategori input operator dengan confidence 1.0, sehingga provenance usulan awal kehilangan makna. Priority tersedia dalam DTO tetapi tidak tersimpan sebagai keputusan final pada jalur ini.

`Dispatch` pada baris 208 mensyaratkan version dan verification VERIFIED, tanpa membatasi state TRIAGED. Dengan versi terbaru, tiket VERIFIED pada state lain berpotensi dipindah kembali ke ASSIGNED. Penelusuran M3 juga belum menemukan implementasi alur NEEDS_INFORMATION, mulai pekerjaan secara eksplisit, atau reopen sesuai tabel lifecycle blueprint. Resolve mengizinkan ASSIGNED langsung.

Satukan guard lifecycle pada logika domain M3 dan gunakan dari HTTP, internal job, serta UI. Simpan usulan awal dan keputusan operator secara terpisah, termasuk versi classifier dan priority. Tambahkan alur minta informasi, jawab informasi, mulai, cancel dan reopen sesuai policy yang disahkan. Uji transisi sah dan terlarang pada seluruh entry point, terutama dispatch tiket RESOLVED/CLOSED, state lama, dan episode baru. AC04, AC05, AC13–AC15 terdampak.

**F07 — P1. Smart Dispatch belum memakai kemampuan proposal yang disediakan M5**

M4 saat ini adalah kamus `DICT-LAB-v1` untuk NETWORK, APPLICATION, DEVICE dan fallback MANUAL. Fondasi ini sesuai arah baseline deterministik. Namun kategori berupa kode tersebut belum selaras dengan kategori UUID yang digunakan verifikasi.

M5 menyediakan `Propose`, tetapi penelusuran pemanggilan di kode non-test tidak menemukan pemanggilan proposal M5 pada jalur dispatch. Pemilihan roster memakai `ORDER BY id LIMIT 1`. Jika skill tidak cocok, ada fallback ke teknisi apa pun di tim. `CheckRoster` juga belum memeriksa available_from, skill, atau kesesuaian tier.

Bangun mapping kategori canonical, aturan routing per layanan, roster aktif berdasarkan rentang waktu, skill/tier yang benar, dan soft balancing dari projection beban. Tampilkan alasan rekomendasi dan usia projection pada UI. Bila tidak ada kandidat yang memenuhi syarat, kembalikan penanganan manual yang terlihat. Uji skill tidak cocok, roster belum aktif/kedaluwarsa, teknisi nonaktif, L1/L2, dan dua dispatch konkuren. Evaluasi model AI eksternal menunggu dataset dan rancangan evaluasi riset tersendiri.

**F08 — P1. Due date SLA belum berasal dari policy layanan di jalur utama**

Create M3 di [backend/internal/modules/m3/internal/app/tickets.go:154](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m3/internal/app/tickets.go:154) memanggil `Calendar.Calculate(ctx, now)`. Service M6 meneruskannya ke baseline delapan jam CAL-1 tanpa libur. `CalculateDue(serviceID, priority, acceptedAt)` tersedia tetapi tidak dipakai pada jalur create tersebut. Implementasi CalculateDue juga menggunakan konstanta priority dan mengabaikan serviceID. Kegagalan pembacaan hari libur berubah menjadi kalender tanpa libur secara diam-diam.

Gunakan snapshot policy layanan untuk calendar ID, target, versi dan hari libur. Accepted_at tetap menjadi titik awal yang ditentukan blueprint, termasuk ketika priority dikonfirmasi. Catat perubahan target dengan audit dan aturan episode. Buktikan CAL-1 vs CAL-247 dari create HTTP sebenarnya, Jumat/akhir pekan/libur, pergantian priority, policy berbeda, dan kegagalan sumber kalender.

**F09 — P1. Clock projection masih berjalan setelah resolusi dan belum menegakkan pause secara utuh**

[backend/internal/modules/m6/internal/store/calendar.go:35](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m6/internal/store/calendar.go:35) menambah gross/net berdasarkan now pada setiap pembacaan, tanpa endpoint resolved_at atau state terminal dalam query. Status dibandingkan langsung dengan due_at. Akibatnya tiket yang selesai tepat waktu dapat kemudian tampil BREACHED saat dibaca setelah tenggat. Konsumsi event M6 belum mengolah PauseChanged menjadi interval kerja terpakai yang dibutuhkan projection.

Sediakan clock canonical yang berhenti pada endpoint episode, menghitung kalender kerja dan approved pauses, serta membedakan target absolut dan konsumsi waktu. Gunakan hasil yang sama pada detail tiket, dashboard, export dan eskalasi. Uji resolved sebelum/sesudah due, pause lintas akhir pekan, interval overlap, feedback/reject, reopen dan pembacaan ulang esok hari. AC08 dan AC16 terdampak.

**F10 — P1. Auto-close memiliki lease, tetapi pemulihan crash belum lengkap**

`ClaimDueJob` di [backend/internal/modules/m7/internal/store/jobs.go:27](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m7/internal/store/jobs.go:27) memilih hanya PENDING lalu menandai LEASED. Tidak ditemukan jalur reclaim untuk lease_until yang sudah lewat. `FailJob` langsung menjadikan pekerjaan DEAD_LETTER pada semua error. Pada runtime scheduler, hasil/error putaran diabaikan.

Tambahkan reclaim lease kedaluwarsa, retry untuk kegagalan sementara dengan backoff, dan klasifikasi stale version/attempt agar pembatalan sah tidak dianggap kegagalan permanen. Sediakan reason, attempt count, metrik, dan replay berizin. Buktikan proses mati setelah claim, notifikasi durable terlambat, database sementara gagal, komentar pada masa konfirmasi, reject bersamaan job, dan restart. AC14/AC15 terdampak.

**F11 — P1. Laporan berlabel SLA menghitung rasio selesai, bukan kepatuhan SLA**

`ReadScopedReport` pada [backend/internal/modules/m9/internal/store/store.go:229](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m9/internal/store/store.go:229) menghitung total diterima dan jumlah state RESOLVED/CLOSED, lalu mengembalikan `Measure: SLA`. Tidak ada perbandingan resolved_at terhadap due, pause atau policy pada penghitung itu. Watermark juga memakai waktu pembacaan, bukan posisi event yang benar-benar telah diproyeksikan.

Definisikan metrik terpisah untuk volume diterima, backlog, selesai, selesai tepat waktu, breach, gross/net serta cohort periode. Projection wajib membawa fakta waktu, policy dan watermark yang memadai. Uji data pembeda berupa tiket selesai terlambat, selesai tepat waktu, belum selesai, reopen, handoff dan projection tertinggal. UI harus menampilkan penyebut, periode, timezone, dan as-of aktual. AC08/AC23 terdampak.

**F12 — P1. Job administrasi dan health mengembalikan keberhasilan sintetis**

`RequestSystemJob` di [backend/internal/modules/m1/internal/app/operations.go:75](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/backend/internal/modules/m1/internal/app/operations.go:75) memberi SUCCEEDED secara langsung untuk jenis yang diizinkan selain purge. Jalur ini belum membuktikan eksekusi tindakan operasional. `GetRedactedHealth` di store M1 baris 169 menginisialisasi semua modul, scanner dan storage sebagai HEALTHY serta lag nol, lalu hanya melakukan Ping pada pool M1.

Job harus mengikuti state yang dapat dibuktikan, misalnya REQUESTED/APPROVED/QUEUED/RUNNING/SUCCEEDED/FAILED. Approval memerlukan identitas pemberi persetujuan yang diautentikasi, bukan sekadar UUID berbeda yang dikirim requester. Health memakai probe nyata dengan timeout dan status UNKNOWN/DEGRADED saat tidak terukur. Backup/restore harus membuktikan snapshot, checksum, manifest, replay serta pemulihan blob dan metadata. Purge tetap memerlukan keputusan retensi organisasi. AC22/AC24 terdampak.

**F13 — P0 pada gate rilis. UAT otomatis diperlakukan sebagai pengesahan manusia**

[docs/releases/M0_RELEASE_AUTHORIZATION.md:85](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/docs/releases/M0_RELEASE_AUTHORIZATION.md:85) mencantumkan pejabat/peran organisasi sebagai APPROVED/AUTHORIZED pada 7 November. Bukti yang dirujuk adalah suite Python `urllib` dengan sembilan identitas lab. Suite itu berguna sebagai pengujian skenario API, tetapi tidak membuktikan SSO ASN, pemeriksaan visual keyboard menyeluruh, atau persetujuan pejabat yang tercantum. Audit tidak menemukan lampiran sign-off manusia yang dapat diverifikasi di artefak yang diperiksa.

Jadikan dokumen itu draf rekomendasi teknis dan tandai setiap keputusan organisasi sebagai menunggu bukti pemilik wewenang. Jalankan UAT manusia dengan tugas, dataset, hasil aktual, defect, nama penguji, serta tanda tangan/tanggal yang sah. Koreksi klaim kesiapan produksi dan penutupan M0-13 sesuai bukti nyata. Keputusan ini memerlukan pemilik proses dan pejabat berwenang.

**F14 — P1. Bukti historis tidak mewakili kandidat source sekarang**

Git belum diinisialisasi. Sampel pemeriksaan seluruh hash pada completion M0-13 menemukan 10 dari 16 file tidak lagi cocok dengan snapshot. Perubahan sesudah pengujian dapat wajar, tetapi snapshot tersebut belum membuktikan kode sekarang. Fase M0-08 sampai M0-12 pada completion yang diperiksa tidak menyertakan source_hashes/file_hashes. README masih menjelaskan capaian sampai M0-04, sementara PROJECT_STATE mengklaim semua fase selesai dan masih memuat baris UAT belum dilakukan.

Tetapkan kandidat source yang stabil, simpan manifest hash atau commit aktual, petakan acceptance ke perilaku, command, hasil dan bukti, lalu jalankan affected tests pada kandidat itu. Pisahkan hasil API, browser, UAT manusia dan keputusan produksi. Selaraskan README, backlog, checkpoint, traceability dan runbook setelah hasil review disepakati.

**F15 — P1 untuk riset. Resource envelope dokumentasi berbeda dari Compose**

Runbook produksi menyatakan 4000m CPU/8192 MiB total dengan scanner 100m/256 MiB. Compose aktif memberi app 2.5 CPU/4608 MiB, db 1 CPU/2560 MiB, web 0.4 CPU/768 MiB, scanner 1 CPU/3072 MiB. Total empat layanan tetap adalah 4.9 CPU dan 11008 MiB, di luar job sementara. Dokumen otorisasi rilis juga memberi rekomendasi kapasitas yang berbeda.

Sahkan satu manifest budget dengan perlakuan overhead scanner dan gateway yang eksplisit, lalu turunkan Compose/runbook darinya. Simpan digest image, data, seed, konfigurasi dan workload. Perubahan baseline ini harus berlaku setara pada C3/F9/G-OPT kelak. Belum ada pengukuran yang membuktikan arsitektur mana paling optimal.

**F16 — P2. Basis pengetahuan masih memiliki dua sumber konten**

`knowledgeSection` di [frontend/business-pages.mjs:241](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/frontend/business-pages.mjs:241) menyediakan kartu dan template artikel tetap. [frontend/src/features/m0-03.ts:1968](C:/Datas/Proyek/Aplikasi/helpdesk-monolith/frontend/src/features/m0-03.ts:1968) kemudian mengambil maksimal 50 artikel dan mengganti isi hanya jika template slug sudah tersedia, serta mengabaikan error secara diam-diam. Artikel baru dari editor tidak otomatis menjadi kartu. Artikel yang telah diarsipkan dapat tetap memiliki template/kartu statis.

Gunakan daftar/detail M8 berizin sebagai sumber konten canonical dengan pagination server, state editorial, URL detail yang stabil dan invalidasi saat hak berubah. Cache offline harus diberi batas dan label waktu. Pertahankan layout kartu/modal PIUI sebagai consumer data. Uji publish/edit/archive/revoke pada admin lalu lihat efeknya pada publik tanpa patch HTML manual.

**F17 — P2. Hero mobile tinggi pendek memotong navigasi banner**

Pada browser 1280×720 dan 390×844 tidak ditemukan overflow horizontal halaman. Namun pada 375×667, Hero berukuran sekitar 667 px sedangkan thumbnail memiliki bottom sekitar 695 px. Screenshot memperlihatkan navigasi bawah terpotong oleh batas section. Lima banner tersedia, tetapi dua thumbnail saja tampak sekaligus pada ponsel dan discovery menggunakan scroll horizontal.

Sesuaikan tinggi ilustrasi, judul, deskripsi, tombol dan navigasi berdasarkan lebar serta tinggi layar. Pertahankan batas maksimum 100VH yang diminta pengguna dan gunakan prioritas konten yang jelas. Pastikan CTA dan kontrol prev/next/pause tidak terpotong, thumbnail aktif otomatis terlihat, serta keyboard dan reduced-motion berfungsi. Periksa satu desktop, satu mobile normal dan satu mobile pendek sebagai set representatif.

**4. Penyempurnaan tampilan dan komponen secara terurut**

| Halaman/komponen | Masalah yang ditemukan atau kebutuhan pengguna | Hasil penyempurnaan yang dituju |
|---|---|---|
| Hero | Tiga CTA besar, navigasi mobile pendek terpotong | Satu CTA primer, dua sekunder proporsional, kontrol/banner tetap terjangkau dalam 100VH |
| Copy landing | SSO disebut aktif, bagian lain menyebut pelaporan masih dalam pengembangan, CTA lama Lihat simulasi | Satu status kapabilitas berdasarkan runtime dan editorial yang disahkan |
| Branding | Logo pastel Helpdesk disebut lambang resmi Kota Depok dalam sejumlah catatan tes/status | Bedakan identitas produk Helpdesk dengan lambang pemerintah yang benar, memakai aset yang disahkan |
| Katalog | Daftar layanan ada, kebutuhan segmentasi publik/ASN dan informasi syarat harus konsisten | Filter berizin, pencarian server, syarat/dokumen/target/pemilik/kebijakan akses pada detail |
| Form laporan | Form dinamis dan dropzone tersedia | Ringkasan layanan dan target, validasi per field, status tiap upload, retry lampiran setelah tiket tersimpan, review sebelum kirim |
| Pelacakan tamu | Kunci rahasia dan tracking ada | Petunjuk penyimpanan kunci, state sesi kadaluwarsa, logout tracking, pesan tanpa kebocoran data |
| Antrean admin | Kartu tiga kolom, ID panjang, tab semua peran, navigasi publik di area kerja | Tabel operasional desktop dengan nomor ringkas, layanan, usia, priority, SLA, PIC dan next action; kartu mobile memakai data yang sama |
| Filter antrean | Filter peran tersedia, belum menjadi pusat kerja yang efisien | Default sesuai peran, filter terapkan ke API, urutan berdasarkan tugas/SLA, cursor stabil dan state URL |
| Detail tiket | Progress card dan timeline tersedia | Ringkasan status canonical, informasi pelapor berizin, aksi sesuai state/permission, catatan internal terpisah, riwayat paginated |
| Dialog dan error | Sejumlah dialog sudah tersedia | Komponen bersama untuk alasan, konfirmasi, conflict 409, retry, focus restoration dan ringkasan error |
| Dashboard | Browser masih menampilkan metrik contoh dan kanban template | KPI dari M9 dengan filter scope/periode, watermark, empty/error/loading state, kartu next action sesuai peran |
| Media picker | Dua owner tersedia, fetch dibatasi 20 pada consumer | Pagination/filter server, status scan, ACL objek, alt/license/provenance, selected state dan keyboard |
| Panduan | Kartu, featured guide, reader dialog tersedia | Sinkron editorial M8, URL detail, pembaruan nyata, metadata sumber dan tanggal yang valid |
| Footer admin | Struktur dua tingkat dan menu operasional sudah terbentuk | Pertahankan proporsi sambil menguji layar sempit, zoom, keyboard dan status offline yang benar-benar terukur |
| Sistem visual | public-ui.css sekitar 103 KB, business.css sekitar 42 KB, banyak styling inline | Konsolidasikan token typografi/spacing/warna serta komponen bersama secara bertahap, memakai sumber PIUI |
| CSP dan style | Nginx menetapkan style-src self, sedangkan template bisnis banyak memuat style inline | Pindahkan style presentasi ke CSS canonical dan uji console CSP, tanpa melemahkan kebijakan keamanan |

Gunakan aturan kanonis publik yang sudah ada untuk heading, ukuran teks, section spacing, gap, form dan tombol. Untuk admin, tetapkan pemetaan token dan komponen pada PIUI Zero yang sama, kemudian migrasikan consumer representatif lebih dulu. Hindari patch berulang pada references sebagai cara mengubah halaman produk. Perubahan pada references yang telah terjadi perlu diinventarisasi dan dilacak agar sumber asal tetap dapat dibandingkan.

**5. Penyempurnaan proses bisnis dan layanan**

Alur yang harus dibuktikan melalui entry point normal adalah pilih layanan → isi syarat/form → kirim → telaah operator → minta informasi atau tolak atau verifikasi → rekomendasi dan disposisi → mulai pekerjaan → tindakan/lampiran → resolusi → notifikasi durable → konfirmasi atau keberatan → tutup atau lanjutkan episode → reopen sesuai policy. Vendor, pause, eskalasi dan handoff tetap melekat pada episode serta PIC yang sah.

Untuk 16 entri layanan, label resmi perlu didukung pemilik layanan. Setiap entri perlu memiliki kode stabil, deskripsi cakupan, audience, organisasi pemilik, kategori, form dan versi, syarat dokumen, target respons/resolusi, kalender, routing L1/L2, SOP eskalasi, batas upload, aturan konfirmasi/reopen, serta artikel rujukan. Bedakan layanan permohonan, gangguan dan insiden darurat bila kebijakan bisnisnya berbeda. Data sintetis dan istilah institusi belum menjadi persetujuan pemilik layanan.

Konfirmasi pemohon perlu membedakan setuju, keberatan dengan alasan, dan feedback yang menahan auto-close. Bukti penerimaan notifikasi durable harus merujuk attempt aktif. Handoff perlu mempertahankan PIC asal sampai diterima, mengubah scope dengan audit, dan segera mencabut akses lama pada detail, search, lampiran, count serta export. Semua perilaku ini harus diuji bersama UI yang benar-benar dipakai.

**6. Peta penyempurnaan M1–M9**

| Modul | Fokus berikut | Bukti minimum |
|---|---|---|
| M1 Identity | F01, role/membership per objek, pemisahan lab, approval dan job nyata | Login negatif, pencabutan membership, approval berbeda aktor, job hasil aktual |
| M2 Catalog | Service policy/form canonical, segmentasi audience, konfigurasi menu | Perubahan versi saat submit, layanan nonaktif, field wajib, menu tidak memberi hak |
| M3 Intake | F05–F06, episode/attempt, alur informasi/mulai/reopen | State guard, CAS, lost response, retry dan commit rollback |
| M4 Classification | Mapping kode/UUID, kamus versioned, confidence dan override | Unknown/ambigu, usulan tersimpan utuh, audit koreksi operator |
| M5 Assignment | Proposal terintegrasi, skill/tier/time window, soft balancing | Tidak ada kandidat, roster berubah, projection lag, event duplikat/versi lama |
| M6 SLA | F08–F09, target policy, kalender dan pause | CAL-1/CAL-247, libur, resolved endpoint, pause overlap dan reopen |
| M7 Escalation | F10, lease recovery, retry dan intervensi | Crash sesudah claim, restart, timeout, stale attempt dan replay berizin |
| M8 Knowledge/media | F02–F04/F16, sanitasi publikasi, scope dan editorial | Guest/akun lain/OPD lain ditolak, sanitasi nyata, publish/archive sinkron publik |
| M9 Notify/audit | F11, outbox facts, watermark, ekspor dan binding | KPI pembeda, revocation saat download, data lintas scope, sink/retry/revoke terlihat |

**7. Urutan pelaksanaan yang disarankan**

1. **Validasi checkpoint dan gate organisasi.** Tandai temuan audit sebagai pekerjaan koreksi, bedakan hasil teknis dari UAT manusia, dan tetapkan baseline source/hash yang dapat direproduksi. Hasilnya daftar acceptance yang benar-benar terbukti serta daftar yang dibuka kembali.
2. **Perbaiki keamanan identitas, media dan scope.** Selesaikan F01–F04 dengan negative tests lintas aktor/OPD dan kontrak API. Endpoint `/auth/register` saat ini ada di runtime tetapi belum ditemukan dalam OpenAPI bisnis yang diperiksa, walaupun generator kontrak lulus. Sinkronkan kontrak dan handler sebelum menambah consumer.
3. **Pulihkan correctness workflow dan konsistensi owner.** Selesaikan F05–F07, lalu integrasikan aksi state canonical pada antrean/detail. Syarat lulus berupa commit owner yang konsisten, satu pemenang CAS, histori dan outbox yang tepat.
4. **Perbaiki SLA, scheduler, laporan dan operasi.** Selesaikan F08–F12 serta F15. Syarat lulus berupa waktu hitung benar, lease dapat pulih, KPI punya fakta sumber, job benar-benar dieksekusi, dan budget runtime cocok manifest.
5. **Seragamkan UI Publik/Admin dan editorial.** Selesaikan F16–F17, copy landing, dashboard, antrean operasional, komponen dialog/form/media, dan styling yang sesuai CSP. Periksa desktop/mobile pendek/keyboard secara representatif setelah komponen bersama stabil.
6. **Uji kandidat dan UAT manusia.** Jalankan affected integration/negative tests dan satu gate kandidat final pada source yang tercatat. Lanjutkan UAT oleh pemilik proses, operator, teknisi, ASN, pelapor dan auditor. Pengesahan rilis menunggu bukti serta wewenang manusia yang relevan.

Setiap langkah menghasilkan perubahan kecil yang dapat direview, evidence command/result, batas verifikasi dan handoff faktual. Penelitian C3/F9/G-OPT dilanjutkan melalui kontrak, dataset, dependency, konfigurasi dan resource yang sama setelah baseline M0 stabil. Angka performa atau model optimal belum ditarik dari hasil audit ini.

**8. Pemeriksaan yang benar-benar dijalankan pada audit ini**

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| `docker compose ps --format '{{.Service}} {{.State}} {{.Health}} {{.Ports}}'` | PASS, empat layanan healthy | Snapshot lokal |
| `curl.exe -fsS --max-time 5 http://127.0.0.1:18080/readyz` | PASS | Probe readiness |
| `python scripts/check_boundaries.py` | PASS, 53 package Go | Aturan statis yang tersedia, belum mendeteksi efek transaksi lintas owner F05 |
| `python scripts/build_business_contracts.py --check` | PASS | Konsistensi generator, belum membuktikan seluruh handler runtime tercakup |
| `npm.cmd --prefix frontend run typecheck` | PASS | TypeScript |
| `python scripts/test_piui_build.py` | PASS | Distribusi/build yang tersedia, tidak membuktikan seluruh state browser |
| `go test ./internal/modules/... ./internal/platform/...` dari backend | PASS | Unit test yang tersedia, package tanpa test ditandai demikian oleh Go |
| Browser lokal | Landing desktop 1280×720, mobile 390×844 dan 375×667; reader panduan; login lab; dashboard; antrean dan detail operator | Sesi operator sintetis, pembacaan data dan navigasi, tanpa submit mutasi tiket |
| Hash completion | M0-13 berbeda pada 10/16 file | Snapshot historis, bukan tuduhan perubahan tanpa izin |

Suite integrasi DB disposable, migration gate, race, dependency/image scan, backup/restore, UAT sembilan persona, load test dan uji kirim notifikasi nyata tidak dijalankan ulang pada audit ini. Klaim lama diperiksa sebagai dokumen bukti historis. Tes baru untuk kondisi gagal yang disebut pada tiap temuan diperlukan pada tugas perbaikannya.

Tidak ada pengubahan source aplikasi, backlog atau status penerimaan lama pada audit ini. Artefak baru ini dan catatan `status/evidence.jsonl` menyimpan hasil review. Prioritas rekomendasi adalah penilaian auditor berdasarkan kode dan pengamatan representatif. Cakupan ini belum merupakan review baris-per-baris seluruh repository atau sertifikasi kesiapan produksi.
