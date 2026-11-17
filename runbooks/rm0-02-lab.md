# RM0-02 pada lab Helpdesk

Gunakan hanya identitas dan isian sintetis. Di Antrean Tiket Petugas, operator membuka tiket OPEN, meninjau saran M4 dan memilih kategori aktif serta prioritas final. Operator juga dapat meminta informasi atau menolak laporan. Pemohon melihat permintaan di riwayat dan mengirim pelengkapan dari tindakan tiket. Setelah pelengkapan, operator memverifikasi ulang.

Koordinator membuka tiket TRIAGED, memilih L1 atau L2 dan meninjau alasan serta waktu proyeksi. Pilih kandidat dan isi catatan disposisi. Bila tidak ada kandidat, tinjau tingkat lain atau master routing dan roster. Pemilihan berbeda dari rekomendasi tetap dibatasi pada kandidat yang memenuhi syarat serta memerlukan alasan.

Teknisi yang ditugaskan memilih Mulai penanganan, lalu menyampaikan hasil. Pemohon dapat menerima hasil, mengajukan keberatan, atau mengirim tanggapan untuk ditinjau. Tanggapan menahan auto-close. Pembukaan kembali di lab tersedia sampai tujuh hari sejak penutupan. Pembukaan kembali membuat episode baru. Arsip memiliki alur terpisah.

Untuk konfigurasi routing, admin dengan catalog.write dan rules.write pada OPD pemilik memakai GET dan PUT `/api/v1/admin/services/{id}/routing/{tier}`. PUT memerlukan sesi, CSRF, Idempotency-Key, expected_version, team_id, required_skills, active dan reason. Gunakan expected_version 0 untuk aturan pertama. Perubahan menambah versi. Aturan terbaru yang nonaktif menutup routing pada tingkat itu. Tim harus aktif dan berada di OPD pemilik.

Saat respons mutasi tidak pasti, ulangi pengiriman dengan isian dan intent yang sama. Jika server menjawab 409, muat ulang detail dan tinjau versi terbaru sebelum mengirim keputusan baru. Proyeksi beban adalah estimasi dari snapshot yang telah diterima M5. Waktu pembaruan ditampilkan pada proposal.

Kebijakan katalog, dokumen, SLA dan reopen resmi tetap menunggu keputusan pemilik. Lihat matriks 16 layanan di contracts/RM0_02_CATALOG_MATRIX.md serta batas uji dan identitas kandidat di qa/remediation/rm0-02/completion.json.
