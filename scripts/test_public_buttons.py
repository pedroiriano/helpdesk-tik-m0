"""
scripts/test_public_buttons.py
Memverifikasi Penyeragaman Tombol Aksi Web Publik, Ikon Semantik, dan Affordance Kanonis.
"""
import urllib.request
import urllib.error
import re
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:18090"

def get(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={"User-Agent": "ButtonAffordanceVerifier/1.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")

def check(condition, msg):
    if not condition:
        print(f"[FAIL] {msg}")
        sys.exit(1)
    print(f"[PASS] {msg}")

def test_css_rules():
    print("=== Testing CSS Button Affordance Rules ===")
    css_public = get("/helpdesk/public-ui.css")
    css_biz = get("/helpdesk/business.css")

    # 1. Base .btn must disable forced uppercase
    check("text-transform: none !important;" in css_public, "public-ui.css disables forced uppercase with text-transform: none !important")
    check("min-height: 42px;" in css_public, "public-ui.css sets min-height 42px for touch target")
    check("border-radius: 8px;" in css_public, "public-ui.css sets button border-radius 8px")

    # 2. Semantic variants in public-ui.css
    check(".btn-primary" in css_public, "public-ui.css has .btn-primary variant")
    check(".btn-secondary" in css_public, "public-ui.css has .btn-secondary variant")
    check(".btn-success" in css_public, "public-ui.css has .btn-success variant")
    check(".btn-danger" in css_public, "public-ui.css has .btn-danger variant")
    check(".hd-btn-icon" in css_public, "public-ui.css defines .hd-btn-icon")

    # 3. Toolbars
    check(".hd-ticket-nav" in css_public, "public-ui.css defines .hd-ticket-nav")
    check(".hd-pager-nav" in css_public, "public-ui.css defines .hd-pager-nav")
    check(".hd-btn-filter" in css_public, "public-ui.css defines .hd-btn-filter")

    # 4. business.css
    check(".btn" in css_biz, "business.css defines .btn base styling")
    check(".btn-primary" in css_biz, "business.css defines .btn-primary")
    check(".hd-ticket-nav" in css_biz, "business.css defines .hd-ticket-nav")


def test_html_pages():
    print("\n=== Testing HTML Pages Button Structure & Icons ===")

    # 1. detail-tiket.html
    html_dt = get("/detail-tiket.html")
    check("hd-ticket-nav" in html_dt, "detail-tiket.html has hd-ticket-nav toolbar")
    check("hd-btn-nav" in html_dt, "detail-tiket.html has hd-btn-nav items")
    check("📋</span> Katalog Layanan" in html_dt, "detail-tiket.html nav has 📋 Katalog Layanan")
    check("📑</span> Daftar Tiket" in html_dt, "detail-tiket.html nav has 📑 Daftar Tiket")
    check("🔍</span> Lacak Tiket Tamu" in html_dt, "detail-tiket.html nav has 🔍 Lacak Tiket Tamu")
    check("🔐</span> Masuk SSO ASN" in html_dt, "detail-tiket.html nav has 🔐 Masuk SSO ASN")

    check("hd-pager-nav" in html_dt, "detail-tiket.html has hd-pager-nav")
    check("hd-btn-pager" in html_dt, "detail-tiket.html has hd-btn-pager class")
    check("←</span> Sebelumnya" in html_dt, "detail-tiket.html pager has ← Sebelumnya")
    check("Berikutnya <span aria-hidden=\"true\">→</span>" in html_dt, "detail-tiket.html pager has Berikutnya →")

    check("hd-detail-actions" in html_dt, "detail-tiket.html has hd-detail-actions")
    check("🔄</span> Muat Ulang Tiket" in html_dt, "detail-tiket.html refresh button has 🔄 Muat Ulang Tiket")
    check("✓</span> Sahkan Verifikasi" in html_dt, "detail-tiket.html verify button has ✓ Sahkan Verifikasi")
    check("✕</span> Tolak Laporan" in html_dt, "detail-tiket.html reject button has ✕ Tolak Laporan")
    check("👷</span> Tugaskan Teknisi" in html_dt, "detail-tiket.html dispatch button has 👷 Tugaskan Teknisi")
    check("✅</span> Selesaikan Tiket" in html_dt, "detail-tiket.html resolve button has ✅ Selesaikan Tiket")
    check("👍</span> Setuju / Selesai" in html_dt, "detail-tiket.html confirm accept button has 👍 Setuju / Selesai")
    check("💬</span> Kirim Komentar" in html_dt, "detail-tiket.html comment button has 💬 Kirim Komentar")
    check("📤</span> Unggah Lampiran" in html_dt, "detail-tiket.html upload button has 📤 Unggah Lampiran")
    check("🖼️</span> Buka Pustaka Media" in html_dt, "detail-tiket.html media picker button has 🖼️ Buka Pustaka Media")

    # 2. tiket.html
    html_t = get("/tiket.html")
    check("hd-queue-filters" in html_t, "tiket.html has hd-queue-filters")
    check("📁</span> Semua Tiket" in html_t, "tiket.html has 📁 Semua Tiket")
    check("🔍</span> Antrean Verifikasi" in html_t, "tiket.html has 🔍 Antrean Verifikasi")
    check("👷</span> Antrean Disposisi" in html_t, "tiket.html has 👷 Antrean Disposisi")
    check("🛠️</span> Tugas Saya" in html_t, "tiket.html has 🛠️ Tugas Saya")
    check("hd-pager-nav" in html_t, "tiket.html has hd-pager-nav")

    # 3. lacak.html
    html_l = get("/lacak.html")
    check("hd-ticket-nav" in html_l, "lacak.html has hd-ticket-nav")
    check("🔍</span> Buka Pelacakan Tiket" in html_l, "lacak.html has 🔍 Buka Pelacakan Tiket")

    # 4. lapor.html
    html_lp = get("/lapor.html")
    check("hd-ticket-nav" in html_lp, "lapor.html has hd-ticket-nav")
    check("🚀</span> Kirim Laporan Sekarang" in html_lp, "lapor.html has 🚀 Kirim Laporan Sekarang")
    check("📋</span> Pulihkan Draft" in html_lp, "lapor.html has 📋 Pulihkan Draft")
    check("🗑️</span> Buang Draft" in html_lp, "lapor.html has 🗑️ Buang Draft")

    # 5. layanan.html
    html_lay = get("/layanan.html")
    check("hd-ticket-nav" in html_lay, "layanan.html has hd-ticket-nav in session")
    check("hd-pager-nav" in html_lay, "layanan.html has hd-pager-nav")
    check("←</span> Halaman Sebelumnya" in html_lay, "layanan.html has ← Halaman Sebelumnya")
    check("Halaman Berikutnya <span aria-hidden=\"true\">→</span>" in html_lay, "layanan.html has Halaman Berikutnya →")

    # 6. daftar.html & akses.html
    html_reg = get("/daftar.html")
    check("Daftar Akun Baru &rarr;" in html_reg, "daftar.html has register button")
    check("Sudah Punya Akun? Masuk" in html_reg, "daftar.html has link to login")

    html_login = get("/akses.html")
    check("Masuk sebagai Warga &rarr;" in html_login, "akses.html has citizen login button")
    check("Masuk dengan SSO ASN Depok &rarr;" in html_login, "akses.html has ASN SSO login button")

    # 7. faq.html & status.html
    html_faq = get("/faq.html")
    check("📋</span> Buka Katalog Layanan &rarr;" in html_faq, "faq.html has 📋 Buka Katalog Layanan")
    check("📖</span> Lihat Panduan Lengkap" in html_faq, "faq.html has 📖 Lihat Panduan Lengkap")

    print("\n[SUCCESS] All button checks passed cleanly 100%!")

if __name__ == "__main__":
    test_css_rules()
    test_html_pages()
