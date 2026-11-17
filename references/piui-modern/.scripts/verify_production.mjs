import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist');
await stat(root);

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

const files = await walk(root);
const htmlFiles = files.filter((file) => extname(file) === '.html');
const issues = [];
const titles = new Map();

async function verifyLocalTarget(file, label, target, kind) {
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(target) || target === '') return;
  const cleanTarget = target.split(/[?#]/, 1)[0];
  if (!cleanTarget) return;
  const resolved = normalize(resolve(dirname(file), cleanTarget));
  if (!resolved.startsWith(root)) {
    issues.push(`${label}: ${kind} escapes publish root: ${target}`);
    return;
  }
  try { await stat(resolved); } catch { issues.push(`${label}: missing local ${kind}: ${target}`); }
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const label = relative(root, file).replaceAll('\\', '/');
  const h1 = (html.match(/<h1\b/g) || []).length;
  const main = (html.match(/<main\b/g) || []).length;
  if (h1 !== 1) issues.push(`${label}: expected one h1, found ${h1}`);
  if (main !== 1) issues.push(`${label}: expected one main, found ${main}`);
  if (/\sstyle="/i.test(html)) issues.push(`${label}: inline style attribute`);
  if (/<style\b/i.test(html)) issues.push(`${label}: inline style block`);
  if (/\son[a-z]+="/i.test(html)) issues.push(`${label}: inline event handler`);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) issues.push(`${label}: missing title`);
  else if (!/^(?:play|pipeline|plan|principle|brief)\.html$/.test(label)) {
    if (titles.has(title)) issues.push(`${label}: duplicate title with ${titles.get(title)}`);
    else titles.set(title, label);
  }
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    await verifyLocalTarget(file, label, match[1], 'target');
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of match[1].split(',')) {
      const target = candidate.trim().split(/\s+/, 1)[0];
      await verifyLocalTarget(file, label, target, 'srcset target');
    }
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\salt="[^"]*"/i.test(tag)) issues.push(`${label}: image missing alt`);
    if (!/\swidth="\d+"/i.test(tag) || !/\sheight="\d+"/i.test(tag)) issues.push(`${label}: image missing intrinsic dimensions`);
  }
  const highPriorityImages = (html.match(/<img\b[^>]*\sfetchpriority="high"/gi) || []).length;
  if (highPriorityImages > 1) issues.push(`${label}: more than one high-priority image`);
  const isNoindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  if (!isNoindex && !/<link\s+rel="canonical"\s+href="https:\/\/courtspec\.io\/[^"]*"/i.test(html)) {
    issues.push(`${label}: indexable page missing production canonical`);
  }
}

const headers = await readFile(join(root, '_headers'), 'utf8');
if (/unsafe-inline|unsafe-eval/.test(headers)) issues.push('_headers: unsafe CSP directive');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const label = relative(root, file).replaceAll('\\', '/');
  for (const match of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1];
    const hash = createHash('sha256').update(body).digest('base64');
    if (!headers.includes(`'sha256-${hash}'`)) issues.push(`${label}: inline script hash missing from CSP`);
  }
}
for (const file of files.filter((item) => /\.(?:js|mjs)$/i.test(item))) {
  const source = await readFile(file, 'utf8');
  if (/\b(?:innerHTML|outerHTML)\b/.test(source)) issues.push(`${relative(root, file)}: unsafe HTML mutation API`);
  if (/\.style\s*\.|\bcssText\b|setAttribute\(\s*['"]style['"]/.test(source)) issues.push(`${relative(root, file)}: inline style mutation API`);
}

const forbidden = files.map((file) => relative(root, file).replaceAll('\\', '/')).filter((file) => /(^|\/)\.(?:agents|docs|references|scripts)(\/|$)|ball-0[5-8]\.jpg$|vayra_dump|\.mp4$|\.docx$/i.test(file));
issues.push(...forbidden.map((file) => `${file}: forbidden production artifact`));

for (const file of files.filter((item) => /\.(?:html|css|js)$/i.test(item))) {
  const source = await readFile(file, 'utf8');
  if (/\borange\b|#(?:f97316|fb923c|fdba74|ff8c00|ffa500)\b/i.test(source)) {
    issues.push(`${relative(root, file)}: orange color token detected`);
  }
}

if (issues.length) {
  console.error(`FAIL: ${issues.length} production verification issue(s)\n${issues.join('\n')}`);
  process.exit(1);
}
console.log(`PASS: ${htmlFiles.length} production HTML pages, local targets, CSP, and publish boundary verified.`);
