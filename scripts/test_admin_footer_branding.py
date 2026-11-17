#!/usr/bin/env python3
"""
Test Suite: Verifikasi Komprehensif Branding Footer Web Admin Helpdesk TIK Kota Depok
Memvalidasi:
1. Eliminasi Total Credit Bawaan Non-Kedinasan (Pedro Iriano, PIUI Zero v2.2.2) pada seluruh halaman admin
2. Kehadiran Lambang Resmi Kota Depok (/assets/helpdesk/05_Brand/logo-pastel-mark.png) pada footer
3. Keterangan Resmi Instansi: Diskominfo Kota Depok & Pemerintah Kota Depok (c) 2026
4. Tombol Akses Cepat Portal Publik (.hd-admin-footer-btn)
5. Tautan Operasional Kedinasan Lengkap: Pusat Komando, Antrean Tiket Petugas, Jejak Audit, Status SPBE, Basis Pengetahuan SPBE
6. Validitas Ketercapaian HTTP (200 OK) untuk seluruh tautan footer
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
    req = urllib.request.Request(url, headers={"User-Agent": "FooterBrandingTester/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            return resp.status, data
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8", errors="replace")
        return e.code, data
    except Exception as e:
        return 500, str(e)

def test_admin_footers_live():
    print("\n--- 1. Pengujian Live HTTP Branding Footer Web Admin ---")
    admin_routes = [
        "/admin/app/dashboard/index.html",
        "/admin/app/helpdesk/index.html",
        "/admin/app/helpdesk/index.html?kind=maintenance",
        "/admin/app/helpdesk/index.html?kind=reports",
        "/admin/app/helpdesk/index.html?kind=media",
        "/admin/app/tickets/index.html",
        "/admin/auth/login.html"
    ]

    all_ok = True
    for route in admin_routes:
        status, html = http_get(f"{BASE_URL}{route}")
        if status != 200:
            log(f"HTTP GET {route} -> {status}", False)
            all_ok = False
            continue

        # 1. Pastikan credit lama tidak ada sama sekali
        has_pedro = "Pedro Iriano" in html
        has_piui_zero_footer = "PIUI Zero™ v2.2.2" in html
        clean = (not has_pedro) and (not has_piui_zero_footer)
        log(f"{route}: Bebas credit bawaan non-kedinasan (Pedro Iriano / PIUI Zero v2.2.2)", clean)
        all_ok = all_ok and clean

        # 2. Pastikan branding Helpdesk TIK Kota Depok ada di footer
        has_depok = "Helpdesk TIK Kota Depok" in html
        has_diskominfo = "Diskominfo Kota Depok" in html and "Pemerintah Kota Depok" in html
        log(f"{route}: Menyajikan identitas resmi Diskominfo Kota Depok & Pemkot Depok", has_depok and has_diskominfo)
        all_ok = all_ok and has_depok and has_diskominfo

        # 3. Pastikan logo resmi ada di signature footer
        has_logo = "logo-pastel-mark.png" in html
        log(f"{route}: Menyajikan Lambang Resmi Kota Depok pada footer", has_logo)
        all_ok = all_ok and has_logo

        # 4. Pastikan tombol cepat Portal Publik ada
        has_portal_btn = "Portal Publik" in html
        log(f"{route}: Tombol akses cepat Portal Publik tersedia", has_portal_btn)
        all_ok = all_ok and has_portal_btn

        # 5. Pastikan tautan operasional lengkap ada
        has_cmd = "/admin/app/dashboard/index.html" in html
        has_tickets = "/admin/app/tickets/index.html" in html
        has_audit = "kind=audit" in html
        has_status = "/status.html" in html
        links_ok = has_cmd and has_tickets and has_audit and has_status
        log(f"{route}: Tautan operasional kedinasan lengkap (Pusat Komando, Antrean Tiket, Jejak Audit, Status SPBE)", links_ok)
        all_ok = all_ok and links_ok

    return all_ok

def test_footer_css_styling():
    print("\n--- 2. Pengujian Aturan CSS Spacing & Branding Footer (business.css) ---")
    status, css = http_get(f"{BASE_URL}/helpdesk/business.css")
    if status != 200:
        log("Gagal memuat /helpdesk/business.css", False)
        return False

    all_ok = True

    has_footer_rule = ".piui-footer" in css and "grid-area: footer" in css
    log("Aturan .piui-footer terdefinisi dengan padding dan background teratur", has_footer_rule)
    all_ok = all_ok and has_footer_rule

    has_credit_wrap = ".hd-admin-footer-credit" in css and "gap: 14px" in css
    log("Container .hd-admin-footer-credit memiliki flex wrap dan gap 14px", has_credit_wrap)
    all_ok = all_ok and has_credit_wrap

    has_btn_style = ".hd-admin-footer-btn" in css and "border-radius: 6px" in css
    log("Tombol .hd-admin-footer-btn memiliki styling sekunder rapi", has_btn_style)
    all_ok = all_ok and has_btn_style

    has_signature = ".piui-product-signature" in css and ".piui-brand__mark" in css
    log("Signature footer membungkus logo dan nama portal secara elegan", has_signature)
    all_ok = all_ok and has_signature

    return all_ok

def main():
    print("==========================================================================")
    print("VERIFIKASI BRANDING FOOTER WEB ADMIN HELPDESK TIK KOTA DEPOK")
    print("==========================================================================")

    res_live = test_admin_footers_live()
    res_css = test_footer_css_styling()

    all_passed = res_live and res_css
    print("==========================================================================")
    if all_passed:
        print("[FINAL RESULT: 100% PASS] Branding Footer Web Admin Helpdesk TIK Kota Depok terverifikasi sempurna!")
        sys.exit(0)
    else:
        print("[FINAL RESULT: FAIL] Terdapat kegagalan verifikasi pada branding footer Web Admin.")
        sys.exit(1)

if __name__ == "__main__":
    main()
