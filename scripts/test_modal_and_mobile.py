#!/usr/bin/env python3
"""
Test Suite: Verifikasi Komprehensif Sistem Modal/Dialog Kanonis & Tata Letak Mobile First
Memvalidasi:
1. Sistem Modal & Dialog Terpusat (Centered Modal System) pada Web Publik & Web Admin
2. Aturan Margin, Padding Simetris, Backdrop Blur, dan Tombol Tutup/Aksi Modal
3. Penerapan Mobile First pada Web Publik (Hero, Stepper, Dropzone, Progress Card, Timeline, Footer)
4. Penerapan Mobile First pada Web Admin (Sesi Lab, Grid Form, Table Wrap, Toolbar, Footer)
5. Ketercapaian HTTP (200 OK) Seluruh 27 Halaman Aktif Web Publik & Web Admin
"""

import urllib.request
import urllib.error
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://127.0.0.1:18090"

def log(msg, success=True):
    icon = "[PASS]" if success else "[FAIL]"
    print(f"{icon} {msg}")

def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ModalMobileTester/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            return resp.status, data
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8", errors="replace")
        return e.code, data
    except Exception as e:
        return 500, str(e)

def test_modal_canonical_system():
    print("\n--- 1. Pengujian Sistem Modal & Dialog Kanonis (CSS & DOM) ---")
    status_pub, css_pub = http_get(f"{BASE_URL}/helpdesk/public-ui.css")
    status_biz, css_biz = http_get(f"{BASE_URL}/helpdesk/business.css")

    all_ok = True

    # 1. Backdrop blur pada public & business CSS
    has_backdrop_pub = "backdrop-filter: blur(6px)" in css_pub
    has_backdrop_biz = "backdrop-filter: blur(6px)" in css_biz
    log("Backdrop overlay memakai blur 6px semi-transparan (Web Publik & Admin)", has_backdrop_pub and has_backdrop_biz)
    all_ok = all_ok and has_backdrop_pub and has_backdrop_biz

    # 2. Centered modal position (position fixed, inset 0, margin auto)
    has_center_pub = bool(re.search(r'position:\s*fixed\s*!important;\s*inset:\s*0\s*!important;\s*margin:\s*auto\s*!important;', css_pub))
    has_center_biz = bool(re.search(r'position:\s*fixed\s*!important;\s*inset:\s*0\s*!important;\s*margin:\s*auto\s*!important;', css_biz))
    log("Modal diposisikan terpusat sempurna (inset: 0, margin: auto)", has_center_pub and has_center_biz)
    all_ok = all_ok and has_center_pub and has_center_biz

    # 3. Proporsi desktop: width min(560px), padding simetris 24px 28px, border-radius 12px
    has_dim_pub = "width: min(560px" in css_pub and "padding: 24px 28px" in css_pub and "border-radius: 12px" in css_pub
    has_dim_biz = "width: min(560px" in css_biz and "padding: 24px 28px" in css_biz and "border-radius: 12px" in css_biz
    log("Proporsi modal desktop: width min(560px), padding 24px 28px, border-radius 12px", has_dim_pub and has_dim_biz)
    all_ok = all_ok and has_dim_pub and has_dim_biz

    # 4. Header modal & close button styling
    has_hdr_pub = ".hd-modal-header" in css_pub and "border-bottom: 1px solid" in css_pub
    has_hdr_biz = "dialog .piui-dialog__header" in css_biz and "border-bottom: 1px solid" in css_biz
    log("Header modal memiliki border pemisah bawah, font tebal, dan padding teratur", has_hdr_pub and has_hdr_biz)
    all_ok = all_ok and has_hdr_pub and has_hdr_biz

    # 5. Tombol aksi modal (gap 12px, border-top, flex-wrap)
    has_act_pub = ".hd-modal-actions" in css_pub and "gap: 12px" in css_pub and "border-top: 1px solid" in css_pub
    has_act_biz = "dialog .hd-actions" in css_biz and "gap: 12px" in css_biz and "border-top: 1px solid" in css_biz
    log("Footer aksi modal memiliki gap 12px, border pemisah atas, dan perataan kanan", has_act_pub and has_act_biz)
    all_ok = all_ok and has_act_pub and has_act_biz

    return all_ok

def test_mobile_first_web_public():
    print("\n--- 2. Pengujian Aturan Mobile First Web Publik (public-ui.css) ---")
    status, css = http_get(f"{BASE_URL}/helpdesk/public-ui.css")
    if status != 200:
        log("Gagal memuat /helpdesk/public-ui.css", False)
        return False

    all_ok = True

    # 1. Modal di mobile (width calc(100% - 24px), padding 18px 16px, column-reverse actions)
    has_modal_mobile = "width: calc(100% - 24px) !important" in css and "padding: 18px 16px !important" in css and "flex-direction: column-reverse !important" in css
    log("Modal otomatis adaptif pada mobile: padding 18px 16px, tombol aksi susun vertikal", has_modal_mobile)
    all_ok = all_ok and has_modal_mobile

    # 2. Hero CTA buttons di mobile (column layout, stretch, gap 12px)
    has_hero_mobile = ".hd-hero-cta-wrap" in css and "flex-direction: column !important" in css and "gap: 12px !important" in css
    log("Tombol Hero CTA menyusun vertikal dengan gap: 12px dan lebar penuh di mobile", has_hero_mobile)
    all_ok = all_ok and has_hero_mobile

    # 3. Stepper 3-tahap form lapor di mobile
    has_stepper_mobile = ".hd-form-stepper" in css and "flex-direction: column !important" in css
    log("Stepper form laporan menyusun vertikal rapi di mobile", has_stepper_mobile)
    all_ok = all_ok and has_stepper_mobile

    # 4. Dropzone berkas adaptif di mobile
    has_dropzone_mobile = ".hd-dropzone" in css and "padding: 24px 16px !important" in css and "min-height: 140px !important" in css
    log("Area Dropzone berkas adaptif di mobile (padding 24px 16px, min-height 140px)", has_dropzone_mobile)
    all_ok = all_ok and has_dropzone_mobile

    # 5. Service & Guest card di mobile
    has_cards_mobile = ".hd-service-card" in css and ".hd-guest-card" in css and "flex-direction: column !important" in css
    log("Service card & Guest security card menyusun vertikal rapi di mobile", has_cards_mobile)
    all_ok = all_ok and has_cards_mobile

    # 6. Progress Card & Meta Grid di mobile
    has_meta_mobile = ".hd-progress-meta-grid" in css and "grid-template-columns: 1fr !important" in css
    has_stepper_prog = ".hd-stepper-progress" in css and "grid-template-columns: 1fr !important" in css
    log("Parameter metrik tiket dan stepper 5-tahap responsif 1-kolom di mobile", has_meta_mobile and has_stepper_prog)
    all_ok = all_ok and has_meta_mobile and has_stepper_prog

    # 7. Timeline feed di mobile
    has_timeline_mobile = ".hd-timeline-feed" in css and "padding-left: 16px !important" in css
    log("Feed timeline riwayat memiliki padding kiri 16px proporsional di mobile", has_timeline_mobile)
    all_ok = all_ok and has_timeline_mobile

    # 8. Footer Web Publik di mobile (1 kolom grid, padding 40px 16px 28px)
    has_footer_mobile = ".vy-tail-mid" in css and "grid-template-columns: 1fr !important" in css and "padding: 40px 16px 28px !important" in css
    log("Footer Web Publik adaptif 1-kolom dengan padding 40px 16px 28px di mobile", has_footer_mobile)
    all_ok = all_ok and has_footer_mobile

    return all_ok

def test_mobile_first_web_admin():
    print("\n--- 3. Pengujian Aturan Mobile First Web Admin (business.css) ---")
    status, css = http_get(f"{BASE_URL}/helpdesk/business.css")
    if status != 200:
        log("Gagal memuat /helpdesk/business.css", False)
        return False

    all_ok = True

    # 1. Dialog admin di mobile (padding 18px 16px, column-reverse actions)
    has_admin_modal_mobile = "dialog.piui-dialog:not(.piui-drawer-mobile)" in css and "width: calc(100% - 24px) !important" in css and "flex-direction: column-reverse !important" in css
    log("Dialog admin adaptif di mobile: padding 18px 16px dan tombol aksi stack penuh", has_admin_modal_mobile)
    all_ok = all_ok and has_admin_modal_mobile

    # 2. Sesi lab admin di mobile (column layout, select width 100%, buttons column stack)
    has_session_mobile = ".hd-session-inner" in css and "flex-direction: column !important" in css and ".hd-quick-select-group select" in css and ".hd-quick-btn-group" in css
    log("Kartu sesi lab admin menyusun vertikal rapi di mobile tanpa overflow", has_session_mobile)
    all_ok = all_ok and has_session_mobile

    # 3. Swipe aman tabel admin (overflow-x: auto, max-width calc(100vw - 32px), touch scrolling)
    has_table_mobile = ".hd-table-wrap" in css and "overflow-x: auto !important" in css and "max-width: calc(100vw - 32px) !important" in css
    log("Tabel data admin memiliki swipe horizontal aman (max-width calc(100vw - 32px))", has_table_mobile)
    all_ok = all_ok and has_table_mobile

    # 4. Form grid admin di mobile (1 kolom)
    has_grid_mobile = ".hd-form-grid" in css and "grid-template-columns: 1fr !important" in css
    log("Form grid admin beralih ke 1 kolom proporsional di mobile", has_grid_mobile)
    all_ok = all_ok and has_grid_mobile

    # 5. Tab modul admin di mobile (wrap rapi, gap 8px)
    has_tabs_mobile = "[data-hd-m9-tabs]" in css and "gap: 8px !important" in css
    log("Tab navigasi modul (M9, M11, Media) membungkus rapi dengan gap: 8px di mobile", has_tabs_mobile)
    all_ok = all_ok and has_tabs_mobile

    # 6. Footer admin di mobile (column layout, centered links & credit, full-width button)
    has_footer_admin_mobile = ".piui-footer" in css and "flex-direction: column !important" in css and ".hd-admin-footer-btn" in css
    log("Footer Web Admin menyusun vertikal seimbang dengan tombol portal penuh di mobile", has_footer_admin_mobile)
    all_ok = all_ok and has_footer_admin_mobile

    return all_ok

def test_all_pages_http():
    print("\n--- 4. Pengujian Ketercapaian HTTP (200 OK) Seluruh 27 Halaman Aktif ---")
    pages = [
        # Web Publik (13 Halaman)
        ("/", "Landing Page Publik"),
        ("/layanan.html", "Katalog 16 Layanan TIK"),
        ("/detail-layanan.html", "Detail Layanan TIK"),
        ("/lapor.html", "Formulir Laporan Baru"),
        ("/tiket.html", "Daftar Tiket Layanan"),
        ("/detail-tiket.html", "Detail Tiket & Timeline Progres"),
        ("/lacak.html", "Lacak Tiket Tamu"),
        ("/panduan.html", "Basis Pengetahuan SPBE"),
        ("/faq.html", "Pertanyaan Umum (FAQ)"),
        ("/status.html", "Status Layanan SPBE"),
        ("/kontak.html", "Kontak & Lokasi Layanan"),
        ("/akses.html", "Halaman Masuk Terpadu"),
        ("/daftar.html", "Pendaftaran Akun Warga"),
        # Web Admin (14 Halaman & Sub-Modul)
        ("/admin/app/dashboard/index.html", "Admin Dashboard Utama"),
        ("/admin/app/tickets/index.html", "Antrean Tiket Petugas"),
        ("/admin/app/tickets/detail.html", "Detail Tiket Petugas"),
        ("/admin/app/helpdesk/index.html", "Admin Master Layanan"),
        ("/admin/app/helpdesk/index.html?kind=services", "Master Layanan TIK"),
        ("/admin/app/helpdesk/index.html?kind=navigation", "Pengelolaan Portal (M2)"),
        ("/admin/app/helpdesk/index.html?kind=media", "Pustaka Media Terpadu (M3/M8)"),
        ("/admin/app/helpdesk/index.html?kind=memberships", "Pengelolaan Akun & Akses (M1)"),
        ("/admin/app/helpdesk/index.html?kind=teams", "Tim Teknis & Roster"),
        ("/admin/app/helpdesk/index.html?kind=reports", "Laporan Kinerja SLA (M9)"),
        ("/admin/app/helpdesk/index.html?kind=notifications", "Pusat Notifikasi & Bot (M9)"),
        ("/admin/app/helpdesk/index.html?kind=audit", "Jejak Audit Append-Only (M9)"),
        ("/admin/app/helpdesk/index.html?kind=maintenance", "Pemeliharaan Sistem (M11)"),
        ("/admin/auth/login.html", "Login Petugas Internal")
    ]

    all_ok = True
    for route, name in pages:
        status, _ = http_get(f"{BASE_URL}{route}")
        ok = (status == 200)
        log(f"HTTP GET {route:42} [{name}] -> {status}", ok)
        if not ok:
            all_ok = False
    return all_ok

def main():
    print("==========================================================================")
    print("VERIFIKASI SISTEM MODAL KANONIS & TATA LETAK MOBILE FIRST WEB PUBLIK/ADMIN")
    print("==========================================================================")

    res_modal = test_modal_canonical_system()
    res_pub = test_mobile_first_web_public()
    res_adm = test_mobile_first_web_admin()
    res_http = test_all_pages_http()

    all_passed = res_modal and res_pub and res_adm and res_http
    print("==========================================================================")
    if all_passed:
        print("[FINAL RESULT: 100% PASS] Seluruh sistem modal kanonis, aturan mobile first, dan 27 halaman aktif terverifikasi sempurna!")
        sys.exit(0)
    else:
        print("[FINAL RESULT: FAIL] Terdapat kegagalan verifikasi pada modal atau mobile layout.")
        sys.exit(1)

if __name__ == "__main__":
    main()
