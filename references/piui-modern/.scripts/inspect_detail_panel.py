"""
scripts/inspect_detail_panel.py
"""
from pathlib import Path
import re

html = Path("scripts/vayra_dump/gallery.html").read_text(encoding='utf-8')
out_log = re.search(r'(<section class="vy-leaf-band vy-leaf-band--halves vy-out".*?</section>)', html, re.S)
if out_log:
    content = out_log.group(1)
    # Find the detail pane
    detail_pane = re.search(r'(<aside[^>]*>.*?</aside>|<div[^>]*class="[^"]*(?:detail|preview|pane|selected|viewer)[^"]*"[^>]*>.*?</div>|<div[^>]*id="[^"]*(?:detail|preview|viewer)[^"]*"[^>]*>.*?</div>)', content, re.S)
    if detail_pane:
        print("Detail pane found:", detail_pane.group(0)[:1500])
    else:
        # Search for "Selected render"
        idx = content.find("Selected render")
        if idx != -1:
            print("Selected render snippet:")
            print(content[idx-100:idx+2000])
