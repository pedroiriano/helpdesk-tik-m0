**Prompt pelaksanaan RM0-02 — Layanan, lifecycle dan Smart Dispatch**

Laksanakan RM0-02 sampai acceptance fase terbukti dari API, persistence dan UI normal. Gunakan Bahasa Indonesia, targeted discovery dan Explore → Analyze → Plan → Execute → Verify → Refine. Utamakan correctness, keamanan, konsistensi data lama serta implementasi terkecil yang utuh.

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Rujukan penelitian `D:\Jurnal\Microservices`. Temuan utama F05/F06/F07. Modul utama M2/M3/M4/M5 dengan M1/M6/M9 melalui public port. Acceptance utama AC03, AC04, AC05, AC06, AC09, AC11 dan AC13.

**1. Prasyarat dan pembacaan wajib**

Acuan canonical adalah `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`, `docs/01_BLUEPRINT_M0.md`, `docs/02_ATURAN_PEMBANGUNAN.md` dan `docs/03_PANDUAN_AGENT_AI.md`.

Baca `AGENTS.md`, `README.md`, `status/PROJECT_STATE.md`, `planning/remediation_backlog.csv`, `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, audit `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`, blueprint/aturan/panduan agent, serta acceptance, feature coverage, permission, state machine, event/subscription dan OpenAPI terkait dalam `contracts`.

Verifikasi RM0-01 DONE_VERIFIED pada scope dependency dengan `qa/remediation/rm0-01/completion.json`, manifest/hash serta tes yang mendukungnya. Status CSV saja belum cukup. Bila bukti tidak ada, sudah drift atau blocker keamanan kembali muncul, catat dependency yang belum terbukti dan tahan mutasi RM0-02 yang bergantung padanya. Selesaikan analisis dan persiapan yang independen. Perbaikan dependency yang kecil, relevan dan telah diotorisasi dapat dilakukan dengan evidence RM0-01 yang sesuai sebelum melanjutkan. Jangan diam-diam mengambil seluruh fase lain.

Periksa source aktual, Git status bila ada, data/migrasi serta consumer yang memakai kontrak lama. Verifikasi titik temuan. Susun matriks layanan/state/action/actor → API → writer → history/outbox → tes → UI, lalu mulai implementasi.

**2. Invariants dan batas pelaksanaan**

Pertahankan satu proses Go M0 dan sembilan owner. M3 satu-satunya writer aggregate, episode dan state tiket. Public port membawa actor context terpercaya dan DTO. Tidak ada transaksi/SQL lintas owner atau repository bisnis bersama. Jangan mengubah template references atau framework untuk mengatasi gap.

Mutasi M3 mencakup aggregate/version, history, receipt idempotency dan outbox dalam satu transaksi. Efek consumer M5 dikomit bersama inbox pada transaksi M5, lalu ACK. Retry, cancel, crash, lost response serta event duplikat/terlambat harus mempertahankan konsistensi. Pertahankan pemeriksaan keamanan hasil RM0-01.

Migrasi additive dan immutable ledger, uji disposable sebelum apply lokal. Kebijakan organisasi memakai keputusan yang disahkan atau fixture sintetis berlabel. Jangan menambah status/tahapan tanpa fixture dan ADR bila blueprint memerlukannya. Tidak mengaktifkan integrasi nyata atau eksperimen C3/F9/G-OPT.

**3. Tuntaskan kontrak layanan dan 16 entri katalog**

Inventaris seluruh entri katalog aktual. Jangan mengubah jumlah/identitas layanan demi memenuhi angka jika data telah berubah secara sah. Selaraskan setiap kode, audience, jenis permohonan/gangguan/insiden, organisasi pemilik, kategori, form, policy version, syarat dokumen, kalender, target respons/resolusi, routing L1/L2, escalation, upload serta panduan rujukan dengan sumber kebutuhan dan keputusan pemilik.

Jaga kode/ID stabil dan referensi tiket lama. Versi form/policy yang lama tetap dapat menjelaskan snapshot tiket yang telah diterima. Revalidasi layanan aktif, audience, membership dan versi sebelum commit. Perubahan layanan/form/policy saat submit menghasilkan error kontrak yang dapat dipulihkan, bukan snapshot campuran.

Master routing/kategori/form yang diperlukan harus dapat dikelola melalui use case/admin berizin atau jalur konfigurasi yang memang ditentukan blueprint. Jangan membangun engine yang hanya dapat dipakai lewat SQL manual tersembunyi. Metadata seluruh layanan diverifikasi. Integration test dapat memakai kelas perilaku representatif tanpa Cartesian semua kombinasi.

**4. Tegakkan lifecycle canonical F06**

Gunakan state machine pada blueprint sebagai sumber aturan. Awal create OPEN dan verification PENDING. Verify menghasilkan TRIAGED dan VERIFIED. Dispatch sah dari state dan authority yang ditentukan. Mulai kerja menghasilkan IN_PROGRESS oleh assignee/delegate aktif. Resolve, confirm, feedback, reject, cancel dan reopen memeriksa current state, aggregate version, active attempt, episode serta policy.

Bangun alur NEEDS_INFORMATION, pelengkapan informasi, mulai kerja dan reopen jika belum tersedia pada entry point normal. Catat alasan, return_state bila diizinkan, fakta yang berubah dan kebutuhan verifikasi ulang. Reject resolusi melanjutkan episode awal sesuai policy. Reopen sesudah CLOSED membuat episode baru yang terhubung dan mengikuti window/alasan yang sah. Jangan menyamakan archive/restore arsip dengan reopen bisnis.

Guard ditempatkan di domain/use case M3 dan dipakai semua HTTP/internal job. Payload klien tidak dapat memindahkan state bebas. Dispatch ulang CLOSED/RESOLVED tidak boleh lolos hanya karena verification VERIFIED dan version cocok. Resolusi dari state yang tidak sah ditolak meskipun UI menyembunyikan tombol.

Simpan proposed category/confidence/explanation/classifier version asli terpisah dari confirmed category, priority, verified_by/at, override reason dan evidence digest. Jangan menimpa usulan dengan keputusan operator atau confidence 1.0 buatan. Validasi kategori/priority terhadap katalog yang berlaku. Keputusan perubahan target SLA menjadi kontrak eksplisit yang akan dipakai RM0-03, dengan caller yang tetap benar pada fase ini.

**5. Konsistensi M3/M5 F05**

Telusuri Dispatch sampai commit M3 dan penulisan M5. Hapus efek persisten M5 dari callback transaksi M3. Proposal/validasi sebelum transaksi dapat melalui port baca-saja. M3 menyimpan assignment sah dan intent event atomik. M5 menerima fakta durable setelah commit melalui inbox dedup dan transaksi owner.

Definisikan identity/digest/schema event, aggregate version, correlation, consumer target dan ordering. Load projection tidak boleh turun akibat versi lama. Efek/proposal/load projection dan inbox owner dikomit atomik sesuai kontrak. ACK per consumer hanya setelah efek durable. Kegagalan M5 tidak membatalkan fakta M3 yang sudah commit dan tidak memerlukan kompensasi lintas-owner palsu. UI menjelaskan lag projection bila relevan.

Buktikan rollback M3 sebelum commit, crash sesudah commit, lost ACK, retry dispatch, duplicate event sama/berbeda digest, event lama dan dua worker. Jangan memalsukan ACK atau menghapus subscription wajib untuk membuat gate lulus.

**6. Klasifikasi dan Smart Dispatch F07**

M4 baseline deterministik sesuai blueprint. Selaraskan kode kamus dengan kategori canonical/UUID, normalisasi bahasa, versi rules dan fallback unknown/ambigu. Low confidence memerlukan tinjauan operator. Input laporan tidak dapat memberi instruksi tool atau hak akses.

Integrasikan proposal M5 pada alur yang dipakai operator/koordinator. Evaluasi layanan/routing, team, tier, skill, staf aktif, available_from/available_until, mandat organisasi dan projection beban. Pengurutan kandidat mempunyai tie-break deterministik yang terdokumentasi. Soft balancing memakai watermark/usia projection dan tidak dianggap hard reservation kapasitas.

Jangan memilih kandidat sembarang saat skill tidak cocok atau roster belum aktif. Tidak ada kandidat menghasilkan hasil manual/error bisnis yang jujur. Revalidasi kewenangan dan ketersediaan yang diperlukan saat commit, tanpa menahan row lock M3 sambil melakukan panggilan lintas owner. Periksa proposal version/digest serta perubahan roster sesudah rekomendasi. Override penugasan mempunyai permission dan alasan yang sah.

Tampilkan kategori/prioritas usulan dan final, alasan rekomendasi, pilihan L1/L2, teknisi/team dan hasil penugasan. Tidak menambah model AI eksternal atau mengarang skor kecerdasan demi label Smart Dispatch. Evaluasi NLP mengikuti dataset berlabel manusia dan protokol riset jika kelak diotorisasi.

**7. UI operasional minimum dan data lama**

Gunakan menu Antrean Tiket Petugas serta detail yang sudah ada. Operator dapat meninjau/minta informasi/verify/reject, koordinator melakukan disposisi, teknisi mulai/menangani/resolve dan pelapor melengkapi informasi serta memberi konfirmasi sesuai hak. Tombol hanya untuk aksi sah, sementara server tetap mengotorisasi semua permintaan.

Konflik 409 menyediakan reload/review perubahan tanpa overwrite diam-diam. Retry mempertahankan intent yang sama saat commit belum diketahui. Pagination/filter antrean dijalankan server-side dengan scope lebih dahulu. Jangan fetch seluruh dataset untuk filter di browser. Ticket number tetap identifier tampilan, terpisah dari guest capability.

Tiket/assignment/verifikasi historis mungkin belum mengikuti state/field baru. Tentukan compatibility mapping yang terdokumentasi, migrasi additive dan pembacaan data lama tanpa kehilangan history. Jangan mengubah massal status historis dengan SQL tanpa analisis dan approval yang berlaku.

**8. Acceptance dan pemeriksaan**

| ID lokal | Kriteria yang wajib dibuktikan |
|---|---|
| R2-A | Katalog/form/policy seluruh entri tervalidasi, audience benar, version drift saat submit ditolak dan snapshot lama tetap terbaca |
| R2-B | Matrix seluruh transisi sah/terlarang dan actor/state/version/episode diuji melalui entry point normal |
| R2-C | Minta informasi, pelengkapan, start, cancel, resolve, confirm/reject/feedback dan reopen bekerja sesuai blueprint/policy |
| R2-D | Proposed vs confirmed classification/priority terpisah dan audit override/version/evidence tidak direkayasa |
| R2-E | Dispatch sebelum VERIFIED dan pada state terminal ditolak; skill/tier/time window/nonaktif/OPD/proposal usang teruji |
| R2-F | Proposal dan soft balancing terpakai, fallback manual terlihat, keputusan dan penugasan dapat dilacak |
| R2-G | Dua assignment versi sama menghasilkan satu commit dan satu konflik; lost response tidak menggandakan efek |
| R2-H | Failure M3/M5, duplicate/out-of-order event dan restart menjaga fakta/projection/inbox/ACK konsisten |
| R2-I | UI peran, ACL, data lama serta kontrak HTTP/event/generated consumers tetap bekerja |

Buat tes regresi perilaku spesifik dan failure injection pada DB disposable. Pilih command aktual setelah membaca registry/script. Command dasar yang dapat dipakai bila masih tersedia adalah `python scripts/build_business_contracts.py --check`, `python scripts/check_boundaries.py`, `npm.cmd --prefix frontend run build` dan `python scripts/test_piui_build.py`. Dari `backend` jalankan Go tests package terdampak dan integration yang telah diverifikasi isolasinya. Periksa tes fase historis `scripts/test_m0_05.py` dan kontrak bisnis, tambahkan coverage yang memang belum menangkap temuan. Jangan mengganti assertion yang valid hanya untuk PASS.

Perubahan event/permission/migrasi memperluas regression sesuai dampaknya. Jalankan consumer M6/M9 yang terdampak tanpa mengklaim menutup seluruh fase SLA. Rebuild hanya service lokal terdampak dan periksa UI pada gateway desktop/mobile/keyboard. Source/HTTP saja tidak membuktikan usability browser.

**9. Evidence dan handoff**

Simpan bukti di `qa/remediation/rm0-02/`, termasuk `completion.json`, source manifest, hasil integration/kontrak dan browser. Completion memuat task/scope, requirements R2-A–R2-I, disposition F05–F07, command/cwd/exit/result/report, SHA+dirty state atau hash source, migrasi/checksum dan identitas build bila diverifikasi, risiko/keputusan serta batas tes. Pisahkan rencana dari hasil aktual dan exclude self-referential evidence dari source manifest.

Append `status/evidence.jsonl`, perbarui backlog remediasi, checkpoint dan handoff faktual. Jangan menyatakan seluruh acceptance lintas fase selesai dari satu happy path. FAIL diperbaiki dengan targeted retest; alat yang tidak tersedia dicatat NOT_RUN/BLOCKED_<ALASAN> sambil meneruskan bagian independen. Keputusan domain wajib tetap menjadi gap jika belum disahkan. Saat terputus, verifikasi ulang source/bukti terakhir lalu lanjutkan bagian belum selesai.

RM0-02 DONE_VERIFIED hanya setelah R2-A–R2-I yang berlaku terbukti tanpa blocker correctness fase. Laporkan changed, tests, security, risiko tersisa dan keputusan berikutnya. Berhenti setelah RM0-02. Jangan otomatis memulai RM0-03.
