#!/usr/bin/env python3
"""
Update status/PROJECT_STATE.md with Modal & Mobile First Canonical Standardization Entry
"""

import sys

def update_project_state():
    path = "status/PROJECT_STATE.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "| Admin-Footer-01 |"
    entry = "| Modal-Mobile-01 | DONE_VERIFIED. Penuntasan Komprehensif Sistem Modal/Dialog Kanonis & Standarisasi Tata Letak Mobile First Web Publik dan Web Admin: Penegakan Centered Modal Design System (posisi terpusat inset: 0 margin: auto, backdrop blur 6px, padding simetris 24px 28px desktop dan 18px 16px mobile, border-radius 12px, header terpisah border-bottom, form field spacing rapi 12–14px, tombol aksi rata kanan gap: 12px); standarisasi Mobile First Web Publik (tombol hero CTA column stack gap 12px, stepper vertikal, dropzone adaptif min-height 140px, progress meta grid 1 kolom, timeline feed proporsional, footer 1 kolom); standarisasi Mobile First Web Admin (sesi lab column layout, select width 100%, button group stack tanpa horizontal overflow, form grid 1 kolom, table swipe aman max-width calc(100vw - 32px), tab modul wrap rapi, footer admin vertikal seimbang); dan dokumen kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md diperbarui. Seluruh 4 blok pengujian scripts/test_modal_and_mobile.py (27 rute aktif) dan 8 uji regresi 100% PASS. |\n"

    if "| Modal-Mobile-01 |" in content:
        print("[SKIP] Modal-Mobile-01 already in status/PROJECT_STATE.md")
        return

    idx = content.find(marker)
    if idx == -1:
        print("[ERROR] Marker | Admin-Footer-01 | not found in status/PROJECT_STATE.md")
        sys.exit(1)

    newline_idx = content.find("\n", idx)
    if newline_idx == -1:
        newline_idx = len(content)

    updated = content[:newline_idx + 1] + entry + content[newline_idx + 1:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)

    print("[SUCCESS] Successfully added Modal-Mobile-01 to status/PROJECT_STATE.md")

if __name__ == "__main__":
    update_project_state()
