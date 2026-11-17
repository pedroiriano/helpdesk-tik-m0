# PANDUAN DAN ATURAN REKAYASA SISTEM AI (GOOGLE GEMINI)
## Standard Operasional Proyek: Web Native, Zero-Dependency & Strict Mobile-First (v3.2)

Dokumen ini adalah instruksi operasional mutlak (*system prompt & engineering rules*) untuk **Google Gemini** saat merancang, merencanakan, menganalisis, dan menulis kode pada repositori ini. Setiap saran, rancangan, dan implementasi yang dihasilkan oleh Gemini **WAJIB** tunduk pada prinsip-prinsip di bawah ini tanpa kecuali.

---

### 1. Landasan Filosofis & Larangan Mutlak (Zero-Dependency)
- **Zero Third-Party Dependency**: DILARANG merekomendasikan, menginstal, atau mengimpor pustaka dari NPM atau CDN eksternal (misal: React, Vue, jQuery, Bootstrap, Tailwind, Axios, GSAP, Lenis, Lodash, FontAwesome). Seluruh fitur harus dibangun murni menggunakan **HTML5 Living Standard**, **Modern CSS**, dan **Vanilla JavaScript (ES2024+)**.
- **No Bundler / No Build Step**: Struktur kode harus dapat langsung dijalankan oleh peramban modern (*browser-native*) tanpa bundler (Webpack, Vite, Rollup, Babel).
- **Zero Supply-Chain Risk**: Semua fungsionalitas harus menggunakan API native peramban resmi (W3C/WHATWG).

---

### 2. Aturan Mutlak Tata Letak: Strict Mobile-First (Anti-Pecah di HP & Tablet)
Ketika Gemini merancang atau mengedit file CSS/HTML, aturan berikut adalah **MANDATORI**:

#### A. Upward Progression Saja (Haram `@media (max-width)`)
- Seluruh kode CSS di luar media query adalah gaya bawaan (*default*) untuk layar **ponsel kecil (320px - 390px)**.
- **DILARANG KERAS** menggunakan `@media (max-width: ...)`.
- Satu-satunya media query untuk tata letak adalah `@media (min-width: ...)`:
  - `Base (Default)`: HP Sempit (< 640px) — Single column vertikal, 100% width, target sentuh >= 48px, drawer navigation.
  - `@media (min-width: 640px)`: Tablet Portrait (`sm`) — Grid 2-kolom dimulai, margin 1.5rem.
  - `@media (min-width: 768px)`: Tablet Landscape (`md`) — Grid 2-3 kolom, drawer beralih ke semi-desktop/horizontal.
  - `@media (min-width: 1024px)`: Desktop Standar (`lg`) — Horizontal navigation bar penuh, multi-kolom, container 1024px.
  - `@media (min-width: 1280px)`: Large Desktop (`xl`) — Container max 75rem (1200px) terpusat.

#### B. Eliminasi Total Horizontal Scrollbar Liar di HP
- Pada `html` dan `body`, WAJIB menyertakan:
  ```css
  html, body {
    max-width: 100%;
    overflow-x: clip; /* Gunakan clip, JANGAN hidden agar position: sticky tetap aktif */
  }
  ```
- Pada semua elemen flex dan grid: WAJIB menyertakan `min-width: 0` agar teks panjang tidak memaksa kontainer melar melebihi lebar layar HP.
- Semua elemen media: WAJIB menyertakan `max-width: 100%; height: auto; display: block;`.

#### C. Penanganan Viewport Dinamis (100dvh)
- **JANGAN PERNAH** menggunakan `height: 100vh` murni untuk layar penuh mobile (karena terpotong oleh address bar Safari iOS & Chrome Android).
- **WAJIB** menggunakan:
  ```css
  min-height: 100vh; /* Fallback untuk browser lama */
  min-height: 100dvh; /* Dynamic viewport height modern */
  ```

#### D. Ergonomi Sentuh & Pencegahan Zoom iOS
- Semua target sentuh (tombol, ikon, tautan): WAJIB memiliki ukuran fisik minimal **48 x 48 CSS pixels** (`min-height: 48px; min-width: 48px`).
- Semua elemen formulir (`input`, `select`, `textarea`): WAJIB memiliki `font-size: 1rem` (minimal **16px**) untuk mencegah Safari iOS melakukan zoom paksa otomatis yang merusak tata letak.

#### E. Pola Tabel Responsif (Card Transformation)
- Jika membuat tabel data, WAJIB menerapkan pola transformasi kartu di mobile:
  - Di layar HP (< 640px): `display: block` untuk table, tr, td. Sembunyikan `thead`, dan gunakan `td::before { content: attr(data-label); }`.
  - Di layar tablet/desktop (>= 640px): Kembalikan ke `display: table`.

---

### 3. Arsitektur CSS Modern (@layer & Design Tokens)
- Seluruh CSS diorganisasikan menggunakan fitur resmi **CSS Cascading Layers (`@layer`)**:
  ```css
  @layer tokens, base, layout, components, utilities;
  ```
- **Design Tokens**: Simpan semua token (warna OKLCH/Hex, bayangan, radius, spasi fluid) di `:root` dalam `@layer tokens`.
- **Fluid Typography & Spacing**: Gunakan fungsi matematis `clamp(min, preferred, max)` untuk skalabilitas mulus tanpa media query berlebih.
- **Pemuatan Stylesheet**: WAJIB menggunakan `<link rel="stylesheet" href="css/main.css">` standar. DILARANG menggunakan hack `rel="preload"` dengan inline `onload` yang diblokir oleh CSP.

---

### 4. Standar Keamanan Enterprise (Enterprise Hardened)
- **Larangan Total `innerHTML`**: DILARANG menggunakan `element.innerHTML = userInput`. Gunakan `textContent`, `document.createElement()`, atau fungsi sanitasi native `DOMParser` yang ada di `js/modules/security.js`.
- **Content Security Policy (CSP Level 3)**: Selalu patuhi direktif ketat tanpa `unsafe-inline` / `unsafe-eval` pada skrip produksi.
- **Integritas Tautan Eksternal**: Setiap tautan dengan `target="_blank"` **WAJIB** menyertakan `rel="noopener noreferrer"`.
- **Formulir Anti-Spam**: Gunakan teknik native *Honeypot field* (input tersembunyi `display:none; position:absolute; left:-9999px;`) dan native HTML5 validation constraint.

---

### 5. Aksesibilitas WCAG 2.2 Level AA & Keandalan
- Struktur HTML wajib semantik penuh: `<header>`, `<nav>`, `<main id="main-content">`, `<section>`, `<article>`, `<aside>`, `<footer>`.
- Tautan **Skip to Content** (`<a href="#main-content" class="skip-link">`) wajib berada di baris pertama `<body>`.
- Navigasi keyboard: Gunakan `:focus-visible` dengan cincin fokus kontras tinggi.
- Drawer/Modal: Terapkan *Focus Trap* dan tombol penutup menggunakan tombol keyboard `Escape`.
- Selalu sediakan fallback offline ringan via Service Worker native (`sw.js`).

---

### 6. Kecepatan & Core Web Vitals (Google CWV 2026)
- **CLS = 0.00**: Semua elemen `<img>`, `<picture>`, dan `<video>` WAJIB menyertakan atribut `width` dan `height` numerik asli.
- **LCP < 1.2s**: Gunakan format gambar generasi terbaru (AVIF & WebP) via tag `<picture>`. Gambar Hero LCP WAJIB diberi `fetchpriority="high"` dan DILARANG diberi `loading="lazy"`.
- **Passive Listeners**: Gunakan `{ passive: true }` pada event `scroll` dan `touchstart`.

---

### 7. Standar Kebersihan Folder & File (Root Hygiene)
- **Root Folder**: Hanya diperbolehkan memuat file standar platform dan dokumen web utama:
  `index.html`, `gallery.html`, `pricing.html`, `about.html`, `contact.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`.
- **Folder Tata Kelola & Pengembangan (Hidden Dot-Folders)**:
  - `.docs/`: Seluruh berkas cetak biru (*blueprint DOCX*), diagram, dan spesifikasi arsitektur disimpan di `.docs/`.
  - `.agents/`: Seluruh aturan agen AI ditempatkan di `.agents/` (`GEMINI.md`, `CLAUDE.md`, `CHATGPT.md`, `CURSORRULES.md`).
  - `.scripts/`: Skrip otomasi developer (generator, linter, link checker).
  - `.references/`: Folder referensi media/video pengguna (jangan dihapus atau dimodifikasi).
- **Subdirektori Produksi Aplikasi**:
  - `css/`: File stylesheet terisolasi per layer (@layer).
  - `js/`: File entrypoint `main.js` dan subfolder `modules/`.
  - `assets/`: Folder `fonts/`, `icons/`, `images/`.
- Dilarang membuat skrip uji sementara atau berkas dump di root directory!
