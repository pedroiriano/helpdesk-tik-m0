**Prompt pelaksanaan RM0-04 — UI/UX kanonis Publik dan Admin**

Laksanakan RM0-04 sampai seluruh matriks UI audit dan acceptance fase terbukti melalui alur pengguna yang normal. Gunakan Bahasa Indonesia, Explore → Analyze → Plan → Execute → Verify → Refine serta IMPLEMENT COMPLETELY — VERIFY PROPORTIONALLY — REPORT CONCISELY.

Root tetap `C:\Datas\Proyek\Aplikasi\helpdesk-monolith`. Rujukan penelitian `D:\Jurnal\Microservices`. Temuan utama F16/F17 dan seluruh matriks tampilan pada audit. Semua modul M1–M9 menjadi consumer sesuai kebutuhan UI, terutama M2/M3/M8/M9. Acceptance utama AC07, AC11, AC18, AC19, AC20, AC23 dan AC24.

**1. Prasyarat, acuan dan inventory**

Acuan canonical adalah `planning/RENCANA_PENYEMPURNAAN_5_FASE.md`, `docs/reviews/2026-11-10_AUDIT_PENGEMBANGAN_M0.md`, `docs/01_BLUEPRINT_M0.md`, `docs/02_ATURAN_PEMBANGUNAN.md` dan `docs/03_PANDUAN_AGENT_AI.md`.

Baca `AGENTS.md`, README/checkpoint, `planning/remediation_backlog.csv`, rencana lima fase, audit 10 November, blueprint/aturan/panduan agent, `docs/05_ATURAN_UI_UX_WEB_PUBLIK.md`, ADR UI, kontrak serta feature coverage terkait. Verifikasi bukti RM0-01–RM0-03 pada completion/source manifest, terutama ACL, lifecycle, SLA canonical, projection/watermark, media serta API content.

Jika gate dependency belum terbukti atau source sudah drift, tentukan affected retest/gap sebelum mengerjakan consumer yang bergantung. Jangan menutupi error backend dengan data contoh. Baca template asli dan integrasi aktual untuk menentukan sumber canonical. Gunakan aset branding/ilustrasi yang sudah tersedia dan periksa aset yang relevan sebelum mengganti penggunaan.

Buat inventory seluruh rute publik/admin dan list/detail, sumber data, komponen bersama, peran pengguna, state UI serta ketergantungan backend. Petakan setiap baris matriks UI audit ke perubahan dan bukti. Pilih shared component terlebih dahulu, satu consumer representatif, lalu migrasi consumer sisanya.

**2. Pertahankan sumber UI dan aturan produk**

Gunakan HTML/CSS/JS/komponen/aset PIUI Modern dan PIUI Zero secara langsung melalui pipeline integrasi yang ada. Hindari visual system paralel, redraw framework atau patch manual pada dist/references untuk mengatasi produk. Perubahan bersama dilakukan pada sumber canonical lalu hasil build diperiksa.

Pertahankan route/API/auth/persistence/aksesibilitas yang sah, ownership sembilan modul dan behavior data lama. Client tidak menghitung ulang SLA dengan rumus berbeda atau memperoleh hak dari menu. Tidak ada fake metrics, angka total rekaan, permission wildcard atau fetch seluruh dataset untuk pagination lokal.

Setiap kontrol penting harus dapat dijangkau dari navigasi, dioperasikan keyboard/touch dan menghasilkan tindakan nyata. Teks teknis lab hanya ditampilkan bila membantu pengguna memahami batas akses. Informasi akun, kanal dan status SSO harus sesuai runtime serta keputusan yang disahkan.

**3. Fondasi visual dan komponen bersama**

Konsolidasikan token typography/heading/body/caption/monospace, line-height, ukuran kontrol, section spacing, container, gap, padding/margin, grid, warna semantik, contrast, focus, border dan elevation. Gunakan aturan kanonis publik yang ada dan pemetaan PIUI Zero untuk admin. Hindari angka tersebar/override berlapis tanpa sumber aturan yang jelas.

Seragamkan button/link, form field/help/error/required, card, table, tab, list, badge, pagination, progress/timeline, dialog dan combobox. Komponen memuat loading, empty, error, forbidden, expired, offline, conflict 409, retry dan partial failure yang dapat dipahami. Bedakan aksi primer/sekunder/destruktif secara semantik.

Pindahkan style inline yang bertentangan dengan CSP ke stylesheet canonical. Periksa console CSP dan rendering aktual. Jangan melemahkan CSP agar tampilan lolos. Jaga safe DOM rendering untuk konten/nama berkas tidak tepercaya, sanitasi server dan akses media private.

Logo produk Helpdesk dan lambang pemerintah mempunyai identitas berbeda. Pakai aset yang disahkan, alt yang tepat, ukuran proporsional, favicon dan branding konsisten di header/footer/login/detail. Jangan mengklaim ilustrasi/logo produk sebagai lambang resmi tanpa sumber.

**4. Hero, landing dan navigasi publik F17**

Pertahankan tepat lima banner dan proporsi Hero maksimal 100VH sesuai permintaan pengguna, dengan pengukuran viewport modern yang sesuai. Pastikan konten muat pada layar pendek, perubahan orientasi dan text zoom. Prioritaskan judul/deskripsi/CTA/ilustrasi/kontrol dengan aturan layout berbasis tinggi serta lebar. Jangan memperbaiki clipping dengan menyembunyikan aksi penting.

CTA primer jelas dan dua aksi sekunder proporsional. Prev/next/pause/counter sejajar dengan thumbnail sesuai layout kanonis, tanpa garis dekoratif ganda yang kembali muncul. Thumbnail aktif otomatis terjangkau saat navigasi keyboard atau pergantian slide. Label, selected state, tab order, focus, pause/autoplay dan reduced-motion benar. Pengukuran 375×667 harus menangkap regresi clipping yang ditemukan audit.

Selaraskan seluruh copy landing, FAQ, akses layanan, galeri, CTA dan footer dengan kemampuan aktual serta policy audience. Hapus kontradiksi SSO aktif/pelaporan belum tersedia jika tidak sesuai keadaan yang dibuktikan. Tautan membawa pengguna ke tujuan/tindakan yang tepat dan tidak berhenti pada HTTP 200 generik.

**5. Katalog, form, tracking dan draft**

Katalog memakai API M2 berizin, segmentasi audience, pencarian/filter dan pagination server. Detail memuat cakupan/syarat, organisasi pemilik, target/calendar policy, dokumen, batas file dan panduan. Entitas lama/slug lama diarahkan secara kompatibel sesuai kontrak route, dengan 404 nyata untuk objek tak terlihat.

Form dinamis mengikuti snapshot/version layanan. Sediakan validasi per field dan summary error, label/help yang terhubung, review sebelum submit, status upload per file, batas/format yang jelas dan tindakan memperbaiki kesalahan. Dropzone mendukung keyboard serta input file normal. Bila tiket telah commit tetapi lampiran gagal, tampilkan receipt tiket dan retry lampiran tanpa membuat tiket kedua. Jangan menghilangkan file terpilih/masukan tanpa alasan atau persetujuan pengguna.

Tracking tamu menjelaskan kunci rahasia, penyimpanan aman, sesi expired/logout/revocation dan perbedaan nomor tiket dengan capability. Secret tidak masuk URL/fragment/localStorage/draft/telemetry/screenshot. Capability untuk akses M3 diverifikasi server. Form tracking tidak menserialisasi secret ke navigasi GET saat JS belum siap.

Draft pulih saat jaringan putus, tab bersaing dan akun berubah tanpa overwrite diam-diam atau kebocoran antar pengguna. Simpan hanya field yang diizinkan. Rekonsiliasi versi/server intent serta status save/recovery dapat dilihat pengguna.

**6. Antrean, detail, dashboard dan laporan admin**

Antrean menyediakan tabel desktop dan kartu mobile dari kontrak data yang sama. Tampilkan nomor ringkas yang tetap dapat disalin, judul/layanan, usia, priority, SLA, PIC/organisasi dan next action. Default/filter sesuai mandat peran; scope selalu server-side. Filter/sort/cursor memakai allowlist dan state URL yang kompatibel.

Detail menampilkan status canonical, episode/attempt, target serta clock M6, assignment, ringkasan solusi, timeline/history paginated dan informasi pelapor yang berizin. Pisahkan catatan internal dari komentar pemohon pada server. Aksi verify/information/dispatch/start/resolve/confirm/reject/reopen/vendor/pause/handoff/escalate mengikuti permission/state dari fase sebelumnya.

Gunakan dialog bersama untuk alasan, confirmation, review konflik dan hasil partial. Fokus masuk/keluar dialog benar. Dua pengguna yang mengubah versi sama memperoleh hasil yang dapat dipahami tanpa overwrite. Tidak menggandakan mutasi ketika timeout/lost response.

Dashboard dan grafik memakai fakta M9 dengan periode, scope, timezone, denominator, as-of/watermark yang nyata. Angka kosong/unknown/lag ditampilkan secara jujur. Grafik mempunyai tabel angka/alternatif aksesibel dan tidak hanya membedakan state lewat warna. Kartu tindakan mengarah ke antrean/tugas yang sah. Export dan job status terhubung backend, dengan izin diperiksa lagi saat unduh.

**7. Editorial, pencarian, media dan lightbox F16**

M8 menjadi sumber canonical daftar/detail artikel/page yang berizin. Hilangkan ketergantungan pada kartu/template slug hardcoded untuk menemukan artikel baru. Layout featured/card/reader PIUI menjadi consumer API. Publish/edit/archive/revoke dari admin langsung tercermin pada publik sesuai cache policy.

URL detail dan share stabil serta menangani direct load/refresh/back/forward/unknown slug. Metadata judul/audience/source/version/tanggal/waktu baca berasal dari data yang benar. Sanitasi konten dan error network tidak boleh diganti diam-diam dengan artikel statis yang sudah tidak berhak ditampilkan. Cache offline mempunyai scope/TTL/invalidation yang tepat, dengan hak konten privat dicabut sesuai policy.

Pencarian/combobox memfilter scope sebelum count/snippet, memakai pagination server bila tersedia dan membatalkan request usang agar hasil tidak tertukar. Uji keyboard, active descendant, label, no-result dan error.

Media picker M3/M8 memakai pagination/filter server, status scan, audience/ownership, alt/license/provenance dan selected state. Preview/download/reuse mengikuti ACL terbaru. Quarantine/rejected tidak dapat dipilih sebagai file CLEAN. Lightbox mendukung keyboard/touch, focus restoration, next/prev/close dan informasi gambar yang sesuai. Jangan mengubah visibility lampiran demi preview.

**8. Header/footer, aksesibilitas dan acceptance**

Pertahankan shell serta navigasi/footer bersama pada semua list/detail. Footer admin dua tingkat mempunyai proporsi mobile yang rapi, tautan dapat dibaca dan status offline benar-benar terukur. Bedakan shell offline dengan tersedianya data privat. Periksa stale asset/update service worker tanpa menghapus draft atau memaksa reload saat pengguna sedang mengisi form.

| ID lokal | Pembuktian yang wajib ada |
|---|---|
| R4-A | Seluruh baris matriks UI audit mempunyai route/component, sumber data, expected state dan bukti |
| R4-B | Token/komponen canonical diterapkan lintas halaman, branding benar, CSP dan safe rendering tetap ditegakkan |
| R4-C | Lima banner Hero, CTA dan seluruh kontrol tetap terjangkau dalam maksimum 100VH pada desktop/mobile normal/mobile pendek |
| R4-D | Katalog/form/upload/tracking/draft berfungsi pada success/error/offline/retry/expired/conflict tanpa secret/data leak atau tiket ganda |
| R4-E | Antrean/detail peran dapat diakses dari menu, filter/pagination server benar, aksi sesuai state/izin dan timeline akurat |
| R4-F | KPI/grafik/laporan/export memakai data nyata dan scope, dengan empty/lag/error yang jujur serta tabel aksesibel |
| R4-G | Publish/edit/archive/revoke dan URL detail M8 tercermin di publik tanpa patch template manual |
| R4-H | Media picker/lightbox/search/dialog mendukung keyboard/focus, ACL, pagination dan error state |
| R4-I | Header/footer, mobile, zoom/reflow, contrast dan reduced-motion sesuai aturan kanonis serta tidak memotong tindakan |

Jalankan build/typecheck dan `scripts/test_piui_build.py` setelah memahami assertions-nya. Periksa `scripts/test_public_cache.mjs`, `scripts/test_business_intent.mjs`, link audit dan tes UI lama sebelum memilih tes yang relevan. Assertion string/CSS bukan bukti layout/fokus/interaction. Tambahkan regression test untuk clipping, data editorial/revocation atau bug komponen yang belum tertangkap.

Browser smoke representatif meliputi desktop, mobile normal, mobile pendek 375×667 dan keyboard. Gunakan komponen bersama agar tidak menguji Cartesian semua ukuran/halaman. Lengkapi coverage route/action seluruh inventory dengan pemeriksaan yang sesuai, termasuk 404, direct links dan role yang tidak berhak. Jika browser terhalang, gunakan kemampuan yang tersedia untuk pekerjaan independen dan pertahankan NOT_RUN pada bukti yang membutuhkan browser.

**9. Bukti dan penutupan**

Simpan `completion.json`, source manifest, component/route matrix, reports dan screenshot ber-viewport di `qa/remediation/rm0-04/`. Gunakan fixture sintetis dan sensor secret/PII. Catat R4-A–R4-I, F16/F17 dan semua baris matriks UI, command/cwd/exit/result, source hashes atau SHA+dirty state, versi build yang disajikan, langkah browser dan batasnya. Jangan menggunakan screenshot build lama untuk kandidat baru.

Perbarui aturan UI kanonis, append `status/evidence.jsonl`, perbarui baris RM0-04 di `planning/remediation_backlog.csv`, checkpoint serta handoff. Preserve bukti historis dan pisahkan hasil otomatis/browser/UAT manusia. Failures diperbaiki lalu diuji ulang secara targeted. Saat sesi terputus, periksa source/build/cache/manifest sebelum melanjutkan.

RM0-04 DONE_VERIFIED hanya setelah R4-A–R4-I yang berlaku terbukti, F16/F17 tertutup serta consumer utama tidak memiliki blocker UI/akses. Laporkan changed, tests, security, risiko tersisa dan keputusan berikutnya. Berhenti setelah RM0-04. Jangan otomatis memulai RM0-05.
