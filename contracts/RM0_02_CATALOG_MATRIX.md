# Matriks 16 layanan pada lab Helpdesk

Inventaris sumber diambil dari PostgreSQL lab. Identitas layanan, form, policy, organisasi dan routing berasal dari rekaman aktif pada snapshot. Ada 23 entri total, termasuk 16 berkode TIK dan tujuh entri lain. Semua tetap dipertahankan.

Seluruh entri TIK pada snapshot dimiliki OPD A (Diskominfo). Audience ASN memerlukan sesi dan scope policy. Tamu memakai capability per tiket. Klasifikasi jenis layanan berikut adalah pemetaan sintetis untuk penelaahan DEC-M01. Isian identitas dan nomor kontak pada lab harus sintetis.

| Kode layanan | Jenis lab | Audience | Kategori | Form/policy | Isian wajib | Routing aktif dan skill |
|---|---|---|---|---|---|---|
| TIK-ACC-01 | Permohonan | ASN | CAT-TATA-KELOLA | 1/1 | nip_aparatur, akun_layanan, alasan_reset | L1 identity, credential |
| TIK-CCT-01 | Gangguan | ASN | CAT-INFRA | 1/1 | lokasi_titik_cctv, instansi_pelapor, gejala_kerusakan | L1 cctv, surveillance |
| TIK-DEV-01 | Permohonan | ASN | CAT-APTIKA | 1/1 | nama_usulan_sistem, target_pengguna, tujuan_inovasi, kesiapan_sop, landasan_regulasi | L2 consulting, architecture |
| TIK-DOM-01 | Permohonan | ASN | CAT-APTIKA | 1/1 | nama_subdomain, tujuan_penggunaan, ip_server_hosting | L2 web, server |
| TIK-DSW-01 | Gangguan | Tamu/publik | CAT-APTIKA | 1/1 | nik_pelapor, nomor_whatsapp, fitur_layanan, tipe_perangkat, kronologi_kendala | L1 mobile, portal |
| TIK-EML-01 | Permohonan | ASN | CAT-TATA-KELOLA | 1/1 | nip_asn, nama_lengkap, opd_asal, usulan_username | L1 governance, account |
| TIK-INT-01 | Permohonan | ASN | CAT-APTIKA | 1/1 | nama_aplikasi_asal, nama_aplikasi_tujuan, metode_integrasi, dasar_kebutuhan | L2 api, integration |
| TIK-KEU-01 | Gangguan | ASN | CAT-APTIKA | 1/1 | opd_pemohon, jenis_dokumen, jenis_kendala, pesan_kesalahan | L1 software, finance |
| TIK-LAN-01 | Permohonan atau gangguan | ASN | CAT-INFRA | 1/1 | perangkat_daerah, ruang_kerja, jenis_pekerjaan, estimasi_titik, kebutuhan_teknis | L1 network, lan |
| TIK-NET-01 | Gangguan | ASN | CAT-INFRA | 1/1 | lokasi_gedung, jenis_koneksi, gejala_kendala, nomor_kontak | L1 network, hardware |
| TIK-PUB-01 | Gangguan | Tamu/publik | CAT-INFRA | 1/1 | nama_taman_alunalun, ssid_wifi, kendala_koneksi | L1 wifi, public |
| TIK-SEC-01 | Insiden | Tamu/publik | CAT-PERSANDIAN | 1/1 | indikasi_insiden, target_sistem, waktu_terdeteksi, kontak_pelapor | L2 csirt, security |
| TIK-SIM-01 | Gangguan | ASN | CAT-APTIKA | 1/1 | nip_asn, modul_aplikasi, uraian_masalah | L1 software, simpeg |
| TIK-SRV-01 | Permohonan | ASN | CAT-INFRA | 1/1 | nama_server, lingkungan_server, jenis_penyesuaian, alasan_kebutuhan | L2 server, storage |
| TIK-TTE-01 | Permohonan | ASN | CAT-PERSANDIAN | 1/1 | nik_pegawai, nip_pegawai, nama_lengkap, jabatan_resmi, email_dinas, tujuan_tte | L1 security, certificate |
| TIK-VIC-01 | Permohonan | ASN | CAT-INFRA | 1/1 | nama_acara, waktu_pelaksanaan, lokasi_vicon, platform_vicon, jumlah_peserta | L1 multimedia, network |

Form dan policy lama disimpan di snapshot tiket saat create. Bila konfigurasi berubah, submit dengan versi lama menghasilkan 409 dan pemohon meninjau ulang. Tidak ada penulisan ulang snapshot historis.

Untuk seluruh baris, policy lab mengizinkan gambar PNG/JPEG dan PDF privat sampai 10 MiB. Isian wajib pada tabel berasal dari schema form. Lampiran pendukung tunduk pada policy unggah dan scan. Syarat dokumen resmi yang belum disahkan tetap menunggu pemilik layanan.

Kalender resolusi sementara untuk seluruh baris adalah CAL-1-LAB-v1 dengan target delapan jam kerja dari waktu diterima. Target respons manusia dan variasi kalender, resolusi, serta eskalasi resmi menunggu DEC-M03/DEC-M04. Perhitungan ulang dari prioritas final tetap pada RM0-03. Bila L1 atau L2 belum mempunyai aturan/roster cocok, koordinator menerima status manual dan meninjau master. Tidak ada substitusi teknisi tanpa skill.

Rujukan pengguna adalah halaman detail katalog dan Basis Pengetahuan Helpdesk di /panduan.html. Prosedur layanan resmi, persyaratan dokumen dan SLA resmi memerlukan review pemilik pada UAT.

Bukti metadata mentah tersedia di qa/remediation/rm0-02/catalog-local.json dan routing-local.json.


## Entri historis dan fixture tambahan

Inventaris penuh terdapat di qa/remediation/rm0-02/catalog-all-local.json. Pemeriksaan metadata seluruh 23 entri dicatat dalam catalog-validation.json. Entri sintetis berikut dipertahankan bersama 16 layanan TIK.

| Kode | Aktif | Audience | Form/policy | Kategori |
|---|---|---|---|---|
| LAB-BROWSER-M003 | Tidak | PUBLIC_GUEST | 2/2 | None |
| LAB-SVC-1 | Ya | PUBLIC_GUEST | 1/1 | LAB-CAT-1 |
| LAB-SVC-2 | Ya | PUBLIC_AUTH | 1/1 | LAB-CAT-1 |
| LAB-SVC-3 | Ya | ASN_AUTH | 1/1 | LAB-CAT-1 |
| LAB-SVC-4 | Ya | STAFF_ONLY | 1/1 | LAB-CAT-1 |
| LAB-SVC-5 | Ya | ASN_AUTH | 1/1 | LAB-CAT-2 |
| LAB-SVC-6 | Ya | STAFF_ONLY | 1/1 | LAB-CAT-2 |
