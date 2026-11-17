#!/usr/bin/env python3
"""
Patch Spacing, Margin, Padding, & Anti-Collision Web Admin (PIUI Zero & Helpdesk Master)
Memperbaiki tata letak kartu sesi lab, grup tombol anti-menempel, standardisasi padding kartu,
margin field, gap toolbar, dan status display.
"""

import os
import sys

def patch_business_pages():
    path = "frontend/business-pages.mjs"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Target: baris 307 kartu sesi lab
    old_session = '''<div class="piui-card hd-session"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;"><div><p data-hd-session role="status" style="margin:0 0 4px 0;font-weight:700;">Memeriksa sesi…</p><span style="font-size:12px;color:#555;">Lingkungan lab sintetis Helpdesk TIK Kota Depok.</span></div><form data-hd-login data-hd-quick-login style="display:flex;align-items:center;gap:8px;margin:0;flex-wrap:wrap;"><label for="hd-quick-subject" style="font-size:12px;font-weight:600;white-space:nowrap;">Pilih Peran Petugas:</label><select class="piui-input" id="hd-quick-subject" name="subject" style="font-size:12px;padding:4px 8px;min-width:240px;" disabled><option value="">Memuat akun lab…</option></select><button class="piui-btn piui-btn--primary piui-btn--sm" type="submit" disabled>Aktifkan Sesi</button><a class="piui-btn piui-btn--secondary piui-btn--sm" href="/admin/app/tickets/index.html">Antrean Tiket Petugas</a><button class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-logout hidden type="button">Keluar</button></form></div><p data-hd-login-status role="status" tabindex="-1" style="font-size:12px;margin:6px 0 0 0;"></p></div>'''

    new_session = '''<div class="piui-card hd-session"><div class="hd-session-inner"><div class="hd-session-identity"><p data-hd-session role="status" class="hd-session-name">Memeriksa sesi…</p><span class="hd-session-desc">Lingkungan lab sintetis Helpdesk TIK Kota Depok.</span></div><form data-hd-login data-hd-quick-login class="hd-admin-quick-form"><div class="hd-quick-select-group"><label for="hd-quick-subject">Pilih Peran Petugas:</label><select class="piui-input" id="hd-quick-subject" name="subject" disabled><option value="">Memuat akun lab…</option></select></div><div class="hd-quick-btn-group"><button class="piui-btn piui-btn--primary piui-btn--sm" type="submit" disabled>Aktifkan Sesi</button><a class="piui-btn piui-btn--secondary piui-btn--sm" href="/admin/app/tickets/index.html">Antrean Tiket Petugas</a><button class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-logout hidden type="button">Keluar</button></div></form></div><p data-hd-login-status role="status" tabindex="-1"></p></div>'''

    if old_session in content:
        content = content.replace(old_session, new_session)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Patched frontend/business-pages.mjs successfully.")
    else:
        print("[SKIP/WARN] Old session markup not found in business-pages.mjs, checking if already patched...")
        if 'hd-quick-btn-group' in content:
            print("[INFO] Already contains hd-quick-btn-group.")
        else:
            print("[ERROR] Neither old nor new markup found in business-pages.mjs!")
            sys.exit(1)

def patch_business_css():
    path = "frontend/business.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Perbaiki selector form[data-hd-login] select agar tidak memaksa 100% pada quick-login
    if 'form[data-hd-login] select { min-height:44px; width:100%; }' in content:
        content = content.replace(
            'form[data-hd-login] select { min-height:44px; width:100%; }',
            'form[data-hd-login]:not([data-hd-quick-login]) select { min-height:44px; width:100%; }'
        )
        print("[SUCCESS] Refined form[data-hd-login] select rule in business.css.")

    # Tambahkan blok sistem spacing admin jika belum ada
    marker = "/* SISTEM SPACING, MARGIN, PADDING & ANTI-TUMPANG-TINDIH WEB ADMIN (PIUI ZERO) */"
    if marker in content:
        print("[SKIP] Admin spacing block already present in business.css.")
    else:
        admin_css = """

/* =========================================================================
   SISTEM SPACING, MARGIN, PADDING & ANTI-TUMPANG-TINDIH WEB ADMIN (PIUI ZERO)
   ========================================================================= */

/* Kartu Sesi Lab Admin & Quick Login Header */
.piui-card.hd-session,
[data-hd-page="admin"] .piui-card.hd-session {
  padding: 20px 24px !important;
  margin-block: 16px 24px !important;
  border-radius: 10px !important;
  background: var(--piui-bg-surface, #18181b) !important;
  border: 1px solid var(--piui-border-default, #27272a) !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25) !important;
}

.hd-session-inner {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 16px 24px !important;
}

.hd-session-identity {
  min-width: 200px;
  flex: 1 1 240px;
}

.hd-session-name {
  margin: 0 0 4px 0 !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  color: var(--piui-text-primary, #fafafa) !important;
  line-height: 1.35 !important;
}

.hd-session-desc {
  font-size: 12px !important;
  color: var(--piui-text-secondary, #a1a1aa) !important;
  line-height: 1.4 !important;
}

.hd-admin-quick-form {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 12px 16px !important;
  margin: 0 !important;
}

.hd-quick-select-group {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
}

.hd-quick-select-group label {
  font-size: 13px !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
  color: var(--piui-text-primary, #e4e4e7) !important;
  margin: 0 !important;
}

.hd-quick-select-group select,
.hd-quick-select-group select.piui-input {
  font-size: 13px !important;
  padding: 6px 12px !important;
  min-height: 38px !important;
  height: 38px !important;
  min-width: 240px !important;
  max-width: 360px !important;
  width: auto !important;
  border-radius: 6px !important;
  background-color: var(--piui-bg-elevated, #27272a) !important;
  border: 1px solid var(--piui-border-strong, #3f3f46) !important;
  color: var(--piui-text-primary, #fafafa) !important;
}

.hd-quick-btn-group {
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
}

/* Status Pesan Admin */
p[data-hd-status]:not(:empty),
p[data-hd-login-status]:not(:empty) {
  margin-top: 14px !important;
  margin-bottom: 20px !important;
  padding: 10px 16px !important;
  border-radius: 6px !important;
  background: var(--piui-bg-elevated, #27272a) !important;
  border-left: 4px solid #3b82f6 !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
  color: var(--piui-text-primary, #f4f4f5) !important;
}

/* Standardisasi Kartu Konten Admin */
.piui-main .piui-card,
[data-hd-page="admin"] .piui-card {
  padding: 24px 28px !important;
  margin-bottom: 24px !important;
  border-radius: 10px !important;
  background: var(--piui-bg-surface, #18181b) !important;
  border: 1px solid var(--piui-border-default, #27272a) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}

/* Standar Spacing Toolbar & Aksi Tombol Admin */
.piui-main .hd-actions,
.piui-card .hd-actions,
[data-hd-page="admin"] .hd-actions {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 12px !important;
  margin-block: 16px 20px !important;
}

/* Tombol Admin: Anti-Menempel & Proporsional */
.piui-main .piui-btn,
[data-hd-page="admin"] .piui-btn {
  margin: 0 !important;
  min-height: 38px !important;
  padding: 8px 16px !important;
  border-radius: 6px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  line-height: 1.25 !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
}

.piui-main .piui-btn--sm,
[data-hd-page="admin"] .piui-btn--sm {
  min-height: 34px !important;
  padding: 6px 12px !important;
  font-size: 12px !important;
}

/* Tab Navigasi Sub-Modul M9, M11, dan Media */
[data-hd-m9-tabs],
[data-hd-m11-tabs],
[data-hd-media-tabs] {
  display: flex !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
  margin-bottom: 20px !important;
  padding-bottom: 8px !important;
  border-bottom: 1px solid var(--piui-border-subtle, #27272a) !important;
}

/* Grid Formulir & Field Admin */
.piui-main .hd-form-grid,
[data-hd-page="admin"] .hd-form-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
  gap: 18px 24px !important;
  margin-bottom: 22px !important;
}

.piui-main .piui-field,
[data-hd-page="admin"] .piui-field {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  margin-bottom: 16px !important;
  min-width: 0 !important;
}

.piui-main .piui-field label,
[data-hd-page="admin"] .piui-field label {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--piui-text-secondary, #d4d4d8) !important;
}

.piui-main .piui-field small,
[data-hd-page="admin"] .piui-field small {
  font-size: 12px !important;
  color: var(--piui-text-muted, #71717a) !important;
  line-height: 1.4 !important;
}

.piui-main .piui-input,
[data-hd-page="admin"] .piui-input {
  min-height: 40px !important;
  padding: 8px 12px !important;
  font-size: 13px !important;
  border-radius: 6px !important;
  border: 1px solid var(--piui-border-strong, #3f3f46) !important;
  background-color: var(--piui-bg-elevated, #27272a) !important;
  color: var(--piui-text-primary, #fafafa) !important;
  box-sizing: border-box !important;
}

/* Tabel Admin & Tombol Aksi Baris */
.piui-main .hd-table-wrap,
[data-hd-page="admin"] .hd-table-wrap {
  overflow-x: auto !important;
  margin-block: 18px 22px !important;
  border-radius: 8px !important;
  border: 1px solid var(--piui-border-subtle, #27272a) !important;
}

.piui-main .piui-table th,
.piui-main .piui-table td,
[data-hd-page="admin"] .piui-table th,
[data-hd-page="admin"] .piui-table td {
  padding: 12px 16px !important;
  vertical-align: middle !important;
}

.piui-main .piui-table td .hd-row-actions,
[data-hd-page="admin"] .piui-table td .hd-row-actions {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
}

/* Paginasi Admin */
nav[aria-label="Halaman master"],
nav.hd-pager-nav {
  display: flex !important;
  gap: 10px !important;
  align-items: center !important;
  justify-content: flex-end !important;
  margin-top: 18px !important;
}

/* Role Hub di Antrean Tiket Petugas */
[data-ticket-page] .piui-card {
  padding: 24px 28px !important;
  margin-bottom: 24px !important;
  border-radius: 10px !important;
}

[data-ticket-page] .hd-actions {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  flex-wrap: wrap !important;
  margin-block: 16px 20px !important;
}
"""
        content += admin_css
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Appended Admin Spacing System to frontend/business.css.")

def patch_build_templates():
    path = "frontend/build-templates.mjs"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Perbaiki gap tombol roleHub: gap:8px -> gap:10px
    target = 'display:flex;gap:8px;flex-wrap:wrap;'
    replacement = 'display:flex;gap:10px;flex-wrap:wrap;'
    if target in content:
        content = content.replace(target, replacement)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Patched roleHub gap in frontend/build-templates.mjs.")
    else:
        print("[INFO] roleHub target already modified or not found in build-templates.mjs.")

if __name__ == "__main__":
    patch_business_pages()
    patch_business_css()
    patch_build_templates()
    print("[ALL DONE] Patching admin spacing completed.")
