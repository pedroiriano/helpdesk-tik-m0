import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await import('../js/modules/detail-pages.js');

const root = process.cwd();
const catalog = globalThis.COURTSPEC_DETAIL_CATALOG;
if (!catalog) throw new Error('Canonical detail catalog is unavailable.');

const typeContent = {
  play: {
    contextEyebrow: 'Frame & context', contextTitle: 'Movement evidence',
    scopeEyebrow: 'Calibration note', scopeTitle: 'Telemetry contract',
    stepsEyebrow: 'Coaching cues', stepsTitle: 'Review the rep in sequence',
    note: 'Illustrative performance telemetry. It is not a medical, eligibility, or guaranteed-performance assessment.'
  },
  pipeline: {
    contextEyebrow: 'Problem & supported use', contextTitle: 'From capture to coaching decision',
    scopeEyebrow: 'Input & output', scopeTitle: 'Pipeline boundary',
    stepsEyebrow: 'Validation sequence', stepsTitle: 'Prove the workflow before scale',
    note: 'Pipeline outputs require deployment-specific calibration, tolerance, and operating-envelope validation.'
  },
  plan: {
    contextEyebrow: 'Audience & scope', contextTitle: 'What this tier is designed to support',
    scopeEyebrow: 'Commercial assumptions', scopeTitle: 'Plan limits and responsibilities',
    stepsEyebrow: 'Implementation sequence', stepsTitle: 'Move from discovery to an accepted pilot',
    note: 'Prices, quotas, support levels, taxes, overage, and availability are illustrative until confirmed in a signed production scope.'
  },
  principle: {
    contextEyebrow: 'Why it matters', contextTitle: 'A rule for accountable court intelligence',
    scopeEyebrow: 'Implementation rules', scopeTitle: 'Operational guardrails',
    stepsEyebrow: 'Verification evidence', stepsTitle: 'How the principle is demonstrated',
    note: 'A principle becomes a product claim only after representative human and technical validation.'
  },
  brief: {
    contextEyebrow: 'Objective & ownership', contextTitle: 'Define the decision before implementation',
    scopeEyebrow: 'Prerequisites & risk', scopeTitle: 'Acceptance boundary',
    stepsEyebrow: 'Acceptance checklist', stepsTitle: 'Evidence required to proceed',
    note: 'This brief is planning guidance. Production commitments require named owners, approved controls, and test evidence.'
  }
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const rootHref = (value) => {
  if (/^(?:https?:|mailto:|tel:)/.test(value)) return value;
  if (value.startsWith('#')) return value;
  return `../../${value}`;
};

const imageInfo = (path) => {
  const id = path.match(/ball-(\d{2})\.jpg$/)?.[1] || '01';
  return id === '01' ? { id, width: 896, height: 1200 } : { id, width: 1376, height: 768 };
};

const renderPairs = (entries, wrapperClass = '') => entries.map(([label, value]) =>
  `<div${wrapperClass ? ` class="${wrapperClass}"` : ''}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
).join('');

function responsiveImage(record) {
  const { id, width, height } = imageInfo(record.image);
  return `<picture>
    <source type="image/avif" srcset="../../assets/images/optimized/ball-${id}.avif ${width}w" sizes="(min-width: 900px) 43vw, 100vw">
    <source type="image/webp" srcset="../../assets/images/thumbs/card-ball-${id}.webp 640w, ../../assets/images/optimized/ball-${id}.webp ${width}w" sizes="(min-width: 900px) 43vw, 100vw">
    <img src="../../assets/images/optimized/ball-${id}.webp" width="${width}" height="${height}" fetchpriority="high" alt="${escapeHtml(record.alt)}">
  </picture>`;
}

function nav() {
  const items = [
    ['Start', 'Home', '../../index.html#top', '01'],
    ['Telemetry', 'Playbook Log', '../../gallery.html', '03'],
    ['Access', 'Reps & Tiers', '../../pricing.html', '04'],
    ['Studio', 'Manifesto', '../../about.html', '02'],
    ['Scout inquiries', 'Contact', '../../contact.html', '01'],
    ['Field guide', 'FAQ', '../../index.html#faq', '04']
  ];
  const links = items.map(([seq, label, href, image]) => `<a class="vy-hdr-reel-strip" href="${href}"><span class="vy-hdr-reel-strip__seq">( ${seq} )</span><span class="vy-hdr-reel-strip__head">${label}</span><span class="vy-hdr-reel-strip__chip" aria-hidden="true"><img src="../../assets/images/thumbs/nav-ball-${image}.webp" width="240" height="135" loading="lazy" decoding="async" alt=""></span></a>`).join('');
  return `<header id="vy-topbar_glide_frame"><div id="vy-topbar_glide">
    <a class="vy-hdr-glyph" href="../../contact.html" aria-label="Contact CourtSpec"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14"></rect><path d="m3 6 9 7 9-7"></path></svg></a>
    <a class="vy-hdr-brand" href="../../index.html#top" aria-label="CourtSpec home">COURTSPEC</a>
    <button class="vy-hdr-glyph vy-hdr-burger" id="vy-topbar-glide-panel-btn" type="button" aria-expanded="false" aria-controls="vy-topbar-glide-flyout" aria-label="Open navigation menu"><svg class="vy-hdr-bun-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 16h14"></path></svg></button>
  </div><nav class="vy-hdr-flyout" id="vy-topbar-glide-flyout" aria-hidden="true" aria-label="Site Navigation"><div class="vy-hdr-panel-deck"><div class="vy-hdr-panel-strips">${links}</div></div></nav></header>`;
}

function footer() {
  return `<footer class="vy-footer" id="site-footer"><div class="vy-tail-case"><div class="vy-tail-mid"><div class="vy-tail-top"><nav class="vy-tail-paths" aria-label="Footer Navigation"><a href="../../index.html#top">Home</a><a href="../../gallery.html">Playbook</a><a href="../../pricing.html">Reps &amp; Tiers</a><a href="../../about.html">Manifesto</a><a href="../../contact.html">Scout Contact</a></nav><div class="vy-tail-asset"><img src="../../assets/images/thumbs/card-ball-01.webp" width="640" height="857" loading="lazy" decoding="async" alt="Basketball detail"></div></div><p class="vy-tail-biz"><b>COURTSPEC</b> &mdash; Elite Basketball Biomechanics, Scouting &amp; Hardwood Telemetry Studio<br><a href="mailto:scout@courtspec.io">scout@courtspec.io</a> &middot; Native Zero-Dependency Architecture &middot; Built toward WCAG 2.2 AA</p><div class="vy-tail-share"><a href="#main-content">Back to top &uarr;</a><a href="../../gallery.html">Playbook Log</a><a href="../../pricing.html">Reps Sizer</a><a href="../../about.html#data-governance">Data &amp; Accessibility</a><a href="../../contact.html">Athlete Dispatch</a></div><p class="vy-tail-stamp">Attack, elevate, finish. Hardwood telemetry precision. &copy; 2026 CourtSpec Studio.</p></div></div></footer>`;
}

function page(kind, config, record, index) {
  const copy = typeContent[kind];
  const previous = config.records[(index - 1 + config.records.length) % config.records.length];
  const next = config.records[(index + 1) % config.records.length];
  const canonical = `https://courtspec.io/details/${config.directory}/${record.id}.html`;
  const originHref = rootHref(config.origin[1]);
  const primaryHref = rootHref(record.primary[1]);
  const prose = record.prose.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
  const steps = record.steps.map((text) => `<li>${escapeHtml(text)}</li>`).join('');
  const title = escapeHtml(record.title);
  const summary = escapeHtml(record.summary);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — COURTSPEC</title><meta name="description" content="${summary}">
  <meta name="color-scheme" content="dark"><meta name="theme-color" content="#0A0A0C"><meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article"><meta property="og:title" content="${title} — COURTSPEC"><meta property="og:description" content="${summary}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="COURTSPEC"><meta property="og:image" content="https://courtspec.io/assets/images/courtspec-social.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title} — COURTSPEC"><meta name="twitter:description" content="${summary}"><meta name="twitter:image" content="https://courtspec.io/assets/images/courtspec-social.jpg">
  <link rel="icon" type="image/svg+xml" href="../../assets/icons/favicon.svg"><link rel="manifest" href="../../manifest.webmanifest"><link rel="stylesheet" href="../../css/main.css?v=4.3">
</head><body data-detail-kind="${kind}" data-detail-id="${escapeHtml(record.id)}">
  <a href="#main-content" class="skip-link">Skip to main content</a>${nav()}
  <main id="main-content" class="vy-detail-main vy-detail-main--${kind}">
    <nav class="vy-detail-breadcrumb" aria-label="Breadcrumb" itemscope itemtype="https://schema.org/BreadcrumbList"><span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="${originHref}" itemprop="item"><span itemprop="name">${escapeHtml(config.origin[0])}</span></a><meta itemprop="position" content="1"></span><span aria-hidden="true">/</span><span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span aria-current="page" itemprop="name">${title}</span><meta itemprop="position" content="2"></span></nav>
    <article><header class="vy-detail-hero"><div class="vy-detail-hero__copy"><span class="vy-detail-hero__index">${escapeHtml(record.eyebrow)}</span><h1 class="vy-detail-title">${title}</h1><p class="vy-detail-summary">${summary}</p><div class="vy-detail-actions"><a class="btn btn-primary" href="${primaryHref}">${escapeHtml(record.primary[0])}</a><a class="btn btn-secondary" href="${originHref}">Back to ${escapeHtml(config.origin[0])}</a></div></div><figure class="vy-detail-media">${responsiveImage(record)}<figcaption>${escapeHtml(record.caption)}</figcaption></figure></header>
      <dl class="vy-detail-stats" aria-label="Key detail metrics">${renderPairs(record.stats, 'vy-detail-stat')}</dl>
      <div class="vy-detail-body"><section class="vy-detail-panel vy-detail-prose" aria-labelledby="context-title"><span class="vy-eyebrow">${copy.contextEyebrow}</span><h2 id="context-title">${copy.contextTitle}</h2><div>${prose}</div><p class="vy-detail-context">${copy.note}</p></section><aside class="vy-detail-panel vy-detail-panel--sticky" aria-labelledby="scope-title"><span class="vy-eyebrow">${copy.scopeEyebrow}</span><h2 id="scope-title">${copy.scopeTitle}</h2><dl class="vy-detail-specs">${renderPairs(record.specs)}</dl></aside><section class="vy-detail-panel" aria-labelledby="steps-title"><span class="vy-eyebrow">${copy.stepsEyebrow}</span><h2 id="steps-title">${copy.stepsTitle}</h2><ol class="vy-detail-process">${steps}</ol></section></div>
      <nav class="vy-detail-sequence" aria-label="Browse related details"><p class="vy-detail-sequence__label">Continue through this collection</p><div class="vy-detail-sequence__grid"><a class="vy-detail-next" href="${escapeHtml(previous.id)}.html"><span>Previous</span><strong>${escapeHtml(previous.title)}</strong></a><a class="vy-detail-next" href="${escapeHtml(next.id)}.html"><span>Next</span><strong>${escapeHtml(next.title)}</strong></a></div></nav>
    </article></main>${footer()}
  <script src="../../js/modules/navigation.js?v=4.3" defer></script><script src="../../js/modules/theme.js?v=4.3" defer></script><script src="../../js/modules/reveal.js?v=4.3" defer></script><script src="../../js/modules/link-sentinel.js?v=4.3" defer></script><script src="../../js/main.js?v=4.3" defer></script>
</body></html>`;
}

let count = 0;
const sitemapEntries = [];
for (const [kind, config] of Object.entries(catalog)) {
  const directory = join(root, 'details', config.directory);
  await mkdir(directory, { recursive: true });
  for (let index = 0; index < config.records.length; index += 1) {
    const record = config.records[index];
    await writeFile(join(directory, `${record.id}.html`), page(kind, config, record, index));
    sitemapEntries.push(`  <url><loc>https://courtspec.io/details/${config.directory}/${record.id}.html</loc><lastmod>2026-09-26</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
    count += 1;
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`;
await writeFile(join(root, 'sitemap-details.xml'), sitemap);
console.log(`Generated ${count} differentiated physical detail pages.`);
