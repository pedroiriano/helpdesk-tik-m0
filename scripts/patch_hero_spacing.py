"""
scripts/patch_hero_spacing.py
Penyempurnaan Spacing, Margin, Padding & Gap Tombol Hero Utama
"""
import re

def update_landing_page():
    path = "frontend/landing-page.mjs"
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()

    target = "    .replace(/(<a class=\"vy-ref-hero__mobile-cta\")[^>]*>[\\s\\S]*?<\\/a>/,\n" \
             "      '<div class=\"hd-hero-cta-wrap\" style=\"display:flex;flex-wrap:wrap;gap:12px;margin-top:1.5rem;\">' +\n" \
             "      '<a class=\"btn\" href=\"/lapor.html\" style=\"background:#0366d6;color:#ffffff;font-weight:600;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;box-shadow:0 3px 12px rgba(3,102,214,0.35);font-size:14px;letter-spacing:0.02em;\">\U0001f4dd Buat Laporan Baru &rarr;</a>' +\n" \
             "      '<a class=\"btn\" href=\"/lacak.html\" style=\"background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.25);color:#f0f6fc;font-weight:600;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;font-size:14px;letter-spacing:0.02em;\">\U0001f50d Lacak Tiket Tamu</a>' +\n" \
             "      '<a class=\"btn\" href=\"/akses.html\" style=\"background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.25);color:#f0f6fc;font-weight:600;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;font-size:14px;letter-spacing:0.02em;\">\U0001f510 Masuk SSO ASN / Warga</a>' +\n" \
             "      '</div>');"

    replacement = "    .replace(/(<a class=\"vy-ref-hero__mobile-cta\")[^>]*>[\\s\\S]*?<\\/a>/,\n" \
                  "      '<div class=\"hd-hero-cta-wrap\" role=\"group\" aria-label=\"Aksi Utama Pelayanan\">' +\n" \
                  "      '<a class=\"btn btn-primary hd-hero-btn hd-hero-btn--primary\" href=\"/lapor.html\"><span class=\"hd-btn-icon\">\U0001f4dd</span> Buat Laporan Baru &rarr;</a>' +\n" \
                  "      '<a class=\"btn btn-secondary hd-hero-btn hd-hero-btn--secondary\" href=\"/lacak.html\"><span class=\"hd-btn-icon\">\U0001f50d</span> Lacak Tiket Tamu</a>' +\n" \
                  "      '<a class=\"btn btn-secondary hd-hero-btn hd-hero-btn--secondary\" href=\"/akses.html\"><span class=\"hd-btn-icon\">\U0001f510</span> Masuk SSO ASN / Warga</a>' +\n" \
                  "      '</div>');"

    # Normalize newlines
    c_norm = c.replace("\r\n", "\n")
    if target in c_norm:
        c_norm = c_norm.replace(target, replacement)
        with open(path, "w", encoding="utf-8") as f:
            f.write(c_norm)
        print("Successfully updated hero CTA in frontend/landing-page.mjs")
    else:
        print("Warning: target not found in frontend/landing-page.mjs")

def update_public_ui_css():
    path = "frontend/public-ui.css"
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()

    spacing_rules = """
/* ==========================================================================
   8. ATURAN KANONIS MARGIN, PADDING & SPACING (CANONICAL SPACING SYSTEM)
   ========================================================================== */

/* 8.1 Hero CTA Buttons Container & Spacing System */
[data-helpdesk-public] .hd-hero-cta-wrap,
.hd-hero-cta-wrap {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 16px !important;
  margin-top: 28px !important;
  margin-bottom: 24px !important;
  padding: 0 !important;
  position: relative !important;
  z-index: 5 !important;
}

/* Individual Hero CTA Buttons with Distinct Spacing & Affordance */
[data-helpdesk-public] .hd-hero-cta-wrap .btn,
[data-helpdesk-public] .hd-hero-btn,
.hd-hero-cta-wrap .btn,
.hd-hero-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
  min-height: 48px !important;
  padding: 12px 24px !important;
  margin: 0 !important;
  border-radius: 10px !important;
  font-family: var(--font-body, inherit) !important;
  font-size: 0.92rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.015em !important;
  text-decoration: none !important;
  text-transform: none !important;
  white-space: nowrap !important;
  cursor: pointer !important;
  box-sizing: border-box !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

/* Primary Hero CTA (Buat Laporan Baru) - Royal Blue Gradient */
[data-helpdesk-public] .hd-hero-btn--primary,
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="lapor"] {
  background: linear-gradient(135deg, #0969da 0%, #0349b4 100%) !important;
  border: 1px solid #1f6feb !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(9, 105, 218, 0.38) !important;
}

[data-helpdesk-public] .hd-hero-btn--primary:hover,
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="lapor"]:hover {
  background: linear-gradient(135deg, #1f6feb 0%, #0969da 100%) !important;
  border-color: #58a6ff !important;
  color: #ffffff !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 22px rgba(9, 105, 218, 0.55) !important;
}

/* Secondary Hero CTAs (Lacak Tiket Tamu & Masuk SSO ASN) - High Contrast Dark Slate Surface */
[data-helpdesk-public] .hd-hero-btn--secondary,
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="lacak"],
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="akses"] {
  background: rgba(18, 24, 34, 0.92) !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  color: #ffffff !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2) !important;
}

[data-helpdesk-public] .hd-hero-btn--secondary:hover,
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="lacak"]:hover,
[data-helpdesk-public] .hd-hero-cta-wrap a[href*="akses"]:hover {
  background: rgba(30, 38, 52, 0.98) !important;
  border-color: rgba(56, 139, 253, 0.6) !important;
  color: #ffffff !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35) !important;
}

/* Active Press States */
[data-helpdesk-public] .hd-hero-cta-wrap .btn:active,
.hd-hero-cta-wrap .btn:active {
  transform: translateY(0) scale(0.98) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
}

/* 8.2 Hero Intro Text Clearance */
[data-helpdesk-public] .vy-ref-hero__mobile-value {
  margin-top: 16px !important;
  margin-bottom: 24px !important;
  max-width: 520px !important;
  line-height: 1.65 !important;
}

/* 8.3 Mobile Viewport Adaptive Spacing */
@media (max-width: 640px) {
  [data-helpdesk-public] .hd-hero-cta-wrap,
  .hd-hero-cta-wrap {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
    margin-top: 20px !important;
    margin-bottom: 20px !important;
  }
  [data-helpdesk-public] .hd-hero-cta-wrap .btn,
  .hd-hero-cta-wrap .btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 12px 18px !important;
  }
}

/* 8.4 Sistem Spacing Antar-Komponen Global (Form, Card, Toolbar, Dialog) */
[data-helpdesk-public] .vy-input-group,
.vy-input-group {
  margin-bottom: 20px !important;
}

[data-helpdesk-public] .vy-input-group label,
.vy-input-group label {
  margin-bottom: 8px !important;
  display: block !important;
}

[data-helpdesk-public] .hd-actions,
.hd-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 12px !important;
  margin-block: 20px !important;
}

[data-helpdesk-public] .hd-ticket-nav,
.hd-ticket-nav {
  padding: 8px 14px !important;
  gap: 10px !important;
  margin-block: 18px !important;
}

[data-helpdesk-public] .hd-pager-nav,
.hd-pager-nav {
  padding: 8px 12px !important;
  gap: 10px !important;
  margin-block: 16px 24px !important;
}

[data-helpdesk-public] .hd-queue-filters,
.hd-queue-filters {
  padding: 10px 14px !important;
  gap: 10px !important;
  margin-bottom: 18px !important;
}

[data-helpdesk-public] .hd-dropzone,
.hd-dropzone {
  padding: 32px 24px !important;
  margin-top: 8px !important;
  margin-bottom: 12px !important;
}

[data-helpdesk-public] .hd-guest-card,
.hd-guest-card {
  padding: 24px 28px !important;
  margin: 24px 0 !important;
}

[data-helpdesk-public] .hd-progress-card,
.hd-progress-card {
  padding: 24px 28px !important;
  margin-bottom: 24px !important;
}

[data-helpdesk-public] .hd-timeline-feed,
.hd-timeline-feed {
  padding: 8px 0 8px 28px !important;
  margin: 20px 0 28px 0 !important;
}

[data-helpdesk-public] .hd-timeline-item,
.hd-timeline-item {
  padding-bottom: 24px !important;
}
"""

    if "/* ==========================================================================\n   8. ATURAN KANONIS MARGIN, PADDING & SPACING" not in c:
        c += spacing_rules
        with open(path, "w", encoding="utf-8") as f:
            f.write(c)
        print("Successfully added Spacing System (Section 8) to frontend/public-ui.css")
    else:
        print("Spacing System already exists in frontend/public-ui.css")

if __name__ == "__main__":
    update_landing_page()
    update_public_ui_css()
    print("Patch hero spacing script completed!")
