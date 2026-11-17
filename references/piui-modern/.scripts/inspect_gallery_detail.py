"""
scripts/inspect_gallery_detail.py
Examines how gallery.html and its detail view / selected render are structured.
"""

from pathlib import Path
import re

html = Path("scripts/vayra_dump/gallery.html").read_text(encoding='utf-8')

# Search for selected render or detail view
out_log = re.search(r'(<section[^>]*id=["\']output-log["\'][^>]*>.*?</section>)', html, re.S)
if out_log:
    print("Found #output-log section!")
    content = out_log.group(1)
    print(f"Length of #output-log: {len(content)} characters")
    
    # Check inner components
    divs = re.findall(r'<div[^>]*class=["\']([^"\']+)["\']', content)
    print(f"Classes in #output-log: {set(divs[:25])}")
    
    # Check for metadata tags (seed, model, prompt, etc.)
    metadata_fields = re.findall(r'(?:Prompt|Seed|Model|Sampler|Steps|Dimensions|Preset|License|Receipt)[^<]*', content, re.I)
    print(f"Metadata labels: {set(metadata_fields[:15])}")
    
    # Check first 1500 chars of output-log
    print("\n--- Snippet of #output-log ---")
    print(content[:1800])
else:
    print("No #output-log section found")
