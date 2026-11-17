import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const rootPages = ['index.html', 'gallery.html', 'pricing.html', 'about.html', 'contact.html', 'pipeline.html', 'play.html', 'plan.html', 'principle.html', 'brief.html'];
const legacyPages = new Set(['pipeline.html', 'play.html', 'plan.html', 'principle.html', 'brief.html']);
const scripts = {
  'index.html': ['navigation', 'hero-switcher', 'gallery', 'theme', 'reveal', 'metrics-chart', 'pricing-sizer', 'faq', 'link-sentinel'],
  'gallery.html': ['navigation', 'gallery', 'theme', 'reveal', 'link-sentinel'],
  'pricing.html': ['navigation', 'theme', 'reveal', 'pricing-sizer', 'faq', 'link-sentinel'],
  'about.html': ['navigation', 'theme', 'reveal', 'metrics-chart', 'link-sentinel'],
  'contact.html': ['navigation', 'theme', 'reveal', 'contact', 'link-sentinel'],
  'pipeline.html': ['navigation', 'theme', 'reveal', 'link-sentinel', 'detail-pages'],
  'play.html': ['navigation', 'theme', 'reveal', 'link-sentinel', 'detail-pages'],
  'plan.html': ['navigation', 'theme', 'reveal', 'link-sentinel', 'detail-pages'],
  'principle.html': ['navigation', 'theme', 'reveal', 'link-sentinel', 'detail-pages'],
  'brief.html': ['navigation', 'theme', 'reveal', 'link-sentinel', 'detail-pages']
};

const dimensions = {
  '01': [896, 1200], '02': [1376, 768], '03': [1376, 768], '04': [1376, 768]
};

function optimizeImageTag(tag) {
  const match = tag.match(/src="assets\/images\/ball-(\d{2})\.jpg"/);
  if (!match) return tag;
  const id = match[1];
  if (!dimensions[id]) return tag;
  const isNav = /width="240"\s+height="135"/.test(tag);
  const isHeroTab = /width="200"\s+height="125"/.test(tag);
  const isLazy = /loading="lazy"/.test(tag);
  let output = tag;
  if (isNav || isHeroTab) {
    output = output.replace(match[0], `src="assets/images/thumbs/nav-ball-${id}.webp"`)
      .replace(/width="\d+"\s+height="\d+"/, 'width="240" height="135"');
    if (!/loading=/.test(output)) output = output.replace('<img ', '<img loading="lazy" ');
  } else if (isLazy) {
    const [width, height] = id === '01' ? [640, 857] : [640, 357];
    output = output.replace(match[0], `src="assets/images/thumbs/card-ball-${id}.webp"`)
      .replace(/width="\d+"\s+height="\d+"/, `width="${width}" height="${height}"`);
  } else {
    const [width, height] = dimensions[id];
    output = output.replace(match[0], `src="assets/images/optimized/ball-${id}.webp"`)
      .replace(/width="\d+"\s+height="\d+"/, `width="${width}" height="${height}"`);
    if (!/srcset=/.test(output)) {
      output = output.replace(`src="assets/images/optimized/ball-${id}.webp"`, `src="assets/images/optimized/ball-${id}.webp" srcset="assets/images/thumbs/card-ball-${id}.webp 640w, assets/images/optimized/ball-${id}.webp ${width}w" sizes="100vw"`);
    }
  }
  if (!/fetchpriority="high"/.test(output) && !/decoding=/.test(output)) output = output.replace('<img ', '<img decoding="async" ');
  return output;
}

for (const name of rootPages) {
  const path = join(root, name);
  let source = await readFile(path, 'utf8');
  source = source.replace(/v=(?:3\.21|4\.0|4\.1|4\.2)/g, 'v=4.3');
  source = source.replace(/aria-label="Toggle navigation menu"/g, 'aria-label="Open navigation menu"');
  source = source.replace(/<section class="vy-leaf-banner vy-rise([^\"]*)"/g, '<section class="vy-leaf-banner$1"');
  source = source.replace(/<img\b[^>]*>/g, optimizeImageTag);
  source = source.replace(/data-img="assets\/images\/ball-(\d{2})\.jpg"/g, (_match, id) => {
    const [width, height] = dimensions[id] || [];
    return width ? `data-img="assets/images/optimized/ball-${id}.webp" data-width="${width}" data-height="${height}"` : _match;
  });
  source = source.replace(/(<span class="vy-hdr-reel-strip__chip"[^>]*>\s*<img[^>]*?)src="assets\/images\/thumbs\/card-ball-(\d{2})\.webp"([^>]*>)/g, (_match, start, id, end) => {
    const tag = `${start}src="assets/images/thumbs/nav-ball-${id}.webp"${end}`;
    return tag.replace(/width="\d+"\s+height="\d+"/, 'width="240" height="135"');
  });
  source = source.replace(/https:\/\/courtspec\.io\/assets\/images\/ball-\d{2}\.jpg/g, 'https://courtspec.io/assets/images/courtspec-social.jpg');

  if (name === 'gallery.html') {
    source = source.replace(/role="tab" aria-pressed="true"/g, 'role="tab" aria-selected="true" aria-controls="vy-out-panel"');
    source = source.replace(/role="tab" aria-pressed="false"/g, 'role="tab" aria-selected="false" aria-controls="vy-out-panel" tabindex="-1"');
    source = source.replace('<aside class="vy-out__viewer" aria-live="polite" aria-atomic="true">', '<aside class="vy-out__viewer" id="vy-out-panel" role="tabpanel" aria-live="polite" aria-atomic="true" tabindex="0">');
  }

  if (legacyPages.has(name) && !/<meta name="robots"/.test(source)) {
    source = source.replace(/(<meta name="viewport"[^>]*>)/, '$1\n  <meta name="robots" content="noindex,follow">');
  }

  source = source.replace(/\s*<script src="js\/modules\/[^\"]+" defer><\/script>/g, '');
  source = source.replace(/\s*<script src="js\/main\.js\?v=[^"]+" defer><\/script>/g, '');
  const tags = [...scripts[name].map((module) => `  <script src="js/modules/${module}.js?v=4.3" defer></script>`), '  <script src="js/main.js?v=4.3" defer></script>'].join('\n');
  source = source.replace('</body>', `${tags}\n</body>`);
  await writeFile(path, source);
}

console.log('PASS: root runtime markup normalized.');
