**Prompt pelaksanaan RM0-01 — Keamanan fondasi dan validasi checkpoint**

Laksanakan RM0-01 sampai seluruh kriteria fase yang berlaku terbukti pada source aktual. Gunakan Bahasa Indonesia. Bertindak sebagai senior software engineer yang presisi, menjaga keamanan dan integritas data, serta hemat token. Terapkan Explore → Analyze → Plan → Execute → Verify → Refine dan IMPLEMENT COMPLETELY — VERIFY PROPORTIONALLY — REPORT CONCISELY.

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Acuan penelitian berada di `D:\Jurnal\Microservices`. Fase ini menutup temuan F01, F02, F03 dan F04, serta memperbaiki dasar provenance/checkpoint F13 dan F14. Modul utama M1/M8 dengan consumer M2/M3/M9. Acceptance utama AC02, AC06, AC07, AC11, AC18 dan AC23. Catat cakupan bagian acceptance yang benar-benar dibuktikan.

**1. Baca acuan dan verifikasi keadaan awal**

Baca `AGENTS.md`, `README.md`, `status/PROJECT_STATE.md`, baris RM0-01 pada `planning/remediation_backlog.csv`, `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, dan temuan terkait pada `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`. Baca rentang relevan `docs/01_BLUEPRINT_M0.md`, `docs/02_ATURAN_PEMBANGUNAN.md`, `docs/03_PANDUAN_AGENT_AI.md`, `contracts/acceptance.csv`, `contracts/feature_coverage.csv`, `contracts/policy/permissions.v1.json`, `contracts/openapi/business.json` dan `planning/decisions.csv`.

Periksa cwd, Git status bila repository tersedia, perubahan pengguna, file yang benar-benar ada, registry command, konfigurasi lab dan status layanan lokal. Gunakan targeted discovery. Audit bertanggal 10 November adalah petunjuk investigasi. Reproduksi temuan pada keadaan sekarang dan jangan menganggap source/path/status masih identik. Jangan membaca credential/secrets untuk dicetak. Jangan menjalankan script patch lama sebelum memahami mutasinya.

Buat manifest awal file relevan dan matriks acceptance → temuan → jalur produksi kode → tes → bukti. Inventarisasi akun/hash lama, membership, media pending/CLEAN/privat, referensi blob dan migrasi ledger secara tersensor. Bila fase sudah dikerjakan, lanjutkan gap berdasarkan bukti dan hash source. Tulis rencana singkat, lalu kerjakan tanpa meminta konfirmasi ulang untuk perbaikan lokal reversibel yang sudah termasuk scope.

**2. Batas arsitektur, data dan otorisasi**

Pertahankan satu proses Go M0, satu frontend berbasis PIUI Modern/Zero dan satu PostgreSQL dengan sembilan schema/owner. M3 tetap satu-satunya writer state tiket. Panggilan antarmodul melalui public port, DTO/value semantics dan actor context terpercaya. Setiap owner hanya memakai transaksi/pool miliknya. Tidak ada JOIN lintas owner, shared business repository, HTTP loopback internal atau broker baru.

Gunakan fixture sintetis dan notification sink. Mode lab selalu eksplisit dan tidak memberi jalan masuk ke mode non-lab. Jangan mengaktifkan SSO/provider produksi berdasarkan label UI. Gunakan dependency yang ada jika memadai. Jika penambahan library password diperlukan, verifikasi kompatibilitas, asal resmi, lisensi dan pin versi/lock sebelum pemakaian.

Migrasi additive dengan ID global yang belum terpakai, checksum serta ledger atomik. Migrasi historis immutable. Uji pada PostgreSQL disposable sebelum apply lokal. Pelihara data lama dan behavior caller yang sah. Penggantian password, rotasi secret, reset database/volume, penghapusan data operasional dan deploy produksi memerlukan otorisasi yang relevan. Jangan memakai tindakan itu sebagai jalan pintas perbaikan.

**3. Perbaiki autentikasi dan registrasi F01**

1. Telusuri bootstrap, session creation, password login, registrasi, refresh/replay dan logout sampai store. Bedakan jalur pemilih identitas lab dengan autentikasi akun. Semua verifikasi server berlaku walaupun form client dapat dimodifikasi.
2. Tolak password kosong pada autentikasi password dan tolak password salah secara konsisten. Alias role, pola NIP/NIK atau subject UUID tidak boleh menjadi autentikasi akun nyata. Pemilih identitas sintetis hanya menerima subjek fixture yang diizinkan pada konfigurasi lab yang sah. Mode non-lab harus menolak seluruh jalan pintas sintetis.
3. Gunakan password hashing adaptif dengan salt dan parameter biaya yang terversi. Hindari digest cepat sebagai verifier password. Terapkan batas input, perbandingan verifier yang benar serta kebijakan validasi yang terdokumentasi. Inventaris hash lama dan sediakan strategi transisi/pemulihan terotorisasi yang tidak menganggap hash lama setara hash baru. Jangan mengganti credential pengguna diam-diam.
4. Validasi identifier, email, telepon dan NIK sesuai kebutuhan yang telah disahkan. NIK yang dipakai pada fixture harus benar-benar numerik dan panjangnya sah. Jangan mewajibkan pengumpulan data pribadi tambahan hanya demi fixture.
5. Registrasi harus aman pada retry/concurrency/lost response. Intent yang sama menghasilkan satu principal dan receipt yang konsisten. Hindari target acak baru yang menggagalkan replay. Normalisasi identifier dan tegakkan uniqueness pada database. Error database tidak boleh diubah menjadi hasil tidak ditemukan.
6. Receipt/log/evidence tidak menyimpan plaintext password, raw session token, CSRF token atau capability. Replay memeriksa akses/expiry/revocation terbaru dan tidak menghidupkan sesi yang dicabut. Pertahankan cookie, Origin/Host/CSRF dan session invalidation yang benar.
7. Samakan copy UI dengan kapabilitas yang tersedia. Jika konfigurasi integrasi SSO nyata belum disahkan, tampilkan status yang jujur dan lanjutkan bagian lab yang independen. Catat keputusan pemilik domain secara spesifik.

**4. Perbaiki upload dan ownership M8 F02**

Tegakkan autentikasi, CSRF untuk mutasi cookie, permission, scope organisasi dan ownership objek pada metadata serta upload byte stream. Origin guard melengkapi pemeriksaan aktor. Header capability tidak boleh dipercaya sebagai principal M8 tanpa validasi otoritas M3. Guest memakai alur lampiran M3 yang terikat tiket/capability sah.

Validasi ID/state/version, quota/ukuran, MIME/signature, nama/path, hash, cancellation dan timeout scanner. Metadata pending tidak dapat diisi pengguna lain. Gunakan quarantine dan fail closed jika scanner tidak tersedia. File CLEAN/rejected tidak dapat diubah melalui replay upload yang tidak sah. Blob privat berada di luar web root dan di luar cache publik.

Definisikan konsistensi metadata/blob saat stream putus, write/scan/commit gagal, retry dan restart. Gunakan staging atau mekanisme atomik yang sesuai adapter, tanpa menghapus file yang masih direferensikan. Catat orphan grace period dan rekonsiliasi. Terapkan pemeriksaan akses terkini pada preview/download/reuse dan media lama.

**5. Perbaiki sanitasi dan approval reuse F03**

Salinan publik memerlukan bukti sanitasi yang sah dan approval server-side sesuai policy. Pointer/UUID yang diberikan klien tidak menjadi bukti. Muat dan validasi catatan approval, aktor, mandat, sumber dan source_version, hasil redaksi, target owner/audience serta kedaluwarsa/revocation yang relevan.

Gunakan hasil redaksi sebagai blob terpisah yang dapat diverifikasi, dengan metadata/provenance, license, alt, sumber, checksum dan scan yang benar. Penyalinan byte privat identik lalu memberi label PUBLIC tidak memenuhi sanitasi ketika sumber memerlukan redaksi. Jika sanitasi otomatis belum dapat dibuktikan, sediakan workflow salinan hasil redaksi yang disetujui secara eksplisit dan blok publikasi langsung.

Periksa idempotency/CAS pada approval dan reuse, source berubah sesudah persetujuan, target tidak sah, serta kegagalan penyalinan/metadata. Terapkan aturan pada source M3 dan media privat M8. Audit mencatat keputusan tanpa membocorkan data lampiran.

**6. Perbaiki scope organisasi seluruh permukaan F04**

Bawa actor context serta organisasi yang diizinkan sampai service/store. Permission pada salah satu membership tidak memberi akses ke semua organisasi. Untuk konten/media, periksa organisasi/pemilik objek pada list, detail, draft, mutasi, search, count, preview, download, reuse dan export. Filter scope sebelum pagination dan agregasi. Pencabutan mandat harus berlaku pada request berikut dan pengambilan export.

Peran konfigurasi tidak otomatis membaca tiket. Gunakan representasi error 401/403/404 sesuai kontrak dan visibilitas objek. Jangan hanya menyembunyikan elemen frontend. Hindari fallback anonymous/guest yang memperluas hak jika autentikasi gagal.

**7. Benahi kontrak dan kejujuran evidence F13/F14**

Sinkronkan endpoint registrasi, payload autentikasi, permission, error dan media dengan sumber kontrak/generator serta consumer generated. Pemeriksaan generator harus dilengkapi pemetaan handler runtime → operasi kontrak. Jangan mengubah hasil generated saja.

Periksa `docs/releases/M0_RELEASE_AUTHORIZATION.md`, checkpoint, acceptance, README dan backlog terhadap bukti. Pertahankan bukti historis beserta scope/tanggal/hash. Koreksi klaim persetujuan pejabat yang tidak mempunyai bukti menjadi draft/menunggu keputusan. Jangan mengarang identitas, tanda tangan, tanggal atau status APPROVED. UAT otomatis dicatat sebagai tes skenario otomatis. Pengesahan manusia dilacak untuk RM0-05.

Perbaiki baris dokumentasi yang secara langsung memberi klaim keliru. Catat acceptance terdampak yang dibuka kembali dengan alasan dan scope. Jangan mengubah seluruh hasil M0 lama menjadi FAIL tanpa analisis. Manifest source dan bukti baru harus menunjukkan kandidat yang benar-benar diperiksa.

**8. Matriks acceptance fase dan pengujian minimum**

| ID lokal | Pembuktian yang wajib ada |
|---|---|
| R1-A | Password kosong/salah ditolak, password benar berhasil, akun nonaktif dan jalur lab pada mode non-lab ditolak; sesi expired/revoked serta replay tetap aman |
| R1-B | Registrasi valid/invalid, normalisasi identifier, duplicate, request bersamaan dan lost response menghasilkan satu efek tanpa kebocoran credential |
| R1-C | Upload tanpa sesi/CSRF/hak, pengguna lain/OPD lain, capability palsu, objek pending/CLEAN, hash/MIME/size salah dan scanner gagal ditangani sesuai policy |
| R1-D | Approval kosong/palsu/tidak berwenang, source_version berubah dan target terlarang ditolak; jalur sah mempunyai blob tersanitasi serta provenance yang dapat diperiksa |
| R1-E | Matrix guest/publik/ASN/editor/staf lintas OPD membuktikan scope pada list/detail/search/count/mutation/download/export serta setelah hak dicabut |
| R1-F | Data/credential lama ditangani dengan strategi kompatibilitas terotorisasi dan migrasi additive; tidak ada data hilang akibat tes |
| R1-G | Kontrak mencakup handler terdampak, consumer normal bekerja, UI akses/registrasi/media lulus smoke representatif desktop/mobile/keyboard |
| R1-H | Baseline hash, status bukti, koreksi klaim UAT/sign-off, daftar keputusan terbuka serta handoff dapat diverifikasi |

Tulis tes regresi untuk kegagalan konkret di atas dan jalankan melalui HTTP/use case nyata. Assertion teks/CSS hanya melengkapi bukti perilaku. Gunakan DB disposable untuk integration/role/migration checks. Hindari memutasi data kerja demi reproduksi. Tinjau script tes lama terlebih dahulu karena sebagian smoke membuat fixture atau mengubah global maintenance.

Command yang tersedia untuk dipilih setelah diverifikasi adalah `python scripts/build_business_contracts.py --check`, `python scripts/check_boundaries.py`, `python -m unittest tests/contract/test_business_contracts.py`, `npm.cmd --prefix frontend run typecheck`, `npm.cmd --prefix frontend run build`, dan `python scripts/test_piui_build.py`. Go tests dijalankan dari `backend` pada package terdampak. Periksa `scripts/test_m0_03.py`, `scripts/test_m0_08.py`, `scripts/test_m0_09.py` dan `scripts/test_owner_migrations.py` sebelum menggunakannya. Tes lama yang lulus belum membuktikan regresi baru bila kasusnya belum diuji.

Rebuild hanya service lokal terdampak setelah tes relevan lulus, dengan konfigurasi/port yang sudah diperiksa. Verifikasi UI melalui gateway lokal, bukan hanya dist. Jangan mengulang full gate seluruh proyek setiap perubahan kecil.

**9. Bukti, pemulihan dan penutupan**

Simpan bukti baru di `qa/remediation/rm0-01/`. Buat `completion.json`, manifest source dan laporan tes/browser sesuai hasil nyata. Completion memuat task_id, status, scope, requirements, R1-A–R1-H, finding dispositions F01–F04/F13/F14, command/cwd/exit code/result/report path, source hashes atau SHA+dirty state, kandidat image/build bila diperiksa, keputusan terbuka serta batas verifikasi. Exclude file evidence yang mengacu pada hashnya sendiri dari manifest source.

Append `status/evidence.jsonl`, perbarui baris RM0-01 pada `planning/remediation_backlog.csv`, checkpoint dan handoff. Klaim PASS harus mempunyai bukti. Gunakan FAIL, NOT_RUN, PARTIAL atau BLOCKED_<ALASAN> secara faktual. Jika alat/browser belum tersedia, coba jalur yang diizinkan, lanjutkan pekerjaan independen dan pertahankan gap terkait. Jangan menutup acceptance browser dengan HTML/HTTP saja.

Jika ditemukan konflik blueprint atau keputusan domain, dokumentasikan bukti, opsi, rekomendasi dan pemilik keputusan. Minta keputusan hanya untuk bagian yang benar-benar membutuhkan otorisasi. Saat terputus, lanjutkan dari evidence terakhir setelah memeriksa source/hash dan hasil tes. Perbaiki failure → targeted retest → periksa consumer terdampak sampai acceptance terbukti.

RM0-01 boleh DONE_VERIFIED bila R1-A–R1-H yang berlaku pada scope fase terpenuhi dan tidak ada blocker keamanan fase yang terbuka. Ketergantungan pada SSO/domain nyata yang belum disahkan tetap eksplisit dan tidak diberi PASS. Laporkan changed, tests, security impact, risiko tersisa, keputusan tertahan dan langkah berikut secara ringkas. Berhenti setelah RM0-01. Jangan otomatis memulai RM0-02.
