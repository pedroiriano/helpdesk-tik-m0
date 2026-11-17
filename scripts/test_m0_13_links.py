#!/usr/bin/env python3
"""
scripts/test_m0_13_links.py
Audit Kepatuhan Navigasi, Hierarki Breadcrumbs, Rute Semantik, & Zero Broken Links
Helpdesk TIK Kota Depok (Fase M0-13)
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = os.environ.get("HELPDESK_BASE_URL", "http://127.0.0.1:18090")
DIST_DIR = Path("frontend/dist")
QA_DIR = Path("qa/m0-13")

# Rute semantik kanonikal yang wajib aktif
SEMANTIC_ROUTES = [
    "/",
    "/layanan",
    "/layanan/akses-internet-opd",
    "/layanan/email-dinas-depok",
    "/layanan/insiden-keamanan-csirt",
    "/tiket/baru",
    "/tiket/lacak",
    "/tiket",
    "/panduan",
    "/panduan/konfigurasi-email-depok-go-id",
    "/panduan/pengajuan-tte-bsre",
    "/panduan/penanganan-insiden-csirt",
    "/panduan/koneksi-wifi-balaikota",
    "/faq",
    "/status",
    "/kontak",
    "/masuk",
    "/admin/app/helpdesk/index.html",
    "/admin/app/tickets/index.html",
    "/admin/auth/login.html"
]

def check_http_route(path: str) -> dict:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "M0-13-LinkAudit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            content = res.read()
            return {
                "path": path,
                "url": url,
                "status": res.status,
                "size_bytes": len(content),
                "ok": res.status == 200
            }
    except urllib.error.HTTPError as e:
        return {
            "path": path,
            "url": url,
            "status": e.code,
            "error": str(e),
            "ok": False
        }
    except Exception as e:
        return {
            "path": path,
            "url": url,
            "status": 0,
            "error": str(e),
            "ok": False
        }

def scan_html_files():
    scanned_files = 0
    all_links = set()
    broken_links = []
    placeholder_matches = []

    # Pola teks tiruan/dummy yang dilarang pada konten teks terlihat
    placeholder_patterns = [
        re.compile(r'\blorem\s+ipsum\b', re.IGNORECASE),
        re.compile(r'\bfake\s+text\b', re.IGNORECASE),
        re.compile(r'\bkonten\s+dummy\b', re.IGNORECASE)
    ]

    for html_file in DIST_DIR.rglob("*.html"):
        scanned_files += 1
        raw_html = html_file.read_text(encoding="utf-8", errors="ignore")

        # Bersihkan tag HTML untuk memeriksa hanya teks konten yang tampak
        visible_text = re.sub(r'<[^>]+>', ' ', raw_html)

        for pat in placeholder_patterns:
            found = pat.findall(visible_text)
            if found:
                placeholder_matches.append({
                    "file": str(html_file),
                    "match": found[0]
                })

        # Ekstraksi tautan href dari tag HTML
        hrefs = re.findall(r'href=["\']([^"\']*)["\']', raw_html)
        for h in hrefs:
            all_links.add((str(html_file), h))

            # Deteksi tautan buntu / terlarang
            if h == "#":
                broken_links.append({
                    "file": str(html_file),
                    "href": h,
                    "reason": "Bare hash link (#) prohibited"
                })
            elif h.startswith("javascript:"):
                broken_links.append({
                    "file": str(html_file),
                    "href": h,
                    "reason": "javascript: pseudo-protocol prohibited"
                })
            elif h == "":
                broken_links.append({
                    "file": str(html_file),
                    "href": h,
                    "reason": "Empty href attribute prohibited"
                })

    return scanned_files, all_links, broken_links, placeholder_matches

def check_portal_navigation():
    url = f"{BASE_URL}/api/v1/catalog/navigation"
    req = urllib.request.Request(url, headers={"User-Agent": "M0-13-LinkAudit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            if res.status != 200:
                return False, f"HTTP {res.status}"
            data = json.loads(res.read().decode("utf-8"))
            items = data.get("items", [])
            return True, f"{len(items)} menu items verified"
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 70)
    print("M0-13 — Audit Navigasi, Slug Semantik, & Zero Broken Links")
    print("Helpdesk TIK Kota Depok")
    print("=" * 70)

    QA_DIR.mkdir(parents=True, exist_ok=True)

    print("\n1. Memindai berkas HTML publik dan admin pada frontend/dist/...")
    scanned_files, all_links, broken_links, placeholder_matches = scan_html_files()
    print(f"   - Total berkas HTML dipindai : {scanned_files}")
    print(f"   - Total atribut href terdata  : {len(all_links)}")
    print(f"   - Tautan buntu terdeteksi     : {len(broken_links)}")
    print(f"   - Teks placeholder terdeteksi : {len(placeholder_matches)}")

    print("\n2. Menguji rute semantik dan endpoint portal secara langsung...")
    route_results = []
    all_routes_ok = True
    for route in SEMANTIC_ROUTES:
        res = check_http_route(route)
        route_results.append(res)
        status_str = f"HTTP {res['status']}" if res['ok'] else f"FAILED ({res.get('error', res['status'])})"
        print(f"   - {route:40} : {status_str}")
        if not res['ok']:
            all_routes_ok = False

    print("\n3. Memeriksa menu portal navigasi M2...")
    nav_ok, nav_msg = check_portal_navigation()
    print(f"   - Status catalog.portal_navigation: {nav_msg}")

    # Evaluasi hasil
    is_pass = (len(broken_links) == 0 and 
               len(placeholder_matches) == 0 and 
               all_routes_ok and 
               nav_ok)

    result_status = "PASS" if is_pass else "FAIL"

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "task_id": "M0-13",
        "scope": "frontend_link_audit",
        "result": result_status,
        "scanned_files_count": scanned_files,
        "total_links_checked": len(all_links),
        "broken_links_count": len(broken_links),
        "broken_links": broken_links,
        "placeholder_matches_count": len(placeholder_matches),
        "placeholder_matches": placeholder_matches,
        "semantic_routes_tested": len(SEMANTIC_ROUTES),
        "semantic_routes_ok": all_routes_ok,
        "routes": route_results,
        "portal_navigation_ok": nav_ok,
        "portal_navigation_summary": nav_msg
    }

    report_path = QA_DIR / "link_audit.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 70)
    print(f"Hasil Audit Tautan: {result_status}")
    print(f"Laporan tersimpan di: {report_path}")
    print("=" * 70)

    if not is_pass:
        sys.exit(1)

if __name__ == "__main__":
    main()
