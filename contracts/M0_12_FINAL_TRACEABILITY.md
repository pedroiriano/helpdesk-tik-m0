# Matriks Keterlacakan Final M0-12 (Final Traceability Matrix)

Dokumen ini menyajikan rekonsiliasi keterlacakan menyeluruh pemenuhan 25 Kriteria Penerimaan (**AC01 s/d AC25**) dan 28 Kebutuhan Fungsional (**FR01 s/d FR28**) pada arsitektur kandidat final M0 (Helpdesk TIK Kota Depok Modular Monolith).

---

## 1. Ringkasan Status Kriteria Penerimaan Global (AC01–AC25)

| ID | Kriteria Penerimaan | Status M0 | Cakupan & Bukti Aktual M0 | Batas Penelitian (Research Scope) |
|---|---|---|---|---|
| **AC01** | Registry dan partisi mencakup M1–M9 tepat sekali | **DONE_VERIFIED** | Tepat 9 modul terdaftar dalam `configs/M0.json` dan divalidasi oleh `config.Load`. Sembilan pool terisolasi. Bukti: `qa/bootstrap/verification.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC02** | Payload/API sama di empat model | **DONE_VERIFIED (M0)** | Kontrak OpenAPI bisnis 100% tervalidasi dan executable di Go/PostgreSQL. Bukti: `qa/m0-02/contracts.json`, `qa/m0-12/integration.json`. | DEFERRED_RESEARCH (Perbandingan multi-arsitektur C3/F9/G-OPT ditunda untuk studi lanjutan). |
| **AC03** | Idempotency dan unknown commit | **DONE_VERIFIED** | Lost HTTP response replay, idempotency key header, CAS collision guard 409 pada mutasi bersaing. Bukti: `qa/m0-04/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC04** | Concurrent assignment & version collision | **DONE_VERIFIED** | Compare-And-Swap (CAS) guard memblokir penugasan ganda bersaing dengan HTTP 409 Conflict. Bukti: `qa/m0-05/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC05** | Outbox crash, replay, dan ordering | **DONE_VERIFIED** | Mutasi atomik outbox, inbox dedup, ACK per consumer, resume paska restart aplikasi. Bukti: `qa/m0-04/completion.json`, `qa/m0-06/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC06** | Batas akses Guest, Public, ASN, dan Lintas OPD | **DONE_VERIFIED** | Capability token kriptografis tamu, isolasi antar-user, isolasi lintas-OPD, pencabutan delegasi saat handoff. Bukti: `qa/m0-04/completion.json`, `qa/m0-07/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC07** | ACL catatan internal dan lampiran privat | **DONE_VERIFIED** | Catatan internal teknisi dan lampiran tiket privat tidak bocor ke publik atau search snippet; pemindaian ClamAV. Bukti: `qa/m0-04/completion.json`, `qa/m0-08/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC08** | State machine tiket dan kalkulasi SLA | **DONE_VERIFIED** | Engine SLA kalender kerja CAL-1 vs CAL-247, gross vs net, jeda waktu berizin, pembekuan pada `resolved_at`. Bukti: `qa/m0-06/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC09** | Model parity | **DONE_VERIFIED (M0)** | Satu build digest frontend React TypeScript dan satu image Go runtime M0. Bukti: `qa/bootstrap/verification.json`, `qa/m0-12/integration.json`. | DEFERRED_RESEARCH (Perbandingan kesetaraan model arsitektur lain ditunda). |
| **AC10** | Resource fairness dan amplop komputasi | **DONE_VERIFIED (M0)** | Alokasi sumber daya M0 terikat dalam amplop 4000m CPU / 8192 MiB RAM; budget 36 koneksi pool DB. Bukti: `qa/m0-12/shutdown.json`. | DEFERRED_RESEARCH (Alokasi credit per-modul terpisah pada multi-proses ditunda). |
| **AC11** | UI operasional alur lengkap | **DONE_VERIFIED** | Alur lengkap Tamu, Publik, ASN, Operator, Teknisi, Koordinator, Super Admin diuji pada desktop & mobile. Bukti: `qa/m0-04/completion.json`, `qa/m0-12/smoke_local.json`. | NOT_APPLICABLE |
| **AC12** | Provenance ilmiah & sanitasi editorial | **DONE_VERIFIED (M0)** | Sanitasi server-side anti-XSS pada portal konten M8; provenance pencatatan hash aset. Bukti: `qa/m0-09/completion.json`, `qa/m0-12/integration.json`. | DEFERRED_RESEARCH (Optimizer G-OPT dan benchmark data heldout bukan bagian paket M0). |
| **AC13** | Dispatch sebelum/sesudah verifikasi & override | **DONE_VERIFIED** | Guard `TICKET_NOT_VERIFIED` menolak dispatch sebelum VERIFIED; override klasifikasi M4 wajib beralasan ($\ge 5$ karakter). Bukti: `qa/m0-05/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC14** | Resolusi, konfirmasi, penolakan, feedback | **DONE_VERIFIED** | Teknisi resolve menetapkan 24 jam kalender konfirmasi; konfirmasi ACCEPT menutup tiket; REJECT melanjutkan episode awal; FEEDBACK menahan auto-close. Bukti: `qa/m0-06/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC15** | Auto-close bersamaan reject & CAS race guard | **DONE_VERIFIED** | Persaingan konkuren auto-close runner vs reject pemohon dilindungi CAS version guard. Bukti: `qa/m0-06/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC16** | Vendor terlambat dan pause tumpang tindih | **DONE_VERIFIED** | Kasus vendor wajib PIC internal aktif; jeda SLA dikoalesensi; durasi kotor (*gross*) vs bersih (*net*) dipisah. Bukti: `qa/m0-07/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC17** | Handoff lintas OPD & pencabutan delegasi | **DONE_VERIFIED** | Handoff diajukan PENDING dan saat ACCEPT memindahkan kepemilikan serta mencabut delegasi teknisi asal secara atomik. Bukti: `qa/m0-07/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC18** | Larangan direct reuse & salinan tersanitasi | **DONE_VERIFIED** | Penautan langsung lampiran privat tiket ke publik ditolak 403; reuse wajib melalui salinan tersanitasi ber-provenance. Bukti: `qa/m0-08/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC19** | Autosave draft, tab bersaing & pergantian akun | **DONE_VERIFIED** | Autosave draft berkala; tab bersaing ditolak 409 Conflict; isolasi draft offline dan pembersihan cache saat logout. Bukti: `qa/m0-08/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC20** | Aksesibilitas keyboard WAI-ARIA pada dialog & tabel | **DONE_VERIFIED** | Modal dialog arsip, restore, media picker, ekspor, dan search combo box mendukung navigasi keyboard penuh. Bukti: `qa/m0-09/completion.json`, `qa/m0-10/completion.json`, `qa/m0-11/completion.json`, `qa/m0-12/smoke_local.json`. | NOT_APPLICABLE |
| **AC21** | Telegram binding salah scope, sensor rahasia | **DONE_VERIFIED** | Pengikatan salah scope ditolak (403); token kredensial disensor (`TG-***`); status `DEAD_LETTER` terlihat transparan; pencabutan segera dengan CAS. Bukti: `qa/m0-10/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC22** | Arsip, restore arsip, dan purge non Super Admin | **DONE_VERIFIED** | Purge non-Super Admin ditolak 403; purge Super Admin dicatat DISABLED (*pending retention policy*, zero data loss); dual control ditegakkan; tiket terminal CLOSED diarsipkan dan dapat dipulihkan. Bukti: `qa/m0-11/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC23** | Search/export/analytics setelah hak dicabut | **DONE_VERIFIED** | Dynamic Revocation Gate seketika memblokir kueri pencarian, analitik, dan unduhan file paska-logout tanpa membocorkan snippet/count/data privat. Bukti: `qa/m0-09/completion.json`, `qa/m0-10/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC24** | Konfigurasi portal dan scoped operational runner | **DONE_VERIFIED** | Menu navigasi tidak memberi hak baru; runner operasional dibatasi allowlist (`BACKUP_MANIFEST`, `HEALTH_REPORT`, `PURGE_REQUEST`); eksekusi shell bebas ditolak 400. Bukti: `qa/m0-09/completion.json`, `qa/m0-11/completion.json`, `qa/m0-12/integration.json`. | NOT_APPLICABLE |
| **AC25** | Parity perluasan fitur di empat model | **DONE_VERIFIED (M0)** | Seluruh fitur dan kontrak bisnis terimplementasi penuh pada runtime Go M0. Bukti: `qa/m0-12/completion.json`. | DEFERRED_RESEARCH (Perbandingan empiris dengan model alternatif ditunda untuk riset lanjutan). |

---

## 2. Batas Penutup Fase M0-12 & Transisi M0-13

Fase M0-12 membuktikan seluruh keabsahan teknis, integrasi lintas-modul, ketahanan operasional, dan kepatuhan arsitektural M0. Sesuai prinsip rekayasa perangkat lunak:
- **Kelulusan teknis (Build/Test PASS) TIDAK SAMA DENGAN otorisasi rilis produksi**.
- **Fase M0-13** adalah gerbang User Acceptance Testing (UAT) manusia bersama pemilik proses (*human domain process owners*) Pemerintah Kota Depok dan otorisasi formal rilis produksi yang tidak dapat dijalankan secara otonom oleh AI agent.
