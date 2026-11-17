**Prompt pelaksanaan RM0-05 — Kandidat final, acceptance, UAT manusia dan keputusan rilis**

Laksanakan RM0-05 sampai seluruh pekerjaan teknis yang diotorisasi selesai dan keputusan manusia yang diwajibkan mempunyai bukti sah atau status tertahan yang jelas. Gunakan Bahasa Indonesia, presisi, keamanan dan integritas data. Terapkan Explore → Analyze → Plan → Execute → Verify → Refine serta verifikasi proporsional dengan satu full gate pada kandidat source final.

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Rujukan metode penelitian berada di `D:\Jurnal\Microservices`. Scope mencakup M1–M9, seluruh 17 temuan audit, matriks UI, kebutuhan FR yang berlaku dan AC01–AC25 menurut batas implementasi M0. F13/F14 memperoleh penutupan kandidat serta penerimaan manusia yang disyaratkan.

**1. Acuan dan gate masuk**

Acuan canonical adalah `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`, `docs/01_BLUEPRINT_M0.md`, `docs/02_ATURAN_PEMBANGUNAN.md` dan `docs/03_PANDUAN_AGENT_AI.md`.

Baca `AGENTS.md`, README/checkpoint, `planning/remediation_backlog.csv`, rencana lima fase, audit 10 November, blueprint/aturan/panduan agent, `contracts/acceptance.csv`, `contracts/feature_coverage.csv`, registry modul, manifest/config/resource, decisions, technology lock, kontrak API/event/policy, aturan UI serta runbook aktual.

Verifikasi RM0-01–RM0-04 dari completion, source manifest, test reports dan evidence per fase di `qa/remediation`. Status DONE_VERIFIED harus sesuai scope dan source yang diperiksa. Daftar perubahan sejak masing-masing bukti, affected tests dan sisa keputusan perlu ditulis sebelum gate akhir. Jangan menganggap label PASS lama membuktikan kandidat sekarang.

Jika dependency belum lulus, selesaikan investigasi dan pekerjaan independen. Perbaikan terbatas yang relevan dapat dikerjakan pada fase asal dengan evidence-nya, lalu kembali ke kandidat final. Jika pekerjaan ternyata besar atau membutuhkan keputusan belum tersedia, catat PARTIAL/BLOCKED_<ALASAN> beserta bukti dan pemilik. Jangan menjalankan full gate berulang saat source masih berubah.

**2. Batas arsitektur, data dan otorisasi**

Pertahankan satu source M0, satu proses Go modular, sembilan owner dan frontend PIUI. M3 writer tiket, public port antarmodul, transaksi lokal owner dan durable outbox/inbox. Pertahankan ACL pada semua permukaan, keamanan media/draft, versi/CAS/episode/attempt serta compatibility data lama.

Gunakan lab sintetis/sink dan target disposable untuk pengujian mutasi, restore, race dan fault injection. Sebelum perintah yang dapat menulis/menghapus, verifikasi target absolut/proyek Docker/database/volume dan otorisasi yang berlaku. Jangan reset volume kerja, memusnahkan data operasional, merotasi secret, melemahkan permission/CSP, menandatangani dokumen orang lain, mengirim Telegram/email nyata atau deploy produksi dari prompt ini.

Periksa setiap script sebelum eksekusi, khususnya script bernama UAT/smoke/restore yang dapat menulis tiket atau maintenance global. Jika script lama menimpa evidence historis, gunakan opsi output yang benar-benar didukung atau perbaiki isolasi/reporting secara terarah sebelum menjalankannya. Jangan mengarang flag atau mengubah assertions agar lulus.

**3. Tetapkan kandidat yang reproducible F14**

Periksa Git aktual. Bila repository tersedia, catat branch/SHA/dirty state dan diff relevan. Bila belum tersedia, gunakan manifest SHA-256 file source/build/config yang lengkap dan relevan, tanpa membuat SHA/commit fiktif. Jangan menginisialisasi/mendorong Git remote hanya demi label kandidat.

Manifest mencakup backend/frontend/scripts/kontrak/migrasi/seed/config/Docker/runtime lock yang dipakai. Catat versi tool/dependency, image digest, build identity, ledger/checksum, resource envelope, fixture/dataset, timezone/calendar policy dan konfigurasi integrasi. Jangan memasukkan nilai secrets. Exclude output evidence/log/cache/node_modules serta manifest yang mengacu pada hashnya sendiri sesuai definisi kandidat.

Pastikan source yang diuji sesuai build/image yang dijalankan pada gateway. Hash berkas, digest image dan waktu build merupakan bukti dengan scope masing-masing. Jangan menganggap kesamaan tag image membuktikan source sama. Setelah perbaikan final stabil, tetapkan candidate ID lokal yang eksplisit, lalu jalankan gate.

**4. Tutup matriks kebutuhan dan 17 temuan**

Bangun traceability lengkap FR/AC → implementasi/API/UI → test ID → command/report → source candidate → hasil/batas → reviewer/keputusan yang relevan. Setiap temuan F01–F17 mempunyai lokasi perbaikan, kasus gagal awal, regression test, hasil serta closure. Matriks UI audit dan seluruh paket rencana lima fase ikut diperiksa.

Periksa kembali jalur kritis berikut.

| Kelompok | Pembuktian akhir |
|---|---|
| F01–F04 | Auth/register/replay, lab vs non-lab, objek/media/approval/sanitasi dan scope organisasi terbaru aman |
| F05–F07 | State machine, provenance klasifikasi, proposal routing/skill/roster dan commit M3/M5 benar saat concurrency/crash |
| F08–F10 | Policy SLA/calendar/pause/endpoint, attempt/notification proof dan reclaim/retry auto-close konsisten |
| F11–F12 | KPI tepat waktu vs selesai, watermark/export/revocation, job/approval/health/recovery mempunyai fakta sumber |
| F13–F15 | Penerimaan manusia dan keputusan domain terbukti, source/evidence akurat, budget/digest/runtime sesuai |
| F16–F17 | Editorial M8 sinkron publik, Hero lima banner maksimum 100VH serta seluruh kontrol mobile pendek dapat dijangkau |

Tinjau kontrak/runtime coverage, missing handler, unsafe fallback dan feature yang hanya berupa placeholder/demo. Assertion substring, jumlah test, HTTP 200, screenshot tunggal atau readiness tidak menjadi bukti lengkap kebutuhan bisnis. Proyeksi yang tertinggal harus dilabeli dan direkonsiliasi, bukan dipaksa tampak mutakhir.

**5. Gate teknis pada kandidat final**

Susun daftar gate yang sesuai repo dan risiko dari command registry serta script aktual. Jalankan pengujian terdekat selama memperbaiki gap, affected-module setelah feature slice, lalu full candidate gate sekali setelah kandidat stabil. CI terlindungi menjadi otoritas broad final bila tersedia dan source sesuai; jika belum dikonfigurasi catat NOT_CONFIGURED.

Gate mencakup sekurang-kurangnya bidang berikut sesuai requirement yang berlaku.

1. Kontrak API/event/policy/generator sinkron, handler runtime tercakup, schema dan error benar, boundary/negative boundary, module/resource manifest.
2. Backend build/vet/unit dan affected integration; race pada jalur concurrent, CAS, retry/idempotency/lost response, transaction rollback serta cancellation.
3. DDL/roles/schema ownership/ledger/checksum/migration replay dan compatibility data lama pada PostgreSQL disposable.
4. Auth/authorization negatif, expiry/revocation dan scope pada detail/list/search/count/snippet/export/media/download, termasuk peran konfigurasi tanpa hak tiket implisit.
5. Upload bounded/quarantine/scan/MIME/hash/ownership, approval/sanitasi/provenance reuse, draft offline/tab/account isolation.
6. Lifecycle penuh, roster/routing, SLA/calendar/pause/vendor/handoff, resolution attempt, confirmation/feedback/reject dan auto-close race 24 jam.
7. Outbox/inbox/dedup/ordering, reclaim lease, retry/backoff/dead-letter/replay, restart dan graceful shutdown/recovery yang terisolasi.
8. KPI/report/export/sink/binding/revoke, scoped job/approval, diagnostics redacted dan backup/restore data+blob+ledger dengan hasil ukur nyata.
9. Frontend typecheck/build, PIUI/route/link/cache/intent, API-backed actions, CSP/safe DOM, desktop/mobile/keyboard dan state error/offline/conflict.
10. Secret/dependency/license/image/config/security checks sesuai risiko serta resource envelope yang cocok konfigurasi runtime dan runbook.

Command dasar yang perlu diverifikasi dapat meliputi `python scripts/build_business_contracts.py --check`, `python scripts/check_boundaries.py`, `python -m unittest tests/contract/test_business_contracts.py`, `npm.cmd --prefix frontend run build`, `python scripts/test_piui_build.py`, serta `go vet ./...` dan `go test ./...` dari `backend`. Periksa apakah integration memerlukan env/profile disposable sebelum menjalankannya. Pilih tes fase RM0 dan historical integration/shutdown/owner-migration yang benar-benar membuktikan requirement. Jangan menjalankan smoke mutasi di DB kerja hanya karena namanya lokal.

Pemeriksaan dependency seperti audit/scanner membutuhkan keluaran dan tanggal database yang aktual. Jika jaringan/tool terhalang, catat keterbatasan serta gate yang belum terbukti. Jangan memakai hasil scan lama sebagai kandidat baru tanpa bukti kesesuaian. Jangan menjalankan audit fix --force atau upgrade mayor otomatis.

Jika gate gagal, catat relevant error → perbaiki area sumber → targeted retest → bentuk kandidat baru bila source/config berubah → jalankan ulang gate terdampak dan broad gate sesuai risiko. Evidence lama tetap historis. Setelah gate PASS dan kandidat tidak berubah, jangan mengulang seluruh suite tanpa alasan.

**6. UAT manusia yang dapat direview F13**

Siapkan paket UAT yang konkret dan dapat dijalankan pada lingkungan yang disetujui. Paket berisi kandidat/URL, fixture sintetis, akun/peran yang disediakan secara aman, prasyarat, langkah, expected result, actual result, defect severity, bukti tersensor, nama penguji serta tanggal/status keputusan. Jangan meminta password/OTP/credential melalui chat atau menyimpannya di laporan.

Perwakilan yang diperlukan mencakup pelapor tamu/publik, ASN, operator, koordinator, teknisi, pengelola konten/penerbit, pimpinan, auditor dan admin. Sesuaikan penugasan peran dengan mandat nyata. Persona otomatis tetap dicatat sebagai pengujian skenario otomatis. Pengesahan UAT domain berasal dari manusia yang berwenang.

Skenario minimum meliputi laporan sesuai audience, syarat/form/unggah, receipt dan tracking/draft, operator minta informasi/verify/reject, disposisi/start/resolve, konfirmasi/keberatan, vendor/pause/handoff, pelacakan SLA, notification center, dashboard/export, editorial/media, revocation serta administrasi/operasi aman. Sertakan error/conflict/expired dan akses keyboard/mobile yang relevan. Nilai kelancaran, kejelasan bahasa, waktu menemukan aksi dan kesesuaian SOP.

Jika penguji atau keputusan manusia belum tersedia, tuntaskan seluruh paket dan bukti teknis yang independen, sajikan tindakan persetujuan yang konkret, lalu minta keterlibatan pihak yang diperlukan. Jangan mengisi actual result, nama, tanggal atau tanda tangan atas nama mereka. Elapsed time atau diamnya pengguna tidak menjadi approval.

**7. Keputusan domain, operasi dan riset**

Tinjau `planning/decisions.csv` terhadap bukti keputusan sebenarnya. Pemilik layanan/proses perlu mengesahkan katalog, audience, target/kalender, routing/skill, reopen/feedback, delegasi, vendor/pause, kanal notifikasi, branding, retensi/hold/purge, kapasitas serta RPO/RTO yang relevan. Tulis impact, owner, opsi dan rekomendasi untuk yang belum diputuskan. Jangan menutup keputusan OPEN karena suite otomatis lulus.

Selaraskan README, PROJECT_STATE, backlog awal/remediasi, acceptance/traceability, runbook, handoff dan dokumen otorisasi rilis. Pertahankan tanggal/scope bukti historis dan jelaskan koreksinya. Dokumen rilis berstatus draft sampai pengesahan sah tersedia. Teknis PASS, UAT ACCEPTED dan release AUTHORIZED mempunyai bukti masing-masing.

Kesiapan eksperimen empat arsitektur ditunjukkan oleh baseline kontrak/state/fitur/data/workload/API/auth/dependency/resource yang tercatat dan dapat diterapkan setara. M0 berjalan tidak membuktikan parity runtime C3/F9/G-OPT atau model optimal. Aspek AC/FR yang khusus penelitian dipetakan DEFERRED_RESEARCH sesuai protokol sampai eksperimen yang relevan dilakukan. Jangan mengisi angka benchmark, skor G-OPT atau HELD_OUT dari asumsi.

**8. Acceptance fase**

| ID lokal | Syarat penutupan |
|---|---|
| R5-A | Prasyarat RM0-01–RM0-04 diverifikasi pada source aktual; seluruh 17 temuan dan matriks UI mempunyai closure/evidence |
| R5-B | Candidate/source/build/runtime/config/data/ledger/resource identity dapat direproduksi dan tidak mengandung secret |
| R5-C | Seluruh FR/AC yang berlaku pada M0 terpetakan ke implementasi serta bukti aktual, dengan scope riset dinyatakan benar |
| R5-D | Gate teknis final lulus pada kandidat yang sama; failure/security finding/blocker diselesaikan dengan retest sesuai risiko |
| R5-E | Recovery, restart, concurrency, revocation dan UI normal/error terbukti secara proporsional |
| R5-F | UAT manusia terlaksana, hasil/defect tercatat, perbaikan diverifikasi dan penerimaan oleh pihak berwenang tersedia |
| R5-G | Keputusan domain/operasional wajib dan dokumen pengesahan rilis mempunyai bukti sah sesuai scope yang diminta |
| R5-H | Dokumentasi/handoff konsisten, risiko tersisa eksplisit, serta pernyataan penelitian hanya berdasarkan hasil yang benar-benar diukur |

RM0-05 tidak boleh DONE_VERIFIED jika syarat wajib yang berlaku, termasuk UAT manusia/pengesahan, masih belum tersedia. Catat teknis yang lulus dan status fase PARTIAL atau BLOCKED_<ALASAN> sesuai keadaan. Pengecualian scope hanya berasal dari keputusan berwenang yang terdokumentasi, tanpa mengubah hasil gagal menjadi lulus.

**9. Artefak dan handoff akhir**

Simpan evidence baru di `qa/remediation/rm0-05/`, sekurang-kurangnya `completion.json`, manifest kandidat, traceability seluruh temuan/FR/AC/UI, hasil gate, browser, UAT manusia atau paket UAT berstatus menunggu, daftar keputusan dan batas verifikasi. Nama tambahan disesuaikan kebutuhan, dengan referensi yang valid.

Completion mencatat task/scope/status, R5-A–R5-H, candidate ID, SHA+dirty state atau hashes, image/build/config identity, command/cwd/exit/result/report, timestamp, fixture/viewport, finding disposition, human approval references, unresolved decisions serta keterbatasan. Hindari self-referential manifest dan overwrite evidence historis. Jalur file yang dicantumkan harus benar-benar ada.

Append `status/evidence.jsonl`, perbarui baris RM0-05 dan checkpoint secara faktual. Bila sesi terhenti, periksa kandidat, operasi yang masih berjalan dan evidence terakhir sebelum retry. Jangan menggandakan mutasi atau memulai gate luas dari awal jika bukti yang sama masih valid.

Laporan akhir menyebut hasil teknis, temuan yang sudah/masih terbuka, tests aktual, batas keamanan/UAT, keputusan organisasi serta next action yang konkret. Jangan mengklaim deployment atau pengesahan yang belum dilakukan. Berhenti setelah RM0-05 dan keputusan yang tersedia dicatat. Jangan otomatis memulai fase baru, eksperimen arsitektur lain, deployment produksi atau pengiriman kanal nyata.
