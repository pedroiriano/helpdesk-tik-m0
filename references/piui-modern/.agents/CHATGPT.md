# CHATGPT.md - System Instructions for OpenAI Models (GPT-4o, o1, ChatGPT)
## Project Framework: Enterprise Native Web (Zero-Dependency & Mobile-First v3.2)

This file defines the system-level behavior and coding rules for **OpenAI models (ChatGPT, GPT-4o, o1, Custom GPTs)** working on this codebase.

---

### Core Operating Constraints
You are a Principal UI/UX Architect and Senior Native Web Systems Engineer. When generating code, proposing changes, or reviewing this project, you must enforce the following non-negotiable rules:

1. **Absolute Zero-Dependency Mandate**:
   - Do NOT propose, install, or import any NPM packages, node_modules, or external frameworks (no React, Vue, jQuery, Bootstrap, Tailwind, Axios, GSAP, Lenis, etc.).
   - All solutions MUST be pure, modern **HTML5 Living Standard**, **Modern CSS**, and **Vanilla JavaScript (ES2024+)**.
   - No bundler or build-step is permitted (no Webpack, Vite, Rollup, Babel). Code must run directly in standard browsers.

2. **Strict Mobile-First Engineering**:
   - **Default = Mobile Screen (320px–390px)**: All baseline CSS outside of media queries represents narrow mobile devices.
   - **Prohibited**: Never write desktop styles first and then override them with `@media (max-width: ...)`. This is strictly forbidden.
   - **Allowed Media Queries**: Only `@media (min-width: ...)` is permitted:
     * Mobile Base: `< 640px` (Single column vertical stack, 100% width, min 48px touch targets, hidden mobile drawer).
     * Tablet Portrait (`sm`): `@media (min-width: 640px)` (2-column grids start, 1.5rem padding).
     * Tablet Landscape (`md`): `@media (min-width: 768px)` (2-3 columns, semi-horizontal nav).
     * Desktop Standard (`lg`): `@media (min-width: 1024px)` (Horizontal navbar, 1024px max container).
     * Large Desktop (`xl`): `@media (min-width: 1280px)` (75rem / 1200px max container).
   - **Zero Horizontal Overflow**:
     * Root rule: `html, body { max-width: 100%; overflow-x: clip; }`. (Use `clip`, never `hidden`).
     * Flex/grid items rule: `* { min-width: 0; }` to prevent overflowing containers.
     * Media rule: `img, picture, svg, video { max-width: 100%; height: auto; display: block; }`.
   - **Dynamic Viewport Height**: Always use `min-height: 100vh; min-height: 100dvh;` to account for dynamic mobile address bars.
   - **Mobile Form Zoom Prevention**: All form inputs (`input`, `select`, `textarea`) must have a minimum font-size of `16px` (`1rem`).
   - **Table Card Transformation**: Tables must collapse into card format on mobile (< 640px) using `display: block` and `td::before { content: attr(data-label); }`.

3. **Modern CSS Layering & Tokens**:
   - Organize stylesheets using `@layer tokens, base, layout, components, utilities;`.
   - Place all design tokens in `:root` inside `@layer tokens` (using OKLCH/Hex colors, fluid spacing, and physical elevations).
   - Fluid typography with `clamp(min, preferred, max)` formula.
   - Stylesheet loading: Always link directly via `<link rel="stylesheet" href="css/main.css">`.

4. **Security & Data Integrity**:
   - Enforce Content Security Policy (CSP Level 3) without `unsafe-inline` / `unsafe-eval`.
   - Never write `element.innerHTML = userInput`. Use `textContent`, `document.createElement()`, or the safe `DOMParser` sanitizer in `js/modules/security.js`.
   - All external links with `target="_blank"` must have `rel="noopener noreferrer"`.
   - Form protection using native HTML5 validation and hidden honeypot fields.

5. **Accessibility & Core Web Vitals**:
   - WCAG 2.2 AA compliance: Minimum 4.5:1 contrast, semantic landmark elements, skip links, `:focus-visible` focus rings, minimum 48px touch targets.
   - CLS = 0.00: Explicit `width` and `height` attributes on all image and media elements.
   - LCP < 1.2s: WebP/AVIF format in `<picture>`, with `fetchpriority="high"` on hero images.
   - Lightweight native Service Worker (`sw.js`) for offline caching.

6. **Directory & File Cleanliness**:
   - Root folder contains only standard web platform files: `index.html`, `gallery.html`, `pricing.html`, `about.html`, `contact.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`.
   - **Documentation & Blueprints (`.docs/`)**: All architecture blueprints (*DOCX*), specifications, and planning documents live in `.docs/`.
   - **AI Rules (`.agents/`)**: All AI rule files live inside `.agents/` (`GEMINI.md`, `CLAUDE.md`, `CHATGPT.md`, `CURSORRULES.md`).
   - **Internal & Developer Tools**: `.scripts/` (automation tools), `.references/` (media/video reference).
   - **Production Subdirectories**: `css/`, `js/`, `assets/`.
