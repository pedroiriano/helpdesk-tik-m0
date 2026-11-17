# Analisis alur pelaporan sampai penutupan

Tanggal 13 November 2026. Pekerjaan lanjutan atas permintaan pemeriksaan seluruh alur pelaporan, respons, dan tindak lanjut Operator, Teknisi, Pimpinan/Koordinator. Acuan adalah blueprint M0 bagian 6–7, kontrak lifecycle, acceptance AC03–AC06, AC08, AC11, AC13–AC17 dan aturan UI kanonis. Ini merupakan slice perbaikan fungsional/UX; status keseluruhan RM0-04 tetap IN_PROGRESS.

## Alur dan hasil pembuktian

| Tahap | Pelaku dan perilaku sesuai rancangan | Bukti aktual |
| --- | --- | --- |
| Laporan masuk | Pelapor memilih layanan, mengisi data dan memeriksa ringkasan. M3 mengomit OPEN/PENDING serta receipt | Browser memakai akun Publik A pada PostgreSQL disposable, formulir nyata dan respons 201 |
| Pemeriksaan awal | Operator meminta informasi dengan alasan. Pelapor melengkapi. State kembali OPEN untuk diperiksa | Browser melewati NEEDS_INFORMATION → OPEN; integrasi menolak tindakan lintas akun/OPD |
| Verifikasi | Operator memeriksa saran M4, menetapkan kategori/prioritas dan alasan | Browser mengesahkan kategori jaringan dan prioritas tinggi; saran serta keputusan tetap terpisah |
| Disposisi | Setelah VERIFIED, Operator/Koordinator berizin memeriksa proposal dan memilih teknisi L1/L2 | Browser memakai Koordinator OPD A, proposal roster nyata dan penugasan L1; integrasi membuktikan guard dan CAS |
| Intervensi Pimpinan | Mandat pimpinan menentukan intervensi, bukan menyelesaikan pekerjaan teknisi | Browser Pimpinan mengirim eskalasi ke Koordinator; mark persisten terbukti. UI resolve/komentar tanpa mandat tersembunyi |
| Penanganan | Teknisi yang ditugaskan mulai bekerja lalu mencatat hasil | Browser ASSIGNED → IN_PROGRESS → RESOLVED, dengan catatan pekerjaan nyata pada DB disposable |
| Keberatan | Pemohon menolak hasil dengan alasan. Upaya lama berhenti berlaku, episode awal berlanjut | Browser REJECT → IN_PROGRESS, lalu Teknisi melakukan perbaikan dan resolve kedua. Integrasi memeriksa attempt/CAS dan episode |
| Konfirmasi | Pemohon memeriksa upaya aktif, catatan dan deadline, kemudian menyetujui | Browser mobile ACCEPT → CLOSED. Dua attempt dan keputusan REJECT/ACCEPT tercatat; deadline masing-masing 86400 detik |
| Tutup otomatis | Setelah 24 jam kalender, job membutuhkan attempt aktif, CAS dan bukti notifikasi durable tanpa feedback | Integrasi HTTP/PostgreSQL dengan clock fixture membuktikan sebelum batas ditolak, feedback menahan close dan lease/replay/concurrency terjaga |
| Cabang tindak lanjut | Vendor mempertahankan PIC internal; pause perlu izin; handoff efektif setelah diterima; eskalasi bertingkat | Integrasi RM0-03 aktual memeriksa vendor/PIC, pause, clock, eskalasi, handoff dan pencabutan akses receipt |
| Buka kembali / batal | Pemohon atau Operator sah mengikuti window/alasan. Arsip mengikuti permission dan state | Matriks state/action integrasi dan regresi UI mencakup transisi sah, terminal/arsip, lintas OPD dan mandat nonaktif |

## Temuan dan perubahan

| Temuan akar masalah | Perbaikan |
| --- | --- |
| Checkbox penyimpanan kunci tamu tetap required walaupun tersembunyi bagi akun login; validasi native menghentikan submit | Helper mode receipt mengaktifkan required hanya untuk tamu dan menonaktifkan kontrol saat akun login. Pembuktian browser melanjutkan pengiriman akun sampai CLOSED |
| Aturan aksi tersebar dan sebagian tidak memeriksa organisasi aktif atau kewenangan buka kembali | Shared `ticket-actions.ts` menetapkan ketersediaan per role, owner, permission, state, arsip dan window. Backend tetap menjadi otoritas |
| Vendor hanya terlihat untuk assignee yang resolve, sehingga mandat ticket.vendor pada Koordinator tidak terpakai | Vendor mengikuti mandat vendor atau teknisi yang ditugaskan, dengan state aktif yang sah |
| Form komentar/unggah dan aksi arsip muncul kepada pembaca yang tidak memiliki mandat | Kontrol mengikuti permission aktif; kelompok operasional arsip/terminal tidak menawarkan tindakan yang tidak berlaku |
| Catatan konfirmasi mengambil item pertama melalui permintaan kedua dan memakai timezone host | Gunakan resolution aktif yang sudah dimuat, WIB eksplisit, dan nonaktifkan keputusan jika hasil belum tersedia |
| Hasil perbaikan hilang dari ringkasan setelah CLOSED | Tampilkan hasil upaya yang relevan pada tiket selesai, dengan keterangan penutupan dan tanpa instruksi konfirmasi yang sudah berakhir |
| Pengguna harus mencari tindakan berikut di antara banyak bagian | Petunjuk sesuai peran/state menyediakan tautan langsung ke section aktif. Tahap pemeriksaan, informasi tambahan, pembatalan dan penutupan diperjelas |
| Komentar petugas kepada pemohon tidak mencatat first_response_at | M3 mencatat respons manusia pertama secara atomik bersama komentar/version/history. Komentar pemohon dan INTERNAL tidak dihitung; COALESCE mempertahankan respons pertama |
| Komentar petugas REQUESTER saat RESOLVED dianggap feedback pemohon dan menahan auto-close | Identitas pemohon dievaluasi dari actor/scope tepercaya. Hanya komentarnya yang mengubah attempt menjadi REVIEW_REQUIRED |
| Resolve/konfirmasi belum mempertahankan intent seperti consumer komentar | Gunakan durableIntent dan fingerprint tanpa metadata expected_version, sehingga retry menahan key dan CAS asli. Tombol konfirmasi diberi pending guard |
| Salinan UI mencampur RESOLVED dengan tiket ditutup dan menyebut 24 jam tanpa konteks batas aktual | Kirim hasil penanganan berarti menunggu konfirmasi. Deadline berasal dari attempt server; hasil serta catatan memakai tipografi yang terbaca |

## Batas verifikasi

Mutasi browser seluruhnya berlangsung pada satu tiket sintetis di lab disposable dengan PostgreSQL/tmpfs, network tersendiri dan port loopback acak. Pemilihan peran memakai adapter identitas lab. Riwayat dan hasil query disimpan sebelum resource dibersihkan. Database kerja port 18080 tidak dipakai untuk pembuatan atau perubahan tiket uji.

Browser mencakup alur utama serta informasi tambahan, keberatan, perbaikan ulang dan eskalasi Pimpinan pada desktop/mobile. Cabang auto-close, vendor, pause, handoff, lost acknowledgment, replay, CAS dan ACL dibuktikan melalui integrasi terisolasi. Tidak ada klaim bahwa setiap cabang tersebut diuji melalui browser. Upload/scan tidak diubah dan tidak diuji ulang pada lab browser ini; scanner lab tersebut sengaja tidak terhubung. Identitas produksi, vendor nyata, notifikasi eksternal, keputusan kebijakan organisasi, UAT dan gerbang rilis tetap terpisah.

Arsitektur satu proses/sembilan owner, kontrak eksternal, dependency, migrasi, port tetap dan kontrol penelitian dipertahankan. RM0-05 tidak dimulai.
