# Blueprint dan aturan pembangunan Helpdesk TIK Kota Depok

Arsitektur Monolith Modular dan panduan pengembangan dengan agent AI

Versi M0 1.0 • 3 November 2026 • Diturunkan dari blueprint produk 3.2

## 1 Tujuan dan batas paket

Bangun aplikasi Helpdesk TIK Kota Depok yang melayani publik, ASN dan petugas lintas perangkat daerah melalui satu aplikasi React dan satu proses backend Go yang tersusun atas sembilan modul. Paket ini menjadi acuan implementasi, pembagian pekerjaan, review dan pengujian untuk Codex GPT maupun Antigravity Gemini. Ukuran selesai adalah terpenuhinya kontrak dan acceptance dengan bukti aktual, kemudian UAT pemilik proses untuk penggunaan nyata.

Cakupan produk mencakup katalog, verifikasi laporan, Smart Dispatch, penugasan L1/L2, penanganan, SLA, konfirmasi 24 jam, vendor, handoff OPD, media, konten portal, notifikasi, audit, laporan dan pengelolaan sistem. Tahap awal memakai data sintetis dan notification sink. Paket ini belum berisi implementasi Go/React, migrasi executable atau OpenAPI lengkap. Agent harus membangunnya sesuai backlog. Aplikasi mikroservis, optimasi G-OPT dan eksperimen empat arsitektur berada di luar implementasi M0 ini.

Blueprint produk v3.2 disalin utuh ke references/BLUEPRINT_SUMBER_v3.2.md untuk ketertelusuran. Seluruh kebutuhan produk tetap berlaku. Profil M0 pada dokumen ini menggantikan bagian deployment multiarsitektur, bukan mengurangi fungsi. Bila ditemukan konflik yang berdampak pada security, schema atau proses bisnis, catat ADR dan keputusan pemilik proses sebelum tindakan berisiko. Riwayat sumber tidak ditulis ulang.

Naskah canonical paket adalah tiga Markdown pada docs. Dokumen Word menggabungkan ketiganya untuk dibaca manusia. AGENTS.md merangkum aturan wajib dan mengarahkan agent ke bagian yang relevan. Planning dan status membedakan spesifikasi, implementasi dan verifikasi. Setiap perubahan aturan memperbarui canonical dahulu lalu turunan Word dan traceability.

## 2 Arsitektur M0 dan pilihan teknologi

Permintaan mengalir dari browser ke gateway/TLS, kemudian router HTTP Go, handler, use case modul, domain dan repository owner. React menggunakan API relatif /api/v1. Satu executable cmd/helpdesk menjalankan kesembilan modul, worker outbox, scheduler dan consumer dalam proses yang sama. PostgreSQL, file storage, scanner, gateway dan observabilitas adalah infrastruktur pendukung yang dicatat resource-nya. Satu proses bisnis tidak berarti database dan scanner harus ditanam ke proses Go.

Panggilan sinkron antarmodul berupa method melalui port, tanpa loopback HTTP. Local adapter memvalidasi actor, input, deadline dan cancellation serta mengembalikan DTO/value yang tidak berbagi mutable pointer. Event antarmodul tetap dikirim setelah commit melalui durable outbox. Channel hanya membangunkan worker. Jika proses berhenti, event dan job tetap dapat dipulihkan dari database. Desain ini menjaga batas modul meskipun deployment tunggal.

| Lapisan | Pilihan paket | Aturan implementasi |
|---|---|---|
| Backend | Go dengan net/http dan port eksplisit | Router standard library menjadi pilihan awal; middleware terpusat untuk keamanan dan observabilitas [S29] |
| Database | PostgreSQL dan pgx | SQL terparameter, schema-qualified, sembilan role/pool; versi driver dan server dikunci saat bootstrap [S30] |
| Frontend | React TypeScript dengan Vite | Satu build dan design system bersama; Vite membangun aset frontend, bukan server bisnis kedua [S31] |
| Data antarmuka | OpenAPI 3.1 dan typed client | JSON schema, error, pagination, permission, idempotency dan examples selesai sebelum consumer |
| Storage | Adapter object/blob storage dengan quarantine | Implementasi lokal untuk lab dapat berbeda dari produksi melalui adapter yang diuji, tanpa perubahan ACL |
| Deployment | Container Linux dengan Compose untuk lab | Versi/image digest dipin; produksi melalui persetujuan dan runbook tersendiri |
| Identitas | Adapter lab dan adapter penyedia resmi | Principal sintetis di lab; issuer/audience/signature/expiry dan revocation diuji sebelum integrasi nyata |

Patch version, image digest, tool migration, library form/chart dan scanner belum dipilih dalam paket spesifikasi ini. Task M0-01 harus memilih berdasarkan kompatibilitas serta dukungan aktual, menulis ADR dan mengisi planning/technology-lock.json. Null mencegah klaim reproducible build siap; bukan alasan mengarang versi. Library tambahan memerlukan manfaat konkret dan penilaian lisensi/security. Tidak diperlukan Kubernetes, broker eksternal atau cache terdistribusi untuk fondasi M0.

## 3 Modul canonical dan kepemilikan

| ID | Modul dan schema | Tanggung jawab termasuk penyempurnaan produk |
|---|---|---|
| M1 | Identity and Access / identity | Akun, identitas eksternal, OPD, bidang, tim, membership, role, permission, session, delegasi; API clients, maintenance policy dan metadata job administrasi |
| M2 | Service Catalog / catalog | Layanan, kategori, formulir, audience, service ownership, versi policy, navigasi/fitur portal dan upload policy |
| M3 | Ticket Management / intake | Satu writer tiket, verifikasi, history, komentar, lampiran privat, capability, idempotency, resolution attempts, konfirmasi, vendor, handoff, pause, work log dan draft |
| M4 | Classification / classification | Aturan dampak/urgensi/prioritas, analisis teks, usulan kategori dan confidence, versi classifier; keputusan final ditulis M3 |
| M5 | Assignment / assignment | Routing, skill, roster, ketersediaan, proposal tim/L1/L2 dan projection beban; final assignment ditulis M3 |
| M6 | SLA Management / sla | Target respons/resolusi/tahap, kalender/libur, kalkulasi pause/due date, projection clock serta definisi SLO |
| M7 | Escalation / escalation | Aturan eskalasi fungsional/hierarkis, scheduler, reminder, vendor follow-up dan auto-close melalui command ke M3 |
| M8 | Knowledge Base / knowledge | Artikel, revisi, taksonomi, halaman portal, draft konten, media editorial, metadata SEO serta publikasi |
| M9 | Notification and Audit / notify_audit | Pusat notifikasi, delivery/sink/Telegram, audit append-only, report facts, export jobs dan agregat pengunjung |

Menu bukan owner data. Dasbor memakai projection M9 dan query berizin ke owner. Pustaka Media menampilkan tab M3 dan M8, dengan pagination/count per owner. Pengelolaan portal memisahkan struktur navigasi M2 dari isi editorial M8. Pengelolaan sistem memanggil port yang sesuai; runner backup tidak mendapat jalur shell arbitrer dari browser. M9 memisahkan queue notification, audit dan report agar kegagalan satu jenis pekerjaan tidak menghambat semua consumer.

M1 dan M8 mendapat perluasan subkemampuan sebagai kompromi desain produk. M3 berpotensi menjadi hotspot karena menjaga invariants tiket, dan M9 mempunyai kohesi lebih rendah. Catat batas tersebut dalam ADR. Jangan memecah modul baru atau menghapus guard demi throughput. ID dan schema dipertahankan agar M0 dapat dibandingkan secara sah dengan model penelitian lain kelak.

## 4 Struktur repository dan kontrak internal

| Direktori implementasi yang harus dibuat | Fungsi dan batas |
|---|---|
| backend/cmd/helpdesk | Main executable, config, boot dan graceful shutdown |
| backend/internal/bootstrap | Composition root yang membangun sembilan modul dan menghubungkan port |
| backend/internal/modules/mN/api | Interface port, request/response DTO dan error public untuk owner N |
| backend/internal/modules/mN/internal/domain | Entity, value object, invariants dan pure policy owner |
| backend/internal/modules/mN/internal/app | Use case, authorization dan transaksi aplikasi owner |
| backend/internal/modules/mN/internal/store | SQL dan repository owner; hanya menerima pool/kredensial owner |
| backend/internal/modules/mN/module.go | Factory publik modul yang diekspor ke composition root |
| backend/internal/platform | Clock, ID, telemetry, config, storage interface dan helper transaksi tanpa aturan bisnis |
| contracts/openapi dan contracts/events | Kontrak API eksternal dan envelope/schema event berversi |
| migrations/mN dan seeds | Migrasi schema owner dan data sintetis deterministik |
| frontend/src/features | Fitur berdasarkan pekerjaan pengguna dengan typed API client |
| frontend/src/components dan frontend/src/styles | Design system canonical, tokens, komponen aksesibel |
| tests/contract dan tests/e2e | Kontrak API, permission, lifecycle serta alur browser representatif |
| infra dan runbooks | Konfigurasi lokal/staging, backup/restore dan operasi yang telah disetujui |

Nama direktori di atas adalah target, bukan klaim bahwa file sudah tersedia. Go internal pada subtree mN/internal membatasi impor sibling ke implementasi privat. Modul boleh mengimpor api modul lain, tetapi api tidak boleh menarik domain/store privat atau membentuk siklus DTO. Jangan menaruh seluruh data struct bisnis pada shared package. Composition root adalah satu-satunya tempat yang mengetahui implementasi seluruh modul.

Kontrak M2 menyediakan snapshot layanan/form/audience; M4 menyediakan classification proposal; M5 assignment proposal; M6 SLA calculation; M3 commands/query tiket; M8 knowledge/media query; M9 query notifikasi/laporan. M7 hanya memanggil command M3 untuk perubahan tiket. M3 tidak menunggu consumer M9 untuk commit tiket. M1 menyediakan actor/policy data; library otorisasi yang sama dipakai setiap use case. Tabel dependency allowlist di contracts/dependencies.json diuji saat boundary gate.

Context berisi actor yang diverifikasi, correlation ID, deadline dan cancellation. ID dari browser bukan authority. Query membutuhkan scope dan projection freshness bila relevan. Command memerlukan idempotency key dan expected_version kecuali create yang belum memiliki aggregate version. Domain tidak membaca environment, jam global atau jaringan langsung; dependency clock/ID/adapters disuntikkan agar tes repeatable.

## 5 Akses pengguna dan pemisahan organisasi

Layanan memiliki access_mode PUBLIC_GUEST, PUBLIC_AUTH, ASN_AUTH atau STAFF_ONLY. Kebijakan audience serta scope diterapkan di server. Publik login melihat tiketnya sendiri, ASN mengikuti membership/permission yang sah, dan staf hanya antrean/tiket sesuai delegasi. Identitas ASN tidak ditentukan dari domain email atau flag klien. Admin konfigurasi tidak otomatis membaca isi tiket. Pimpinan mendapat agregat dan detail sesuai permission terpisah.

Guest memakai capability acak minimal 256 bit yang disiapkan klien melalui Web Crypto sebelum create; server menyimpan hash, scope, expiry dan revocation. Secret tidak masuk URL, log, telemetry, draft biasa atau analytics. Kirim melalui header sensitif yang disensor, lalu tukar melalui POST ke sesi pelacakan singkat. Nomor tiket bukan secret. Replay create memeriksa binding capability dan idempotency, bukan hanya key. Kontak tambahan mengikuti policy layanan. Token hilang tidak dipulihkan dengan tebakan nama/NIK.

| Peran | Tugas utama | Pembatasan |
|---|---|---|
| Pemohon dan tamu | Buat, lacak, lengkapi, konfirmasi dan feedback tiket sendiri | Internal notes dan tiket orang lain tertutup |
| Operator | Verifikasi, klarifikasi, triage, disposisi | Scope antrean; tidak mengelola role atau purge |
| Teknisi L1 dan L2 | Diagnosis, work log, penanganan, resolve, eskalasi/vendor | Tidak final close atas nama pemohon atau mengubah policy SLA |
| Koordinator | Reassign, persetujuan pause, prioritas dan handoff | Reason dan audit wajib; tanpa reset waktu historis |
| Kepala Bidang dan Kepala PD | Monitoring dan intervensi sesuai mandat | Jabatan tidak memberikan akses lintas OPD tanpa binding |
| Admin OPD dan platform | Master, konfigurasi dan membership sesuai grant ceiling | Tidak dapat memberi hak melebihi mandat sendiri |
| Super Admin | Konfigurasi tinggi dan permintaan purge terkendali | Retensi, hold, dependency dan approval pihak berbeda tetap berlaku |
| Editor dan publisher | Draft, review dan publikasi konten | Data tiket untuk publikasi perlu sanitasi dan izin |
| Auditor | Audit dan laporan sesuai penugasan | Read-only; tidak mengubah evidence |
| Vendor | Paket kasus yang dibagikan, bila portal vendor diaktifkan | Default koordinasi oleh PIC internal; tidak melihat antrean OPD |

Permission dievaluasi pada detail/list/count/search/download/export dan job result. Untuk objek tak terlihat gunakan 404 seragam, sedangkan tindakan dilarang pada objek yang boleh dilihat menggunakan 403. Filter scope mendahului aggregation/pagination. Membership dicabut harus berlaku pada request baru termasuk file link lama. Cache revocation perlu jendela yang disahkan; untuk fixture sensitif gunakan otoritas langsung. Cookie Secure/HttpOnly/SameSite, CSRF, CORS allowlist dan session revocation diuji sesuai mekanisme login.

## 6 Lifecycle verifikasi dispatch dan penanganan

| Dari | Tindakan | Hasil | Guard utama |
|---|---|---|---|
| Belum ada | Create | OPEN dan PENDING verification | Layanan aktif, audience/form sah, idempotency/capability |
| OPEN | Verify dan triage | TRIAGED dan VERIFIED | Operator berizin, kategori/prioritas final, alasan override |
| OPEN atau TRIAGED | Minta informasi | NEEDS_INFORMATION | Alasan dan aturan pause eksplisit |
| NEEDS_INFORMATION | Lengkapi informasi | OPEN | Pemohon/petugas sah; perlu verifikasi ulang bila fakta berubah |
| TRIAGED | Dispatch | ASSIGNED | VERIFIED, proposal M5 dan team/assignee sah |
| ASSIGNED | Mulai | IN_PROGRESS | Assignee/delegate aktif, timestamp dan audit |
| IN_PROGRESS | Selesai ditangani | RESOLVED | Resolution attempt, catatan/bukti dan deadline konfirmasi |
| RESOLVED | Konfirmasi atau auto-close | CLOSED | Pemohon sah atau job guarded 24 jam |
| RESOLVED | Tolak hasil | IN_PROGRESS atau TRIAGED | Attempt aktif, episode awal berlanjut |
| CLOSED | Reopen | OPEN | Window dan alasan sesuai policy; episode baru terhubung |
| OPEN atau TRIAGED atau NEEDS_INFORMATION | Cancel atau tolak laporan | CANCELLED | Reason dan authority; tidak menghapus histori |

Reassign menaikkan version dan mengikuti izin, tanpa memulai ulang SLA. Eskalasi adalah mark/event dengan level, rule dan episode, bukan status yang menghapus lifecycle. Dua penugasan bersamaan pada version sama menghasilkan satu commit dan satu 409. Permintaan informasi saat pekerjaan berjalan, jika diperlukan layanan, harus menambah transisi dan return_state eksplisit melalui ADR serta fixture; jangan menyisipkan state bebas di frontend.

Smart Dispatch dimulai setelah verifikasi. Saran awal M4 saat create belum mengesahkan kategori atau assignment. Operator memeriksa kelengkapan, duplikasi, ruang lingkup serta dampak. M3 menyimpan proposed_category, confirmed_category, confidence, explanation, classifier_version, verified_by/at dan evidence digest. M5 menilai routing, skill, roster dan beban projection untuk mengusulkan pelaksana. Projection beban mendukung soft balancing, bukan hard capacity reservation.

Baseline classifier memakai aturan/kamus deterministik dan normalisasi bahasa. NLP untuk kalimat/paragraf dievaluasi terpisah dengan label manusia, precision/recall per kategori, macro-F1, kalibrasi dan koreksi operator. Low confidence atau kategori tak dikenal kembali ke manual. Input laporan tidak dapat menjalankan tool atau memperluas permission. Model eksternal tidak diaktifkan tanpa evaluasi privasi, biaya dan nondeterminisme; tidak diperlukan untuk membuktikan fondasi M0.

## 7 SLA konfirmasi dan penanganan vendor

SLA layanan, target tahap internal dan SLO sistem dicatat terpisah. accepted_at ditetapkan server M3 pada create dan tersimpan hanya bila transaksi berhasil; ini bukan klaim timestamp commit presisi. Respons manusia pertama berbeda dari tanda terima otomatis. Catat verifikasi, dispatch, mulai kerja, resolve, confirmation dan close. Waktu tersimpan UTC dan ditampilkan WIB. Kalender kerja/libur berversi menentukan due dates. Reclassification dan handoff menghitung ulang dari accepted_at dengan pause sah, tanpa reset jam.

Teknisi menekan “Selesai ditangani”. M3 menyimpan resolution attempt dan confirmation_due_at=resolved_at+24 jam kalender. Pemohon melihat pilihan setuju atau belum selesai serta waktu batas. Persetujuan menghasilkan CLOSED/REQUESTER_CONFIRMED. Tanpa feedback setelah batas, M7 mengirim command auto-close memakai ticket_id, attempt_id, key deterministik dan expected_version. M3 memeriksa RESOLVED, upaya masih aktif, deadline tercapai, tidak ada feedback, serta bukti pemberitahuan dalam aplikasi telah durable. Closure reason AUTO_NO_RESPONSE tidak disebut persetujuan eksplisit.

Telegram gagal tidak membuktikan pesan telah dibaca dan tidak menghapus pemberitahuan dalam aplikasi. Jika pemberitahuan dalam aplikasi belum durable, auto-close ditahan dan pemulihan dilaporkan. Feedback biasa menandai REVIEW_REQUIRED. Reject dalam window mengembalikan IN_PROGRESS bila assignee masih sah, atau TRIAGED. Episode awal berlanjut; rekomendasi default memasukkan waktu konfirmasi upaya yang ditolak ke durasi layanan. Setelah upaya diterima, endpoint penyelesaian adalah resolved_at upaya itu, bukan closed_at 24 jam kemudian. Reopen setelah CLOSED membuat episode terhubung menurut policy.

Fixture konfirmasi memakai resolve Senin 10.00, batas Selasa 10.00 walaupun libur; terima Senin 14.00 tetap memakai endpoint penyelesaian Senin 10.00. Reject Selasa 09.59 menahan job lama; resolve baru Rabu 11.00 menghasilkan batas Kamis 11.00. Balapan reject/auto-close ditentukan commit yang sah dan CAS. Feedback yang sudah committed sebelum job wajib mencegah close.

Fixture jam kerja CAL-1 memakai Senin–Jumat 08.00–16.00 WIB. Tiket Jumat 15.30 dengan target dua jam kerja jatuh tempo Senin 09.30; bila Senin libur, Selasa 09.30. Pada kasus pause terpisah, pause Jumat 15.45 dan resume Senin 10.00 menyisakan 105 menit sehingga jatuh tempo 11.45. Interval kerja [08.00,16.00) diuji pada batas tepat, akhir pekan, libur dan episode reopen.

Vendor tetap mempunyai PIC internal. M3 menyimpan vendor, nomor kasus, rujukan garansi/kontrak, bukti serah terima, acknowledgement, expected_return_at dan next_followup_at. IN_PROGRESS dapat memiliki work_state WAITING_VENDOR. Pause tidak otomatis: perlu policy, approval, alasan dan batas akhir. Gross elapsed, net service dan vendor wait ditampilkan terpisah; overlap pause dihitung sekali. M7 memantau tindak lanjut lalu mengeskalasi ke L2/koordinator/pimpinan. Teknisi internal memeriksa hasil vendor sebelum resolve. Pengadaan/pembayaran berada di luar aplikasi.

Handoff OPD memisahkan requester_org_id, service_owner_org_id dan handling_team_id. Tim asal tetap bertanggung jawab sampai tim tujuan menerima; M3 mengomit perpindahan secara atomik. Delegasi lama dicabut atau diberi masa berlaku eksplisit. Snapshot organisasi menjaga histori saat mutasi pegawai. Intervensi pimpinan berupa command beralasan dan diaudit, tanpa edit timestamp untuk memperbaiki kinerja.

## 8 Data transaksi dan pemulihan

Satu PostgreSQL memiliki schema identity, catalog, intake, classification, assignment, sla, escalation, knowledge dan notify_audit. Setiap owner memakai kredensial least-privilege dan pool sendiri. Baseline maksimum empat koneksi per owner atau 36 total, dengan koneksi migrasi/exporter terpisah. Role migrator tidak dipakai runtime. Schema-qualified SQL, search_path aman dan pencabutan public CREATE diterapkan [S18]. Cross-owner reference memakai UUID serta snapshot versi; FK hanya dalam owner.

Entitas inti M3 mencakup tickets, ticket_versions, comments, attachments, guest_capabilities, idempotency_records, operations, ticket_verifications, resolution_attempts, confirmation_events, work_logs, vendor_cases, handoff_requests, pause_intervals, drafts dan escalation_marks. Validasi requester_kind/requester_id, uniqueness nomor tiket, version monoton, state, ownership dan hubungan upaya aktif dilakukan melalui constraint serta use case. Draft/reference aset menjaga keterkaitan sebelum tiket dipublikasikan.

Create mengambil snapshot M2, proposal M4 dan kalkulasi M6 sebelum transaksi. M3 mengomit tiket, history, hasil idempotency dan outbox dalam satu transaksi. Respons 201 menjamin efek utama durable, bukan semua notifikasi terkirim. Idempotency unique key memakai actor scope, action, target dan key; payload hash adalah atribut pembanding. Key sama dengan intent berbeda menghasilkan 409. Lost response setelah commit direkonsiliasi dengan replay sah, bukan create baru [S21].

Jangan menahan row lock selama panggilan dependency. Proposal dihitung terhadap snapshot berversi, lalu syarat dan authorization diperiksa saat commit. CAS memakai WHERE id dan version dengan affected-row check. Domain history tidak dihapus untuk rollback bisnis; kompensasi menjadi aksi baru. READ COMMITTED serta kondisi update yang tepat menjadi baseline [S22]. Migrasi yang mengubah invariants harus membawa fixture valid/invalid dan uji role DB.

Outbox berada pada setiap owner yang menerbitkan event [S08]. Tabel outbox_delivery menyimpan event_id, consumer_id, state, attempts, lease_until dan acked_at. Producer baru menandai seluruh delivery selesai setelah semua target wajib ACK. Consumer menyimpan inbox dan perubahan projection dalam transaksi lokal sebelum ACK. Crash sesudah commit atau ACK hilang menyebabkan replay yang aman. At-least-once transport tidak diklaim exactly-once jaringan. Retention tidak menghapus event/inbox selama replay horizon.

Envelope memuat event_id, producer, event_type, schema_version, aggregate_id, aggregate_version atau stream_sequence, occurred_at, correlation dan payload minimum. Consumer delta berurutan harus menerima stream rapat; subscriber sebagian tipe memakai sequence sendiri atau snapshot monoton. Gap ditunda/direkonsiliasi dengan alert. Duplicate ID berbeda digest merupakan error integritas. Lease dan clock injectable memungkinkan uji restart tanpa tidur berjam-jam.

Blob dan metadata tidak berada dalam satu transaksi. Upload masuk quarantine, metadata PENDING, lalu scan/checksum mengizinkan CLEAN. Download memeriksa status, owner, visibility dan izin saat request. Orphan dibersihkan setelah grace period dan pemeriksaan referensi. Metadata ada tetapi blob hilang ditampilkan sebagai kegagalan. Backup harus menyertakan manifest blob yang konsisten dengan metadata.

## 9 API dan antarmuka pengguna

Base API /api/v1, JSON envelope error berisi code, message, correlation_id dan details aman. Gunakan 400 syntax, 401 authentication, 403 action, 404 objek tak terlihat, 409 conflict, 422 bisnis, 429 quota dan 503 dependency. Error tidak memuat SQL/stack/secret. Tulis melalui Idempotency-Key dan expected_version sesuai aggregate. Pagination server-side dengan limit maksimum usulan 100, sort allowlist dan cursor stabil. Export besar berupa job.

| Kelompok endpoint | Operasi minimum | Owner |
|---|---|---|
| /auth dan /catalog/services | Session, logout, guest session, layanan/form berizin | M1 dan M2 |
| /tickets dan /tickets/{id} | Create, scoped list/detail | M3 |
| /tickets/{id}/verify dan /dispatch | Verifikasi, kategori final, assignment | M3 melalui M4/M5 |
| /tickets/{id}/transitions | Start, klarifikasi, resume, cancel, reopen dan alias resolve/close yang sah | M3 |
| /tickets/{id}/resolution-attempts dan /confirmation | Resolve, accept, reject, feedback | M3 |
| /tickets/{id}/comments dan /attachments | Publik/internal, upload/download berizin | M3 |
| /tickets/{id}/vendor-cases dan /handoffs | Koordinasi vendor, permintaan/penerimaan transfer | M3 |
| /tickets/{id}/escalations dan /operations/{id} | POST 202 dengan operation ID dan polling scope | M3/M7 |
| /guest/tracking-session | Tukar capability via POST | M3 dengan session terbatas |
| /knowledge/articles dan /portal/pages | Draft/review/publish/archive serta read audience | M8 |
| /media dan /drafts | Query/update sesuai owner yang di-allowlist | M3 atau M8 |
| /notifications dan /reports | Inbox, summary, export 202 dan download berizin | M9 |
| /admin dan /health | Master per owner, operasi sistem allowlist, live/ready teredaksi | Owner masing-masing dan platform |

Nama path baru di tabel merupakan target kontrak M0-02. OpenAPI harus merinci method, payload, error, permissions, version serta contoh; tabel tidak menggantikan schema executable. Alias triage/verify, assign/dispatch dan transitions/resolve wajib memanggil command yang sama. Teknisi tidak boleh menggunakan alias close untuk melewati konfirmasi. Endpoint 202 selalu async secara kontrak, tidak dipilih karena proses sedang lambat.

Portal publik memiliki Beranda, Layanan, Buat laporan, Lacak, Pusat bantuan dan status layanan yang sudah dipublikasikan. Workspace pemohon memiliki tiket/draft/notifikasi/profil. Operator mengelola verifikasi dan disposisi. Teknisi melihat tugas, vendor, resolusi dan kinerjanya. Koordinator/pimpinan melihat SLA, backlog dan intervensi sesuai scope. Admin mengelola master serta sistem; editor mengelola portal/media; auditor mengakses bukti read-only.

Halaman tiket menampilkan status, tindakan berikut, PIC, deadline dan waktu refresh sebelum kronologi. Public history dan internal notes tidak digabung di response lalu disembunyikan CSS. Frontend memiliki loading/empty/error/forbidden/expired/pending/conflict state. Sesudah timeout, retry memakai key sama. Sesudah 409, pengguna meninjau perubahan. Jangan mengklaim selesai dari optimistic UI sebelum server mengonfirmasi commit.

## 10 Komponen konten media dan draft

| Komponen | Perilaku wajib |
|---|---|
| Data table | Pagination, sort, search, page size, filter dan export server-side; bulk jelas per halaman/seluruh filter, izin/version per objek dan partial failure |
| Grafik | Tooltip, drill-down filter yang sama, ringkasan teks dan tabel setara; keyboard tidak bergantung hover |
| Kartu dan media | Kartu simetris, bento ringkasan dan masonry opsional dengan urutan DOM bermakna |
| Accordion | Maksimal satu panel terbuka per grup; error membuka panel terkait dan aria-expanded benar |
| Combo box | Search, keyboard, multi-select bila diperlukan, clear/loading/empty; kemampuan seperti Select2 dalam komponen React canonical |
| Toast dan scrollbar | Feedback aksi yang aksesibel, error tetap dekat field; autosave indikator tenang, scrollbar tipis tetap operabel |
| Editor | Blok semantik, undo, preview, versi, alt text; sanitasi server untuk paste dan rich text |
| Dropzone | Pilih file via tombol/keyboard, progress, cancel/retry, limit dan scan status |
| Modal | Tengah/fullscreen, backdrop, focus trap/return, Escape; background scroll terkunci dan isi panjang tetap scroll [S26] |
| Form | Label, bantuan, error summary, validasi client/server, review, draft recovery dan kontrol konflik |

Klik luar menutup modal baca-saja; form harus memastikan draft aman atau menawarkan simpan/buang/batal. Klik backdrop tidak menyetujui tindakan irreversible. Gunakan tokens typography, spacing, warna, status, breakpoint dan focus yang sama. Aksesibilitas dan responsive diuji representatif desktop/mobile serta keyboard. Apex/Select2 pada kebutuhan sumber diterjemahkan menjadi kemampuan, bukan kewajiban menambah library yang bertentangan dengan React.

Draft akun berada di owner konteks dengan principal, form_version, revision, updated_at dan expiry. Autosave setelah jeda input dan saat penutupan terkontrol. Konflik tab menggunakan revision, tidak last-write-wins diam-diam. Draft lokal offline hanya field yang diizinkan; credential/capability/file sensitif dilarang di localStorage. Perangkat bersama memakai server draft dengan peringatan batas offline. Guest memilih local persistence dengan informasi risiko. Logout/pergantian akun membersihkan cache terkait. Final submit memvalidasi ulang policy dan tidak otomatis terjadi ketika jaringan kembali.

Pustaka Media terpadu membedakan media tiket M3 dan editorial M8. Unggah langsung melalui form juga muncul di pustaka dengan ACL owner. Reuse mensyaratkan permission serta audience kompatibel; lampiran privat untuk artikel publik memerlukan salinan tersanitasi, approval dan provenance. Metadata memuat label, alt/caption, pemilik, sumber/lisensi, checksum, dimensi, tipe/ukuran, audience dan referensi pemakaian. SEO hanya pada publikasi yang sah. Unggah menguji ekstensi, MIME/signature, batas, nama acak dan quarantine [S25]. Video publik memiliki poster/caption dan job berat dicatat resource-nya.

M2 mengelola fitur terdaftar, menu/urutan/route/audience; M8 mengelola halaman/bagian/konten dengan DRAFT, REVIEW, PUBLISHED dan ARCHIVED. Menu tidak memberi permission. Preview dan rollback versi berizin, tanpa HTML/JavaScript bebas. Pencarian global bertab Layanan, Tiket, Artikel dan Media menerapkan scope sebelum snippet, suggestion, count dan pagination. Query per owner memakai debounce dan pembatalan query stale. Indeks publik tidak berisi konten privat.

## 11 Notifikasi laporan dan administrasi

Pusat Notifikasi M9 mempunyai read/unread, filter, preferensi kanal, prioritas, template version dan delivery status. Stored, provider accepted dan user read berbeda. Telegram mengirim ke chat_id, sehingga pengguna/grup harus dihubungkan dan diverifikasi sesuai scope [S24]. Payload minimum, tanpa capability/PII/internal notes. Rahasia bot di secret store. Retry/backoff/dead-letter, dedup event/penerima dan rate limit diuji dengan sink deterministik; timeout provider masih dapat menyebabkan duplikasi eksternal.

Dasbor pemohon menunjukkan tindakan tertunda. Operator melihat usia antrean dan verifikasi. Teknisi melihat prioritas, backlog, waktu aktif, vendor wait dan reopen. Pimpinan melihat kepatuhan SLA dan hambatan keputusan. Semua laporan menampilkan periode, timezone, filter, denominator, as_of/watermark serta policy version. Cohort tiket terbuka yang sudah breach tidak disembunyikan. Jangan merangking teknisi dari jumlah selesai saja. Statistik page views/sesi dengan aturan bot/retensi tidak disebut jumlah warga unik.

Ekspor M9 adalah job terikat filter/scope snapshot dan TTL. Izin diperiksa lagi saat download; sanitasi formula CSV, masking kolom sensitif dan audit diterapkan. Pengunjung tidak membaca audit operasional. Audit mencatat actor, action, object, scope, reason, outcome dan correlation tanpa credential. Intent utama durable pada owner dan dikumpulkan M9 append-only.

Pengarsipan menyimpan actor/time/reason dan mempertahankan histori. Master yang direferensikan di-inactive. Non Super Admin tidak boleh purge. Super Admin hanya meminta purge melalui retensi, hold, dependency check dan persetujuan terpisah; fitur disabled sampai policy lengkap. Pemulihan arsip mengecek konflik kode dan referensi. Audit tidak dihapus melalui CRUD umum.

Maintenance M1 menyimpan scope, jadwal, pesan dan aturan read-only/drain. API clients/scopes serta referensi credential dikelola tanpa menampilkan secret lama. Health admin menampilkan status teredaksi, storage dan lag. Backup/restore memakai runner operasional berizin dengan request allowlist; aplikasi tidak mendapat superuser DB, Docker socket atau shell bebas. Restore hanya pada target eksplisit yang diotorisasi dan diuji terisolasi. RPO/RTO, retensi dan mandat organisasi ditetapkan sebelum operasi nyata.

## 12 Runtime deployment dan operasi M0

Composition root memuat config, memvalidasi manifest M0, menyiapkan sembilan pool, adapter dan modul, lalu router/worker. Migrasi dijalankan job terpisah sebelum startup, bukan otomatis oleh setiap restart aplikasi. Readiness gagal bila versi schema wajib tidak cocok. Liveness hanya membuktikan proses hidup. Kredensial/config invalid membuat startup fail dengan pesan aman. Shutdown menghentikan penerimaan baru, menyelesaikan request sesuai deadline, menghentikan worker secara kooperatif dan menutup pool; pekerjaan durable yang belum ACK diproses setelah restart.

Baseline lab sumber memberi aplikasi 2500m CPU/4608 MiB, DB 1000m/2560 MiB, gateway/static 400m/768 MiB dan exporter 100m/256 MiB, total 4000m/8192 MiB. Ini starting point pilot, bukan ukuran server produksi. Scanner/storage/collector/runner tambahan wajib diinventarisasi dan diberi budget sebelum klaim kapasitas. OS headroom dan generator berada di luar envelope yang dinyatakan. M0 memakai seluruh credit aplikasi bersama; tidak membuat limit per modul yang meniru sembilan proses.

Worker concurrency, queue capacity, retry, pool dan request/body/time limits eksplisit dan bounded. GOMAXPROCS policy disahkan serta actual dicatat. Telemetry memuat request latency/error, DB waits/pool, queue lag, scheduler lateness, outbox retry, disk, throttling dan projection freshness. Label metrik tidak berisi ticket ID/PII dengan kardinalitas tak terbatas. Trace menghubungkan request dengan event tanpa membocorkan payload rahasia.

Container non-root, filesystem read-only bila kompatibel, network internal DB, secret di luar Git, TLS dan trusted proxy allowlist menjadi target. Tidak menggunakan credential lab pada produksi. Data sintetis seeded deterministik tersedia untuk guest/public/ASN/operator/L1/L2/pimpinan/vendor; integrasi nyata selalu disabled secara default. Backup/restore drill, incident response, rollback dan UAT adalah gate tersendiri sebelum produksi.

## 13 Kriteria penerimaan dan tahapan pembangunan

Acceptance AC01–AC25 dari produk dipetakan ke M0 pada contracts/acceptance.csv. AC01 memastikan manifest berisi M1–M9 tepat sekali dalam satu grup. AC02/AC09/AC10/AC25 menguji kontrak, ownership, resource dan kelengkapan M0 sekarang; perbandingan runtime empat model tetap DEFERRED_RESEARCH, tidak diberi PASS karena hanya M0 yang diuji. AC12 pada paket ini menguji provenance/status bukti; pemilihan G-OPT dan HELD_OUT tetap di luar scope.

Bukti fungsional minimum meliputi alur guest, publik login, ASN dan petugas, penolakan lintas user/OPD, verifikasi sebelum dispatch, CAS assignment, commit lost response, outbox replay, ACL media, draft recovery, kalender, konfirmasi 24 jam, vendor pause, handoff, pencabutan akses, archive/purge guard serta konfigurasi portal. UI menampilkan hasil API dan persistence nyata untuk setiap fitur yang dinyatakan selesai.

| Tahap | Hasil yang harus tersedia | Gate |
|---|---|---|
| M0-01 Fondasi | Stack dipin, ADR, structure, config, design tokens dan command registry | Build kosong terstruktur dan boundary policy, tanpa klaim fitur |
| M0-02 Kontrak | OpenAPI, event schemas, DDL per owner, permission/state fixtures | Kontrak valid dan migration role checks |
| M0-03 Identitas katalog | Session lab, scope, master/form/audience | Negative access lintas role dan UI katalog |
| M0-04 Tiket | Create/track/list/comment/media dasar, idempotency/outbox | Transaksi, replay, ACL dan persistence |
| M0-05 Verifikasi dispatch | Operator, M4/M5, L1/L2 dan CAS | VERIFIED guard dan konkurensi |
| M0-06 SLA resolusi | M6/M7, kalender, resolve/reject/auto-close | Clock fixtures serta race attempt/version |
| M0-07 Vendor OPD | PIC/vendor/pause, eskalasi pimpinan dan handoff | Gross/net serta scope/delegasi |
| M0-08 Media draft | Pustaka dua owner, reuse, recovery, scan | Upload negatif, conflict dan akun berganti |
| M0-09 Portal | Editor, revisi, publish, navigation dan search | Sanitasi, audience dan ACL snippet/count |
| M0-10 Notifikasi laporan | Pusat notifikasi/sink, binding Telegram, dashboard/export/audit | Retry, scope, freshness dan report denominator |
| M0-11 Sistem operasi | Maintenance, archive/purge guards, runner contract, backup drill lab | Permission dan restore terisolasi |
| M0-12 Integrasi | Semua fitur, alur UI, startup/shutdown dan observabilitas | Kandidat final, security/recovery gates dan evidence |
| M0-13 UAT | Review pemilik proses, keputusan domain dan dokumentasi operasi | UAT serta otorisasi rilis terpisah dari build |

Urutan ini tidak mengharuskan setiap kemampuan selesai sekaligus sebelum feedback pengguna. Satu feature slice mencakup kontrak, backend, persistence, UI, error states dan tes terdekat. Stub dependency boleh dipakai selama pengembangan dengan status jelas, tetapi tidak lolos acceptance final. Backlog mempunyai dependency, owner capability, acceptance dan bukti; semua task aplikasi pada paket awal berstatus NOT_STARTED.

## 14 Keputusan terbuka dan hubungan dengan penelitian

Katalog resmi, provider identitas, verifikasi kontak guest, scope pimpinan, kalender/target tahap, pause vendor, reopen, retensi/purge, batas upload, Telegram binding organisasi, RPO/RTO dan ukuran server masih memerlukan pemilik keputusan. planning/decisions.csv mencatat default lab, owner, gate dan status. Agent boleh membangun fixture sintetis serta adapter tanpa menunggu keputusan produksi, tetapi tidak menganggap fixture sebagai kebijakan Pemerintah Kota Depok.

M0 tetap baseline yang sah untuk penelitian. Jangan menyisipkan delay, query buruk atau tambahan panggilan hanya untuk menunjukkan keuntungan microservices. Jangan pula membuat JOIN lintas owner atau special business fast path yang merusak kesetaraan kontrak. Optimasi lokal yang sah dicatat serta harus ditinjau untuk penerapan setara pada studi lanjutan. Paket ini tidak menghasilkan benchmark, novelty empiris atau klaim kesiapan produksi.
