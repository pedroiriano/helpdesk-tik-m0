# Urutan pembangunan Helpdesk M0 dan keterkaitan penelitian

**Acuan koreksi 10 November 2026.** Audit atas pengembangan sampai M0-13 menghasilkan [rencana penyempurnaan lima fase RM0-01–RM0-05](RENCANA_PENYEMPURNAAN_5_FASE.md) dan [backlog remediasi](remediation_backlog.csv). Gunakan keduanya untuk pekerjaan koreksi berikut. Uraian bertanggal 4 November di bawah merupakan snapshot urutan awal. Status kelulusan terkini perlu dibaca bersama [audit aktual](../docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md).

Disusun 4 November 2026 berdasarkan checkpoint aktual. Dokumen ini menjelaskan backlog yang sudah ada, tanpa mengubah status implementasi atau membuat baseline arsitektur baru.

## Mulai berikutnya

**M0-03 telah DONE_VERIFIED untuk identitas/session lab, scope, katalog/form serta master M1/M2.** M0-01/M0-02 tetap selesai pada scope masing-masing. [Handoff M0-03](../status/HANDOFF_M0_03.md) dan [bukti](../qa/m0-03/completion.json) mencatat Go/HTTP/PostgreSQL serta UI representatif. AC06/AC11 global tetap PARTIAL. M0-04 kini DONE_VERIFIED pada scope tiket/lampiran/audit lab; hardening dan restart proses lokal lulus. Lihat [handoff M0-04](../status/HANDOFF_M0_04.md). M0-05 sampai M0-13 tetap NOT_STARTED.

Acuan pekerjaan adalah [backlog](backlog.csv), [checkpoint](../status/PROJECT_STATE.md), [blueprint M0](../docs/01_BLUEPRINT_M0.md), [aturan pembangunan](../docs/02_ATURAN_PEMBANGUNAN.md), [acceptance](../contracts/acceptance.csv), dan [cakupan kebutuhan](../contracts/feature_coverage.csv). ID M0-xx adalah task pembangunan, M1–M9 adalah modul, ACxx adalah acceptance, dan G0–G7 adalah gerbang penelitian. Keempat kelompok ID tersebut berbeda fungsi.

## Urutan pelaksanaan aplikasi

Urutan berikut mengikuti tahap pada blueprint. Dependency adalah prasyarat minimum dari backlog. M0-08 dapat bergantung langsung pada M0-04, tetapi jalur kerja berurutan tetap menyelesaikan M0-05 sampai M0-07 lebih dahulu agar lifecycle inti terbukti sebelum memperluas media dan portal.

| Task | Dependency | Yang dibangun | Bukti minimum sebelum dinyatakan selesai |
|---|---|---|---|
| M0-01 | — | Fondasi Go modular, frontend asli PIUI, PostgreSQL sembilan owner, Docker lokal, dan UI kanonis. Sudah DONE_VERIFIED. | Bukti fondasi dan UI tercatat pada checkpoint. Tidak mengulang bootstrap tanpa perubahan terkait. |
| M0-02 | M0-01 | OpenAPI bisnis executable, kontrak event, migrasi tiap owner, ledger checksum, fixture permission dan state. | Kontrak valid, fixture positif/negatif, migrasi dan isolasi role DB. AC02 AC03 AC06 AC08 sesuai bagian kontrak. |
| M0-03 | M0-02 | Identitas/session lab, guest/publik/ASN dan scope petugas, katalog, form, master admin dengan persistence. | Akses lintas user/OPD ditolak, session kedaluwarsa ditolak, katalog sesuai audience, perubahan master bertahan setelah refresh. AC06 AC11. |
| M0-04 | M0-03 | Buat/lacak/daftar tiket, komentar, internal note, lampiran dasar, idempotency, outbox/inbox dan audit sink. | Satu efek bisnis saat retry/lost response, commit atomik, restart/replay, ACL detail/list/download dan UI nyata. AC03 AC05 AC06 AC07 AC11. |
| M0-05 | M0-04 | Verifikasi operator, klasifikasi M4, override beralasan, assignment M5, rute L1/L2 dan CAS. | Dispatch sebelum VERIFIED ditolak, dua assignment dengan versi sama menghasilkan satu pemenang, riwayat tersimpan. AC04 AC13. |
| M0-06 | M0-05 | Kalender/SLA, resolve, konfirmasi/reject/feedback, scheduler 24 jam, bukti NotificationStored durable. | Batas waktu kalender, attempt aktif, race reject/auto-close, job lama, duplicate event dan restart. AC05 AC08 AC14 AC15. |
| M0-07 | M0-06 | PIC internal, vendor, pause berizin, eskalasi pimpinan dan handoff OPD yang diterima atomik. | PIC tetap ada, gross/net benar, pause tanpa izin ditolak, tanggung jawab berpindah sesudah acceptance, revocation akses. AC06 AC16 AC17. |
| M0-08 | M0-04 | Pustaka media dua owner, scan/quarantine, reuse berizin, draft dan recovery offline/tab/akun. | MIME/ukuran/ACL, media privat tidak menjadi publik, conflict draft terlihat, akun baru tidak membaca draft lama, keyboard. AC07 AC18 AC19 AC20. |
| M0-09 | M0-08 | Konten/editorial, revisi/publish, navigasi, halaman/detail publik, pencarian dan count sesuai scope. | Sanitasi server, audience, revocation, snippet/count tidak bocor, komponen publik kanonis dan keyboard. AC20 AC23 AC24. |
| M0-10 | M0-07 M0-09 | Pusat notifikasi dan sink, verified fake Telegram binding, dashboard, laporan/export, audit dan agregat pengunjung. | Binding/scope/revoke/retry, definisi denominator dan freshness, ACL export saat pengambilan, tanpa pengiriman nyata. AC21 AC23. |
| M0-11 | M0-10 | Maintenance, arsip/restore arsip, guard purge, runner terbatas dan drill recovery terisolasi. | Permission negatif, referensi/retensi/hold/approval, tanpa shell bebas. Purge tetap disabled selama kebijakan belum disahkan. Drill restore hanya di lab terisolasi sesuai otorisasi. AC22 AC24. |
| M0-12 | M0-11 | Integrasi alur lengkap, observabilitas, startup/shutdown dan kandidat final beserta dokumentasi operasi. | Seluruh cakupan M0 AC01–AC25 ditelusuri, gate final pada source tercatat, bukti keamanan/recovery dan perjalanan UI representatif. Bagian perbandingan arsitektur tetap DEFERRED_RESEARCH. |
| M0-13 | M0-12 | UAT manusia bersama pemilik proses dan keputusan domain/rilis. | Acceptance domain, keputusan organisasi serta batas operasi disahkan. AC11 AC25 untuk cakupan M0. Build PASS tidak menggantikan UAT atau otorisasi rilis. |

Pada M0-04 sudah diperlukan keamanan lampiran dasar dan durable audit. Pada M0-06 sudah diperlukan pusat notifikasi durable minimum untuk auto-close. Keduanya tidak boleh ditunda seluruhnya ke perluasan M0-08 atau M0-10. Perluasan tersebut melengkapi kemampuan yang telah digunakan, bukan membolehkan stub lolos acceptance tahap sebelumnya.

## Rincian pekerjaan terdekat M0-02

Kerjakan satu irisan kontrak yang konsisten, dengan urutan berikut.

1. Petakan operasi bisnis dari blueprint dan feature coverage ke owner M1–M9, permission, state transition, event dan AC terkait. Gunakan registry, dependencies, serta command canonical yang sudah ada. Catat gap tanpa mengubah kebutuhan agar cocok dengan skeleton.
2. Lengkapi kontrak OpenAPI bisnis, meliputi request/response, error, actor/scope, pagination, version/CAS dan idempotency sesuai operasi. Sertakan contoh serta validator/tes kontrak yang dapat dijalankan. Handler bisnis tetap dibangun pada slice berikutnya, sehingga validasi kontrak tidak dilaporkan sebagai API bisnis operasional.
3. Tetapkan DDL dan migrasi additive per owner, indeks/constraint dari pola akses, ID monoton dan ledger checksum. Pertahankan sembilan role/pool. Uji apply pada DB disposable terisolasi serta penolakan akses lintas owner. Jangan mereset database kerja.
4. Lengkapi event envelope/payload dan subscription dari workflow, termasuk consumer, dedup, ordering serta ACK. Pertahankan kontrak ResolutionProposed dan NotificationStored yang sudah ada. Definisikan transaksi outbox/inbox dan projection bukti notifikasi tanpa JOIN atau transaksi lintas owner.
5. Lengkapi fixture state/ACL untuk guest capability, publik, ASN, operator, teknisi, pimpinan dan admin sesuai blueprint. Sertakan transisi invalid, akses lintas user/OPD, expired/revoked akses, dan guard konfirmasi 24 jam. Aturan organisasi yang belum final memakai fixture lab berlabel.
6. Jalankan pemeriksaan kontrak, migrasi/role dan fixture terkait. Catat command aktual, hasil, source hash dan acceptance yang terbukti pada evidence. Perbarui backlog/checkpoint hanya setelah bukti tersedia. M0-02 selesai tidak otomatis menyelesaikan implementasi retry, worker atau scheduler M0-04/M0-06.

Kontrak dapat berkembang secara additive dan berversi ketika slice bisnis menemukan kebutuhan yang sah. Freeze eksperimen dilakukan kemudian pada gerbang penelitian G4, sesudah correctness dan parity terbukti.

## Aturan tetap pada setiap slice

- Implementasikan kontrak, use case, persistence, API, UI dan error states yang relevan sampai tersambung. Loading, empty, forbidden, conflict dan offline termasuk penerimaan. Jangan menandai fitur selesai dari halaman contoh atau toast sukses tanpa efek server.
- Gunakan HTML/CSS/JS/komponen/aset asli PIUI yang sudah terintegrasi. Publik mengikuti [aturan UI kanonis](../docs/05_ATURAN_UI_UX_WEB_PUBLIK.md) dan stylesheet/shell bersama, termasuk halaman detail. Admin tetap menggunakan PIUI Zero.
- M0 tetap satu proses Go dan satu build frontend. M3 satu-satunya penulis state tiket. Tiap owner memakai role/pool sendiri, tanpa impor privat sibling, SQL/FK/transaksi lintas owner atau HTTP loopback palsu.
- Pertahankan port lokal yang dikonfigurasi pada Compose. Periksa ulang benturan jika ada perubahan port atau layanan, tanpa mengubah kontainer lain yang sehat.
- Ikuti [keputusan terbuka](decisions.csv). SSO, verifikasi guest, kalender/SLA resmi, scope pimpinan, retensi, kanal nyata dan RPO/RTO memerlukan pemilik keputusan pada gate masing-masing. Lab sintetis boleh berlanjut, tetapi bukan kebijakan resmi Depok.
- Jalankan tes terdekat sesuai risiko. Auth/SQL/event/upload/concurrency memerlukan tes negatif dan integrasi yang relevan. Gate luas hanya pada kandidat final. CI belum dikonfigurasi dan UAT belum dilakukan menurut checkpoint saat dokumen ini disusun.
- Versioning sumber dan CI harus ditata sebelum kandidat final/eksperimen agar hasil bisa ditelusuri. Inisialisasi Git, publikasi remote dan aktivasi layanan tidak dianggap telah dilakukan oleh roadmap ini. Saat SHA belum tersedia gunakan hash file untuk evidence lokal.

## Jalur penelitian sesudah fondasi produk

Acuan ilmiah langsung berada pada [rancangan penelitian](D:/Jurnal/Microservices/Penyempurnaan/sources/01_Rancangan_Penelitian.md), khususnya bagian 4, 8, 9 dan 13, serta [blueprint produk sumber](D:/Jurnal/Microservices/Penyempurnaan/sources/02_Blueprint_Helpdesk.md). Hash SHA256 blueprint sumber saat pemeriksaan sama dengan salinan pada provenance proyek, yaitu `d4c6f6c5b6f9da4e4b9305748c682cf031407e4f29a9d495a01cd4153945e345`.

Gerbang berikut berasal dari rancangan penelitian, bukan status PASS yang ditetapkan dokumen ini. Pekerjaan C3/F9/G-OPT memerlukan scope penelitian lanjutan, tetap memakai satu sumber bisnis, kontrak dan fixture bersama. Workspace M0 ini tidak diperluas diam-diam menjadi empat implementasi terpisah.

| Gerbang sumber | Pekerjaan dan syarat lanjut |
|---|---|
| G0 | Sahkan domain, literature gap dan primary outcome. Boleh ditangani peneliti selama pengembangan M0. Tidak ada klaim novelty sebelum kajian literatur dan pembanding memadai. |
| G1 | Buktikan schema/API/fixtures serta correctness M0 melalui tahapan M0-02 sampai kandidat M0-12 dan review domain yang relevan. Halaman UI yang selesai belum memenuhi G1. |
| G2 | Implementasikan komposisi C3/F9 dari modul yang sama, buktikan parity, fairness dan pilot. Instrumen logical calls pada port juga berlaku untuk panggilan lokal M0. Samakan versi, kontrak, data/seed, durability, total resource, pool DB, frontend serta workload dan lingkungan pengukuran. |
| G3 | Pisahkan pilot, TRAIN dan VALIDATION. Bentuk graf/candidate, baseline dan optimizer serta audit degenerasi. G-OPT ditentukan metode sesuai protokol dari TRAIN/VALIDATION, bukan jumlah grup atau hasil yang diinginkan. HELD_OUT tidak boleh menjadi input tuning. |
| G4 | Freeze protokol, source/dependency, schema/seed, graph, resource/workload config, normalizer, constraint, G-OPT dan analysis plan. Hash config HELD_OUT serta batasi akses optimizer sesuai protokol. |
| G5 | Jalankan HELD_OUT dengan paired randomized blocks dan resource/workload setara. Simpan raw evidence, invalid runs beserta alasan, dropped iterations dan uncertainty. Correctness gagal menghentikan eksperimen konfirmatori. Perubahan source setelah freeze memerlukan campaign baru sesuai protokol. |
| G6 | Analisis sesuai rencana, telusuri setiap tabel/figur ke raw evidence, reproduksi internal, kaji similarity dan pilih jurnal. Tulis naskah sesuai temuan dan keterbatasan yang benar-benar diukur. |
| G7 | Peneliti melakukan submission setelah syarat jurnal terpenuhi. Bukan keluaran otomatis dari build atau roadmap. |

M0 sah menjadi hasil terbaik. Jangan memperlambat M0, memberi bonus microservices, atau memilih konfigurasi untuk memenangkan G-OPT. Graph score dan optimum objective graf bukan optimum runtime global. Hasil negatif tetap sah. C3/F9/G-OPT belum diimplementasikan atau diukur di proyek ini, dan benchmark tetap 0 menurut checkpoint.

## Batas penerimaan roadmap ini

Dokumen ini selesai bila urutan/dependency/AC konsisten dengan backlog dan blueprint, tautan sumber benar, serta checkpoint tidak berubah menjadi klaim implementasi. Tidak ada estimasi tanggal penyelesaian atau status penelitian PASS yang dibuat tanpa bukti. M0-03 kini ditutup untuk scope lab M1/M2. M0-04 selesai pada scope lab. M0-05 adalah fase berikut yang direncanakan dan tidak otomatis dijalankan.
