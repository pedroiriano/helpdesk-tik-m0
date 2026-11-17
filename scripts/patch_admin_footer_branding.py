#!/usr/bin/env python3
"""
Patch Branding & Spacing Footer Web Admin (PIUI Zero & Helpdesk Master)
Mengganti seluruh credit lama (PIUI Zero / Pedro Iriano) di footer Web Admin dengan:
1. Lambang Resmi Kota Depok (/assets/helpdesk/05_Brand/logo-pastel-mark.png)
2. Identitas resmi Helpdesk TIK Kota Depok - Diskominfo Kota Depok - Pemerintah Kota Depok (c) 2026
3. Tautan operasional resmi: Pusat Komando, Antrean Tiket Petugas, Jejak Audit, Status Layanan SPBE, Basis Pengetahuan
4. Tombol cepat akses Portal Publik
"""

import os
import re
import sys

def patch_build_templates():
    path = "frontend/build-templates.mjs"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update adminPage to replace footer links and product credit across all admin pages
    target_marker = "source = source.replaceAll('>Panduan &amp; Dokumentasi<', '>Dasbor Petugas<');"
    if target_marker not in content:
        print("[ERROR] target_marker not found in frontend/build-templates.mjs")
        sys.exit(1)

    footer_replacement = """    source = source.replaceAll('>Panduan &amp; Dokumentasi<', '>Dasbor Petugas<');

    const adminFooterLinks = `<ul class="piui-footer__links">
        <li><a href="/admin/app/dashboard/index.html">Pusat Komando</a></li>
        <li><a href="/admin/app/tickets/index.html">Antrean Tiket Petugas</a></li>
        <li><a href="/admin/app/helpdesk/index.html?kind=audit">Jejak Audit (M9)</a></li>
        <li><a href="/status.html">Status Layanan SPBE</a></li>
        <li><a href="/panduan.html">Basis Pengetahuan SPBE</a></li>
      </ul>`;
    source = source.replace(/<ul class="piui-footer__links">[\\s\\S]*?<\\/ul>/, adminFooterLinks);

    const adminFooterCredit = `<div class="hd-admin-footer-credit">
        <a class="piui-btn piui-btn--secondary piui-btn--sm hd-admin-footer-btn" href="/" target="_blank" rel="noopener"><span aria-hidden="true">🌐</span> Portal Publik</a>
        <p class="piui-product-credit">
          <span class="piui-product-signature">
            <img class="piui-brand__mark" src="${brandAssets}/logo-pastel-mark.png" alt="Lambang Resmi Kota Depok" width="24" height="24">
            <strong style="color:var(--piui-text-primary,#fafafa);">Helpdesk TIK Kota Depok</strong>
          </span>
          &middot; Diskominfo Kota Depok &middot; Pemerintah Kota Depok &middot; &copy; 2026 &middot; <a href="/status.html">Status Layanan SPBE</a>
        </p>
      </div>`;
    source = source.replace(/<p class="piui-product-credit">[\\s\\S]*?<\\/p>/, adminFooterCredit);"""

    if "adminFooterCredit" not in content:
        content = content.replace(target_marker, footer_replacement)
        print("[SUCCESS] Injected adminFooterLinks and adminFooterCredit into adminPage()")
    else:
        print("[SKIP] adminFooterCredit already exists in adminPage()")

    # 2. Update baris 305/dashboard return:
    # Semula: return replaceRequired(source, '<p class="piui-product-credit">' , '<a class="piui-btn piui-btn--secondary piui-btn--sm" href="/">Portal publik</a><p class="piui-product-credit">');
    old_dash_return = "return replaceRequired(source, '<p class=\"piui-product-credit\">' , '<a class=\"piui-btn piui-btn--secondary piui-btn--sm\" href=\"/\">Portal publik</a><p class=\"piui-product-credit\">');"
    new_dash_return = "return source;"

    if old_dash_return in content:
        content = content.replace(old_dash_return, new_dash_return)
        print("[SUCCESS] Replaced old dashboard footer injection line with 'return source;'")
    else:
        print("[INFO] Old dashboard return line already removed or adjusted.")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def patch_business_css():
    path = "frontend/business.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "/* BRANDING & SPACING FOOTER RESMI WEB ADMIN (HELPDESK TIK KOTA DEPOK) */"
    if marker in content:
        print("[SKIP] Footer branding CSS already exists in business.css")
        return

    footer_css = """

/* =========================================================================
   BRANDING & SPACING FOOTER RESMI WEB ADMIN (HELPDESK TIK KOTA DEPOK)
   ========================================================================= */

.piui-footer {
  grid-area: footer !important;
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px 24px !important;
  padding-block: 16px 20px !important;
  padding-inline: clamp(1rem, 3vw, 2.5rem) !important;
  padding-block-end: max(16px, env(safe-area-inset-bottom)) !important;
  font-size: var(--piui-text-xs, 12px) !important;
  color: var(--piui-text-muted, #8b949e) !important;
  background-color: var(--piui-bg-surface, #18181b) !important;
  border-block-start: 1px solid var(--piui-border-default, #27272a) !important;
}

.piui-footer__links {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 14px 20px !important;
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.piui-footer__links a {
  color: var(--piui-text-secondary, #a1a1aa) !important;
  text-decoration: none !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  transition: color 0.15s ease, text-decoration 0.15s ease !important;
}

.piui-footer__links a:hover,
.piui-footer__links a:focus-visible {
  color: var(--piui-palette-fafafa, #ffffff) !important;
  text-decoration: underline !important;
}

.hd-admin-footer-credit {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  flex-wrap: wrap !important;
}

.hd-admin-footer-btn {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 6px 14px !important;
  font-size: 12px !important;
  border-radius: 6px !important;
  background: var(--piui-bg-elevated, #27272a) !important;
  border: 1px solid var(--piui-border-strong, #3f3f46) !important;
  color: var(--piui-text-primary, #ffffff) !important;
  text-decoration: none !important;
}

.hd-admin-footer-btn:hover {
  background: var(--piui-palette-27272a, #3f3f46) !important;
  border-color: var(--piui-palette-52525b, #52525b) !important;
  color: #ffffff !important;
}

.piui-product-credit {
  font-size: 12px !important;
  color: var(--piui-text-muted, #a1a1aa) !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  margin: 0 !important;
  line-height: 1.5 !important;
}

.piui-product-credit a {
  color: var(--piui-text-secondary, #d4d4d8) !important;
  text-decoration: none !important;
}

.piui-product-credit a:hover,
.piui-product-credit a:focus-visible {
  color: #ffffff !important;
  text-decoration: underline !important;
}

.piui-product-signature {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  color: var(--piui-text-primary, #ffffff) !important;
  font-weight: 700 !important;
}

.piui-product-signature .piui-brand__mark {
  width: 24px !important;
  height: 24px !important;
  object-fit: contain !important;
  border-radius: 4px !important;
}
"""
    content += footer_css
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[SUCCESS] Appended footer branding CSS to frontend/business.css")

def patch_docs():
    path = "docs/05_ATURAN_UI_UX_WEB_PUBLIK.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "   - **Pesan Status & Notifikasi Admin (`p[data-hd-status]`, `p[data-hd-login-status]`):**"
    if "Branding & Navigasi Footer Web Admin" in content:
        print("[SKIP] Footer branding already documented in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md")
        return

    footer_doc = """   - **Branding & Navigasi Footer Web Admin (`.piui-footer`, `.piui-product-credit`)**:
     - **Eliminasi Credit Non-Kedinasan**: Seluruh credit bawaan PIUI Zero atau nama personal wajib dieliminasi dari seluruh halaman Web Admin.
     - **Signature Resmi Kedinasan**: Sisi kanan footer memuat Lambang Resmi Kota Depok (`logo-pastel-mark.png`, 24x24 px), nama portal `Helpdesk TIK Kota Depok`, identitas instansi `Diskominfo Kota Depok · Pemerintah Kota Depok · © 2026`, serta tautan status sistem.
     - **Akses Cepat Portal Publik**: Tombol sekunder `.hd-admin-footer-btn` disediakan untuk navigasi langsung ke portal masyarakat (`/`).
     - **Tautan Operasional Sisi Kiri (`.piui-footer__links`)**: Standarisasi 5 tautan fungsional: Pusat Komando, Antrean Tiket Petugas, Jejak Audit (M9), Status Layanan SPBE, dan Basis Pengetahuan SPBE.
"""

    if marker in content:
        idx = content.find(marker)
        # Cari akhir paragraf pesan status
        end_p = content.find("\n\n", idx)
        if end_p == -1:
            end_p = len(content)
        content = content[:end_p + 2] + footer_doc + content[end_p + 2:]
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[SUCCESS] Updated docs/05_ATURAN_UI_UX_WEB_PUBLIK.md with footer branding standards")
    else:
        print("[WARN] Marker not found in docs/05_ATURAN_UI_UX_WEB_PUBLIK.md, appending...")

if __name__ == "__main__":
    patch_build_templates()
    patch_business_css()
    patch_docs()
    print("[ALL DONE] Admin footer branding patch completed.")
