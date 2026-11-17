import { guidePage, guides } from './guide-content.mjs';
import { readFileSync } from 'node:fs';

const copy = JSON.parse(readFileSync(new URL('./public-copy.json', import.meta.url), 'utf8'));
for (const guide of Object.values(guides)) copy[guide.original] = guide.title;
const guideByTitle = new Map(Object.values(guides).map(guide => [guide.original, guide]));
const lightboxScript = readFileSync(new URL('./lightbox.js', import.meta.url), 'utf8');

function localizeText(raw) {
  const key = raw.trim();
  return Object.hasOwn(copy, key) ? raw.replace(key, () => copy[key]) : raw;
}

export function localizePublic(file, source) {
  if (file === 'js/modules/navigation.js') {
    return source.replace('if (headerFrame && hero && shouldRevealAfterHero)', "if (headerFrame && hero && shouldRevealAfterHero && !document.body.hasAttribute('data-helpdesk-landing'))")
      .replaceAll('Open navigation menu', 'Buka navigasi')
      .replaceAll('Close navigation menu', 'Tutup navigasi');
  }
  if (file === 'js/modules/pricing-sizer.js') {
    const phrases = [
      ['60 FPS','1 langkah'],['120 FPS','2 langkah'],['240 FPS','3 langkah'],['480 FPS','4 langkah'],
      ['COLLEGIATE PRO','SEDANG'],['FRANCHISE APEX','TINGGI'],['AMATEUR','RINGAN'],
      ['Start Free Hoop Log','Lihat skenario ringan'],['Equip Collegiate Pro','Lihat skenario sedang'],['Deploy Franchise Apex','Lihat skenario tinggi'],
      ['monthly reps','laporan per bulan'],['shot reps','laporan'],['sensor pods','tindak lanjut'],
      ['telemetry reps exceeds standard quota. Franchise Apex covers','unit melebihi skenario standar. Batas contoh tertinggi'],
      ['reps; additional usage billed per combine session.','unit.'],['reps fits comfortably within the Amateur free tier. No subscription required.','unit termasuk skenario ringan.'],
      ['Rep count is within entry limit, but','Jumlah laporan tergolong ringan, tetapi bobot'],
      ['high-speed telemetry requires Collegiate Pro tier.','memerlukan skenario sedang.'],
      ['reps exceeds','unit melebihi skenario'],["'s "+'$'+'{nf(prev.credits)} cap.',' ('+'$'+'{nf(prev.credits)} unit).'],
      ['provides','mencakup'],['tracking credits.','unit contoh.'],['en-US','id-ID'],
      ['`$${pick.cost}`','nf(pick.credits)'],[' / mo',' unit'],
    ];
    for (const [before, after] of phrases) source = source.replaceAll(before, after);
    return source;
  }
  if (file === 'js/modules/hero-switcher.js') return source
    .replace('  let isPausedByUser = false;', '  let isPausedByUser = !autoplayBtn;')
    .replace('Featured basketball telemetry','Kategori layanan Helpdesk')
    .replace('Open detail for','Buka panduan')
    .replaceAll('Play automatic slides','Lanjutkan pergantian slide')
    .replaceAll('Pause automatic slides','Jeda pergantian slide')
    .replace('    preloadNextFrame();', `    const rail = tab.parentElement;
    if (rail.scrollWidth > rail.clientWidth) {
      const offset = tab.getBoundingClientRect().left - rail.getBoundingClientRect().left;
      rail.scrollTo({
        left: rail.scrollLeft + offset - (rail.clientWidth - tab.offsetWidth) / 2,
        behavior: motionPreference.matches ? 'instant' : 'smooth'
      });
    }
    preloadNextFrame();`);
  if (file === 'js/modules/gallery.js') {
    return source.replace(/\r?\n\}\s*\r?\nif \(document\.readyState === 'loading'\)/, '\r\n  initLightbox();\r\n}\r\n\r\nif (document.readyState === \'loading\')') + '\r\n\r\n' + lightboxScript;
  }
  if (file === 'js/modules/metrics-chart.js') return source.replace("['Shooting Lab', 'Handle & Iso', 'Rim Apex', 'Court Vision']", "['Aplikasi', 'Jaringan', 'Akun', 'Perangkat']");
  if (file === 'js/modules/contact.js') return source.replace('mailto:scout@courtspec.io?', 'mailto:?')
    .replace('CourtSpec inquiry','Draf Helpdesk').replace('Open email draft','Buka draf email tanpa penerima')
    .replace('Draft ready. Your information remains in this page until you open your mail application.', 'Draf siap. Alamat penerima kosong. Tidak ada tiket yang dikirim.');
  if (file === 'manifest.webmanifest') {
    const manifest = JSON.parse(source);
    return JSON.stringify({...manifest, name:'Helpdesk TIK Kota Depok', short_name:'Helpdesk TIK', lang:'id', description:'Portal bantuan teknologi informasi Kota Depok'}, null, 2);
  }
  if (!file.endsWith('.html')) return source;
  if (file.includes('details/')) source = guidePage(file, source);
  if (file === 'gallery.html') {
    source = source.replace(/<button\s+class="vy-reel-cell[^>]*>/g, button => {
      const title = button.match(/data-title="([^"]+)"/)?.[1];
      const guide = guideByTitle.get(title);
      if (!guide) throw new Error('Missing gallery copy: ' + title);
      const data = {kind:guide.category, model:guide.category, steps:'Pemeriksaan awal', size:'Contoh', 'render-prompt':guide.summary};
      for (const [key, value] of Object.entries(data)) {
        button = button.replace(new RegExp('data-' + key + '="[^"]*"'), 'data-' + key + '="' + value + '"');
      }
      return button;
    });
  }
  // Translate content slots. Preserve source markup, selectors, script modules, assets and alternate image descriptions.
  source = source.replace(/>([^<>]+)(?=<)/g, (_, text) => '>' + localizeText(text))
    .replace(/((?:aria-label|placeholder|data-(?:model|steps|seed|size|title|prompt|kind))=")([^"]*)"/g, (_, prefix, text) => prefix + localizeText(text) + '"')
    .replaceAll('href="mailto:scout@courtspec.io"', 'href="/contact.html"')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')
    .replace(/^\s*<(?:link rel="canonical"|meta (?:property="og:|name="twitter:))[^>]*>/gm,'')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Panduan dan simulasi layanan Helpdesk TIK Kota Depok.">')
    .replace('<html lang="en"', '<html lang="id"')
    .replace(/<title>[^<]*<\/title>/, (_, offset, html) => {
      const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      return '<title>' + (file === 'index.html' ? '' : (heading || 'Panduan') + ' · ') + 'Helpdesk TIK Kota Depok</title>';
    });
  return source;
}
