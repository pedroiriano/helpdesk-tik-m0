#!/usr/bin/env python3
"""
patch_admin_footer_tickets.py
Memperbaiki dan menyempurnakan Footer Web Admin secara menyeluruh,
khususnya pada /admin/app/tickets/index.html, /admin/app/tickets/detail.html,
/admin/app/dashboard/index.html, dan seluruh rute admin lainnya.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def patch_build_templates():
    build_file = ROOT / "frontend" / "build-templates.mjs"
    content = build_file.read_text(encoding="utf-8")

    # 1. Patch admin2TierFooter di frontend/build-templates.mjs
    old_footer_pattern = re.compile(r'const admin2TierFooter = `<footer class="piui-footer"[\s\S]*?</footer>`;')
    new_footer = '''const admin2TierFooter = `<footer class="piui-footer" aria-label="Footer Operasional Helpdesk TIK Kota Depok">
        <div class="hd-admin-footer-top">
          <ul class="piui-footer__links">
            <li><a href="/admin/app/dashboard/index.html"><span class="hd-btn-icon" aria-hidden="true">📊</span> Dasbor</a></li>
            <li><a href="/admin/app/tickets/index.html"><span class="hd-btn-icon" aria-hidden="true">🎫</span> Antrean Tiket</a></li>
            <li><a href="/admin/app/helpdesk/index.html?kind=audit"><span class="hd-btn-icon" aria-hidden="true">🔍</span> Jejak Audit</a></li>
            <li><a href="/status.html"><span class="hd-btn-icon" aria-hidden="true">⚡</span> Status Layanan</a></li>
            <li><a href="/panduan.html"><span class="hd-btn-icon" aria-hidden="true">📖</span> Basis Pengetahuan</a></li>
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
            <span class="piui-product-signature">
              <img class="piui-brand__mark" src="${brandAssets}/logo-pastel-mark.png" alt="Lambang Resmi Kota Depok" width="22" height="22">
              <strong style="color:var(--piui-text-primary,#fafafa);">Helpdesk TIK Kota Depok</strong>
            </span>
            <span class="hd-admin-footer-dot" aria-hidden="true">&middot;</span>
            <span>Diskominfo Kota Depok &middot; Pemerintah Kota Depok &copy; 2026</span>
            <span class="hd-admin-footer-dot" aria-hidden="true">&middot;</span>
            <a href="/status.html">Status Layanan SPBE</a>
          </div>
          <div class="hd-admin-footer-status-slot" id="hd-admin-offline-slot"></div>
        </div>
      </footer>`;'''

    if old_footer_pattern.search(content):
        content = old_footer_pattern.sub(new_footer, content)
        print("[OK] admin2TierFooter updated in build-templates.mjs")
    else:
        print("[WARN] old_footer_pattern not found in build-templates.mjs")

    # 2. Patch app.js injection agar mengarah ke #hd-admin-offline-slot
    app_js_hook = """    if (file === 'assets/js/app.js') {
      source = source.replace("document.querySelector('footer')?.append(status);",
        "(document.getElementById('hd-admin-offline-slot') || document.querySelector('footer'))?.append(status);");
    }"""
    if "file === 'assets/js/app.js'" not in content:
        target = "if (file === 'assets/js/components/shell.js') {"
        content = content.replace(target, app_js_hook + "\n    " + target)
        print("[OK] app.js offline status hook added to build-templates.mjs")

    # 3. Bersihkan judul drawer mobile PIUI Zero
    content = content.replace("Menu Navigasi PIUI Zero", "Menu Navigasi Helpdesk TIK")
    content = content.replace("Modul internal manajemen identitas dan hak akses PIUI Zero.",
                              "Modul internal antrean tiket dan manajemen Helpdesk TIK Kota Depok.")

    build_file.write_text(content, encoding="utf-8")

def patch_business_css():
    css_file = ROOT / "frontend" / "business.css"
    content = css_file.read_text(encoding="utf-8")

    # Update aturan CSS Footer Web Admin
    footer_css = """/* =========================================================================
   FOOTER WEB ADMIN HELPDESK TIK KOTA DEPOK (EKSKLUSIF, RAPI, BERKUALITAS)
   ========================================================================= */
.piui-footer {
  grid-area: footer !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  padding: 16px clamp(1rem, 2.5vw, 2rem) 14px !important;
  padding-block-end: max(14px, env(safe-area-inset-bottom)) !important;
  background: linear-gradient(180deg, #18181b 0%, #0e0f12 100%) !important;
  border-block-start: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3) !important;
  color: var(--piui-text-muted, #8b949e) !important;
  font-size: var(--piui-text-xs, 12px) !important;
  width: 100% !important;
  box-sizing: border-box !important;
  margin-top: auto !important;
}

/* 1. Baris Atas: Tautan Navigasi Operasional & Tombol Portal Publik */
.hd-admin-footer-top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: wrap !important;
  gap: 10px 16px !important;
  width: 100% !important;
}

.piui-footer__links {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 6px 8px !important;
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.piui-footer__links li {
  margin: 0 !important;
  padding: 0 !important;
  display: inline-flex !important;
}

.piui-footer__links a {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 5px 11px !important;
  border-radius: 6px !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #c9d1d9 !important;
  text-decoration: none !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 0.15s ease !important;
  white-space: nowrap !important;
}

.piui-footer__links a:hover,
.piui-footer__links a:focus-visible {
  background: rgba(56, 139, 253, 0.15) !important;
  border-color: rgba(56, 139, 253, 0.4) !important;
  color: #58a6ff !important;
  text-decoration: none !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}

.hd-admin-footer-action {
  display: flex !important;
  align-items: center !important;
  flex-shrink: 0 !important;
}

.hd-admin-footer-btn {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 5px 13px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 6px !important;
  background: rgba(56, 139, 253, 0.14) !important;
  border: 1px solid rgba(56, 139, 253, 0.35) !important;
  color: #58a6ff !important;
  transition: all 0.15s ease !important;
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
  transition: transform 0.15s ease !important;
}

.hd-admin-footer-btn:hover .hd-btn-arrow {
  transform: translateX(3px) !important;
}

/* 2. Garis Pemisah Halus Antar-Tier */
.hd-admin-footer-sep {
  width: 100% !important;
  height: 1px !important;
  background: rgba(255, 255, 255, 0.07) !important;
  margin: 2px 0 !important;
}

/* 3. Baris Bawah: Identitas Resmi Kedinasan & Status PWA/Offline */
.hd-admin-footer-bottom {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: wrap !important;
  gap: 10px 16px !important;
  width: 100% !important;
}

.hd-admin-footer-credit {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  font-size: 12px !important;
  color: #8b949e !important;
  line-height: 1.5 !important;
}

.hd-admin-footer-dot {
  color: rgba(255, 255, 255, 0.25) !important;
  font-weight: bold !important;
}

.hd-admin-footer-credit a {
  color: #c9d1d9 !important;
  text-decoration: none !important;
}

.hd-admin-footer-credit a:hover,
.hd-admin-footer-credit a:focus-visible {
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
  width: 20px !important;
  height: 20px !important;
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
  padding: 3px 9px !important;
  border-radius: 6px !important;
  background: rgba(46, 160, 67, 0.12) !important;
  border: 1px solid rgba(46, 160, 67, 0.28) !important;
  font-size: 11px !important;
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
}

/* Aturan Khusus Konten Halaman Tiket Admin agar tidak menempel */
[data-ticket-page="list"] .hd-catalog {
  min-height: 80px;
  margin-block: 16px 20px !important;
}

[data-ticket-page] .hd-ticket-nav {
  margin-block: 12px 18px !important;
  gap: 10px !important;
}

[data-ticket-page] .hd-pager-nav {
  margin-block: 18px 24px !important;
}

.piui-product-help {
  margin-top: 24px !important;
  margin-bottom: 24px !important;
}
"""

    # Ganti bagian FOOTER WEB ADMIN sampai sebelum PENYEMPURNAAN MOBILE
    pattern = re.compile(r'/\* =+\s*FOOTER WEB ADMIN HELPDESK TIK KOTA DEPOK[\s\S]*?(?=/\* =+\s*PENYEMPURNAAN MOBILE FIRST WEB ADMIN)')
    if pattern.search(content):
        content = pattern.sub(footer_css + "\n", content)
        print("[OK] business.css updated with refined 2-tier footer")
    else:
        print("[WARN] footer block not matched in business.css")

    css_file.write_text(content, encoding="utf-8")

def patch_layout_css():
    # Masukkan styling footer yang sama ke references/piui-zero/assets/css/layout.css
    # agar semua halaman admin (termasuk dashboard) ter-style seragam
    layout_file = ROOT / "references" / "piui-zero" / "assets" / "css" / "layout.css"
    content = layout_file.read_text(encoding="utf-8")

    layout_footer_css = """  .piui-footer {
    grid-area: footer;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px clamp(1rem, 2.5vw, 2rem) 14px;
    padding-block-end: max(14px, env(safe-area-inset-bottom));
    font-size: var(--piui-text-xs, 12px);
    color: var(--piui-text-muted);
    background-color: var(--piui-bg-surface);
    background-image: var(--piui-gradient-surface);
    border-block-start: 1px solid var(--piui-border-subtle);
    margin-top: auto;
    width: 100%;
    box-sizing: border-box;
  }

  .hd-admin-footer-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 16px;
    width: 100%;
  }

  .piui-footer__links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .piui-footer__links li {
    margin: 0;
    padding: 0;
    display: inline-flex;
  }

  .piui-footer__links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #c9d1d9;
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .piui-footer__links a:hover {
    background: rgba(56, 139, 253, 0.15);
    border-color: rgba(56, 139, 253, 0.4);
    color: #58a6ff;
  }

  .hd-admin-footer-action {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .hd-admin-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 13px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    background: rgba(56, 139, 253, 0.14);
    border: 1px solid rgba(56, 139, 253, 0.35);
    color: #58a6ff;
    text-decoration: none;
    white-space: nowrap;
  }

  .hd-admin-footer-btn:hover {
    background: #1f6feb;
    border-color: #388bfd;
    color: #ffffff;
  }

  .hd-admin-footer-sep {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.07);
    margin: 2px 0;
  }

  .hd-admin-footer-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 16px;
    width: 100%;
  }

  .hd-admin-footer-credit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #8b949e;
  }

  .hd-admin-footer-dot {
    color: rgba(255, 255, 255, 0.25);
    font-weight: bold;
  }

  .hd-admin-footer-credit a {
    color: #c9d1d9;
    text-decoration: none;
  }

  .hd-admin-footer-credit a:hover {
    color: #58a6ff;
    text-decoration: underline;
  }

  .piui-product-signature {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #ffffff;
    font-weight: 700;
  }

  .piui-product-signature .piui-brand__mark {
    width: 20px;
    height: 20px;
    object-fit: contain;
    border-radius: 4px;
  }

  .hd-admin-footer-status-slot {
    display: flex;
    align-items: center;
  }

  .piui-footer [data-offline-status] {
    margin: 0;
    padding: 3px 9px;
    border-radius: 6px;
    background: rgba(46, 160, 67, 0.12);
    border: 1px solid rgba(46, 160, 67, 0.28);
    font-size: 11px;
    color: #3fb950;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }"""

    # Ganti bagian section 7 FOOTER OPERASIONAL RINGKAS di layout.css
    pattern = re.compile(r'/\* =+\s*7\. FOOTER OPERASIONAL RINGKAS\s*=+\s*\*/\s*\.piui-footer\s*\{[\s\S]*?\.piui-footer__links\s*\{[\s\S]*?\}')
    replacement = "/* =========================================================================\n     7. FOOTER OPERASIONAL RESMI HELPDESK TIK KOTA DEPOK\n     ========================================================================= */\n" + layout_footer_css
    if pattern.search(content):
        content = pattern.sub(replacement, content)
        layout_file.write_text(content, encoding="utf-8")
        print("[OK] references/piui-zero/assets/css/layout.css updated with canonical 2-tier footer styles")
    else:
        print("[WARN] section 7 not matched in references layout.css")

if __name__ == "__main__":
    patch_build_templates()
    patch_business_css()
    patch_layout_css()
    print("[SUCCESS] Semua file berhasil di-patch.")
