"""
scripts/analyze_vayra.py - Full Architectural Analyzer for https://vayra-preview.pages.dev/
Scrapes pages, CSS, assets, structure, layout, typography, components, and design tokens.
"""

import urllib.request
import re
import json
from pathlib import Path
from urllib.parse import urljoin

BASE_URL = "https://vayra-preview.pages.dev/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def main():
    print(f"[*] Fetching root: {BASE_URL}")
    root_html = fetch_url(BASE_URL)
    
    # Save root HTML for detailed inspection
    out_dir = Path("scripts/vayra_dump")
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(root_html, encoding='utf-8')
    print(f"[+] Saved index.html ({len(root_html)} bytes)")

    # Extract all HTML pages linked
    pages = set(re.findall(r'href=["\']([^"\'#:]+\.html)["\']', root_html))
    print(f"[+] Found pages linked: {pages}")

    for p in pages:
        p_url = urljoin(BASE_URL, p)
        try:
            p_html = fetch_url(p_url)
            (out_dir / p).write_text(p_html, encoding='utf-8')
            print(f"[+] Saved {p} ({len(p_html)} bytes)")
            
            # Look for sub-links inside each page (e.g. detail pages)
            sub_pages = set(re.findall(r'href=["\']([^"\'#:]+\.html)["\']', p_html))
            for sp in sub_pages:
                if sp not in pages and not (out_dir / sp).exists():
                    sp_url = urljoin(BASE_URL, sp)
                    try:
                        sp_html = fetch_url(sp_url)
                        (out_dir / sp).write_text(sp_html, encoding='utf-8')
                        print(f"  [+] Saved sub-page {sp} ({len(sp_html)} bytes)")
                    except Exception as err:
                        print(f"  [-] Failed {sp}: {err}")
        except Exception as err:
            print(f"[-] Failed {p}: {err}")

    # Extract CSS files
    css_files = set(re.findall(r'<link[^>]+href=["\']([^"\']+\.css)["\']', root_html))
    print(f"[+] Found CSS files: {css_files}")
    for c in css_files:
        c_url = urljoin(BASE_URL, c)
        try:
            c_css = fetch_url(c_url)
            c_name = Path(c).name
            (out_dir / c_name).write_text(c_css, encoding='utf-8')
            print(f"[+] Saved CSS {c_name} ({len(c_css)} bytes)")
        except Exception as err:
            print(f"[-] Failed CSS {c}: {err}")

    # Extract JS files
    js_files = set(re.findall(r'<script[^>]+src=["\']([^"\']+\.js)["\']', root_html))
    print(f"[+] Found JS files: {js_files}")
    for j in js_files:
        j_url = urljoin(BASE_URL, j)
        try:
            j_js = fetch_url(j_url)
            j_name = Path(j).name
            (out_dir / j_name).write_text(j_js, encoding='utf-8')
            print(f"[+] Saved JS {j_name} ({len(j_js)} bytes)")
        except Exception as err:
            print(f"[-] Failed JS {j}: {err}")

if __name__ == '__main__':
    main()
