#!/usr/bin/env python3
"""
Update docs/05_ATURAN_UI_UX_WEB_PUBLIK.md with Web Admin Spacing & Anti-Collision Standards
"""

import sys

def update_docs():
    path = "docs/05_ATURAN_UI_UX_WEB_PUBLIK.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "## Responsif dan aksesibilitas"
    if "5. **Standar Spacing, Margin, Padding & Anti-Tumpang-Tindih Web Admin" in content:
        print("[SKIP] Admin spacing standard already exists in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md")
        return

    admin_section = """5. **Standar Spacing, Margin, Padding & Anti-Tumpang-Tindih Web Admin (PIUI Zero & Helpdesk Master)**:
   - **Kartu Sesi Lab & Quick Login Header (`.hd-session`)**:
     - Padding kartu simetris `20px 24px`, margin pemisah `margin-block: 16px 24px`, border-radius `10px`.
     - Tata letak dua sisi terorganisasi (`.hd-session-inner`): Info identitas (`.hd-session-identity`) dan formulir login peran cepat (`.hd-admin-quick-form`).
     - Grup dropdown peran (`.hd-quick-select-group`): Label dan dropdown `<select>` dikelompokkan dengan `gap: 10px`, lebar select adaptif proporsional (`min-width: 240px; max-width: 360px;`), dilarang melar ke 100% pada quick login agar tidak memotong baris tombol.
     - Grup tombol aksi peran (`.hd-quick-btn-group`): Tombol `[Aktifkan Sesi]`, `[Antrean Tiket Petugas]`, dan `[Keluar]` dibungkus dalam container terpisah dengan `display: inline-flex; gap: 10px; flex-wrap: wrap;` sehingga tidak ada border yang berhimpitan/menempel (`touching borders`).
   - **Standardisasi Kartu Admin (`.piui-card`)**: Padding simetris `24px 28px`, margin antar-kartu `margin-bottom: 24px`, radius sudut `10px`, elevasi bayangan halus.
   - **Toolbar & Tombol Aksi Admin (`.hd-actions`, `.piui-btn`)**:
     - Jarak pemisah antar-tombol aksi wajib `gap: 12px`, dilarang keras menempel (`gap: 0`).
     - Dimensi tombol admin standar: `min-height: 38px`, padding `8px 16px`, radius `6px`. Untuk varian kecil (`.piui-btn--sm`): `min-height: 34px`, padding `6px 12px`.
   - **Tab Navigasi Sub-Modul Admin (`[data-hd-m9-tabs]`, `[data-hd-m11-tabs]`, `[data-hd-media-tabs]`)**:
     - Wadah tab menggunakan `display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;` dengan border pemisah bawah `1px solid var(--piui-border-subtle)`.
   - **Grid & Field Formulir Admin (`.hd-form-grid`, `.piui-field`)**:
     - Grid formulir responsif: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` dengan `gap: 18px 24px` dan `margin-bottom: 22px`.
     - Jarak margin vertikal antar-field: `margin-bottom: 16px`, jarak label ke input `8 px`. Kontrol input/select/textarea admin: `min-height: 40px`, padding `8px 12px`.
   - **Tabel Data Master & Tombol Aksi Baris (`.hd-table-wrap`, `.piui-table`)**:
     - Padding sel tabel: `padding: 12px 16px`.
     - Tombol aksi pada kolom Tindakan (`.hd-row-actions`): dibungkus dalam container `display: flex; gap: 8px; flex-wrap: wrap; align-items: center;` sehingga tombol aksi tidak berhimpitan.
     - Paginasi tabel (`nav[aria-label="Halaman master"]`): `display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px;`.
   - **Pesan Status & Notifikasi Admin (`p[data-hd-status]`, `p[data-hd-login-status]`)**:
     - Tidak boleh menempel langsung ke kartu atas/bawah. Diberikan `margin: 14px 0 20px 0`, padding `10px 16px`, border-left `4px solid #3b82f6`, dan latar `var(--piui-bg-elevated)`.

"""

    if marker in content:
        content = content.replace(marker, admin_section + marker)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Successfully updated docs/05_ATURAN_UI_UX_WEB_PUBLIK.md with admin spacing standards.")
    else:
        print("[ERROR] Marker not found in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md!")
        sys.exit(1)

if __name__ == "__main__":
    update_docs()
