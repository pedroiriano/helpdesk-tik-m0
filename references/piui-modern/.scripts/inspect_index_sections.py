"""
scripts/inspect_index_sections.py
Extracts every section, heading, button, and visual block of index.html.
"""

from pathlib import Path
import re

html = Path("scripts/vayra_dump/index.html").read_text(encoding='utf-8')

# Find all sections with their IDs, classes, and headlines
sections = re.findall(r'<section([^>]*)>(.*?)</section>', html, re.S)
print(f"Total sections in index.html: {len(sections)}")

for i, (attrs, body) in enumerate(sections):
    sec_id = re.search(r'id=["\']([^"\']+)["\']', attrs)
    sec_cls = re.search(r'class=["\']([^"\']+)["\']', attrs)
    id_str = sec_id.group(1) if sec_id else "no-id"
    cls_str = sec_cls.group(1) if sec_cls else "no-class"
    
    h2 = re.search(r'<h2[^>]*>(.*?)</h2>', body, re.S)
    h3 = re.search(r'<h3[^>]*>(.*?)</h3>', body, re.S)
    h2_text = re.sub(r'<[^>]+>', '', h2.group(1)).strip() if h2 else "-"
    h3_text = re.sub(r'<[^>]+>', '', h3.group(1)).strip() if h3 else "-"
    
    print(f"\n[{i+1}] Section ID: #{id_str} | Class: .{cls_str}")
    print(f"    H2: {h2_text}")
    print(f"    H3: {h3_text}")
    
    # Check buttons or key elements
    buttons = re.findall(r'<(?:button|a)[^>]*class=["\']([^"\']+)["\'][^>]*>(.*?)</(?:button|a)>', body, re.S)
    btn_labels = [re.sub(r'<[^>]+>', '', b[1]).strip() for b in buttons[:4] if re.sub(r'<[^>]+>', '', b[1]).strip()]
    if btn_labels:
        print(f"    Key Buttons/Links: {btn_labels}")
