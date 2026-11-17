import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const styleToClasses = new Map([
  ['--i: 0;', 'u-delay-0'], ['--i: 1;', 'u-delay-1'], ['--i: 2;', 'u-delay-2'], ['--i: 3;', 'u-delay-3'],
  ['--i: 4;', 'u-delay-4'], ['--i: 5;', 'u-delay-5'], ['--i: 6;', 'u-delay-6'], ['--i: 7;', 'u-delay-7'],
  ['--i:1; display:grid; grid-template-columns:1fr; gap:40px;', 'u-delay-1 u-contact-grid'],
  ['--i: 1; margin-bottom:64px;', 'u-delay-1 u-mb-64'], ['--i: 1; margin-top:36px;', 'u-delay-1 u-mt-36'],
  ['--i: 0; min-height:auto; text-align:center; align-items:center; padding:clamp(40px, 6vw, 80px) 24px; border-color: rgba(34, 211, 238, 0.4); background: radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.12) 0%, var(--vy-bg-secondary) 70%);', 'u-delay-0 u-cta-panel'],
  ['margin-bottom: 4px;', 'u-mb-4'], ['margin-bottom:4px;', 'u-mb-4'],
  ['margin-bottom: 8px;', 'u-mb-8'], ['margin-bottom:8px;', 'u-mb-8'],
  ['margin-bottom: 12px;', 'u-mb-12'], ['margin-bottom:16px;', 'u-mb-16'], ['margin-bottom: 24px;', 'u-mb-24'],
  ['margin-bottom:32px;', 'u-mb-32'], ['margin-top:8px;', 'u-mt-8'], ['margin-top:16px;', 'u-mt-16'],
  ['margin-top:36px;', 'u-mt-36'], ['margin-top: 48px; text-align: center;', 'u-mt-48 u-text-center'],
  ['margin:0;', 'u-m-0'], ['margin:0; font-size:var(--vy-t-14);', 'u-m-0 u-text-small'], ['padding-bottom: 96px;', 'u-pb-96'],
  ['color:var(--court-cyan);', 'u-text-cyan'], ['color:var(--court-lime);', 'u-text-lime'], ['color:#38BDF8;', 'u-text-sky'], ['color:#A855F7;', 'u-text-purple'],
  ['background:var(--court-cyan);', 'u-bg-cyan'], ['background:var(--court-lime);', 'u-bg-lime'], ['background:#38BDF8;', 'u-bg-sky'], ['background:#A855F7;', 'u-bg-purple'],
  ['font-size:clamp(1.5rem, 3vw, 2.25rem);', 'u-heading-sm'], ['font-size:1.5rem; margin-bottom:8px;', 'u-heading-card'],
  ['font-size:clamp(1.75rem, 4vw, 3.25rem); margin-bottom:16px;', 'u-heading-cta'],
  ['font-family:var(--font-mono); font-size:var(--vy-t-12); color:var(--vy-text-secondary);', 'u-text-meta'],
  ['width:100%; max-width:280px;', 'u-full-max-280'], ['width: 25%;', 'u-progress-quarter'],
  ['display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;', 'u-flex-between-wrap'],
  ['display:flex; gap:16px; flex-wrap:wrap; justify-content:center;', 'u-flex-wrap-center'],
  ['display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px;', 'u-auto-grid'],
  ['aspect-ratio:16/9; max-height:540px; overflow:hidden; border-radius:var(--vy-radius); border:1px solid var(--vy-line);', 'u-media-frame'],
  ['width:100%; height:100%; object-fit:cover;', 'u-media-cover'],
  ['max-width:540px; display:flex; flex-direction:column; align-items:center; gap:20px;', 'u-stack-540'],
  ['display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; min-height:100dvh; text-align:center; padding:clamp(20px, 4vw, 48px); background:var(--vy-bg-primary);', 'u-page-center'],
  ['font-size:clamp(3rem, 8vw, 6rem); line-height:1; color:var(--court-cyan);', 'u-error-code']
]);

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'dist' || entry.name.startsWith('.')) return [];
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(absolute) : (entry.name.endsWith('.html') ? [absolute] : []);
  });
}

for (const file of htmlFiles(root)) {
  let source = await readFile(file, 'utf8');
  source = source.replace(/<[^>]+\sstyle="([^"]*)"[^>]*>/g, (tag, style) => {
    const classes = styleToClasses.get(style.trim());
    if (!classes) throw new Error(`Unmapped inline style in ${file}: ${style}`);
    const withoutStyle = tag.replace(/\sstyle="[^"]*"/, '');
    if (/\sclass="/.test(withoutStyle)) {
      return withoutStyle.replace(/\sclass="([^"]*)"/, (_, current) => ` class="${current} ${classes}"`);
    }
    return withoutStyle.replace(/>$/, ` class="${classes}">`);
  });
  await writeFile(file, source);
}

console.log('PASS: inline styles replaced with reusable classes.');
