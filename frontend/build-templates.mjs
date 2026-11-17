import { adminItems, renderAdminNav, adminNavLink } from './admin-navigation.mjs';
import { readdir, readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { ticketPage } from './ticket-pages.mjs';
import { landingPage } from './landing-page.mjs';
import { createPublicUI } from './public-ui.mjs';
import { publicBusinessPage, adminBusinessPage, adminLoginPage, adminDashboard } from './business-pages.mjs';
import { localizePublic } from './helpdesk-content.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const references = fileURLToPath(new URL('../references/', import.meta.url));
const output = fileURLToPath(new URL('./dist/', import.meta.url));
const health = '<div data-helpdesk-health></div><script type="module" src="/helpdesk/health.js"></script>';
const brandAssets = '/assets/helpdesk/05_Brand';
const formats = /\.(?:html|css|js|json|webmanifest|svg|ico|png|jpe?g|webp|avif|woff2?|txt|xml)$/i;
const textFormats = /\.(?:html|css|js|json|webmanifest|svg|txt|xml)$/i;

function replaceRequired(source, before, after) {
  if (!source.includes(before)) throw new Error('Template source changed at: ' + before);
  return source.replace(before, after);
}

function publicPage(file, source) {
  if (file === 'sw.js') {
    // The public worker shares an origin with authenticated routes. Only public static files may enter its cache.
    source = replaceRequired(source, "key !== CACHE_NAME", "(key.startsWith('helpdesk-modern-') || key.startsWith('courtspec-native-')) && key !== CACHE_NAME");
    source = replaceRequired(source, "'courtspec-native-v4.3'", "'helpdesk-modern-network-v1'");
    // Same-path artwork changes must be visible online; the cache is only an offline fallback.
    source = source.replaceAll('fetch(request)', "fetch(request, { cache: 'no-store' })");
    source = replaceRequired(source, 'event.respondWith(cacheFirstAsset(request));', 'event.respondWith(networkFirstAsset(request));');
    source = source.replace(/const ROOT_PAGES = \[[\s\S]*?\];\s*const DETAIL_PAGES = \[[\s\S]*?\];/, "const ROOT_PAGES = ['', 'index.html', '404.html', 'offline.html'];\nconst DETAIL_PAGES = [];");
    // Complete migration/claim before notifying existing public tabs to reload stale images.
    source = replaceRequired(source, "    ))\n  );\n  self.clients.claim();", "    )).then(() => self.clients.claim())\n  );");
    return replaceRequired(source, "if (request.method !== 'GET') return;", [
      'const url = new URL(request.url);',
      "  if (request.method !== 'GET' || url.origin !== self.location.origin ||",
      "      [...url.searchParams.keys()].some(key => key !== 'v') ||",
      "      !(ROOT_PAGES.includes(url.pathname.slice(1)) || DETAIL_PAGES.includes(url.pathname.slice(1)) ||",
      "        /^\\/(?:css|js|assets)\\//.test(url.pathname))) return;",
    ].join('\n'));
  }
  if (file === 'js/main.js') {
    source = replaceRequired(source,
      'navigator.serviceWorker.register(serviceWorkerUrl, { scope: projectRoot.pathname }).catch((err) => {',
      `const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      let editingForm = false;
      const protectForm = event => { if (event.target.closest?.('form')) editingForm = true; };
      document.addEventListener('input', protectForm, true);
      document.addEventListener('change', protectForm, true);
      document.addEventListener('click', protectForm, true);
      // Single-expand accordion listener for native HTML5 details
      document.addEventListener('toggle', (event) => {
        if (event.target && event.target.tagName === 'DETAILS' && event.target.open) {
          const parent = event.target.closest('.hd-faq-list') || event.target.parentElement;
          if (parent) {
            parent.querySelectorAll('details').forEach((d) => {
              if (d !== event.target && d.open) d.open = false;
            });
          }
        }
      }, true);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing || editingForm) return;
        refreshing = true;
        window.location.reload();
      });
      navigator.serviceWorker.register(serviceWorkerUrl, { scope: projectRoot.pathname, updateViaCache: 'none' })
        .then(registration => registration.update()).catch((err) => {`);
  }
  if (file === '404.html') {
    return source
      .replaceAll('href="gallery.html"', 'href="/layanan.html"')
      .replaceAll('href="pricing.html"', 'href="/layanan.html"')
      .replaceAll('href=""', 'href="/"')
      .replaceAll('href="index.html#top"', 'href="/"')
      .replace(/<title>[^<]+<\/title>/, '<title>404 · Halaman Tidak Ditemukan · Helpdesk TIK Kota Depok</title>')
      .replace('( Out of Bounds ) 404 Turnover', '( Halaman Tidak Ditemukan ) 404')
      .replace('The requested play ID or court telemetry vector does not exist in the active combine playbook.', 'Halaman atau layanan TIK yang Anda tuju tidak ditemukan atau telah dipindahkan.')
      .replace('Return to Center Court', 'Kembali ke Beranda')
      .replace('Open Playbook', 'Buka Katalog Layanan');
  }
  if (file === 'offline.html') {
    return source
      .replaceAll('href=""', 'href="/"')
      .replaceAll('href="index.html#top"', 'href="/"')
      .replace(/<title>[^<]+<\/title>/, '<title>Koneksi Terputus · Helpdesk TIK Kota Depok</title>')
      .replace('( Signal Lost ) Offline Court', '( Tidak Ada Koneksi ) Mode Terputus')
      .replace('This page is not in the local court cache yet. Reconnect once, then return here for offline review.', 'Perangkat Anda sedang tidak terhubung ke jaringan internet. Sambungkan kembali untuk melanjutkan layanan Helpdesk TIK Kota Depok.')
      .replace('Try again', 'Muat Ulang Halaman')
      .replace('Cached home', 'Kembali ke Beranda');
  }
  if (file !== 'index.html') return source;
  source = replaceRequired(source, '<span>COURT</span><span>SPEC</span>', '<span>HELP</span><span>DESK</span>');
  source = replaceRequired(source, '( Basketball Intelligence Studio )', '( Layanan TIK Kota Depok )');
  source = replaceRequired(source, 'Frame-linked court telemetry for clearer coaching decisions.', 'Portal pengembangan layanan TIK untuk masyarakat, ASN, dan petugas Kota Depok.');
  source = replaceRequired(source, 'href="gallery.html">Open playbook', 'href="/admin/">Ruang petugas');
  source = replaceRequired(source, 'href="contact.html" aria-label="Contact Court Studio"', 'href="/kontak.html" aria-label="Kontak dan Layanan Pengaduan TIK" title="Kontak &amp; Layanan TIK"');
  source = source.replace('<title>COURTSPEC — Elite Basketball Biomechanics, Scouting & Court Telemetry Studio</title>', '<title>Helpdesk TIK Kota Depok</title>')
    .replace('aria-label="Courtspec Home">COURTSPEC', 'aria-label="Beranda Helpdesk">HELPDESK TIK');
  return replaceRequired(source, '<p><span aria-hidden="true"></span> Combine desk accepting Q4 programs</p>', '<p>Helpdesk TIK Kota Depok · Pengembangan lokal. Galeri dan metrik menampilkan data contoh template.</p><a href="/admin/">Ruang petugas →</a>' + health);
}

function adminPage(file, source) {
  // Mount PIUI Zero's origin-root URLs under /admin/, including its JS route guards and PWA.
  source = source.replace(/(["'\x60(=])\/(?=(?:app|assets|auth|data|about|status)\/|(?:403\.html|404\.html|offline\.html|manifest\.webmanifest|sw\.js|index\.html)\b)/g, '$1/admin/')
    .replaceAll('/admin/index.html', '/admin/portal.html')
    .replaceAll('^\\/app\\/', '^\\/admin\\/app\\/');
  if (file.endsWith('.html')) {
    source = source
      .replaceAll('src="/admin/assets/icons/piui-mark.svg" alt="" width="32" height="32"><span class="piui-brand__name">PIUI Zero™</span>',
        `src="${brandAssets}/logo-pastel-mark.png" alt="" width="32" height="32"><span class="piui-brand__name">Helpdesk TIK Kota Depok</span>`)
      .replace(/<link rel="icon" href="\/admin\/assets\/icons\/favicon\.ico[^"]*"[^>]*>/g,
        `<link rel="icon" type="image/png" href="${brandAssets}/logo-favicon.png">`)
      .replace(/<link rel="icon" href="\/admin\/assets\/icons\/piui-favicon\.svg[^"]*"[^>]*>/g, '')
      .replace(/<link rel="apple-touch-icon" href="\/admin\/assets\/icons\/piui-180\.png[^"]*"[^>]*>/g,
        `<link rel="apple-touch-icon" href="${brandAssets}/logo-pastel-mark.png">`);
    const ticketQueue = file === 'app/tickets/index.html';
    const ticketPage = ticketQueue || file === 'app/tickets/detail.html';
    if (ticketPage) {
      source = source.replaceAll('href="/admin/app/users/index.html" class="piui-nav-link" aria-current="page"',
        'href="/admin/app/users/index.html" class="piui-nav-link"');
    }
    source = source.replace(/<a href="\/admin\/app\/transactions\/index\.html" class="piui-nav-link"[^>]*>[\s\S]*?<\/a>/g, link =>
      link.replace(' aria-current="page"', '')
        .replace('class="piui-nav-link"', `class="piui-nav-link"${ticketQueue ? ' aria-current="page"' : ''}`)
        .replace('Kelola Data Transaksi Keuangan', 'Buka Antrean Tiket Petugas')
        .replace('Data Transaksi', 'Antrean Tiket Petugas'));
    source = source.replace(/<a href="\/admin\/app\/users\/index\.html" class="piui-nav-link"[^>]*>[\s\S]*?<\/a>/g, link => link.replace('Kelola Data Pengguna &amp; Hak Akses', 'Kelola Master Layanan, Organisasi &amp; Hak Akses').replace('Data Pengguna', 'Master Layanan &amp; Akses').replaceAll('/admin/app/users/index.html', '/admin/app/helpdesk/index.html'));
    source = source.replaceAll('Cari rute, audit ID, perintah...', 'Cari menu dan halaman...').replaceAll('Menu Navigasi PIUI Zero', 'Menu petugas');
    const desktopNav = renderAdminNav('Navigasi Utama', file);
    const mobileNav = renderAdminNav('Navigasi Mobile', file);
    source = source.replace(/<nav aria-label="Navigasi Utama">[\s\S]*?<\/nav>/, desktopNav);
    source = source.replace(/<nav aria-label="Navigasi Mobile">[\s\S]*?<\/nav>/, mobileNav);
    source = source.replaceAll('/admin/portal.html', '/admin/app/dashboard/index.html');
    source = source.replaceAll('/admin/about/index.html', '/status.html');
    source = source.replaceAll('/admin/app/audit/index.html', '/admin/app/helpdesk/index.html?kind=audit');
    source = source.replaceAll('href="/admin/portal.html">Dokumentasi<', 'href="/panduan.html">Basis Pengetahuan<');
    source = source.replaceAll('href="/admin/portal.html">Portal Arsitektur<', 'href="/panduan.html">Standar SPBE<');
    source = source.replaceAll('href="/admin/portal.html">Portal Dokumentasi<', 'href="/panduan.html">Panduan Operasional<');
    source = source.replaceAll('/admin/status/index.html', '/status.html');
        source = source.replaceAll('>Panduan &amp; Dokumentasi<', '>Dasbor Petugas<');

    source = source.replace(/<strong>budi\.sec@piui-zero\.internal<\/strong>/g, '<strong data-admin-profile-name>Memeriksa sesi…</strong>')
      .replaceAll('Peran: Super Admin &amp; AppSec Lead', '<span data-admin-profile-role>Peran belum tersedia</span>')
      .replaceAll('Mode prototipe', 'Lab sintetis')
      .replaceAll('id="btn-session-logout"', 'id="hd-admin-logout" data-admin-logout hidden')
      .replaceAll('Akhiri Sesi (Logout)', 'Keluar akun')
      .replaceAll('sesi administrator', 'sesi petugas')
      .replaceAll('Informasi Sesi Administrator', 'Informasi akun petugas')
      .replace(/<a href="\/admin\/app\/dashboard\/index\.html" class="piui-btn piui-btn--secondary piui-btn--sm">Portal Dokumentasi<\/a>/g, '<a href="/admin/auth/login.html" class="piui-btn piui-btn--secondary piui-btn--sm" data-admin-account-switch>Masuk petugas</a>')
      .replace(/<!-- DIALOG 2: KONFIRMASI PENCABUTAN AKSES DARURAT -->[\s\S]*?<dialog id="dialog-revoke-user"[\s\S]*?<\/dialog>/, '')
      .replace(/<!-- DIALOG 3: FORM ISIAN TAMBAH \/ EDIT PENGGUNA \(SLIDE-OVER MODAL SISI KANAN\) -->[\s\S]*?<dialog id="dialog-user-form"[\s\S]*?<\/dialog>/, '')
      .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="Ruang kerja petugas Helpdesk TIK Pemerintah Kota Depok.">')
      .replace(/<meta property="og:title" content="[^"]*">/i, '<meta property="og:title" content="Ruang Kerja Petugas · Helpdesk TIK Kota Depok">')
      .replace(/<meta property="og:description" content="[^"]*">/i, '<meta property="og:description" content="Konsol internal pelayanan dan pengelolaan Helpdesk TIK Pemerintah Kota Depok.">');
    const admin2TierFooter = `<footer class="piui-footer" aria-label="Footer Operasional Helpdesk TIK Kota Depok">
        <div class="hd-admin-footer-top">
          <ul class="piui-footer__links">${adminItems.filter(i => i.footer).map(i => `<li${i.audience ? '' : ' hidden'}>${adminNavLink(i, file, 'hd-admin-footer-link')}</li>`).join('')}</ul>
          <div class="hd-admin-footer-action">
            <a class="piui-btn piui-btn--secondary piui-btn--sm hd-admin-footer-btn" href="/" target="_blank" rel="noopener">
              <span class="hd-btn-icon" aria-hidden="true">🌐</span> Portal publik <span class="hd-btn-arrow" aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
        <div class="hd-admin-footer-sep" aria-hidden="true"></div>
        <div class="hd-admin-footer-bottom">
          <div class="hd-admin-footer-credit">
            <span class="piui-product-signature">
              <img class="piui-brand__mark" src="${brandAssets}/logo-pastel-mark.png" alt="" width="22" height="22">
              <strong class="hd-footer-brand-title">Helpdesk TIK Kota Depok</strong>
            </span>
            <span class="hd-admin-footer-dot" aria-hidden="true">&middot;</span>
            <span>Diskominfo Kota Depok &middot; Pemerintah Kota Depok &copy; 2026</span>
            <span class="hd-admin-footer-dot" aria-hidden="true">&middot;</span>
            <a href="/status.html">Status layanan</a>
          </div>
          <div class="hd-admin-footer-status-slot" id="hd-admin-offline-slot"></div>
        </div>
      </footer>`;
    source = source.replace(/<footer class="piui-footer">[\s\S]*?<\/footer>/, admin2TierFooter);
  }
  source = source.replaceAll('href="/admin/app/transactions/index.html"', 'href="/admin/app/tickets/index.html"');
  source = source.replaceAll('href="/admin/app/users/index.html">Data Pengguna</a>', 'href="/admin/app/helpdesk/index.html">Master Layanan &amp; Akses</a>');
  if (file === 'assets/js/components/cmd-palette.js') {
    const commands = adminItems.map(i => ({id:'cmd-nav-'+i.id,navId:i.id,title:i.label,category:i.group,shortcut:'',type:'route',href:i.href}));
    source = source.replace(/const COMMAND_ITEMS = \[[\s\S]*?\n\];/, 'const COMMAND_ITEMS = '+JSON.stringify(commands)+';');
    source = replaceRequired(source,
      '  const commandItems=COMMAND_ITEMS.filter(item=>document.body.hasAttribute("data-component-catalog")||!/wow|lazy|lock|shortcut|print|emergency/i.test(item.id));',
      `  const commandItems=()=>COMMAND_ITEMS.filter(item=>document.querySelector('[data-admin-nav-id="'+item.navId+'"]:not([hidden])'));`);
    source = source.replaceAll('[...commandItems]', '[...commandItems()]').replaceAll('commandItems.filter(', 'commandItems().filter(');
    source = replaceRequired(source, 'if (kbdEl) kbdEl.textContent = item.shortcut;', 'if (kbdEl) { kbdEl.textContent = item.shortcut; kbdEl.hidden = !item.shortcut; }');
    source = replaceRequired(source, '  searchInput.addEventListener("keydown", (e) => {',
      '  searchInput.addEventListener("keydown", (e) => {\n    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dialogEl.close(); return; }');
  }
  if (file === 'assets/js/app.js') {
      source = source.replace("document.querySelector('footer')?.append(status);",
        "(document.getElementById('hd-admin-offline-slot') || document.querySelector('footer'))?.append(status);");
    }
    if (file === 'assets/js/components/shell.js') {
    source = "import { applyAccent, STORAGE_ACCENT_KEY } from '/helpdesk/admin-accent.js';\n" + source;
  }
  if (file === 'assets/js/components/product-help.js') source = replaceRequired(source, "filter(Boolean)[1]", "filter(Boolean)[2]");
  if (file === 'assets/js/components/feature-registry.js') {
    source=replaceRequired(source,'  const host=document.querySelector(feature.selector);',"  if(document.querySelector('[data-hd-page],[data-ticket-page],form[data-hd-login]')&&feature.id==='notification-launchers')continue;\n  const host=document.querySelector(feature.selector);");
  }
  if (file === 'assets/js/components/forms.js') source=replaceRequired(source,'    watchDraft(form);',"    if(!form.hasAttribute('data-hd-login')&&!form.closest('[data-ticket-page]')) watchDraft(form);");
  if (file === 'manifest.webmanifest') source = source.replaceAll('"/"', '"/admin/"');
  if (file === 'sw.js') {
    source=replaceRequired(source,'const CACHE_VERSION="2.2.2";','const CACHE_VERSION="2.2.2-m004";');
    source = source.replace('const PRECACHE=[', 'const PRECACHE=["/helpdesk/admin-accent.js",')
      .replace('STATIC_SHELL_ALLOWLIST=new Set([', 'STATIC_SHELL_ALLOWLIST=new Set(["/helpdesk/admin-accent.js",');
  }
  if (file === 'auth/login.html') return adminLoginPage(source);
  if (file === 'app/dashboard/index.html') return adminDashboard(source, health);
  return source;
}

async function publish(template, transform, prefix) {
  let count = 0;
  async function walk(relative) {
    for (const entry of await readdir(join(references, template, relative), { withFileTypes: true })) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.name.startsWith('.') || file === 'dist') continue;
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!entry.isFile() || !formats.test(file)) continue;
      if (file.endsWith('.html')) {
        if (template === 'piui-modern' && file !== 'index.html' && file !== '404.html' && file !== 'offline.html') continue;
        if (template === 'piui-zero' && file !== '403.html' && file !== '404.html' && file !== 'offline.html' && file !== 'auth/login.html' && file !== 'app/dashboard/index.html') continue;
      }
      const dest = join(output, prefix, prefix && file === 'index.html' ? 'portal.html' : file);
      const original = await readFile(join(references, template, file));
      const body = textFormats.test(file) ? transform(file, original.toString('utf8')) : original;
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, body);
      if (prefix && file === 'app/dashboard/index.html') await writeFile(join(output, prefix, 'index.html'), body);
      count++;
    }
  }
  await walk('');
  console.log(template + ': ' + count + ' source files published');
}

for (const p of ['details', 'about.html', 'brief.html', 'contact.html', 'gallery.html', 'pipeline.html', 'plan.html', 'play.html', 'pricing.html', 'principle.html', 'admin/portal.html', 'admin/about', 'admin/status', 'admin/app/analytics', 'admin/app/audit', 'admin/app/components', 'admin/app/gallery', 'admin/app/notifications', 'admin/app/settings', 'admin/app/transactions', 'admin/app/users']) {
  await rm(join(output, p), { recursive: true, force: true });
}
const landingSource = await readFile(join(references, 'piui-modern/index.html'), 'utf8');
const canonicalLanding = landingPage(localizePublic('index.html', publicPage('index.html', landingSource)));
const publicUI = createPublicUI(canonicalLanding);
await publish('piui-modern', (file, source) => {
  const localized = localizePublic(file, publicPage(file, source));
  if (file === 'index.html') return publicUI(canonicalLanding);
  return file.endsWith('.html') ? publicUI(localized) : localized;
}, '');
await publish('piui-zero', adminPage, 'admin');
const contactSource = localizePublic('contact.html', publicPage('contact.html', await readFile(join(references,'piui-modern/contact.html'),'utf8'))).replaceAll(/href="details\/[^"]+"/g, 'href="/panduan.html"');
for (const [file,kind] of [['akses.html','login'],['daftar.html','register'],['layanan.html','catalog'],['detail-layanan.html','detail'],['faq.html','faq'],['status.html','status'],['panduan.html','knowledge'],['halaman.html','pages']]) {
  await writeFile(join(output,file),publicUI(publicBusinessPage(contactSource,kind)));
}
await writeFile(join(output,'kontak.html'),publicUI(publicBusinessPage(contactSource,'contact')));
await mkdir(join(output,'admin/app/helpdesk'),{recursive:true});
await writeFile(join(output,'admin/app/helpdesk/index.html'),adminBusinessPage(adminPage('app/users/index.html',await readFile(join(references,'piui-zero/app/users/index.html'),'utf8'))));
await writeFile(join(output,'helpdesk/business.css'),await readFile(new URL('./business.css',import.meta.url)));
await writeFile(join(output, 'helpdesk/admin-accent.js'), await readFile(new URL('./admin-accent.js', import.meta.url)));
await writeFile(join(output, 'helpdesk/landing.css'), await readFile(new URL('./landing.css', import.meta.url)));
await writeFile(join(output, 'helpdesk/hero-public.js'), await readFile(new URL('./hero-public.js', import.meta.url)));
await writeFile(join(output, 'helpdesk/public-ui.css'), await readFile(new URL('./public-ui.css', import.meta.url)));
await writeFile(join(output, 'helpdesk/public-pages.css'), await readFile(new URL('./public-pages.css', import.meta.url)));
for (const folder of ['02_Hero_Tanpa_Teks', '03_Ilustrasi_Pendukung', '05_Brand']) {
  await cp(new URL('../assets/' + folder, import.meta.url), join(output, 'assets/helpdesk', folder), { recursive: true });
}

for(const [file,kind] of [['lapor.html','create'],['tiket.html','list'],['lacak.html','track'],['detail-tiket.html','ticket']]) await writeFile(join(output,file),publicUI(ticketPage(publicBusinessPage(contactSource,'catalog'),kind)));
await mkdir(join(output,'admin/app/tickets'),{recursive:true});
await writeFile(join(output,'admin/app/tickets/index.html'),ticketPage(adminBusinessPage(adminPage('app/tickets/index.html',await readFile(join(references,'piui-zero/app/users/index.html'),'utf8'))),'list',true));

await writeFile(join(output,'admin/app/tickets/detail.html'),ticketPage(adminBusinessPage(adminPage('app/tickets/detail.html',await readFile(join(references,'piui-zero/app/users/index.html'),'utf8'))),'ticket',true));
