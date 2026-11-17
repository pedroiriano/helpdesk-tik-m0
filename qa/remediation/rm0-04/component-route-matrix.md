# Matrik UI dan rute RM0-04

Sumber antarmuka adalah pipeline integrasi PIUI Modern dan PIUI Zero, modul TypeScript dan stylesheet produk di frontend. Artefak distribusi dapat direproduksi dengan npm run build. Alur dengan mutasi hanya memakai fixture sintetis di database disposable. Hasil kandidat dan referensi bukti ada di completion.json.

| Baris audit | Rute atau komponen | Sumber, peran dan keadaan yang diharapkan | Cakupan bukti dan gap |
|---|---|---|---|
| Hero | /, hero-switcher PIUI Modern | Aset Hero Helpdesk, semua audiens, lima tab, CTA dan fokus <= 100vh | PASS_LAB: hero-desktop.png (720<=720), hero-mobile.png (844<=844), 375x667, draft/publish sync di browser-final.json |
| Copy landing | /, /akses.html, /faq.html, footer | Salinan produk dan keadaan akses M1, accordion eksklusif tanpa mutasi faq.js | PASS_LAB: `/` `.vy-faq__q` dan `/faq.html` `<details>`, nol link buntu di link_audit.json & browser-final.json |
| Branding | Header publik, login dan footer Admin, favicon | Ikon produk Helpdesk dari assets/05_Brand dan Lambang Resmi Kota Depok, zero Pedro Iriano credit | PASS_LAB: Footer 2-tier desktop/mobile, test_modal_and_mobile.py & R4-I_footer_zoom_reduced_motion |
| Katalog | /layanan, /layanan/{slug}, /detail-layanan.html | M2/M8, guest/warga/ASN/petugas, combobox M2+M8 (ARTICLE+PAGE), 25+ kategori & 37 OPD cursor | PASS_LAB: test_rm0_04_editorial.py & candidate_catalog_routing + R4-G di browser-final.json |
| Form laporan | /lapor.html, /tiket/baru/{slug} | M2 snapshot dan M3 submit, noValidate validation summary, review dialog, draft ASN, retry lampiran | PASS_LAB: Validasi fokus per-field, review edit/reopen, CDP Fetch lost-response retry (Idempotency-Key sama), draft ASN terisolasi |
| Pelacakan tamu | /lacak.html, /tiket/lacak, /tiket/{id} | M3 capability dan sesi tamu, secret hanya via header, logout & revoke | PASS_LAB: Logout memblokir sesi (404/401), re-track `/lacak.html` & revoke memblokir kunci lama di browser-final.json |
| Antrean Admin | /admin/app/tickets/index.html | M3 cursor, tabel PIUI Zero desktop dan kartu mobile, target server | PASS_LAB: Desktop 1280x800 & mobile 390x844 (admin-tickets-mobile.png) nol overflow di browser-final.json |
| Filter antrean | /admin/app/tickets/index.html?filter=… | M1 keanggotaan menentukan kontrol, M3 menegakkan scope | PASS_LAB: Filter peran, akses profil 5 peran dan URL persistence |
| Detail tiket | /detail-tiket.html, /admin/app/tickets/detail.html?id=… | M3 detail, timeline, verify/dispatch, 409 conflict banner, START -> RESOLVE | PASS_LAB: R4-E_queue_lifecycle_conflict membuktikan verify, dispatch konkuren memicu banner 409 UI + reload, dan START -> RESOLVE |
| Dialog dan error | Form layanan, detail, media, publikasi Admin | Native dialog PIUI terpusat (`business.css` & `public-ui.css`), validasi, 409, retry | PASS_LAB: test_modal_and_mobile.py (100% PASS) + modal ekspor, review, media & lightbox |
| Dashboard | /admin/app/dashboard/index.html, /admin/app/helpdesk/index.html?kind=reports | M1 report.read/export per OPD, M9 KPI/watermark/lag, CSV export (timezone Asia/Jakarta), ACL & revokasi | PASS_LAB: R4-F_m9_reports_export (HTTP 200 text/csv, lintas-OPD 404, pasca-logout 401) |
| Media picker | /lapor.html, detail tiket, /admin/app/helpdesk/index.html?kind=media | M3 attachment privat dan M8 editorial, lightbox CLEAN attachment & pembatasan download M3 | PASS_LAB: R4-H_lightbox_and_media (`.hd-btn-preview` naturalWidth>0, Esc focus return, lintas-OPD 404) |
| Panduan & Halaman | /panduan, /panduan/{slug}, /halaman, /halaman/{slug}, ?kind=articles | M8 ARTICLE + PAGE workflow (DRAFT->PUBLISHED->ARCHIVED), sanitasi, combobox & reader | PASS_LAB: R4-G_m8_page_editorial_search_reader & test_rm0_04_editorial.py |
| Footer admin | Semua halaman Admin, admin/offline.html | Shell PIUI Zero 2-tier footer, 200% zoom reflow (`640px`), `prefers-reduced-motion` | PASS_LAB: R4-I_footer_zoom_reduced_motion, test_admin_navigation.mjs, test_public_cache.mjs |
| Sistem visual | Seluruh publik dan admin, list/detail | Token PIUI dan CSS kanonis; `fieldset` `min-inline-size: 0` bebas overflow ponsel | PASS_LAB: 25 rute desktop/mobile nol overflow + test_modal_and_mobile.py |
| CSP dan style | Form, dialog, reader, dashboard, antrean | CSP Nginx (`style-src 'self'`), nol atribut `style=` HTML, safe DOM | PASS_LAB: `csp_violations: []`, `console_errors: []`, `exceptions: []` di browser-final.json |

## Inventory distribusi yang dibangun

| Kelompok | Rute dan artefak | Kontrak, audiens dan keadaan utama |
|---|---|---|
| Publik statis | /, /faq.html, /kontak.html, /404.html, /offline.html | PIUI Modern, semua audiens, navigasi/empty/offline. /faq dan /kontak adalah alias gateway |
| Akses | /akses.html, /masuk, /login, /daftar.html, /daftar, /register | M1 bootstrap/sesi dan autentikasi lab, pengunjung/warga/ASN, invalid/expired |
| Layanan | /layanan.html, /layanan, /detail-layanan.html, /layanan/{slug} | M2 katalog/detail per audience, loading/empty/error/404 |
| Laporan, daftar, detail, pelacakan | /lapor.html, /lapor/{slug}, /tiket/baru/{slug}, /tiket.html, /tiket, /dasbor, /detail-tiket.html, /tiket/{id}, /lacak.html, /tiket/lacak | M2/M3, M1 akun, tamu dengan tracking, field/receipt/akses/conflict/offline |
| Panduan & Halaman | /panduan.html, /panduan, /panduan/{slug}, /halaman.html, /halaman, /halaman/{slug} | M8 published ARTICLE & PAGE, daftar/detail, direct/reload/404 API, pencarian dan cursor |
| Status | /status.html, /status | Health gateway, online/degraded/offline |
| Admin dasar | /admin/, /admin/auth/login.html, /admin/403.html, /admin/404.html, /admin/offline.html | PIUI Zero, M1, lab login/forbidden/expired/offline |
| Admin operasional | /admin/app/dashboard/index.html, /admin/app/tickets/index.html, /admin/app/tickets/detail.html | M1/M3/M4/M5/M6/M7/M9, role petugas, empty/conflict/lag |
| Admin master dan laporan | /admin/app/helpdesk/index.html dengan parameter kind, /admin/app/{audit,reports,analytics,notifications,settings,maintenance,users,memberships,gallery,media,services,portal}/ | Gateway menuju shell master. M1/M2/M8/M9 sesuai grant. Loading/empty/forbidden/error |
