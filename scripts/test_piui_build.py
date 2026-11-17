"""Check the complete native template distribution produced by npm run build."""
from html.parser import HTMLParser
import re
from pathlib import Path
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "frontend/dist"
WEB = {".html", ".css", ".js", ".json", ".webmanifest", ".svg", ".ico", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".woff", ".woff2", ".txt", ".xml"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.components = []
        self.links = []
        self.in_main = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "main":
            self.in_main = True
        if self.in_main and tag in {"section", "nav", "dialog", "canvas", "form", "details", "table", "input", "button"}:
            self.components.append((tag, attrs.get("id"), attrs.get("class")))
        for attr in ("href", "src", "data-detail"):
            if attrs.get(attr):
                self.links.append(attrs[attr])
        self.links.extend(item.strip().split()[0] for item in attrs.get("srcset", "").split(",") if item.strip())

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = False


def verify():
    counts = {}
    landing = (DIST/"index.html").read_text(encoding="utf8")
    shared_header = re.search(r'<header id="vy-topbar_glide_frame">[\s\S]*?</header>', landing).group()
    shared_footer = re.search(r'<footer class="vy-footer" id="site-footer">[\s\S]*?</footer>', landing).group()

    # 1. Pastikan seluruh berkas dan folder non-Helpdesk BENAR-BENAR TELAH DIHAPUS dari distribusi
    forbidden_paths = [
        "details", "about.html", "brief.html", "contact.html", "gallery.html",
        "pipeline.html", "plan.html", "play.html", "pricing.html", "principle.html",
        "admin/portal.html", "admin/about", "admin/status",
        "admin/app/analytics", "admin/app/audit", "admin/app/components",
        "admin/app/gallery", "admin/app/notifications", "admin/app/settings",
        "admin/app/transactions", "admin/app/users"
    ]
    for bad in forbidden_paths:
        target = DIST / bad
        assert not target.exists(), f"Halaman non-Helpdesk masih ada di dist: {bad}"

    # 2. Verifikasi aset statis dari references yang dipublikasikan
    for package, mount in [("piui-modern", ""), ("piui-zero", "admin")]:
        base = ROOT / "references" / package
        files = same = 0
        for path in base.rglob("*"):
            rel = path.relative_to(base)
            if any(part.startswith(".") or part == "dist" for part in rel.parts):
                continue
            if not path.is_file() or path.suffix.lower() not in WEB or path.suffix == ".html":
                continue
            dest = DIST / mount / rel
            if not dest.is_file():
                continue
            original, built = path.read_bytes(), dest.read_bytes()
            files += 1
            same += original == built
            if path.suffix == ".css" or path.suffix.lower() in {".jpg", ".png", ".webp", ".svg", ".avif", ".ico"}:
                assert original == built, f"Style or visual asset changed: {rel}"
        counts[package] = (files, same)

    # 3. Verifikasi Halaman Resmi Web Publik Helpdesk TIK Kota Depok (14 file)
    official_public_pages = [
        "index.html", "layanan.html", "detail-layanan.html", "lapor.html",
        "tiket.html", "detail-tiket.html", "lacak.html", "panduan.html",
        "halaman.html", "faq.html", "status.html", "kontak.html", "akses.html", "404.html", "offline.html"
    ]
    for page_name in official_public_pages:
        page_file = DIST / page_name
        assert page_file.is_file(), f"Halaman resmi publik tidak ditemukan: {page_name}"
        html = page_file.read_text(encoding="utf8")
        assert html.count('data-helpdesk-public') == 1, page_name
        assert 'data-public-ui-version="1.1"' in html, page_name
        assert html.count('href="/helpdesk/public-ui.css"') == 1, page_name
        assert html.count(shared_header) == 1, f"Non-canonical header: {page_name}"
        assert html.count(shared_footer) == 1, f"Non-canonical footer: {page_name}"
        assert html.count('data-helpdesk-health') == 1, f"Duplicate health widget: {page_name}"

        # Periksa seluruh link dalam halaman resmi
        parsed = Page()
        parsed.feed(html)
        # Gateway rewrites these nested URLs to the same HTML without changing the browser URL.
        nested_routes = {
            "panduan.html": "/panduan/panduan-konfigurasi-email-depok-go-id",
            "detail-layanan.html": "/layanan/akses-internet-opd",
            "detail-tiket.html": "/tiket/contoh-id",
            "lapor.html": "/tiket/baru/akses-internet-opd",
        }
        page_urls = ["/" + page_name]
        if page_name in nested_routes:
            page_urls.append(nested_routes[page_name])
        for page_url in page_urls:
            for value in parsed.links:
                if value.startswith(("#", "mailto:", "tel:", "data:")):
                    continue
                url = urlsplit(urljoin(page_url, value))
                if url.scheme or url.netloc:
                    continue
                target = DIST / url.path.lstrip("/")
                if target.is_dir():
                    target /= "index.html"
                assert target.is_file(), f"{page_url}: missing {value} -> {target}"


    # Verifikasi khusus landing page
    landing_html = (DIST / "index.html").read_text(encoding="utf8")
    for marker in ('id="vy-faq"', 'id="akses"', 'id="vy-gallery-grid"'):
        assert marker in landing_html, marker
    for removed in ('vy-hero-prev', 'vy-hero-next', 'vy-hero-autoplay', 'vy-hero-tally-cur'):
        assert f'id="{removed}"' not in landing_html, f'Removed Hero control returned: {removed}'
    assert "assets/images/" not in landing_html, "Legacy artwork remains on landing"
    assert 'id="pricing"' not in landing_html, "Simulator remains on landing"
    tabs = re.findall(r'<button class="vy-stage__tab"[^>]*>', landing_html)
    assert len(tabs) == 5, "Hero must offer five banners"
    assert sum('aria-selected="true"' in tab for tab in tabs) == 1, "Hero needs one active banner"
    assert sum('tabindex="0"' in tab for tab in tabs) == 1, "Hero needs one keyboard entry"
    assert 'class="vy-stage__bar"' not in landing_html, "Removed progress line returned"
    for tab in tabs:
        image = re.search(r'data-img="([^"]+)"', tab).group(1)
        assert (DIST/image.lstrip("/")).is_file(), image

    # 4. Verifikasi Halaman Resmi Web Admin Helpdesk TIK Kota Depok (9 file)
    official_admin_pages = [
        "admin/index.html", "admin/app/dashboard/index.html",
        "admin/app/tickets/index.html", "admin/app/tickets/detail.html",
        "admin/app/helpdesk/index.html", "admin/auth/login.html",
        "admin/403.html", "admin/404.html", "admin/offline.html"
    ]
    for page_name in official_admin_pages:
        page_file = DIST / page_name
        assert page_file.is_file(), f"Halaman resmi admin tidak ditemukan: {page_name}"

    for file, kind in [('akses.html', 'login'), ('layanan.html', 'catalog'), ('detail-layanan.html', 'detail')]:
        html = (DIST/file).read_text(encoding='utf-8')
        assert html.count('data-helpdesk-public') == 1 and 'data-public-ui-version="1.1"' in html, file
        assert html.count(shared_header) == 1 and html.count(shared_footer) == 1, file
        assert f'data-hd-page="{kind}"' in html and '/helpdesk/m0-03.js' in html, file
        assert '/helpdesk/public-ui.css' in html and html.count('data-helpdesk-health') == 1, file
    master = (DIST/'admin/app/helpdesk/index.html').read_text(encoding='utf-8')
    brand = '/assets/helpdesk/05_Brand'
    for file in ['admin/index.html', 'admin/auth/login.html', 'admin/app/helpdesk/index.html',
                 'admin/app/tickets/index.html', 'admin/app/tickets/detail.html']:
        html = (DIST/file).read_text(encoding='utf-8')
        assert f'src="{brand}/logo-pastel-mark.png" alt="" width="32" height="32"' in html, file
        assert '<span class="piui-brand__name">Helpdesk TIK Kota Depok</span>' in html, file
        assert re.findall(r'<link rel="icon"[^>]*>', html) == [
            f'<link rel="icon" type="image/png" href="{brand}/logo-favicon.png">'
        ], file
    for logo in ['logo-pastel-mark.png', 'logo-favicon.png']:
        assert (DIST/brand.lstrip('/')/logo).read_bytes() == (ROOT/'assets/05_Brand'/logo).read_bytes(), logo
    queue_href = 'href="/admin/app/tickets/index.html"'
    queue_menu = rf'<a {queue_href} class="piui-nav-link"([^>]*)>([\s\S]*?)</a>'
    for file in ['admin/index.html', 'admin/app/helpdesk/index.html',
                 'admin/app/tickets/index.html', 'admin/app/tickets/detail.html']:
        html = (DIST/file).read_text(encoding='utf-8')
        menu_links = re.findall(queue_menu, html)
        assert len(menu_links) == 2, f"{file}: desktop and mobile queue menus required"
        for attrs, label in menu_links:
            assert 'Antrean tiket' in label and 'data-admin-nav-id="tickets"' in attrs, file
            assert ('aria-current="page"' in attrs) == file.endswith('/tickets/index.html'), file
            assert ('aria-current="location"' in attrs) == file.endswith('/tickets/detail.html'), file
    assert 'data-admin-navigation' in master and 'id="hd-master-kind"' in master
    palette = (DIST/'admin/assets/js/components/cmd-palette.js').read_text(encoding='utf-8')
    assert '"title":"Antrean tiket"' in palette and '"href":"/admin/app/tickets/index.html"' in palette
    assert 'data-admin-nav-id' in palette and 'commandItems()' in palette
    for file, kind in [('lapor.html', 'create'), ('tiket.html', 'list'), ('lacak.html', 'track'), ('detail-tiket.html', 'ticket')]:
        html = (DIST/file).read_text(encoding='utf-8')
        assert html.count('data-helpdesk-public') == 1 and 'data-public-ui-version="1.1"' in html, file
        assert html.count(shared_header) == 1 and html.count(shared_footer) == 1, file
        assert f'data-ticket-page="{kind}"' in html and '/helpdesk/m0-04.js' in html, file
        assert '/helpdesk/public-ui.css' in html, file
    for file in ['admin/app/tickets/index.html', 'admin/app/tickets/detail.html']:
        html = (DIST/file).read_text(encoding='utf-8')
        assert 'piui-app-shell' in html and 'data-ticket-page=' in html, file
        assert '/helpdesk/m0-04.js' in html, file
    ticket_script = (DIST/'helpdesk/m0-04.js').read_text(encoding='utf-8')
    assert 'localStorage' not in ticket_script and 'sessionStorage' not in ticket_script
    # M0-08 AC20 Keyboard Accessible Media Picker and Focus Trap verification
    lapor_html = (DIST / 'lapor.html').read_text(encoding='utf-8')
    assert 'role="dialog"' in lapor_html and 'aria-modal="true"' in lapor_html and 'data-media-modal' in lapor_html
    assert 'data-open-media-picker' in lapor_html and 'data-close-media-modal' in lapor_html
    assert re.search(r'<dialog\b[^>]*data-media-modal', lapor_html), 'Use the native modal focus and Escape behavior'
    assert 'showModal' in ticket_script and 'data-media-next' in lapor_html and 'data-media-search' in lapor_html
    tracking = (DIST/'lacak.html').read_text(encoding='utf-8')
    form = re.search(r'<form\b[^>]*\bdata-ticket-track\b[^>]*>[\s\S]*?</form>', tracking).group()
    assert re.search(r'<form\b[^>]*\bmethod="post"[^>]*\bhidden\b', form), 'Tracking form must be inert before JS binds'
    key = re.search(r'<input\b[^>]*\bid="ticket-capability"[^>]*>', form).group()
    assert 'name=' not in key and 'type="password"' in key, 'Native form must never serialize the guest secret'
    assert 'piui-app-shell' in master and 'data-hd-master-form' in master and 'data-hd-form-editor' in master
    login = (DIST/'admin/auth/login.html').read_text(encoding='utf-8')
    assert 'data-hd-login' in login and 'data-demo-login' not in login
    assert re.search(r'<button\b[^>]*data-close-dialog[^>]*aria-label="Tutup formulir masuk"', login), 'Admin login keeps the native PIUI close action'

    assert 'TLS 1.3 + mTLS' not in login and 'NIST AAL3' not in login
    assert 'Sesi dikunci otomatis setelah 15 menit' not in login
    assert "form.hasAttribute('data-hd-login')" in (DIST/'admin/assets/js/components/forms.js').read_text(encoding='utf-8')
    assert "feature.id==='notification-launchers'" in (DIST/'admin/assets/js/components/feature-registry.js').read_text(encoding='utf-8')
    dashboard = (DIST/'admin/app/dashboard/index.html').read_text(encoding='utf-8')
    dashboard_markup = re.sub(r'<!--[\s\S]*?-->', '', dashboard)
    assert re.search(r'<main\b[^>]*data-hd-page="dashboard"', dashboard_markup), 'Dashboard must render outside template comments'
    assert 'data-hd-dashboard-metrics' in dashboard_markup and 'data-hd-dashboard-results' in dashboard_markup
    assert (DIST/"admin/index.html").read_bytes() == (DIST/"admin/app/dashboard/index.html").read_bytes()
    for folder in ("02_Hero_Tanpa_Teks", "03_Ilustrasi_Pendukung", "05_Brand"):
        for original in (ROOT/"assets"/folder).glob("*.png"):
            assert original.read_bytes() == (DIST/"assets/helpdesk"/folder/original.name).read_bytes(), original
    print(f"PASS PIUI (runtime files, HTML pages, byte-identical files) {counts}")


if __name__ == "__main__":
    verify()
