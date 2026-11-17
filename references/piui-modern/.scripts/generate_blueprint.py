"""
Master Generator Script for Enterprise Blueprint UI/UX Zero-Dependency Native Web (DOCX)
Complete Edition: Comprehensive Architectural Blueprint with Deep Mobile-First Engineering,
Production Code Archetypes, Security, CWV, SEO, Link Integrity, and Quality Gates.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_blueprint_docx(output_path):
    doc = docx.Document()
    
    # ---------------------------------------------------------
    # Page Setup (Standard Letter / A4 with 1-inch margins)
    # ---------------------------------------------------------
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        
        # Configure Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("ENTERPRISE BLUEPRINT: ARSITEKTUR UI/UX NATIVE WEB (ZERO-DEPENDENCY & MOBILE-FIRST)")
        hrun.font.name = "Segoe UI"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(100, 116, 139)
        
        # Configure Footer with Page Numbering
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        frun1 = fp.add_run("Dokumen Arsitektur UI/UX Enterprise | Standar Mobile-First & Native Modern\tHalaman ")
        frun1.font.name = "Segoe UI"
        frun1.font.size = Pt(9)
        frun1.font.color.rgb = RGBColor(100, 116, 139)
        
        fldChar1 = parse_xml(r'<w:fldChar %s w:fldCharType="begin"/>' % nsdecls('w'))
        instrText = parse_xml(r'<w:instrText %s xml:space="preserve"> PAGE </w:instrText>' % nsdecls('w'))
        fldChar2 = parse_xml(r'<w:fldChar %s w:fldCharType="separate"/>' % nsdecls('w'))
        fldChar3 = parse_xml(r'<w:fldChar %s w:fldCharType="end"/>' % nsdecls('w'))
        
        frun_page = fp.add_run()
        frun_page._r.append(fldChar1)
        frun_page._r.append(instrText)
        frun_page._r.append(fldChar2)
        frun_page._r.append(fldChar3)
        frun_page.font.name = "Segoe UI"
        frun_page.font.size = Pt(9)
        frun_page.font.color.rgb = RGBColor(100, 116, 139)

    # ---------------------------------------------------------
    # Styling Helpers & Palette
    # ---------------------------------------------------------
    COLOR_PRIMARY = RGBColor(15, 23, 42)      # Slate 900
    COLOR_SECONDARY = RGBColor(37, 99, 235)   # Royal Blue 600
    COLOR_DARK_BLUE = RGBColor(30, 58, 138)   # Dark Blue 900
    COLOR_MUTED = RGBColor(71, 85, 105)       # Slate 600
    COLOR_TEXT = RGBColor(30, 41, 59)         # Slate 800
    
    HEX_BORDER = "CBD5E1"
    HEX_BG_ZEBRA = "F8FAFC"
    HEX_PRIMARY_DARK = "0F172A"

    def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        tcPr.append(tcMar)

    def set_cell_background(cell, hex_color):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
        tcPr.append(shd)

    def add_title(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(23)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_subtitle(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(16)
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(11.5)
        run.font.italic = True
        run.font.color.rgb = COLOR_MUTED
        return p

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(15.5)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(12.5)
        run.font.bold = True
        run.font.color.rgb = COLOR_DARK_BLUE
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = COLOR_SECONDARY
        return p

    def add_p(text, bold_prefix=None):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            run_b = p.add_run(bold_prefix)
            run_b.font.name = "Segoe UI"
            run_b.font.size = Pt(10)
            run_b.font.bold = True
            run_b.font.color.rgb = COLOR_PRIMARY
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(10)
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet(text, bold_prefix=None, level=0):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
        if bold_prefix:
            run_b = p.add_run(bold_prefix)
            run_b.font.name = "Segoe UI"
            run_b.font.size = Pt(10)
            run_b.font.bold = True
            run_b.font.color.rgb = COLOR_PRIMARY
        run = p.add_run(text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(10)
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_callout(text, title="BEST PRACTICE / CATATAN ARSITEKTURAL", theme="blue"):
        themes = {
            "blue": {"border": "2563EB", "bg": "EFF6FF", "title_color": RGBColor(30, 64, 175)},
            "green": {"border": "16A34A", "bg": "F0FDF4", "title_color": RGBColor(22, 101, 52)},
            "amber": {"border": "D97706", "bg": "FFFBEB", "title_color": RGBColor(146, 64, 14)},
            "purple": {"border": "7C3AED", "bg": "F5F3FF", "title_color": RGBColor(91, 33, 182)},
            "red": {"border": "DC2626", "bg": "FEF2F2", "title_color": RGBColor(153, 27, 27)},
        }
        cfg = themes.get(theme, themes["blue"])
        
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.columns[0].width = Inches(6.5)
        
        cell = tbl.cell(0, 0)
        set_cell_background(cell, cfg["bg"])
        set_cell_margins(cell, top=120, bottom=120, left=180, right=160)
        
        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:left w:val="single" w:sz="36" w:space="0" w:color="{cfg['border']}"/>
                <w:bottom w:val="none"/>
                <w:right w:val="none"/>
            </w:tcBorders>
        ''')
        tcPr.append(borders)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        run_t = p.add_run(f"■ {title.upper()}\n")
        run_t.font.name = "Segoe UI"
        run_t.font.size = Pt(9.5)
        run_t.font.bold = True
        run_t.font.color.rgb = cfg["title_color"]
        
        run_body = p.add_run(text)
        run_body.font.name = "Segoe UI"
        run_body.font.size = Pt(9.5)
        run_body.font.color.rgb = COLOR_TEXT
        
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(6)

    def add_code_block(code_text, language_label="KODE / IMPLEMENTASI NATIVE"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.columns[0].width = Inches(6.5)
        
        cell = tbl.cell(0, 0)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        
        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            </w:tcBorders>
        ''')
        tcPr.append(borders)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        
        run_lbl = p.add_run(f"// {language_label}\n")
        run_lbl.font.name = "Consolas"
        run_lbl.font.size = Pt(8.5)
        run_lbl.font.bold = True
        run_lbl.font.color.rgb = RGBColor(71, 85, 105)
        
        run_code = p.add_run(code_text)
        run_code.font.name = "Consolas"
        run_code.font.size = Pt(8.5)
        run_code.font.color.rgb = RGBColor(15, 23, 42)
        
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(6)

    def add_table_data(headers, rows, col_widths=None):
        tbl = doc.add_table(rows=len(rows) + 1, cols=len(headers))
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        
        hdr_row = tbl.rows[0]
        trPr = hdr_row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        
        for idx, title in enumerate(headers):
            cell = hdr_row.cells[idx]
            if col_widths and idx < len(col_widths):
                cell.width = Inches(col_widths[idx])
            set_cell_background(cell, HEX_PRIMARY_DARK)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(title)
            run.font.name = "Segoe UI"
            run.font.size = Pt(9)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            
        for r_idx, row_data in enumerate(rows):
            row = tbl.rows[r_idx + 1]
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            bg_color = HEX_BG_ZEBRA if r_idx % 2 == 1 else "FFFFFF"
            
            for c_idx, cell_value in enumerate(row_data):
                cell = row.cells[c_idx]
                if col_widths and c_idx < len(col_widths):
                    cell.width = Inches(col_widths[c_idx])
                set_cell_background(cell, bg_color)
                set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
                
                tcPr = cell._tc.get_or_add_tcPr()
                borders = parse_xml(f'''
                    <w:tcBorders {nsdecls("w")}>
                        <w:top w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                        <w:left w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                        <w:right w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                    </w:tcBorders>
                ''')
                tcPr.append(borders)
                
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                run = p.add_run(cell_value)
                run.font.name = "Segoe UI"
                run.font.size = Pt(8.5)
                run.font.color.rgb = COLOR_TEXT
                
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(6)

    # ---------------------------------------------------------
    # DOCUMENT COVER & HEADER BLOCK
    # ---------------------------------------------------------
    add_title("BLUEPRINT ARSITEKTUR UI/UX NATIVE WEB: ZERO-DEPENDENCY & MOBILE-FIRST")
    add_subtitle("Pedoman Rekayasa Arsitektur Antarmuka Web Modern (HTML5 Living Standard, Modern CSS, ES2024+ Vanilla JS) dengan Disiplin Mobile-First Penuh, Bebas Kerusakan Tata Letak pada Resolusi HP & Tablet, Keamanan Enterprise, Keandalan WCAG 2.2, SEO Ekstrem, dan Integritas Tautan")
    
    meta_headers = ["Parameter Proyek", "Spesifikasi & Standar Rekayasa"]
    meta_rows = [
        ["Klasifikasi Blueprint", "Master Architectural & Implementation Blueprint (Production Grade v3.0)"],
        ["Pendekatan Desain", "Strict Mobile-First Upward Progression (Min-Width Media Queries Only)"],
        ["Target Stack", "Pure Native Web Platform (HTML5, Modern CSS, Modern Vanilla JS) - 0 NPM Dependency"],
        ["Ketahanan Responsif", "Zero Layout Breakdown: 320px (HP Kecil), Tablet Portrait, Tablet Landscape, Desktop, Ultra-wide"],
        ["Standar Kepatuhan", "W3C HTML5, WCAG 2.2 Level AA, Core Web Vitals (Google CWV 2026), CSP Level 3"],
        ["Target Performa", "LCP < 1.2s, INP < 80ms, CLS = 0.00, FCP < 0.7s, Lighthouse Score 100/100"],
        ["Tingkat Keamanan", "Enterprise Hardened (Strict CSP L3, Zero InnerHTML XSS, SRI, HTTP Security Headers)"],
        ["SEO & Sosial", "Semantic First, Instant Static Indexability, Schema.org JSON-LD, OpenGraph Complete"],
        ["Integritas Tautan", "Strict Rel Guard (noopener noreferrer), Native View Transitions Routing, Link Sentinel"],
        ["Versi Dokumen", "v3.0 Enterprise Mobile-First Edition - Siap Implementasi Lapangan"]
    ]
    add_table_data(meta_headers, meta_rows, [2.2, 4.3])
    
    add_callout(
        "Pembaruan v3.0 Blueprint ini menyematkan disiplin 'Mobile-First Architecture' secara mutlak. "
        "Di era modern di mana lebih dari 70% lalu lintas web berasal dari perangkat genggam (smartphone & tablet), "
        "tata letak antarmuka dibangun dari layar terkecil (320px) sebagai baseline default, lalu diperkaya ke atas "
        "hanya dengan @media (min-width: ...). Pendekatan ini mengeliminasi 100% bug pergeseran tata letak liar, "
        "konten terpotong di HP, dan masalah horizontal scrollbar.",
        title="Mandat Rekayasa Mobile-First",
        theme="purple"
    )

    # ---------------------------------------------------------
    # BAB 1: LANDASAN FILOSOFI & KEUNGGULAN STRATEGIS
    # ---------------------------------------------------------
    add_h1("BAB 1: LANDASAN FILOSOFI & KEUNGGULAN STRATEGIS ZERO-DEPENDENCY")
    
    add_h2("1.1 Krisis Dependensi Modern & Jebakan Framework Bloat")
    add_p("Dalam satu dekade terakhir, industri pengembangan antarmuka web mengalami kecenderungan berbahaya: "
          "ketergantungan berlebihan pada ekosistem package manager pihak ketiga (seperti NPM). Sebuah proyek aplikasi "
          "web sederhana berbasis React atau Angular rata-rata menarik antara 800 hingga 1.500 sub-dependensi ke dalam "
          "folder node_modules, dengan total bobot melampaui 300MB hingga 1GB di mesin pengembang.")
    add_p("Kondisi ini menciptakan empat krisis mendasar dalam pengembangan produk digital:")
    add_bullet("Supply Chain Vulnerability: Setiap sub-dependensi merupakan vektor serangan siber potensial. Riwayat industri mencatat insiden fatal seperti serangan injeksi malware pada package 'event-stream', 'ua-parser-js', 'colors.js', hingga eksploitasi dependensi transitif.", "1. Kerentanan Rantai Pasok: ")
    add_bullet("Framework Churn & Breaking Changes: Framework komersial kerap memperbarui versi mayor setiap 6-12 bulan, memaksa tim melakukan refactoring kode, migrasi API yang usang (deprecated), dan memperbarui puluhan plugin pendukung yang sering kali macet atau tidak lagi dipelihara (abandoned).", "2. Usia Pakai Rapuh (Churn): ")
    add_bullet("Hydration Tax & Beban Memori CPU: Single Page Application (SPA) membebankan rendering ulang di perangkat klien. Ponsel kelas menengah ke bawah harus mengunduh ratusan kilobyte JavaScript, mengurai (parse), mengompilasi, dan mengeksekusi Virtual DOM sebelum halaman menjadi interaktif.", "3. Pajak Hidrasi (Hydration Overhead): ")
    add_bullet("Vendor Lock-In & Kompleksitas Pipeline Build: Tim rekayasa terikat pada tool bundler rumit (Webpack, Babel, Rollup, Vite) yang memerlukan konfigurasi ribuan baris, memperlambat proses deployment dan onboarding pengembang baru.", "4. Kompleksitas Tooling: ")

    add_h2("1.2 Revolusi Platform Web Native Terkini (HTML5, Modern CSS, ES2024+)")
    add_p("Sebagian besar alasan historis lahirnya pustaka eksternal (seperti jQuery pada 2006, Bootstrap pada 2011, atau Redux pada 2015) "
          "kini telah diselesaikan secara elegan dan berkinerja tinggi langsung oleh standar platform peramban (W3C dan WHATWG):")
    add_bullet("DOM Manipulation & Query: Browser native menyediakan querySelector, querySelectorAll, closest(), matches(), classList, dan Element.toggleAttribute() yang beroperasi pada kecepatan C++ tingkat peramban tanpa overhead wrapper.", "Native DOM API: ")
    add_bullet("Layout & Tata Letak: CSS Grid Level 2, Flexbox, Subgrid, dan Container Queries (@container) memungkinkan perancangan antarmuka responsif tingkat komponen tanpa membutuhkan framework CSS eksternal seberat puluhan kilobyte.", "Modern CSS Layout: ")
    add_bullet("Desain Dinamis & Tema: CSS Custom Properties (--variable), CSS Nesting native, dan color-mix() memungkinkan sistem desain (Design Tokens) dinamis, tema gelap/terang, dan palet warna fluid tanpa preprocessor Sass/Less.", "CSS Variables & Nesting: ")
    add_bullet("Transisi Halaman Halus: Native View Transitions API (document.startViewTransition) menghadirkan animasi perpindahan rute dan morphing elemen sehalus aplikasi mobile native tanpa library animasi tambahan.", "View Transitions API: ")
    add_bullet("Modularitas & Asinkronisasi: Native ES Modules (<script type='module'>), Import Maps, Top-Level Await, Async/Await, dan Web Components Shadow DOM.", "Modern Vanilla JavaScript: ")

    add_h2("1.3 Matriks Komparasi Strategis: Zero-Dependency vs Framework SPA")
    comp_headers = ["Dimensi Arsitektur", "Native Web Zero-Dependency", "Framework SPA Konvensional (React/Next)"]
    comp_rows = [
        ["Ukuran Transfer Awal (Gzip)", "12 KB - 35 KB (Ultra Ringan)", "250 KB - 850 KB+ (Besar & Berat)"],
        ["Waktu Parse & Compile JS", "< 15 ms (Hampir Instan di Mobile)", "180 ms - 550 ms (Beban CPU Berat)"],
        ["Interaksi Awal (INP / TTI)", "< 40 ms (Sangat Responsif)", "150 ms - 400 ms (Rentan Delay)"],
        ["Kebutuhan Build Pipeline", "0 Tool Wajib (Bisa langsung dibuka di browser)", "Wajib Node.js, Bundler, Transpiler, Linter"],
        ["Serangan Rantai Pasok (Supply Chain)", "0 Vektor (Zero Third-Party Code)", "> 1.200 Sub-dependensi Terpasang"],
        ["Biaya Maintenance Jangka Panjang", "Rendah (Mengikuti standar terbuka W3C)", "Tinggi (Upgrade versi mayor rutin & breaking changes)"],
        ["Crawlability Mesin Pencari (SEO)", "Instan 100% (HTML statis langsung terbaca)", "Bergantung pada SSR server / render queue bot"],
        ["Ketahanan Arsitektur (Longevity)", "> 10 Tahun Tanpa Refactoring Wajib", "2 - 3 Tahun Sebelum Deprecated"]
    ]
    add_table_data(comp_headers, comp_rows, [1.8, 2.3, 2.4])

    # ---------------------------------------------------------
    # BAB 2: ARSITEKTUR STRUKTUR DIREKTORI & MODULARITAS
    # ---------------------------------------------------------
    add_h1("BAB 2: ARSITEKTUR STRUKTUR DIREKTORI & KEBERSIHAN ROOT FOLDER")
    
    add_h2("2.1 Prinsip Kebersihan Folder Akar (Root Directory Hygiene)")
    add_p("Salah satu tanda buruk dari proyek perangkat lunak yang tidak terkelola dengan baik adalah menumpuknya file acak "
          "di root directory (skrip pengujian sementara, file sampah, atau dump log). Arsitektur enterprise native mewajibkan "
          "Root Folder hanya memuat file yang MUTLAK dibutuhkan oleh standar peramban, mesin pencari, dan agen AI:")
    add_bullet("File Web Utama: index.html (entrypoint tunggal), 404.html (fallback rute), sw.js (service worker wajib berada di root agar memiliki scope penuh /), manifest.webmanifest, robots.txt, dan sitemap.xml.", "File Wajib Peramban: ")
    add_bullet("Seluruh kode gaya disimpan di folder css/, modul JavaScript di folder js/, aset visual di folder assets/, dokumen di folder .docs/, aturan AI di folder .agents/, skrip di folder .scripts/, dan materi referensi di .references/.", "Struktur Bersih Subdirektori: ")

    tree_structure = """proyek-ui-ux-native/
├── index.html                   # Landing page utama
├── gallery.html                 # Output archive & Master-Detail viewer
├── pricing.html                 # Pricing & interactive credit sizer
├── about.html                   # Studio manifesto & architecture
├── contact.html                 # Contact desk & dispatch
├── 404.html                     # Fallback rute tidak ditemukan
├── robots.txt                   # Direktif perayapan mesin pencari
├── sitemap.xml                  # Peta situs terindeks canonical
├── manifest.webmanifest         # Metadata PWA & identitas aplikasi
├── sw.js                        # Service Worker native untuk offline & cache
├── .agents/                     # Tata kelola & aturan AI
│   ├── GEMINI.md                # Aturan rekayasa spesifik untuk Google Gemini
│   ├── CLAUDE.md                # Aturan rekayasa spesifik untuk Anthropic Claude
│   ├── CHATGPT.md               # Aturan rekayasa spesifik untuk OpenAI ChatGPT
│   └── CURSORRULES.md           # Aturan agen IDE Cursor / Windsurf / Copilot
├── .docs/                       # Pusat cetak biru & dokumen arsitektur
│   ├── BLUEPRINT_...NATIVE.docx # Master blueprint dokumen Word resmi
│   └── VAYRA_STUDIO_CLONE_BLUEPRINT.md # Dekonstruksi & analisis Vayra
├── .scripts/                    # Skrip otomasi developer (generator & linter)
│   ├── generate_blueprint.py    # Skrip generator dokumen blueprint
│   └── check_links.py           # Skrip pemeriksa integritas tautan (Link Sentinel)
├── .references/                 # Media & video referensi pengguna
├── css/
│   ├── main.css                 # Master stylesheet dengan arsitektur @layer
│   ├── 01-tokens.css            # Variabel warna obsidian, tipografi, radius
│   ├── 02-base.css              # Reset modern, typography, 100dvh, anti-zoom iOS
│   ├── 03-layout.css            # Shell container, header glide, mobile drawer
│   ├── 04-components.css        # Komponen studio (viewer, sizer, chart, faq)
│   └── 05-utilities.css         # Helper classes & native scroll entrance
├── js/
│   ├── main.js                  # Entrypoint orkestrator aplikasi (type="module")
│   └── modules/
│       ├── navigation.js        # Drawer responsif, focus trap, navigasi keyboard
│       ├── hero-switcher.js     # Stage switcher panggung hero (prev/next)
│       ├── gallery.js           # Master-Detail viewer & copy prompt clipboard
│       ├── metrics-chart.js     # Grafik throughput SVG & count-up metrics
│       ├── pricing-sizer.js     # Kalkulator sizer kredit interaktif
│       ├── faq.js               # Accordion animasi CSS Grid 0fr-1fr
│       ├── contact.js           # Validasi formulir & honeypot anti-spam
│       └── link-sentinel.js     # Validasi integritas tautan & proteksi tabnabbing
└── assets/
    ├── icons/                   # Standalone / Inline SVG symbols
    └── images/                  # Studio renders (render-01.jpg s/d 08.jpg)"""
    add_code_block(tree_structure, "STRUKTUR REPOSITORI STANDAR PRODUKSI (ROOT BERSIH & RIGID)")

    add_h2("2.2 Arsitektur CSS Berlapis dengan Fitur Modern CSS @layer")
    add_p("Masalah klasik pada CSS lama adalah 'Specificity War' dan penggunaan '!important' yang merusak maintainability. "
          "Dalam arsitektur modern terkini, kita menggunakan fitur W3C resmi yaitu Cascading Layers (@layer). "
          "Dengan mendefinisikan prioritas layer di awal berkas CSS, peramban menjamin bahwa aturan pada layer komponen "
          "selalu dapat ditimpa oleh layer utilitas, tanpa terpengaruh oleh kerumitan selektor:")
    
    css_layer_code = """/* css/main.css */
/* Mendefinisikan urutan spesifisitas layer secara eksplisit */
@layer tokens, base, layout, components, utilities;

@import url('./01-tokens.css') layer(tokens);
@import url('./02-base.css') layer(base);
@import url('./03-layout.css') layer(layout);
@import url('./04-components.css') layer(components);
@import url('./05-utilities.css') layer(utilities);"""
    add_code_block(css_layer_code, "CSS @LAYER HIERARCHY")

    add_h2("2.3 Modularitas JavaScript Native: ES Modules & Native Import Maps")
    add_p("Tanpa membutuhkan bundler seperti Webpack atau Vite, browser modern telah mendukung sistem modul native secara penuh. "
          "Dengan menambahkan atribut type='module' pada tag script, browser secara otomatis:")
    add_bullet("Mengaktifkan mode ketat ('use strict') secara otomatis.", "Isolasi Scope: ")
    add_bullet("Mengeksekusi skrip secara asinkron tanpa memblokir parsing HTML (setara dengan perilaku defer).", "Non-Blocking Execution: ")
    add_bullet("Mendukung sintaks impor dan ekspor native (import / export) antar file terpisah.", "Native Modular Syntax: ")
    add_bullet("Mencegah pemuatan file ganda (deduplikasi modul secara otomatis oleh engine browser).", "Smart Caching: ")
    
    import_map_code = """<!-- index.html -->
<script type="importmap">
{
  "imports": {
    "app/theme": "./js/modules/theme.js",
    "app/navigation": "./js/modules/navigation.js",
    "app/router": "./js/modules/router.js",
    "app/security": "./js/modules/security.js",
    "app/state": "./js/modules/state.js"
  }
}
</script>
<script type="module" src="./js/main.js"></script>"""
    add_code_block(import_map_code, "NATIVE IMPORT MAPS & ES MODULES BOOTSTRAP")

    # ---------------------------------------------------------
    # BAB 3: PERANCANGAN UI/UX, DESIGN TOKENS & MOBILE-FIRST
    # ---------------------------------------------------------
    add_h1("BAB 3: PERANCANGAN UI/UX & REKAYASA ARSITEKTUR MOBILE-FIRST")
    
    add_h2("3.1 Mental Model Mobile-First: Upward Progression Mutlak")
    add_p("Penyebab utama antarmuka web berantakan di HP dan tablet adalah kesalahan mental model: "
          "pengembang mendesain versi desktop terlebih dahulu, lalu mencoba 'memperbaikinya' untuk HP "
          "menggunakan puluhan baris @media (max-width: ...). Pendekatan ini merupakan Anti-Pattern berbahaya!")
    add_bullet("Semua deklarasi CSS di luar media query adalah gaya bawaan (default) untuk layar HP paling kecil (320px - 390px).", "Aturan Dasar 1: ")
    add_bullet("DILARANG KERAS menggunakan @media (max-width: ...). Satu-satunya media query yang diizinkan untuk tata letak responsif adalah @media (min-width: ...).", "Aturan Dasar 2: ")
    add_bullet("Komponen mobile adalah single-column alami (blok vertikal penuh), target sentuh besar, dan navigasi tersembunyi di drawer/bottom-bar.", "Aturan Dasar 3: ")
    add_bullet("Ketika viewport membesar ke ukuran tablet dan desktop, kita secara bertahap memperkaya (progressive enhancement) tata letak menjadi 2 kolom, 3 kolom, atau grid multi-dimensi.", "Aturan Dasar 4: ")

    add_h2("3.2 Matriks Breakpoint Standar Industri Modern (Mobile, Tablet, Desktop)")
    bp_headers = ["Target Perangkat", "Breakpoint Media Query", "Karakteristik Tata Letak & Ergonomi UI/UX"]
    bp_rows = [
        ["Mobile Base (HP Sempit)", "CSS Default (Tanpa Media Query)", "Single column stack, 100% width, margin 1rem, target sentuh >= 48px, drawer menu."],
        ["Tablet Portrait (sm)", "@media (min-width: 640px)", "2-column grid dimulai, margin 1.5rem, kartu bertransformasi horizontal berdampingan."],
        ["Tablet Landscape / Netbook (md)", "@media (min-width: 768px)", "2-3 kolom grid, drawer berubah menjadi navigasi semi-horizontal atau sidebar ringkas."],
        ["Desktop Standar (lg)", "@media (min-width: 1024px)", "Full horizontal navbar, 3-4 kolom grid, sidebar sticky, container max-width 1024px."],
        ["Large Desktop / Monitor (xl)", "@media (min-width: 1280px)", "Tata letak lebar penuh dengan container 1200px terpusat, pernapasan whitespace luas."],
        ["Ultra-Wide Display (2xl)", "@media (min-width: 1536px)", "Pembatasan lebar baca optimal (max 75ch untuk artikel) agar mata tidak lelah."]
    ]
    add_table_data(bp_headers, bp_rows, [1.8, 2.2, 2.5])

    add_h2("3.3 Solusi Mutlak Mencegah Tampilan Berantakan di HP & Tablet")
    add_p("Berikut adalah 6 aturan rekayasa mutlak untuk menjamin antarmuka tidak pernah rusak atau melar:")
    
    add_bullet("Masalah klasik di mana halaman HP bisa digeser ke samping karena ada elemen yang melebihi lebar layar. Solusi: Pada html dan body WAJIB dideklarasikan 'overflow-x: clip; max-width: 100%;'. Gunakan 'clip', BUKAN 'hidden', karena 'hidden' mematikan fungsi CSS position: sticky!", "1. Eliminasi Total Horizontal Overflow (Scrollbar Liar): ")
    add_bullet("Secara default pada spesifikasi CSS, flex items dan grid items memiliki 'min-width: auto'. Ini membuat elemen menolak mengecil jika ada teks panjang atau gambar, merusak layar ponsel. Solusi: Berikan deklarasi '* { min-width: 0; }' pada komponen flex/grid.", "2. Flexbox & Grid Min-Width Bug: ")
    add_bullet("Unit '100vh' konvensional tidak memperhitungkan kemunculan dan hilangnya address bar Safari iOS dan Chrome Android saat digulir, sehingga tombol bawah terpotong. Solusi: Gunakan CSS Dynamic Viewport Units 'min-height: 100dvh;' dengan fallback 'min-height: 100vh;'.", "3. Dynamic Viewport Units (100dvh): ")
    add_bullet("Di Safari iOS, jika input form memiliki ukuran font di bawah 16px, browser akan melakukan zoom-in paksa saat kolom diketuk, merusak zoom halaman. Solusi: Semua elemen form (input, select, textarea) WAJIB memiliki font-size minimal 16px (1rem berbasis base 16px).", "4. Pencegahan Auto-Zoom Paksa iOS Safari: ")
    add_bullet("Tabel HTML konvensional memiliki lebar minimum yang memaksa layar HP melar ke samping. Solusi: Gunakan Card Transformation Pattern. Pada mobile (< 640px), elemen tabel ditransformasikan menjadi display: block bergaya kartu.", "5. Responsive Table Card Transformation: ")
    add_bullet("Zona jangkauan jari jempol satu tangan pada layar ponsel (Thumb-Zone) mengutamakan bagian bawah layar. Letakkan aksi utama (Primary CTA, Filter, Navigasi) di area yang mudah dijangkau tanpa meregangkan jempol ke sudut atas.", "6. Thumb-Zone Ergonomics: ")

    mobile_anti_break_css = """/* css/02-base.css - Standar Anti-Berantakan Mobile-First */
@layer base {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    min-width: 0; /* Mencegah overflow pada elemen flex & grid */
  }

  html, body {
    max-width: 100%;
    overflow-x: clip; /* Membunuh scrollbar horizontal liar tanpa mematikan position: sticky */
  }

  body {
    min-height: 100vh;
    min-height: 100dvh; /* Menyesuaikan dinamis dengan address bar iOS & Android */
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  /* Cegah auto-zoom paksa di iPhone/iPad Safari */
  input, select, textarea, button {
    font-size: 1rem; /* Minimal 16px */
    font-family: inherit;
  }

  /* Responsive Media Mutlak */
  img, picture, svg, video {
    max-width: 100%;
    height: auto;
    display: block;
  }
}"""
    add_code_block(mobile_anti_break_css, "CSS ANTI-BERANTAKAN UNTUK HP & TABLET")

    add_h2("3.4 Pola Transformasi Tabel Responsif Menjadi Kartu di HP")
    add_p("Tabel data keuangan, harga, atau spesifikasi teknis sering menjadi sumber utama layout rusak di smartphone. "
          "Berikut adalah teknik murni CSS native tanpa JavaScript yang mengubah baris tabel menjadi kartu di HP, "
          "dan kembali menjadi tabel tabular formal saat dibuka di tablet atau desktop:")
    
    table_card_css = """/* css/04-components.css - Responsive Table Card Transformation */
@layer components {
  /* Default Mobile: Tabel bertransformasi menjadi susunan Kartu */
  .responsive-table {
    display: block;
    width: 100%;
  }

  .responsive-table thead {
    display: none; /* Sembunyikan header tabel konvensional di HP */
  }

  .responsive-table tbody,
  .responsive-table tr,
  .responsive-table td {
    display: block;
    width: 100%;
  }

  .responsive-table tr {
    margin-bottom: var(--space-md);
    padding: var(--space-sm);
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .responsive-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .responsive-table td:last-child {
    border-bottom: none;
  }

  /* Mengambil judul kolom dari atribut data-label di HTML */
  .responsive-table td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* Tablet & Desktop: Kembali ke struktur Tabel Tabular Formal */
  @media (min-width: 640px) {
    .responsive-table {
      display: table;
      border-collapse: collapse;
    }
    .responsive-table thead {
      display: table-header-group;
    }
    .responsive-table tbody {
      display: table-row-group;
    }
    .responsive-table tr {
      display: table-row;
      margin-bottom: 0;
      box-shadow: none;
    }
    .responsive-table td, 
    .responsive-table th {
      display: table-cell;
      padding: 0.75rem 1rem;
    }
    .responsive-table td::before {
      display: none; /* Sembunyikan pseudo label di desktop */
    }
  }
}"""
    add_code_block(table_card_css, "CARD TRANSFORMATION PATTERN UNTUK TABEL RESPONSIP")

    add_h2("3.5 Design Tokens & Tipografi Fluid Matematis dengan clamp()")
    add_p("Dengan clamp(min, preferred, max), tipografi dan spasi menyesuaikan diri secara mulus di seluruh "
          "rentang resolusi (dari iPhone SE 320px hingga monitor 4K 2560px) tanpa ada lonjakan drastis:")
    
    tokens_code = """/* css/01-tokens.css */
@layer tokens {
  :root {
    /* Brand & Accent Palettes (OKLCH Modern Color Space) */
    --brand-primary: oklch(58% 0.22 255);
    --brand-primary-hover: oklch(52% 0.24 255);
    --bg-surface: oklch(98% 0.01 255);
    --bg-page: oklch(95% 0.01 255);
    --text-primary: oklch(20% 0.03 255);
    --text-muted: oklch(48% 0.04 255);
    --border-color: oklch(88% 0.02 255);

    /* Fluid Typography Matrix */
    --font-size-sm: clamp(0.8125rem, 0.75rem + 0.25vw, 0.875rem);
    --font-size-base: clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem);
    --font-size-h3: clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem);
    --font-size-h2: clamp(1.5rem, 1.25rem + 1vw, 2.25rem);
    --font-size-h1: clamp(2rem, 1.6rem + 2vw, 3.75rem);

    /* Fluid Spacing Matrix */
    --space-xs: clamp(0.5rem, 0.4rem + 0.3vw, 0.75rem);
    --space-sm: clamp(0.75rem, 0.65rem + 0.4vw, 1rem);
    --space-md: clamp(1rem, 0.85rem + 0.6vw, 1.5rem);
    --space-lg: clamp(1.5rem, 1.25rem + 1vw, 2.5rem);
    --space-xl: clamp(2rem, 1.5rem + 2vw, 4rem);

    /* Mobile Ergonomics */
    --touch-target-min: 48px;
    --nav-height: 4rem;
    --radius-md: 0.5rem;
    --radius-full: 9999px;
  }

  [data-theme="dark"] {
    --bg-surface: oklch(18% 0.02 255);
    --bg-page: oklch(12% 0.02 255);
    --text-primary: oklch(96% 0.01 255);
    --text-muted: oklch(68% 0.03 255);
    --border-color: oklch(28% 0.03 255);
  }
}"""
    add_code_block(tokens_code, "DESIGN TOKENS FLUID CLAMP & TOUCH METRICS")

    add_h2("3.6 Modern CSS Container Queries (@container) & Auto-Fit Grid")
    add_p("Untuk komponen kartu yang dapat diletakkan di berbagai container (misalnya di kolom sempit sidebar atau kolom lebar utama), "
          "kita menggunakan Container Queries daripada Media Queries:")
    
    container_code = """/* css/04-components.css */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 480px) {
  .feature-card {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: var(--space-md);
  }
}

/* Auto-Fit Responsive Grid Murni CSS Tanpa Media Query */
.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--space-md);
}"""
    add_code_block(container_code, "CONTAINER QUERIES & AUTO-FIT GRID NATIVE")

    add_h2("3.7 Arsitektur Dark/Light Theme Native Tanpa Kedipan Layar (Zero FOUC)")
    add_p("Untuk menghentikan kedipan putih (FOUC) saat memuat tema gelap di peramban, disematkan skrip mikro sinkronik di dalam tag <head>:")
    
    fouc_code = """<!-- <head> index.html -->
<script>
  (function(){
    const t = localStorage.getItem('theme-preference') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>"""
    add_code_block(fouc_code, "ZERO-FOUC INLINE INITIALIZER")

    # ---------------------------------------------------------
    # BAB 4: KEAMANAN TINGKAT TINGGI (ENTERPRISE SECURITY)
    # ---------------------------------------------------------
    add_h1("BAB 4: KEAMANAN TINGKAT TINGGI (ENTERPRISE NATIVE SECURITY)")
    
    add_h2("4.1 Content Security Policy (CSP Level 3) Ketat")
    add_p("Content Security Policy adalah garis pertahanan terdepan terhadap serangan Cross-Site Scripting (XSS), "
          "Clickjacking, dan injeksi data berbahaya. Blueprint ini menerapkan CSP Level 3 tanpa kompromi, melarang "
          "semua penggunaan 'unsafe-inline' dan 'unsafe-eval' pada lingkungan produksi:")
    
    csp_code = """<!-- Tag Meta CSP di index.html atau via HTTP Response Header -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
">"""
    add_code_block(csp_code, "CONTENT SECURITY POLICY LEVEL 3 CONFIGURATION")

    add_h2("4.2 Strategi Mitigasi XSS Native: Larangan Total innerHTML")
    add_p("Injeksi skrip jahat terjadi ketika input pengguna yang belum dibersihkan dimasukkan ke dalam DOM menggunakan properti innerHTML. "
          "Standar rekayasa pada blueprint ini menetapkan aturan ketat:")
    add_bullet("Gunakan properti .textContent untuk menampilkan data teks dari pengguna ke elemen DOM.", "Aturan 1 (Teks Murni): ")
    add_bullet("Gunakan document.createElement() dan Element.append() untuk membentuk struktur elemen secara aman.", "Aturan 2 (Struktur DOM): ")
    add_bullet("Jika membutuhkan template string, gunakan tag <template> yang di-clone menggunakan Node.cloneNode(true).", "Aturan 3 (Templating): ")
    add_bullet("Jika data HTML kaya harus dirender, gunakan pembersih native berbasis DOMParser dengan whitelist tag ketat.", "Aturan 4 (Sanitasi Khusus): ")

    sanitizer_js_code = """// js/modules/security.js
export function sanitizeHTML(dirtyString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirtyString, 'text/html');
  const allowedTags = ['B', 'I', 'EM', 'STRONG', 'A', 'P', 'UL', 'LI'];
  
  function clean(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.includes(child.tagName)) {
          child.remove();
          continue;
        }
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (child.tagName === 'A' && attr.name === 'href') {
            const url = attr.value.trim().toLowerCase();
            if (url.startsWith('javascript:') || url.startsWith('data:')) {
              child.removeAttribute(attr.name);
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }
        clean(child);
      }
    }
  }
  
  clean(doc.body);
  return doc.body.innerHTML;
}"""
    add_code_block(sanitizer_js_code, "NATIVE SAFE HTML SANITIZER")

    add_h2("4.3 Konfigurasi HTTP Security Headers Standar Enterprise")
    headers_spec = [
        ["Nama Header Keamanan", "Nilai Rekomendasi Produksi", "Tujuan Proteksi"],
        ["Strict-Transport-Security (HSTS)", "max-age=63072000; includeSubDomains; preload", "Memaksa koneksi HTTPS permanen, mencegah SSL stripping."],
        ["X-Content-Type-Options", "nosniff", "Mencegah MIME-type sniffing oleh peramban."],
        ["X-Frame-Options", "DENY", "Mencegah situs dimuat dalam <iframe> untuk meniadakan clickjacking."],
        ["Referrer-Policy", "strict-origin-when-cross-origin", "Mencegah bocornya parameter URL rahasia ke situs luar."],
        ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()", "Menonaktifkan akses hardware sensitif oleh skrip."],
        ["Cross-Origin-Opener-Policy", "same-origin", "Mencegah eksploitasi tab eksternal terhadap jendela memori situs."]
    ]
    add_table_data(headers_spec[0], headers_spec[1:], [2.2, 2.3, 2.0])

    # ---------------------------------------------------------
    # BAB 5: KEANDALAN, AKSESIBILITAS & RESILIENSI
    # ---------------------------------------------------------
    add_h1("BAB 5: KEANDALAN (RELIABILITY), AKSESIBILITAS (A11Y) & RESILIENSI")
    
    add_h2("5.1 Standar Aksesibilitas WCAG 2.2 Level AA Penuh")
    add_p("Aksesibilitas bukan sekadar fitur tambahan, melainkan pondasi keandalan antarmuka modern. "
          "Blueprint ini mewajibkan pemenuhan standar global W3C WCAG 2.2 AA:")
    add_bullet("Kontras warna teks reguler terhadap latar belakang minimal 4.5:1 (diuji via algoritma APCA / WCAG).", "Rasio Kontras: ")
    add_bullet("Struktur dokumen menggunakan elemen landmark resmi: <header>, <nav>, <main id='main-content'>, <section>, <article>, <aside>, dan <footer>.", "Semantik Landmark: ")
    add_bullet("Tautan 'Loncat ke Konten Utama' (Skip Link) disematkan pada baris pertama <body> agar pengguna screen reader dan keyboard dapat langsung melompati bilah navigasi panjang.", "Skip Link Terintegrasi: ")
    add_bullet("Target sentuh interaktif berukuran minimal 48 x 48 CSS pixels dengan jarak pemisah minimal 8px.", "Target Sentuh Ramah Jari: ")

    add_h2("5.2 Resiliensi Jaringan: Service Worker Native Ringan (sw.js)")
    add_p("Dengan Service Worker native berbobot kurang dari 2KB (sw.js), aplikasi memperoleh kemampuan tahan banting (offline resiliency):")
    add_bullet("Aset statis inti (CSS, Font WOFF2, JS modules, Logo SVG) disimpan dalam Cache Storage peramban saat pertama kali dikunjungi.", "Cache-First untuk Aset: ")
    add_bullet("Dokumen HTML dimuat dari jaringan terlebih dahulu untuk memastikan informasi terbaru. Jika koneksi terputus, halaman cadangan offline disajikan dari cache secara instan.", "Network-First untuk HTML: ")
    add_bullet("Komponen banner UI native mendeteksi hilangnya koneksi secara real-time via event navigator.onLine dan memberitahukan pengguna dengan sopan.", "Offline Status Indicator: ")

    # ---------------------------------------------------------
    # BAB 6: OPTIMASI KECEPATAN & CORE WEB VITALS
    # ---------------------------------------------------------
    add_h1("BAB 6: OPTIMASI KECEPATAN EKSTREM & CORE WEB VITALS (PERFORMA 100/100)")
    
    add_h2("6.1 Target Ambang Batas Metrik Kritis (Benchmark 2026)")
    cwv_headers = ["Metrik Core Web Vitals", "Standar 'Good' Google", "Target Standar Blueprint Native", "Dampak pada Pengalaman Pengguna (UX)"]
    cwv_rows = [
        ["LCP (Largest Contentful Paint)", "< 2.5 Detik", "< 1.2 Detik (Instan)", "Konten visual utama langsung tampak tanpa jeda."],
        ["INP (Interaction to Next Paint)", "< 200 Milidetik", "< 80 Milidetik (Sangat Cepat)", "Tombol merespons sentuhan seketika tanpa lag."],
        ["CLS (Cumulative Layout Shift)", "< 0.10", "0.00 (Zero Pergeseran)", "Tidak ada layout melompat yang membuat salah klik."],
        ["FCP (First Contentful Paint)", "< 1.8 Detik", "< 0.7 Detik", "Piksel pertama dirender dalam sekejap mata."],
        ["TTFB (Time to First Byte)", "< 800 Milidetik", "< 180 Milidetik", "Respon server sangat cepat karena ukuran HTML ringkas."]
    ]
    add_table_data(cwv_headers, cwv_rows, [1.8, 1.3, 1.4, 2.0])

    add_h2("6.2 Optimasi Gambar Responsif & Media Art Direction")
    add_p("Penyebab utama Cumulative Layout Shift (CLS) buruk adalah gambar yang tidak memiliki dimensi eksplisit saat diunduh. "
          "Standar implementasi pada blueprint ini:")
    add_bullet("Semua tag <img> dan <video> WAJIB menyertakan atribut width dan height numerik asli.", "Atribut Dimensi Eksplisit: ")
    add_bullet("Gunakan tag <picture> dengan format modern AVIF (kompresi 50% lebih hemat dari JPEG) dan fallback WebP.", "Format Generasi Berikutnya: ")
    add_bullet("Gunakan loading='lazy' untuk semua gambar di bawah fold, dan decoding='async' agar dekompresi piksel tidak memblokir main-thread.", "Lazy Loading Native: ")
    add_bullet("Khusus untuk gambar Hero LCP (di atas fold), WAJIB menggunakan fetchpriority='high' dan TIDAK BOLEH diberi loading='lazy'.", "Prioritas Hero LCP: ")

    media_code = """<picture>
  <source srcset="assets/images/hero.avif" type="image/avif">
  <source srcset="assets/images/hero.webp" type="image/webp">
  <img 
    src="assets/images/hero.jpg" 
    alt="Ilustrasi Arsitektur Antarmuka Native Web Modern" 
    width="1200" 
    height="630" 
    fetchpriority="high"
    decoding="async"
    class="hero-media"
  >
</picture>"""
    add_code_block(media_code, "RESPONSIVE PICTURE DENGAN HIGH-PRIORITY FETCH")

    # ---------------------------------------------------------
    # BAB 7: STRATEGI SEO NATIVE MENYELURUH
    # ---------------------------------------------------------
    add_h1("BAB 7: STRATEGI SEO NATIVE MENYELURUH (MODERN SEO ENGINE)")
    
    add_h2("7.1 Keunggulan Mutlak Arsitektur Native pada Web Crawler")
    add_p("Situs native zero-dependency menyajikan HTML statis semantik lengkap pada respons pertama. "
          "Crawler Googlebot, Bingbot, dan media sosial dapat membaca seluruh teks, heading, tautan, dan schema JSON-LD dalam hitungan milidetik. "
          "Hasilnya: indeks lebih cepat, peringkat lebih tinggi, dan snippet hasil pencarian selalu mutakhir tanpa harus antre di render pool bot.")

    add_h2("7.2 Structured Data Schema.org (JSON-LD Native)")
    add_p("Untuk memperoleh fitur kaya hasil pencarian (Rich Snippets, Sitelinks Searchbox, FAQ Dropdowns di Google), "
          "data terstruktur berformat JSON-LD disematkan langsung di dalam <head>:")
    
    schema_code = """<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com/",
      "name": "Enterprise Native UI/UX",
      "description": "Pusat Arsitektur Web Modern Tanpa Dependensi"
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/#webpage",
      "url": "https://example.com/",
      "name": "Enterprise Blueprint UI/UX Zero-Dependency & Mobile-First",
      "isPartOf": { "@id": "https://example.com/#website" },
      "inLanguage": "id-ID"
    }
  ]
}
</script>"""
    add_code_block(schema_code, "NATIVE SCHEMA.ORG JSON-LD (WEBSITE & WEBPAGE)")

    # ---------------------------------------------------------
    # BAB 8: INTEGRITAS TAUTAN & TATA KELOLA NAVIGASI
    # ---------------------------------------------------------
    add_h1("BAB 8: INTEGRITAS TAUTAN & TATA KELOLA NAVIGASI (LINK INTEGRITY)")
    
    add_h2("8.1 Keamanan Tautan Eksternal: Proteksi Serangan 'Reverse Tabnabbing'")
    add_bullet("Setiap tautan eksternal ke domain luar WAJIB menyertakan rel='noopener noreferrer'.", "Aturan Wajib Tautan Eksternal: ")
    add_bullet("Modul Link Sentinel native di JavaScript secara otomatis memeriksa dan menyematkan atribut ini jika ada pengembang yang lupa menuliskannya di HTML.", "Sentinel Penjaga Otomatis: ")

    add_h2("8.2 Client-Side Routing Native dengan Native View Transitions API")
    add_p("Browser modern menyediakan View Transitions API (document.startViewTransition) yang dipadukan dengan History API:")
    
    router_code = """// js/modules/router.js
export function initRouter() {
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    const isInternal = href && href.startsWith('/') && !href.startsWith('//');
    const isStandardClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    
    if (isInternal && isStandardClick && !link.hasAttribute('download')) {
      event.preventDefault();
      navigateTo(href);
    }
  });

  window.addEventListener('popstate', () => {
    renderRoute(window.location.pathname, false);
  });
}

async function navigateTo(url) {
  if (document.startViewTransition) {
    document.startViewTransition(async () => {
      await renderRoute(url, true);
    });
  } else {
    await renderRoute(url, true);
  }
}

async function renderRoute(url, push = true) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Halaman tidak ditemukan');
    const htmlText = await res.text();
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlText, 'text/html');
    
    document.title = newDoc.title;
    const newContent = newDoc.querySelector('#main-content');
    const currentContent = document.querySelector('#main-content');
    if (newContent && currentContent) {
      currentContent.replaceWith(newContent);
    }
    
    if (push) history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    window.location.href = url;
  }
}"""
    add_code_block(router_code, "NATIVE SPA ROUTER DENGAN VIEW TRANSITIONS API")

    add_h2("8.3 Ergonomi Navigasi Anchor Internal & Solusi Navbar Fixed")
    add_p("CSS modern menyelesaikan masalah judul tertutup navbar sticky saat mengklik tautan loncat anchor secara native:")
    
    scroll_margin_css = """/* css/03-layout.css */
html {
  scroll-behavior: smooth;
}

[id] {
  scroll-margin-top: calc(var(--nav-height, 4rem) + 1.25rem);
}"""
    add_code_block(scroll_margin_css, "NATIVE ANCHOR SCROLL OFFSET SOLUTION")

    # ---------------------------------------------------------
    # BAB 9: TEMPLATE KODE ARKETIPE PRODUKSI LENGKAP
    # ---------------------------------------------------------
    add_h1("BAB 9: TEMPLATE KODE ARKETIPE PRODUKSI MOBILE-FIRST LENGKAP")
    
    add_h2("9.1 Arketipe: index.html (Mobile-First Semantik)")
    add_p("Dokumen HTML siap pakai dengan struktur landmark lengkap, skip-link, drawer menu responsif, dan zero-FOUC theme handler:")
    
    index_html_snippet = """<!DOCTYPE html>
<html lang="id" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Content Security Policy Level 3 -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  ">

  <!-- Primary SEO Metadata -->
  <title>Enterprise Native Web UI/UX | Standar Mobile-First Zero Dependency</title>
  <meta name="description" content="Arsitektur web native berkinerja tinggi, responsif anti-berantakan di HP dan tablet, aman, dan aksesibel.">
  <link rel="canonical" href="https://example.com/">
  <meta name="robots" content="index, follow">

  <!-- Social Graph (OpenGraph & Twitter) -->
  <meta property="og:title" content="Enterprise Native Web UI/UX">
  <meta property="og:description" content="Solusi web modern zero dependency dengan Core Web Vitals prima.">
  <meta property="og:image" content="https://example.com/assets/images/og-cover.jpg">
  <meta property="og:url" content="https://example.com/">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Zero-FOUC Theme Script -->
  <script>
    (function(){
      const t = localStorage.getItem('theme-preference') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', t);
    })();
  </script>

  <!-- Master Stylesheet Native -->
  <link rel="stylesheet" href="css/main.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Loncat ke Konten Utama</a>

  <header class="site-header">
    <div class="container header-container">
      <a href="/" class="brand-logo" aria-label="Beranda Enterprise Native">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
        <span>NATIVE CORE</span>
      </a>

      <!-- Drawer Navigasi Mobile yang Bertransformasi di Desktop -->
      <nav id="site-navigation" class="site-nav" aria-label="Navigasi Utama">
        <ul class="nav-list">
          <li><a href="#features" class="nav-link">Keunggulan</a></li>
          <li><a href="#architecture" class="nav-link">Arsitektur</a></li>
          <li><a href="#table-demo" class="nav-link">Tabel Responsif</a></li>
          <li><a href="#security" class="nav-link">Keamanan</a></li>
        </ul>
      </nav>

      <div class="header-actions">
        <button id="theme-toggle" class="btn-icon" aria-label="Ubah Tema Tampilan">
          <span aria-hidden="true">🌓</span>
        </button>
        <button id="nav-toggle" class="btn-icon mobile-only" aria-expanded="false" aria-controls="site-navigation" aria-label="Buka Menu Navigasi">
          <span class="hamburger" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </header>

  <main id="main-content">
    <section class="hero-section">
      <div class="container">
        <span class="badge">NATIVE PLATFORM v3.0</span>
        <h1 class="hero-title">Kecepatan Ekstrem, Responsif Sempurna, Nol Dependensi.</h1>
        <p class="hero-desc">Membangun antarmuka web skala enterprise menggunakan potensi murni platform web modern tanpa membebani browser dengan ratusan package pihak ketiga.</p>
        <div class="hero-cta">
          <a href="#architecture" class="btn btn-primary">Pelajari Blueprint</a>
          <a href="https://github.com/example" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Kode Sumber</a>
        </div>
      </div>
    </section>

    <!-- Demo Tabel Responsif yang Berubah Jadi Kartu di HP -->
    <section id="table-demo" class="section">
      <div class="container">
        <h2 class="section-title">Matriks Responsif Teruji</h2>
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Resolusi</th>
              <th>Status Tata Letak</th>
              <th>Kompensasi Viewport</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Resolusi">HP (320px - 639px)</td>
              <td data-label="Status Tata Letak">Single Column Kartu</td>
              <td data-label="Kompensasi Viewport">min-height: 100dvh</td>
            </tr>
            <tr>
              <td data-label="Resolusi">Tablet (640px - 1023px)</td>
              <td data-label="Status Tata Letak">2 Kolom Proporsional</td>
              <td data-label="Kompensasi Viewport">Container Width min(100% - 2rem)</td>
            </tr>
            <tr>
              <td data-label="Resolusi">Desktop (>= 1024px)</td>
              <td data-label="Status Tata Letak">Multi-kolom Penuh</td>
              <td data-label="Kompensasi Viewport">Max Width 75rem Centered</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-container">
      <p>&copy; 2026 Enterprise Native Web Architecture. Standar W3C & WCAG 2.2 AA.</p>
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Kebijakan Privasi</a>
        <a href="/terms" class="footer-link">Syarat & Ketentuan</a>
      </div>
    </div>
  </footer>

  <script type="module" src="js/main.js"></script>
</body>
</html>"""
    add_code_block(index_html_snippet, "INDEX.HTML MOBILE-FIRST LENGKAP")

    add_h2("9.2 Arketipe: main.css (Mobile-First & CSS @layer)")
    add_p("Stylesheet lengkap yang mengimplementasikan Mobile-First default dengan ekspansi bertahap ke tablet dan desktop:")
    
    main_css_snippet = """/* css/main.css */
@layer tokens, base, layout, components, utilities;

@layer tokens {
  :root {
    --brand-primary: #2563eb;
    --brand-primary-hover: #1d4ed8;
    --bg-surface: #ffffff;
    --bg-page: #f8fafc;
    --text-primary: #0f172a;
    --text-muted: #64748b;
    --border-color: #e2e8f0;
    --nav-height: 4rem;
    --radius-md: 0.5rem;
    --radius-full: 9999px;
    --touch-min: 48px;
  }
  [data-theme="dark"] {
    --brand-primary: #3b82f6;
    --bg-surface: #1e293b;
    --bg-page: #0f172a;
    --text-primary: #f8fafc;
    --text-muted: #94a3b8;
    --border-color: #334155;
  }
}

@layer base {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  html, body {
    max-width: 100%;
    overflow-x: clip; /* Mencegah overflow horizontal tanpa mematikan sticky */
  }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: var(--bg-page);
    color: var(--text-primary);
    min-height: 100vh;
    min-height: 100dvh;
    line-height: 1.6;
  }
  input, select, textarea, button {
    font-size: 1rem; /* Minimal 16px untuk mencegah zoom iOS */
  }
}

@layer layout {
  .container {
    width: min(100% - 2rem, 75rem);
    margin-inline: auto;
  }
  .site-header {
    position: sticky;
    top: 0;
    height: var(--nav-height);
    background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border-color);
    z-index: 100;
  }
  .header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
  }
}

@layer components {
  /* Default Mobile: Drawer Navigasi Tersembunyi */
  .site-nav {
    position: fixed;
    top: var(--nav-height);
    right: -100%;
    width: min(80vw, 320px);
    height: calc(100dvh - var(--nav-height));
    background: var(--bg-surface);
    border-left: 1px solid var(--border-color);
    padding: 1.5rem;
    transition: right 0.3s ease;
    box-shadow: -4px 0 12px rgb(0 0 0 / 0.1);
  }
  .site-nav.nav-open {
    right: 0;
  }
  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    list-style: none;
  }

  /* Desktop Upward Enhancement */
  @media (min-width: 768px) {
    .site-nav {
      position: static;
      width: auto;
      height: auto;
      background: transparent;
      border: none;
      padding: 0;
      box-shadow: none;
    }
    .nav-list {
      flex-direction: row;
      gap: 1.5rem;
    }
    .mobile-only {
      display: none !important;
    }
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-min);
    min-width: var(--touch-min);
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: none;
  }
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  .btn-icon {
    width: var(--touch-min);
    height: var(--touch-min);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-full);
    cursor: pointer;
    color: var(--text-primary);
  }
}"""
    add_code_block(main_css_snippet, "STYLES.CSS MOBILE-FIRST DENGAN DRAWER RESPONSIF")

    add_h2("9.3 Arketipe: main.js (Orkestrator Interaktivitas & Keamanan)")
    add_p("JavaScript modular native untuk menangani menu drawer, keyboard trap, dark mode, dan link integrity sentinel:")
    
    main_js_snippet = """// js/main.js
export function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme-preference', next);
  });
}

export function initNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const siteNav = document.getElementById('site-navigation');
  if (!navToggle || !siteNav) return;

  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && siteNav.classList.contains('nav-open')) {
      siteNav.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  });
}

export function initLinkSentinel() {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    const rel = link.getAttribute('rel') || '';
    if (!rel.includes('noopener')) link.setAttribute('rel', (rel + ' noopener noreferrer').trim());
  });
}

export function initServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initLinkSentinel();
  initServiceWorker();
});"""
    add_code_block(main_js_snippet, "MAIN.JS ES MODULES BOOTSTRAP")

    add_h2("9.4 Arketipe: sw.js (Native Service Worker Offline Resiliency)")
    add_p("Service worker native berbobot ringan untuk caching aset statis dan navigasi offline:")
    
    sw_snippet = """// sw.js - Native Service Worker
const CACHE_NAME = 'native-core-v3.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/css/main.css',
  '/js/main.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});"""
    add_code_block(sw_snippet, "SW.JS SERVICE WORKER NATIVE")

    # ---------------------------------------------------------
    # BAB 10: CHECKLIST AUDIT KUALITAS & ROADMAP IMPLEMENTASI
    # ---------------------------------------------------------
    add_h1("BAB 10: CHECKLIST AUDIT KUALITAS, PENGUJIAN HP/TABLET & ROADMAP")
    
    add_h2("10.1 Matriks Audit Kesiapan Rilis Mobile-First (QA Gate)")
    qa_headers = ["Kategori Audit", "Kriteria Keberhasilan Kritis", "Instrumen Verifikasi Mandiri", "Status Kelayakan"]
    qa_rows = [
        ["Respon HP 320px", "Halaman bebas scrollbar horizontal, teks membungkus rapi, tombol >= 48px, tidak melar.", "Chrome DevTools Device Mode (320px)", "MANDATORI (Wajib Lulus)"],
        ["Respon Tablet 768px", "Grid 2 kolom rapi, jarak spasi proporsional, navbar beralih mulus tanpa tumpang tindih.", "iPad / Android Tablet Viewport Mode", "MANDATORI (Wajib Lulus)"],
        ["Keamanan (Security)", "Strict CSP Level 3 aktif, 0 innerHTML dengan input user, semua link eksternal memiliki rel='noopener'.", "Google CSP Evaluator & Mozilla Observatory", "MANDATORI (Wajib Lulus)"],
        ["Kecepatan (CWV)", "LCP < 1.2s, INP < 80ms, CLS = 0.00, seluruh gambar memiliki atribut width & height, font WOFF2 lokal.", "Google Lighthouse (Skor 100/100)", "MANDATORI (Wajib Lulus)"],
        ["Aksesibilitas (A11Y)", "WCAG 2.2 AA compliant, kontras rasio minimal 4.5:1, skip link aktif, navigasi keyboard penuh.", "Axe DevTools Extension & Screen Reader", "MANDATORI (Wajib Lulus)"],
        ["SEO & Sosial", "H1 unik, meta description akurat, OpenGraph lengkap, schema JSON-LD tervalidasi tanpa error.", "Schema.org Validator & Rich Results Test", "MANDATORI (Wajib Lulus)"]
    ]
    add_table_data(qa_headers, qa_rows, [1.4, 2.3, 1.6, 1.2])

    add_callout(
        "Dengan menerapkan disiplin Mobile-First, arsitektur Web Native menjamin tampilan sempurna di seluruh "
        "perangkat (HP, Tablet, Desktop) tanpa pernah bergantung pada pustaka eksternal yang rentan dan boros memori.",
        title="Pernyataan Akhir Arsitektur",
        theme="green"
    )

    doc.save(output_path)
    print(f"[OK] Berhasil memperbarui blueprint DOCX di: {output_path}")

if __name__ == "__main__":
    target = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".docs", "BLUEPRINT_UI_UX_ZERO_DEPENDENCY_NATIVE.docx"))
    create_blueprint_docx(target)
