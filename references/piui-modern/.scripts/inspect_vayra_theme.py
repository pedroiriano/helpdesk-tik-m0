"""
scripts/inspect_vayra_theme.py
Extracts the exact design tokens, typography, colors, borders, and animations of Vayra.
"""

from pathlib import Path
import re

css_files = ["_tokens-bridge.css", "parts.css", "sections.css", "scope-context.css"]
full_css = ""
for c in css_files:
    p = Path("scripts/vayra_dump") / c
    if p.exists():
        full_css += "\n" + p.read_text(encoding='utf-8')

# Extract all CSS variables
vars_dict = {}
for m in re.finditer(r'(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);', full_css):
    vars_dict[m.group(1)] = m.group(2).strip()

print(f"Total CSS variables found: {len(vars_dict)}")
for k, v in sorted(vars_dict.items()):
    if any(term in k for term in ['bg', 'color', 'text', 'line', 'accent', 'font', 'radius', 'pad', 'space']):
        print(f"  {k}: {v}")

# Check layout grid and breakpoints
print("\n--- Media queries in Vayra CSS ---")
mqs = set(re.findall(r'@media\s*([^{]+)\{', full_css))
for mq in sorted(mqs):
    print(f"  @media {mq.strip()}")
