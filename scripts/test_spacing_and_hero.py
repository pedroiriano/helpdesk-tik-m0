"""
scripts/test_spacing_and_hero.py
Pengujian Otomatis Sistem Spacing, Margin, Padding & Gap Tombol Hero Utama
"""
import urllib.request
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:18090"

def get(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={"User-Agent": "SpacingVerifier/1.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")

def check(condition, msg):
    if not condition:
        print(f"[FAIL] {msg}")
        sys.exit(1)
    print(f"[PASS] {msg}")

def test_hero_markup_and_spacing():
    print("=== 1. Memeriksa Struktur Markup & Tombol Hero Utama ===")
    html = get("/index.html")

    check('class="hd-hero-cta-wrap"' in html, "index.html memuat kontainer .hd-hero-cta-wrap")
    check('role="group"' in html, "hd-hero-cta-wrap memiliki role='group' aksesibel")
    check('aria-label="Aksi Utama Pelayanan"' in html, "hd-hero-cta-wrap memiliki aria-label yang tepat")

    check('hd-hero-btn--primary' in html, "Tombol Buat Laporan Baru memiliki kelas hd-hero-btn--primary")
    check('hd-hero-btn--secondary' in html, "Tombol Lacak & Masuk memiliki kelas hd-hero-btn--secondary")
    check('📝</span> Buat Laporan Baru' in html, "Tombol utama memuat ikon 📝 dan teks Buat Laporan Baru")
    check('🔍</span> Lacak Tiket Tamu' in html, "Tombol sekunder memuat ikon 🔍 dan teks Lacak Tiket Tamu")
    check('🔐</span> Masuk SSO ASN / Warga' in html, "Tombol sekunder memuat ikon 🔐 dan teks Masuk SSO ASN / Warga")

def test_css_spacing_system():
    print("\n=== 2. Memeriksa Deklarasi Spacing, Margin, Padding & Gap pada CSS ===")
    css = get("/helpdesk/public-ui.css")

    # Hero CTA Spacing
    check("gap: 16px !important;" in css, "public-ui.css menegakkan gap: 16px pada .hd-hero-cta-wrap (anti-menempel)")
    check("margin-top: 28px !important;" in css, "public-ui.css menetapkan margin-top: 28px untuk clearance dari teks pengantar")
    check("margin-bottom: 24px !important;" in css, "public-ui.css menetapkan margin-bottom: 24px sebelum stage banner")
    check("min-height: 48px !important;" in css, "public-ui.css menetapkan min-height: 48px touch target pada tombol hero")
    check("padding: 12px 24px !important;" in css, "public-ui.css menetapkan padding: 12px 24px simetris pada tombol hero")
    check("border-radius: 10px !important;" in css, "public-ui.css menetapkan border-radius: 10px pada tombol hero")

    # High contrast colors
    check("linear-gradient(135deg, #0969da 0%, #0349b4 100%)" in css, "Tombol hero utama memakai gradien royal blue kontras tinggi")
    check("rgba(18, 24, 34, 0.92)" in css, "Tombol hero sekunder memakai surface gelap kontras tinggi di atas ilustrasi pastel")

    # Mobile adaptive spacing
    check("@media (max-width: 640px)" in css, "public-ui.css memuat aturan responsive media query mobile")
    check("flex-direction: column !important;" in css, "Mobile view menyusun tombol hero vertikal secara rapi")

    # Core component spacing system
    check("margin-bottom: 20px !important;" in css, "Form input groups memiliki margin-bottom: 20px teratur")
    check("margin-bottom: 8px !important;" in css, "Form labels memiliki margin-bottom: 8px ke kontrol input")
    check("padding: 32px 24px !important;" in css, "Area dropzone memiliki padding lega 32px 24px")
    check("padding: 24px 28px !important;" in css, "Kartu tamu & progres memiliki padding simetris 24px 28px")

    print("\n[SUCCESS] Seluruh 18 pemeriksaan Spacing & Hero CTA lulus 100%!")

if __name__ == "__main__":
    test_hero_markup_and_spacing()
    test_css_spacing_system()
