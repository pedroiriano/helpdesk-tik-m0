**Rencana perbaikan dan penyempurnaan Helpdesk M0 dalam lima fase**

Disusun 10 November 2026 berdasarkan [audit pengembangan](../docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md). Root pelaksanaan tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Acuan kebutuhan adalah blueprint M0, aturan pembangunan, acceptance dan feature coverage dalam proyek, serta protokol penelitian dalam `D:\Jurnal\Microservices`.

RM0-01 sampai RM0-05 adalah ID rencana remediasi baru. Status awal kelimanya `NOT_STARTED`. Urutan ini menjadi jalur koreksi setelah audit atas pengembangan M0-01 sampai M0-13. Status historis harus diperiksa terhadap bukti dan source aktual saat fase pertama dilaksanakan.

Target akhir yang dapat diperiksa adalah seluruh kebutuhan M0 dalam scope terimplementasi melalui alur normal, seluruh temuan audit tertutup dengan bukti, seluruh acceptance M0 mempunyai traceability pada kandidat source yang sama, UI konsisten dan aksesibel, serta keputusan organisasi tercatat sah. Mutu hasil ditentukan kriteria tersebut. Rencana ini belum membuktikan kelulusan implementasi maupun UAT.

**Peta lima fase**

| Fase | ID | Fokus dan hasil utama | Prasyarat | Temuan utama |
|---|---|---|---|---|
| 1 | RM0-01 | Keamanan identitas/media/scope, checkpoint jujur dan kontrak tersinkron | Audit dan source aktual dibaca | F01 F02 F03 F04 F13 F14 |
| 2 | RM0-02 | Layanan, state machine, klasifikasi dan Smart Dispatch yang konsisten | RM0-01 lulus | F05 F06 F07 |
| 3 | RM0-03 | SLA, notifikasi, scheduler, laporan, operasi dan resource yang dapat dibuktikan | RM0-02 lulus | F08 F09 F10 F11 F12 F15 |
| 4 | RM0-04 | UI/UX Publik dan Admin seragam, terhubung data nyata dan nyaman digunakan | RM0-03 lulus | F16 F17 dan seluruh matriks UI audit |
| 5 | RM0-05 | Kandidat final, bukti acceptance, UAT manusia dan keputusan rilis | RM0-04 lulus | Verifikasi ulang seluruh temuan dan penutupan gate organisasi |

**Fase 1 — RM0-01. Amankan fondasi dan benahi checkpoint**

Tujuannya memastikan setiap akses dan mutasi mempunyai identitas, izin serta bukti yang dapat dipercaya. Modul utama M1 dan M8, dengan pengujian akses melalui M2, M3 dan M9. Acceptance utama AC02, AC06, AC07, AC11, AC18 dan AC23. Pengaitan final dengan kebutuhan FR dilakukan memakai `contracts/feature_coverage.csv` yang aktual.

| Paket pekerjaan | Hasil yang harus tersedia |
|---|---|
| Checkpoint dan provenance | Daftar file/source hash awal, inventaris perubahan, status bukti lama, daftar gap acceptance serta matriks keputusan organisasi |
| Kejujuran penerimaan | Koreksi pernyataan persetujuan pejabat/UAT yang belum mempunyai lampiran sah menjadi status menunggu pengesahan. Dokumentasi teknis, UAT manusia dan keputusan rilis mempunyai status terpisah |
| Login dan registrasi | Jalur lab eksplisit, password wajib diperiksa server, hashing password berversi, validasi identifier/NIK/email, akun nonaktif ditolak, registrasi idempotent dan aman saat lost response |
| Kompatibilitas data | Inventaris akun/hash lama, media pending/CLEAN/privat dan membership lama. Rancang migrasi additive serta pemulihan akun berotorisasi dengan audit |
| Upload M8 | Pemeriksaan sesi, CSRF, permission, pemilik, organisasi, ukuran, MIME/hash dan state pada metadata serta isi file; lampiran guest tetap melalui otoritas M3 |
| Reuse media | Salinan tersanitasi nyata, approval yang diverifikasi server, provenance sumber/versi/tujuan, scan dan larangan publikasi sumber privat tanpa syarat sah |
| Scope organisasi | Actor context dan scope konsisten pada list/detail/search/count/mutation/download/export, termasuk pencabutan membership |
| Kontrak dan UI akses | Endpoint registrasi serta perubahan payload/permission tercatat pada OpenAPI; formulir memakai kontrak yang sama; informasi mode lab/SSO sesuai kemampuan aktual |

Minimum pembuktian mencakup login kosong/salah/benar, sesi kedaluwarsa, akun nonaktif, replay registrasi, pengguna lain, OPD lain, upload tanpa hak, capability palsu, approval palsu, sumber media berubah dan pencabutan hak saat unduh. File yang sudah CLEAN harus terlindungi dan data lama mengikuti aturan yang sama.

Fase lulus bila F01–F04 telah ditutup dengan tes negatif pada HTTP dan service yang relevan, kontrak/consumer selaras, serta F13/F14 mempunyai checkpoint koreksi dan baseline hash yang jujur. Bukti pengesahan manusia tetap dilacak sampai fase 5. Akses nyata bergantung pada keputusan identitas/SSO yang sah.

**Fase 2 — RM0-02. Tuntaskan layanan dan alur penanganan**

Tujuannya membuat proses pelaporan sampai penyelesaian mempunyai state dan otoritas yang konsisten. Modul utama M2, M3, M4 dan M5, dengan port M1/M6/M9. Acceptance utama AC03, AC04, AC05, AC06, AC09, AC11 dan AC13.

| Paket pekerjaan | Hasil yang harus tersedia |
|---|---|
| Katalog 16 layanan | Pemilik, kode, audience, jenis permohonan/gangguan/insiden, persyaratan, form/version, policy, target, kalender, routing dan rujukan panduan terdokumentasi per layanan |
| Policy layanan | Perubahan layanan/form/policy saat submit ditangani, layanan nonaktif ditolak dan snapshot transaksi tetap terlacak |
| State machine M3 | OPEN, NEEDS_INFORMATION, TRIAGED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED dan CANCELLED ditegakkan sesuai blueprint. Jalur minta/lengkapi informasi, mulai, cancel dan reopen mengikuti policy serta ADR yang diperlukan |
| Verifikasi M4 | Usulan awal terpisah dari kategori/prioritas final, mapping kategori kode/UUID canonical, confidence, versi classifier, verified_by/at, evidence digest dan alasan override tersimpan |
| Smart Dispatch M5 | Proposal dipakai pada alur nyata, routing layanan, skill, tier L1/L2, rentang ketersediaan, staf aktif, soft balancing dan alasan rekomendasi dapat dilihat |
| Konsistensi owner | M3 mengomit tiket/history/idempotency/outbox atomik; M5 memperbarui efek/projection dalam transaksi owner melalui inbox/event durable dengan guard versi |
| Episode dan konkurensi | Reject melanjutkan episode sesuai policy, reopen menghubungkan episode baru, reassign/handoff menjaga timestamp serta ownership, dan CAS mencegah overwrite |
| UI kerja minimum | Operator/koordinator/teknisi dapat menjalankan tindakan yang sah pada antrean/detail melalui API nyata, dengan konflik 409 dan penolakan hak yang informatif |

Minimum pembuktian mencakup transisi sah/terlarang dari seluruh entry point, dispatch sebelum VERIFIED, dispatch tiket CLOSED, roster belum aktif/tidak memenuhi skill, tidak ada kandidat, dua request versi sama, crash sebelum/sesudah commit, lost ACK dan replay event. Setiap layanan mempunyai matriks cakupan form/policy. Pengujian penuh dapat memakai kelas perilaku representatif dengan pengecekan metadata seluruh 16 entri.

Fase lulus bila F05–F07 tertutup, alur normal pelapor → operator → koordinator → teknisi dapat dijalankan, dan satu transaksi gagal tidak meninggalkan penugasan/projection lintas-owner yang tidak sah. Penambahan AI eksternal mengikuti evaluasi dan otorisasi tersendiri sesuai blueprint.

**Fase 3 — RM0-03. Benarkan waktu, pemulihan dan data operasional**

Tujuannya membuat target layanan, otomatisasi, laporan dan operasi mempunyai hasil nyata yang konsisten. Modul utama M6, M7 dan M9, dengan M1 untuk administrasi serta M3 sebagai writer tiket. Acceptance utama AC03, AC05, AC08, AC14, AC15, AC16, AC17, AC21, AC22, AC23, AC24 dan kontrol resource AC10.

| Paket pekerjaan | Hasil yang harus tersedia |
|---|---|
| SLA berbasis policy | Target respons/resolusi, calendar ID/version, CAL-1/CAL-247, hari libur dan priority dipakai pada jalur create/verify yang sebenarnya sesuai aturan perubahan target |
| Clock dan pause | Gross/net, approved pause, interval overlap, endpoint resolved, feedback/reject dan episode reopen dihitung oleh satu sumber canonical |
| Vendor dan handoff | PIC internal aktif, pihak yang boleh memberi jeda, tanggung jawab asal sampai handoff diterima, dan pencabutan akses lama pada seluruh consumer dibuktikan |
| Auto-close dan eskalasi | Attempt aktif, notification proof, 24 jam kalender, reclaim lease, retry/backoff, dead-letter dan replay berizin dengan metrik serta error terlihat |
| Notifikasi M9 | Event ke notification sink, status delivery, binding/verifikasi/revoke dan retry terbukti. Informasi kanal nyata mengikuti keputusan organisasi |
| Laporan dan export | Volume diterima/backlog/selesai terpisah dari SLA tepat waktu, gross/net, cohort periode, denominator, timezone dan watermark aktual; scope dicek lagi saat download |
| Job dan health | REQUESTED/APPROVED/QUEUED/RUNNING/SUCCEEDED/FAILED berdasarkan eksekusi, approval aktor sah, probe modul/storage/scanner serta lag nyata dengan timeout |
| Recovery | Backup/restore terisolasi mencakup data, ledger, blob, checksum, event/job dan prosedur pemulihan; hasil ukur dicatat dengan dataset dan batasnya |
| Resource penelitian | Satu manifest anggaran yang disahkan, Compose/runbook cocok, perlakuan scanner/gateway eksplisit, dependency/image digest dan perubahan baseline terdokumentasi |

Minimum pembuktian mencakup Jumat/akhir pekan/libur, insiden CAL-247, resolved sebelum/sesudah due, pause overlap, feedback/reject bersamaan auto-close, crash sesudah claim, restart, database/scanner gagal sementara, event tertinggal, cabut hak saat export dan restore terisolasi. Gunakan dataset pembeda untuk tiket tepat waktu, terlambat, belum selesai, reopen dan handoff.

Fase lulus bila F08–F12/F15 tertutup, perhitungan yang sama dipakai detail/laporan/eskalasi, worker dapat pulih, indikator berasal dari pengukuran nyata, serta resource runtime cocok dengan manifest yang telah diputuskan. Keputusan RPO/RTO/retensi yang masih terbuka dicatat beserta pemilik dan pengaruhnya pada gate akhir.

**Fase 4 — RM0-04. Sempurnakan pengalaman Publik dan Admin**

Tujuannya menyatukan pengalaman pengguna di seluruh halaman/list/detail memakai PIUI dan sumber data canonical. Modul consumer mencakup M1–M9, terutama M2/M3/M8/M9. Acceptance utama AC07, AC11, AC18, AC19, AC20, AC23 dan AC24.

| Paket pekerjaan | Hasil yang harus tersedia |
|---|---|
| Token dan komponen | Typography, skala heading, line-height, section spacing, gap, margin, grid, tombol, form, card, table, tab, list, badge dan dialog mengikuti aturan kanonis yang terdokumentasi |
| Template dan CSP | PIUI Modern/Zero tetap menjadi sumber komponen; patch produk terpusat pada lapisan integrasi; styling inline bermasalah dipindahkan ke CSS canonical sesuai CSP |
| Branding | Logo produk, lambang pemerintah, favicon dan identitas institusi memakai aset serta penamaan yang tepat pada header/footer/login/halaman detail |
| Hero dan landing | Lima banner, maksimum 100VH, CTA proporsional, navigasi/thumbnail terjangkau pada layar pendek, autoplay/reduced-motion, copy kemampuan dan tautan sesuai keadaan nyata |
| Katalog dan form | Segmentasi audience, syarat/target/pemilik, pencarian/pagination server, form dinamis, review pengiriman, error per field, dropzone, progres dan retry lampiran tanpa duplikasi tiket |
| Pelacakan dan draft | Kunci tamu aman, sesi expired/logout jelas, draft offline pulih, tab bersaing dan pergantian akun tidak membocorkan atau menimpa data |
| Antrean dan detail | Tabel desktop dan kartu mobile dari data sama, default/filter sesuai peran, cursor dan state URL, nomor ringkas, usia/priority/SLA/PIC/next action, timeline dan internal note terpisah |
| Dashboard dan laporan | KPI dan grafik dari M9, filter scope/periode, denominator/as-of/watermark, tabel angka aksesibel dan tindakan peran yang benar-benar tersedia |
| Editorial dan pencarian | Daftar/detail M8 menjadi sumber artikel/page, URL stabil, publish/edit/archive langsung tercermin, cache/revocation tepat dan pencarian berizin |
| Media picker dan galeri | Pagination/filter server, CLEAN/quarantine/private, alt/license/provenance, selection state, keyboard dan lightbox tanpa kebocoran data |
| Dialog dan state komponen | Loading, empty, error, forbidden, offline, conflict 409, expired dan retry mempunyai copy/tindakan yang konsisten; fokus kembali ke pemicu |
| Header/footer dan mobile | Navigasi/list/detail seragam, footer dua tingkat proporsional, status offline berdasarkan kenyataan, zoom/reflow/focus serta target sentuh diperiksa |

Minimum pembuktian memakai komponen bersama dan consumer representatif pada desktop, mobile normal dan mobile pendek, termasuk 375×667 untuk regresi Hero. Periksa keyboard, visible focus, dialog/combobox, contrast, reduced-motion, zoom/reflow, no-JS sesuai dukungan dan error jaringan. Pemeriksaan URL/status HTTP dilengkapi pembuktian isi dan tindakan halaman.

Fase lulus bila F16/F17 tertutup, seluruh baris matriks UI audit mempunyai consumer dan bukti, artikel mengikuti editorial M8, dashboard memakai data operasional, serta tidak ada kontrol penting yang terpotong atau alur utama yang hanya bekerja melalui URL manual.

**Fase 5 — RM0-05. Buktikan kandidat akhir dan selesaikan keputusan organisasi**

Tujuannya menutup seluruh temuan pada source yang sama dan memperoleh penerimaan manusia yang sah. Seluruh modul M1–M9 dan acceptance AC01–AC25 ditinjau menurut scope M0. Aspek perbandingan C3/F9/G-OPT tetap mengikuti status riset yang sesuai bukti.

| Paket pekerjaan | Hasil yang harus tersedia |
|---|---|
| Kandidat reproducible | Commit jika repository telah disahkan/tersedia atau manifest hash lengkap, dependency lock/digest, build/source identity, migrations/seed/config dan resource tercatat |
| Traceability | Setiap temuan, kebutuhan FR dan acceptance AC mempunyai kode, tes, hasil, bukti, batas serta reviewer/keputusan yang relevan |
| Gate teknis final | Kontrak, build/typecheck, unit/affected integration, CAS/race jalur concurrent, owner/migration roles, negative authorization, media, recovery, browser dan security/dependency/image checks sesuai risiko |
| UAT manusia | Pelapor tamu/publik, ASN, operator, koordinator, teknisi, pengelola konten, pimpinan, auditor dan admin menjalankan tugas nyata dalam lingkungan yang disetujui; defect/hasil/nama/tanggal dicatat |
| Keputusan domain | Pemilik layanan mengesahkan katalog, target/kalender, routing, reopen, delegasi, retensi, kanal notifikasi, RPO/RTO, branding dan kapasitas sesuai mandat |
| Dokumen operasional | README, checkpoint, backlog, acceptance, traceability, runbook, handoff dan dokumen rilis konsisten dengan kandidat aktual |
| Keputusan rilis | Persetujuan/penundaan oleh pihak berwenang dilampiri bukti sah, dengan status teknis dan keputusan organisasi yang terbaca terpisah |
| Penelitian lanjutan | Baseline fitur, data, workload, API/auth, dependency dan resource untuk empat model dicatat; hasil benchmark hanya diisi setelah eksperimen yang sesuai protokol |

Gate luas dilaksanakan sekali pada kandidat final yang tercatat. Perubahan sesudahnya memicu pengujian ulang bagian terdampak dan gate tambahan sesuai risikonya. CI terlindungi digunakan bila tersedia, dengan status aktual dicatat. Pemeriksaan yang belum dijalankan tetap mempunyai status faktual.

Fase lulus bila seluruh 17 temuan memiliki closure yang sah, seluruh acceptance M0 yang berlaku terbukti, seluruh kebutuhan pengguna yang dipetakan terpenuhi, tidak ada blocker terbuka, serta UAT dan pengesahan organisasi tersedia. Jika penerimaan manusia/keputusan domain belum tersedia, laporkan status teknis yang terbukti dan gate yang masih tertahan dengan pemilik keputusan. Penyusunan rencana ini belum memberikan otorisasi deploy produksi, pengiriman nyata atau tindakan destruktif.

**Matriks temuan audit ke fase penanggung jawab**

| Temuan | Fase utama | Pemeriksaan penutup |
|---|---|---|
| F01 Identitas/password/registrasi | RM0-01 | Negatif auth fase 1 dan UAT fase 5 |
| F02 Upload M8 | RM0-01 | Negatif akses media dan alur picker fase 4 |
| F03 Sanitasi/approval reuse | RM0-01 | Bukti file/provenance dan UAT fase 5 |
| F04 Scope organisasi M8 | RM0-01 | Cabut hak/list/detail/search/export lintas fase |
| F05 Commit M3/M5 | RM0-02 | Crash/replay/CAS dan gate akhir |
| F06 State machine | RM0-02 | Alur lifecycle UI serta integration akhir |
| F07 Smart Dispatch | RM0-02 | Routing/roster/skill/projection dan UAT |
| F08 Due date policy | RM0-03 | HTTP create/verify dan tampilan fase 4 |
| F09 Clock/pause/endpoint | RM0-03 | Detail/laporan/eskalasi konsisten |
| F10 Lease/retry auto-close | RM0-03 | Restart/race/replay dan gate akhir |
| F11 KPI SLA | RM0-03 | Dataset pembeda, dashboard/export fase 4 |
| F12 Job/health | RM0-03 | Hasil eksekusi/probe/recovery nyata |
| F13 UAT/pengesahan | RM0-01 | Pengesahan manusia dituntaskan RM0-05 |
| F14 Source/evidence/checkpoint | RM0-01 | Manifest kandidat dan traceability final RM0-05 |
| F15 Resource | RM0-03 | Verifikasi konfigurasi kandidat RM0-05 |
| F16 Dua sumber konten | RM0-04 | Publish/archive/revoke terlihat pada publik |
| F17 Hero mobile pendek | RM0-04 | Desktop/mobile normal/mobile pendek |

**Kontrol pelaksanaan dan handoff**

1. Jalankan urutan RM0-01 → RM0-02 → RM0-03 → RM0-04 → RM0-05. Setiap fase mengerjakan kontrak, persistence, consumer dan UI minimum yang diperlukan untuk membuktikan hasilnya.
2. Baca ulang AGENTS.md, source, audit, checkpoint dan keputusan domain sebelum eksekusi. Temuan yang ternyata telah diperbaiki harus ditutup dengan bukti aktual dan cakupan regresinya.
3. Gunakan solusi terkecil yang utuh. Pertahankan integritas data lama, migrasi additive, kompatibilitas kontrak yang didukung serta behavior yang tidak berubah oleh requirement.
4. Status backlog remediasi mengikuti `NOT_STARTED`, `IN_PROGRESS`, `PARTIAL`, `BLOCKED_<ALASAN>` atau `DONE_VERIFIED` berdasarkan bukti. ID baru ini tidak otomatis mengubah hasil historis M0-01 sampai M0-13.
5. Setiap fase menyimpan bukti di lokasi rencana `qa/remediation/rm0-0x/` ketika dieksekusi, termasuk completion, manifest source, command/result, screenshot ber-viewport, defect dan batas. Folder bukti tersebut belum dianggap tersedia oleh rencana ini.
6. Append hasil aktual ke `status/evidence.jsonl`, perbarui checkpoint dan backlog remediasi, lalu sampaikan changed/tests/security/risks/keputusan berikutnya secara ringkas.
7. Tinjau dampak keputusan domain sejak fase 1. Bila keputusan belum tersedia, lanjutkan bagian independen dengan fixture lab berlabel, serta catat pekerjaan dependen yang tetap tertahan. Fase dependen dimulai setelah gate prasyaratnya terbukti.
8. Rencana, tanda status, dan jumlah test tidak menjadi pengganti demonstrasi perilaku. Penyelesaian ditentukan seluruh kriteria yang relevan dan bukti pada source yang dinilai.

Dokumen ini merupakan pemetaan pekerjaan. Implementasi lima fase dimulai melalui instruksi pelaksanaan fase terkait.
