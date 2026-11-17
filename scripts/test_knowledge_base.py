# -*- coding: utf-8 -*-
"""
scripts/test_knowledge_base.py
Pengujian Komprehensif Portal Basis Pengetahuan & Panduan Operasional TIK (M8)
Pemerintah Kota Depok · Helpdesk TIK
"""

import sys
import re
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:18090"
ROOT = Path(r"c:\Datas\Proyek\Aplikasi\helpdesk-monolith")
DIST_KB = ROOT / "frontend" / "dist" / "panduan.html"
PUBLIC_UI_CSS = ROOT / "frontend" / "public-ui.css"

def get(path: str) -> str:
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={"User-Agent": "KnowledgeBaseTester/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200, f"HTTP status {resp.status} for {url}"
        return resp.read().decode("utf-8")

def check(condition: bool, msg: str):
    if not condition:
        print(f"[FAIL] {msg}")
        sys.exit(1)
    print(f"[PASS] {msg}")

def test_routes():
    print("\n--- 1. Pengujian Rute & Rewrite Nginx Knowledge Base ---")
    routes = [
        "/panduan.html",
        "/panduan",
        "/panduan/konfigurasi-email-depok-go-id",
        "/panduan/pengajuan-tte-bsre",
        "/panduan/penanganan-insiden-csirt",
        "/panduan/koneksi-wifi-balaikota",
    ]
    for r in routes:
        html = get(r)
        check("Basis Pengetahuan &amp; Panduan Operasional TIK" in html, f"Rute {r} menyajikan halaman Basis Pengetahuan TIK resmi")

def test_header_clearance_and_navbar():
    print("\n--- 2. Pengujian Clearance Header dari Floating Capsule Navbar ---")
    css = (ROOT / "frontend" / "dist" / "helpdesk" / "public-ui.css").read_text(encoding="utf-8")
    
    # Check padding-top clearance for main
    clearance_match = re.search(r'\[data-helpdesk-public\]\s*main\.vy-shell,\s*\[data-helpdesk-public\]\s*main\[data-hd-page\]\s*\{[^}]*padding-top:\s*clamp\(100px,\s*12vw,\s*130px\)\s*!important;', css)
    check(bool(clearance_match), "Clearance aman main.vy-shell / main[data-hd-page] terhadap floating pill navbar (clamp 100px-130px)")

    # Check font-family fallback for emoji
    font_match = re.search(r'font-family:\s*"Apple Color Emoji",\s*"Segoe UI Emoji"', css)
    check(bool(font_match), "Emoji font-family fallback dikonfigurasi untuk mencegah glyph kotak hitam rusak")

def test_hero_and_filters():
    print("\n--- 3. Pengujian Hero Banner, Live Search & Category Filter Pills ---")
    html = get("/panduan.html")

    check('class="hd-kb-hero"' in html, "Hero banner knowledge base .hd-kb-hero tersedia")
    check('PUSAT EDUKASI &amp; INFORMASI SPBE KOTA DEPOK' in html, "Badge identitas kedinasan SPBE Kota Depok terpasang")
    check('id="hd-knowledge-search"' in html, "Input pencarian langsung #hd-knowledge-search terpasang")
    check('data-hd-search-clear' in html, "Tombol reset pencarian tersedia")
    check('class="hd-kb-filter-tabs"' in html, "Navigasi tab filter kategori .hd-kb-filter-tabs tersedia")
    
    categories = ["all", "spbe", "csirt", "network", "app", "identity", "news"]
    for cat in categories:
        check(f'data-hd-kb-filter="{cat}"' in html, f"Filter kategori pill '{cat}' terdaftar")

    check('id="hd-kb-count"' in html, "Badge penghitung hasil pencarian #hd-kb-count tersedia")

def test_featured_guide():
    print("\n--- 4. Pengujian Featured Hero Guide (Sorotan Panduan Utama) ---")
    html = get("/panduan.html")

    check('class="hd-featured-guide"' in html, "Komponen featured guide .hd-featured-guide tersedia")
    check('PANDUAN UNGGULAN' in html, "Badge 'PANDUAN UNGGULAN' terpasang")
    check('data-hd-read-slug="panduan-konfigurasi-email-depok-go-id"' in html, "Tombol CTA featured guide terhubung ke slug artikel email dinas")
    check('ilustrasi-panduan-pengetahuan.png' in html, "Ilustrasi visual pendukung utama disematkan")

def test_knowledge_grid_and_cards():
    print("\n--- 5. Pengujian Grid Kartu Panduan & Berita (8 Kartu) ---")
    html = get("/panduan.html")

    check('id="hd-knowledge-grid"' in html, "Grid kontainer #hd-knowledge-grid tersedia")
    
    cards = re.findall(r'<article class="hd-knowledge-card"[^>]*>', html)
    check(len(cards) == 8, f"Tepat 8 kartu panduan/berita dirender (aktual: {len(cards)})")

    # Pastikan tidak ada karakter kotak hitam rusak ■
    check("■" not in html, "Nol karakter glyph rusak (■) pada seluruh halaman panduan")

    # Pastikan thumbnail ilustrasi resmi disematkan
    illustrations = [
        "ilustrasi-akun-identitas.png",
        "ilustrasi-keamanan-siber.png",
        "ilustrasi-notifikasi-audit.png",
        "ilustrasi-wifi-jaringan.png",
        "ilustrasi-panduan-pengetahuan.png",
        "ilustrasi-cloud-layanan.png",
        "ilustrasi-server-infrastruktur.png",
        "ilustrasi-aplikasi-digital.png"
    ]
    for il in illustrations:
        check(il in html, f"Thumbnail resmi '{il}' aktif pada kartu panduan")

def test_article_modal_and_templates():
    print("\n--- 6. Pengujian Dialog Modal Pembaca Artikel (WAI-ARIA) & Template ---")
    html = get("/panduan.html")

    check('<dialog id="hd-article-modal"' in html, "Elemen dialog semantik #hd-article-modal terpasang")
    check('data-hd-article-modal' in html, "Atribut data-hd-article-modal terpasang")
    check('aria-labelledby="hd-modal-article-title"' in html, "WAI-ARIA aria-labelledby terhubung ke judul artikel")
    check('id="hd-modal-print"' in html, "Tombol cetak/simpan PDF artikel tersedia")
    check('id="hd-modal-copy"' in html, "Tombol salin tautan artikel tersedia")
    check('data-hd-close-article' in html, "Tombol tutup dialog artikel tersedia")

    # Cek seluruh 8 template artikel
    slugs = [
        "panduan-konfigurasi-email-depok-go-id",
        "panduan-pengajuan-tte-bsre",
        "panduan-penanganan-insiden-csirt",
        "panduan-koneksi-wifi-balaikota",
        "panduan-standar-keamanan-password-spbe",
        "panduan-integrasi-api-spbe",
        "panduan-jadwal-pemeliharaan-server",
        "berita-penguatan-spbe-2026"
    ]
    for s in slugs:
        check(f'data-hd-article-template="{s}"' in html, f"Template lengkap '{s}' siap dimuat ke dalam modal")

def test_mobile_responsiveness():
    print("\n--- 7. Pengujian Responsivitas Mobile KB (< 640px) ---")
    css = (ROOT / "frontend" / "dist" / "helpdesk" / "public-ui.css").read_text(encoding="utf-8")
    
    check("@media (max-width: 640px)" in css, "Breakpoint mobile <= 640px aktif di public-ui.css")
    check(".hd-knowledge-grid" in css, "Grid kartu beradaptasi untuk tampilan mobile")
    check(".hd-featured-guide" in css, "Featured guide layout grid runtuh secara vertikal di layar sempit")

if __name__ == "__main__":
    print("======================================================================")
    print("  VERIFIKASI INTEGRITAS BASIS PENGETAHUAN & PANDUAN TIK (M8) KOTA DEPOK")
    print("======================================================================")
    test_routes()
    test_header_clearance_and_navbar()
    test_hero_and_filters()
    test_featured_guide()
    test_knowledge_grid_and_cards()
    test_article_modal_and_templates()
    test_mobile_responsiveness()
    print("\n======================================================================")
    print("  [SUCCESS] 100% PENGUJIAN KNOWLEDGE BASE LULUS SEMPURNA TANPA CACAT!")
    print("======================================================================")
