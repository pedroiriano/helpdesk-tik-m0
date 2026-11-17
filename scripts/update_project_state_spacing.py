#!/usr/bin/env python3
"""
Update status/PROJECT_STATE.md with Admin Spacing Verification Entry
"""

import sys

def update_project_state():
    path = "status/PROJECT_STATE.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "| Spacing-01 |"
    entry = "| Admin-Spacing-01 | DONE_VERIFIED. Penataan Proporsional Margin, Padding, Gap & Anti-Tumpang-Tindih Komponen Web Admin (PIUI Zero & Helpdesk Master): Penataan struktur kartu sesi lab (.hd-session-inner) menjadi identitas petugas dan form aktivasi peran cepat (.hd-admin-quick-form); pembebasan select dropdown peran dari aturan force-100% width sehingga lebar proporsional 240px–360px; pembungkusan tombol aksi peran (.hd-quick-btn-group: [Aktifkan Sesi], [Antrean Tiket Petugas], [Keluar]) dengan flex gap: 10px teratur (zero touching borders); standardisasi padding kartu admin (.piui-card) 24px 28px dan margin-bottom 24px; toolbar aksi (.hd-actions) gap 12px; tombol (.piui-btn) min-height 38px dan padding 8px 16px; tab navigasi modul M9/M11/Media gap 10px; grid form gap 18–24px dan field margin 16px; tabel data padding 12px 16px; status box dengan background elevasi bernapas; dan dokumentasi kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md diperbarui. Seluruh pengujian scripts/test_admin_spacing.py dan 6 uji regresi 100% PASS. |\n"

    if "| Admin-Spacing-01 |" in content:
        print("[SKIP] Admin-Spacing-01 already in status/PROJECT_STATE.md")
        return

    # Cari akhir baris yang memuat Spacing-01
    idx = content.find(marker)
    if idx == -1:
        print("[ERROR] Marker | Spacing-01 | not found in status/PROJECT_STATE.md")
        sys.exit(1)

    newline_idx = content.find("\n", idx)
    if newline_idx == -1:
        newline_idx = len(content)

    updated = content[:newline_idx + 1] + entry + content[newline_idx + 1:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)

    print("[SUCCESS] Successfully added Admin-Spacing-01 to status/PROJECT_STATE.md")

if __name__ == "__main__":
    update_project_state()
