# Handoff RM0-01

Kandidat lab Helpdesk M0 berada pada port loopback `18080`. Hasil per acceptance, image lokal, manifest source dan batas verifikasi dicatat di `qa/remediation/rm0-01/completion.json`. Workspace ini tidak mempunyai repository Git aktif sehingga provenance memakai SHA-256 file.

M1 memisahkan pemilihan fixture dari bukti kata sandi dan mencatat registrasi idempotent. M8 membatasi metadata/stream ke principal dan mandat OPD, memindai berkas sebelum CLEAN dan mensyaratkan approval server untuk menghubungkan hasil redaksi. M2/M3/M8 memfilter pencarian dan media menurut ACL. M9 memeriksa mandat OPD terkini saat mengambil ekspor. M3 tetap satu-satunya writer tiket. PIUI tetap memakai shell, komponen dan aset template proyek.

Ledger lokal bertambah dari 18 menjadi 20. Inventaris sebelum/sesudah mencatat 27 akun, 17 media M8, 20 konten, 26 lampiran tiket dan digest referensi media yang sama. Sembilan hash lama ditandai untuk upgrade saat login benar. Seluruh 17 media M8 historis tanpa organisasi kini privat. Tidak ada sesi lama yang masih aktif pada saat cutover. Rincian ada di `local-before.json`, `local-after.json` dan `local-cutover.txt` pada direktori bukti fase.

Jalankan regresi melalui `python -X utf8 scripts/test_rm0_01.py` pada DB disposable. Bukti positif registrasi, upload dan publikasi redaksi berasal dari DB disposable. Smoke gateway memakai identitas sintetis dan memeriksa UI tanpa menambah akun, tiket atau unggahan kerja. Lihat `docs/RUNBOOK_RM0_01.md` untuk upload gagal, review salinan dan pemulihan.

Keputusan SSO, mandat nyata dan kebijakan media tetap OPEN. UAT manusia dan persetujuan rilis masih menunggu pihak berwenang. Bukti historis tetap disimpan dengan status kandidat masing-masing. RM0-02 berstatus NOT_STARTED dan menunggu instruksi terpisah.
