import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const output = resolve(root, 'dist');
if (output !== join(root, 'dist')) throw new Error('Refusing to build outside the project dist directory.');

for (const script of ['.scripts/generate_detail_pages.mjs', '.scripts/normalize_runtime_markup.mjs']) {
  const run = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`Build preparation failed: ${script}`);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const rootFiles = [
  '_headers', '_redirects', '404.html', 'offline.html', 'about.html', 'brief.html',
  'contact.html', 'gallery.html', 'index.html', 'pipeline.html', 'plan.html',
  'play.html', 'pricing.html', 'principle.html', 'manifest.webmanifest',
  'robots.txt', 'sitemap.xml', 'sitemap-details.xml', 'sw.js'
];

const runtimeScripts = [
  'main.js', 'modules/navigation.js', 'modules/hero-switcher.js',
  'modules/gallery.js', 'modules/theme.js', 'modules/reveal.js',
  'modules/metrics-chart.js', 'modules/pricing-sizer.js', 'modules/faq.js',
  'modules/contact.js', 'modules/link-sentinel.js', 'modules/detail-pages.js'
];

const runtimeAssets = [
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'images/hero.svg', 'images/courtspec-social.jpg'
];

for (const file of rootFiles) await cp(join(root, file), join(output, file));
await cp(join(root, 'details'), join(output, 'details'), { recursive: true });
await cp(join(root, 'css'), join(output, 'css'), { recursive: true });
await mkdir(join(output, 'js', 'modules'), { recursive: true });
for (const file of runtimeScripts) {
  const destination = join(output, 'js', file);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(join(root, 'js', file), destination);
}
for (const file of runtimeAssets) {
  const destination = join(output, 'assets', file);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(join(root, 'assets', file), destination);
}
await cp(join(root, 'assets', 'images', 'optimized'), join(output, 'assets', 'images', 'optimized'), { recursive: true });
await cp(join(root, 'assets', 'images', 'thumbs'), join(output, 'assets', 'images', 'thumbs'), { recursive: true });

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(output);
const relativeFiles = files.map((file) => relative(output, file).replaceAll('\\', '/'));
const forbidden = relativeFiles.filter((file) => /(^|\/)\.(?:agents|docs|references|scripts)(\/|$)|ball-0[5-8]\.jpg$|vayra_dump|\.mp4$|\.docx$/i.test(file));
if (forbidden.length) throw new Error(`Forbidden production files:\n${forbidden.join('\n')}`);

const bytes = (await Promise.all(files.map((file) => stat(file)))).reduce((sum, item) => sum + item.size, 0);
console.log(`PASS: production allowlist built ${relativeFiles.length} files (${bytes} bytes) in dist/.`);
