# PUSAT DOKUMENTASI DAN RANCANGAN ARSITEKTUR (.docs/)

Folder `.docs/` memuat seluruh dokumen cetak biru (*blueprint*), rancangan arsitektur, dan spesifikasi implementasi proyek:

1. **[BLUEPRINT_UI_UX_ZERO_DEPENDENCY_NATIVE.docx](file:///d:/Proyek/UI%20UX/Landing%20Page/modern/.docs/BLUEPRINT_UI_UX_ZERO_DEPENDENCY_NATIVE.docx)**  
   *Master Architectural Document (Production Grade v3.2)*. Memuat 10 Bab komprehensif mulai dari filosofi zero-dependency, arsitektur CSS `@layer`, rancangan Mobile-First ketat (anti-pecah di HP & tablet), standar keamanan enterprise CSP L3, Core Web Vitals, SEO modern, hingga arketipe kode produksi lengkap.

2. **[VAYRA_STUDIO_CLONE_BLUEPRINT.md](file:///d:/Proyek/UI%20UX/Landing%20Page/modern/.docs/VAYRA_STUDIO_CLONE_BLUEPRINT.md)**  
   *Rancangan & Analisis Rekayasa Replikasi UI/UX Vayra (https://vayra-preview.pages.dev/)*. Memuat dekonstruksi lengkap 5 halaman (Landing Page, Gallery & Detail Viewer, Pricing & Sizer, About, Contact), panduan kurasi citra alternatif, dan strategi penggantian GSAP/Lenis menjadi Web Native murni.

---

### Standar Kebersihan Repositori
- **Root Directory**: Hanya memuat file standar platform web (`index.html`, `gallery.html`, `pricing.html`, `about.html`, `contact.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`).
- **.docs/**: Seluruh berkas cetak biru (*blueprint*), dokumen rancangan, dan panduan arsitektur.
- **.agents/**: Seluruh aturan dan panduan agen AI (`GEMINI.md`, `CLAUDE.md`, `CHATGPT.md`, `CURSORRULES.md`).
- **.scripts/**: Skrip otomasi developer (`generate_blueprint.py`, `check_links.py`).
- **.references/**: Folder materi referensi pengguna (jangan diubah).
- **css/**, **js/**, **assets/**: Kode sumber dan aset statis antarmuka produksi.
