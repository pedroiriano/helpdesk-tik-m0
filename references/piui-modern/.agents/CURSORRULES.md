# CURSORRULES.md - Universal AI Agent Instructions
## Cursor, Windsurf, Copilot, and Autonomous Coding Agents

# Core Directives:
1. ZERO THIRD-PARTY DEPENDENCIES: Never install or import npm packages, node_modules, or external CDNs. All UI/UX must use native W3C web standards (HTML5, Modern CSS, ES2024+ Vanilla JS).
2. STRICT MOBILE-FIRST:
   - Base CSS outside media queries is strictly for narrow mobile screens (320px–390px).
   - NEVER use @media (max-width: ...). ONLY use @media (min-width: ...):
     * Base: < 640px (1 column, 100% width, min 48px touch targets)
     * Tablet (sm): @media (min-width: 640px)
     * Tablet Landscape (md): @media (min-width: 768px)
     * Desktop (lg): @media (min-width: 1024px)
     * Large Desktop (xl): @media (min-width: 1280px)
   - Zero horizontal overflow:
     * html, body { max-width: 100%; overflow-x: clip; } (Never overflow-x: hidden)
     * All flex/grid items: min-width: 0;
     * All media: max-width: 100%; height: auto; display: block;
   - Dynamic Viewport: min-height: 100vh; min-height: 100dvh;
   - Minimum font-size on inputs: 16px (1rem) to prevent iOS Safari auto-zoom.
   - Tables must collapse to card layout on mobile (< 640px).
3. MODERN CSS:
   - Use @layer tokens, base, layout, components, utilities;
   - Tokens in :root with fluid sizing clamp().
   - Load stylesheet directly via <link rel="stylesheet" href="css/main.css">.
4. ENTERPRISE SECURITY:
   - Strict CSP Level 3.
   - Zero innerHTML with user input (use textContent or native DOMParser sanitizer).
   - External links MUST have rel="noopener noreferrer".
   - Form honeypot anti-spam protection.
5. ACCESSIBILITY & CORE WEB VITALS:
   - WCAG 2.2 AA (4.5:1 contrast, landmarks, skip link, 48px touch target).
   - CLS = 0.00 (explicit width/height on all media).
   - LCP < 1.2s (picture tag with AVIF/WebP, fetchpriority="high" on hero).
   - Offline Service Worker (sw.js).
6. DIRECTORY HYGIENE:
   - All AI rules live inside .agents/.
   - Root folder contains only standard web platform files and HTML pages.
