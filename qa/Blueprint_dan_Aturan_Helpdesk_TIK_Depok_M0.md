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


## 15 Aturan pembangunan yang wajib ditegakkan

Gunakan bahasa Indonesia untuk UI dan komunikasi. Identifier, schema, permission, status dan API memakai nama English canonical. Requirement berasal dari blueprint M0 dan seluruh kemampuan produk v3.2. Bedakan aturan wajib, usulan teknis dan keputusan organisasi terbuka. Konflik yang mengubah ownership, transaksi, permission atau kontrak harus memiliki ADR serta otorisasi sesuai risikonya. Keputusan teknis kecil yang reversibel cukup dicatat dan dikerjakan tanpa menghentikan tugas.

### Backend dan batas modul

Handler hanya melakukan parsing, validasi bentuk, mengambil principal tepercaya, memanggil use case dan memetakan error. Aturan bisnis serta authorization objek berada pada use case/domain sehingga pemanggilan lokal dan worker tidak membypass guard. Store hanya menjalankan query owner. Jangan menulis SQL di handler atau React. Dependency flow dari bootstrap ke factory, app ke domain/port, dan store mengimplementasikan port repository. Domain tidak bergantung pada framework HTTP/driver.

Terapkan pemeriksaan import yang membaca package Go setelah bootstrap. Tolak impor sibling internal/domain/store dan siklus. contracts/dependencies.json mengatur dependency sinkron bisnis. Event subscription diatur terpisah; jangan menambahkan edge sinkron balik hanya untuk menunggu projection. Sebagai contoh, M3 memakai M2/M4/M5/M6 public ports; M7 memakai M3 command port; M5/M6/M9 menerima event M3 secara asinkron. Auth context disediakan platform/M1 tanpa roundtrip jaringan atau import store identitas.

Repository constructor menerima pool khusus owner, bukan satu superuser pool yang dipakai sembilan modul. Query literal maupun query builder tidak boleh mengakses schema owner lain. Verifikasi melalui role DB dan negative integration tests, bukan hanya regex SQL. Migrator mempunyai role administratif terpisah. Helpers transaksi tidak boleh membuka nested transaction owner lain. Port lokal memakai value/copy dan tidak mengembalikan entity mutable milik repository.

Semua operasi I/O menerima context; deadline dan cancellation diwariskan. Error dikategorikan menjadi validation, unauthorized, forbidden, not found, conflict, rate limited dan dependency error tanpa membocorkan detail internal. Retries hanya untuk kelas yang aman dengan key idempoten dan batas total deadline. Tidak retry buta pada semua 4xx atau mengganti key ketika timeout. Log terstruktur menyensor token/cookie/password dan payload pribadi.

### Database dan event

Migrasi diberi ID monoton, owner, checksum dan tujuan. Forward-only additive menjadi default; backfill bounded dengan observabilitas. Jangan menjalankan drop/rename destruktif di lingkungan berdata tanpa otorisasi, backup dan strategi pemulihan. Seed lab dapat diulang pada database disposable yang diberi guard lingkungan. Tidak melakukan truncate atau reset database hanya agar test lulus.

Role runtime tidak memiliki CREATE pada schema lain, DDL atau hak migrator. Permission ownership berlaku walaupun semua modul ada dalam satu proses. Migration test membuktikan role M3 tidak dapat membaca tabel identity dan M9 tidak dapat mengubah intake.tickets. Query dan indeks disusun dari pola list/filter yang nyata, termasuk tie-breaker ID dan visibility. CHECK serta foreign key dalam owner melengkapi validasi aplikasi, bukan menggantikannya.

M3 write atomic mencakup aggregate, version/history, intent event serta hasil idempotency. Outbox local menyimpan target consumer pada saat commit. Consumer hanya ACK setelah inbox dan efek commit. Crash sebelum commit tidak menghasilkan event durable; crash sesudah commit/lost ACK tidak menggandakan efek. Retry lease dapat dipulihkan sesudah restart. Dead-letter mempunyai reason dan prosedur replay berizin; replay tidak mengubah event_id/digest diam-diam.

Bukti notifikasi untuk auto-close harus dapat diverifikasi oleh M3. Gunakan event NotificationStored dari M9 yang disimpan pada confirmation notification projection milik M3 dengan inbox dedup, berisi ticket_id, resolution_attempt_id dan notification_id. Event itu hanya terbit setelah pusat notifikasi durable, melalui outbox M9. Ini edge event balik yang sah, bukan transaksi atau query lintas owner. M3 menolak auto-close bila bukti untuk attempt aktif belum ada. Pengiriman Telegram tidak menjadi bukti ini. Definisikan stream/subscription per event sehingga gap versi palsu tidak memblokir consumer.

Bukti permission yang dapat berubah tidak dipercaya dari snapshot lama. Saat write atau file download, periksa revocation sesuai policy. Background command memakai service principal terbatas serta origin actor jika ada, bukan Super Admin. Event payload diminimalkan dan tidak memberi consumer hak baru yang tidak dimiliki. Trace correlation bukan credential.

### Frontend dan pengalaman pengguna

Bangun design tokens dan komponen bersama sebelum halaman turunan. Jika pada saat implementasi sudah ada design system proyek yang sah, reuse komponen tersebut dan catat penyesuaian; jangan membuat sistem visual kedua. State domain berasal dari API typed. Client tidak menghitung sendiri izin final, deadline resmi atau kepemilikan tiket. Status loading, empty, pending, conflict, forbidden dan offline merupakan bagian acceptance.

Setiap feature selesai harus memiliki UI operasional, API yang benar dan persistence yang bertahan setelah refresh/restart sesuai kontrak. Array dummy, localStorage sebagai database tiket, tombol no-op dan success toast tanpa server effect tidak dianggap implementasi. Adapter lab identitas/notifikasi merupakan pengecualian eksplisit dengan tujuan dan status terlihat. Jangan menampilkan kredensial fixture sebagai akun produksi.

Form menggunakan skema berversi, validasi field serta error summary. Pada dynamic form, perubahan master tidak memaksa draft lama diterima tanpa migrasi/review. Autosave menyatakan revision terakhir yang diakui server. Recovery tidak mengirim tiket otomatis. Handler UI mempertahankan idempotency key untuk intent yang sama dan memisahkan simpan draft dari submit final. UI mengingatkan risiko perangkat bersama tanpa menyimpan secret dalam draft.

Bulk action menyimpan daftar target/snapshot filter dan memastikan izin/version per item. Hasil partial failure menampilkan mana yang berhasil/gagal. Pagination server memakai cursor stabil; total yang belum tersedia tidak direkayasa. Search suggestion dan histogram grafik tidak boleh mengungkap objek tanpa hak. Export job tetap memeriksa permission ketika file diambil. Aksi nonreversibel mempunyai dialog dengan objek, akibat, dan alasan yang jelas.

### Pengamanan dependensi dan operasi

Pada bootstrap catat versi Go, Node, React, TypeScript, Vite, pgx, PostgreSQL, tool migrasi/test, image base dan OS/runtime. Pin lockfile/digest dan dokumentasikan sumber verifikasi. Jangan memakai latest dalam image release. Dependency baru memiliki justifikasi fungsi, lisensi dan maintenance; upgrade mayor atau perubahan framework memerlukan keputusan eksplisit. Tidak menjalankan npm audit fix --force.

Konfigurasi publik frontend tidak memuat secret. Contoh environment hanya nama key dan placeholder, tanpa token nyata. Secret scanning tidak membenarkan pencetakan seluruh env/log. Test Telegram menggunakan sink dan verified fake bindings. Aktivasi kanal nyata memerlukan otorisasi serta target yang jelas. Hal yang sama berlaku untuk SSO, data asli, deployment, purge dan restore.

Proxy hanya mempercayai header IP dari upstream terkonfigurasi. Gunakan batas ukuran body/file, request timeout, concurrency dan rate limit sesuai konteks. Upload tidak mengambil URL arbitrer, mengeksekusi file atau menyajikan HTML aktif dari storage privat. Rich text disanitasi server. API client scopes diperiksa pada owner. Runner operasi hanya menerima job kind allowlist dan parameter tervalidasi; tidak ada endpoint exec atau SQL console umum.

## 16 Pengujian proporsional dan bukti kelulusan

Minimum test set harus membuktikan requirement yang berubah. Tes unit memeriksa invariants/policy, tes integrasi PostgreSQL memeriksa transaksi/constraint/role, tes kontrak memeriksa OpenAPI dan error, serta browser smoke memeriksa perjalanan pengguna. Mock DB tidak membuktikan concurrency atau SQL permissions. Tidak perlu menjalankan seluruh suite keamanan berulang untuk perubahan teks atau UI sederhana.

| Jenis perubahan | Pemeriksaan minimum | Perluasan bila risikonya muncul |
|---|---|---|
| Dokumen dan aturan agent | Link/ID, JSON/CSV, konsistensi canonical dan render Word bila diubah | Konflik policy atau requirement perlu review domain |
| Pure rule M4/M6 | Fixture batas, input invalid dan determinisme | Kalender/timezone, confidence atau SLA berubah memerlukan regression |
| API/use case | Contract dan affected-module integration | Auth, idempotency, concurrency dan SQL menambah negative tests |
| Identitas/permission | Cross-user, cross-OPD, forged role, revoked/expired akses | List/search/count/export/download serta background jobs |
| Transaksi/event | Commit/rollback, lost response, duplicate/reorder/ACK/restart | Race detector pada jalur concurrent dan queue load bounded |
| Upload/media/editor | ACL, MIME/signature, oversize, quarantine, sanitasi | Reuse privat/publik, orphan dan revocation link |
| UI shared component | Keyboard, error/empty/loading, desktop/mobile representatif | Browser tambahan hanya jika bug atau kompatibilitas belum terbukti |
| Dependency/container/config | Build lockfile, scan relevan dan permission config | Full candidate gate pada final source yang akan dirilis |

Tiga fixture inti adalah G01 guest melaporkan tautan rusak, P01 publik login meminta bantuan akun dan A01 ASN melaporkan gangguan aplikasi internal. Gunakan pemohon kedua dan OPD kedua untuk negative pair. Tambahkan L1/L2, supervisor dan vendor scope terpisah. Jam bisnis dapat dibekukan, tetapi latency teknis memakai monotonic clock. Auto-close 24 jam diuji dengan clock fixture, bukan menunggu sehari atau mengubah policy produksi menjadi satu menit.

Tidak ada command aplikasi yang dianggap tersedia pada paket awal. planning/command_registry.json mencatat status NOT_IMPLEMENTED sampai M0-01 membuat script nyata. Command yang direncanakan mencakup backend format/vet/test, import boundary, DB/migration integration, frontend lint/typecheck/test/build, contract, E2E smoke dan security/recovery. Tulis command aktual setelah memeriksa go.mod/package.json; jangan menjalankan nama script rekaan lalu melaporkan PASS. Validator paket scripts/verify_package.py hanya memeriksa dokumen dan konsistensi, bukan aplikasi.

Gate kandidat final menggabungkan affected tests yang relevan, backend build/race pada jalur concurrent, frontend typecheck/build, kontrak, migration/DB roles, authorization negatif, media, recovery worker, browser smoke, dependency/image/secret checks dan resource config. Full gate dilakukan pada source final yang tercatat. Jika ada perubahan sesudahnya, jalankan ulang cakupan terdampak dan gate sesuai risiko. CI terlindungi menjadi otoritas broad verification saat tersedia; saat belum ada CI, catat NOT_CONFIGURED dan jangan mengarang status remote.

Selesai implementasi berarti seluruh acceptance M0 yang in scope mempunyai test/evidence dan tidak ada blocker. Review keamanan produksi, UAT, legal/retensi organisasi, backup restore produksi serta persetujuan release adalah gate berbeda. DEFERRED_RESEARCH tidak berarti semua model telah diverifikasi. Jangan menggunakan hasil validator dokumen sebagai hasil benchmark atau aplikasi.

## 17 Dokumentasi perubahan dan aturan selesai

Setiap task menghubungkan requirement AC/FR, modul, data/API/UI yang berubah, risiko, test command dan hasil. Gunakan status/evidence.jsonl untuk bukti ringkas dengan waktu, agent, task, source reference, command, exit code dan lokasi output tersensor. Jika belum Git, catat hash file relevan; jika sudah Git, catat SHA aktual serta dirty state. Screenshot UI menyimpan viewport dan fixture tanpa data asli.

Task definition of done mencakup kontrak/schema yang sinkron, implementasi utuh, handling gagal/izin, persistence, test sesuai risiko, dokumentasi dan daftar keputusan terbuka yang tidak disembunyikan. Subset fitur boleh diserahkan sebagai PARTIAL dengan daftar acceptance yang tersisa. Tidak ada klaim “production ready” berdasarkan pemeriksaan source saja. Issue yang diketahui tidak dihapus dari handoff saat agent berganti.

Untuk bug, lakukan reproduksi dan temukan akar masalah sebelum fix yang terarah serta regression test. Untuk refactor, buat shared abstraction, pindahkan consumer representatif, lalu migrasikan sisanya tanpa mengubah perilaku. Preserve unrelated changes. Jangan menulis ulang sejarah Git, reset working tree, mengganti framework atau melonggarkan permission untuk mempercepat penyelesaian. Jika tindakan berisiko belum diotorisasi, tandai BLOCKED_<ALASAN> untuk tindakan tersebut dan lanjutkan pekerjaan aman yang independen.


## 18 Penggunaan paket oleh Codex GPT dan Antigravity Gemini

Buka folder Helpdesk-TIK-Depok-Monolith-Modular sebagai workspace proyek tersendiri. Gunakan AGENTS.md sebagai aturan bersama, README sebagai peta dan PROJECT_STATE sebagai checkpoint. Dokumen Word untuk review manusia; agent membaca Markdown canonical agar dapat mencari bagian spesifik. Jangan mengandalkan riwayat chat sebelumnya sebagai satu-satunya sumber requirement.

Codex menggunakan AGENTS.md dengan discovery berlapis; AGENTS.override.md dan batas ukuran dapat memengaruhi aturan yang masuk konteks [S27]. Antigravity mendukung AGENTS.md/GEMINI.md serta .agents/rules; rule file memakai trigger frontmatter [S28]. Paket menyediakan GEMINI.md dan rule pendek yang menunjuk aturan bersama. Hindari menaruh aturan wajib hanya pada subfolder yang belum dibaca. Setelah membuka workspace, minta agent menyebut file yang dibaca dan tiga invariants M0 sebelum memberi tugas coding.

Dokumentasi Antigravity mengumumkan penghentian workflows lama pada 19 Oktober 2026 [S32]. Paket ini memakai prompt Markdown portabel dan rules, sehingga tidak bergantung pada slash workflow lama. Ini bukan pengujian runtime Antigravity pada komputer pengguna. Jika versi alat tidak memuat rule otomatis, arahkan agent membaca AGENTS.md secara eksplisit. Tidak perlu mengubah global configuration atau menonaktifkan approval/sandbox.

Jangan memilih model berdasarkan asumsi nama “terbaru”. Pengguna dapat memakai GPT di Codex dan Gemini di Antigravity yang tersedia pada akunnya. Perilaku proyek ditentukan aturan, kontrak dan verifikasi yang sama. Keduanya tidak diberi hak menerapkan perubahan ke luar workspace atau melakukan operasi nyata hanya karena paket dokumentasi ini ada.

## 19 Siklus kerja dan pemulihan sesi

Pada awal task, agent memeriksa keadaan aktual, memilih task yang dependency-nya terpenuhi, lalu membaca bagian blueprint yang relevan. Agent membuat rencana singkat berupa file yang diubah, acceptance dan tes terdekat. Implementasi dilakukan per feature slice hingga API, persistence, UI serta kondisi gagal konsisten. Agent memverifikasi sesuai risiko, memperbaiki kegagalan, lalu memperbarui status dan bukti. Progres singkat menjelaskan temuan serta pekerjaan berikut, tanpa dump log.

Pada sesi terputus, baca PROJECT_STATE, backlog task aktif, evidence terakhir, Git diff bila tersedia dan file yang disebut handoff. Verifikasi bahwa bukti masih sesuai source. Lanjutkan dari langkah belum selesai; jangan mengulang bootstrap atau full suite yang masih valid. Bila ada perubahan sumber sesudah bukti, ulangi pemeriksaan terdampak. Keputusan domain yang belum disahkan tetap terbuka walaupun agent sebelumnya menulis “selesai”.

| Keadaan | Tindakan agent | Status yang tepat |
|---|---|---|
| Requirement jelas dan perubahan reversibel | Kerjakan hingga acceptance terbukti | IN_PROGRESS lalu DONE_VERIFIED |
| Sebagian acceptance selesai | Catat bukti yang ada dan sisa pekerjaan | PARTIAL |
| Domain resmi belum diputuskan | Gunakan fixture lab untuk pekerjaan independen; tahan aktivasi nyata | BLOCKED_DOMAIN pada gate terkait |
| Tool/test belum tersedia | Bangun tool sesuai scope atau catat keterbatasan | NOT_IMPLEMENTED atau BLOCKED_ENV |
| Test gagal | Cari root cause, surgical fix dan targeted retest | FAIL, bukan menghapus assertion |
| Membutuhkan produksi/destruktif di luar otorisasi | Siapkan rencana/reviewable result dan minta keputusan | BLOCKED_AUTHORIZATION |
| Hanya tes M0 dijalankan | Laporkan bukti M0; jangan menandai parity empat model lulus | DEFERRED_RESEARCH untuk perbandingan |

Agent tidak meminta persetujuan ulang untuk tindakan yang sudah diotorisasi dan tidak menghentikan pekerjaan aman hanya karena gate produksi belum terbuka. Sebaliknya, dokumen rencana bukan otorisasi deploy, pengiriman pesan nyata atau purge. Penjelasan blocker harus menyebut tindakan serta informasi/otorisasi yang kurang secara konkret.

## 20 Pergantian agent dan pembagian kerja

Gunakan satu agent penulis aktif per feature slice secara default. Codex dapat membangun lalu Antigravity meninjau, atau sebaliknya, tanpa pembagian kemampuan yang dipaksakan. Reviewer membaca diff dan bukti nyata. Pergantian agent tidak membuat branch aplikasi kedua atau schema khusus model AI. Jangan membuka dua agent yang menulis file sama tanpa koordinasi.

Handoff menyertakan task/requirement, source SHA atau file hashes, file berubah, command dan hasil, blockers, keputusan domain, security impact serta langkah berikut yang konkret. Sebutkan proses/tool yang masih berjalan agar penerus tidak memulai duplikat. Gunakan templates/HANDOFF.md. Agent penerus mengonfirmasi checkpoint dari file dan melanjutkan scope yang belum selesai, tanpa memulai ulang seluruh analisis.

Jika pengguna meminta pekerjaan paralel, pisahkan file ownership dan kontrak terlebih dahulu. Owner schema/OpenAPI/shared UI harus tunggal untuk perubahan yang saling bergantung. Integrasi dilakukan setelah setiap subtask mempunyai evidence. Hindari menjalankan migrasi seed/DB bersamaan pada database test yang sama. Tidak ada delegasi otomatis yang menambah scope atau mengirim data pribadi ke layanan lain.

## 21 Prompt penggunaan dan pemeriksaan hasil

Prompt awal tersedia di prompts/01_MULAI.md. Prompt tersebut meminta agent membaca aturan, memeriksa keadaan dan mengerjakan task fondasi dengan acceptance aktual setelah pengguna memang memulai pengembangan. Prompt lanjutan di prompts/02_LANJUTKAN.md berfokus pada checkpoint. Prompt review di prompts/03_REVIEW.md meminta temuan konkret dan tidak memperbolehkan klaim lulus tanpa evidence. Prompt handoff di prompts/04_HANDOFF.md menghasilkan ringkasan portabel.

Sebelum menerima laporan selesai, pemilik proyek memeriksa apakah UI memakai persistence nyata, semua negative permission tests relevan dijalankan, aturan 24 jam dan vendor terbukti, migration/recovery telah diuji serta tidak ada klaim broad readiness dari tes sempit. Checklist bukan pengganti menjalankan test. Jika laporan menyebut SHA, PR atau CI, tautan dan identitasnya harus dapat diverifikasi.

Aturan agent membantu menjaga konsistensi tetapi tidak menjamin kesempurnaan otomatis. Bukti dibangun bertahap dari kontrak, tes, review dan UAT. Paket ini sengaja memisahkan kelengkapan spesifikasi dari status implementasi agar agent tidak mengubah rencana menjadi klaim aplikasi telah berjalan.
