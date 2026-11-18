# Draf evaluasi UAT dan keputusan rilis Helpdesk M0

Status diperbarui pada 18 November 2026 (Persiapan RM0-05 / kandidat beku `rm0-05-rc3`, menggantikan `rm0-05-rc2` setelah Fase 2 Penuntasan Fitur UI→Backend, UX Operasional, & Kebersihan Kontrak/Tes). Status dokumen **`DRAFT_PENDING_HUMAN_UAT_AND_AUTHORIZATION`**.

Dokumen sebelum koreksi memuat klaim APPROVED/AUTHORIZED untuk peran pejabat dan UAT manusia yang belum didukung lampiran pengesahan yang dapat diverifikasi pada artefak proyek yang diperiksa. Snapshot historis dipertahankan di qa/remediation/rm0-01/historical-release-authorization.md dan hash awalnya ada pada baseline-source.json. Snapshot tersebut adalah bukti riwayat klaim, bukan pengesahan organisasi.

Pengujian sembilan persona pada scripts/test_m0_13_uat.py adalah pengujian skenario HTTP otomatis dengan identitas sintetis. Hasilnya tidak membuktikan autentikasi SSO nyata, penerimaan pengguna manusia, kepatuhan aksesibilitas menyeluruh atau otorisasi produksi.

| Gate | Status aktual | Bukti yang diperlukan |
|---|---|---|
| Verifikasi teknis RM0-01 s.d. RM0-04 + ADR 0009–0011 | `DONE_VERIFIED_LAB` | Completion dan regresi pada `qa/remediation/rm0-01..04`, `qa/upgrades/dec-m11`, dan `qa/remediation/rm0-05/local-ci.json` |
| Kandidat akhir RM0-05 (Git freeze & CI lokal) | `DONE_TECHNICAL_FREEZE` | Tag Git `rm0-05-rc3`, `qa/remediation/rm0-05/source-manifest.json`, dan `qa/remediation/rm0-05/local-ci.json` |
| UAT manusia (9 persona / 16 layanan) | `PENDING_HUMAN_UAT` | Penguji berwenang Diskominfo/OPD mengisi [RM0_05_UAT_AND_DECISION_PACKET.md](RM0_05_UAT_AND_DECISION_PACKET.md) & `qa/remediation/rm0-05/uat-worksheets.csv` |
| Pengesahan katalog dan kebijakan domain (`DEC-M01–M09`, prod `M10`, `M12`) | `PENDING_DOMAIN_DECISIONS` | Pemilik layanan/data mengunci keputusan pada `planning/decisions.csv` & berita acara RM0-05 (`DEC-M10` lab & `DEC-M11` stack sudah diputuskan di ADR 0009/0010) |
| Otorisasi rilis organisasi | `PENDING_AUTHORIZATION` | Persetujuan pemilik wewenang Diskominfo Kota Depok yang dapat diverifikasi |
| Deployment produksi | `NOT_EXECUTED` | Instruksi, hardening secret produksi (`HELPDESK_LAB_AUTH=0`), dan persetujuan terpisah yang relevan |

Nama, tanggal persetujuan dan tanda tangan diisi hanya dari bukti sah yang diberikan pihak berwenang. Agent dapat menyiapkan paket evaluasi dan mencatat hasil teknis aktual. Setiap keputusan manusia tetap terbuka sampai bukti tersedia. Rencana RM0-05 mengatur penutupan gate ini.
