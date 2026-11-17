#!/usr/bin/env python3
"""
Patch Sistem Modal / Dialog Kanonis & Tata Letak Mobile First
Menyempurnakan:
1. Sistem Modal / Dialog Terpusat (Centered Modal System) pada Web Publik & Web Admin
2. Standarisasi Margin, Padding, Backdrop Blur, Tombol Tutup, dan Aksi Modal
3. Responsif Mobile First pada Seluruh Halaman Aktif Web Publik & Web Admin
4. Dokumentasi Kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md
"""

import sys
import re

def patch_public_css():
    path = "frontend/public-ui.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "/* MODAL & DIALOG CANONICAL SYSTEM (WEB PUBLIK) */"
    if marker in content:
        print("[SKIP] Modal rules already present in frontend/public-ui.css")
    else:
        modal_css = """

/* =========================================================================
   MODAL & DIALOG CANONICAL SYSTEM (WEB PUBLIK)
   ========================================================================= */

/* Backdrop Overlay Kanonis */
.hd-modal-backdrop,
dialog::backdrop {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(10, 12, 16, 0.75) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  z-index: 9998 !important;
}

/* Modal Card / Dialog Terpusat */
.hd-modal-card,
dialog.piui-dialog,
dialog[data-reject-dialog],
dialog[data-confirm-reject-dialog],
dialog[data-archive-dialog],
dialog[data-restore-dialog] {
  position: fixed !important;
  inset: 0 !important;
  margin: auto !important;
  width: min(560px, calc(100% - 32px)) !important;
  max-width: 560px !important;
  max-height: min(88vh, calc(100dvh - 48px)) !important;
  box-sizing: border-box !important;
  padding: 24px 28px !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  background: #16181d !important;
  color: #f0f6fc !important;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6) !important;
  overflow-y: auto !important;
  z-index: 9999 !important;
}

/* Header Modal */
.hd-modal-header,
.piui-dialog__header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding-bottom: 14px !important;
  margin-bottom: 16px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
}

.hd-modal-header h2,
.hd-modal-header h3,
.piui-dialog__header h3,
.piui-dialog__header strong {
  margin: 0 !important;
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  line-height: 1.35 !important;
}

.hd-modal-close,
.piui-icon-btn,
button[data-close-media-modal],
button[data-close-reject-dialog],
button[data-close-confirm-reject-dialog],
button[data-close-archive-dialog],
button[data-close-restore-dialog] {
  min-width: 36px !important;
  min-height: 36px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 6px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  color: #e6edf3 !important;
  font-size: 18px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  padding: 0 !important;
}

.hd-modal-close:hover,
.piui-icon-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
}

/* Modal Body & Field Spacing */
.hd-modal-card .vy-input-group,
dialog .vy-input-group {
  margin-bottom: 16px !important;
}

.hd-modal-card p,
dialog p {
  color: #8b949e !important;
  font-size: 13px !important;
  line-height: 1.55 !important;
  margin: 0 0 14px 0 !important;
}

/* Modal Footer Actions */
.hd-modal-actions,
dialog .hd-actions {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 12px !important;
  margin-top: 20px !important;
  padding-top: 14px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
  flex-wrap: wrap !important;
}

/* =========================================================================
   PENYEMPURNAAN MOBILE FIRST WEB PUBLIK (BREAKPOINT <= 640px)
   ========================================================================= */
@media (max-width: 640px) {
  /* Modal Card di Mobile */
  .hd-modal-card,
  dialog.piui-dialog,
  dialog[data-reject-dialog],
  dialog[data-confirm-reject-dialog],
  dialog[data-archive-dialog],
  dialog[data-restore-dialog] {
    width: calc(100% - 24px) !important;
    padding: 18px 16px !important;
    border-radius: 10px !important;
    max-height: calc(100dvh - 32px) !important;
  }

  .hd-modal-actions,
  dialog .hd-actions {
    flex-direction: column-reverse !important;
    align-items: stretch !important;
    gap: 10px !important;
  }

  .hd-modal-actions button,
  dialog .hd-actions button {
    width: 100% !important;
    justify-content: center !important;
  }

  /* Form Lapor di Mobile */
  .hd-form-stepper {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
    margin-bottom: 20px !important;
  }

  .hd-step {
    padding: 10px 14px !important;
    border-radius: 8px !important;
  }

  .hd-dropzone {
    padding: 24px 16px !important;
    min-height: 140px !important;
  }

  .hd-dropzone-inner {
    gap: 10px !important;
  }

  .hd-service-card {
    padding: 16px 14px !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
  }

  .hd-service-card__change-btn {
    width: 100% !important;
    justify-content: center !important;
  }

  .hd-guest-card {
    padding: 16px 14px !important;
    gap: 12px !important;
  }

  .hd-guest-key-box {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
  }

  .hd-guest-key-box input {
    width: 100% !important;
  }

  /* Progress Card & Timeline di Mobile */
  .hd-progress-card {
    padding: 18px 16px !important;
    margin-bottom: 20px !important;
  }

  .hd-progress-header {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 10px !important;
  }

  .hd-timeline-feed {
    padding-left: 16px !important;
  }

  .hd-timeline-card {
    padding: 14px 14px !important;
  }

  /* Footer Web Publik di Mobile */
  [data-helpdesk-public] .vy-footer {
    padding: 40px 16px 28px !important;
  }

  [data-helpdesk-public] .vy-tail-mid {
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }
}
"""
        content += modal_css
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Appended modal and mobile rules to frontend/public-ui.css")

def patch_business_css():
    path = "frontend/business.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "/* MODAL & DIALOG CANONICAL SYSTEM (WEB ADMIN) */"
    if marker in content:
        print("[SKIP] Modal rules already present in frontend/business.css")
    else:
        admin_modal_css = """

/* =========================================================================
   MODAL & DIALOG CANONICAL SYSTEM (WEB ADMIN)
   ========================================================================= */

/* Backdrop Overlay Kanonis Admin */
dialog::backdrop {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(9, 10, 13, 0.78) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  z-index: 9998 !important;
}

/* Modal Terpusat Admin (Ekspor, Detail Media, Dialog Konfirmasi) */
dialog.piui-dialog:not(.piui-drawer-mobile),
dialog[data-hd-export-dialog],
dialog[data-hd-media-detail-dialog],
dialog[data-reject-dialog],
dialog[data-confirm-reject-dialog],
dialog[data-archive-dialog],
dialog[data-restore-dialog],
dialog#dialog-revoke-user,
dialog#dialog-user-form {
  position: fixed !important;
  inset: 0 !important;
  margin: auto !important;
  width: min(560px, calc(100% - 32px)) !important;
  max-width: 560px !important;
  max-height: min(88vh, calc(100dvh - 48px)) !important;
  box-sizing: border-box !important;
  padding: 24px 28px !important;
  border-radius: 12px !important;
  border: 1px solid var(--piui-border-strong, #3f3f46) !important;
  background-color: var(--piui-bg-surface, #18181b) !important;
  background-image: var(--piui-gradient-surface) !important;
  color: var(--piui-text-primary, #fafafa) !important;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6) !important;
  overflow-y: auto !important;
  display: none;
  z-index: 9999 !important;
}

dialog.piui-dialog:not(.piui-drawer-mobile)[open],
dialog[data-hd-export-dialog][open],
dialog[data-hd-media-detail-dialog][open],
dialog[data-reject-dialog][open],
dialog[data-confirm-reject-dialog][open],
dialog[data-archive-dialog][open],
dialog[data-restore-dialog][open],
dialog#dialog-revoke-user[open],
dialog#dialog-user-form[open] {
  display: flex !important;
  flex-direction: column !important;
  animation: piui-dialog-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

@keyframes piui-dialog-pop {
  0% { transform: scale(0.96); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* Header Modal Admin */
dialog .piui-dialog__header {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding-bottom: 14px !important;
  margin-bottom: 16px !important;
  border-bottom: 1px solid var(--piui-border-subtle, #27272a) !important;
  background: transparent !important;
}

dialog .piui-dialog__header h2,
dialog .piui-dialog__header h3,
dialog .piui-dialog__header strong {
  margin: 0 !important;
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  color: var(--piui-text-primary, #fafafa) !important;
}

dialog .piui-icon-btn,
dialog button[aria-label*="Tutup"],
dialog button[aria-label*="tutup"] {
  min-width: 36px !important;
  min-height: 36px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 6px !important;
  background: var(--piui-bg-elevated, #27272a) !important;
  border: 1px solid var(--piui-border-strong, #3f3f46) !important;
  color: var(--piui-text-primary, #fafafa) !important;
  font-size: 18px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  padding: 0 !important;
}

dialog .piui-icon-btn:hover {
  background: #3f3f46 !important;
  border-color: #52525b !important;
  color: #ffffff !important;
}

/* Form & Body di Dalam Dialog Admin */
dialog form {
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  margin: 0 !important;
}

dialog .piui-field {
  margin-bottom: 12px !important;
}

dialog .hd-actions {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 12px !important;
  margin-top: 20px !important;
  padding-top: 14px !important;
  border-top: 1px solid var(--piui-border-subtle, #27272a) !important;
  flex-wrap: wrap !important;
}

/* =========================================================================
   PENYEMPURNAAN MOBILE FIRST WEB ADMIN (BREAKPOINT <= 640px)
   ========================================================================= */
@media (max-width: 640px) {
  /* Dialog Admin di Mobile */
  dialog.piui-dialog:not(.piui-drawer-mobile),
  dialog[data-hd-export-dialog],
  dialog[data-hd-media-detail-dialog],
  dialog[data-reject-dialog],
  dialog[data-confirm-reject-dialog],
  dialog[data-archive-dialog],
  dialog[data-restore-dialog],
  dialog#dialog-revoke-user,
  dialog#dialog-user-form {
    width: calc(100% - 24px) !important;
    padding: 18px 16px !important;
    border-radius: 10px !important;
    max-height: calc(100dvh - 32px) !important;
  }

  dialog .hd-actions {
    flex-direction: column-reverse !important;
    align-items: stretch !important;
    gap: 10px !important;
  }

  dialog .hd-actions button,
  dialog .hd-actions a {
    width: 100% !important;
    justify-content: center !important;
  }

  /* Kartu Sesi Admin di Mobile */
  .piui-card.hd-session,
  [data-hd-page="admin"] .piui-card.hd-session {
    padding: 16px 14px !important;
    margin-block: 12px 18px !important;
  }

  .hd-session-inner {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 14px !important;
  }

  .hd-admin-quick-form {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
    width: 100% !important;
  }

  .hd-quick-select-group {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 6px !important;
    width: 100% !important;
  }

  .hd-quick-select-group select,
  .hd-quick-select-group select.piui-input {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .hd-quick-btn-group {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    width: 100% !important;
  }

  .hd-quick-btn-group button,
  .hd-quick-btn-group a {
    width: 100% !important;
    justify-content: center !important;
  }

  /* Tabel Admin Swipe Aman di Mobile */
  .hd-table-wrap,
  [data-hd-page="admin"] .hd-table-wrap {
    width: 100% !important;
    max-width: calc(100vw - 32px) !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    display: block !important;
    margin-block: 14px 18px !important;
  }

  /* Grid Form & Field Admin di Mobile */
  .piui-main .hd-form-grid,
  [data-hd-page="admin"] .hd-form-grid {
    grid-template-columns: 1fr !important;
    gap: 14px !important;
  }

  /* Toolbar Aksi & Tab di Mobile */
  .hd-actions,
  [data-hd-page="admin"] .hd-actions {
    gap: 10px !important;
    width: 100% !important;
  }

  [data-hd-m9-tabs],
  [data-hd-m11-tabs],
  [data-hd-media-tabs] {
    gap: 8px !important;
    margin-bottom: 16px !important;
  }

  [data-hd-m9-tabs] button,
  [data-hd-m11-tabs] button,
  [data-hd-media-tabs] button {
    flex: 1 1 calc(50% - 8px) !important;
    font-size: 12px !important;
    padding: 8px 10px !important;
  }

  /* Footer Admin di Mobile */
  .piui-footer {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 16px !important;
    padding: 16px 14px !important;
    text-align: center !important;
  }

  .piui-footer__links {
    justify-content: center !important;
    gap: 10px 14px !important;
  }

  .hd-admin-footer-credit {
    flex-direction: column !important;
    align-items: center !important;
    gap: 12px !important;
    width: 100% !important;
  }

  .hd-admin-footer-btn {
    width: 100% !important;
    max-width: 280px !important;
    justify-content: center !important;
  }

  .piui-product-credit {
    justify-content: center !important;
    text-align: center !important;
  }
}
"""
        content += admin_modal_css
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Appended modal and mobile rules to frontend/business.css")

def patch_docs():
    path = "docs/05_ATURAN_UI_UX_WEB_PUBLIK.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "## Responsif dan aksesibilitas"
    if "Standar Komponen Modal & Dialog Kanonis (Centered Modal Design System)" in content:
        print("[SKIP] Modal documentation already present in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md")
        return

    modal_doc = """## Standar Komponen Modal & Dialog Kanonis (Centered Modal Design System)

1. **Backdrop & Elevasi**: Seluruh modal dan dialog interaktif wajib menggunakan backdrop overlay semi-transparan `background: rgba(10, 12, 16, 0.75)` dengan `backdrop-filter: blur(6px)`.
2. **Posisi & Proporsi Terpusat**:
   - Modal diposisikan terpusat sempurna pada viewport: `position: fixed; inset: 0; margin: auto;`.
   - Dimensi desktop: `width: min(560px, calc(100% - 32px)); max-height: min(88vh, calc(100dvh - 48px));`.
   - Padding internal simetris: `24px 28px` (desktop) dan `18px 16px` (mobile).
   - Sudut tumpul konsisten: `border-radius: 12px` (desktop) dan `10px` (mobile).
3. **Anatomi Struktur Modal**:
   - **Header Modal**: Memuat judul modal tebal (`font-size: 1.15rem; font-weight: 700;`) dan tombol tutup aksesibel (`min-width: 36px; min-height: 36px;`). Pemisah bawah menggunakan `border-bottom: 1px solid var(--piui-border-subtle); padding-bottom: 14px; margin-bottom: 16px;`.
   - **Body Modal**: Field formulir tersusun vertikal dengan jarak `12px–14px`. Teks penjelasan kedinasan menggunakan warna sekunder kontras tinggi `font-size: 13px; line-height: 1.55;`.
   - **Footer Modal (Aksi)**: Tombol aksi dibungkus flex rata kanan dengan `gap: 12px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--piui-border-subtle);`.
4. **Perilaku Responsif Mobile First**:
   - Pada resolusi mobile (viewport <= 640px), modal otomatis menyesuaikan diri: lebar `calc(100% - 24px)`, margin aksi membalik vertikal (`flex-direction: column-reverse; gap: 10px;`) sehingga tombol aksi utama berada di atas tombol batal dengan lebar sentuh 100%.

## Standar Kanonis Mobile First Web Publik & Web Admin

1. **Prinsip Mobile First**: Tata letak dimulai dari ukuran layar mobile (360px–480px) tanpa ada elemen yang memicu horizontal scroll tidak terkendali, lalu berkembang proporsional pada tablet (768px) dan desktop (1024px+).
2. **Spesifikasi Web Publik di Resolusi Mobile**:
   - **Header / Navbar**: Kapsul melayang proporsional `width: min(520px, calc(100% - 32px))`, navigasi drawer penuh dengan tinggi sentuh tombol `min-height: 44px`.
   - **Hero Utama**: Tombol CTA hero menyusun vertikal penuh `width: 100%; gap: 12px;` di mobile, clearance judul dan deskripsi terjaga dengan `margin-top: 22px; margin-bottom: 24px;`.
   - **Alur 3-Langkah & Katalog**: Grid berubah menjadi 1 kolom (`grid-template-columns: 1fr; gap: 16px;`) dengan kartu yang tidak terpotong.
   - **Formulir Laporan & Dropzone**: Stepper menyusun vertikal rapi, area dropzone adaptif `min-height: 140px; padding: 24px 16px;`, kartu kunci tamu responsif.
   - **Detail Tiket & Timeline**: Grid metrik 1 kolom, stepper alur 5-tahap vertikal, feed riwayat dengan jarak nyaman tanpa node saling bertabrakan.
3. **Spesifikasi Web Admin di Resolusi Mobile**:
   - **Kartu Sesi Lab**: Di layar mobile menyusun vertikal penuh (`.hd-session-inner` column), dropdown peran adaptif 100%, grup tombol tersusun rapi tanpa border menempel.
   - **Tabel Data Master & Antrean Tiket**: Kontainer `.hd-table-wrap` wajib `overflow-x: auto; max-width: calc(100vw - 32px); -webkit-overflow-scrolling: touch;` sehingga dapat digeser halus tanpa merusak viewport halaman.
   - **Toolbar & Tab Modul**: Tab modul membungkus rapi 2 kolom atau inline wrap dengan `gap: 8px`.
   - **Footer Admin**: Tautan operasional, status PWA, tombol portal publik, dan signature lambang Kota Depok menyusun vertikal seimbang di tengah.

"""

    if marker in content:
        content = content.replace(marker, modal_doc + marker)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Appended modal and mobile canonical standards to docs/05_ATURAN_UI_UX_WEB_PUBLIK.md")
    else:
        print("[ERROR] Marker not found in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md")

if __name__ == "__main__":
    patch_public_css()
    patch_business_css()
    patch_docs()
    print("[ALL DONE] Mobile & Modal canonical patch completed.")
