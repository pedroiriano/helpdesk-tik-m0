# Helpdesk TIK Kota Depok Monolith Modular

Paket pembangunan M0 versi 1.0, diturunkan dari blueprint produk v3.2 tanggal 3 November 2026. Buka **folder ini sebagai workspace root** di Codex atau Antigravity.

Fondasi M0 tersedia: satu proses Go dengan sembilan batas modul, satu build frontend dari HTML, CSS, JavaScript, komponen, dan aset asli PIUI dengan React untuk status koneksi, PostgreSQL terisolasi per owner, dan Nginx Docker lokal. M0-02 menyediakan kontrak bisnis executable dan migrasi owner yang diuji pada DB disposable. M0-03 menambahkan session lab, enforcement scope, katalog/form dan master M1/M2 dengan API serta PostgreSQL nyata. Migrasi 001–017 telah diterapkan lokal. M0-04 menyediakan tiket lab, tracking tamu, lampiran privat dan durable audit; status DONE_VERIFIED untuk scope lab, termasuk hardening dan restart. Lihat [handoff M0-04](status/HANDOFF_M0_04.md). Status terbaru ada di `status/PROJECT_STATE.md`; laporan QA dokumen lama hanya snapshot spesifikasi.

## Checkpoint remediasi

Audit 10 November menemukan gap keamanan dan correctness setelah pengembangan historis sampai M0-13. RM0-01 selesai diverifikasi untuk kandidat lab. RM0-02 selesai diverifikasi untuk kandidat lab, termasuk integrasi, migrasi serta browser image final pada desktop/mobile dan keyboard. Lihat qa/remediation/rm0-02/completion.json. Matriks dan hasil tercatat di qa/remediation/rm0-01/completion.json. Status penerimaan lintas fase dibaca bersama planning/remediation_backlog.csv dan status/PROJECT_STATE.md. UAT manusia serta pengesahan organisasi masih menunggu bukti. Dokumen rilis berstatus draf. Snapshot capaian M0-04 di atas dipertahankan sebagai riwayat awal.

## Workspace dan aplikasi lokal

Root tetap: `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Aturan riset: `D:\Jurnal\Microservices`.

- Publik: http://127.0.0.1:18090/ — PIUI Modern.
- Admin: http://127.0.0.1:18090/admin/ — PIUI Zero.
- Acuan kanonis UI/UX Web Publik: [aturan halaman dan detail](docs/05_ATURAN_UI_UX_WEB_PUBLIK.md).
- Compose project: `helpdesk-m0`; aplikasi: `helpdesk-m0`; gateway: `helpdesk-m0-nginx`; DB: `helpdesk-m0-db`.

Untuk login/katalog/master gunakan [runbook M0-03](runbooks/m0-03-lab.md). Untuk tiket dan lampiran privat gunakan [runbook M0-04](runbooks/m0-04-lab.md). Halaman admin template lain masih contoh. Baca [runbook lokal](runbooks/local-development.md) dan [ADR struktur/UI/Docker](docs/adr/0002-workspace-ui-docker-lokal.md).

| Folder | Isi |
|---|---|
| backend/ | Go entrypoint, composition root, sembilan modul dan platform |
| frontend/ | Build template PIUI Modern dan PIUI Zero dari references, konten Helpdesk, serta komponen React untuk API health |
| infra/ dan compose.yaml | Dockerfile, Nginx, bootstrap PostgreSQL |
| migrations/ dan seeds/ | Kepemilikan migrasi dan tempat data sintetis |
| contracts/ dan tests/ | Kontrak bersama dan lokasi tes integrasi/contract/E2E |
| docs/, planning/, status/, runbooks/ | Rancangan, urutan pekerjaan, bukti dan operasi |
| references/ | Sumber blueprint serta PIUI utuh, dipertahankan untuk traceability |
| qa/ | QA spesifikasi lama dan bukti bootstrap berlabel scope |
| scripts/ | Tool lokal nyata; tidak menjalankan fitur bisnis palsu |
| .local/ | Secret lokal saja, tidak masuk Git/build context |

C3/F9/G-OPT kelak harus memakai source dan kontrol riset yang sama. Model tersebut belum diimplementasikan atau diukur.

## Mulai dari sini

1. Baca [blueprint gabungan Word](Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.docx) untuk review manusia.
2. Agent membaca [AGENTS.md](AGENTS.md), [checkpoint](status/PROJECT_STATE.md) dan [backlog](planning/backlog.csv).
   Ikuti [urutan pembangunan dan gerbang penelitian](planning/URUTAN_PENGEMBANGAN.md). M0-02 selesai untuk scope kontrak dan migrasi terisolasi. M0-03 selesai untuk scope identitas/katalog/master lab. Lihat [handoff M0-03](status/HANDOFF_M0_03.md). M0-04 DONE_VERIFIED untuk scope lab; lihat [handoff M0-04](status/HANDOFF_M0_04.md). M0-05 belum dimulai.
   Gunakan [prompt pelaksanaan M0-02](prompts/03_FASE_M0_02.md) untuk menjalankan fase kontrak tersebut.
   Prompt fase identitas/katalog/master tersedia pada [pelaksanaan M0-03](prompts/04_FASE_M0_03.md).
   [Prompt pelaksanaan M0-04](prompts/05_FASE_M0_04.md) dan handoff mendokumentasikan scope tiket, lampiran serta audit yang telah diuji.
3. Gunakan [prompt mulai](prompts/01_MULAI.md) ketika Anda ingin memulai implementasi, lalu kerjakan satu task dengan dependency dan bukti jelas.
4. Saat berpindah agent, gunakan [handoff](templates/HANDOFF.md) serta [prompt lanjut](prompts/02_LANJUTKAN.md).

## Peta acuan

| Berkas | Fungsi |
|---|---|
| docs/01_BLUEPRINT_M0.md | Produk lengkap dan arsitektur satu proses dengan sembilan owner |
| docs/02_ATURAN_PEMBANGUNAN.md | Batas kode/data, transaksi, UI, keamanan, testing dan definition of done |
| docs/03_PANDUAN_AGENT_AI.md | Pengoperasian agent, resume, review dan handoff |
| AGENTS.md | Aturan canonical yang dipakai kedua agent |
| GEMINI.md dan .agents/rules/helpdesk-context.md | Pengarah Antigravity menuju aturan canonical |
| contracts/module_registry.csv dan dependencies.json | Identitas modul, schema/pool dan edge sinkron yang diizinkan |
| contracts/acceptance.csv dan feature_coverage.csv | AC01–AC25 dan seluruh 29 kelompok kebutuhan sumber |
| configs/M0.json | Manifest satu process group yang divalidasi runtime |
| planning/backlog.csv dan decisions.csv | Urutan pembangunan dan keputusan organisasi terbuka |
| planning/technology-lock.json dan command_registry.json | Versi terpin dan command aktual; fitur belum tersedia tetap eksplisit |
| status/PROJECT_STATE.md dan evidence.jsonl | Checkpoint serta bukti aktual, terpisah dari rencana |
| references/BLUEPRINT_SUMBER_v3.2.md | Salinan sumber lengkap yang dipertahankan untuk traceability |
| references/provenance.json dan sources.json | Hash sumber dan rujukan primer |
| scripts/verify_package.py | Pemeriksaan konsistensi paket, bukan tes aplikasi |

Urutan acuan proyek adalah instruksi pengguna yang berlaku, AGENTS.md untuk cara bekerja, blueprint M0 untuk produk/arsitektur, aturan pembangunan, lalu ADR yang telah disetujui sesuai scope. Jika dokumen berbeda, perbaiki canonical dan turunan; jangan mengabaikan konflik. Salinan sumber empat model menjadi riwayat kebutuhan dan fairness, bukan instruksi membangun C3/F9/G-OPT dalam proyek ini.

## Pemeriksaan paket

Dengan Python 3, jalankan `python scripts/verify_package.py` dari folder ini. Tool hanya memakai standard library, membaca kontrak/status/file dan mengembalikan PASS/FAIL konsistensi paket. Test negatif validator ada di `scripts/test_verify_package.py`. Hasil ini tidak membuktikan aplikasi, konfigurasi agent telah termuat di runtime, UAT atau kesiapan produksi.

Naskah gabungan Word dibangun dari tiga Markdown canonical menggunakan scripts/build_document.py dan library python-docx. Gunakan runtime authoring yang sesuai lingkungan. QA render tersimpan terpisah; jangan mengedit DOCX sebagai satu-satunya sumber karena perubahan tidak otomatis kembali ke Markdown.

## Catatan alat

Codex memakai [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Antigravity mendukung [workspace rules](https://antigravity.google/docs/rules/); buka root folder ini dan pastikan agent benar-benar membaca file. Prompt portabel tidak bergantung pada [workflows lama Antigravity](https://antigravity.google/docs/ide/workflows/) yang dokumentasinya mengumumkan penghentian pada 19 Oktober 2026. Konfigurasi global tidak diubah oleh paket ini.
