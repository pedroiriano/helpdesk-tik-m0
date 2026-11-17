## 18 Penggunaan paket oleh Codex GPT dan Antigravity Gemini

Buka folder Helpdesk-TIK-Depok-Monolith-Modular sebagai workspace proyek tersendiri. Gunakan AGENTS.md sebagai aturan bersama, README sebagai peta dan PROJECT_STATE sebagai checkpoint. Dokumen Word untuk review manusia; agent membaca Markdown canonical agar dapat mencari bagian spesifik. Jangan mengandalkan riwayat chat sebelumnya sebagai satu-satunya sumber requirement.

Codex menggunakan AGENTS.md dengan discovery berlapis; AGENTS.override.md dan batas ukuran dapat memengaruhi aturan yang masuk konteks [S27]. Antigravity mendukung AGENTS.md/GEMINI.md serta .agents/rules; rule file memakai trigger frontmatter [S28]. Paket menyediakan GEMINI.md dan rule pendek yang menunjuk aturan bersama. Hindari menaruh aturan wajib hanya pada subfolder yang belum dibaca. Setelah membuka workspace, minta agent menyebut file yang dibaca dan tiga invariants M0 sebelum memberi tugas coding.

Dokumentasi Antigravity mengumumkan penghentian workflows lama pada 19 Oktober 2026 [S32]. Paket ini memakai prompt Markdown portabel dan rules, sehingga tidak bergantung pada slash workflow lama. Ini bukan pengujian runtime Antigravity pada komputer pengguna. Jika versi alat tidak memuat rule otomatis, arahkan agent membaca AGENTS.md secara eksplisit. Tidak perlu mengubah global configuration atau menonaktifkan approval/sandbox.

Jangan memilih model berdasarkan asumsi nama “terbaru”. Pengguna dapat memakai GPT di Codex dan Gemini di Antigravity yang tersedia pada akunnya. Perilaku proyek ditentukan aturan, kontrak dan verifikasi yang sama. Keduanya tidak diberi hak menerapkan perubahan ke luar workspace atau melakukan operasi nyata hanya karena paket dokumentasi ini ada.

## 19 Siklus kerja dan pemulihan sesi

Pada awal task, agent memeriksa keadaan aktual, memilih task yang dependency-nya terpenuhi, lalu membaca bagian blueprint yang relevan. Agent membuat rencana singkat berupa file yang diubah, acceptance dan tes terdekat. Implementasi dilakukan per feature slice hingga API, persistence, UI serta kondisi gagal konsisten. Agent memverifikasi sesuai risiko, memperbaiki kegagalan, lalu memperbarui status dan bukti. Progres singkat menjelaskan temuan serta pekerjaan berikut, tanpa dump log.

Pada sesi terputus, baca PROJECT_STATE, backlog task aktif, evidence terakhir, Git diff bila tersedia dan file yang disebut handoff. Verifikasi bahwa bukti masih sesuai source. Lanjutkan dari langkah belum selesai; jangan mengulang bootstrap atau full suite yang masih valid. Bila ada perubahan sumber sesudah bukti, ulangi pemeriksaan terdampak. Keputusan domain yang belum disahkan tetap terbuka walaupun agent sebelumnya menulis “selesai”.

| Keadaan | Tindakan agent | Status yang tepat |
|---|---|---|
| Requirement jelas dan perubahan reversibel | Kerjakan hingga acceptance terbukti | IN_PROGRESS lalu DONE_VERIFIED |
| Sebagian acceptance selesai | Catat bukti yang ada dan sisa pekerjaan | PARTIAL |
| Domain resmi belum diputuskan | Gunakan fixture lab untuk pekerjaan independen; tahan aktivasi nyata | BLOCKED_DOMAIN pada gate terkait |
| Tool/test belum tersedia | Bangun tool sesuai scope atau catat keterbatasan | NOT_IMPLEMENTED atau BLOCKED_ENV |
| Test gagal | Cari root cause, surgical fix dan targeted retest | FAIL, bukan menghapus assertion |
| Membutuhkan produksi/destruktif di luar otorisasi | Siapkan rencana/reviewable result dan minta keputusan | BLOCKED_AUTHORIZATION |
| Hanya tes M0 dijalankan | Laporkan bukti M0; jangan menandai parity empat model lulus | DEFERRED_RESEARCH untuk perbandingan |

Agent tidak meminta persetujuan ulang untuk tindakan yang sudah diotorisasi dan tidak menghentikan pekerjaan aman hanya karena gate produksi belum terbuka. Sebaliknya, dokumen rencana bukan otorisasi deploy, pengiriman pesan nyata atau purge. Penjelasan blocker harus menyebut tindakan serta informasi/otorisasi yang kurang secara konkret.

## 20 Pergantian agent dan pembagian kerja

Gunakan satu agent penulis aktif per feature slice secara default. Codex dapat membangun lalu Antigravity meninjau, atau sebaliknya, tanpa pembagian kemampuan yang dipaksakan. Reviewer membaca diff dan bukti nyata. Pergantian agent tidak membuat branch aplikasi kedua atau schema khusus model AI. Jangan membuka dua agent yang menulis file sama tanpa koordinasi.

Handoff menyertakan task/requirement, source SHA atau file hashes, file berubah, command dan hasil, blockers, keputusan domain, security impact serta langkah berikut yang konkret. Sebutkan proses/tool yang masih berjalan agar penerus tidak memulai duplikat. Gunakan templates/HANDOFF.md. Agent penerus mengonfirmasi checkpoint dari file dan melanjutkan scope yang belum selesai, tanpa memulai ulang seluruh analisis.

Jika pengguna meminta pekerjaan paralel, pisahkan file ownership dan kontrak terlebih dahulu. Owner schema/OpenAPI/shared UI harus tunggal untuk perubahan yang saling bergantung. Integrasi dilakukan setelah setiap subtask mempunyai evidence. Hindari menjalankan migrasi seed/DB bersamaan pada database test yang sama. Tidak ada delegasi otomatis yang menambah scope atau mengirim data pribadi ke layanan lain.

## 21 Prompt penggunaan dan pemeriksaan hasil

Prompt awal tersedia di prompts/01_MULAI.md. Prompt tersebut meminta agent membaca aturan, memeriksa keadaan dan mengerjakan task fondasi dengan acceptance aktual setelah pengguna memang memulai pengembangan. Prompt lanjutan di prompts/02_LANJUTKAN.md berfokus pada checkpoint. Prompt review di prompts/03_REVIEW.md meminta temuan konkret dan tidak memperbolehkan klaim lulus tanpa evidence. Prompt handoff di prompts/04_HANDOFF.md menghasilkan ringkasan portabel.

Sebelum menerima laporan selesai, pemilik proyek memeriksa apakah UI memakai persistence nyata, semua negative permission tests relevan dijalankan, aturan 24 jam dan vendor terbukti, migration/recovery telah diuji serta tidak ada klaim broad readiness dari tes sempit. Checklist bukan pengganti menjalankan test. Jika laporan menyebut SHA, PR atau CI, tautan dan identitasnya harus dapat diverifikasi.

Aturan agent membantu menjaga konsistensi tetapi tidak menjamin kesempurnaan otomatis. Bukti dibangun bertahap dari kontrak, tes, review dan UAT. Paket ini sengaja memisahkan kelengkapan spesifikasi dari status implementasi agar agent tidak mengubah rencana menjadi klaim aplikasi telah berjalan.
