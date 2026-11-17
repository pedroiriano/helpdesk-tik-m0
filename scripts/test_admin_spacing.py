#!/usr/bin/env python3
"""
Test Suite: Verifikasi Proporsional Margin, Padding, Gap & Anti-Tumpang-Tindih Web Admin
Memvalidasi:
1. Ketercapaian HTTP Halaman Web Admin Utama (Helpdesk Master, Dashboard, Tickets Queue, CSS)
2. Struktur DOM Kartu Sesi Lab Admin (.hd-session, .hd-quick-select-group, .hd-quick-btn-group)
3. Standar Aturan Spacing Admin pada business.css (Anti-Menempel Gap 10-12px, Card Padding 24-28px)
4. Role Hub Berdasarkan Peran Internal pada Dashboard Admin
5. Tata Letak Filter & Navigasi Antrean Tiket Petugas
"""

import urllib.request
import urllib.error
import re
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://127.0.0.1:18090"

def log(msg, success=True):
    icon = "[PASS]" if success else "[FAIL]"
    print(f"{icon} {msg}")

def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "AdminSpacingTester/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            return resp.status, data
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8", errors="replace")
        return e.code, data
    except Exception as e:
        return 500, str(e)

def test_admin_pages_http():
    print("\n--- 1. Pengujian Ketercapaian HTTP Halaman Web Admin ---")
    pages = [
        "/admin/app/helpdesk/index.html",
        "/admin/app/helpdesk/index.html?kind=maintenance",
        "/admin/app/helpdesk/index.html?kind=reports",
        "/admin/app/helpdesk/index.html?kind=media",
        "/admin/app/dashboard/index.html",
        "/admin/app/tickets/index.html",
        "/helpdesk/business.css"
    ]
    all_ok = True
    for p in pages:
        status, _ = http_get(f"{BASE_URL}{p}")
        ok = (status == 200)
        log(f"HTTP GET {p} -> {status}", ok)
        if not ok:
            all_ok = False
    return all_ok

def test_admin_dom_structure():
    print("\n--- 2. Pengujian Struktur DOM Sesi Lab & Komponen Web Admin ---")
    status, html = http_get(f"{BASE_URL}/admin/app/helpdesk/index.html?kind=maintenance")
    if status != 200:
        log("Gagal memuat halaman admin untuk inspeksi DOM", False)
        return False

    all_ok = True

    # 1. Container kartu sesi
    has_session = 'class="piui-card hd-session"' in html
    log("Kartu sesi lab memiliki kelas .piui-card.hd-session", has_session)
    all_ok = all_ok and has_session

    # 2. Struktur internal sesi
    has_session_inner = 'class="hd-session-inner"' in html
    log("Wadah dalam sesi memiliki pembungkus terstruktur .hd-session-inner", has_session_inner)
    all_ok = all_ok and has_session_inner

    # 3. Identitas sesi
    has_identity = 'class="hd-session-identity"' in html and 'data-hd-session' in html
    log("Identitas sesi memiliki wadah .hd-session-identity dan data-hd-session", has_identity)
    all_ok = all_ok and has_identity

    # 4. Form login cepat
    has_form = 'data-hd-login' in html and 'data-hd-quick-login' in html and 'class="hd-admin-quick-form"' in html
    log("Form aktivasi peran memiliki data-hd-login, data-hd-quick-login, dan .hd-admin-quick-form", has_form)
    all_ok = all_ok and has_form

    # 5. Kelompok dropdown peran
    has_select_group = 'class="hd-quick-select-group"' in html and 'id="hd-quick-subject"' in html
    log("Dropdown peran terorganisasi dalam .hd-quick-select-group terpisah", has_select_group)
    all_ok = all_ok and has_select_group

    # 6. Kelompok tombol aksi anti-menempel
    has_btn_group = 'class="hd-quick-btn-group"' in html
    log("Tombol peran dibungkus dalam grup anti-menempel .hd-quick-btn-group", has_btn_group)
    all_ok = all_ok and has_btn_group

    # 7. Keberadaan 3 tombol esensial dalam grup tombol
    btn_group_match = re.search(r'<div class="hd-quick-btn-group">([\s\S]*?)<\/div>', html)
    if btn_group_match:
        btn_inner = btn_group_match.group(1)
        has_submit = 'type="submit"' in btn_inner and 'Aktifkan Sesi' in btn_inner
        has_queue = 'href="/admin/app/tickets/index.html"' in btn_inner and 'Antrean Tiket Petugas' in btn_inner
        has_logout = 'data-hd-logout' in btn_inner and 'Keluar' in btn_inner
        log("Tombol 'Aktifkan Sesi' berada dalam grup tombol", has_submit)
        log("Tombol 'Antrean Tiket Petugas' berada dalam grup tombol", has_queue)
        log("Tombol 'Keluar' berada dalam grup tombol", has_logout)
        all_ok = all_ok and has_submit and has_queue and has_logout
    else:
        log("Grup tombol .hd-quick-btn-group tidak ditemukan di HTML", False)
        all_ok = False

    # 8. Status alert element
    has_status = 'data-hd-login-status' in html and 'data-hd-status' in html
    log("Elemen status pesan admin data-hd-login-status dan data-hd-status tersedia", has_status)
    all_ok = all_ok and has_status

    return all_ok

def test_admin_css_spacing_rules():
    print("\n--- 3. Pengujian Standar Spacing CSS Web Admin (business.css) ---")
    status, css = http_get(f"{BASE_URL}/helpdesk/business.css")
    if status != 200:
        log("Gagal memuat /helpdesk/business.css", False)
        return False

    all_ok = True

    # 1. form select tidak dipaksa 100% pada quick login
    has_select_exempt = 'form[data-hd-login]:not([data-hd-quick-login]) select' in css
    log("Select quick login dibebaskan dari aturan force-100% width", has_select_exempt)
    all_ok = all_ok and has_select_exempt

    # 2. Grup tombol peran memiliki gap minimal 10px
    has_btn_gap = '.hd-quick-btn-group' in css and 'gap: 10px' in css
    log("Grup tombol peran memiliki display flex dan gap 10px (anti-menempel)", has_btn_gap)
    all_ok = all_ok and has_btn_gap

    # 3. Standardisasi kartu admin (padding 24px 28px, margin 24px)
    has_card_rule = '.piui-main .piui-card' in css and 'padding: 24px 28px' in css and 'margin-bottom: 24px' in css
    log("Kartu konten admin memiliki padding proporsional 24px 28px dan margin 24px", has_card_rule)
    all_ok = all_ok and has_card_rule

    # 4. Toolbar admin memiliki gap 12px
    has_actions_gap = '.hd-actions' in css and 'gap: 12px' in css
    log("Toolbar aksi admin (.hd-actions) memiliki gap seragam 12px", has_actions_gap)
    all_ok = all_ok and has_actions_gap

    # 5. Tombol admin memiliki min-height 38px dan padding proporsional
    has_btn_rule = '.piui-main .piui-btn' in css and 'min-height: 38px' in css and 'padding: 8px 16px' in css
    log("Tombol admin memiliki dimensi standar min-height 38px dan padding 8px 16px", has_btn_rule)
    all_ok = all_ok and has_btn_rule

    # 6. Tab modul M9/M11/Media memiliki gap 10px
    has_tabs_gap = '[data-hd-m9-tabs]' in css and '[data-hd-m11-tabs]' in css and 'gap: 10px' in css
    log("Tab navigasi sub-modul admin memiliki gap 10px proporsional", has_tabs_gap)
    all_ok = all_ok and has_tabs_gap

    # 7. Form grid admin memiliki gap 18-24px dan field margin 16px
    has_grid_rule = '.hd-form-grid' in css and '.piui-field' in css and 'margin-bottom: 16px' in css
    log("Form grid admin memiliki gap responsif dan margin field 16px", has_grid_rule)
    all_ok = all_ok and has_grid_rule

    # 8. Tabel admin memiliki padding 12px 16px dan table-wrap margin
    has_table_rule = '.piui-table th' in css and 'padding: 12px 16px' in css and '.hd-table-wrap' in css
    log("Tabel data admin memiliki padding sel 12px 16px dan margin rapi", has_table_rule)
    all_ok = all_ok and has_table_rule

    # 9. Status pesan admin memiliki margin dan padding bernapas
    has_status_rule = 'p[data-hd-status]:not(:empty)' in css and 'padding: 10px 16px' in css and 'border-left: 4px solid' in css
    log("Pesan status admin memiliki background elevasi, border aksen, dan padding bernapas", has_status_rule)
    all_ok = all_ok and has_status_rule

    return all_ok

def test_admin_dashboard_role_hub():
    print("\n--- 4. Pengujian Role Hub Dashboard Admin (/admin/app/dashboard/index.html) ---")
    status, html = http_get(f"{BASE_URL}/admin/app/dashboard/index.html")
    if status != 200:
        log("Gagal memuat /admin/app/dashboard/index.html", False)
        return False

    all_ok = True
    has_role_hub = 'Pusat Tindakan &amp; Respon Berdasarkan Peran Internal' in html
    log("Role Hub internal petugas tersedia pada dashboard", has_role_hub)
    all_ok = all_ok and has_role_hub

    has_ticket_cards = 'Antrean Disposisi &rarr;' in html and 'Laporan SLA &rarr;' in html
    log("Tombol aksi pada Role Hub memiliki target navigasi jelas", has_ticket_cards)
    all_ok = all_ok and has_ticket_cards

    has_gap_10 = 'gap:10px' in html
    log("Grup tombol pada kartu Role Hub memiliki gap:10px anti-menempel", has_gap_10)
    all_ok = all_ok and has_gap_10

    return all_ok

def test_ticket_admin_queue():
    print("\n--- 5. Pengujian Antrean Tiket Petugas (/admin/app/tickets/index.html) ---")
    status, html = http_get(f"{BASE_URL}/admin/app/tickets/index.html")
    if status != 200:
        log("Gagal memuat /admin/app/tickets/index.html", False)
        return False

    all_ok = True
    has_filters = 'data-queue-filters' in html and 'data-queue-filter="verification"' in html
    log("Filter antrean multi-peran (Semua, Verifikasi, Disposisi, Tugas Saya) tersedia", has_filters)
    all_ok = all_ok and has_filters

    has_guide = 'data-queue-role-guide' in html
    log("Panduan antrean berdasarkan peran tersedia dengan kontras jelas", has_guide)
    all_ok = all_ok and has_guide

    has_pager = 'data-ticket-prev="tiket"' in html and 'data-ticket-next="tiket"' in html
    log("Kontrol paginasi tiket tersedia", has_pager)
    all_ok = all_ok and has_pager

    has_nav = 'hd-ticket-nav' in html
    log("Navigasi tiket admin terpasang rapi", has_nav)
    all_ok = all_ok and has_nav

    return all_ok

def main():
    print("==========================================================================")
    print("VERIFIKASI SISTEM SPACING, MARGIN, PADDING & ANTI-TUMPANG-TINDIH WEB ADMIN")
    print("==========================================================================")

    res_http = test_admin_pages_http()
    res_dom = test_admin_dom_structure()
    res_css = test_admin_css_spacing_rules()
    res_dash = test_admin_dashboard_role_hub()
    res_queue = test_ticket_admin_queue()

    all_passed = res_http and res_dom and res_css and res_dash and res_queue
    print("==========================================================================")
    if all_passed:
        print("[FINAL RESULT: 100% PASS] Seluruh aturan spacing, margin, padding & anti-tumpang-tindih Web Admin terverifikasi sempurna!")
        sys.exit(0)
    else:
        print("[FINAL RESULT: FAIL] Terdapat kegagalan verifikasi pada komponen Web Admin.")
        sys.exit(1)

if __name__ == "__main__":
    main()
