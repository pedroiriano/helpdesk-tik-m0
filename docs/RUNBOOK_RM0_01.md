# Runbook RM0-01 — lab dan media privat

Scope hanya lab sintetis di gateway `http://127.0.0.1:18080`. SSO nyata, kanal nyata, keputusan domain dan pengesahan rilis tetap belum aktif. Gunakan data sintetis; jangan memasukkan kredensial produksi.

## Akses dan kompatibilitas

- Akun terdaftar: email atau NIK dengan password yang benar. Telepon, role alias, UUID dan NIP bukan identifier login alternatif.
- Identitas lab: tombol/pemilih mengambil ID fixture dari bootstrap server. Pemilih tidak tersedia pada mode non-lab.
- Registrasi: gunakan data uji berformat sah. Retry intent yang sama memakai key yang sama; perubahan isi memakai intent baru. Sesi revoked/expired harus login ulang, bukan memutar receipt registrasi.
- Hash lama tidak direset. Login benar melakukan upgrade hash; pemulihan password bukan bagian layanan aktif.
- Media lama tanpa scope menjadi PRIVATE. Inventaris dan berkas dipertahankan. Kebutuhan publikasi ulang harus ditinjau satu per satu.

## Tinjauan salinan hasil redaksi

1. Pemilik berizin membaca sumber privat melalui pustaka M3/M8. Editor tidak otomatis dapat membaca lampiran tiket.
2. Redaksi manual dilakukan di luar aplikasi pada salinan. Upload ke M8 dengan alt, lisensi/sumber, ukuran/checksum dan organisasi yang berwenang. Tunggu CLEAN; quarantine tidak boleh diterbitkan.
3. Pada Pustaka Media, isi ID/version sumber, ID salinan, ID konten tujuan, audience dan alasan. Sumber/salinan harus berbeda byte, bukan hanya beda nama. Reviewer memeriksa isi serta legalitas penggunaan; checksum berbeda bukan pembuktian redaksi semantik otomatis.
4. Reviewer berbeda dari pengunggah. Sumber M8 memerlukan penerbit; sumber M3 memerlukan pembaca tiket dengan ticket.read dan media.reuse satu organisasi. Approval berlaku 24 jam dan terikat persis pada snapshot/tujuan.
5. Pemegang media.reuse yang masih berhak membaca sumber menghubungkan salinan menggunakan approval server. Konten tujuan diterbitkan oleh penerbit melalui alur editorial biasa. Unduhan pembaca selalu memakai salinan, bukan sumber privat.
6. Approval belum dipakai dapat dicabut melalui `POST /api/v1/media/approvals/{id}/revoke` oleh penerbit organisasi: expected_version, reason, cookie sesi/CSRF dan Idempotency-Key wajib. Setelah dipakai, tarik akses pembaca dengan mengarsipkan konten tujuan. Pertahankan histori.

## Upload gagal, retry dan pemulihan

Metadata dibuat idempotent sebelum stream. Upload memerlukan pemilik dan media.write aktif pada organisasi objek. Lease 30 detik membatasi satu writer; stream/write gagal dapat dicoba ulang, lease yang ditinggal crash kedaluwarsa. Signature/hash/size salah atau malware ditolak; jangan mengganti byte pada objek CLEAN. Scanner unavailable menghasilkan quarantine dan tidak dapat diunduh. Setelah scanner pulih, pemilik mengirim ulang berkas yang sama. Metadata yang sudah REJECTED memerlukan intent unggah baru.

Jangan menghapus file saat hasil commit belum pasti. Collector M3 memeriksa referensi kedua owner melalui port publik, menggunakan grace period 24 jam. Collector gagal membaca referensi berarti batal menghapus. Jangan menjalankan pembersihan volume manual. Bila CLEAN menunjuk berkas hilang, unduhan gagal tertutup; investigasi storage dan lakukan pemulihan terotorisasi, bukan memberi label CLEAN palsu.

## Verifikasi dan pembaruan lokal

`python -X utf8 scripts/test_rm0_01.py` membuat jaringan internal, PostgreSQL disposable tanpa port/volume persisten, menjalankan migrasi dua kali dan regresi HTTP dengan scanner lokal, lalu membersihkan resource berlabel. Laporan berada di `qa/remediation/rm0-01/integration.json`. Script tidak menulis DB kerja.

Setelah gate relevan PASS: `docker compose run --rm --no-deps migrate`, lalu rebuild/up hanya app dan web melalui Compose yang sama. Jangan menjalankan seed/reset volume. Bandingkan ledger, jumlah principal/media/konten dan referensi blob sebelum/sesudah. Verifikasi `/api/v1/health/ready`, akses publik/admin, form registrasi, pustaka M3/M8 serta keyboard/mobile melalui gateway.

Perubahan ini bukan full UAT, pentest, benchmark atau persetujuan produksi. Lihat completion, matriks bukti dan handoff untuk batas kandidat yang benar-benar diuji.
