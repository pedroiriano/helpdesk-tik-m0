**Prompt pelaksanaan RM0-03 — SLA, recovery, laporan, operasi dan resource**

Laksanakan RM0-03 sampai seluruh acceptance fase terbukti pada jalur normal aplikasi. Gunakan Bahasa Indonesia serta Explore → Analyze → Plan → Execute → Verify → Refine. Bekerja presisi, aman dan hemat token dengan minimum test set yang membuktikan requirement.

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`, acuan penelitian `D:\Jurnal\Microservices`. Temuan utama F08, F09, F10, F11, F12 dan F15. Modul utama M6/M7/M9, M1 untuk administrasi, serta M3 sebagai writer tiket. Acceptance utama AC03, AC05, AC08, AC10, AC14, AC15, AC16, AC17, AC21, AC22, AC23 dan AC24.

**1. Prasyarat dan baseline**

Acuan canonical adalah `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`, `docs/01_BLUEPRINT_M0.md`, `docs/02_ATURAN_PEMBANGUNAN.md` dan `docs/03_PANDUAN_AGENT_AI.md`.

Baca `AGENTS.md`, README/checkpoint, `planning/remediation_backlog.csv`, rencana lima fase, audit 10 November, blueprint/aturan/panduan agent, kontrak acceptance/feature coverage, permission/state/event/calendar terkait, `planning/decisions.csv`, `configs/M0.json`, `compose.yaml`, technology lock dan runbook operasi/recovery yang aktual.

Verifikasi bukti RM0-01 dan RM0-02, khususnya `qa/remediation/rm0-02/completion.json`, source hash, state machine, kontrak event assignment serta scope yang akan dipakai SLA/laporan. Ketidaksesuaian status atau source menjadi gap dependency yang harus diselesaikan/ditahan secara faktual sebelum operasi yang bergantung padanya. Source yang sudah diperbaiki tidak perlu dikerjakan ulang bila bukti masih berlaku.

Inventaris clock, policy snapshot, episode, pause, resolution attempt, notification proof, jobs/inbox/outbox, report facts, export, health dan resource. Baca hanya file/rentang yang relevan. Tentukan expected result menggunakan clock terkontrol dan dataset sintetis yang tidak bergantung tanggal tes. Semua durasi memakai timezone/unit yang eksplisit.

**2. Invariants**

Satu proses Go M0, public port antarmodul, transaksi owner terpisah. M3 menulis state tiket, attempt dan history. M6 menyediakan perhitungan/projection, M7 menjadwalkan tindakan berizin, M9 menyimpan notifikasi/audit/report facts. Efek consumer dan inbox commit sebelum ACK. Channel/goroutine hanya wake-up durable work.

Jangan membuat metrik, notification proof, job SUCCEEDED, health HEALTHY, atau watermark dari konstanta demi meloloskan pemeriksaan. Nilai unavailable/unknown/degraded dan kegagalan harus terlihat. Jangan menjalankan shell bebas, purge, restore DB kerja, mengubah secret, atau deploy/mengirim notifikasi produksi. Tes memakai DB/storage disposable dan kanal sink.

Migrasi additive immutable ledger, menjaga compatibility data/projection/job lama. Semua konfigurasi resource/dependency yang berubah dicatat sebagai kontrol penelitian. Jangan mengubah model arsitektur atau merekayasa hasil optimal.

**3. Policy SLA pada entry point nyata F08**

Hubungkan create/verify/transisi terkait ke public port kalkulasi M6 yang memakai snapshot policy layanan, priority, calendar ID/version, hari libur serta target respons/resolusi. Hindari jalur baseline tetap yang mengabaikan serviceID/priority. accepted_at ditentukan server dan durable bersama tiket; perubahan priority atau policy tidak boleh menggeser titik awal secara tersembunyi.

Tentukan efek priority final terhadap target berdasarkan blueprint/keputusan yang sah. Simpan versi/snapshot sehingga tiket lama tetap dapat dijelaskan meski policy layanan diperbarui. CAL-1 memakai zona Asia/Jakarta, batas interval kerja dan hari libur. CAL-247 memakai waktu kalender. Jangan diam-diam menghapus libur saat pembacaan kalender gagal.

Jadikan perhitungan pure dan dapat diuji dengan clock terkontrol. Tangani zero/negative target, timezone parsing, batas tepat, weekend/libur beruntun, rentang lama dan cancellation. Verifikasi hasil melalui HTTP create/verify sesungguhnya, bukan hanya fungsi kalender.

**4. Clock episode, pause dan endpoint F09**

Gunakan sumber canonical untuk gross/net, kalender kerja, approved pause, episode dan endpoint. Gross/net mempunyai definisi serta unit jelas. Coalesce interval tumpang tindih, potong interval sesuai episode/as-of, periksa pause yang belum berakhir, dan cegah interval tidak sah/negatif. Vendor menunggu tidak otomatis menghentikan SLA dan selalu mempunyai PIC internal aktif.

Clock berhenti pada endpoint resolusi/penutupan yang ditentukan policy, sehingga pembacaan esok hari tidak mengubah tiket selesai tepat waktu menjadi breach. Reject/feedback/reopen mengikuti aturan episode blueprint. Jangan mereset accepted_at atau SLA pada reassign/handoff. Periksa histori lama yang belum menyimpan seluruh field dan sediakan compatibility projection yang dapat direkonsiliasi.

Detail tiket, dashboard, export, escalation dan agregasi memakai hasil yang sama. Projection mempunyai source version, as-of serta policy/episode identity. Event versi lama tidak menurunkan fakta. Jangan mencampur durasi kerja dengan durasi kalender ketika menghitung risk/breach.

**5. Scheduler, retry, notification proof dan handoff F10**

Auto-close hanya untuk attempt aktif sesudah 24 jam kalender, dengan bukti notifikasi durable yang sah, tanpa feedback/reject yang menahannya, dan guard aggregate version/attempt/CAS. Job lama tidak dapat menutup attempt baru. Kanal SINK untuk lab tetap eksplisit. Stored notification, provider accepted dan user read mempunyai arti terpisah.

Implementasikan claim bounded dengan lease, reclaim lease kedaluwarsa, cancellation, retry/backoff dan attempt budget. Bedakan error sementara, stale job yang memang sudah tidak berlaku, kegagalan permanen serta integrity error. Dead-letter mempunyai reason, correlation dan replay berizin. Replay mempertahankan identity/digest yang diperlukan dan tidak menggandakan efek. Error scheduler tidak ditelan diam-diam.

Uji proses mati sesudah claim, sesudah efek commit sebelum ACK, notifikasi terlambat, database sementara gagal, lease direbut worker lain, duplicate/out-of-order event dan restart. Job yang stale direkonsiliasi terhadap fakta terbaru secara aman, tanpa memaksakan expected_version yang sudah tidak sah.

Verifikasi vendor/PIC, pause authority, escalation L2/koordinator/pimpinan dan handoff antar-OPD pada jalur bisnis. Owner asal bertanggung jawab sampai acceptance handoff, delegasi lama dicabut atomik oleh M3, dan akses dicabut pada detail/search/media/count/export. Operasi asinkron harus mempunyai status yang dapat dipantau dari UI.

**6. Notifikasi, KPI dan export M9 F11**

Definisikan metrik volume diterima, backlog, selesai, tepat waktu, breach, gross/net dan episode/cohort secara terpisah. Ticket selesai terlambat tidak dihitung memenuhi SLA. Denominator, periode, timezone, exclusion, policy version dan null/empty mempunyai definisi yang dapat diperiksa. Hindari pembagian nol dan persentase rekaan.

Report facts berasal dari event/port owner yang berizin dan membawa fakta waktu yang diperlukan. Watermark merepresentasikan posisi/usia projection yang nyata. Tentukan perlakuan owner saat diterima vs owner setelah handoff sesuai definisi metrik dan scope, tanpa membocorkan data ke organisasi lama yang kehilangan hak.

Export mengikat requester/filter/scope, masa berlaku dan kandidat snapshot yang jelas. Pemeriksaan hak diulang saat status/download diambil. Terapkan sanitasi formula CSV, output escaping, pagination/stream bounded dan no secret/PII di filename/URL/log. Filter scope berlaku sebelum count/snippet/agregasi.

Periksa notification center, sink, binding/verifikasi/revoke dan retry. Jangan menganggap kode verifikasi dari klien membuktikan kepemilikan kanal nyata. Konfigurasi nyata tetap memerlukan keputusan serta otorisasi yang berlaku, dengan semua bagian sink yang independen dituntaskan.

**7. Job administrasi, health dan recovery F12**

Gunakan state REQUESTED/APPROVED/QUEUED/RUNNING/SUCCEEDED/FAILED sesuai hasil aktual. Status SUCCEEDED memerlukan receipt eksekusi. Approval dibuktikan oleh aktor terautentikasi yang berwenang dan objek/versi yang disetujui, bukan UUID lain dalam body requester. Target organisasi/job harus sesuai scope. Idempotency dan audit diterapkan.

Runner hanya menjalankan operasi allowlist dengan parameter tervalidasi dan batas waktu/resource. Tidak ada shell arbitrary, SQL bebas atau endpoint debug berprivilege. Archive/restore arsip mempunyai policy dan referensi yang sah. Purge tetap disabled selama keputusan retensi/hold/approval belum lengkap. Jangan mencatat purge berhasil saat hanya request tersimpan.

Health mengukur dependency/owner pool/scanner/storage/worker/projection lag yang relevan dengan timeout, status serta error redacted. Bedakan liveness, readiness dan diagnostics. Jangan mengklaim scanner/storage sehat dari Ping satu pool database. Endpoint health tidak membocorkan DSN, key, path rahasia atau payload tiket.

Recovery drill memakai sumber dan target disposable yang diverifikasi sebelum mutasi. Cadangkan metadata, blob, ledger/config yang diperlukan, checksum serta manifest. Pulihkan ke target terisolasi dan buktikan referensi file, akses, snapshot/event/job serta hasil baca sesudah restart. Ukur RPO/RTO aktual dengan dataset yang disebut. Angka kecil dari fixture tidak menjadi jaminan kapasitas produksi.

**8. Resource envelope dan fairness F15**

Hitung budget layanan tetap dan job sementara dari konfigurasi aktual, termasuk scanner/gateway sesuai protokol. Selaraskan manifest, Compose, technology lock, runbook dan dokumen kandidat. Jangan mengurangi scanner di bawah kebutuhan agar angka budget tampak cocok atau menaikkan budget diam-diam.

Jika batas total dan kebutuhan runtime bertentangan, dokumentasikan pengukuran, opsi, pengaruh penelitian dan keputusan yang diperlukan. Lanjutkan koreksi independen, tahan klaim budget conformant sampai keputusan sah tersedia. Perubahan baseline harus dapat diterapkan setara untuk perbandingan C3/F9/G-OPT kelak. Tidak ada benchmark/keunggulan arsitektur yang diisi dari perkiraan.

**9. Acceptance dan pemeriksaan proporsional**

| ID lokal | Kriteria pembuktian |
|---|---|
| R3-A | CAL-1/CAL-247, holiday/boundary/weekend dan priority/policy berbeda benar melalui HTTP create/verify |
| R3-B | Gross/net, pause overlap, vendor/PIC, resolved endpoint, reject dan reopen konsisten pada detail/laporan |
| R3-C | Auto-close guarded 24 jam, notification proof, race feedback/reject/job lama dan satu pemenang CAS terbukti |
| R3-D | Reclaim lease, retry/backoff, dead-letter/replay, restart dan lost ACK pulih tanpa efek ganda |
| R3-E | Handoff/eskalasi mempertahankan tanggung jawab dan mencabut hak lama di seluruh permukaan |
| R3-F | Dataset tepat waktu/terlambat/open/reopen/handoff menghasilkan KPI, denominator/watermark serta export yang benar dan berizin |
| R3-G | Sink/binding/revoke/error delivery nyata terlihat tanpa mengirim notifikasi produksi |
| R3-H | Job/approval/health/backup-restore memakai eksekusi dan probe nyata, scoped, redacted serta terisolasi |
| R3-I | Budget/digest/dependency manifest cocok runtime yang diperiksa atau gap keputusan tetap eksplisit |
| R3-J | Data/migrasi/job lama, consumer UI dan kontrak tetap kompatibel; bukti kandidat/source tersedia |

Gunakan unit pure calendar dan integration PostgreSQL disposable dengan controlled clock serta fault injection. Baca `scripts/test_m0_06.py`, `scripts/test_m0_07.py`, `scripts/test_m0_10.py`, `scripts/test_m0_11.py`, `scripts/test_m0_12_shutdown.py` dan `scripts/drill_m0_11_restore.py` sebelum memilih cakupan. Verifikasi target isolasi dan mutasi script. Jangan menjalankan ulang seluruh suite jika bukti affected tests sudah cukup.

Command dasar yang dipilih sesuai perubahan dapat meliputi `python scripts/build_business_contracts.py --check`, `python scripts/check_boundaries.py`, `npm.cmd --prefix frontend run build`, `python scripts/test_piui_build.py` dan Go tests package terdampak dari `backend`. Uji race pada jalur concurrent yang berubah. Perubahan DDL/roles memakai gate migrasi disposable dan ledger lokal yang terpisah. Rebuild hanya service terdampak, verifikasi gateway/browser serta restart lokal yang scoped. Keberhasilan build atau health tidak menggantikan R3-A–R3-J.

**10. Evidence, pemulihan dan penutupan**

Simpan `completion.json`, source manifest, test/HTTP/browser/recovery reports tersensor di `qa/remediation/rm0-03/`. Catat R3-A–R3-J, disposition F08–F12/F15, expected/actual, clock/dataset, command/cwd/exit/result/report path, SHA+dirty state atau hashes, migration/checksum, konfigurasi/build identity, keputusan serta batas verifikasi. Manifest source tidak menghash dirinya sendiri.

Append `status/evidence.jsonl`, perbarui baris RM0-03 pada backlog remediasi, checkpoint, runbook relevan dan handoff. Pisahkan bukti lab/disposable dari aplikasi lokal dan keputusan domain/produksi. Gunakan status faktual, tidak mengubah FAIL menjadi PASS karena sulit direproduksi. Saat alat tidak tersedia, lanjutkan bagian independen dan pertahankan gap yang belum terbukti. Saat sesi terhenti, periksa source/hash serta receipt operasi sebelum retry.

RM0-03 DONE_VERIFIED hanya jika kriteria yang berlaku terbukti dan blocker correctness/resource fase tertutup sesuai scope yang disahkan. Laporkan changed, tests, security, risiko, keputusan tertahan serta langkah berikut secara ringkas. Berhenti setelah RM0-03. Jangan otomatis memulai RM0-04.
