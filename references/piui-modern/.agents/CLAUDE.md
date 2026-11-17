# CLAUDE.md - System & Engineering Guidelines for Claude
## Project Architecture: Zero-Dependency Native Web & Strict Mobile-First (v3.2)

This document contains authoritative system instructions for **Anthropic Claude** when reading, planning, modifying, or creating code in this project. Claude must strictly adhere to these rules without exception.

---

### Core Principles
1. **Zero External Dependencies**:
   - Never import, suggest, or add NPM packages, node_modules, or external CDNs (no React, Vue, jQuery, Bootstrap, Tailwind, Axios, GSAP, Lenis, etc.).
   - The entire stack is pure **HTML5 Living Standard**, **Modern CSS**, and **ES2024+ Vanilla JavaScript**.
   - No build tools required (no Webpack, Vite, Rollup, Babel, Parcel). The project runs natively in any standard modern browser.

2. **Strict Mobile-First Responsive Architecture**:
   - **Baseline Default**: All CSS outside media queries represents mobile screens (320px–390px).
   - **Never Use `@media (max-width)`**: Upward progressive enhancement only using `@media (min-width: ...)`.
     * Default Mobile: `< 640px` (Single column vertical stack, 100% width, >= 48px touch targets, hidden drawer).
     * Tablet Portrait (`sm`): `@media (min-width: 640px)` (2-column grids start, 1.5rem margin).
     * Tablet Landscape (`md`): `@media (min-width: 768px)` (2-3 columns, semi-desktop navigation).
     * Desktop Standard (`lg`): `@media (min-width: 1024px)` (Full horizontal navbar, 1024px max container).
     * Large Desktop (`xl`): `@media (min-width: 1280px)` (75rem / 1200px max container).
   - **Horizontal Overflow Prevention**:
     * Mandatory on root: `html, body { max-width: 100%; overflow-x: clip; }`. Never use `hidden` as it breaks `position: sticky`.
     * Mandatory on flex/grid items: `min-width: 0;` to prevent child overflow blowouts.
     * Mandatory on media: `max-width: 100%; height: auto; display: block;`.
   - **Dynamic Viewport Height**:
     * Never use `height: 100vh` on full-screen containers.
     * Always use `min-height: 100vh; min-height: 100dvh;` to handle dynamic mobile browser address bars.
   - **Mobile Touch & Form Ergonomics**:
     * Minimum touch target: `48px x 48px` (`min-height: 48px; min-width: 48px;`).
     * Form inputs font size: Minimum `16px` (`1rem`) to prevent iOS Safari auto-zoom distortions.
   - **Table Card Transformation**:
     * On mobile (< 640px), tables must collapse into stacked cards (`display: block;` on `table, tbody, tr, td`, hide `thead`, and use `td::before { content: attr(data-label); }`).
     * At `>= 640px`, switch back to `display: table;`.

3. **CSS Architecture (@layer & Tokens)**:
   - Use CSS Cascading Layers: `@layer tokens, base, layout, components, utilities;`.
   - Store design tokens in `:root` inside `@layer tokens` (colors, spacing, elevations).
   - Fluid typography and spacing using `clamp(min, preferred, max)` formula.
   - Stylesheet loading: Always link directly via `<link rel="stylesheet" href="css/main.css">`. Never use preload hacks with inline onload scripts blocked by CSP.

4. **Enterprise Security Standards**:
   - **Strict CSP Level 3**: No `unsafe-inline` or `unsafe-eval` in production scripts.
   - **Zero `innerHTML` with Dynamic Input**: Always use `textContent`, `document.createElement()`, or the native `DOMParser` sanitizer in `js/modules/security.js`.
   - **Link Security**: Every `target="_blank"` link MUST have `rel="noopener noreferrer"`.
   - **Forms Anti-Spam**: Native hidden honeypot field (`position: absolute; left: -9999px;`) and HTML5 constraints.

5. **Accessibility (WCAG 2.2 Level AA)**:
   - Semantic landmarks: `<header>`, `<nav>`, `<main id="main-content">`, `<section>`, `<article>`, `<aside>`, `<footer>`.
   - Skip to content link as the very first element in `<body>`.
   - Keyboard focus rings: Use `:focus-visible`.
   - Modal / Drawer navigation: Implement focus trapping and `Escape` key listeners.

6. **Performance & Core Web Vitals (CWV)**:
   - Explicit `width` and `height` on all `<img>` and `<video>` tags to guarantee `CLS = 0.00`.
   - LCP image: High-priority `<picture>` element with `fetchpriority="high"`, `decoding="async"`, and NO `loading="lazy"`.
   - Event listeners: Use `{ passive: true }` on `scroll` and `touchstart`. Single event delegation for card/button groups.
   - Lightweight native Service Worker (`sw.js`) for offline resilience.

7. **Clean Folder & File Structure**:
   - Root folder contains only standard web platform files: `index.html`, `gallery.html`, `pricing.html`, `about.html`, `contact.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`.
   - **Documentation & Blueprints (`.docs/`)**: All architecture blueprints (*DOCX*), specifications, and planning documents live in `.docs/`.
   - **AI Rules (`.agents/`)**: All AI rule files live inside `.agents/` (`GEMINI.md`, `CLAUDE.md`, `CHATGPT.md`, `CURSORRULES.md`).
   - **Internal & Developer Tools**: `.scripts/` (automation tools), `.references/` (media/video reference).
   - **Production Subdirectories**: `css/`, `js/`, `assets/`.
