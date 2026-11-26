# Fase 2 — Kandidat final, validasi integrasi dan UAT Helpdesk TIK M0

Jalankan di `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Tuntaskan paket pekerjaan ke-5 dan penutupan teknis RM0-05. Jalankan semua langkah yang dapat dikerjakan dengan bukti aktual. Bila persetujuan atau pengujian manusia masih diperlukan, siapkan paket yang dapat langsung digunakan dan catat gerbang yang tersisa. Penerapan ke produksi memerlukan otorisasi rilis tersendiri.

## 1. Verifikasi hasil Fase 1 dan siapkan kandidat

- Baca `AGENTS.md`, `prompts/05_FASE_RM0_05.md`, `qa/remediation/rm0-05/penyempurnaan/fase1-completion.json`, audit, kontrak acceptance/fitur, backlog, lembar UAT, paket keputusan domain dan runbook. Validasi bukti terhadap source dan image yang benar. Tuntaskan temuan yang masih terbuka dan diotorisasi sebelum mengunci kandidat.
- Betulkan petunjuk/skema UAT memakai rute kanonis yang benar-benar ada, termasuk `kind=articles`, `kind=role-policies`, dan rute Antrean Tiket. Uji tautan dan tujuan menu dengan hak akses yang sesuai. Sertakan FAQ/Hero/media, maintenance dua OPD, roster hingga rekomendasi, jalur manual, pencarian berhalaman dan pencabutan izin dalam skenario yang relevan.
- Pilih identitas kandidat baru sesuai checkpoint dan kebijakan Git. Catat SHA, status perubahan source, manifest SHA-256 untuk semua input build/runtime, digest atau ID image lokal yang dapat diperiksa, ledger dan checksum migrasi, versi stack, konfigurasi tanpa nilai rahasia, fixture, port/origin dan resource. Dokumen output, log, secret, cache dan manifest yang mereferensikan dirinya dikecualikan secara eksplisit. Catat perbedaan terhadap tag lama. Jangan pindahkan tag lama, pakai bukti dari revisi lain sebagai bukti final, atau menerbitkan ke remote tanpa otorisasi.
- Siapkan kandidat di lingkungan uji terisolasi. Cocokkan browser dan gateway dengan image final yang dimaksud. Bukti final menggunakan direktori baru per kandidat. Runner lama yang menulis laporan ke path tetap perlu diarahkan ke lokasi baru, atau dijalankan dari checkout uji tersendiri dan hasilnya disalin beserta provenance. Jaga laporan lama.
- Pisahkan lab teknis, integrasi resmi dan UAT manusia. Fixture dan browser yang melakukan perubahan harus menargetkan instance sekali pakai. Untuk runner yang masih mengunci host/port, sesuaikan parameter pengujian dan verifikasi target sebelum menjalankan. Periksa juga `HELPDESK_BASE_URL` pada runner browser. Jangan arahkan tes mutasi ke port aplikasi kerja.

## 2. Jalankan gerbang teknis akhir

Jalankan perintah satu per satu setelah memeriksa prasyarat dan exit code. Jalankan full gate sekali pada kandidat final. Jika protected CI tersedia, gunakan hasil yang cocok dengan SHA untuk cakupan yang telah lulus dan tambah pemeriksaan lokal untuk gap yang tersisa.

```powershell
Set-Location -LiteralPath 'C:\Datas\Proyek\Aplikasi\helpdesk-monolith'
git status --short
git rev-parse HEAD
docker compose config --quiet
docker compose -f compose.yaml -f compose.prod.yml config --quiet
python -X utf8 scripts/ci_local.py --with-live-browser
```

Panggilan CI di atas berlaku setelah isi runner diperiksa, lokasi laporan aman, dan semua subtes live mengarah ke instance uji yang benar. Bila parameter runner gabungan belum merutekan seluruh tes dengan aman, kerjakan langkah yang didaftarkan runner secara terpisah dan catat cakupan serta alasan. Hindari mengulang security gate, test migrasi, dan suite browser bila outputnya sudah sah untuk revisi yang sama. Jalankan uji integrasi DB disposable yang belum dicakup runner, termasuk penerapan migrasi ke baseline aktual dan regresi Fase 1, menggunakan runner yang relevan. Jalankan smoke HTTP pada gateway yang sesuai, serta uji pemulihan bila perubahan memengaruhi backup, migrasi atau restore.

- Pastikan alur tamu, masyarakat berakun dan ASN berizin, verifikasi, dispatch, reassign, work log, komentar, lampiran, konfirmasi/penolakan, pending feedback, auto-close, reopen, SLA, vendor dan handoff tetap memenuhi kontrak. Gunakan uji waktu terkontrol untuk cabang 24 jam dan jangan menunggu satu hari hanya untuk pembuktian teknis.
- Buktikan negatif yang relevan untuk scope OPD, hak role, media, search, ekspor, audit, concurrency, jadwal, idempotensi dan integrasi. Rekonsiliasi AC01–AC25, temuan A01–A07, paket UX, hasil keamanan/SBOM, serta mana yang masih tertunda pada penelitian lintas arsitektur. Lindungi data yang dipakai dalam evidence dan screenshot.
- Verifikasi SSO, SMTP/Telegram dan pembaruan definisi scanner pada lingkungan staging yang sudah disetujui. Uji callback dan akun berizin/ditolak, jalur pengiriman/retry dan status, serta pembaruan dan pemulihan definisi. Gunakan akun/tujuan uji yang telah diotorisasi. Jika penyedia, akses, konfigurasi atau target resmi belum tersedia, dokumentasikan uji sink yang lulus secara terpisah dan tandai gerbang resmi `BLOCKED_INTEGRASI_RESMI` untuk kemampuan yang memang dibutuhkan saat rilis. Tanpa bukti resmi, catat kanal opsional sebagai nonaktif hanya bila keputusan ruang lingkup rilis menyetujuinya.

## 3. UAT manusia dan pengesahan

- Gunakan sembilan skenario UAT-01 sampai UAT-09 dengan data uji, langkah, hasil yang diharapkan, kandidat yang dipakai, penguji dan jadwal. Cakup pemohon tamu/berakun/ASN, Operator, Koordinator, Teknisi, Editor/Penerbit, Pimpinan/Auditor, Admin/Super Admin. Masukkan skenario mobile dan keyboard yang relevan ke tugas sehari-hari.
- Sediakan panduan singkat per persona dan lembar isian. Penguji nyata mencatat hasil, bukti, dan defect. TRIAGE temuan segera. Perbaiki defect pemblokir; apabila source atau konfigurasi efektif berubah, identifikasi kandidat baru dan tentukan bukti serta skenario yang harus dijalankan ulang berdasarkan dampak. Jangan isi nama, tanda tangan, keputusan, atau hasil manusia secara sintetis.
- Minta keputusan yang memang terbuka dari pemilik berwenang, termasuk layanan/scope OPD, identitas, SLA, pause/vendor, reopen/konfirmasi, delegasi, retensi, media, kanal, kapasitas/pemulihan dan penggunaan aset. Catat referensi keputusan, ruang lingkup dan tanggal. Pertahankan status keputusan lab yang sudah berlaku dan verifikasi mana yang masih membutuhkan pengesahan resmi.

## 4. Kriteria penutupan

- **Teknis** lulus hanya bila semua acceptance yang berlaku punya bukti pada kandidat yang benar, tanpa defect pemblokir atau regresi terbuka pada alur wajib. Hasil unit, kontrak, HTTP, browser, integrasi dan UAT dicatat terpisah.
- **RM0-05 selesai** setelah sembilan skenario UAT yang diwajibkan lulus pada kandidat yang diterima, keputusan wajib disahkan, dan otorisasi kandidat tercatat. Jika gerbang manusia/integrasi belum terpenuhi, catat `BLOCKED_HUMAN_UAT_AND_DOMAIN_DECISIONS` atau blocker yang lebih spesifik, beserta langkah yang tersisa dan pemiliknya. Siapkan bahan lengkap agar bagian teknis tidak perlu diulang tanpa alasan.
- Simpan `qa/remediation/rm0-05/penyempurnaan/fase2-completion.json` berisi kandidat, manifest, image, perintah dan exit, hasil per acceptance, bukti UAT/keputusan, isu terbuka, batas verifikasi, dan status rilis. Selaraskan status, evidence, backlog dan handoff. Bedakan kesiapan lab, penerimaan manusia, otorisasi produksi, serta validasi riset C3/F9/G-OPT.
