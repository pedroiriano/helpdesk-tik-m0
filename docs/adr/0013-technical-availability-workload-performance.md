# ADR 0013 — Operasi teknis berbasis akun

Status keputusan teknis untuk M0 lab.

- M1 tetap memiliki akun, mandat, dan struktur organisasi. Koordinator dapat mengelola roster berdasarkan mandat disposisi pada tim yang bersangkutan. Hak ini tidak memberi kewenangan mengubah akun, kebijakan peran, atau routing. Pengelola berizin `identity.grant` dan `rules.write` pada binding yang sama tetap didukung.
- M5 menyimpan jadwal, kapasitas, dan ketidakhadiran. Setiap jadwal dapat memiliki kapasitas lokal. Beban akun dipakai bersama lintas tim. Ringkasan beberapa tim memperhitungkan satu akun sekali.
- Penyempurnaan ADR 0007 mempertahankan batas transaksi M3. Smart Dispatch memakai kandidat yang aktif dan terukur, lalu mengurutkan menurut utilisasi, sisa kapasitas, dan akun. Pasangan aturan kategori/layanan tetap mengikuti ADR 0011. Rekomendasi adalah saran kapasitas. Penugasan resmi tetap melalui pemeriksaan versi, mandat, dan riwayat di M3.
- M9 menghitung ringkasan dari fakta upaya resolusi dan aktivitas historis melalui port M3 yang sudah diberi cakupan. Snapshot resolusi membawa fakta SLA yang dikalkulasi sesuai aturan M6. Ekspor ringkasan memeriksa ulang cakupan yang sama. Definisi lengkap tersedia pada [runbook lab](../../runbooks/technical-operations-lab.md).
- Kontrak dan fixture menjadi acuan kesetaraan untuk M0, C3, F9, dan G-OPT. Keputusan kebijakan OPD dan mandat resmi mengikuti DEC-M01 serta DEC-M06.
