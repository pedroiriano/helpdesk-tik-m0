# Audit alur bisnis, modul, dan fitur Helpdesk TIK Kota Depok

Tanggal audit 24 November 2026 (WIB). Lingkungan M0 lab lokal di port 18090. Source HEAD `8f9ab58a6688`. Lingkup mencakup implementasi, kontrak, antarmuka, bukti QA terdahulu dan pemeriksaan runtime tanpa mutasi data bisnis.

## Penilaian

Kesembilan modul memiliki implementasi dalam satu proses M0. Jalur utama dan pengecualian telah mempunyai bukti lab yang tercatat. RM0-01–RM0-04 ditandai `DONE_VERIFIED` di backlog. RM0-05 masih `BLOCKED_HUMAN_UAT_AND_DOMAIN_DECISIONS`: 9 dari 9 skenario manusia masih menunggu. Dari 29 baris matriks fitur, 28 tercatat lulus lab dan FR01 masih parsial pada cakupan perbandingan arsitektur. Bukti M0 tidak menetapkan hasil C3, F9, atau G-OPT.

## Alur proses bisnis

| Tahap atau cabang | Pelaksana dan perilaku | Dasar pemeriksaan |
|---|---|---|
| Akses dan pemilihan layanan | Tamu, masyarakat berakun, ASN dan petugas mengikuti audience layanan. ASN tanpa sesi dapat menyatakan PD/Bidang pada layanan yang mengizinkan tamu. ASN bersesi mengikuti keanggotaan resmi yang berlaku. | M1/M2, direktori publik dan ASN tanpa sesi diperiksa langsung. |
| Buat dan lacak laporan | Pelapor memilih layanan, mengisi formulir berversi, meninjau, lalu memasukkan laporan sebagai OPEN. Tamu menyimpan kunci pelacakan terpisah dari nomor tiket. Akun memakai daftar tiket pribadi dan draft. Unggahan dikarantina sampai bersih. | M0-04, RM0-01, RM0-04 dan kontrak; uji mutasi baru tidak dijalankan. |
| Verifikasi dan klarifikasi | Operator menilai kelengkapan, kategori dan prioritas. Klarifikasi bergerak ke NEEDS_INFORMATION lalu OPEN setelah dilengkapi. Verifikasi maju ke TRIAGED dan VERIFIED. Pembatalan atau penolakan sesuai izin tetap menyimpan histori. | Kode M3/M4, kontrak dan bukti RM0-02. |
| Penugasan | Setelah VERIFIED, petugas memakai saran Smart Dispatch atau penugasan manual berizin. Aturan kategori berprioritas atas fallback layanan. Perubahan tim/teknisi dikendalikan versi. | Kode M3/M5 dan bukti RM0-02. |
| Kerja teknisi | ASSIGNED → IN_PROGRESS setelah teknisi mulai. Teknisi mencatat progres, waktu kerja, komentar publik atau catatan internal, dan bukti. Koordinator menangani reassign, eskalasi L2, kasus vendor dan jeda berizin. | Kode M3/M5/M6/M7, bukti RM0-03 dan fase 2. |
| Pelimpahan lintas PD | Tim asal tetap bertanggung jawab sampai tujuan menerima. Permintaan dapat ditolak atau dibatalkan sesuai mandat. Dasar waktu SLA tetap terkait penerimaan tiket awal. | Bukti RM0-03 dan fase 2. |
| Resolve, konfirmasi dan reopen | Teknisi mengubah tiket ke RESOLVED. Pemohon menyetujui atau menolak hasil. Tanpa tanggapan selama 24 jam kalender, auto-close memerlukan upaya aktif dan bukti notifikasi dalam aplikasi. Tolak hasil melanjutkan episode awal. Reopen tiket tertutup membuat episode terhubung sesuai batas kebijakan. | Blueprint §6–7, implementasi M3/M7/M9, bukti RM0-02/RM0-03 dan AC14–AC15. |
| Pengawasan dan retensi | Pimpinan melihat KPI dan backlog sesuai mandat, auditor melihat jejak, ekspor memeriksa izin. Tiket terminal dapat diarsipkan atau dipulihkan. Purge tunduk pada retensi, legal hold dan persetujuan serta nonaktif pada lab yang diperiksa. | Bukti RM0-03/fase 3, status flag runtime. |

## Modul dan fitur

| Modul | Implementasi dan fitur yang diperiksa | Fokus audit |
|---|---|---|
| M1 Identitas dan Akses | Akun, sesi, registrasi publik, PD/Unit Kerja, Bidang, tim, keanggotaan, lima profil operasional, kebijakan peran, SSO, pemeliharaan, runner. Akses konfigurasi Super Admin dan akses tiket memiliki mandat berbeda. | Pembatasan pemeliharaan per OPD dan kesiapan konfigurasi SSO. |
| M2 Katalog | Katalog layanan, kategori, audience, formulir berversi, kebijakan layanan, menu portal. | API anonim menampilkan 4 layanan dan 9 entri menu. Jumlah tersebut sesuai sudut pandang anonim dan perlu dipisah dari jumlah master. |
| M3 Tiket | Penulis tunggal status tiket, lifecycle, tracking, draft, lampiran, komentar, work log, antrean, bulk, vendor, handoff, resolusi/konfirmasi, arsip dan retensi. | UAT multiakun perlu membuktikan perbedaan cakupan antrean, detail, lampiran dan histori. |
| M4 Klasifikasi | Kamus/aturan, frasa, prioritas, penjelasan saran serta alur koreksi operator. | Confidence dari aturan bersifat heuristik. Sebelum menilai mutu klasifikasi, gunakan label manusia pada laporan Depok yang telah disanitasi. |
| M5 Penugasan | Routing kategori dan layanan, L1/L2, kecocokan skill, roster, rekomendasi dari beban proyeksi dan fallback manual. | Pemeliharaan roster/keahlian belum terlihat pada UI/API administrasi. |
| M6 SLA | Kalender kerja/libur, target tahap, waktu kotor/bersih, jeda berizin, hitung ulang dari penerimaan, laporan pemenuhan. | Sahkan kalender, target, jeda vendor dan evaluasi tiket terbuka yang sudah breach. |
| M7 Eskalasi | Aturan eskalasi/vendor, pekerjaan scheduler, retry/replay, auto-close dengan guard; eskalasi tercatat terpisah dari status inti. | Bukti scheduler terdahulu tersedia. Semantik eskalasi dan SOP pemulihan perlu masuk UAT. |
| M8 Basis Pengetahuan dan Media | Artikel, halaman, FAQ, alur tinjau/terbit/arsip, Hero lima banner, pustaka privat/editorial, karantina dan approval reuse. | Runtime mengembalikan 5 artikel, 5 FAQ dan 5 banner. Pencarian media tersedia sebagai area pustaka. Cakupan pencarian global belum sama dengan blueprint. |
| M9 Notifikasi dan Audit | Notifikasi dalam aplikasi, binding, outbox/sink, retry/dead-letter, adapter Telegram/SMTP, laporan, ekspor CSV dan jejak audit. | Integrasi kanal nyata memerlukan konfigurasi dan bukti tersendiri. |

Web Publik mencakup beranda, katalog/detail, pelaporan, lacak atau daftar tiket, pendaftaran/masuk, panduan/detail, FAQ, status dan kontak. Web Admin mencakup dasbor dan antrean/detail, master katalog dan organisasi, peran, konten/media/Hero, notifikasi, aturan/SLA, laporan, audit dan pemeliharaan. Matriks fitur juga mencakup komponen tabel, aksi massal, ekspor, grafik, grid, accordion, pencarian, pemberitahuan status, scrollbar, Select2, draft, validasi, editor, dropzone, modal, serta SEO dan audit. Bukti visual, keyboard dan lintas persona berasal dari laporan QA yang dirujuk di bawah.

Fitur andalan yang layak ditonjolkan ialah **Smart Dispatch yang dapat dijelaskan**, **SLA berkalendar yang tetap terukur saat jeda dan vendor**, **pelimpahan lintas PD dengan penerimaan**, **konfirmasi 24 jam yang diaudit**, serta **pustaka pengetahuan, FAQ dan media dengan publikasi berizin**. Smart Dispatch saat ini berbasis kamus dan aturan deterministik. Deskripsi memberi saran kategori, operator memverifikasi, lalu aturan M5 mengusulkan PD/tim/teknisi yang memenuhi syarat. Beban yang dipakai adalah proyeksi; operator atau koordinator tetap memutuskan penugasan. Belum ada pengukuran macro-F1 atau bukti efektivitas NLP/LLM yang dipakai untuk audit ini.

## Temuan dan prioritas

| ID | Prioritas | Bukti dan dampak | Tindak lanjut yang disarankan |
|---|---|---|---|
| A01 | P1 sebelum UAT | HEAD `8f9ab58a6688`, tag `rm0-05-rc4` menunjuk `68b9922af769`, sedangkan local-ci.json menyimpan `3f35d1ea5284` dengan working tree kotor, skip Docker dan tanpa browser langsung. Perbedaan mencakup perubahan M1/M8, UI, dan migrasi 041–042. Bukti tersebut belum mengikat kandidat final saat ini. | Bekukan satu revisi baru, manifest sumber, digest image, ledger dan bukti pada revisi yang sama. |
| A02 | P1 sebelum pilot | Pemeliharaan dapat disimpan per OPD. Middleware memanggil `ActiveMaintenance(..., "")` dan store tidak memasang filter organisasi jika parameter kosong. Secara kode, window satu OPD yang terpilih dapat membuat operasi OPD lain mendapat 503 ketika READ_ONLY atau DRAIN. | Tegaskan pemilihan global dan per OPD. Uji dua OPD plus window global di DB disposable. |
| A03 | P1 sebelum unggahan produksi | Compose gabungan mengaktifkan freshclam, sementara scanner hanya ada di jaringan `database` yang internal. Overlay repo tidak menyediakan jalur ke mirror. Ini risiko konfigurasi, belum reproduksi di infrastruktur produksi. | Sediakan mirror internal atau jalur keluar khusus dan buktikan umur definisi serta pemulihan ketika pembaruan gagal. |
| A04 | P1 sebelum integrasi nyata | Overlay memasok `HELPDESK_SSO_REDIRECT_URL`, backend membaca `HELPDESK_SSO_REDIRECT_URI`. Callback bawaan dapat tetap benar dari origin, tetapi nilai eksplisit overlay diabaikan. Runbook menyebut `oidc_client_secret` dan `smtp_pass`/ `HELPDESK_SMTP_PASS`, backend membaca `sso_client_secret` dan `smtp_password`/ `HELPDESK_SMTP_PASSWORD`. Overlay sendiri tidak memasang secret opsional tersebut. | Samakan kontrak konfigurasi, mount secret secara eksplisit dan lakukan uji SSO/SMTP/Telegram dengan penyedia uji yang disetujui. |
| A05 | P1 operasional Smart Dispatch | M5 mensyaratkan roster aktif dan skill sesuai. Penelusuran penulis `assignment.rosters` pada repo menemukan seed dan tes, sedangkan runtime membaca roster. Menambah akun atau anggota tim belum membuktikan teknisi dapat direkomendasikan. | Sediakan pengelolaan roster berizin dan diaudit atau prosedur provisioning resmi. Uji dari penambahan teknisi sampai rekomendasi. |
| A06 | P2 sebelum sesi UAT | Dokumen UAT-07/09 memakai `kind=knowledge` dan `kind=roles`. Peta menu saat ini memakai `kind=articles` dan `kind=role-policies`, tanpa alias untuk dua nilai lama. | Selaraskan kartu skenario, worksheet, akses langsung dan eksperimen masing-masing persona. |
| A07 | P2 kesesuaian blueprint | Pencarian global merespons `next_cursor:null` selalu. API M8 untuk “email” mengembalikan 1 baris dengan limit 1 dan 3 baris dengan limit 20, keduanya tanpa cursor. M8 mencari tabel konten, sehingga Media belum menjadi jenis hasil global. | Terapkan pagination berizin dan cakupan Media sesuai blueprint atau definisikan secara resmi lingkup saran cepat yang berbeda. |

## Bukti pemeriksaan dan batas

- Empat service runtime healthy. Ledger PostgreSQL 42 migrasi (001–042), dibaca dalam transaksi read-only.
- `py -3 -X utf8 scripts/smoke_local.py` PASS. Verifikasi kesehatan, rute, header, byte aset PIUI dan shell.
- Probe GET tambahan 28 pemeriksaan halaman/API awal sesuai harapan, plus 4 kontrak pencarian. Permintaan tanpa `owner` mendapat 400 sesuai kontrak. M2 dan M8 merespons hasil, M3 anonim mengembalikan daftar kosong. Endpoint privat yang diperiksa menolak permintaan tanpa sesi. Halaman HTML yang dicek cocok dengan `frontend/dist` bila berkas pembanding tersedia.
- `python -X utf8 scripts/check_boundaries.py` PASS pada 53 paket, `python -X utf8 -m unittest discover -s tests/contract` PASS 17 tes, dan `go test ./internal/modules/m1/... … ./internal/modules/m9/...` PASS pada tes Go yang tersedia.
- Verifikasi overlay Compose produksi secara statis tanpa menyalakan stack produksi. Temuan A02 dan A04 berdasarkan jalur kode/konfigurasi. Tidak dilakukan tes browser atau mutasi lain pada lab aktif, pengujian integrasi bisnis baru, pengiriman eksternal, ataupun UAT manusia. Healthcheck ClamAV membuktikan respons daemon.
- Bukti historis: [RM0-02](remediation/rm0-02/completion.json), [RM0-03](remediation/rm0-03/completion.json), [browser RM0-04](remediation/rm0-04/browser-final.json), [Fase 2](remediation/rm0-05/fase2-backend.json), [Fase 3](remediation/rm0-05/fase3-backend.json), [matriks fitur](../contracts/feature_coverage.csv), [lembar UAT](remediation/rm0-05/uat-worksheets.csv).

Urutan kerja setelah audit: tetapkan kandidat dan betulkan petunjuk UAT, tuntaskan isolasi maintenance dan provisioning roster, validasi konfigurasi integrasi serta scanner di lingkungan terisolasi, kemudian jalankan sembilan skenario manusia dan sahkan keputusan domain. Catat perbaikan pencarian terhadap cakupan blueprint. Penetapan hasil komparasi arsitektur tetap berada pada jalur penelitian.
