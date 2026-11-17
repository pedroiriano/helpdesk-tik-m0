# -*- coding: utf-8 -*-
"""
scripts/patch_admin_footer_redesign.py
Penyempurnaan Total Tata Visual & Struktur Footer Web Admin Helpdesk TIK Kota Depok:
1. Struktur 2-Tier Berjenjang (Top: Navigasi Operasional & Aksi Portal Publik, Bottom: Identitas Resmi & Status Offline)
2. Tautan Berpenampilan Modern (Pill Badge dengan Ikon & Hover Glow, Bebas Underline Mentah)
3. Tombol Portal Publik Sejajar di Baris Navigasi (Bebas Wrapping Janggal)
4. Wadah Status Offline (#hd-admin-offline-slot) Rapi dengan Indikator Hijau Aktif
5. Garis Pemisah Halus (1px Divider) Antar-Tier
6. Responsivitas Mobile First (< 640px)
"""

import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(r"c:\Datas\Proyek\Aplikasi\helpdesk-monolith")
BUILD_TEMPLATES = ROOT / "frontend" / "build-templates.mjs"
BUSINESS_CSS = ROOT / "frontend" / "business.css"

def patch_build_templates():
    print("[1/2] Patching frontend/build-templates.mjs...")
    content = BUILD_TEMPLATES.read_text(encoding='utf-8')

    # 1. Update the admin footer replacement in adminPage()
    # In adminPage():
    # Replace the previous adminFooterLinks + adminFooterCredit replacement with structured 2-tier footer
    old_footer_block = r'''    const adminFooterLinks = `<ul class="piui-footer__links">
        <li><a href="/admin/app/dashboard/index.html">Pusat Komando</a></li>
        <li><a href="/admin/app/tickets/index.html">Antrean Tiket Petugas</a></li>
        <li><a href="/admin/app/helpdesk/index.html?kind=audit">Jejak Audit (M9)</a></li>
        <li><a href="/status.html">Status Layanan SPBE</a></li>
        <li><a href="/panduan.html">Basis Pengetahuan SPBE</a></li>
      </ul>`;
    source = source.replace(/<ul class="piui-footer__links">[\s\S]*?<\/ul>/, adminFooterLinks);

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
    source = source.replace(/<p class="piui-product-credit">[\s\S]*?<\/p>/, adminFooterCredit);'''

    new_footer_block = r'''    const admin2TierFooter = `<footer class="piui-footer" aria-label="Footer Operasional Helpdesk TIK Kota Depok">
      <div class="hd-admin-footer-top">
        <ul class="piui-footer__links">
          <li><a href="/admin/app/dashboard/index.html"><span class="hd-btn-icon" aria-hidden="true">📊</span> Pusat Komando</a></li>
          <li><a href="/admin/app/tickets/index.html"><span class="hd-btn-icon" aria-hidden="true">🎫</span> Antrean Tiket Petugas</a></li>
          <li><a href="/admin/app/helpdesk/index.html?kind=audit"><span class="hd-btn-icon" aria-hidden="true">🔍</span> Jejak Audit (M9)</a></li>
          <li><a href="/status.html"><span class="hd-btn-icon" aria-hidden="true">⚡</span> Status Layanan SPBE</a></li>
          <li><a href="/panduan.html"><span class="hd-btn-icon" aria-hidden="true">📖</span> Basis Pengetahuan SPBE</a></li>
        </ul>
        <div class="hd-admin-footer-action">
          <a class="piui-btn piui-btn--secondary piui-btn--sm hd-admin-footer-btn" href="/" target="_blank" rel="noopener">
            <span class="hd-btn-icon" aria-hidden="true">🌐</span> Portal Publik <span class="hd-btn-arrow" aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
      <div class="hd-admin-footer-sep" aria-hidden="true"></div>
      <div class="hd-admin-footer-bottom">
        <div class="hd-admin-footer-credit">
          <p class="piui-product-credit">
            <span class="piui-product-signature">
              <img class="piui-brand__mark" src="${brandAssets}/logo-pastel-mark.png" alt="Lambang Resmi Kota Depok" width="24" height="24">
              <strong style="color:var(--piui-text-primary,#fafafa);">Helpdesk TIK Kota Depok</strong>
            </span>
            &middot; Diskominfo Kota Depok &middot; Pemerintah Kota Depok &middot; &copy; 2026 &middot; <a href="/status.html">Status Layanan SPBE</a>
          </p>
        </div>
        <div class="hd-admin-footer-status-slot" id="hd-admin-offline-slot"></div>
      </div>
    </footer>`;
    source = source.replace(/<footer class="piui-footer">[\s\S]*?<\/footer>/, admin2TierFooter);'''

    if old_footer_block in content:
        content = content.replace(old_footer_block, new_footer_block)
        print("  -> Replaced old footer replacement with structured 2-tier footer")
    else:
        # Regex replacement if whitespace differs slightly
        content = re.sub(
            r'const adminFooterLinks = `<ul class="piui-footer__links">[\s\S]*?source\.replace\(/<p class="piui-product-credit">\[\\s\\S\]\*?<\\/p>\/, adminFooterCredit\);',
            new_footer_block.strip(),
            content
        )
        print("  -> Replaced via regex")

    # 2. Hook app.js so it appends status into #hd-admin-offline-slot if available
    if "hd-admin-offline-slot" not in content:
        hook_search = "if (file === 'assets/js/components/shell.js') {"
        hook_replace = "if (file === 'assets/js/app.js') {\n    source = source.replace(\"document.querySelector('footer')?.append(status);\", \"(document.getElementById('hd-admin-offline-slot')||document.querySelector('footer'))?.append(status);\");\n  }\n  if (file === 'assets/js/components/shell.js') {"
        content = content.replace(hook_search, hook_replace)
        print("  -> Injected offline slot hook for assets/js/app.js")

    BUILD_TEMPLATES.write_text(content, encoding='utf-8')
    print("  -> Successfully updated frontend/build-templates.mjs")

CSS_FOOTER_REPLACEMENT = r'''/* =========================================================================
   FOOTER WEB ADMIN HELPDESK TIK KOTA DEPOK (EKSKLUSIF, RAPI, BERKUALITAS)
   ========================================================================= */
.piui-footer {
  grid-area: footer !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  padding: 18px clamp(1rem, 3vw, 2.5rem) 16px !important;
  padding-block-end: max(16px, env(safe-area-inset-bottom)) !important;
  background: linear-gradient(180deg, rgba(24, 24, 27, 0.95) 0%, rgba(14, 15, 18, 0.98) 100%) !important;
  border-block-start: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3) !important;
  color: var(--piui-text-muted, #8b949e) !important;
  font-size: var(--piui-text-xs, 12px) !important;
  width: 100% !important;
}

/* 1. Baris Atas: Tautan Navigasi Operasional & Tombol Portal Publik */
.hd-admin-footer-top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: wrap !important;
  gap: 12px 24px !important;
  width: 100% !important;
}

.piui-footer__links {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 8px 10px !important;
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.piui-footer__links li {
  margin: 0 !important;
  padding: 0 !important;
}

.piui-footer__links a {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 6px 12px !important;
  border-radius: 6px !important;
  background: rgba(255, 255, 255, 0.035) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #a1a1aa !important;
  text-decoration: none !important;
  font-size: 12.5px !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.piui-footer__links a:hover,
.piui-footer__links a:focus-visible {
  background: rgba(56, 139, 253, 0.12) !important;
  border-color: rgba(56, 139, 253, 0.35) !important;
  color: #58a6ff !important;
  text-decoration: none !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}

.hd-admin-footer-action {
  display: flex !important;
  align-items: center !important;
}

.hd-admin-footer-btn {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 6px 14px !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  border-radius: 6px !important;
  background: rgba(56, 139, 253, 0.15) !important;
  border: 1px solid rgba(56, 139, 253, 0.35) !important;
  color: #58a6ff !important;
  transition: all 0.2s ease !important;
  text-decoration: none !important;
  white-space: nowrap !important;
}

.hd-admin-footer-btn:hover {
  background: #1f6feb !important;
  border-color: #388bfd !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.35) !important;
  transform: translateY(-1px) !important;
}

.hd-admin-footer-btn .hd-btn-arrow {
  transition: transform 0.2s ease !important;
}

.hd-admin-footer-btn:hover .hd-btn-arrow {
  transform: translateX(3px) !important;
}

/* 2. Garis Pemisah Halus Antar-Tier */
.hd-admin-footer-sep {
  width: 100% !important;
  height: 1px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  margin: 0 !important;
}

/* 3. Baris Bawah: Identitas Resmi Kedinasan & Status PWA/Offline */
.hd-admin-footer-bottom {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: wrap !important;
  gap: 12px 24px !important;
  width: 100% !important;
}

.hd-admin-footer-credit {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  flex-wrap: wrap !important;
}

.piui-product-credit {
  font-size: 12px !important;
  color: #8b949e !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  margin: 0 !important;
  line-height: 1.5 !important;
}

.piui-product-credit a {
  color: #d4d4d8 !important;
  text-decoration: none !important;
}

.piui-product-credit a:hover,
.piui-product-credit a:focus-visible {
  color: #58a6ff !important;
  text-decoration: underline !important;
}

.piui-product-signature {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  color: #ffffff !important;
  font-weight: 700 !important;
}

.piui-product-signature .piui-brand__mark {
  width: 22px !important;
  height: 22px !important;
  object-fit: contain !important;
  border-radius: 4px !important;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4)) !important;
}

/* 4. Slot Indikator Status Offline */
.hd-admin-footer-status-slot {
  display: flex !important;
  align-items: center !important;
}

.piui-footer [data-offline-status] {
  margin: 0 !important;
  padding: 4px 10px !important;
  border-radius: 6px !important;
  background: rgba(46, 160, 67, 0.12) !important;
  border: 1px solid rgba(46, 160, 67, 0.28) !important;
  font-size: 11.5px !important;
  color: #3fb950 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  line-height: 1.4 !important;
  white-space: nowrap !important;
}

.piui-footer [data-offline-status]::before {
  content: "" !important;
  display: inline-block !important;
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  background: #3fb950 !important;
  box-shadow: 0 0 6px #3fb950 !important;
}'''

def patch_business_css():
    print("[2/2] Patching frontend/business.css...")
    css = BUSINESS_CSS.read_text(encoding='utf-8')

    # Replace old footer block in business.css
    pattern = r'/\* =+\s*FOOTER OPERASIONAL[\s\S]*?\.piui-product-signature \.piui-brand__mark \{[^}]*\}'
    if re.search(pattern, css):
        css = re.sub(pattern, CSS_FOOTER_REPLACEMENT.strip(), css)
        print("  -> Replaced desktop footer rules in business.css")
    else:
        # try matching from .piui-footer to .piui-brand__mark
        pattern2 = r'\.piui-footer\s*\{[\s\S]*?\.piui-product-signature \.piui-brand__mark \{[^}]*\}'
        css = re.sub(pattern2, CSS_FOOTER_REPLACEMENT.strip(), css)
        print("  -> Replaced via pattern2")

    # Update mobile footer rules in business.css
    mobile_footer_old = r'''  /* Footer Admin di Mobile */
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
  }'''

    mobile_footer_new = r'''  /* Footer Admin di Mobile */
  .piui-footer {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 14px !important;
    padding: 16px 14px !important;
    text-align: center !important;
  }

  .hd-admin-footer-top {
    flex-direction: column !important;
    align-items: center !important;
    gap: 12px !important;
  }

  .piui-footer__links {
    justify-content: center !important;
    gap: 6px 8px !important;
  }

  .piui-footer__links a {
    font-size: 11.5px !important;
    padding: 5px 10px !important;
  }

  .hd-admin-footer-action {
    width: 100% !important;
    justify-content: center !important;
  }

  .hd-admin-footer-btn {
    width: 100% !important;
    max-width: 280px !important;
    justify-content: center !important;
  }

  .hd-admin-footer-bottom {
    flex-direction: column !important;
    align-items: center !important;
    gap: 10px !important;
    text-align: center !important;
  }

  .hd-admin-footer-credit {
    justify-content: center !important;
    text-align: center !important;
  }

  .piui-product-credit {
    justify-content: center !important;
    text-align: center !important;
    font-size: 11.5px !important;
  }

  .hd-admin-footer-status-slot {
    justify-content: center !important;
    width: 100% !important;
  }'''

    if mobile_footer_old in css:
        css = css.replace(mobile_footer_old, mobile_footer_new)
        print("  -> Replaced mobile footer rules in business.css")
    else:
        pattern_mobile = r'/\* Footer Admin di Mobile \*/[\s\S]*?\.piui-product-credit\s*\{[^}]*\}'
        css = re.sub(pattern_mobile, mobile_footer_new.strip(), css)
        print("  -> Replaced mobile rules via regex")

    BUSINESS_CSS.write_text(css, encoding='utf-8')
    print("  -> Successfully updated frontend/business.css")

if __name__ == "__main__":
    patch_build_templates()
    patch_business_css()
    print("\n[SUCCESS] Admin footer redesign patched cleanly!")
