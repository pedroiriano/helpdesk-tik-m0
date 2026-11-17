# Handoff RM0-02

Status saat ini DONE_VERIFIED untuk kandidat lab. Pemeriksaan browser final telah lulus setelah akses pulih. Bukti desktop/mobile/keyboard mencakup operator, teknisi, pemohon, availability reopen, data historis dan penolakan akses antar pemohon. Bundle gateway cocok dengan build. Hasil dan batasnya dicatat dalam browser.json. Riwayat hambatan browser dipertahankan di browser-before-final.json.

Sumber acceptance dan status per kriteria ada di [completion](../qa/remediation/rm0-02/completion.json). Konteks keputusan ada di [ADR 0007](../docs/adr/0007-rm002-lifecycle-assignment.md), [matriks katalog](../contracts/RM0_02_CATALOG_MATRIX.md) dan [runbook](../runbooks/rm0-02-lab.md).

## Perilaku yang tersedia di lab

- Operator meninjau usulan M4, memisahkan kategori dan prioritas final, meminta informasi, memverifikasi ke TRIAGED, atau menolak laporan beralasan. Pelengkapan membuka kembali antrean verifikasi. Tiket lama OPEN dan VERIFIED tetap dapat didisposisikan.
- Koordinator mendapat kandidat L1/L2 berurutan menurut beban terproyeksi. Pemilihan teknisi dibatasi routing, skill, waktu, identitas aktif dan OPD. Saat tidak ada kandidat, UI menampilkan status manual. Admin berizin dapat menambah versi aturan routing dari API master.
- Teknisi yang ditugaskan mulai bekerja sebelum resolve. Pelapor dapat merespons upaya resolusi aktif. Reopen lab dalam tujuh hari mencatat episode baru yang terhubung. Arsip tetap terpisah dari lifecycle.
- M3 menulis fakta tiket, history, receipt, dan outbox dalam satu transaksi. M5 memproses snapshot durable dan menulis proyeksi/proposal bersama inbox, lalu delivery memberi ACK. Aturan dan data lama dipertahankan.

## Cara memeriksa

Gunakan [gateway lokal](http://127.0.0.1:18080/) dan [login sintetis konsol petugas](http://127.0.0.1:18080/admin/auth/login.html). Masuk sebagai operator atau teknisi lab, lalu pilih Antrean Tiket Petugas. Bukti integrasi mengisolasi semua mutasi uji di PostgreSQL disposable. Smoke gateway memakai tiket sintetis yang sudah ada.

## Batas keputusan dan verifikasi

DEC-M01, DEC-M03 dan DEC-M04 menunggu pengesahan katalog, persyaratan dan target organisasi. Jangka reopen tujuh hari adalah kebijakan lab sementara DEC-M05. START dan resolve tersedia untuk assignee yang masih berwenang. Delegasi operasional menunggu DEC-M06. Soft balancing memakai snapshot, dengan selang singkat antara pemeriksaan lintas owner dan commit yang didokumentasikan di ADR.

Pembuktian mencakup penerapan lokal 021–022 dan regresi konsumen M6/M9 yang menerima event terkait. UAT pemilik, aktivasi produksi, protected CI, benchmark/parity C3/F9/G-OPT, serta perhitungan ulang SLA berada di luar bukti ini. RM0-03 menunggu instruksi fase tersendiri.
