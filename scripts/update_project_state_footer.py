#!/usr/bin/env python3
"""
Update status/PROJECT_STATE.md with Admin Footer Branding Entry
"""

import sys

def update_project_state():
    path = "status/PROJECT_STATE.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "| Admin-Spacing-01 |"
    entry = "| Admin-Footer-01 | DONE_VERIFIED. Penyempurnaan Total Branding Footer Web Admin Helpdesk TIK Kota Depok: Mengeliminasi total credit bawaan non-kedinasan (Pedro Iriano & PIUI Zero v2.2.2) pada seluruh halaman Web Admin; menerapkan signature resmi Lambang Resmi Kota Depok (logo-pastel-mark.png, 24x24 px), nama portal Helpdesk TIK Kota Depok, dan identitas instansi Diskominfo Kota Depok & Pemerintah Kota Depok (c) 2026; menyediakan tombol cepat Portal Publik (.hd-admin-footer-btn); menstandarisasi tautan operasional kedinasan (Pusat Komando, Antrean Tiket Petugas, Jejak Audit, Status SPBE, Basis Pengetahuan); menata CSS spacing footer proporsional anti-tumpang-tindih; dan memperbarui dokumen kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md. Seluruh pengujian scripts/test_admin_footer_branding.py dan uji regresi 100% PASS. |\n"

    if "| Admin-Footer-01 |" in content:
        print("[SKIP] Admin-Footer-01 already in status/PROJECT_STATE.md")
        return

    idx = content.find(marker)
    if idx == -1:
        print("[ERROR] Marker | Admin-Spacing-01 | not found in status/PROJECT_STATE.md")
        sys.exit(1)

    newline_idx = content.find("\n", idx)
    if newline_idx == -1:
        newline_idx = len(content)

    updated = content[:newline_idx + 1] + entry + content[newline_idx + 1:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)

    print("[SUCCESS] Successfully added Admin-Footer-01 to status/PROJECT_STATE.md")

if __name__ == "__main__":
    update_project_state()
