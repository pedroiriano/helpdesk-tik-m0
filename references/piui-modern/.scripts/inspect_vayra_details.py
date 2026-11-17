"""
scripts/inspect_vayra_details.py
Analyzes typography, design tokens, layout structure, sections, components,
and interactive elements across all fetched pages of vayra-preview.
"""

from pathlib import Path
import re

dump_dir = Path("scripts/vayra_dump")

def inspect_file(filename):
    p = dump_dir / filename
    if not p.exists():
        return
    text = p.read_text(encoding='utf-8')
    print(f"\n==========================================")
    print(f"FILE: {filename} ({len(text)} bytes)")
    print(f"==========================================")
    
    # Title
    title = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
    if title:
        print(f"Title: {title.group(1).strip()}")
        
    # Meta description
    desc = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', text, re.I)
    if desc:
        print(f"Description: {desc.group(1).strip()}")

    # Headings
    h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', text, re.I | re.S)
    h2s = re.findall(r'<h2[^>]*>(.*?)</h2>', text, re.I | re.S)
    h3s = re.findall(r'<h3[^>]*>(.*?)</h3>', text, re.I | re.S)
    print(f"H1 count: {len(h1s)} -> {[re.sub(r'<[^>]+>', '', h).strip() for h in h1s]}")
    print(f"H2 count: {len(h2s)} -> {[re.sub(r'<[^>]+>', '', h).strip()[:40] for h in h2s[:5]]}")
    print(f"H3 count: {len(h3s)} -> {[re.sub(r'<[^>]+>', '', h).strip()[:40] for h in h3s[:5]]}")

    # Sections / IDs
    sections = re.findall(r'<section[^>]*id=["\']([^"\']+)["\']', text, re.I)
    classes = re.findall(r'<section[^>]*class=["\']([^"\']+)["\']', text, re.I)
    print(f"Section IDs: {sections}")
    print(f"Section Classes: {classes}")

    # Dialog / Modal / Details
    modals = re.findall(r'<(?:dialog|div)[^>]*(?:modal|drawer|detail|lightbox|preview)[^>]*>', text, re.I)
    print(f"Potential Modal / Detail Dialogs: {len(modals)}")
    for m in modals[:3]:
        print(f"  {m}")

    # Images
    imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', text, re.I)
    print(f"Image count: {len(imgs)} -> Sample: {imgs[:5]}")

def inspect_css():
    css_files = ["parts.css", "sections.css", "_tokens-bridge.css", "scope-context.css"]
    print(f"\n==========================================")
    print(f"CSS DESIGN TOKENS & STYLES ANALYSIS")
    print(f"==========================================")
    for c in css_files:
        p = dump_dir / c
        if not p.exists():
            continue
        text = p.read_text(encoding='utf-8')
        print(f"\n--- {c} --- ({len(text)} bytes)")
        
        # Fonts
        font_families = set(re.findall(r'font-family:\s*([^;]+);', text, re.I))
        print(f"Fonts: {font_families}")
        
        # Colors / CSS vars
        vars_found = set(re.findall(r'(--[a-zA-Z0-9-_]+):\s*([^;]+);', text))
        key_vars = [v for v in vars_found if any(k in v[0] for k in ['color', 'bg', 'surface', 'font', 'radius', 'gap', 'space'])]
        print(f"Key Tokens ({len(key_vars)}):")
        for k, val in sorted(key_vars)[:20]:
            print(f"  {k}: {val.strip()}")

def main():
    for f in ["index.html", "gallery.html", "pricing.html", "about.html", "contact.html"]:
        inspect_file(f)
    inspect_css()

if __name__ == '__main__':
    main()
