# M0 dan batas kepemilikan modul

Status: ADOPTED_FOR_DESIGN
Dasar: permintaan pengguna untuk blueprint pembangunan Monolith Modular dari produk v3.2.

Satu executable Go menjalankan M1–M9. React satu aplikasi, PostgreSQL satu instance dengan schema/role/pool per owner. Local ports menjaga kontrak dan event tetap durable. M3 menulis state tiket. Infrastruktur pendukung tercatat terpisah dari jumlah proses bisnis.

Konsekuensi: boundary harus ditegakkan melalui subtree internal, import checks, DB roles dan tes. Tidak ada query atau transaksi lintas owner meskipun proses sama. M0 mempertahankan kesetaraan kontrak untuk studi berikutnya. NotificationStored adalah acknowledgement bisnis asinkron dari M9 yang disimpan M3, bukan join lintas schema.

Keputusan ini tidak menyatakan implementasi/deployment selesai. Patch stack, resource produksi, domain resmi dan integrasi nyata mengikuti keputusan terpisah. Pemisahan modul baru memerlukan ADR baru serta otorisasi sesuai scope.
