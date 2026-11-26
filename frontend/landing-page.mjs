import { heroes } from './hero-defaults.mjs';
const asset = '/assets/helpdesk/';
const illustrations = ['akun-identitas','wifi-jaringan','aplikasi-digital','perawatan-tik'];
const galleryIllustrations = [
  'akun-identitas',
  'wifi-jaringan',
  'aplikasi-digital',
  'perawatan-tik',
  'panduan-pengetahuan',
  'pelacakan-sla',
  'keamanan-siber',
  'server-infrastruktur',
];

export function landingPage(source) {
  source = source.replace('data-nav-after-hero','data-helpdesk-landing')
    .replace('</head>','<link rel="stylesheet" href="/helpdesk/landing.css"></head>')
    .replace('</body>','<script src="/helpdesk/hero-public.js" defer></script></body>')
    .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="'+asset+'05_Brand/logo-pastel-mark.png">')
    .replace(/<a class="vy-hdr-brand"[^>]*>[\s\S]*?<\/a>/, '<a class="vy-hdr-brand" href="/" aria-label="Beranda Helpdesk TIK Kota Depok"><img src="'+asset+'05_Brand/logo-pastel-mark.png" width="44" height="44" alt=""><span>Helpdesk TIK<small>KOTA DEPOK</small></span></a>')
    .replace(/<a class="vy-hdr-glyph" href="[^"]*"[^>]*>/, '<a class="vy-hdr-glyph" href="/kontak.html" aria-label="Kontak dan Layanan Pengaduan TIK" title="Kontak &amp; Layanan TIK">')
    .replace(/(<h1 class="vy-ref-hero__title"[^>]*>)[\s\S]*?(<\/h1>)/, '$1Bantuan TIK.<br>Lebih dekat.$2')
    .replace(/(<span class="vy-ref-hero__descriptor">)[^<]*(<\/span>)/, '$1HELPDESK TIK KOTA DEPOK$2')
    .replace(/(<p class="vy-ref-hero__mobile-value">)[^<]*(<\/p>)/, '$1Laporkan kendala TIK, pantau tiket, atau cari panduan layanan Kota Depok.$2')
    .replace(/(<a class="vy-ref-hero__mobile-cta")[^>]*>[\s\S]*?<\/a>/,
      '<div class="hd-hero-cta-wrap" role="group" aria-label="Aksi Utama Pelayanan">' +
      '<a class="btn btn-primary hd-hero-btn hd-hero-btn--primary" href="/layanan.html">Buat laporan</a>' +
      '<a class="btn btn-secondary hd-hero-btn hd-hero-btn--secondary" href="/lacak.html">Lacak tiket tamu</a>' +
      '<a class="btn btn-secondary hd-hero-btn hd-hero-btn--secondary" href="/tiket.html">Tiket saya</a>' +
      '</div>');
  source = source.replace(/<img class="vy-stage__img"[\s\S]*?>/, '<img class="vy-stage__img" src="'+asset+'02_Hero_Tanpa_Teks/'+heroes[0][0]+'" width="1600" height="600" fetchpriority="high" alt="'+heroes[0][2]+'">');
  const tabTemplate = source.match(/<button class="vy-stage__tab"[\s\S]*?<\/button>/)[0];
  const tabs = heroes.map(([file, title, alt], index) => {
    return tabTemplate.replace(/data-img="[^"]*"/,'data-img="'+asset+'02_Hero_Tanpa_Teks/'+file+'"')
      .replace(/data-width="[^"]*"/,'data-width="1600"').replace(/data-height="[^"]*"/,'data-height="600"')
      .replace(/data-alt="[^"]*"/,'data-alt="'+alt+'"').replace(/data-title="[^"]*"/,'data-title="'+title+'"')
      .replace(/aria-selected="[^"]*"/, 'aria-selected="'+(index === 0)+'" tabindex="'+(index === 0 ? '0' : '-1')+'" aria-label="'+title+'" title="'+title+'"')
      .replace(/\sdata-(?:model|steps|seed|size|detail|prompt)="[^"]*"/g, '')
      .replace(/<img[^>]*>/,'<img src="'+asset+'02_Hero_Tanpa_Teks/'+file+'" width="160" height="60" loading="lazy" alt="">')
      .replace(/<span>[\s\S]*?<\/span>/,'<span>'+String(index + 1).padStart(2,'0')+'<span class="hd-hero-thumb-title"> · '+title+'</span></span>');
  }).join('\n');
  source = source.replace(/(<div class="vy-stage__tabs"[^>]*>)[\s\S]*?(<\/div>)/, '$1'+tabs+'$2');
  source = source.replace(/<a([^>]*)>Lihat simulasi<\/a>/, '<a$1>Buat laporan</a>').replace(/href="[^"]*"(>Buat laporan<\/a>)/, 'href="/lapor.html"$1');
  const drawerNav = `<div class="vy-hdr-panel-strips">
          <a class="vy-hdr-reel-strip" href="/">
            <span class="vy-hdr-reel-strip__seq">( Utama )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-gedung-pemerintah.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">BERANDA</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/layanan.html">
            <span class="vy-hdr-reel-strip__seq">( Layanan TIK )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-bantuan-operator.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">KATALOG LAYANAN</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/lapor.html">
            <span class="vy-hdr-reel-strip__seq">( Pelaporan )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-tiket-helpdesk.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">BUAT TIKET BARU</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/lacak.html">
            <span class="vy-hdr-reel-strip__seq">( Status Tiket )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-pelacakan-sla.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">LACAK TIKET TAMU</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/panduan.html">
            <span class="vy-hdr-reel-strip__seq">( Standar SPBE )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">BASIS PENGETAHUAN</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/status.html">
            <span class="vy-hdr-reel-strip__seq">( Monitoring SPBE )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-server-infrastruktur.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">STATUS SISTEM</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/faq.html">
            <span class="vy-hdr-reel-strip__seq">( Tanya Jawab )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-kolaborasi-opd.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">TANYA JAWAB (FAQ)</span>
          </a>

          <a class="vy-hdr-reel-strip" href="/admin/auth/login.html">
            <span class="vy-hdr-reel-strip__seq">( Internal Kedinasan )</span>
            <span class="vy-hdr-reel-strip__chip" aria-hidden="true">
              <img decoding="async" src="${asset}03_Ilustrasi_Pendukung/ilustrasi-keamanan-siber.png" width="240" height="135" alt="" loading="lazy">
            </span>
            <span class="vy-hdr-reel-strip__head">KONSOL PETUGAS</span>
          </a>
        </div>`;
  source = source.replace(/<div class="vy-hdr-panel-strips">[\s\S]*?<\/div>/, drawerNav);
  // Keep the original slider controls and selected-tab behaviour, with a service-focused composition.
  source = source.replace(/<div class="vy-stage__info">[\s\S]*?(?=<nav class="vy-quick-nav")/, '</div></div>');
  const quickNav = `<nav class="vy-quick-nav hd-landing-links" aria-label="Pintasan beranda">
          <a href="#alur-pelaporan">Alur Pelaporan</a>
          <a href="#akses">Akses Layanan</a>
          <a href="/layanan.html">Katalog Layanan</a>
          <a href="/panduan.html">Basis Pengetahuan</a>
          <a href="/faq.html">Tanya Jawab (FAQ)</a>
        </nav>`;
  source = source.replace(/<nav class="vy-quick-nav"[\s\S]*?<\/nav>(\s*<\/div>\s*<\/section>)/, (_, closeHero) => closeHero + quickNav);
  source = source.replace(/<div class="vy-ref-hero__paths"[\s\S]*?<\/div>/, '')
    .replace(/<div class="vy-ref-hero__spec"[\s\S]*?<\/div>/, '')
    .replace(/<span class="vy-ref-hero__rail[\s\S]*?<\/span>/g,'');
  source = source.replace(/(<div class="vy-stage__title-tag">)[\s\S]*?(<\/div>)/,'$1<span>Bantuan TIK terpadu</span>$2');
  source = source.replace(/<div class="vy-stage__header">[\s\S]*?(?=\s*<div class="vy-stage__control-bar">)/, '');
  source = source.replace(/(<section class="vy-section vy-shell" id="problem">)/, '$1'+flowSteps()+accessCards());
  for (const id of ['metrics','proof','pricing']) {
    source = source.replace(new RegExp('<section\\b[^>]*\\bid="'+id+'"[\\s\\S]*?</section>'), '');
  }
  source = source.replace(/<div class="vy-marquee[\s\S]*?<\/div>\s*<\/div>/, '');
  source = source.replace(/(<figure class="vy-problem-visual[^"]*">)[\s\S]*?(<\/figure>)/, '$1<img src="'+asset+'03_Ilustrasi_Pendukung/ilustrasi-gedung-pemerintah.png" width="512" height="512" loading="lazy" alt="Ilustrasi gedung pelayanan Kota Depok">$2');
  let card = 0;
  source = source.replace(/(<article class="vy-path-card[^"]*"[^>]*id="pipeline-[^"]*"[^>]*>)/g, match =>
    match+'<img class="hd-service-art" src="'+asset+'03_Ilustrasi_Pendukung/ilustrasi-'+illustrations[card++] +'.png" width="512" height="512" alt="" loading="lazy">');
  // Replace each gallery image while preserving its native filter attributes, links, and card classes.
  let gallery = 0;
  source = source.replace(/(<article[^>]*data-path=[\s\S]*?<\/article>)/g, cardHtml => {
    const name = galleryIllustrations[gallery++ % galleryIllustrations.length];
    return cardHtml.replace(/<img[\s\S]*?>/, '<img src="'+asset+'03_Ilustrasi_Pendukung/ilustrasi-'+name+'.png" width="512" height="512" loading="lazy" alt="Ilustrasi kategori layanan TIK">');
  });
  source = source.replace(/<img[^>]*src="assets\/images\/[^"]+"[^>]*>/g, '<img src="'+asset+'03_Ilustrasi_Pendukung/ilustrasi-tiket-helpdesk.png" width="512" height="512" loading="lazy" alt="">');
  const links = {'#metrics':'/layanan.html','#pricing':'/faq.html','pricing.html#starter':'/layanan.html','pricing.html':'/layanan.html','about.html':'/panduan.html','contact.html':'/faq.html','gallery.html':'/layanan.html'};
  for (const [before,after] of Object.entries(links)) source = source.replaceAll('href="'+before+'"','href="'+after+'"');
  source = source.replace(/href="details\/[^"]+"/g, 'href="/layanan.html"');
  source = source.replace(/(<a href="#akses">)[^<]*(<\/a>)/g,'$1Akses layanan$2')
    .replace(/(<a href="#faq">)[^<]*(<\/a>)/g,'$1Pertanyaan umum$2')
    .replace(/>Simulasi(?: beban| layanan)?</g,'>Akses layanan<')
    .replace(/(<a class="btn btn-primary" href="#akses">)[^<]*/,'$1Kenali akses layanan')
    .replace('Gunakan panduan kategori dan contoh laporan sebelum menghubungi petugas melalui kanal resmi yang berlaku.','Siapkan uraian kendala, waktu kejadian, dan bukti yang aman dibagikan. Ajukan tiket baru melalui katalog layanan atau pantau tiket Anda secara transparan.')
    .replace('Helpdesk TIK Kota Depok · Portal layanan dan bantuan teknologi informasi.','Helpdesk TIK Kota Depok · Portal bantuan teknologi informasi.');
  source = source.replaceAll('aria-label="CourtSpec analysis workflow"', 'aria-label="Alur penanganan laporan"')
    .replaceAll('aria-label="Filter court plays"', 'aria-label="Filter kategori bantuan"')
    .replaceAll('aria-label="CourtSpec — back to top"', 'aria-label="Helpdesk TIK — kembali ke atas"')
    .replace('Apakah data pada grafik merupakan data warga?', 'Apakah ilustrasi menampilkan data warga?')
    .replace('Tidak. Grafik dan kartu menggunakan data contoh untuk memeriksa tampilan dan interaksi.', 'Tidak. Ilustrasi merupakan aset visual panduan layanan dan tidak memuat data pribadi warga.');
  const guideLabels = ['akun','jaringan','aplikasi','perangkat'];
  let labelIndex = 0;
  source = source.replace(/(aria-label=")Open [^"]+ detail(")/g, (_, start, end) => start+'Buka panduan '+guideLabels[labelIndex++ % 4]+end);
  for (const [key, label] of Object.entries({finishing:'Akun', handles:'Jaringan', shooting:'Aplikasi', footwork:'Perangkat'})) {
    source = source.replace(new RegExp('(<button[^>]*data-filter="'+key+'"[^>]*>)[^<]*'), '$1'+label);
  }
  source = source.replace('<span class="vy-console-count" id="vy-gallery-count" aria-live="polite">4 / 4</span>', '<span class="vy-console-count" id="vy-gallery-count" aria-live="polite">4 / 4</span><button type="button" class="btn btn-secondary vy-btn-open-lightbox" id="btn-open-gallery-lightbox" title="Buka penampil galeri resolusi penuh">Buka galeri</button>');
  source = source.replaceAll('<!-- 1. Full-Viewport Cinematic Basketball Stage -->', '<!-- 1. Full-Viewport Cinematic Hero Stage -->')
    .replaceAll('<!-- 2. Problem Manifesto & 4 Specialized Basketball Pipelines -->', '<!-- 2. Alur Pelaporan & 4 Kategori Layanan TIK -->')
    .replaceAll('<!-- 6. Interactive 24h Basketball Telemetry Chart -->', '<!-- 6. Grafik Aktivitas Layanan TIK -->')
    .replaceAll('<!-- 7. Basketball Telemetry FAQ Accordion -->', '<!-- 7. Tanya Jawab Layanan TIK Accordion -->')
    .replaceAll('aria-label="Target pipeline characteristics"', 'aria-label="Karakteristik alur layanan"');
  source = source.replace('FRAME 01 / BASELINE', 'ILUSTRASI LAYANAN KOTA DEPOK')
    .replace('href="#gallery">Buka katalog lengkap', 'href="/layanan.html">Buka katalog layanan');
  source = source.replace(/<footer class="vy-footer" id="site-footer">[\s\S]*?<\/footer>/, footer());
  return source.replaceAll('href="/lapor.html"', 'href="/layanan.html"');
}

function flowSteps() {
  return `<section class="vy-section vy-shell hd-flow" id="alur-pelaporan">
    <div class="hd-flow__head">
      <span class="vy-eyebrow hd-flow__eyebrow">ALUR MUDAH 3 LANGKAH</span>
      <h2 class="vy-h2 hd-flow__title">Cara Melaporkan Kendala &amp; Kebutuhan TIK</h2>
      <p class="hd-flow__subtitle">Panduan praktis bagi Masyarakat dan Aparatur Sipil Negara (ASN) Pemerintah Kota Depok untuk menyampaikan laporan hingga penanganan tuntas.</p>
    </div>
    <div class="vy-paths-grid">
      <article class="vy-path-card">
        <div class="hd-flow__body">
          <div class="hd-flow__num hd-flow__num--1">1</div>
          <h3 class="vy-path-card__title hd-flow__card-title">Pilih Kategori Layanan</h3>
          <p class="hd-flow__desc">Temukan layanan yang sesuai dari 16 katalog resmi TIK Diskominfo Kota Depok: Jaringan Internet &amp; WiFi, Aplikasi Informatika, Tata Kelola SPBE &amp; Email Dinas, atau Tanggap Insiden Siber (Depok-CSIRT).</p>
        </div>
        <a class="btn hd-flow__cta" href="/layanan.html">Buka Katalog Layanan &rarr;</a>
      </article>
      <article class="vy-path-card">
        <div class="hd-flow__body">
          <div class="hd-flow__num hd-flow__num--2">2</div>
          <h3 class="vy-path-card__title hd-flow__card-title">Lengkapi Form &amp; Bukti</h3>
          <p class="hd-flow__desc">Isi formulir spesifik kendala dan lampirkan bukti foto/dokumen. <strong class="hd-flow__strong">Masyarakat</strong> mendapat Kunci Pelacakan Rahasia tanpa perlu login; <strong class="hd-flow__strong">ASN</strong> didukung penyimpanan draft otomatis.</p>
        </div>
        <a class="btn hd-flow__cta" href="/lapor.html">Buat Laporan Baru &rarr;</a>
      </article>
      <article class="vy-path-card">
        <div class="hd-flow__body">
          <div class="hd-flow__num hd-flow__num--3">3</div>
          <h3 class="vy-path-card__title hd-flow__card-title">Pantau &amp; Konfirmasi</h3>
          <p class="hd-flow__desc">Pantau proses verifikasi dan pengerjaan teknisi secara transparan, berbalas pesan dengan petugas, dan konfirmasi penyelesaian (Setuju / Keberatan) saat penanganan selesai.</p>
        </div>
        <a class="btn hd-flow__cta" href="/lacak.html">Lacak Status Tiket &rarr;</a>
      </article>
    </div>
  </section>`;
}

function footer() {
  return `<footer class="vy-footer" id="site-footer">
    <div class="vy-tail-case">
      <div class="vy-tail-mid">
        <div class="vy-tail-signature">
          <a href="/" aria-label="Beranda Helpdesk TIK Kota Depok">
            <img src="${asset}05_Brand/logo-light.png" width="56" height="56" loading="lazy" alt="">
            <span>Helpdesk TIK<small>KOTA DEPOK</small></span>
          </a>
          <p>Portal resmi pelayanan dan bantuan teknologi informasi komunikasi bagi masyarakat, aparatur sipil negara, dan perangkat daerah Pemerintah Kota Depok.</p>
        </div>
        <nav class="vy-tail-paths" aria-label="Navigasi footer">
          <h2 class="vy-eyebrow">Navigasi</h2>
          <a href="/layanan.html">Katalog Layanan</a>
          <a href="/panduan.html">Panduan</a>
          <a href="/lapor.html">Buat laporan</a>
          <a href="/faq.html">Pertanyaan Umum (FAQ)</a>
          <a href="/tiket.html">Tiket Saya</a>
          <a href="/status.html">Status layanan</a>
          <a href="/lacak.html">Lacak Tiket Tamu</a>
          <a href="/kontak.html">Kontak layanan</a>
        </nav>
        <div class="vy-tail-top">
          <h2 class="vy-eyebrow">Bantuan petugas</h2>
          <div data-helpdesk-health></div>
          <a class="vy-detail-link" href="/admin/auth/login.html">Ruang Kerja Petugas &rarr;</a>
        </div>
        <div class="vy-tail-biz">
          <p>Dinas Komunikasi dan Informatika Kota Depok · Gedung Dibaleka II Lantai 7 Balai Kota Depok, Jl. Margonda Raya No. 54.</p>
          <div class="vy-tail-share">
            <a href="/status.html">Status layanan</a>
            <a href="#top" aria-label="Kembali ke atas">Kembali ke atas ↑</a>
          </div>
        </div>
      </div>
    </div>
    <script type="module" src="/helpdesk/health.js"></script>
  </footer>`;
}

function accessCards() {
  const badges = [
    '<span class="vy-eyebrow vy-eyebrow--public">Layanan Publik &amp; Tamu Aktif</span>',
    '<span class="vy-eyebrow vy-eyebrow--asn">Layanan kedinasan</span>',
    '<span class="vy-eyebrow vy-eyebrow--admin">Penanganan tiket</span>'
  ];
  return '<div id="akses" class="hd-access"><span class="vy-eyebrow">AKSES LAYANAN RESMI</span><h2 class="vy-h2">Untuk Kebutuhan Anda.</h2><div class="vy-paths-grid">'+[
    ['Masyarakat Umum','Layanan publik terpadu (WiFi Publik, Aplikasi DSW) dan tanggap darurat insiden siber (Depok-CSIRT) tanpa perlu login. Gunakan kunci pelacakan untuk membuka kembali laporan tamu.','bantuan-operator'],
    ['ASN Kota Depok','Layanan kedinasan penuh (Email Dinas @depok.go.id, Subdomain/Hosting, TTE BSrE, Integrasi SPLP, Colocation Server). Masuk dengan akun ASN untuk menggunakan layanan kedinasan dan melanjutkan draf laporan.','kolaborasi-opd'],
    ['Petugas Layanan','Ruang kerja terpadu untuk verifikasi, disposisi teknisi, koordinasi vendor, jeda waktu penanganan, dan pemantauan target SLA.','tiket-helpdesk'],
  ].map(([title,body,image],index)=>'<article class="vy-path-card"><img class="hd-service-art" src="'+asset+'03_Ilustrasi_Pendukung/ilustrasi-'+image+'.png" width="512" height="512" loading="lazy" alt=""><h3 class="vy-path-card__title">'+title+'</h3><p>'+body+'</p><a class="btn" href="'+['/layanan.html','/akses.html','/admin/app/helpdesk/index.html'][index]+'">'+['Lihat Layanan Publik','Masuk dengan akun ASN','Ruang Petugas'][index]+' →</a>'+badges[index]+'</article>').join('')+'</div></div>';
}
