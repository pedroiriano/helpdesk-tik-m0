# Blueprint aplikasi Helpdesk Kota Depok

Layanan ASN dan publik dalam empat model arsitektur yang setara

Versi 3.2 • 3 November 2026 • Spesifikasi implementasi dan acceptance criteria

Dokumen ini mengintegrasikan kebutuhan pada Dokumen Rancangan - Helpdesk TIK Kota Depok.docx. Bab 15–23 merinci penyajian informasi, submodul, Smart Dispatch, konfirmasi 24 jam, vendor, lintas OPD, media, administrasi dan acceptance tambahan. Daftar menu tidak mengubah sembilan owner atau partisi baseline. Angka target dan kebijakan organisasi yang belum disahkan tetap merupakan usulan.

## 1 Tujuan produk dan cakupan

Helpdesk melayani kebutuhan internal ASN/OPD serta permintaan publik. Sesuai keputusan pengguna, beberapa layanan dapat diakses tanpa login, sedangkan layanan lain mensyaratkan akun publik atau akun ASN. Kebijakan akses merupakan atribut layanan dan izin server; menyembunyikan menu frontend saja tidak cukup. Sistem eksperimen memakai data sintetis. Integrasi resmi, penggunaan identitas asli serta aktivasi produksi merupakan tahap berikut setelah otorisasi dan UAT.

Fitur mencakup katalog, tiket, triage, penugasan, komentar, catatan internal, lampiran, SLA, eskalasi, knowledge base, notifikasi, audit dan laporan. Aplikasi menyediakan satu frontend React dan satu codebase Go. Modul tidak digandakan untuk tiap arsitektur. Empat model adalah M0, C3, F9 dan G-OPT-MS yang baru diperoleh setelah penelitian TRAIN/VALIDATION. Optimasi boleh menghasilkan partisi sama dengan baseline.

## 2 Jalur akses dan pemisahan data

| Pengguna | Akses yang diperbolehkan | Batas utama |
|---|---|---|
| Pengunjung tanpa login | Katalog/artikel publik; membuat tiket pada layanan guest-enabled; melacak tiket dengan capability aman | Tidak dapat mencari tiket berdasarkan nomor urut, melihat daftar semua tiket atau mengakses layanan internal. |
| Publik login | Layanan PUBLIC_AUTH dan PUBLIC_GUEST; tiket milik sendiri; profil dan notifikasi sendiri | Tidak dapat memilih OPD/owner untuk memperluas hak; tidak melihat internal notes. |
| ASN login | Layanan ASN_AUTH sesuai organisasi; layanan publik bila diizinkan; tiket pribadi/organisasi sesuai scope | Status ASN berasal dari sumber identitas sah, bukan email domain atau flag kiriman browser. |
| Petugas | Antrean tim yang diberi akses; triage, komentar, assignment dan resolusi sesuai permission | Tidak membaca tiket tim/OPD lain tanpa delegation eksplisit. |
| Supervisor | Monitoring tim/OPD, reassign, eskalasi, persetujuan override | Setiap override mempunyai alasan dan audit. |
| Administrator | Master, account policy dan konfigurasi | Hak konfigurasi tidak otomatis berarti hak membaca isi seluruh tiket. |

Kategori layanan memiliki access_mode PUBLIC_GUEST, PUBLIC_AUTH, ASN_AUTH atau STAFF_ONLY serta audience scopes. Katalog publik tidak membocorkan layanan internal. Nilai subject_id, actor_type, role dan org_scope diambil dari session/token terpercaya. Otorisasi objek dilakukan setiap read/write, download, export dan search. Untuk objek tidak terlihat, respons 404 seragam; 403 untuk aksi terlarang pada objek yang sudah boleh dilihat. Tenant/scope tidak dipercaya dari header bebas.

Pada alur tamu, klien menghasilkan dan menyimpan secret pelacakan dengan Web Crypto sebelum mengirim create melalui TLS. Kirim secret hanya melalui header sensitif yang disensor di gateway dan tracing. Ikat hash secret ke tiket dan konteks idempotensi dalam transaksi M3. Respons create/replay hanya berisi nomor tiket dan status. Jika respons hilang, klien masih memiliki secret dan dapat mengulang request dengan key yang sama. Guest ticket menggunakan token capability acak kriptografis minimal 256 bit; server hanya menyimpan hash, scope tiket, masa berlaku dan revocation state. Ticket number yang mudah dibaca bukan rahasia. UI menawarkan penyimpanan token pada perangkat pribadi. Penerbitan token pengganti hanya melalui kontak terverifikasi bila kebijakan layanan mengizinkan; kehilangan token tidak boleh dipulihkan lewat tebakan nama/NIK. Tukarkan token melalui POST ke sesi pelacakan singkat; jangan menaruh token dalam query URL, analytics atau referrer. Cookie menggunakan Secure, HttpOnly, SameSite dan perlindungan CSRF bila autentikasi berbasis cookie. Pembatasan frekuensi, quota lampiran dan anti-abuse berlaku identik pada empat model.

Bedakan tanpa login dari anonim mutlak. Layanan bisa meminta verifikasi email/telepon tanpa membuat akun; kontak opsional atau wajib ditentukan pemilik layanan. Untuk lab, delivery menggunakan sink deterministik, tidak mengirim pesan kepada orang nyata. Guest hanya dapat melihat public-facing history tiketnya; catatan internal, identitas petugas sensitif dan data OPD dibatasi. Penggabungan tiket guest ke akun membutuhkan pembuktian capability/kontak, bukan klaim nomor tiket.

### Tiga perjalanan pengguna untuk menyepakati batas layanan

Gunakan contoh di bawah sebagai bahan diskusi dengan OPD. Nama layanan, tenggat, dan bukti yang diminta di sini adalah fixture sintetis. Validasi siapa pemilik prosesnya, apakah kategorinya boleh dilaporkan secara terbuka, serta siapa yang boleh melihat lampiran sebelum menjadikannya katalog resmi.

| Contoh layanan lab | Cara masuk dan hasil yang dijanjikan | Skenario penolakan |
|---|---|---|
| G01 Lapor tautan rusak pada portal publik | Tamu memilih kategori PUBLIC_GUEST, mengirim alamat halaman sebagai teks dan memperoleh bukti penerimaan. Secret pelacakan hanya membuka riwayat publik tiket itu. | Nomor tiket tanpa secret ditolak. Backend tidak mengambil URL laporan sebagai lampiran. |
| P01 Permintaan bantuan akun layanan publik | Pemohon masuk dengan akun publik, memilih PUBLIC_AUTH, melihat tiket miliknya, dan menjawab permintaan informasi. | Akun publik kedua yang mengetahui ID tiket tidak memperoleh status, lampiran, komentar, ataupun petunjuk bahwa akun pertama terdaftar. |
| A01 Gangguan aplikasi kerja internal | ASN masuk melalui identitas lab dengan membership OPD yang valid. Petugas tim berwenang melakukan triage, penugasan dan resolusi. | Publik tidak melihat katalog internal. ASN dari OPD lain tidak memperoleh tiket hanya karena mengetahui ID atau memiliki jabatan serupa. |

Untuk UAT, minta pemilik proses menjawab tiga pertanyaan melalui contoh tersebut. Dapatkah petugas lintas OPD menerima delegasi sementara, siapa yang boleh meminta identitas tambahan dari tamu, dan apa yang masih boleh dilihat petugas setelah delegasi berakhir? Simpan jawaban sebagai aturan dengan tanggal efektif dan contoh izinkan/tolak berpasangan. Untuk pilot gunakan default deny dan fixture yang membuat hak akses eksplisit.

### Model keputusan izin serta kebocoran melalui proyeksi

Fungsi izin menerima principal yang terverifikasi, aksi, atribut objek, audience layanan dan policy version. Untuk pembacaan, subjek harus memenuhi satu jalur yang sah: memiliki tiket, memegang capability tiket yang aktif, atau mempunyai permission dengan scope tim/organisasi yang cocok. Visibility internal tetap disaring sesudah pemeriksaan objek. Untuk mutasi, tambahkan pemeriksaan transisi dan expected_version. ADMIN_CONFIG hanya mengubah master. Menambahkan role admin untuk membaca tiket akan merusak pemisahan tanggung jawab.

Perubahan membership adalah kasus yang lebih sulit dari login biasa. Misalkan supervisor kehilangan hak OPD A ketika projection laporan masih tertinggal. Terapkan otorisasi saat request menggunakan policy dan membership yang otoritatif atau cache dengan jendela revocation yang disahkan. Filter scope sebelum agregasi, pagination, ekspor dan perhitungan total. Tolak keputusan yang tidak dapat diverifikasi. Kelambatan projection boleh membuat jumlah tiket lama, tetapi tidak boleh membuat data OPD A tetap terbuka. Dalam fixture revokasi, bekukan kebijakan tanpa jendela cache untuk kasus sensitif dan periksa list, detail, operasi async serta download melalui link lama.

Untuk tamu, pisahkan lifetime guest session yang membatasi abuse dari lifetime capability untuk satu tiket. Idempotency key bukan bukti hak melihat tiket. Pada replay, verifikasi scope dan binding secret yang sama sebelum mengembalikan snapshot respons. Jika sesi kedaluwarsa setelah commit, pemohon memakai jalur pelacakan dengan capability, bukan membuat session baru lalu mengulang create secara otomatis. Sistem yang hanya menyimpan hash token memerlukan secret sebelum transaksi pertama agar respons yang hilang tidak menghilangkan satu-satunya jalan pemulihan.

## 3 Sembilan modul canonical

| ID | Modul dan schema | Data serta batas tanggung jawab |
|---|---|---|
| M1 | Identity and Access / identity | accounts, external_identities, organizations, teams, memberships, roles, permissions, sessions; delegasi dan policy administrasi, tanpa hak otomatis ke isi tiket. |
| M2 | Service Catalog / catalog | services, categories, form_versions, access_policies; konfigurasi navigasi/fitur dan upload policy berversi. Detail owner pada Bab 16. |
| M3 | Ticket Management / intake | tickets, ticket_versions, comments, attachments, operations, idempotency_records, guest_capabilities, escalation_marks; verifikasi, resolution attempts, vendor, handoff dan draft. Sumber kebenaran tiket. |
| M4 | Classification / classification | classification_rules, priority_rules, rule_versions; pure classification proposal dan optional projection hasil. |
| M5 | Assignment / assignment | routing_rules, team_rules, assignment_projection; rekomendasi petugas dan load projection, bukan writer status tiket. |
| M6 | SLA Management / sla | policies, calendars, holidays, clock_projection; perhitungan response/resolution deadline dan kalender kerja. |
| M7 | Escalation / escalation | escalation_rules, scheduled_jobs, attempts; pemicu command idempotent ke M3 berdasarkan deadline/version. |
| M8 | Knowledge Base / knowledge | articles, revisions, article_tags, visibility_scopes; konten portal, media editorial, draft dan publikasi. |
| M9 | Notification and Audit / notify_audit | inbox, notifications, deliveries, audit_events, report_facts; binding Telegram, export jobs dan visitor aggregates dengan scope. |

M3 diperluas namanya dari Ticket Intake menjadi Ticket Management agar owner lifecycle jelas, tanpa menambah modul kesepuluh. M4/M5/M6 menghitung keputusan dari input/policy snapshot; hasil yang memengaruhi state tiket dikomit oleh M3. Proyeksi modul lain menyimpan event dan version watermark, bukan sumber kebenaran yang bersaing. Pemisahan ini perlu penilaian domain; sembilan modul tidak dianggap otomatis sembilan bounded context mandiri.

Setiap schema owner yang menerbitkan event memiliki outbox sendiri; setiap consumer memiliki inbox dedup bila diperlukan. Outbox bukan seluruhnya milik M9. Infrastructure helper boleh dipakai bersama, tetapi beroperasi dengan transaksi/kredensial owner yang memanggilnya. Tidak ada SELECT/JOIN/UPDATE lintas owner pada runtime. M0 juga menggunakan aturan ini, sehingga penelitian membandingkan monolith modular dengan kontrak ownership yang sama, bukan monolith bebas optimasi SQL.

## 4 Model data dan aturan integritas

Semua model menggunakan satu instance PostgreSQL, schema, DDL, indeks, constraint, query dan seed identik. Shared physical database adalah kontrol eksperimen; tidak mewakili isolasi storage/CPU database-per-service fisik. Runtime memakai sembilan DB roles least-privilege dan pool per logical owner. Role migration terpisah dari aplikasi; schema-qualified SQL, search_path aman dan public CREATE dicabut [S18]. Hak role tidak diperlebar karena modul berada di proses sama.

ID memakai UUID; kolom waktu TIMESTAMPTZ disimpan UTC dan ditampilkan Asia/Jakarta. version adalah integer monotonik untuk compare-and-swap. Referensi antarowner berupa UUID plus snapshot policy version, tanpa cross-owner foreign key. Foreign key dalam schema tetap diterapkan. Kebijakan inactive/soft-delete untuk kategori/pengguna yang telah direferensikan; jangan menghapus bukti historis. Sanitasi rich text menggunakan allowlist; plain text menjadi default.

| Entitas penting | Kolom dan constraint minimum | Indeks sesuai pola akses |
|---|---|---|
| intake.tickets | id, ticket_number unique, requester_kind, requester_id nullable, requester_org_id, service_owner_org_id, service_id, service_version, status, classification, priority, assignee_id, team_id, verification_status, work_state, current_resolution_attempt_id, version, response_due_at, resolution_due_at, created_at, updated_at | requester_id+created_at+id; team_id+status+priority+created_at+id; due_at+status. |
| intake.idempotency_records | actor_scope, operation, key, request_hash, response_status/body nonrahasia, created_at; unique scope+operation+key | Unique lookup; cleanup TTL di luar window benchmark. |
| intake.ticket_versions | ticket_id, version, action, actor, before/after, occurred_at; unique ticket_id+version | ticket_id+version; audit join hanya dalam owner. |
| intake.comments | id, ticket_id, author, visibility PUBLIC/INTERNAL, content, created_at | ticket_id+created_at+id; filter visibility di query. |
| intake.attachments | id, ticket_id, uploader_scope, storage_key, size, media_type, checksum, scan_status | ticket_id+id; tidak menyimpan path dari klien. |
| intake.guest_capabilities | ticket_id, token_hash unique, expires_at, revoked_at, permitted_actions | token_hash; secret mentah tidak tersimpan. |
| owner.outbox | event_id, aggregate_id, aggregate_version, event_type, payload, occurred_at, available_at, attempt_count, lease_until, delivered_at | pending available_at partial index; aggregate_id+version. |
| consumer.inbox | producer_id, event_id, processed_at; unique producer_id+event_id | Unique dedup dan retention terkontrol. |
| notify_audit.report_facts | ticket_id, aggregate_version, scope, status, durations, updated_at | org/team+date; visibility scopes untuk laporan. |

DDL di atas adalah data dictionary, bukan migrasi siap dieksekusi. Implementasi harus menambahkan CHECK requester_kind/requester_id, status enum/check, foreign keys dalam owner, panjang field, uniqueness dan migration tests. Snapshot equality tidak memakai pg_dump byte hash mentah untuk data dinamis; gunakan canonical schema representation dan ordered logical rows, dengan volatile timestamps/IDs yang benar-benar dibenarkan dinormalisasi. State comparison tidak menghapus kolom bisnis agar terlihat sama.

## 5 State machine dan operasi bisnis

| Dari | Aksi | Ke | Pemeriksaan |
|---|---|---|---|
| Tidak ada | Create | OPEN | Service terlihat dan aktif, field valid, principal/capability valid, idempotency. |
| OPEN | Verify and triage | TRIAGED | Operator scope sesuai; verification_status=VERIFIED, kategori/priority dan bukti verifikasi tersimpan. |
| OPEN/TRIAGED | Request information | NEEDS_INFORMATION | Alasan jelas; pause SLA hanya bila policy mengizinkan. |
| NEEDS_INFORMATION | Submit information | OPEN | Pemilik tiket atau petugas sah; resume clock sesuai policy. |
| TRIAGED | Dispatch and assign | ASSIGNED | VERIFIED; proposal M5, team/assignee berizin dan expected_version benar. |
| ASSIGNED | Start work | IN_PROGRESS | Assignee/delegate; audit mulai penanganan. |
| IN_PROGRESS | Resolve | RESOLVED | Resolution attempt, bukti dan note wajib; batas konfirmasi 24 jam kalender. |
| RESOLVED | Confirm or auto-close | CLOSED | Pemohon menerima atau job setelah 24 jam tanpa feedback; teknisi tidak final close atas nama pemohon. |
| RESOLVED | Reject resolution | IN_PROGRESS atau TRIAGED | Upaya ditolak dalam window; episode awal berlanjut, kembali triage bila assignee tidak lagi berwenang. |
| CLOSED | Reopen | OPEN | Jendela waktu dan alasan sesuai layanan; episode baru terhubung ke episode sebelumnya. |
| OPEN/TRIAGED/NEEDS_INFORMATION | Cancel | CANCELLED | Pemilik/supervisor sesuai policy; alasan dan audit. |

Reassign mempertahankan state kerja yang disepakati dan menaikkan version. Escalation adalah flag/event dengan level, rule dan incident episode, bukan status yang mengganti lifecycle. Satu escalation mark per ticket+rule+episode mencegah trigger ganda. Kebutuhan rollback bisnis tidak menghapus audit; kompensasi menjadi aksi baru yang mempunyai reason dan event.

## 6 Batas transaksi dan konsistensi

Create melakukan pemeriksaan policy auth lokal, mengambil katalog berversi M2, saran awal klasifikasi M4 dan deadline M6 melalui port yang sama pada seluruh model. Semua langkah sebelum commit bersifat read-only/pure terhadap tiket. M3 menulis tickets, ticket_versions, idempotency result dan outbox dalam satu transaksi PostgreSQL. Setelah commit, HTTP 201 menjamin tiket dan audit intent durable, bukan seluruh notifikasi sudah diterima. Ticket state OPEN, verification_status=PENDING dan assignee kosong. Saran kategori saat create belum merupakan verifikasi. Operator melakukan verify/triage; dispatch hanya berjalan setelah VERIFIED, sesuai Bab 17.

Assign hanya menerima tiket VERIFIED, kemudian meminta rekomendasi M5 dengan policy berversi dan input tiket. M3 melakukan CAS WHERE id AND version, memperbarui assignee/team, menaikkan version, dan menyimpan history/outbox. Hanya satu assignee canonical ada pada aggregate. Load projection M5 bersifat eventual; ini mendukung soft load balancing, bukan jaminan kuota keras kapasitas petugas. Bila nanti diperlukan hard capacity reservation, desain saga/reservation harus ditambahkan untuk semua model sebelum freeze, bukan hanya F9.

Resolve, verifikasi, confirmation, reject resolution dan reopen mengikuti pola single-owner commit yang sama. Resolve mencatat attempt dan window konfirmasi, sedangkan final close mengikuti Bab 18. Umpan balik penolakan sebelum close melanjutkan episode awal; reopen sesudah CLOSED membuat episode baru. M6 menghitung clock dari UTC event time dan kalender version; database snapshot menyimpan policy dan due dates agar perubahan master tidak mengubah tiket lama tanpa command eksplisit. Jadwal libur, jam kerja, pause/resume, boundary tengah malam dan ketepatan display Asia/Jakarta diuji dengan frozen clock. Penghitungan business time tidak sekadar menambahkan jumlah jam kalender.

M7 scheduler memiliki lease job dan mengirim escalation command dengan key deterministik. M3 memeriksa state/version dan unique escalation mark; ulang command tidak menggandakan efek. Untuk POST eskalasi publik, respons penerimaan selalu 202 dengan operation_id. Worker memproses command internal secara idempoten dan pemohon memeriksa hasil akhir lewat endpoint operasi. Public contract tidak boleh berubah berdasarkan topologi atau kecepatan model. Jalur async ditetapkan per endpoint, bukan dipilih saat model tertentu lambat.

Outbox relay berjalan sebagai worker logical owner dalam process group; tidak menjadi proses bisnis tersembunyi tambahan. Prinsip commit outbox bersama perubahan aggregate mengikuti transactional outbox [S08]. Relay mengirim event ke consumer melalui adapter local/remote. Bahkan saat local, pengiriman setelah commit tetap async dengan retry/dedup yang sama; tidak memanggil consumer dalam transaksi M3. Consumer menyimpan penanda deduplikasi inbox dan perubahan proyeksi dalam satu transaksi, lalu mengirim ACK. ACK hilang menyebabkan replay aman. Event version lebih lama diabaikan/idempotent; gap version ditunda atau direkonsiliasi. Deadline retry, backoff dan dead-letter policy dicatat identik.

Audit M9 akhirnya berisi satu event untuk setiap business event yang diterima, bukan klaim exactly-once jaringan. Primary commit evidence tetap berada di outbox/history owner. Ketika M9 mati, tiket masih dapat dibuat sampai batas backlog/storage yang sama pada semua model; lag dan backlog terlihat. Drain window serta reconciliation menguji bahwa tidak ada event hilang. Tidak menyebut “semua state sama setiap milidetik”; parity terdiri dari commit semantics yang sama dan convergence yang sama setelah batas waktu yang ditentukan.

### Jejak satu operasi dari gateway sampai laporan

Ambil G01 dengan idempotency key K dan operation ID L. Gateway menerbitkan identitas sesi tamu yang sudah diperiksa, M2 memberikan policy version, lalu M4 dan M6 menghitung klasifikasi dan tenggat. M3 menulis tiket T versi 1, digest intent, metadata respons untuk K, history dan event E pada satu transaksi. Sesudah commit, M3 dapat mengembalikan 201. Pada M0 semua keputusan modul berada dalam satu proses. Pada C3 M3 dan M4 satu grup, sedangkan M2 dan M6 berada di grup lain. Pada F9 ketiga panggilan antarmodul itu remote bila benar-benar dilalui. Pada G-OPT rute diturunkan dari manifest. T, versi kebijakan, isi event dan jaminan commit harus sama untuk keempatnya.

Jangan memegang lock tiket selama menunggu RPC keputusan. Hitung proposal terhadap snapshot berversi, lalu pastikan syaratnya masih berlaku ketika write. Aturan katalog yang dapat berubah di tengah create memerlukan kebijakan eksplisit. Untuk eksperimen, pakai policy version immutable di fixture dan rekam versi yang dipakai tiket. Pada produksi, perubahan yang harus berlaku seketika seperti pencabutan hak akses memerlukan pemeriksaan otorisasi saat command diterapkan. Mengandalkan snapshot lama untuk pencabutan akses tidak dapat diterima.

| Titik gangguan | State yang harus ditemukan | Tindakan pemulihan dan bukti |
|---|---|---|
| Dua create dengan K masuk bersamaan | Unique key melindungi scope, aksi dan key. Paling banyak satu tiket committed. | Dalam transaksi, pemegang key menulis intent dan efek bersama. Request pesaing menunggu hasil atau mendapat respons retry yang tetap. Bandingkan digest payload pada lookup setelah commit. |
| Sesudah insert tiket, sebelum commit | Tidak ada tiket, history atau event durable dari transaksi yang dibatalkan. | Kirim ulang K dan payload semula. Tepat satu tiket dan satu intent audit muncul. |
| Commit sukses, respons 201 hilang | Satu tiket, satu event, satu hasil idempotensi. Klien mengalami timeout. | Replay oleh subjek sah mengembalikan ID lama. Catat committed=true sekaligus kegagalan deadline operasi asal. |
| M9 commit inbox lalu ACK hilang | Satu rekaman audit dan satu inbox entry untuk E. Relay masih dapat mengirim ulang. | Consumer mengakui duplikat setelah mengecek identitas event. Periksa jumlah efek per event dan per consumer secara independen. |
| Event v3 tiba sebelum v2 | Proyeksi yang memerlukan delta berurutan masih pada watermark v1. | Simpan v3 tertunda tanpa menandainya selesai, terapkan v2 lalu v3. Alarm bila gap bertahan melewati drain bound. |
| Dua petugas memegang tiket v5 | Hanya satu perubahan dari v5 diterima untuk dua command berbeda. | UPDATE bersyarat versi dan otorisasi objek. Pemenang menerima v6. Command yang kalah menerima 409 setelah pemeriksaan scope. Replay key pemenang memakai hasil tersimpan. |

Key diindeks dengan scope subjek, action, target dan key, sedangkan hash payload disimpan sebagai atribut pembanding. Jika hash payload dimasukkan ke kunci unik utama, dua intent berbeda dengan K yang sama justru dapat diterima. Canonicalization meliputi field semantik dan expected_version. Keluarkan correlation ID, timestamp kiriman ulang dan header transport. Gunakan UPDATE bersyarat dengan jumlah row terdampak sebagai bukti CAS. PostgreSQL READ COMMITTED dapat mengevaluasi ulang kondisi setelah transaksi pesaing selesai [S22]. Pola identitas command dari klien dan penyimpanan atomik didukung pembahasan retry dari AWS [S21].

Jika event harus dikirim ke M5, M6 dan M9, satu delivered_at global tidak cukup membedakan ACK parsial. Tambahkan tabel milik produsen outbox_delivery(event_id, consumer_id, state, attempts, lease_until, acked_at) dengan primary key pasangan itu pada migrasi yang sama untuk keempat model. Daftar target dan versi skema event disimpan saat commit. Relay menjadwalkan ulang target yang belum ACK. Consumer menyimpan (producer, event_id) dan efeknya dalam satu transaksi lokal. delivered_at agregat baru dapat diisi ketika semua tujuan wajib ACK. Untuk email eksternal, jaminan duplikasi ditentukan juga oleh provider. Pada lab, sink ber-ID memungkinkan penghitungan efek tanpa mengirim pesan nyata.

Urutan event harus didefinisikan per stream yang benar-benar diterima consumer. Bila tiap mutasi menghasilkan satu envelope history untuk setiap subscriber tiket, gunakan aggregate_version. Jika subscriber hanya menerima sebagian tipe event, gunakan sequence stream yang rapat atau snapshot dengan versi monoton. Jika tidak, consumer dapat menunggu selamanya untuk versi yang memang tidak ditujukan kepadanya. Penanganan replay memeriksa event_id dan payload digest untuk mendeteksi ID yang dipakai ulang dengan isi berbeda.

### SLA lintas akhir pekan dan kegagalan lampiran

Kalender uji CAL-1 berisi Senin–Jumat pukul 08.00–16.00 WIB, tanpa hari libur. Tiket yang dibuat Jumat pukul 15.30 dengan jatah respons dua jam kerja memakai 30 menit Jumat dan 90 menit Senin. Tenggatnya Senin 09.30 WIB atau 02.30 UTC. Bila Senin ditandai libur sejak versi kalender tiket dibuat, tenggat menjadi Selasa 09.30 WIB. Untuk kontrak pause, mulai Jumat 15.45 dan lanjutkan Senin 10.00. Waktu aktif yang telah dipakai adalah 15 menit, sehingga sisa 105 menit berakhir Senin 11.45 WIB. Uji persis tepat pukul 16.00 memakai interval kerja setengah terbuka [08.00,16.00). Ketiga kasus berdiri sendiri. SLA bisnis ini berbeda dari deadline teknis respons HTTP pada eksperimen.

Lampiran melibatkan file store dan PostgreSQL yang mempunyai batas commit berbeda. Tulis blob ke quarantine dengan object key server dan ukuran maksimum, catat checksum dan pemilik pada metadata PENDING. Worker mengubahnya ke CLEAN hanya jika scan sukses dan digest cocok. Download memastikan permission tiket, visibility komentar asal dan status CLEAN saat request. Jika blob tersimpan tetapi metadata gagal, sweeper menghapus orphan setelah grace period dan pemeriksaan ulang terhadap metadata aktif. Jika metadata ada tetapi blob hilang, tampilkan status gagal tanpa mengiklankan file dapat diunduh. Bekukan grace period, scan adapter, storage snapshot dan jatah I/O yang sama untuk empat model.

## 7 Kontrak API eksternal

Base path /api/v1. Request tulis memakai Idempotency-Key, trace correlation dan expected_version untuk perubahan aggregate. Scope idempotency mencakup principal atau guest session, endpoint serta aggregate. Key sama dengan payload canonical berbeda menghasilkan 409; retry payload sama mengembalikan respons tersimpan yang sama. Retensi key harus lebih lama dari retry horizon; expired key tidak diam-diam dipakai ulang saat campaign berjalan.

| Endpoint | Metode dan hasil | Catatan |
|---|---|---|
| /catalog/services | GET 200 | Filter audience server-side; publik tidak melihat layanan internal. |
| /auth/session; /auth/logout | POST | Login/logout lab; adapter OIDC resmi setelah otorisasi. |
| /auth/guest-session | POST 201 | Rate-limited guest context untuk layanan yang mengizinkan. |
| /tickets | POST 201; GET 200 | Create; list scope sendiri/tim dengan cursor, filter dan limit maksimum 100. |
| /tickets/{id} | GET 200/404 | Snapshot canonical ditambah projection watermark bila relevan. |
| /guest/tracking-session | POST 200 | Tukar capability untuk sesi tiket terbatas; response tidak mengekspos token lain. |
| /tickets/{id}/triage | POST 200/409 | Alias verifikasi/triage dengan expected_version, classification, priority, keputusan verifikasi dan reason. |
| /tickets/{id}/assign | POST 200/409 | VERIFIED, expected_version, assignee_id/team_id; semantik sama dengan dispatch Bab 23. |
| /tickets/{id}/transitions | POST 200/409 | start, request_information, resume, resolve, close, reopen, cancel. Guard resolution/confirmation Bab 18 dan alias Bab 23 berlaku. |
| /tickets/{id}/comments | POST 201; GET 200 | Public/internal visibility dan pagination server-side. |
| /tickets/{id}/attachments | POST 201/202 | Metadata/scan status; upload bounded, download berdasarkan permission. |
| /attachments/{id}/content | GET 200/404 | Tidak ada static public file URL yang membypass ACL. |
| /tickets/{id}/escalations | POST 202 | Operation resource untuk user-triggered escalation job. |
| /operations/{id} | GET 200/404 | Owner/scope, state pending/succeeded/failed; tidak membocorkan operasi lain. |
| /knowledge/articles | GET 200; POST 201 | Read visibility; write editor yang diberi permission. |
| /knowledge/articles/{id} | GET/PATCH | Versioned draft/published; konten publik terpisah dari internal. |
| /reports/summary | GET 200 | Scope OPD/tim dan as_of/watermark; data eventual dinyatakan. |
| /admin/{master} | CRUD berizin | Master services, rules, calendar, team, role; audit wajib. |
| /health/live; /health/ready | GET | Liveness proses; readiness dependency lokal yang diperlukan, tanpa detail rahasia. |

Error envelope: code, message, correlation_id, details aman. 400 syntax, 401 login invalid, 403 aksi tidak sah, 404 objek tidak terlihat, 409 version/idempotency conflict, 422 validasi bisnis, 429 rate limit, 503 dependency unavailable. Retry-After hanya bila bermakna. Internal errors tidak mengungkap SQL, stack trace, signing key atau alamat service.

OpenAPI 3.1 dan JSON Schema lengkap adalah deliverable tahap kontrak, termasuk contoh sukses/gagal, pagination, error, security scheme, permission dan batas payload. Dokumentasi tabel ini tidak menggantikan schema executable. Endpoint internal tidak dapat dipanggil langsung dari internet; authenticates caller/service identity dan actor context yang diteruskan secara terproteksi.

## 8 Frontend React dan perilaku pengguna

Halaman publik menyediakan beranda, katalog dengan label kebutuhan login, FAQ/knowledge, form guest untuk layanan yang sesuai, login dan pelacakan aman. Pengguna login mempunyai dashboard pribadi, buat tiket, daftar/filter, detail kronologi, komentar, lampiran dan notifikasi. ASN melihat katalog internal sesuai scope serta tiket organisasi jika diberi izin. Petugas mempunyai antrean prioritas/SLA, triage dan workspace penanganan; supervisor mempunyai monitoring dan reassign; admin mengelola master.

Form layanan dibangun dari form_version canonical, menyimpan draft akun pada server dan fallback lokal terbatas sesuai Bab 22, menampilkan validasi field dari server serta menyediakan review sebelum submit. Draft tamu lokal memerlukan pilihan pengguna dan tidak menyimpan secret. Saat timeout setelah submit, UI menggunakan key sama untuk retry atau operation lookup sehingga tidak membuat tiket ganda. Konflik version memuat ulang snapshot dan meminta pengguna meninjau perubahan. Tombol tidak menjanjikan aksi sudah selesai bila masih 202 pending.

Gunakan semantic HTML, label field, fokus keyboard, error summary, kontras memadai dan layout responsive. Status tidak hanya dibedakan warna. List pagination dan filter dijalankan server-side; tidak mengambil seluruh tiket untuk paginate di browser. Loading, empty, forbidden, expired guest access, network error dan pending event state mempunyai tampilan yang jelas. Nama OPD, identitas ASN, SLA resmi, logo dan konten layanan diisi setelah verifikasi pemilik proses.

Satu build React dengan URL API relatif dipakai pada semua topologi, tanpa feature flags yang mengubah fungsi. Pengujian browser mencakup satu alur publik guest, publik login, ASN dan petugas pada viewport desktop/mobile representatif; smoke tiap varian memastikan routing/auth bekerja. Benchmark backend memakai k6 HTTP; tidak diklaim mengukur pengalaman browser atau Core Web Vitals. Asset checksum membuktikan kesamaan bundle, bukan keberhasilan UAT.

## 9 Runtime Go dan empat deployment

Repository yang diusulkan: cmd/servicehost; internal/modules/m1 sampai m9; internal/contracts; internal/adapters/local,http,postgres; internal/runtime; internal/telemetry; frontend; migrations; configs; optimizer; benchmark; infra; docs/adr. Satu Go servicehost binary dibangun sekali dari commit sama. Runtime membaca partition manifest dan group ID untuk menentukan modul lokal. Business code tidak membaca nama M0/C3/F9/G-OPT.

Port modul mendefinisikan typed DTO, error, deadline, cancellation dan actor context. Local adapter melakukan validation dan copy/value semantics yang sama dengan remote, tanpa harus memaksakan serialization overhead palsu. Jangan berbagi mutable pointers yang menimbulkan perilaku berbeda. Remote memakai HTTP/JSON persisten yang sama untuk semua topologi, internal authentication dan timeout/retry identik. Query SQL dan index tidak berubah ketika modul co-located; tidak ada special fast path untuk G-OPT.

Gateway menerima semua request publik dengan TLS/rate-limit/body limit sama. Route target berbeda karena partition; karena itu hash template dan non-topology policy harus sama, sementara full rendered routing config memang boleh berbeda. Internal request tidak memutar lewat public gateway. Local JWT verification dan policy library sama pada semua model; jangan mewajibkan roundtrip M1 pada F9 saja. Login/refresh merupakan workflow M1 yang tetap diukur jika termasuk workload.

Pola C3 awal: Platform={M1,M2,M8}, Case={M3,M4,M5}, Operations={M6,M7,M9}. Alasannya pemisahan identitas/katalog/pengetahuan, alur inti kasus, dan pemantauan/event pendukung. Ini proposal yang memerlukan domain review, bukan klaim DDD telah divalidasi. F9 menempatkan setiap modul sendiri tanpa menambah RPC pura-pura atau sleep. M0 menempatkan semua modul dalam satu proses. G-OPT dihasilkan algoritma, tidak diisi placeholder yang menyerupai hasil.

## 10 Kuota dan lingkungan yang identik

| Komponen | CPU millicore usulan | Memori MiB usulan |
|---|---|---|
| Seluruh process group aplikasi | 2500 | 4608 |
| PostgreSQL | 1000 | 2560 |
| Gateway dan static React | 400 | 768 |
| Exporter lokal | 100 | 256 |
| Total workload envelope | 4000 | 8192 |

Angka adalah starting point pilot; belum spesifikasi server yang tersedia. Host Linux menyediakan OS/runtime headroom di luar envelope, dan generator/collector eksternal tidak mengambil kuota ini. Docker Compose pada single host adalah pilihan utama sederhana; Kubernetes boleh menjadi studi lain atau menggantikan platform sebelum freeze, tetapi tidak dipakai hanya pada microservices. Tidak ada deployment produksi dalam tahap ini.

CPU credit per modul dibagi sama dari 2500m dengan remainder deterministik berdasarkan module ID; memory credit dari 4608 MiB dibagi sama. Limit grup adalah jumlah credit anggotanya. Pool maksimum empat koneksi per logical module sehingga total aplikasi 36 pada seluruh model; koneksi migration, health dan exporter dianggarkan terpisah. Untuk fairness primer, credit dan pool tidak dioptimasi hanya untuk G-OPT. Demand-based allocator boleh diuji terpisah bila diterapkan dengan aturan sama pada semua model.

Tetapkan kebijakan GOMAXPROCS konsisten terhadap quota grup, misalnya max(1,ceil(cpu_m/1000)), dan catat aktual. Jumlah OS thread/GC instance dapat berbeda sebagai konsekuensi proses; jangan salah menyebut total thread wajib sama. Worker logical per modul, HTTP connection limits, retry, queue capacity dan backoff identik. Cgroup hard cap dan parent aggregate cap diaudit; requests/limits konfigurasi saja bukan bukti effective budget.

Pin versi Go, React, Node build, PostgreSQL, OS/kernel, container runtime, driver, HTTP router dan observability saat setup. Catat Go build flags/module checksum, lockfile frontend, image digest, timezone database, fsync/WAL, isolation READ COMMITTED, autovacuum, planner statistics, shared_buffers dan total pools. Versi patch serta nilai tuning yang belum diketahui tetap null dan menghalangi campaign freeze, bukan ditebak.

## 11 Keamanan dan kesiapan operasional

Authentication menggunakan adapter identitas lab yang menghasilkan subject sintetis dan role nyata untuk pengujian. Integrasi SSO ASN dan login publik mengikuti penyedia identitas yang disetujui; issuer/audience/expiry/signature/algorithm diverifikasi, token tidak ditulis ke log. Permission checks ada di server/module port untuk local dan remote. Pengguna tidak dapat menaikkan role melalui profile update. CSRF, CORS allowlist, session expiry, logout dan revocation diuji pada kontrak yang dipakai.

Upload menggunakan batas ukuran/jumlah, allowlist media, pemeriksaan MIME/magic, nama acak, checksum, storage di luar webroot dan quarantine scan. File tidak dieksekusi, tidak di-inline sebagai HTML aktif dan tidak diunduh melalui URL publik bebas. Pemilihan storage/scan policy identik pada empat model; untuk load primer gunakan file sintetis dengan ukuran tetap bila fitur masuk skenario. Jangan mengambil URL arbitrer dari pengguna untuk “lampiran” tanpa kontrol SSRF.

Guest abuse mitigation mencakup rate limits per service/IP/session yang tidak mempercayai X-Forwarded-For dari sumber bebas, submission quota dan validation. CAPTCHA/OTP pihak ketiga tidak menjadi dependensi nondeterministik benchmark; gunakan adapter lab tercatat dengan aturan sama. Benchmark token tidak mempunyai bypass otorisasi. Jalur guest dan authenticated mendapat test set terpisah agar hasil tidak disebabkan proporsi auth berbeda.

Audit append-only dibatasi role tulis; retention dan penghapusan data harus ditetapkan pemilik organisasi. Konfigurasi secret di luar Git, file environment dibatasi akses, container non-root/read-only bila kompatibel, port DB internal. Backup dan restore drill wajib sebelum penggunaan nyata. RPO/RTO, retensi tiket, consent/privacy notice, klasifikasi data dan penanggung jawab insiden masih keputusan organisasi; dokumen ini tidak menyatakan legal clearance. Tidak ada data warga/ASN asli dalam benchmark publik.

## 12 Workload produk untuk eksperimen

Di samping mix operasi pada protokol paper, tetapkan mix principal sebagai faktor terkendali. Usulan awal TRAIN: 20% guest, 40% publik login, 40% ASN untuk create dan status; guest hanya melacak satu tiket. Untuk list, gunakan proporsi publik dan ASN masing-masing 50%; operasi petugas menggunakan principal staff yang sesuai. Angka tersebut bukan proporsi pengguna Depok. Kombinasi invalid, misalnya guest membaca daftar OPD, tidak dibangkitkan sebagai operasi normal. HELD_OUT dapat mengubah principal mix sebagai satu keluarga shift yang dipraregistrasi, dengan total offered load tetap.

Satu dataset synthetic canonical memuat akun publik/ASN/staff, organisasi, teams, layanan setiap access_mode, policy versions, kalender, tiket pada setiap state, artikel publik/internal, serta pending/completed event yang terkontrol. Data awal usulan 5.000 akun, 15 tim, 30 layanan, 50.000 tiket dan 2.000 artikel; volume final ditetapkan pilot. Token/capability fixtures bukan identitas manusia dan tidak masuk release raw. Benchmark restore mengembalikan ticket eligibility dan guest quota secara identik.

Proyeksi tidak direset secara berbeda per arsitektur. Freeze juga mencakup poll interval scheduler, workload background, queue drain, dataset growth dan housekeeping. Jika pemantauan SLA atau notifikasi tidak masuk headline workload, prosesnya tetap dikendalikan dan resource overhead dilaporkan. Tidak menghidupkan background worker hanya pada model tertentu.

## 13 Acceptance criteria dan pengujian minimum

| ID | Requirement dan pengujian | Bukti lulus |
|---|---|---|
| AC01 | Registry dan partition mencakup M1–M9 tepat sekali | Validator menolak duplicate/missing/unknown/empty group. |
| AC02 | Payload/API sama di empat model | Suite kontrak yang sama pada fixture dan normalized state, termasuk error. |
| AC03 | Idempotency dan unknown commit | Replay, payload conflict, timeout setelah commit, retry; satu efek bisnis. |
| AC04 | Concurrent assignment/version | Dua writer versi sama: satu sukses satu 409, satu authoritative assignee. |
| AC05 | Outbox crash/replay/order | Crash sebelum/selepas commit/ACK; event tidak hilang dan projection tidak mundur. |
| AC06 | Guest/public/ASN boundaries | Cross-user, cross-ticket, cross-OPD, expired capability dan forged role semuanya ditolak. |
| AC07 | Internal note dan attachment ACL | Tidak bocor melalui detail/list/search/export/download. |
| AC08 | State machine dan SLA | Transisi valid/invalid, kalender, libur, pause, reject/reopen, SLA provisional/final dan timezone sesuai policy. |
| AC09 | Model parity | Commit guarantee dan convergence sama; satu React build digest dan Go image digest. |
| AC10 | Resource fairness | Total credit, cgroup, pool36, versions, seed/schema dan generator evidence sama. |
| AC11 | UI operasional | Guest create/track, login publik, ASN internal, petugas resolve; keyboard/responsive/error states. |
| AC12 | Provenance ilmiah | No heldout input pada optimizer; freeze hashes; setiap tabel hasil punya raw path. |

Selama implementasi jalankan unit tests terdekat; perubahan auth, SQL, upload dan consistency memerlukan negative tests terkait. Setelah feature slice jalankan affected-module dan contract test. Sebelum campaign final lakukan satu gate gabungan pada commit frozen: backend tests/race relevan, frontend typecheck/build/smoke, parity empat topologi, migration/security checks, fairness dan provenance. Dependency/image scan bukan pengganti authorization/UAT. Tidak perlu full security suite pada setiap perubahan teks atau UI kecil.

### Membandingkan keadaan bisnis antararsitektur

Jalankan fixture G01, P01 dan A01 dari snapshot yang sama pada M0, C3 dan F9. Setelah G-OPT dibekukan, jalankan suite yang sama padanya. Normalisasi hanya field observabilitas dan ID acak dengan pemetaan bijektif dari logical operation ID. Bandingkan status, actor, scope, assignee, policy version, due_at, jumlah effect dan watermark. Menghapus kolom version atau owner dari pembanding akan menutupi race dan kebocoran akses. Penilai baca-saja mengambil snapshot di luar jendela measurement agar query audit tidak menambah beban salah satu model.

Untuk setiap tiket periksa bahwa versi committed membentuk urutan tanpa gap, setiap perubahan memiliki history dan event, setiap consumer wajib mempunyai hasil unik setelah drain, dan tidak ada event untuk transaksi yang dibatalkan. Bandingkan state pada dua waktu. Segera setelah respons sukses, cek janji commit M3. Setelah drain, cek convergence M5/M6/M9 dan operasi 202. Simpan waktu mencapai watermark dan jumlah pending sehingga penundaan tidak tersembunyi oleh perbandingan snapshot akhir. Clock domain dalam fixture dapat dibekukan, sedangkan timer latency memakai monotonic clock yang tetap berjalan.

Kuota 2500m CPU aplikasi dibagi sebagai 278m untuk M1–M7 dan 277m untuk M8–M9. C3 memperoleh 833m untuk {M1,M2,M8}, 834m untuk {M3,M4,M5} dan 833m untuk {M6,M7,M9}. Masing-masing mendapat 1536 MiB dan tiga pool owner masing-masing empat koneksi. M0 dapat meminjam seluruh budget antarpekerjaan dalam satu proses. F9 dapat mengalami throttling walau CPU agregat masih longgar. Perbedaan ini adalah konsekuensi kebijakan alokasi primer. Untuk menilai penjelasan kausal, rekam throttled time pada cgroup per grup, DB wait dan queue time per operasi. Bila perlu, uji satu sensitivitas dengan kuota induk DB/gateway/app dan CPU share per modul tetapi tanpa hard cap anak CPU, diterapkan konsisten di semua model. Pisahkan hasil sensitivitas dari headline.

## 14 Tahapan implementasi dan hasil tiap tahap

S0 menutup domain/access matrix, policy layanan, novelty audit dan ADR. S1 menghasilkan OpenAPI, data dictionary terperinci, migrations, state machine fixtures dan seed. S2 membangun M0 beserta frontend operasional dan tes single-owner transaksi. S3 membangun local/remote adapter, group loader dan transport tests. S4 mengaktifkan C3/F9, menjalankan parity/fairness. S5 menyelesaikan telemetry dan pilot. S6 melakukan TRAIN/VALIDATION serta optimizer dan kontrol mean-cost. S7 membekukan G-OPT. S8 menjalankan HELD_OUT. S9 menganalisis, menulis naskah dan mengemas reproduksi. Tahap produksi terpisah setelah persetujuan organisasi.

Setiap task mencatat perubahan, test aktual, fairness impact, security impact, artifact hash dan outstanding issue. Jangan membuat empat branch aplikasi dengan logika terpisah. Jangan mengubah library, schema, protocol atau policy untuk menguntungkan model tertentu. Perbaikan bug setelah freeze diterapkan konsisten lalu membentuk campaign baru; hasil lama disimpan dengan alasan penggantian.

Keputusan terbuka yang nyata: daftar layanan Depok dan access_mode, penyedia SSO ASN/publik, aturan verifikasi guest, SLA/jam kerja resmi, organisasi dan delegasi, kebijakan PII/retensi, kapasitas host, versi dependency serta target jurnal. Semua mempunyai owner dan gate di decision_register.csv. Pekerjaan kontrak umum dan prototype sintetis tetap dapat dimulai tanpa menganggap keputusan tersebut telah disahkan.

## 15 Penyajian informasi dan susunan menu

Setiap halaman menjawab kebutuhan pengguna melalui judul yang spesifik, ringkasan keadaan, tindakan utama, lalu detail dan riwayat. Halaman detail tiket menampilkan nomor, layanan, status, penanggung jawab, tenggat dan tindakan berikutnya sebelum kronologi. Bedakan waktu pembaruan data dari waktu kejadian. Label “Selesai ditangani” berbeda dari “Ditutup”. Pesan sukses berarti perubahan telah dikomit, sedangkan “Sedang diproses” dipakai untuk job asinkron.

Istilah layanan berarti bantuan yang diterima pemohon, misalnya penanganan gangguan jaringan. Modul berarti pemilik aturan dan data, misalnya M3. Menu mengelompokkan pekerjaan pengguna dan dapat memakai beberapa modul. Process group berarti satu unit deployment yang menjalankan satu atau beberapa modul. Pemisahan istilah ini mencegah satu menu baru langsung diterjemahkan menjadi microservice baru.

| Ruang kerja | Menu utama | Pemilik kemampuan |
|---|---|---|
| Portal publik | Beranda, Layanan, Buat laporan, Lacak laporan, Pusat bantuan, Status layanan | M2, M3, M8; ringkasan gangguan yang telah dipublikasikan |
| Pemohon publik dan ASN | Dasbor saya, Tiket saya, Draf, Notifikasi, Profil | M1, M3, M9; katalog ASN hanya sesuai scope |
| Operator helpdesk | Antrean masuk, Verifikasi, Permintaan informasi, Disposisi, Tiket terkait | M3 dengan proposal M4 dan M5 |
| Teknisi | Tugas saya, Tugas tim berizin, Menunggu vendor, Penyelesaian, Kinerja saya | M3, M5, M6, M7 dan proyeksi M9 |
| Koordinator dan pimpinan | Pemantauan layanan, SLA, Eskalasi, Beban tim, Intervensi, Laporan | M3, M6, M7, M9 menurut scope jabatan |
| Pengelola konten | Artikel, Halaman portal, Bagian halaman, Navigasi, Pustaka media | M8 untuk konten dan M2 untuk konfigurasi navigasi |
| Administrasi | Master data, Identitas dan izin, Aturan layanan, Sistem, Integrasi, Audit | Route per owner; menu administrasi bukan service baru |

Dasbor pemohon menunjukkan tiket yang memerlukan tindakan, tenggat konfirmasi dan status terkini. Dasbor operator menampilkan tiket belum diverifikasi, usia antrean dan duplikasi potensial. Dasbor teknisi memuat prioritas, beban aktif, waktu aktif penanganan, pekerjaan tertahan dan tindak lanjut vendor. Dasbor pimpinan memuat kepatuhan SLA, backlog menurut umur, tren reopen, distribusi beban dan ketergantungan vendor. Grafik mempunyai ringkasan teks dan tabel data yang setara. Klik grafik membawa ke daftar dengan filter yang sama dan izin diperiksa kembali.

Statistik pengunjung didefinisikan terpisah dari jumlah pemohon dan tiket. Catat page views dan sesi portal menurut definisi periode, zona waktu, penyaringan bot dan batas retensi yang disepakati. Jangan menyebutnya jumlah warga unik. Data operasional internal tidak masuk analytics publik. Dashboard menampilkan waktu refresh, watermark proyeksi, denominator dan filter aktif agar angka tidak disalahartikan.

## 16 Pengelompokan kemampuan di dalam sembilan modul

ID, schema dan partisi baseline M1–M9 dipertahankan. Penambahan berikut adalah submodul logis dengan kontrak terpisah di dalam pemilik yang sama. Submodul tidak mempunyai proses atau kuota tambahan tersembunyi. Nama canonical tetap kompatibel dengan module_registry.csv. Cakupan yang lebih luas dicatat pada deskripsi dan capability map.

| Owner | Submodul dan tambahan data | Batas yang harus dijaga |
|---|---|---|
| M1 Identity and Access | Struktur OPD dan bidang, delegasi, role bindings, API clients, maintenance policy, system settings, operation requests | Menentukan identitas, scope dan akses administrasi; tidak menulis state tiket |
| M2 Service Catalog | Versi formulir, kategori layanan, portal navigation, feature registry, upload policies, service ownership | Menu hanya menunjuk fitur terdaftar; perubahan menu tidak memberi permission baru |
| M3 Ticket Management | Verifikasi, resolution attempts, work logs, vendor cases, asset references, draft tiket, media privat | Satu owner untuk lifecycle, relasi kasus dan bukti privat |
| M4 Classification | Analisis teks, usulan kategori dan prioritas, confidence dan alasan, versi classifier | Tidak menjalankan assignment atau menutup tiket |
| M5 Assignment | Disposisi L1/L2, skill teknisi, ketersediaan, routing, proposal distribusi beban | M3 tetap mengesahkan penanggung jawab canonical |
| M6 SLA Management | SLA layanan, target antar tahap, kalender, pause policy, definisi SLO sistem | Perhitungan dan policy berversi; telemetry mentah tetap di sarana observabilitas |
| M7 Escalation | Eskalasi fungsional/hierarkis, vendor follow-up, reminder, job auto-close | Mengirim command ke M3; tidak mengubah tabel tiket langsung |
| M8 Knowledge Base | Artikel, konten halaman portal, revisi, aset editorial, metadata SEO, draft konten | Publikasi terkontrol; tidak mengakses lampiran tiket melalui SQL lintas schema |
| M9 Notification and Audit | Pusat notifikasi, Telegram, audit, fakta laporan, visitor aggregates, export jobs | Worker notifikasi, audit dan laporan memiliki antrean serta batas concurrency terpisah |

M9 memuat beberapa tanggung jawab yang kohesinya lebih rendah. Untuk paket penelitian ini, pertahankan kontrak internal notification, audit dan reporting secara terpisah dalam satu logical owner, lalu ukur queue lag dan resource per jenis pekerjaan. Pemisahan M9 menjadi beberapa modul adalah pertanyaan studi berikutnya karena akan mengubah ruang pencarian F9 dan jumlah partisi. Demikian pula M1 system administration dan M8 editorial media merupakan kompromi cakupan yang harus dicatat dalam ADR, bukan klaim sembilan bounded context telah tervalidasi.

Master data mempunyai owner tunggal. M1 mengelola OPD, bidang, tim, akun, membership dan delegasi dengan effective date. M2 mengelola layanan, kategori, tipe permintaan, kanal masuk, formulir, lokasi layanan dan batas unggahan. M4 mengelola aturan dampak, urgensi, prioritas dan kamus kategori. M5 mengelola skill, roster dan routing. M6 mengelola kalender, hari libur dan target. M7 mengelola tingkat eskalasi. M8 mengelola taksonomi artikel dan lisensi media. M3 mengelola direktori vendor operasional, referensi aset dan kode hasil penyelesaian. M9 mengelola template notifikasi dan binding tujuan pengiriman. Tag tiket dan tag artikel adalah taksonomi berbeda kecuali pemilik proses secara eksplisit menyatukannya melalui M2.

C3 tetap Platform={M1,M2,M8}, Case={M3,M4,M5}, Operations={M6,M7,M9}. Kelompok ini memisahkan akses dan katalog, penanganan kasus, serta pemantauan. M0 menjalankan kesembilan owner bersama, F9 satu owner per proses dan G-OPT-MS ditentukan TRAIN/VALIDATION. Fitur baru bisa mengubah graf dan beban aktual. Karena itu seluruh model harus memakai versi kemampuan yang sama sebelum pengumpulan data, dan G-OPT wajib dipilih ulang jika baseline aplikasi berubah setelah freeze.

## 17 Verifikasi dan Smart Dispatch

Laporan masuk sebagai OPEN dengan verification_status=PENDING dan tanpa assignee. M4 boleh memberikan saran awal kategori ketika create, tetapi saran tersebut belum menjadi hasil verifikasi atau dasar pengiriman otomatis. Operator memeriksa ruang lingkup layanan, kelengkapan, duplikasi, tingkat dampak dan audience. Saran kategori berasal dari analisis isi laporan dengan hasil terstruktur, bukan hanya kategori yang dipilih pemohon. Operator dapat mengoreksi dan wajib memberi alasan untuk override prioritas atau routing.

Saat verifikasi diterima, M3 menyimpan verification_status=VERIFIED, verified_by, verified_at, classifier_version, proposed_category, confirmed_category, confidence, explanation dan evidence digest. Transisi menjadi TRIAGED menaikkan version. M5 baru boleh mengusulkan tim/teknisi setelah tiket VERIFIED. Command assignment memeriksa versi, scope tim, skill dan ketersediaan. Tiket yang masih PENDING, NEEDS_INFORMATION atau REJECTED tidak boleh di-auto-dispatch. Penolakan disertai alasan dan petunjuk kanal yang tepat; status lifecycle menjadi CANCELLED dengan cancellation_reason=OUT_OF_SCOPE atau INVALID_REPORT, bukan menghapus laporan.

Baseline Smart Dispatch memakai aturan deterministik yang mengolah kata/frasa, normalisasi bahasa dan kamus layanan. Jika kemampuan klasifikasi kalimat/paragraf membutuhkan model NLP, evaluasi classifier secara terpisah dengan label manusia dan test set tertahan sebelum diaktifkan. Ukur precision/recall per kategori, macro-F1, confidence calibration, tingkat koreksi operator serta kasus kategori tak dikenal. Jangan menganggap confidence sebagai probabilitas benar tanpa kalibrasi. Threshold rendah, konflik kategori dan kasus sensitif diarahkan ke review manual. Simpan teks asli secara terlindungi dan catat versi preprocessing.

Classifier dipasang dengan artefak dan aturan yang sama pada semua arsitektur. Pelatihan classifier tidak memakai tiket HELD_OUT benchmark untuk menyetel dispatch. Layanan LLM eksternal, bila dipertimbangkan kelak, memerlukan evaluasi privasi, latency, biaya dan nondeterminisme tersendiri. Teks laporan diperlakukan sebagai data dan tidak boleh memerintahkan perubahan permission, tool atau routing di luar policy. Fitur “pintar” tidak boleh menjadi alasan untuk menambahkan dependensi hanya pada satu model.

## 18 SLA penyelesaian dan konfirmasi pemohon

Pisahkan tiga jenis ukuran. SLA layanan adalah komitmen penanganan tiket dari penerimaan sampai penyelesaian. Target tahap internal atau OLA menetapkan batas verifikasi, disposisi, respons teknisi, eskalasi dan tindak lanjut vendor. SLO sistem mengukur ketersediaan, latency, error dan keberhasilan proses teknis pada window terukur. Istilah “SLA Sistem” di UI boleh dipakai bila ada komitmen layanan yang disahkan, tetapi metrik dan periode pengukurannya tetap harus jelas. Waktu HTTP benchmark tidak dihitung sebagai waktu petugas menyelesaikan laporan.

accepted_at adalah waktu penerimaan bisnis yang ditetapkan server M3 pada create dan disimpan hanya bila transaksi berhasil. Nilai ini tidak diklaim sebagai timestamp commit PostgreSQL yang presisi. Payload klien tidak dapat menggantinya. Perubahan kategori, prioritas atau layanan sesudah verifikasi memanggil M6 untuk menghitung ulang target dari accepted_at dan riwayat pause yang sah, lalu M3 mengomit policy version serta alasan perubahan. Assignment, handoff dan reclassification tidak memulai ulang jam SLA. Jadwal M7 lama ditandai superseded dan command selalu memeriksa versi terbaru.

| Ukuran | Awal dan akhir | Aturan pelaporan |
|---|---|---|
| Respons manusia pertama | accepted_at sampai respons bermakna petugas | Balasan otomatis tanda terima tidak memenuhi respons manusia |
| Verifikasi dan dispatch | accepted_at sampai verified_at; verified_at sampai assigned_at | Laporkan kedua interval agar waktu antrean terlihat |
| Penanganan | started_at sampai resolved_at pada upaya yang diterima | Pisahkan elapsed time dari work log teknisi |
| Penyelesaian layanan | accepted_at sampai resolved_at yang akhirnya diterima atau otomatis ditutup | Waktu awal tiket tidak direset ketika dipindah tim atau menunggu vendor |
| Konfirmasi | resolved_at sampai confirmed_at atau closed_at | Batas 24 jam kalender sesuai kebutuhan pemilik proses |
| SLO sistem | Operasi memenuhi target dibagi operasi eligible pada window | Definisikan success, latency threshold, exclusions dan sumber data sebelum pengukuran |

Tindakan teknisi “Selesai ditangani” menyimpan resolution attempt dan membawa IN_PROGRESS ke RESOLVED. Catat resolution note, kode hasil, bukti, resolved_at, resolver, confirmation_due_at=resolved_at+24 jam kalender, serta policy version. Teknisi tidak menjalankan final close atas nama pemohon. UI segera menjelaskan waktu batas dan pilihan “Setuju dan tutup” atau “Belum selesai”. Pusat notifikasi menyimpan pemberitahuan dan M9 mengirim saluran tambahan sesuai preferensi.

Pemohon yang setuju membawa tiket ke CLOSED dengan closure_reason=REQUESTER_CONFIRMED. Bila tidak ada tanggapan dalam 24 jam, M7 meminta auto-close kepada M3 dengan key berdasarkan ticket_id dan resolution_attempt_id. M3 memeriksa bahwa upaya tersebut masih aktif, deadline tercapai, state RESOLVED, tidak ada keberatan dan bukti pemberitahuan dalam aplikasi sudah durable. Closure reason menjadi AUTO_NO_RESPONSE; sistem tidak menyebutnya persetujuan eksplisit. Kegagalan Telegram dicatat dan diulang tetapi tidak dianggap bukti pemohon sudah membaca pesan. Jika pemberitahuan dalam aplikasi belum tersimpan, auto-close ditahan untuk pemulihan dan supervisor diberi alert.

Jika pemohon menyatakan belum selesai selama window konfirmasi, M3 menandai upaya ditolak dan mengembalikan tiket ke IN_PROGRESS bila assignee masih berwenang, atau TRIAGED untuk disposisi ulang. Episode penyelesaian awal tetap berjalan. Usulan default perhitungan memasukkan masa konfirmasi upaya yang ditolak ke durasi layanan agar penyelesaian semu tidak mengurangi SLA. SLA pada RESOLVED ditampilkan “menunggu konfirmasi”, bukan langsung final tercapai. Setelah upaya diterima, endpoint penyelesaian final memakai resolved_at upaya tersebut; tambahan 24 jam tidak menambah waktu penyelesaian final.

Setiap feedback yang sudah dikomit sebelum job auto-close wajib menghalangi penutupan. Feedback nonkonklusif membuat confirmation_state=REVIEW_REQUIRED untuk ditinjau operator. Request yang belum committed tidak dianggap sudah diterima; UI menampilkan status kirim. CAS dan resolution_attempt_id mencegah job lama menutup upaya baru. Pada batas tepat deadline, urutan commit yang sah menentukan hasil dan semua balapan dicatat. Reopen setelah CLOSED mengikuti jendela layanan dan membuat episode baru yang terhubung ke episode lama. Umpan balik kepuasan opsional tidak disamakan dengan konfirmasi penyelesaian.

Contoh penerimaan memakai waktu sintetis. Teknisi menyelesaikan Senin 10.00 WIB, batas konfirmasi Selasa 10.00 WIB meskipun hari libur. Jika pemohon setuju Senin 14.00, closed_at adalah 14.00 dan endpoint penyelesaian tetap 10.00. Jika tanpa respons, auto-close sesudah batas memakai resolved_at 10.00 hari Senin sebagai endpoint. Jika pemohon menolak Selasa 09.59 lalu teknisi menyelesaikan ulang Rabu 11.00, upaya pertama tidak menjadi endpoint final dan window baru berakhir Kamis 11.00.

## 19 Disposisi bertingkat vendor dan lintas perangkat daerah

Operator menerima dan memverifikasi, lalu mendisposisikan ke tim Teknisi L1. Teknisi L1 mengerjakan diagnosis dasar dan dapat mengajukan eskalasi ke L2 disertai diagnosis, tindakan yang sudah dicoba, dampak, urgensi dan bukti. L2 merupakan tingkat keahlian, sedangkan eskalasi hierarkis kepada Kepala Bidang atau Kepala Perangkat Daerah merupakan jalur pengambilan keputusan. Keduanya dicatat terpisah. Naik level tidak otomatis mengganti pemilik layanan atau memberi izin membaca seluruh OPD.

Untuk kerusakan yang memerlukan vendor, M3 menyimpan vendor_case_id, ticket_id, vendor_id, nomor rujukan, cakupan pekerjaan, referensi garansi/kontrak, sent_at, acknowledged_at, expected_return_at, next_followup_at, PIC internal, status dan bukti serah terima. Ini register koordinasi operasional; proses pengadaan dan pembayaran tetap di luar cakupan Helpdesk. Tiket tetap dimiliki tim internal. Vendor hanya memperoleh paket informasi minimum yang secara eksplisit disetujui, tanpa catatan internal, kredensial atau daftar tiket OPD.

Rekomendasi default mempertahankan lifecycle IN_PROGRESS dan menambahkan work_state=WAITING_VENDOR. Status tunggu tidak otomatis menghentikan SLA. Catat gross elapsed time dari penerimaan sampai penyelesaian, net service time setelah pengurangan pause yang disahkan, total vendor wait dan alasan pengecualian. Pause hanya berlaku bila policy layanan mengizinkan, disetujui pihak berwenang, mempunyai batas akhir dan jadwal review. Interval pause tumpang tindih dihitung sebagai gabungan interval agar waktu tidak dikurangi dua kali. Pause ditutup saat syarat berakhir; tidak boleh diperpanjang otomatis tanpa persetujuan.

M7 memantau acknowledgement vendor, perkiraan selesai dan next follow-up. Jika batas terlewati, sistem memberi alert kepada PIC, L2 dan koordinator sesuai aturan. Kepala Bidang dapat memprioritaskan, menyediakan pengganti sementara atau meminta rencana pemulihan. Kepala Perangkat Daerah menangani hambatan sumber daya lintas bidang sesuai kewenangan. Intervensi adalah command dengan alasan, target, pelaksana dan audit; tidak mengedit timestamp atau riwayat untuk memperbaiki angka kinerja. Perangkat kembali diuji oleh teknisi internal sebelum resolve dan konfirmasi pemohon.

Untuk lintas OPD, pisahkan requester_org_id, service_owner_org_id dan handling_team_id. Membership OPD tidak otomatis memberi hak membaca semua tiket OPD. Tetapkan role koordinator dan scope eksplisit. Transfer lintas OPD menggunakan permintaan handoff, penerimaan tim tujuan lalu perubahan pemilik penanganan secara atomik di M3. Sampai diterima, tim asal tetap bertanggung jawab. Akses lama dicabut atau diberi masa delegasi eksplisit. Riwayat organisasi disimpan sebagai snapshot agar mutasi pegawai dan restrukturisasi tidak menulis ulang histori. Diskominfo dapat menjadi pengelola platform, sedangkan tiap pemilik layanan mengelola katalog dan kebijakannya sesuai mandat.

## 20 Hak akses dan tindakan berisiko

Keputusan izin menggabungkan role, permission, scope OPD/tim, hubungan dengan tiket, visibility dan keadaan bisnis. Role mempermudah pemberian permission, tetapi bukan satu-satunya pemeriksaan. Setiap binding mempunyai tanggal berlaku, pemberi, alasan dan revocation. Hierarki organisasi tidak otomatis mewariskan akses detail. Pimpinan mendapat agregat sesuai scope dan membuka detail hanya bila mempunyai izin khusus yang relevan.

| Role operasional | Izin utama | Batas dan pemisahan tugas |
|---|---|---|
| Tamu dan pemohon | Membuat dan membaca tiket sendiri; konfirmasi, feedback, lampiran berizin | Capability atau identitas sah; tidak melihat internal notes |
| Operator Helpdesk | Verifikasi, klarifikasi, kategori, disposisi sesuai antrean | Tidak mengubah izin atau menghapus permanen |
| Teknisi L1 | Menangani tugas, work log, diagnosis, resolve, ajukan L2/vendor | Tidak final close atas nama pemohon; tidak mengubah policy SLA |
| Teknisi L2 | Penanganan lanjutan dan koordinasi vendor yang didelegasikan | Scope kasus/tim, bukan seluruh organisasi |
| Koordinator layanan | Reassign, persetujuan pause, prioritas dan eskalasi sesuai mandat | Override wajib alasan; tidak memalsukan waktu historis |
| Kepala Bidang dan Kepala PD | Monitoring dan intervensi dalam scope yang diberikan | Detail sensitif memerlukan permission terpisah; tanpa SQL/admin bypass |
| Admin OPD | Master dan membership terbatas OPD | Tidak dapat memberi role lebih tinggi dari grant ceiling sendiri |
| Admin platform dan Super Admin | Konfigurasi platform; Super Admin dapat mengajukan purge terkendali | Akses isi tiket, approval purge dan restore tidak otomatis dimiliki |
| Editor dan publisher | Draft, review dan publikasi konten yang ditugaskan | Publikasi data dari tiket perlu sanitasi dan izin terpisah |
| Auditor | Baca audit dan laporan sesuai mandat | Tidak mengubah log, state tiket atau permission |
| Vendor eksternal | Pembaruan kasus yang secara eksplisit dibagikan bila portal vendor diaktifkan | Default koordinasi oleh PIC internal; akses vendor tidak wajib untuk tahap awal |

Contoh permission yang harus diturunkan ke kontrak adalah ticket.verify, ticket.assign, ticket.resolve, ticket.confirm, ticket.pause.approve, ticket.intervene, report.export, content.publish, media.reuse, identity.role.grant, system.maintenance.manage dan data.purge.request. Action dan resource dipetakan pada server. Akun teknis/job tidak memakai Super Admin dan hanya mendapat command serta scope yang diperlukan.

Pengguna selain Super Admin hanya boleh mengarsipkan data sesuai izin. Pengarsipan menyimpan archived_at, archived_by dan alasan; objek tetap tersedia bagi audit dan referensi historis. Super Admin merupakan satu-satunya role yang boleh meminta penghapusan permanen melalui workflow khusus, bukan tombol DELETE langsung pada semua tabel. Purge mensyaratkan retensi terpenuhi, tidak ada hold/ketergantungan aktif, tinjauan dampak, persetujuan pihak berbeda dan audit. Jika syarat belum diputuskan, purge dinonaktifkan. Immutable audit tidak dihapus melalui CRUD umum. Master yang masih dipakai di-inactive, dan pemulihan arsip memeriksa konflik kode serta validitas referensi.

## 21 Media konten pencarian dan notifikasi

### Pustaka media dengan akses terpisah

Semua unggahan muncul pada Pustaka Media sesuai hak pengunggah dan pengguna. Tampilan terpadu memakai referensi owner_module dan asset_id. Metadata lampiran kasus tetap milik M3, sedangkan aset editorial milik M8. Kedua owner menggunakan komponen storage/scan yang sama, dengan namespace, ACL dan kredensial yang dibatasi. UI menggabungkan hasil endpoint berizin dalam tab “Media tiket” dan “Media konten”, dengan cursor serta total per tab. Tidak ada query lintas schema atau endpoint yang mengambil semua blob tanpa izin.

Mengunggah melalui form langsung membuat aset pada owner konteksnya lalu menghubungkannya ke draft/konten. Asset reference mencatat pemakai, versi dan visibility. Konten dapat memilih aset yang memiliki permission media.reuse serta audience kompatibel. Berbagi media tidak otomatis menjadikannya publik. Lampiran privat tiket tidak dapat dipasang langsung pada halaman publik. Publikasi dari bukti kasus membuat salinan tersanitasi, approval dan provenance baru di M8. Link unduh memeriksa izin terkini serta status CLEAN, termasuk setelah delegasi dicabut. Deduplikasi checksum tidak boleh membocorkan keberadaan file milik pengguna lain.

M2 menyimpan kebijakan unggah per konteks dengan allowlist jenis, batas ukuran/jumlah dan versi. Server menguji ekstensi, MIME dan signature, memakai nama acak serta quarantine sebelum rilis [S25]. Metadata terdiri atas nama tampilan, deskripsi, alt text, caption, pemilik, sumber/lisensi, checksum, ukuran, dimensi, audience dan status pemakaian. SEO hanya berlaku bagi konten publik yang disahkan, bukan indeks lampiran privat. Video mempunyai poster dan caption bila dipublikasikan; transcoding berat masuk pekerjaan terjadwal dengan resource tercatat. File yang dipakai tidak boleh dipurge sebelum referensi aman. Backup metadata harus konsisten dengan manifest blob.

### Konten portal dan pencarian

M2 mengelola registri fitur, menu, urutan, route dan audience. M8 mengelola isi halaman, artikel, revisi dan aset editorial. Halaman melalui DRAFT, REVIEW, PUBLISHED dan ARCHIVED dengan preview berizin serta rollback versi. Pengaturan portal tidak mengizinkan JavaScript/HTML arbitrer atau perubahan role lewat menu. Editor memakai blok terbatas, heading semantik, daftar, tautan dan gambar dengan sanitasi server, preview, undo serta riwayat. Kebutuhan tampilan yang khas diwujudkan melalui konsistensi dan kemudahan pakai, bukan toolbar yang mengaburkan tugas penulis.

Pencarian global memiliki tab Layanan, Tiket, Artikel dan Media. Debounce, pembatalan query lama, limit dan paginasi berlaku per owner. Authorization diterapkan sebelum menghasilkan judul, snippet, suggestion, count dan export. Konten privat tidak dimasukkan ke indeks publik. Indeks yang stale tidak mengesahkan akses lama; server memeriksa permission terkini sebelum mengembalikan hasil. Untuk tahap awal, pencarian owner memakai PostgreSQL dan endpoint masing-masing. Search engine terpisah hanya dipertimbangkan setelah kebutuhan terukur dan ditambahkan identik pada seluruh model.

### Pusat notifikasi dan Telegram

M9 menyediakan daftar notifikasi per pengguna, read/unread, filter, preferensi kanal, prioritas, template berversi dan log pengiriman. Status tersimpan, terkirim ke provider dan dibaca pengguna adalah keadaan berbeda. Isi pesan eksternal minimal berupa nomor tiket, jenis perubahan dan tautan aplikasi yang tetap memerlukan login; jangan kirim capability, PII, lampiran atau catatan internal secara otomatis.

Telegram Bot API mengirim ke chat_id atau target yang didukung API, bukan langsung ke nomor telepon [S24]. Pengguna menghubungkan akun melalui tantangan sekali pakai yang terikat sesi lalu memverifikasi chat tujuan. Grup tim memerlukan persetujuan administrator berwenang dan pengecekan audience. Binding menyimpan chat_id, owner/scope, verified_at, enabled dan versi. Rahasia bot disimpan di secret store, bukan pada form ekspor konfigurasi. Perubahan tujuan diaudit. Terapkan antrean, retry terbatas, backoff, dead-letter dan penanganan rate limit. Replay internal dedup berdasarkan event dan penerima; pengiriman eksternal dapat tetap duplikat setelah timeout provider sehingga tidak menjanjikan exactly-once. Lab menggunakan sink deterministik yang sama di semua model.

## 22 Standar komponen React dan pengelolaan sistem

| Komponen yang diminta | Spesifikasi yang dapat diuji |
|---|---|
| Data table | Bulk selection, pagination, page size, sort, search, filter dan export server-side; label jelas antara pilih halaman ini dan seluruh hasil filter. Bulk action per objek memakai izin/version dan laporan partial failure. |
| Grafik interaktif | Tooltip dan drill-down tersedia juga lewat keyboard/tabel; filter dan denominator konsisten. Library dipilih setelah evaluasi fitur, aksesibilitas dan lisensi, lalu dipin sama untuk semua model. |
| Kartu dan layout media | Kartu simetris untuk data seragam; bento untuk ringkasan prioritas; masonry opsional untuk media dengan urutan baca DOM yang tetap masuk akal. |
| Accordion | Maksimal satu panel terbuka per grup, aria-expanded dan navigasi keyboard; error di panel tertutup membuka panel terkait. |
| Combo box | Pencarian, keyboard, multi-select sesuai kebutuhan, clear, loading dan empty state seperti fungsi Select2; gunakan implementasi React yang sesuai design system. |
| Toast | Aksi pengguna mendapat feedback ringkas dan aksesibel; error penting juga menetap dekat field. Autosave tidak mengirim toast setiap ketikan. |
| Scrollbar | Tipis dan sesuai tema bila platform mendukung; tetap terlihat dan mudah dioperasikan. Jangan menonaktifkan scrollbar native yang dibutuhkan pengguna. |
| Editor | Blok semantik, sanitasi, undo, preview, versi dan alt text; konten yang ditempel tidak membawa script/style berbahaya. |
| Upload | Dropzone, tombol pilih file, progress, cancel/retry, daftar error dan status scan; drag-and-drop bukan satu-satunya cara. |
| Modal | Tengah layar, backdrop blur, background inert dan scroll halaman terkunci; isi modal panjang tetap dapat discroll. Mode fullscreen, fokus terperangkap dan kembali ke pemicu setelah tutup [S26]. |
| Form | Label, bantuan, error summary, validasi client/server, review dan draft recovery; spinner tidak menggantikan status kegagalan. |
| Komponen pelengkap | Breadcrumb, status badge dengan teks, timeline, date/time picker WIB, pagination, empty/loading/error, panel filter, confirmation dialog dan indikator koneksi. |

Klik luar modal menutup modal baca-saja. Untuk form, penutupan melalui backdrop, Escape atau tombol tutup harus memastikan draft sudah tersimpan atau menawarkan simpan/buang/batal. Untuk operasi irreversible, klik luar tidak menyetujui tindakan. Pola fokus, keyboard dan semantik modal mengikuti panduan WAI-ARIA [S26]. Fullscreen tidak menghapus tombol tutup atau ringkasan error. Dialog konfirmasi tindakan berisiko memperlihatkan objek dan akibatnya, bukan hanya “Yakin?”.

Draft akun tersimpan pada owner konteks, misalnya M3 untuk tiket dan M8 untuk artikel, dengan principal, form_version, revision, updated_at dan expiry. Simpan setelah jeda input dan sebelum penutupan terkontrol. Optimistic concurrency mencegah tab kedua menimpa tanpa peringatan. Draft lokal offline dibatasi field yang diizinkan dan dipisahkan menurut identitas; jangan simpan password, token, capability atau file rahasia di localStorage. Untuk perangkat bersama atau isi sensitif, gunakan server draft dan peringatkan keterbatasan ketika offline. Tamu memilih penyimpanan lokal setelah informasi risiko. Lampiran hanya dinyatakan tersimpan setelah upload diakui. Ketika login berganti, logout atau draft kedaluwarsa, cache terkait dibersihkan. Pengiriman akhir memvalidasi ulang policy dan memakai key idempotensi yang stabil, bukan membuat tiket otomatis saat koneksi pulih.

| Area sistem | Pengelolaan dan batas operasi |
|---|---|
| Pemeliharaan | M1 menyimpan jadwal, scope, pesan publik dan kebijakan read-only; middleware menerapkan versi yang sama. Pengecualian admin khusus diaudit. Worker in-flight dan drain diatur eksplisit. |
| API dan integrasi | M1 memiliki client/scopes/credential references; tiap owner menegakkan scope. UI memperlihatkan dokumentasi, status integrasi dan rotasi yang memerlukan otorisasi; tidak menampilkan secret lama. |
| Kesehatan sistem | Halaman admin menggabungkan health teredaksi, queue lag, storage dan freshness. Endpoint publik tidak mengungkap topologi atau credential. |
| Backup dan restore | M1 mencatat permintaan dan hasil job dari runner operasional terpisah. Service aplikasi tidak diberi Docker socket, shell arbitrer atau superuser DB. Restore memerlukan target eksplisit, persetujuan dan uji di lingkungan terisolasi. |
| Audit | Owner menyimpan intent transaksi; M9 mengumpulkan actor, action, object, scope, outcome, reason dan correlation. Login serta perubahan permission tercatat tanpa password/token. |
| Laporan dan ekspor | M9 mengelola job terikat snapshot filter/scope dan TTL. Izin diperiksa lagi saat download; formula injection CSV dicegah dan ekspor besar tidak dimuat seluruhnya di browser. |

Runner backup adalah sarana operasional di luar sembilan modul bisnis, bukan microservice kesepuluh di jalur workload. Resource dan jadwalnya harus sama atau job dimatikan sama selama window benchmark dengan alasan tercatat. Scanner, storage, monitoring dan classifier juga masuk inventaris dependensi serta anggaran. Penambahan infrastruktur tidak boleh membuat total 4000m/8192MiB seolah masih cukup tanpa pilot ulang. Halaman konfigurasi adalah produk; wewenang mengeksekusi operasi berbahaya tetap pada runner berizin dengan kontrak sempit.

Kinerja teknisi dilaporkan dengan jumlah tiket eligible, completion, first response, umur backlog, reopen, kualitas resolusi, waktu kerja tercatat dan vendor wait. Kepatuhan SLA menggunakan cohort yang jelas dan menampilkan tiket terbuka yang sudah breach. Jangan merangking teknisi hanya dari jumlah tiket selesai karena kompleksitas, tugas bersama dan penugasan berbeda. Ekspor memuat periode, timezone, filter, waktu data dan policy version agar laporan dapat direproduksi.

## 23 Kontrak tambahan dan kriteria penerimaan

Data tambahan harus masuk migrasi yang sama pada M0, C3, F9 dan G-OPT-MS. M3 menambah ticket_verifications, resolution_attempts, confirmation_events, work_logs, vendor_cases, handoff_requests, pause_intervals dan drafts. Unique resolution attempt aktif per tiket serta command dedup melindungi auto-close. tickets menyimpan verification_status, requester_org_id, service_owner_org_id, work_state dan current_resolution_attempt_id. M5 menyimpan skill/roster. M6 menyimpan stage_targets dan SLO definitions. M8 menambah content_pages, media_assets, media_references dan drafts. M9 menambah notification_bindings, template_versions, export_jobs dan visitor_aggregates. Owner M1/M2 menambah master sesuai Bab 16. Kolom ini merupakan spesifikasi kontrak, bukan bukti migrasi telah berjalan.

| API tambahan usulan | Owner dan hasil | Guard utama |
|---|---|---|
| POST /tickets/{id}/verify | M3, 200 atau 409 | Operator berizin, expected_version, keputusan dan alasan |
| POST /tickets/{id}/dispatch | M3 dengan proposal M5, 200 atau 409 | VERIFIED, routing version, tim sah dan CAS |
| POST /tickets/{id}/resolution-attempts | M3, 201 | Teknisi aktif, catatan hasil, bukti dan due_at 24 jam |
| POST /tickets/{id}/confirmation | M3, 200 atau 409 | Pemohon/capability dengan permission, attempt aktif, accept/reject/feedback |
| POST /tickets/{id}/vendor-cases | M3, 201 | PIC, vendor, next follow-up dan data yang boleh dibagikan |
| POST /tickets/{id}/handoffs | M3, 201 | Scope asal, target valid; penerimaan melalui command terpisah |
| GET /media?owner=... | M3 atau M8 via route owner, 200 | Tab owner eksplisit, ACL sebelum count dan pagination |
| PUT /drafts/{id}?owner=... | Owner konteks, 200 atau 409 | Principal, revision, form_version dan TTL |
| POST /reports/exports | M9, 202 | Filter dan scope snapshot, job ID, otorisasi download terkini |
| POST /admin/system/operations | M1, 202 | Jenis operasi allowlist, approval dan runner scoped |

Endpoint resolve lama pada /transitions menjadi alias untuk command resolution yang sama dan menghasilkan resolution attempt. close hanya untuk konfirmasi sah atau job auto-close; teknisi yang memanggil close langsung ditolak. Implementasi OpenAPI harus memilih kontrak final sebelum freeze dan memeriksa kompatibilitas alias agar tidak muncul dua jalur yang berbeda semantik. Semua endpoint mutasi memakai idempotency dan expected_version sesuai aggregate. Event baru antara lain TicketVerified, AssignmentChanged, ResolutionProposed, ResolutionRejected, TicketClosed, VendorCaseUpdated, HandoffAccepted, ContentPublished dan MediaReleased, dengan schema version, actor/scope minimum dan pengiriman sesuai stream yang terdefinisi.

| ID | Skenario penerimaan tambahan | Hasil yang wajib dibuktikan |
|---|---|---|
| AC13 | Dispatch sebelum/sesudah verifikasi dan override kategori | Sebelum VERIFIED ditolak; kategori dan alasan final tersimpan |
| AC14 | Resolve, setuju, tanpa respons, menolak, feedback biasa | Deadline 24 jam kalender; endpoint SLA benar; feedback menahan auto-close |
| AC15 | Auto-close bersamaan reject serta job upaya lama | Satu transisi sah; upaya lama tidak menutup upaya baru |
| AC16 | Vendor terlambat dan pause tumpang tindih | PIC tetap ada; gross/net terpisah; pause tak berizin ditolak |
| AC17 | Handoff lintas OPD serta pencabutan delegasi | Owner lama bertanggung jawab sampai diterima; akses lama dicabut sesuai policy |
| AC18 | Unggah dari form lalu pilih di pustaka media | Satu aset owner; ACL reuse; lampiran privat tidak menjadi publik |
| AC19 | Putus jaringan, tab bersaing dan pergantian akun | Draft pulih tanpa overwrite diam-diam; tidak bocor ke akun berikutnya |
| AC20 | Modal, combo box, tabel dan grafik dengan keyboard | Fokus/label terbaca; tindakan tidak bergantung hover/drag saja |
| AC21 | Telegram binding salah scope, retry dan revoke | Tujuan tidak sah ditolak; secret tersensor; delivery gagal terlihat |
| AC22 | Arsip, restore arsip dan purge non Super Admin | Histori terjaga; purge ditolak; syarat referensi/approval diperiksa |
| AC23 | Search/export/analytics setelah hak dicabut | Tidak membocorkan count, snippet, file atau agregat terlarang |
| AC24 | Konfigurasi portal dan job operasional | Menu tidak memberi hak baru; tidak ada eksekusi shell bebas |
| AC25 | Parity perluasan fitur di empat model | Kontrak/state/fitur sama; dependency dan resource baru tercatat |

Paket implementasi pertama mencakup identitas/scope, master minimal, verifikasi, dispatch, lifecycle dan SLA konfirmasi. Paket kedua mencakup vendor/handoff, pustaka media, draft dan workspace per role. Paket ketiga mencakup portal, notifikasi, laporan dan administrasi sistem. Seluruh fitur yang dinyatakan bagian aplikasi harus tersedia setara sebelum kampanye arsitektur. Headline workload boleh berfokus pada workflow terpilih yang diumumkan, sedangkan hasil tidak digeneralisasi ke fitur yang tidak diukur. Setiap fitur background yang aktif dicatat beban dan jadwalnya.

Pemilik proses menetapkan katalog resmi, scope pimpinan, batas delegasi, kalender dan target tahap, kondisi pause vendor, jendela reopen, pemberitahuan konfirmasi, retensi/purge, batas upload, penyedia identitas dan target pemulihan. Usulan teknis di bab ini dapat diimplementasikan sebagai fixture sintetis lebih dahulu. Nilai yang memerlukan keputusan organisasi tidak diklaim sudah berlaku di Pemerintah Kota Depok.
