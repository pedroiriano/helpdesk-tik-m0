"""
scripts/inspect_interactions.py
Extracts the interactive behaviors from vayra-shell.js and vayra-console.js.
"""

from pathlib import Path
import re

shell_js = Path("scripts/vayra_dump/vayra-shell.js").read_text(encoding='utf-8', errors='ignore')
console_js = Path("scripts/vayra_dump/vayra-console.js").read_text(encoding='utf-8', errors='ignore')

print(f"vayra-shell.js length: {len(shell_js)} chars")
print(f"vayra-console.js length: {len(console_js)} chars")

# Find key initializations
inits = re.findall(r'function\s+([a-zA-Z0-9_$]+)\s*\(', shell_js)
print(f"Shell functions ({len(inits)}): {inits[:25]}")

# Gallery Viewer logic
print("\n--- Gallery Interaction Search ---")
for line in shell_js.splitlines():
    if any(k in line for k in ['vy-out-image', 'vy-out-prompt', 'vy-out-title', 'vy-reel-cell', 'copyPrompt', 'copy-prompt']):
        print("  ", line.strip()[:120])

# Pricing Sizer logic
print("\n--- Pricing Sizer Search ---")
for line in shell_js.splitlines():
    if any(k in line for k in ['vy-price-sizer', 'slider', 'credits', 'calculate', 'tier', 'plan-recommend']):
        print("  ", line.strip()[:120])
