# Matriks acceptance RM0-02

Status aktual dan identitas source dicatat di qa/remediation/rm0-02/completion.json. Uji memakai fixture sintetis.

| ID | Jalur normal dan otoritas | Writer / bukti persisten | Pemeriksaan terdekat |
|---|---|---|---|
| R2-A | Pemohon membuka katalog/form dan submit dengan service, form dan policy version | M2 master berversi. M3 menyimpan snapshot saat create | Inventaris 16 entri, beda audience, drift dan snapshot historis |
| R2-B | Detail tiket dan antrean memanggil command dengan izin per objek, state dan versi | M3 memeriksa CAS dan menulis history serta outbox | Uji state sah/ditolak dan lintas OPD |
| R2-C | Operator meminta informasi. Pemohon/petugas sah menjawab. Teknisi mulai dan resolve. Pemohon memberi konfirmasi, feedback, cancel atau buka kembali | M3 mencatat alasan, upaya aktif dan episode. Reject mempertahankan episode. Reopen menautkan episode baru | Regresi HTTP lifecycle dan smoke browser |
| R2-D | Operator memilih kategori aktif dan prioritas setelah membaca saran M4 | M3 mempertahankan snapshot M4 dan keputusan terpisah. Bukti diverifikasi dari fakta server | Assert kategori, confidence, rule version, priority, reason dan digest |
| R2-E | Dispatch dari antrean terverifikasi. Reassign dari penugasan aktif. Proposal hanya untuk petugas dengan mandat OPD | M5 membaca routing, waktu, skill, tim dan M1. M3 melakukan CAS | Guard sebelum verify dan state terminal. Skill/tier, roster, identitas dan proposal usang |
| R2-F | Detail menampilkan kandidat L1/L2, alasan, umur proyeksi atau status manual | M3 menyimpan fakta keputusan. M5 memproses snapshot setelah commit | Proposal, fallback, beban terproyeksi dan provenance |
| R2-G | Retry memakai key dan payload yang sama. Dua penugasan berbeda memakai versi awal yang sama | M3 memproses receipt dan CAS bersama perubahan tiket | Lost response, satu commit dan satu 409 |
| R2-H | Delivery memakai lease, inbox dan ACK setelah commit | Snapshot dispatch menulis proposal, load dan inbox dalam satu transaksi M5 | Rollback, restart, lost ACK, duplikat, digest konflik, versi lama dan dua worker |
| R2-I | Detail tiket publik dan konsol petugas memakai template PIUI serta DTO API | Tenant/role scope sebelum pagination. Migrasi additive menjaga status lama | OpenAPI/event/generated, M6/M9, browser desktop/mobile/keyboard, inventaris |

Keputusan DEC-M01, DEC-M03, DEC-M04, DEC-M05 dan DEC-M06 tetap terbuka untuk domain nyata. Cakupan lab tidak mengesahkan kebijakan organisasi atau eksperimen arsitektur.

Hasil integrasi aktual meliputi tujuh kelompok skenario dan matriks 40 kombinasi tindakan/state melalui HTTP dengan fixture yang dibentuk lewat command normal. R2-I lulus untuk scope lab setelah smoke browser image final pada desktop/mobile/keyboard. Bundle dari gateway cocok dengan build. Pengujian peran mencakup operator, teknisi, pemohon dan penolakan antar pemohon. Riwayat smoke kandidat sebelumnya dan hambatan otorisasi dipertahankan terpisah.
