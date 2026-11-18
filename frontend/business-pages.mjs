import { primaryProfiles, specialProfiles } from './admin-profiles.mjs';
import { renderMasterOptions, adminItems, adminNavLink, queueViews } from './admin-navigation.mjs';
/** Compose business consumers from the ORIGINAL PIUI shells, fields, cards and dialog. */
export const businessAssets = '<link rel="stylesheet" href="/helpdesk/business.css"><script type="module" src="/helpdesk/m0-03.js"></script>';
export function publicJourneyNav(admin = false) {
  if (admin) return `<nav class="hd-ticket-nav" aria-label="Navigasi kerja petugas">${['dashboard','tickets','reports'].map(id => adminNavLink(adminItems.find(item => item.id === id), '', 'piui-btn piui-btn--secondary')).join('')}</nav>`;
  const cls = 'btn hd-btn-nav';
  const link = (href, label, audience = '', permission = '') =>
    '<a class="' + cls + '" href="' + href + '"' +
    (audience ? ' data-hd-audience="' + audience + '"' : '') +
    (permission ? ' data-hd-permission="' + permission + '"' : '') +
    (audience && audience !== 'guest' || permission ? ' hidden' : '') + '>' + label + '</a>';
  return '<nav class="hd-actions hd-ticket-nav" aria-label="Navigasi layanan">' +
    link('/layanan.html', 'Pilih layanan') +
    link('/tiket.html', 'Tiket saya', 'requester') +
    link('/lacak.html', 'Lacak tiket tamu', 'guest') +
    link('/akses.html', 'Masuk akun', 'guest') +
    link('/admin/app/dashboard/index.html', 'Ruang petugas', 'staff') + '</nav>';
}
const session = '<div class="hd-session" aria-label="Sesi pengguna"><p data-hd-session role="status">Memeriksa sesi…</p>' +
  publicJourneyNav() + '<button class="btn btn-secondary" data-hd-logout type="button" hidden>Keluar akun</button></div>';
export function registerForm() {
  return `<form class="vy-contact-form hd-auth-card" data-hd-register data-local-mutation data-local-ready>
    <div class="hd-callout hd-callout--info">
      <p>
        <strong>Pendaftaran akun warga di lab.</strong> Isi data sintetis dengan format yang benar. Verifikasi identitas dan pemberitahuan ke nomor telepon belum aktif.
      </p>
    </div>
    <div class="vy-input-group">
      <label for="reg-nik">NIK Uji (16 Digit) <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-nik" name="nik" type="text" pattern="[0-9]{16}" inputmode="numeric" maxlength="16" placeholder="16 digit angka sintetis" required autocomplete="off">
    </div>
    <div class="vy-input-group">
      <label for="reg-name">Nama Uji <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-name" name="name" type="text" maxlength="200" placeholder="Nama sintetis" required autocomplete="name">
    </div>
    <div class="vy-input-group">
      <label for="reg-email">Alamat Email Uji <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-email" name="email" type="email" maxlength="254" placeholder="contoh@example.invalid" required autocomplete="email">
    </div>
    <div class="vy-input-group">
      <label for="reg-phone">Nomor Telepon Uji <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-phone" name="phone" type="tel" maxlength="16" placeholder="Contoh: 081234567890" required autocomplete="tel">
    </div>
    <div class="vy-input-group">
      <label for="reg-password">Kata Sandi Baru <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-password" name="password" type="password" minlength="8" placeholder="Minimal 8 karakter" required autocomplete="new-password">
    </div>
    <div class="vy-input-group">
      <label for="reg-password-confirm">Konfirmasi Kata Sandi <span class="hd-req-mark">*</span></label>
      <input class="vy-input" id="reg-password-confirm" name="password_confirm" type="password" minlength="8" placeholder="Ulangi kata sandi" required autocomplete="new-password">
    </div>
    <div class="hd-check-group">
      <label class="hd-check-label">
        <input class="hd-check-input" type="checkbox" name="agreement" required>
        <span>Saya hanya menggunakan data sintetis untuk pengujian lab.</span>
      </label>
    </div>
    <p class="hd-status-line" data-hd-register-status role="status" tabindex="-1"></p>
    <div class="hd-actions hd-actions--spaced">
      <button class="btn btn-primary hd-flex-1" type="submit"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru &rarr;</button>
      <a class="btn btn-secondary" href="/akses.html"><span class="hd-btn-icon">🔐</span> Sudah Punya Akun? Masuk</a>
    </div>
  </form>`;
}

export function loginForm(admin = false) {
  if (admin) {
    return `<form class="piui-card hd-admin-login" data-hd-login data-hd-admin-login data-local-mutation data-local-ready>
      <div class="piui-dialog__header hd-login-header">
        <strong id="login-modal-title">Konsol Petugas Helpdesk TIK</strong>
        <button type="button" class="piui-icon-btn" data-close-dialog aria-label="Tutup formulir masuk">
          <svg width="18" height="18" aria-hidden="true"><use href="/admin/assets/icons/piui-sprite.svg#icon-close"></use></svg>
        </button>
      </div>
      <div class="piui-dialog__body">
        <p class="piui-demo-notice hd-demo-notice-compact" data-hd-lab-notice>
          Lingkungan lab sintetis Helpdesk TIK. Gunakan akun lab terdaftar atau pemilih identitas sintetis. SSO kedinasan belum diaktifkan; jangan masukkan kredensial produksi.
        </p>
        <div class="piui-field">
          <label for="hd-admin-identifier">NIK / Email Akun Lab</label>
          <input class="piui-input" id="hd-admin-identifier" name="identifier" type="text" placeholder="NIK atau email akun lab terdaftar" required autocomplete="username">
        </div>
        <div class="piui-field">
          <label for="hd-admin-password">Kata Sandi Akun Lab</label>
          <input class="piui-input" id="hd-admin-password" name="password" type="password" placeholder="Masukkan kata sandi" required autocomplete="current-password">
        </div>
        <p class="hd-status-line--sm" data-hd-login-status role="status" tabindex="-1"></p>
        <div class="hd-actions--compact">
          <button class="piui-btn piui-btn--primary hd-flex-1" type="submit">Masuk Konsol Petugas</button>
          <a class="piui-btn piui-btn--secondary" href="/">Portal Publik</a>
        </div>
        <div class="hd-divider-top" data-hd-sso-panel hidden>
          <button type="button" class="piui-btn piui-btn--secondary hd-flex-1" data-hd-sso-login>Masuk SSO ASN Pemkot Depok</button>
        </div>
        
        <div class="hd-divider-top" data-hd-lab-section>
          <p class="hd-divider-title">
            Aktivasi Cepat Peran Lab (1-Klik Tanpa Mengetik):
          </p>
          <p class="hd-profile-intro">Pilih satu dari lima profil tugas. Akun lab diaktifkan hanya untuk pengujian sintetis.</p>
          <div class="hd-lab-role-grid" aria-label="Lima profil utama petugas">
            ${primaryProfiles.map(profile => `<button type="button" class="piui-btn piui-btn--secondary hd-profile-choice" disabled data-quick-login="${profile.id}"><strong>${profile.label}</strong><span>${profile.description}</span></button>`).join('')}
          </div>
          <details class="hd-access-details"><summary>Akun lab lainnya dan akses khusus</summary>
          <div class="piui-field hd-field-mt">
            <label for="hd-subject">Pilih akun dan lingkup kewenangannya:</label>
            <select class="piui-input hd-select-compact" id="hd-subject" name="subject" disabled>
              <option value="">Memuat identitas lab…</option>
            </select>
            <button type="button" class="piui-btn piui-btn--secondary" data-hd-lab-select disabled>Masuk sebagai identitas lab terpilih</button>
          </div>
          </details>
          <p role="status" tabindex="-1" data-hd-lab-status></p>
        </div>
      </div>
    </form>`;
  }

  // Publik (Warga & ASN)
  return `<div class="vy-contact-form hd-auth-card">
    <div role="tablist" aria-label="Kategori Pengguna Masuk" class="hd-auth-tabs">
      <button type="button" role="tab" aria-selected="true" aria-controls="auth-panel-warga" id="auth-tab-warga" data-auth-tab="warga" class="hd-auth-tab" aria-label="Warga Masyarakat">
        Warga
      </button>
      <button type="button" role="tab" aria-selected="false" aria-controls="auth-panel-asn" id="auth-tab-asn" data-auth-tab="asn" class="hd-auth-tab" aria-label="Aparatur Sipil Negara (ASN)">
        ASN
      </button>
    </div>

    <!-- Panel Warga -->
    <form data-hd-login data-hd-auth-mode="warga" id="auth-panel-warga" role="tabpanel" aria-labelledby="auth-tab-warga" data-local-mutation data-local-ready>
      <p class="vy-form-privacy hd-privacy-lead" data-hd-warga-lead>
        Mode lab sintetis. Masuk menggunakan NIK atau email akun lab terdaftar untuk menyampaikan permohonan dan memantau status tiket.
      </p>
      <div class="vy-input-group">
        <label for="hd-warga-identifier">NIK / Email <span class="hd-req-mark">*</span></label>
        <input class="vy-input" id="hd-warga-identifier" name="identifier" type="text" placeholder="NIK 16 digit atau email aktif" required autocomplete="username">
      </div>
      <div class="vy-input-group">
        <label for="hd-warga-password">Kata Sandi <span class="hd-req-mark">*</span></label>
        <input class="vy-input" id="hd-warga-password" name="password" type="password" placeholder="Masukkan kata sandi" required autocomplete="current-password">
      </div>
      <p class="hd-status-line" data-hd-login-status role="status" tabindex="-1"></p>
      <div class="hd-actions hd-actions--auth">
        <button class="btn btn-primary hd-flex-1" type="submit"><span class="hd-btn-icon">🔓</span> Masuk sebagai Warga &rarr;</button>
        <a class="btn btn-secondary" href="/daftar.html"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru</a>
      </div>
    </form>

    <!-- Panel ASN -->
    <form data-hd-login data-hd-auth-mode="asn" id="auth-panel-asn" role="tabpanel" aria-labelledby="auth-tab-asn" hidden data-local-mutation data-local-ready>
      <div class="hd-callout--asn" data-hd-lab-callout>
        <strong>Akses ASN — lingkungan lab sintetis</strong>
        <p>Integrasi SSO kedinasan belum diaktifkan. Gunakan pemilih ASN sintetis di bawah; jangan masukkan kata sandi kedinasan.</p>
      </div>
      <div class="vy-input-group">
        <label for="hd-asn-identifier">NIK / Email Akun Lab <span class="hd-req-mark">*</span></label>
        <input class="vy-input" id="hd-asn-identifier" name="identifier" type="text" placeholder="NIK atau email akun lab terdaftar" required autocomplete="username">
      </div>
      <div class="vy-input-group">
        <label for="hd-asn-password">Kata Sandi Akun Lab <span class="hd-req-mark">*</span></label>
        <input class="vy-input" id="hd-asn-password" name="password" type="password" placeholder="Kata sandi akun lab terdaftar" required autocomplete="current-password">
      </div>
      <p class="hd-status-line" data-hd-login-status role="status" tabindex="-1"></p>
      <div class="hd-actions hd-actions--auth">
        <button class="btn btn-primary hd-w-full" type="submit"><span class="hd-btn-icon">🏛️</span> Masuk dengan akun ASN (lab) Depok &rarr;</button>
      </div>
      <div data-hd-sso-panel hidden>
        <div class="hd-actions">
          <button type="button" class="btn btn-secondary hd-w-full" data-hd-sso-login>Masuk dengan SSO ASN Pemerintah Kota Depok &rarr;</button>
        </div>
      </div>
    </form>

    <!-- Opsi Uji Cepat Lab Penguji -->
    <div class="hd-divider-top" data-hd-lab-section>
      <p class="hd-divider-title">
        ⚡ Mode Uji Cepat Penguji / Evaluator (1-Klik):
      </p>
      <div class="hd-quick-row">
        <button type="button" class="btn btn-secondary hd-quick-btn" disabled data-quick-login="warga"><span class="hd-btn-icon">👤</span> Warga Mandiri (Publik A)</button>
        <button type="button" class="btn btn-secondary hd-quick-btn" disabled data-quick-login="asn"><span class="hd-btn-icon">🏛️</span> ASN Pemohon (Bappeda)</button>
      </div>
      <div class="vy-input-group hd-field-flush">
        <label class="hd-label-sm" for="hd-subject">Atau pilih dari seluruh akun sintetis server:</label>
        <select class="vy-input hd-select-compact" id="hd-subject" name="subject" disabled>
          <option value="">Memuat identitas lab…</option>
        </select>
        <button type="button" class="btn btn-secondary" data-hd-lab-select disabled>Masuk sebagai identitas lab terpilih</button>
        <p role="status" tabindex="-1" data-hd-lab-status></p>
      </div>
    </div>
  </div>`;
}
const banner = (title, intro) => `<section class="vy-leaf-banner"><p class="court-badge">Helpdesk TIK Kota Depok</p><h1 class="vy-leaf-head">${title}</h1><p class="vy-leaf-brief">${intro}</p></section>`;

function faqSection() {
  return `<section class="vy-contact-form hd-faq-section">
    <h2>Pertanyaan Umum &amp; Solusi Cepat (FAQ)</h2>
    <p>Temukan jawaban langsung untuk pertanyaan umum seputar layanan teknologi informasi dan komunikasi Pemerintah Kota Depok.</p>
    <div class="hd-faq-list">
      <details class="hd-faq-item" name="hd-faq">
        <summary>Bagaimana cara mengajukan akun email resmi @depok.go.id?</summary>
        <p>Permohonan akun email kedinasan dapat diajukan oleh ASN melalui menu <strong>Katalog Layanan &rarr; Layanan Penerbitan Akun Email Kedinasan</strong>. Lampirkan Surat Keputusan (SK) Pengangkatan atau Surat Tugas resmi dari Kepala OPD yang bersangkutan.</p>
      </details>
      <details class="hd-faq-item" name="hd-faq">
        <summary>Berapa lama target waktu penyelesaian laporan gangguan jaringan (SLA)?</summary>
        <p>Sesuai Standar Operasional Prosedur (SOP) Diskominfo Kota Depok, laporan gangguan koneksi internet/intranet memiliki target respon maksimal 1 jam dan target resolusi 4 hingga 8 jam kerja (Senin–Jumat 08.00–16.00 WIB).</p>
      </details>
      <details class="hd-faq-item" name="hd-faq">
        <summary>Bagaimana prosedur pelaporan insiden keamanan siber ke Depok-CSIRT?</summary>
        <p>Insiden keamanan (seperti defacement, ransomware, atau peretasan akun) dapat dilaporkan baik oleh masyarakat maupun ASN melalui layanan <strong>Penanganan Insiden Keamanan Informasi (Depok-CSIRT)</strong> atau melalui Call Center Kedaruratan 112 dengan kalender layanan darurat 24 jam / 7 hari (CAL-247).</p>
      </details>
      <details class="hd-faq-item" name="hd-faq">
        <summary>Bagaimana cara masyarakat melacak laporan tanpa memiliki akun ASN?</summary>
        <p>Masyarakat yang mengajukan permohonan melalui layanan publik akan menerima <strong>Kunci Pelacakan Rahasia (Capability Token)</strong> 64-karakter hex. Kunci tersebut dimasukkan pada halaman <strong>Lacak Tiket Tamu</strong> untuk melihat status dan berkomunikasi langsung dengan petugas tanpa login.</p>
      </details>
      <details class="hd-faq-item" name="hd-faq">
        <summary>Apakah permohonan sertifikat Tanda Tangan Elektronik (TTE) membutuhkan verifikasi tatap muka?</summary>
        <p>Penerbitan TTE bekerja sama dengan Balai Sertifikasi Elektronik (BSrE) BSSN. Verifikasi identitas kependudukan dan biometrik dilakukan secara elektronik melalui sistem terintegrasi, dengan konfirmasi akhir dari Verifikator Diskominfo Kota Depok.</p>
      </details>
    </div>
    <div class="hd-actions hd-actions--spaced">
      <a class="btn btn-primary" href="/layanan.html"><span class="hd-btn-icon">📋</span> Buka Katalog Layanan &rarr;</a>
      <a class="btn btn-secondary" href="/panduan.html"><span class="hd-btn-icon">📖</span> Lihat Panduan Lengkap</a>
    </div>
  </section>`;
}

function statusSection() {
  return `<section class="vy-contact-form hd-faq-section">
    <h2>Status Operasional Layanan &amp; Infrastruktur SPBE</h2>
    <p>Pemantauan langsung kesiapan gerbang aplikasi, katalog layanan aktif, serta kalender operasional Helpdesk TIK Kota Depok.</p>
    <p data-hd-status-observed role="status">Memeriksa status layanan…</p>
    <div class="hd-status-grid">
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Gerbang Aplikasi &amp; Basis Data Helpdesk</strong></div>
        <p class="hd-status-tile__body">Kondisi: <strong data-hd-status-api>Memeriksa kesiapan…</strong><br>Kalender utama: CAL-1 (Senin–Jumat 08.00–16.00 WIB)</p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Katalog Layanan TIK Resmi</strong></div>
        <p class="hd-status-tile__body">Akses: <strong data-hd-status-catalog>Memuat katalog…</strong><br>Pemohon publik &amp; ASN terhubung melalui portal tunggal</p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Pusat Pengetahuan &amp; Pelacakan Tiket</strong></div>
        <p class="hd-status-tile__body">Kondisi: <strong>Aktif</strong><br>Pelacakan tamu memakai Capability Key 64 karakter</p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Depok-CSIRT &amp; Monitoring Keamanan</strong></div>
        <p class="hd-status-tile__body">Kondisi: <strong data-hd-status-csirt>Siaga 24/7 (CAL-247)</strong><br>Kedaruratan siber: Layanan <code>TIK-SEC-01</code> / Call Center 112</p>
      </div>
      <div class="hd-status-tile" data-hd-status-maintenance>
        <div class="hd-status-tile__head"><span class="hd-status-dot" data-hd-status-maint-dot></span><strong>Status Pemeliharaan Sistem</strong></div>
        <p class="hd-status-tile__body">Status: <strong data-hd-status-maint-state>Memeriksa jendela pemeliharaan…</strong><br><span data-hd-status-maint-desc>Pemeliharaan terjadwal dan darurat diinformasikan secara terbuka.</span></p>
      </div>
    </div>
    <div class="hd-status-window">
      <h3 class="hd-status-window__title">Jadwal Layanan &amp; Jendela Pemeliharaan</h3>
      <p class="hd-status-window__desc">Layanan reguler operasional berlangsung setiap hari kerja <strong>Senin–Jumat pukul 08.00–16.00 WIB</strong>, sedangkan pelaporan insiden keamanan siber Depok-CSIRT didukung <strong>24 jam / 7 hari (CAL-247)</strong>.</p>
    </div>
    <div class="hd-actions hd-actions--spaced">
      <a class="btn btn-primary" href="/layanan.html">📋 Buka Katalog Layanan &rarr;</a>
      <a class="btn btn-secondary" href="/kontak.html">📍 Kontak &amp; Lokasi Layanan</a>
    </div>
  </section>`;
}

function contactSection() {
  return `<section class="vy-contact-form hd-faq-section">
    <h2>Kontak Resmi &amp; Lokasi Pelayanan Helpdesk TIK</h2>
    <p>Pengaduan kendala, permohonan fasilitas TIK kedinasan, dan pelaporan insiden siber diproses terpusat melalui sistem tiket agar setiap penanganan memiliki nomor register dan batas SLA yang terukur.</p>
    <div class="hd-status-grid">
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Kantor Layanan Diskominfo Kota Depok</strong></div>
        <p class="hd-status-tile__body">Gedung Dibaleka II Lantai 7, Balai Kota Depok<br>Jl. Margonda Raya No. 54, Pancoran Mas, Kota Depok 16431</p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Jam Operasional Meja Layanan (CAL-1)</strong></div>
        <p class="hd-status-tile__body">Senin – Jumat: <strong>08.00 – 16.00 WIB</strong><br>Dikecualikan hari libur nasional &amp; cuti bersama</p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Tanggap Insiden Siber (Depok-CSIRT)</strong></div>
        <p class="hd-status-tile__body">Siaga <strong>24 Jam / 7 Hari (CAL-247)</strong><br>Kedaruratan Kota Depok: <strong>Call Center 112</strong> · Layanan <code>TIK-SEC-01</code></p>
      </div>
      <div class="hd-status-tile">
        <div class="hd-status-tile__head"><span class="hd-status-dot"></span><strong>Pengiriman Tiket &amp; Pelacakan Resmi</strong></div>
        <p class="hd-status-tile__body">Masyarakat dapat melapor tanpa login pada layanan publik dan memantau progres melalui kunci pelacakan 64 karakter.</p>
      </div>
    </div>
    <div class="hd-actions hd-actions--spaced">
      <a class="btn btn-primary" href="/layanan.html">📋 Pilih Layanan &amp; Buat Laporan &rarr;</a>
      <a class="btn btn-secondary" href="/lacak.html">🔎 Lacak Tiket Tamu</a>
      <a class="btn btn-secondary" href="/faq.html">❓ Tanya Jawab (FAQ)</a>
    </div>
  </section>`;
}

function knowledgeSection(pageKind = 'knowledge') {
  const isPage = pageKind === 'pages';
  const listHref = isPage ? '/halaman.html' : '/panduan.html';
  const heading = isPage ? 'Halaman Portal Resmi TIK' : 'Basis Pengetahuan TIK';
  const lead = isPage
    ? 'Informasi resmi layanan SPBE, pengumuman, dan ketentuan operasional TIK Kota Depok.'
    : 'Temukan panduan layanan dan penanganan kendala TIK Kota Depok.';
  const noun = isPage ? 'halaman' : 'panduan';
  return `<div class="hd-knowledge-portal" data-hd-knowledge="${isPage ? 'PAGE' : 'ARTICLE'}">
    <section class="hd-kb-hero" aria-labelledby="hd-kb-heading" data-hd-kb-list>
      <h1 id="hd-kb-heading" class="hd-kb-hero__title">${heading}</h1>
      <p>${lead}</p>
      <form data-hd-kb-search action="${listHref}" method="get">
        <label for="hd-knowledge-search">Cari ${noun}</label>
        <div class="hd-kb-query">
          <input type="search" name="q" id="hd-knowledge-search" class="vy-input" maxlength="100" placeholder="Judul atau topik ${noun}">
          <button class="btn btn-secondary" type="submit">Cari</button>
        </div>
      </form>
    </section>
    <p data-hd-kb-status role="status" tabindex="-1">Memuat ${noun}…</p>
    <button type="button" class="btn btn-secondary" data-hd-kb-retry hidden>Coba lagi</button>
    <section class="hd-featured-guide" aria-labelledby="hd-kb-featured-title" data-hd-kb-featured hidden>
      <div class="hd-featured-guide__content">
        <h2 id="hd-kb-featured-title" class="hd-featured-guide__title"></h2>
        <p class="hd-featured-guide__desc" data-hd-kb-featured-summary></p>
        <a class="btn btn-primary" data-hd-kb-featured-link>Baca ${noun}</a>
      </div>
      <div class="hd-featured-guide__visual">
        <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png" width="480" height="270" alt="">
      </div>
    </section>
    <div class="hd-knowledge-grid" data-hd-kb-cards aria-label="Daftar ${noun}"></div>
    <nav class="hd-actions hd-pager-nav" data-hd-kb-pager aria-label="Halaman ${noun}" hidden>
      <button class="btn btn-secondary" type="button" data-hd-kb-prev>Sebelumnya</button>
      <button class="btn btn-secondary" type="button" data-hd-kb-next>Berikutnya</button>
    </nav>
    <section data-hd-kb-detail hidden>
      <p><a href="${listHref}">Kembali ke daftar ${noun}</a></p>
      <article class="vy-contact-form" data-hd-kb-reader hidden>
        <h1 data-hd-kb-title></h1>
        <p class="hd-kb-metadata" data-hd-kb-meta></p>
        <div class="hd-kb-body" data-hd-kb-body></div>
      </article>
    </section>
    <noscript><p>Aktifkan JavaScript untuk membuka ${noun} yang tersedia saat ini.</p></noscript>
  </div>`;
}

export function publicBusinessPage(source, kind) {
 let main = '';
 if (kind === 'register') main = banner('Pendaftaran Akun Warga', 'Registrasi lingkungan lab sintetis. Gunakan data uji; validasi format NIK belum merupakan verifikasi identitas Dukcapil.') + registerForm();
 if (kind === 'login') main = banner('Akses Layanan TIK', 'Akses akun lab atau identitas sintetis untuk mencoba layanan. Integrasi SSO dan verifikasi identitas nyata belum diaktifkan.') + loginForm();
 if (kind === 'catalog') main = banner('Katalog Layanan TIK', 'Pilih layanan sesuai kebutuhan dan hak akses Anda. Jika belum yakin, mulai dari laporan kendala TIK umum.') + session + '<div class="hd-actions"><a class="btn btn-primary" href="/lapor.html?id=31000000-0000-4000-8000-000000000001">Laporkan kendala TIK umum</a></div><div class="hd-search-box" data-hd-search-wrap><label for="hd-public-search" class="u-sr-only">Cari layanan atau panduan</label><div class="vy-input-group hd-search-input"><input type="search" maxlength="100" id="hd-public-search" class="vy-input" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="hd-search-suggestions" aria-activedescendant="" placeholder="Cari layanan, panduan, atau informasi TIK..." autocomplete="off"><ul id="hd-search-suggestions" class="hd-suggestions-list" role="listbox" aria-label="Saran layanan dan panduan" hidden></ul></div><p id="hd-search-status" role="status"></p></div><form class="vy-contact-form hd-form-grid hd-catalog-filter" data-hd-catalog-filter hidden><div class="vy-input-group"><label for="hd-catalog-q">Filter kata kunci</label><input id="hd-catalog-q" class="vy-input" type="search" maxlength="100" placeholder="Nama atau kode layanan..."></div><div class="vy-input-group"><label for="hd-catalog-category">Kategori</label><select id="hd-catalog-category" class="vy-input"><option value="">Semua kategori</option></select></div><div class="vy-input-group"><label for="hd-catalog-access">Hak akses</label><select id="hd-catalog-access" class="vy-input"><option value="">Semua akses</option><option value="PUBLIC_GUEST">Publik tanpa login</option><option value="PUBLIC_AUTH">Publik dengan akun</option><option value="ASN_AUTH">Khusus ASN</option></select></div></form><p data-hd-status role="status" tabindex="-1">Memuat katalog…</p><div class="hd-catalog" data-hd-catalog></div><nav class="hd-actions hd-pager-nav" aria-label="Halaman katalog"><button class="btn hd-btn-pager" data-hd-prev disabled><span aria-hidden="true">←</span> Halaman Sebelumnya</button><button class="btn hd-btn-pager" data-hd-next disabled>Halaman Berikutnya <span aria-hidden="true">→</span></button></nav>';
 if (kind === 'detail') main = banner('Detail Spesifikasi Layanan', 'Periksa parameter SLA, persyaratan teknis, dan formulir permohonan sebelum mengajukan tiket.') + session + '<p data-hd-status role="status" tabindex="-1">Memuat layanan…</p><article class="vy-contact-form" data-hd-detail hidden><h2 data-hd-service-name></h2><p data-hd-service-meta></p><h3>Pratinjau formulir layanan</h3><div data-hd-fields></div><p data-hd-policy></p><p class="vy-form-privacy">Isian di atas adalah pratinjau. Gunakan tombol Buat laporan untuk mengisi dan mengirim tiket melalui formulir operasional.</p></article>';
 if (kind === 'faq') main = banner('Tanya Jawab (FAQ)', 'Pertanyaan yang sering diajukan seputar layanan TIK, permohonan fasilitas, dan penanganan kendala SPBE Kota Depok.') + faqSection();
 if (kind === 'status') main = banner('Status Layanan TIK', 'Informasi ketersediaan gerbang aplikasi, katalog layanan resmi, dan kalender operasional SPBE Kota Depok.') + statusSection();
 if (kind === 'contact') main = banner('Kontak &amp; Lokasi Layanan', 'Alamat kantor pelayanan, jam operasional, dan kanal resmi pengajuan bantuan Helpdesk TIK Pemerintah Kota Depok.') + contactSection();
 if (kind === 'knowledge' || kind === 'pages') main = knowledgeSection(kind);

 const titleMap = {
   register: 'Daftar Akun Warga',
    login: 'Akses Layanan',
   catalog: 'Katalog Layanan',
   detail: 'Detail Layanan',
   faq: 'Tanya Jawab (FAQ)',
   status: 'Status Layanan',
   contact: 'Kontak & Lokasi Layanan',
   knowledge: 'Basis Pengetahuan & Panduan Operasional TIK',
   pages: 'Halaman Portal Resmi Helpdesk TIK'
 };

 return source.replace(/<title>[\s\S]*?<\/title>/, '<title>Helpdesk TIK · ' + (titleMap[kind] || 'Layanan TIK') + '</title>')
 .replace(/<main\b[\s\S]*?<\/main>/, '<main id="main-content" class="vy-shell u-pb-96" data-hd-page="' + kind + '">' + main + '</main>')
 .replace(/<script\b[^>]*contact\.js[^>]*><\/script>/g, '').replace('</head>', businessAssets + '</head>');
}
const field = (label, name, type = 'text', placeholder = '', hint = '') => `<div class="piui-field" data-hd-field="${name}"><label for="hd-${name}">${label}</label><input class="piui-input" id="hd-${name}" name="${name}" type="${type}" maxlength="200"${placeholder ? ` placeholder="${placeholder}"` : ''}>${hint ? `<small>${hint}</small>` : ''}</div>`;
const select = (label, name, options = '', hint = '', extra = '') => `<div class="piui-field" data-hd-field="${name}"><label for="hd-${name}">${label}</label><select class="piui-input" id="hd-${name}" name="${name}">${options}</select>${hint ? `<small>${hint}</small>` : ''}${extra}</div>`;
const orgShortcut = '<div class="hd-field-shortcuts"><a class="hd-field-shortcut" href="/admin/app/helpdesk/index.html?kind=organizations#new" data-hd-shortcut="organizations">+ Tambah PD / Unit Kerja Baru</a></div>';
const subjectShortcut = '<div class="hd-field-shortcuts"><a class="hd-field-shortcut" href="/admin/app/helpdesk/index.html?kind=subjects#new" data-hd-shortcut="subjects">+ Buat Akun Pengguna Baru</a></div>';
export function adminBusinessPage(source) {
 const main = `<main id="main-content" class="piui-main" data-hd-page="admin">
 <div class="piui-page-header"><div class="piui-page-header__titles"><h1>Master layanan dan akses</h1><p class="piui-page-subtitle">Kelola master sesuai mandat organisasi. Perubahan disimpan pada server.</p></div></div>
 <div class="piui-card hd-session"><div class="hd-session-inner"><div class="hd-session-identity"><p data-hd-session role="status" class="hd-session-name">Memeriksa sesi…</p><span class="hd-session-desc">Lingkungan lab sintetis Helpdesk TIK Kota Depok.</span></div><div class="hd-actions"><a class="piui-btn piui-btn--secondary piui-btn--sm" href="/admin/auth/login.html" data-admin-account-switch>Masuk petugas</a><button class="piui-btn piui-btn--secondary piui-btn--sm" data-admin-logout hidden type="button">Keluar akun</button></div></div><p data-hd-login-status role="status" tabindex="-1"></p></div>
 <p data-hd-status role="status" tabindex="-1"></p>
 <section data-hd-admin hidden>
 <div class="piui-card"><div class="court-badge hd-callout--admin-violet"><strong>Konsol Administrator Helpdesk TIK Kota Depok:</strong> Pilih halaman pengelolaan sesuai tugas Anda. Periksa isian sebelum menyimpan perubahan.</div><div class="hd-master-toolbar"><div class="piui-field hd-master-picker-field"><label for="hd-master-kind">Halaman pengelolaan</label><select class="piui-input" id="hd-master-kind" disabled>${renderMasterOptions()}</select></div><div class="hd-actions hd-master-actions"><button class="piui-btn piui-btn--primary" type="button" data-hd-new>+ Tambah data</button><button class="piui-btn piui-btn--secondary" type="button" data-hd-refresh>Muat ulang</button></div></div>
 <div class="hd-table-wrap"><table class="piui-table"><caption data-hd-caption>Daftar master</caption><thead><tr><th scope="col">Data</th><th scope="col">Organisasi</th><th scope="col">Status / versi</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-rows></tbody></table></div>
 <nav class="hd-actions" aria-label="Halaman master"><button class="piui-btn piui-btn--secondary" data-hd-prev disabled>Sebelumnya</button><button class="piui-btn piui-btn--secondary" data-hd-next disabled>Berikutnya</button></nav></div>
 <form class="piui-card hd-form-panel" data-hd-master-form data-local-mutation data-local-ready>
  <div class="hd-form-panel__head">
    <div class="hd-form-panel__titles">
      <div class="hd-form-panel__kicker"><span class="hd-mode-badge" data-hd-editor-badge>Data Baru</span></div>
      <h2 data-hd-editor-title>Tambah layanan</h2>
      <p class="hd-form-panel__sub" data-hd-editor-version>Data baru</p>
    </div>
    <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-cancel-master>Bersihkan Isian</button>
  </div>
  <div class="hd-form-grid">
 ${field('Kode *', 'code', 'text', 'Contoh: TIK-NET-01', 'Kode unik identitas tanpa spasi atau garis miring.')}${field('Nama resmi / lengkap *', 'name', 'text', 'Masukkan nama layanan, unit, kategori, atau akun...')}${select('Jenis akun *', 'subject-kind', '<option value="STAFF">Petugas / Staf Kedinasan</option><option value="ASN">Pegawai ASN Pelapor</option><option value="PUBLIC">Masyarakat / Pengguna Publik</option>', 'Menentukan tipe akun dan pilihan peran bawaan yang sah.')}${select('Peran akun *', 'subject-role', '<option value="OPERATOR">Operator Layanan</option><option value="TECHNICIAN">Teknisi Penanganan</option><option value="COORDINATOR">Koordinator Layanan</option><option value="LEADERSHIP">Pimpinan / Pengawas</option><option value="EDITOR">Editor Pengetahuan</option><option value="PUBLISHER">Penerbit Portal</option><option value="AUDITOR">Auditor Kepatuhan</option><option value="ADMIN_OPD">Admin Perangkat Daerah</option><option value="PLATFORM_ADMIN">Admin Platform</option><option value="SUPER_ADMIN">Super Admin</option><option value="ASN">ASN Pelapor</option><option value="PUBLIC">Pengguna Publik</option>', 'Peran bawaan saat akun diberi hak akses pada organisasi.')}${field('NIP / NIK / ID Referensi', 'external-ref', 'text', 'Contoh: 199001012015011001', 'Opsional; disarankan diisi sebagai nomor induk pegawai atau referensi unik.')}${field('Email kedinasan / akun', 'email', 'email', 'nama@depok.go.id', 'Opsional; digunakan untuk login lokal dan korespondensi pemberitahuan.')}${field('Nomor HP / WhatsApp', 'phone', 'tel', '081234567890', 'Opsional; nomor kontak aktif pemegang akun.')}<div class="piui-field" data-hd-field="password"><label for="hd-password">Kata sandi awal / baru (opsional)</label><input class="piui-input" id="hd-password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Minimal 8 karakter; kosongkan bila tidak diubah"><small>Isi minimal 8 karakter agar akun dapat langsung masuk memakai NIP/email dan kata sandi.</small></div>${select('OPD / organisasi *', 'org', '', '', orgShortcut)}${select('Bidang tim (opsional)', 'division', '<option value="">Tanpa bidang</option>')}${select('Kategori', 'category', '<option value="">Tanpa kategori</option>')}
 ${select('Audience layanan', 'access', '<option value="PUBLIC_GUEST">Publik tanpa login</option><option value="PUBLIC_AUTH">Publik dengan akun</option><option value="ASN_AUTH">ASN sesuai organisasi</option><option value="STAFF_ONLY">Petugas sesuai organisasi</option>')}
 <div class="piui-field" data-hd-field="access-profile"><label for="hd-access-profile">Filter profil tugas akun (opsional)</label><select class="piui-input" id="hd-access-profile" name="access-profile" data-hd-optional><option value="">Semua profil tugas</option>${primaryProfiles.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}</select><small>Menyaring akun sesuai perannya. Peran akun tidak diubah melalui formulir ini.</small></div>
 <details class="hd-access-details hd-col-full" data-hd-field="access-special"><summary>Akses khusus dan pemohon</summary><div class="piui-field"><label for="hd-access-special">Jenis akses khusus</label><select class="piui-input" id="hd-access-special" name="access-special" data-hd-optional><option value="">Pilih akses khusus</option>${specialProfiles.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}</select><small>Gunakan bila memberi mandat delegasi kepada Editor, Penerbit, Auditor, atau Pemohon.</small></div></details>
 ${select('Akun pengguna *', 'member-subject', '', 'Pilih akun terdaftar atau saring menggunakan profil di atas.', subjectShortcut)}${select('Tim teknis (opsional)', 'team', '<option value="">Tanpa tim</option>')}${field('Berlaku sampai (WIB) *', 'expires', 'datetime-local', '', 'Otomatis diisi 1 tahun ke depan pada tambah data (maksimal 2 tahun).')}
 <section class="hd-access-summary hd-col-full" data-hd-field="access-summary" aria-labelledby="hd-access-summary-title"><h3 id="hd-access-summary-title">Ringkasan akses</h3><p data-hd-access-summary role="status">Pilih profil, akun, dan organisasi terlebih dahulu.</p><p data-hd-access-feedback role="status"></p><button type="button" class="piui-btn piui-btn--secondary" data-hd-access-standard disabled>Gunakan akses standar</button><small>Akses standar mengikuti kewenangan akun dan batas delegasi Anda pada organisasi terpilih. Menyimpan tetap memerlukan alasan dan konfirmasi tombol Simpan.</small></section>
 <details class="hd-access-details hd-col-full" data-hd-field="permissions"><summary>Pengaturan akses lanjutan</summary><div class="piui-field"><label for="hd-permissions">Izin terpilih (kode teknis, dipisahkan koma)</label><textarea class="piui-input" id="hd-permissions" name="permissions" rows="3" placeholder="Dipilih otomatis dari daftar centang di bawah..."></textarea><small>Izin tersimpan dipertahankan sampai Anda mengubahnya. Pilihan di bawah hanya memuat izin yang boleh Anda delegasikan.</small></div><div data-hd-access-choices class="hd-access-choices"></div></details>
 <div class="piui-field hd-col-full" data-hd-field="reason"><label for="hd-reason">Alasan perubahan akses *</label><input class="piui-input" id="hd-reason" name="reason" type="text" maxlength="200" placeholder="Contoh: Penugasan Operator sesuai SK Kepala Dinas TIK Nomor ..."></div>
 <div class="piui-field hd-toggle-card" data-hd-field="active"><label class="hd-toggle-card__label"><input name="active" type="checkbox" checked> <span><strong>Status Aktif</strong><small>Tampil dan dapat dipilih pada layanan serta operasional. Hapus centang untuk mengarsipkan/menonaktifkan.</small></span></label></div><div class="piui-field hd-toggle-card" data-hd-field="reporting-visible"><label class="hd-toggle-card__label"><input name="reporting-visible" type="checkbox"> <span><strong>Direktori Laporan Publik</strong><small>Tampilkan OPD ini pada formulir pelaporan publik tanpa login.</small></span></label></div><div class="piui-field hd-toggle-card hd-toggle-card--warn hd-col-full" data-hd-field="revoked"><label class="hd-toggle-card__label"><input name="revoked" type="checkbox"> <span><strong>Cabut akses organisasi ini</strong><small>Mencabut sementara atau permanen seluruh mandat keanggotaan akun pada organisasi terpilih.</small></span></label></div>
 </div>
 <p data-hd-save-status role="status" tabindex="-1"></p>
 <div class="hd-form-footer"><button class="piui-btn piui-btn--primary" type="submit" disabled>Simpan ke server</button><button type="button" class="piui-btn piui-btn--secondary" data-hd-cancel-master>Batal / Buat Data Baru</button></div>
 </form>
 <section class="piui-card hd-form-panel" data-hd-service-editors hidden><div class="hd-form-panel__head"><div class="hd-form-panel__titles"><h2>Formulir dan kebijakan layanan</h2><p class="hd-form-panel__sub">Versi lama dipertahankan. Simpan satu perubahan, lalu gunakan versi terbaru dari server.</p></div></div>
 <form class="hd-subform-card" data-hd-form-editor data-local-mutation data-local-ready><h3>1. Field formulir tambahan</h3><div data-hd-form-fields></div><div class="hd-actions"><button class="piui-btn piui-btn--secondary" data-hd-add-field type="button">+ Tambah field</button><button class="piui-btn piui-btn--primary" type="submit">Simpan versi formulir baru</button></div><p data-hd-form-status role="status" tabindex="-1"></p></form>
 <form class="hd-subform-card" data-hd-policy-editor data-local-mutation data-local-ready><h3>2. Kebijakan unggahan dan audience</h3><div class="hd-form-grid">${field('Ukuran maksimum (byte, maksimal 10485760)', 'upload', 'number', 'Contoh: 5242880')}<div class="piui-field"><label for="hd-mime">MIME yang diizinkan</label><select class="piui-input" id="hd-mime" name="mime" multiple><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="application/pdf">PDF</option></select></div><div class="piui-field hd-col-full"><label for="hd-audience">Organisasi audience tambahan</label><select class="piui-input" id="hd-audience" name="audience" multiple></select><small>Gunakan Ctrl/Command untuk memilih lebih dari satu.</small></div></div><div class="hd-form-footer"><button class="piui-btn piui-btn--primary" type="submit">Simpan versi kebijakan baru</button></div><p data-hd-policy-status role="status" tabindex="-1"></p></form><form class="hd-subform-card" data-hd-routing-editor data-local-mutation data-local-ready hidden><h3>3. Aturan Smart Dispatch</h3><p class="hd-form-panel__sub">Aturan kategori terverifikasi didahulukan. Tim lintas OPD menjadi saran pelimpahan untuk Koordinator.</p><div class="hd-form-grid"><div class="piui-field"><label for="hd-route-category">Kategori terverifikasi</label><select class="piui-input" id="hd-route-category" name="category"></select></div><div class="piui-field"><label for="hd-route-tier">Tingkat teknisi</label><select class="piui-input" id="hd-route-tier" name="tier"><option>L1</option><option>L2</option></select></div><div class="piui-field"><label for="hd-route-org">Perangkat daerah tujuan</label><select class="piui-input" id="hd-route-org" name="organization" required></select></div><div class="piui-field"><label for="hd-route-team">Tim penanganan</label><select class="piui-input" id="hd-route-team" name="team" required></select></div><div class="piui-field"><label for="hd-route-skills">Kode kompetensi, dipisahkan koma</label><input class="piui-input" id="hd-route-skills" name="skills" required placeholder="network, wifi"></div><div class="piui-field"><label for="hd-route-reason">Alasan perubahan</label><input class="piui-input" id="hd-route-reason" name="reason" minlength="5" maxlength="2000" placeholder="Jelaskan alasan pembaruan rute dispatch..." required></div><div class="piui-field hd-toggle-card hd-col-full"><label class="hd-toggle-card__label"><input type="checkbox" name="active" checked> <span><strong>Aturan Smart Dispatch aktif</strong><small>Terapkan aturan ini otomatis saat operator memverifikasi tiket kategori terkait.</small></span></label></div></div><p role="status"></p><div class="hd-form-footer"><button class="piui-btn piui-btn--primary" type="submit" disabled>Simpan aturan</button></div></form></section>
 
  <section class="piui-card" data-hd-m9-section hidden>
    <h2>Laporan, Notifikasi dan Jejak Audit (M9)</h2>
    <div data-hd-m9-tabs class="hd-actions">
      <button type="button" class="piui-btn piui-btn--primary" data-hd-tab="reports">Laporan SLA</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab="notifications">Notifikasi &amp; Telegram</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab="audit">Jejak Audit</button>
    </div>

    <!-- Panel Laporan -->
    <div data-hd-panel="reports" class="piui-panel">
      <h3>Laporan Kinerja SLA dan Ekspor</h3>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-report-org">Organisasi</label><select class="piui-input" id="hd-report-org"></select></div>
        <div class="piui-field"><label for="hd-report-from">Dari (WIB)</label><input class="piui-input" type="datetime-local" id="hd-report-from"></div>
        <div class="piui-field"><label for="hd-report-to">Sampai (WIB)</label><input class="piui-input" type="datetime-local" id="hd-report-to"></div>
      </div>
      <div class="hd-actions">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-fetch-report>Tampilkan Laporan</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-open-export aria-haspopup="dialog">Ajukan Ekspor Data</button>
      </div>
      <div data-hd-report-summary class="piui-summary-card hd-summary-card" hidden>
        <p><strong>Metrik Kepatuhan:</strong> <span data-hd-rep-measure>-</span></p>
        <p><strong>Penyelesaian dengan target terukur:</strong> <span data-hd-rep-denominator>0</span></p>
        <p><strong>Jumlah Memenuhi Target:</strong> <span data-hd-rep-count>0</span></p>
        <p data-hd-rep-cohort></p>
        <p><strong>Fakta terbaru:</strong> <span data-hd-rep-watermark>-</span></p>
      </div>
    </div>

    <!-- Dialog Modal Ekspor (AC20 Accessible) -->
    <dialog data-hd-export-dialog class="piui-dialog hd-dialog-box" role="dialog" aria-modal="true" aria-labelledby="hd-export-title">
      <div class="piui-dialog__header hd-dialog-header">
        <h3 id="hd-export-title">Ekspor Data Laporan (M9)</h3>
        <button type="button" class="piui-icon-btn" data-hd-close-export aria-label="Tutup dialog ekspor">&times;</button>
      </div>
      <form data-hd-export-form class="hd-dialog-form">
        <div class="piui-field"><label for="hd-export-cohort">Cohort Tiket</label><select class="piui-input" id="hd-export-cohort"><option value="ACCEPTED">Diterima (ACCEPTED)</option><option value="RESOLVED">Selesai (RESOLVED)</option><option value="OPEN">Terbuka (OPEN)</option></select></div>
        <div class="piui-field"><label for="hd-export-format">Format Berkas</label><select class="piui-input" id="hd-export-format"><option value="CSV">CSV (Comma-Separated Values tersanitasi)</option><option value="JSON">JSON Terstruktur</option></select></div>
        <p data-hd-export-status role="status" class="hd-status-line"></p>
        <div class="hd-actions">
          <button type="submit" class="piui-btn piui-btn--primary">Mulai Ekspor</button>
          <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-export>Batal</button>
        </div>
        <div data-hd-download-area class="hd-dialog-form" hidden>
          <a data-hd-download-link class="piui-btn piui-btn--primary" href="/admin/app/helpdesk/index.html#download-file" download>Unduh Berkas Ekspor</a>
        </div>
      </form>
    </dialog>

    <!-- Panel Telegram & Notifikasi -->
    <div data-hd-panel="notifications" class="piui-panel" hidden>
      <div class="hd-section-bar">
        <h3>Kotak Masuk Notifikasi (M9)</h3>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-refresh-notif>Segarkan Notifikasi</button>
      </div>
      <p data-hd-notif-status role="status"></p>
      <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Judul / Ringkasan</th><th scope="col">Waktu</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-notif-rows></tbody></table></div>
      <div class="hd-subform-card hd-table-mt">
        <h3 data-hd-tg-heading>Pengikatan saluran notifikasi (M9)</h3>
        <form data-hd-telegram-form class="hd-form-grid">
          <div class="piui-field"><label for="hd-tg-org">Organisasi Scope</label><select class="piui-input" id="hd-tg-org"></select></div>
          <div class="piui-field"><label for="hd-tg-code">Kode sekali pakai</label><input class="piui-input" id="hd-tg-code" type="text" autocomplete="off" readonly required placeholder="Klik Terbitkan kode tantangan..."></div>
          <div class="piui-field hd-col-full" data-hd-tg-chat-wrap hidden><label for="hd-tg-chat-ref">ID Chat / Username Telegram *</label><input class="piui-input" id="hd-tg-chat-ref" type="text" maxlength="64" placeholder="Contoh: 998877665"></div>
          <div class="hd-form-footer hd-col-full">
            <button type="button" class="piui-btn piui-btn--secondary" data-hd-tg-challenge>Terbitkan kode tantangan</button>
            <button type="submit" class="piui-btn piui-btn--primary" data-hd-tg-bind>Hubungkan saluran</button>
          </div>
        </form>
        <div class="hd-actions" data-hd-sink-bound hidden><button type="button" class="piui-btn piui-btn--secondary hd-btn-warn-outline" data-hd-tg-revoke>Cabut pengikatan</button></div>
        <p data-hd-telegram-status role="status"></p>
      </div>
      <div class="hd-divider-top" data-hd-delivery-panel hidden>
        <div class="hd-section-bar">
          <h3>Antrean Pengiriman Saluran (Telegram &amp; Email M9)</h3>
          <div class="hd-actions hd-actions--flush">
            <select class="piui-input" id="hd-delivery-state" aria-label="Filter status pengiriman">
              <option value="">Semua status</option>
              <option value="DEAD_LETTER">Dead Letter</option>
              <option value="FAILED">Gagal (Retry)</option>
              <option value="PENDING">Pending</option>
              <option value="ACKED">Terkirim (ACKED)</option>
            </select>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-refresh-delivery>Segarkan Antrean</button>
          </div>
        </div>
        <p data-hd-delivery-status role="status"></p>
        <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Kanal</th><th scope="col">Target Teredaksi</th><th scope="col">Status</th><th scope="col">Percobaan / Galat</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-delivery-rows></tbody></table></div>
      </div>
    </div>

    <!-- Panel Audit -->
    <div data-hd-panel="audit" class="piui-panel" hidden>
      <h3>Jejak Audit Append-Only (AC20)</h3>
      <div class="hd-actions"><button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-audit>Segarkan Jejak Audit</button></div>
      <div class="hd-table-wrap"><table class="piui-table" data-hd-audit-table><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Objek</th><th>Hasil</th><th>Alasan</th></tr></thead><tbody data-hd-audit-rows></tbody></table></div>
    </div>
  </section>

  <section class="piui-card" data-hd-m11-section hidden>
    <h2>Pemeliharaan, pekerjaan sistem, dan diagnostik (M1)</h2>
    <div data-hd-m11-tabs class="hd-actions">
      <button type="button" class="piui-btn piui-btn--primary" data-hd-tab-m11="maintenance">Mode Pemeliharaan</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-m11="runner">Scoped Runner</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-m11="scheduler">Penjadwalan (M7)</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-m11="health">Status Redacted</button>
    </div>

    <!-- Panel Mode Pemeliharaan -->
    <div data-hd-panel-m11="maintenance" class="piui-panel">
      <div class="hd-maint-live-card" data-hd-maint-live>
        <div class="hd-maint-live-card__info">
          <span class="hd-maint-live-badge is-normal" data-hd-maint-live-badge>OPERASIONAL NORMAL</span>
          <strong data-hd-maint-live-title>Sistem beroperasi penuh tanpa jendela pemeliharaan aktif.</strong>
          <small data-hd-maint-live-meta>Gunakan formulir di bawah untuk mengaktifkan mode "Under Maintenance" (Terjadwal maupun Tidak Terjadwal / Darurat).</small>
        </div>
        <div class="hd-actions">
          <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-maint-refresh>Segarkan</button>
          <button type="button" class="piui-btn piui-btn--primary piui-btn--sm" data-hd-maint-stop hidden>Hentikan Pemeliharaan Sekarang</button>
        </div>
      </div>

      <div class="hd-subform-card hd-table-mt">
        <h3>Konfigurasi Mode &amp; Jadwal "Under Maintenance" (M1)</h3>
        <form data-hd-maintenance-form class="hd-form-grid" data-local-mutation>
          <div class="piui-field"><label for="hd-maint-schedule-kind">Jenis Pemeliharaan *</label><select class="piui-input" id="hd-maint-schedule-kind"><option value="UNSCHEDULED">Tidak Terjadwal / Darurat (Aktif Seketika)</option><option value="SCHEDULED">Terjadwal (Sesuai Waktu Mulai–Selesai)</option></select><small>Pilih "Tidak Terjadwal" untuk penanganan darurat mendadak, atau "Terjadwal" untuk rencana perawatan berkala.</small></div>
          <div class="piui-field"><label for="hd-maint-display">Tampilan pada Portal Publik *</label><select class="piui-input" id="hd-maint-display"><option value="FULL_SCREEN">Layar Penuh "Under Maintenance" (Tutup Portal Publik)</option><option value="BANNER">Banner Pengumuman (Portal Tetap Terbaca)</option></select><small>Layar penuh menutup seluruh halaman Web Publik dengan pengumuman pemeliharaan (halaman Status &amp; Web Admin tetap dapat diakses).</small></div>
          <div class="piui-field"><label for="hd-maint-mode">Pembatasan Operasi API *</label><select class="piui-input" id="hd-maint-mode"><option value="READ_ONLY">Read-Only (Blokir Semua Pengiriman / Mutasi)</option><option value="DRAIN">Drain (Tutup Pembuatan Tiket Baru, Tiket Lama Tetap Berjalan)</option><option value="NORMAL">Normal (Hentikan Semua Pemeliharaan Aktif &amp; Terjadwal)</option></select></div>
          <div class="piui-field"><label for="hd-maint-org">Organisasi Scope</label><select class="piui-input" id="hd-maint-org"></select></div>
          <div class="piui-field"><label for="hd-maint-start">Waktu Mulai (WIB) *</label><input class="piui-input" type="datetime-local" id="hd-maint-start" required></div>
          <div class="piui-field"><label for="hd-maint-end">Estimasi Selesai (WIB) *</label><input class="piui-input" type="datetime-local" id="hd-maint-end" required></div>
          <div class="piui-field hd-col-full"><label for="hd-maint-reason">Pesan Pengumuman untuk Pengguna *</label><textarea class="piui-input" id="hd-maint-reason" rows="2" maxlength="500" placeholder="Contoh: Pembaruan keamanan dan infrastruktur server SPBE Kota Depok sedang berlangsung..." required></textarea></div>
          <div class="hd-form-footer hd-col-full">
            <button type="submit" class="piui-btn piui-btn--primary">Terapkan Kebijakan Pemeliharaan</button>
          </div>
        </form>
        <p data-hd-maint-status role="status" tabindex="-1"></p>
      </div>

      <div class="hd-section-bar hd-table-mt">
        <h4>Jadwal Aktif, Terjadwal &amp; Riwayat Pemeliharaan</h4>
      </div>
      <div class="hd-table-wrap"><table class="piui-table"><caption class="u-sr-only">Daftar jendela pemeliharaan sistem</caption><thead><tr><th scope="col">Jendela Waktu (WIB)</th><th scope="col">Jenis &amp; Tampilan</th><th scope="col">Mode</th><th scope="col">Pesan</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-maint-rows></tbody></table></div>
    </div>

    <!-- Panel Scoped Operational Runner -->
    <div data-hd-panel-m11="runner" class="piui-panel" hidden>
      <div class="hd-subform-card">
        <h3>Scoped Operational Runner (AC24)</h3>
        <p class="piui-demo-notice">Runner sistem beroperasi dengan daftar tindakan terbatas (allowlist). Eksekusi shell bebas, perintah sistem arbitrer, atau konsol SQL tidak diizinkan.</p>
        <form data-hd-runner-form class="hd-form-grid" data-local-mutation>
          <div class="piui-field"><label for="hd-runner-org">Organisasi Scope</label><select class="piui-input" id="hd-runner-org"></select></div>
          <div class="piui-field"><label for="hd-runner-kind">Jenis Tugas Operasional</label><select class="piui-input" id="hd-runner-kind"><option value="BACKUP_MANIFEST">Manifest Backup (BACKUP_MANIFEST)</option><option value="HEALTH_REPORT">Laporan Diagnosa (HEALTH_REPORT)</option><option value="PURGE_REQUEST">Permintaan Purge Retensi (PURGE_REQUEST)</option></select></div>
          <div class="piui-field hd-col-full"><label for="hd-runner-reason">Alasan Operasi *</label><input class="piui-input" id="hd-runner-reason" type="text" placeholder="Justifikasi operasional..." required></div>
          <div class="hd-form-footer hd-col-full">
            <button type="submit" class="piui-btn piui-btn--primary">Ajukan pekerjaan</button>
          </div>
        </form>
      </div>
      <div class="hd-section-bar hd-table-mt">
        <h4>Daftar Pekerjaan Sistem Terkini</h4>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-refresh-ops>Segarkan Pekerjaan</button>
      </div>
      <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">ID</th><th scope="col">Jenis</th><th scope="col">Status</th><th scope="col">Alasan</th><th scope="col">Aksi</th></tr></thead><tbody data-hd-ops-rows></tbody></table></div>
      <div class="hd-subform-card hd-table-mt">
        <h4>Persetujuan &amp; Eksekusi Pekerjaan Terpilih</h4>
        <form data-hd-review-job class="hd-form-grid">
          <div class="piui-field"><label for="hd-runner-job">ID pekerjaan *</label><input class="piui-input" id="hd-runner-job" placeholder="Klik 'Pilih ke Runner' pada tabel di atas..." required></div>
          <div class="piui-field"><label for="hd-runner-approval-reason">Alasan persetujuan / eksekusi</label><input class="piui-input" id="hd-runner-approval-reason" maxlength="500" placeholder="Catat justifikasi persetujuan dua-petugas..."></div>
          <div class="hd-form-footer hd-col-full"><button type="submit" class="piui-btn piui-btn--secondary">Lihat status</button><button type="submit" class="piui-btn piui-btn--secondary" data-hd-approve-job>Setujui sebagai petugas kedua</button><button type="submit" class="piui-btn piui-btn--primary" data-hd-execute-job>Jalankan Manifest</button><a class="piui-btn piui-btn--secondary" data-hd-artifact-link target="_blank" rel="noopener" hidden>Unduh Artefak Manifest</a></div>
        </form>
        <p data-hd-runner-status role="status"></p>
      </div>
      <div data-hd-runner-result class="piui-card hd-runner-output-card" hidden>
        <h4>Rincian pekerjaan</h4>
        <pre data-hd-runner-output class="hd-runner-output-pre"></pre>
      </div>
    </div>

    <!-- Panel Penjadwalan M7 -->
    <div data-hd-panel-m11="scheduler" class="piui-panel" hidden>
      <div class="hd-section-bar">
        <h3>Antrean Penjadwalan &amp; Dead-Letter (M7)</h3>
        <div class="hd-actions hd-actions--flush">
          <select class="piui-input" id="hd-scheduler-state" aria-label="Filter status job">
            <option value="">Semua status</option>
            <option value="DEAD_LETTER">Dead Letter</option>
            <option value="PENDING">Pending</option>
            <option value="ACKED">Selesai (ACKED)</option>
          </select>
          <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-scheduler>Muat Ulang</button>
        </div>
      </div>
      <p data-hd-scheduler-status role="status"></p>
      <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Tiket</th><th scope="col">Jenis Job</th><th scope="col">Status</th><th scope="col">Percobaan / Galat</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-scheduler-rows></tbody></table></div>
    </div>

    <!-- Panel Status Redacted -->
    <div data-hd-panel-m11="health" class="piui-panel" hidden>
      <h3>Status Kesehatan Sistem Teredaksi (AC24)</h3>
      <div class="hd-actions"><button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-health>Periksa Kesehatan Sistem</button></div>
      <p data-hd-health-status role="status"></p>
      <div class="hd-table-wrap hd-table-mt"><table class="piui-table" data-hd-health-table><thead><tr><th>Komponen</th><th>Status</th><th>Keterangan</th></tr></thead><tbody data-hd-health-rows></tbody></table></div>
    </div>
  </section>

  <section class="piui-card" data-hd-rules-section hidden>
    <div class="hd-section-bar">
      <div>
        <h2>Konfigurasi Aturan Layanan, Routing, SLA &amp; Eskalasi</h2>
        <p class="hd-section-bar__sub">Kelola status aktif aturan operasional M4–M7 secara auditabel dan optimistik.</p>
      </div>
      <div class="hd-actions hd-actions--flush">
        <select class="piui-input" id="hd-rule-owner" aria-label="Pilih domain aturan">
          <option value="classification">Klasifikasi (M4)</option>
          <option value="routing">Routing Teknisi (M5)</option>
          <option value="sla">Kalender SLA (M6)</option>
          <option value="escalation">Eskalasi (M7)</option>
        </select>
        <button type="button" class="piui-btn piui-btn--primary" data-hd-new-rule>+ Tambah Aturan Baru</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-rules>Muat Ulang</button>
      </div>
    </div>
    <p data-hd-rules-status role="status"></p>
    <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Kode Aturan</th><th scope="col">Ringkasan</th><th scope="col">Versi</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-rules-rows></tbody></table></div>
    <form class="hd-subform-card hd-form-panel hd-table-mt" data-hd-rule-form>
      <div class="hd-form-panel__head">
        <div class="hd-form-panel__titles">
          <div class="hd-form-panel__kicker"><span class="hd-mode-badge" data-hd-rule-badge>Tambah / Perbarui</span></div>
          <h3 data-hd-rule-form-title>Formulir Aturan Operasional</h3>
        </div>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-cancel-rule>Bersihkan Isian</button>
      </div>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-rule-code">Kode aturan *</label><input class="piui-input" id="hd-rule-code" name="code" required maxlength="200" placeholder="Contoh: NET-CORE-L1"><small>Isi kode baru untuk menambah aturan, atau klik Ubah pada tabel.</small></div>
        <div class="piui-field"><label for="hd-rule-active">Status aktif</label><select class="piui-input" id="hd-rule-active" name="active"><option value="true">Aktif (diterapkan sistem)</option><option value="false">Nonaktif (arsip)</option></select></div>
        <div class="piui-field"><label for="hd-rule-ver">Versi record (optimistic lock)</label><input class="piui-input" id="hd-rule-ver" name="expected_version" type="number" min="1" value="1" required><small>Otomatis terisi saat menyunting aturan eksisting.</small></div>
        <div class="piui-field"><label for="hd-rule-rv">Revisi versi aturan</label><input class="piui-input" id="hd-rule-rv" name="rule_version" type="number" min="1" value="1" required></div>
        <div class="piui-field hd-col-full"><label for="hd-rule-reason">Alasan perubahan aturan (min. 5 karakter) *</label><input class="piui-input" id="hd-rule-reason" name="reason" required minlength="5" maxlength="2000" placeholder="Jelaskan alasan penambahan, pembaruan, atau penonaktifan aturan..."></div>
      </div>
      <div class="hd-form-footer"><button type="submit" class="piui-btn piui-btn--primary">Simpan Perubahan Aturan</button></div>
    </form>
  </section>

  <!-- Pengelolaan Portal & Navigasi Publik (M2) -->
  <section class="piui-card hd-form-panel" data-hd-role-policy-section hidden>
    <div class="hd-form-panel__head"><div class="hd-form-panel__titles"><h2>Kebijakan akses peran</h2><p class="hd-form-panel__sub">Pilih peran dan tindakan yang boleh diberikan. Perubahan berlaku pada semua akun dengan peran tersebut. Izin setiap akun tetap mengikuti OPD dan penugasannya.</p></div><button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-role-refresh>Muat ulang</button></div>
    <form data-local-mutation data-local-ready><div class="piui-field"><label for="hd-role-policy-select">Peran yang dikonfigurasi</label><select class="piui-input" id="hd-role-policy-select" disabled></select></div><div data-role-choices></div><div class="piui-field"><label for="hd-role-policy-reason">Alasan perubahan kebijakan *</label><textarea class="piui-input" id="hd-role-policy-reason" required minlength="5" maxlength="1000" rows="2" placeholder="Uraikan alasan penyesuaian hak akses peran (min. 5 karakter)..."></textarea></div><div class="hd-form-footer"><button type="submit" class="piui-btn piui-btn--primary" disabled>Simpan kebijakan</button></div><p role="status"></p></form>
  </section>
  <section class="piui-card hd-form-panel" data-hd-hero-section hidden>
    <div class="hd-form-panel__head"><div class="hd-form-panel__titles"><h2>Lima banner beranda</h2><p class="hd-form-panel__sub">Pilih gambar, isi judul dan teks alternatif, lalu susun urutan. Gambar baru bisa dipilih setelah ditandai untuk Banner Hero dan lolos pemindaian di Pustaka Media.</p></div><div class="hd-actions hd-actions--flush"><a class="piui-btn piui-btn--secondary piui-btn--sm" href="/admin/app/helpdesk/index.html?kind=media" data-admin-nav-id="media" hidden>Buka Pustaka Media</a><button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hero-more hidden>Muat pilihan gambar berikutnya</button><button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hero-refresh>Muat ulang</button></div></div>
    <form data-local-mutation data-local-ready><div data-hero-slots class="hd-hero-editor-grid"></div><div class="piui-field"><label for="hd-hero-reason">Alasan perubahan atau penerbitan *</label><textarea class="piui-input" id="hd-hero-reason" required minlength="5" maxlength="1000" rows="2" placeholder="Jelaskan alasan pembaruan draf atau penerbitan banner..."></textarea></div><div class="hd-form-footer"><button type="submit" class="piui-btn piui-btn--secondary" disabled>Simpan draf</button><button type="button" class="piui-btn piui-btn--primary" data-hero-publish disabled>Terbitkan draf</button></div><p role="status"></p></form>
  </section>
  <section class="piui-card" data-hd-navigation-section hidden>
    <div class="hd-section-bar">
      <div>
        <h2>Pengelolaan Portal &amp; Navigasi Publik (M2)</h2>
        <p class="hd-section-bar__sub">Konfigurasi hierarki menu navigasi portal publik dan pembatasan wewenang audience SPBE Kota Depok.</p>
      </div>
      <div class="hd-actions hd-actions--flush">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-new-nav>+ Tambah Rute Navigasi</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-nav>Muat Ulang</button>
      </div>
    </div>
    <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Label Menu</th><th scope="col">Rute URL</th><th scope="col">Target Audience</th><th scope="col">Posisi</th><th scope="col">Status</th></tr></thead><tbody data-hd-nav-rows></tbody></table></div>
    <form class="hd-subform-card hd-nav-form" data-hd-nav-form hidden>
      <div class="hd-form-panel__head">
        <div class="hd-form-panel__titles">
          <div class="hd-form-panel__kicker"><span class="hd-mode-badge">Rute Baru</span></div>
          <h3 data-hd-nav-form-title>Tambah Rute Navigasi Baru</h3>
        </div>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-close-nav-form>Tutup</button>
      </div>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-nav-label">Label Menu *</label><input class="piui-input" id="hd-nav-label" name="label" required maxlength="100" placeholder="Contoh: Layanan Aplikasi SPBE"></div>
        <div class="piui-field"><label for="hd-nav-route">Rute Kanonikal *</label><input class="piui-input" id="hd-nav-route" name="route" required maxlength="200" placeholder="Contoh: /layanan/aplikasi"><small>Harus diawali tanda garis miring (/).</small></div>
        <div class="piui-field"><label for="hd-nav-audience">Target Audience</label><select class="piui-input" id="hd-nav-audience" name="audience"><option value="PUBLIC_GUEST">Publik tanpa login (PUBLIC_GUEST)</option><option value="PUBLIC_AUTH">Publik dengan akun (PUBLIC_AUTH)</option><option value="ASN_AUTH">Khusus ASN Kota Depok (ASN_AUTH)</option><option value="STAFF_ONLY">Internal Petugas Diskominfo (STAFF_ONLY)</option></select></div>
        <div class="piui-field"><label for="hd-nav-position">Urutan Tampilan</label><input class="piui-input" id="hd-nav-position" name="position" type="number" value="10" min="1" max="999"></div>
      </div>
      <p data-hd-nav-status role="status" class="hd-nav-status"></p>
      <div class="hd-form-footer">
        <button type="submit" class="piui-btn piui-btn--primary">Simpan Rute Navigasi</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-nav-form>Batal</button>
      </div>
    </form>
  </section>

  <!-- Basis Pengetahuan & Editorial Artikel / Halaman Portal (M8) -->
  <section class="piui-card" data-hd-articles-section hidden>
    <div class="hd-editorial-toolbar">
      <div>
        <h2>Basis Pengetahuan &amp; Editorial Portal (M8)</h2>
        <p>Manajemen siklus hidup artikel panduan dan halaman portal resmi SPBE Kota Depok (DRAFT &rarr; REVIEW &rarr; PUBLISHED &rarr; ARCHIVED).</p>
      </div>
      <div class="hd-actions">
        <div class="hd-actions" role="group" aria-label="Jenis konten editorial" data-hd-editorial-kind-tabs>
          <button type="button" class="piui-btn piui-btn--primary" data-hd-editorial-kind="ARTICLE" aria-pressed="true">Artikel Panduan (ARTICLE)</button>
          <button type="button" class="piui-btn piui-btn--secondary" data-hd-editorial-kind="PAGE" aria-pressed="false">Halaman Portal (PAGE)</button>
        </div>
        <button type="button" class="piui-btn piui-btn--primary" data-hd-new-article>+ Tulis Artikel / Halaman Baru</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-articles>Muat Ulang</button>
      </div>
    </div>
    <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Judul Artikel</th><th scope="col">Slug URL</th><th scope="col">Audience</th><th scope="col">Status Editorial</th><th scope="col">Versi</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-articles-rows></tbody></table></div>
    <p data-hd-editorial-status role="status"></p>
    <nav class="hd-actions" aria-label="Halaman editorial">
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-editorial-prev disabled>Sebelumnya</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-editorial-next disabled>Berikutnya</button>
    </nav>
    <form class="hd-subform-card hd-form-panel" data-hd-article-form method="post" data-local-mutation hidden>
      <div class="hd-form-panel__head">
        <div class="hd-form-panel__titles">
          <div class="hd-form-panel__kicker"><span class="hd-mode-badge" data-hd-article-badge>Draft Editorial</span></div>
          <h3 data-hd-article-form-title>Tulis Artikel Panduan Baru</h3>
        </div>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-close-art-form>Tutup</button>
      </div>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-art-title">Judul Panduan *</label><input class="piui-input" id="hd-art-title" name="title" required maxlength="200" placeholder="Contoh: Panduan Akses Jaringan Intra Pemerintah Daerah"></div>
        <div class="piui-field"><label for="hd-art-slug">Slug URL *</label><input class="piui-input" id="hd-art-slug" name="slug" required maxlength="100" placeholder="otomatis-dari-judul-panduan"><small>Otomatis terbentuk dari judul saat menulis baru (dapat disesuaikan).</small></div>
        <div class="piui-field"><label for="hd-art-audience">Audience</label><select class="piui-input" id="hd-art-audience" name="audience"><option value="PUBLIC_GUEST">Publik (PUBLIC_GUEST)</option><option value="PUBLIC_AUTH">Publik Terdaftar (PUBLIC_AUTH)</option><option value="ASN_AUTH">Khusus ASN (ASN_AUTH)</option><option value="STAFF_ONLY">Internal Petugas (STAFF_ONLY)</option></select></div>
        <div class="piui-field"><label for="hd-art-alt">Ringkasan / Alt Deskripsi</label><input class="piui-input" id="hd-art-alt" name="alt" maxlength="200" placeholder="Ringkasan singkat isi panduan..."></div>
        <div class="piui-field hd-col-full hd-editorial-body"><label for="hd-art-body">Isi panduan (teks atau HTML dasar) *</label><textarea class="piui-input" id="hd-art-body" name="body" rows="7" required placeholder="Tuliskan langkah-langkah panduan operasional dengan bahasa yang mudah dipahami..."></textarea></div>
      </div>
      <p data-hd-article-status role="status"></p>
      <div class="hd-form-footer">
        <button type="submit" class="piui-btn piui-btn--primary">Simpan Draft Artikel</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-art-form>Batal</button>
      </div>
    </form>
  </section>

  <!-- Pustaka Media Terpadu Dua Owner (M3/M8) -->
  <section class="piui-card" data-hd-media-section hidden>
    <div class="hd-section-bar">
      <div>
        <h2>Pustaka Media Terpadu (M3/M8)</h2>
        <p class="hd-section-bar__sub">Pustaka media dua-owner memisahkan berkas privat tiket penanganan (M3) dari media editorial publik portal pengetahuan (M8). Terproteksi pemindaian antivirus ClamAV.</p>
      </div>
      <div class="hd-actions hd-actions--flush">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-toggle-upload>+ Unggah Media Editorial (M8)</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-media>Muat Ulang Berkas</button>
      </div>
    </div>

    <!-- Panel Form Unggah Dropzone M8 -->
    <div data-hd-media-upload-panel class="piui-card hd-upload-panel" hidden>
      <div class="hd-dialog-header">
        <h3>Unggah Media Editorial Publik Baru (M8)</h3>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-close-upload>Batal / Tutup</button>
      </div>
      <form data-hd-media-upload-form><div class="piui-field"><label for="media-upload-org">Organisasi pemilik media</label><select class="piui-input" id="media-upload-org" name="organization_id" required></select></div>
        <div class="hd-dropzone" id="hd-admin-media-dropzone" tabindex="0" role="button" aria-label="Dropzone unggah media editorial">
          <input type="file" id="hd-admin-media-file" class="hd-dropzone-input" accept="image/png,image/jpeg,application/pdf">
          <span class="hd-dropzone__icon">📤</span>
          <p class="hd-dropzone__title">Tarik &amp; lepas gambar/dokumen ke sini, atau <mark class="hd-media-mark">jelajahi berkas</mark></p>
          <p class="hd-dropzone__hint">Mendukung format PNG, JPEG, WebP, SVG, PDF. Ukuran maks 10 MB per berkas.</p>
          <div class="hd-dropzone__badges">
            <span class="hd-dropzone__badge">Maks 10 MB</span>
            <span class="hd-dropzone__badge hd-media-clamav">🛡️ Pemindaian ClamAV Aktif</span>
            <span class="hd-dropzone__badge">Owner M8 Publik</span>
          </div>
        </div>
        
        <!-- Pratinjau Berkas Terpilih -->
        <div data-hd-media-preview-box class="hd-media-preview-box" hidden>
          <div data-hd-media-preview-thumb class="hd-media-preview-thumb">
            <span class="hd-media-preview-icon">📄</span>
          </div>
          <div class="hd-media-preview-info">
            <p data-hd-media-preview-name class="hd-media-preview-name"></p>
            <p data-hd-media-preview-size class="hd-media-preview-size"></p>
          </div>
          <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-media-clear-file>Ganti Berkas</button>
        </div>

        <div class="hd-form-grid">
          <div class="piui-field">
            <label for="hd-media-alt">Judul / Deskripsi Aksesibilitas Alt (Wajib)</label>
            <input class="piui-input" id="hd-media-alt" name="alt" type="text" placeholder="Contoh: Diagram Topologi Jaringan FO Pemkot Depok" required maxlength="200">
          </div>
          <div class="piui-field">
            <label for="hd-media-caption">Keterangan / Caption Artikel (Opsional)</label>
            <input class="piui-input" id="hd-media-caption" name="caption" type="text" placeholder="Contoh: Infrastruktur Data Center Diskominfo Kota Depok" maxlength="300">
          </div>
          <div class="piui-field">
            <label for="hd-media-license">Lisensi Hak Cipta</label>
            <select class="piui-input" id="hd-media-license" name="license">
              <option value="CC-BY-4.0">Creative Commons Attribution 4.0 (CC-BY-4.0)</option>
              <option value="Hak Cipta Pemerintah Kota Depok">Hak Cipta Pemerintah Kota Depok (Hak Cipta Dilindungi)</option>
              <option value="Domain Publik SPBE">Domain Publik SPBE Kota Depok</option>
            </select>
          </div>
          <div class="piui-field">
            <label for="hd-media-source">Sumber Asal Media</label>
            <input class="piui-input" id="hd-media-source" name="source" type="text" value="Diskominfotik Kota Depok" maxlength="200">
          </div>
        </div>
        <label class="piui-field" data-hd-media-banner-option hidden><span><input name="hero_candidate" type="checkbox"> Siapkan gambar ini untuk Banner Hero</span><small>Pilih untuk gambar PNG atau JPEG yang Anda izinkan untuk ditampilkan di beranda setelah ditinjau penerbit.</small></label>
        <p data-hd-media-upload-status role="status" tabindex="-1" class="hd-nav-status"></p>
        <div class="hd-actions">
          <button type="submit" class="piui-btn piui-btn--primary" data-hd-media-submit>Unggah &amp; Pindai Antivirus ClamAV</button>
        </div>
      </form>
    </div>

    <section class="hd-subform-card" aria-labelledby="media-publication-title">
      <h2 id="media-publication-title">Tinjauan dan publikasi salinan media</h2>
      <p class="hd-form-panel__sub">Unggahan baru tersimpan privat. Editor menyiapkan berkas hasil redaksi yang berbeda. Penerbit meninjau sumber M8 (atau lampiran tiket M3 pada organisasi yang sama). Berkas tersedia setelah konten tujuan diterbitkan.</p>
      <form data-hd-media-publication>
        <fieldset class="hd-step-card">
          <legend>Langkah 1 · Media Sumber &amp; Salinan Redaksi</legend>
          <div class="hd-form-grid">
            <div class="piui-field"><label for="media-source-pick">Pilih media sumber CLEAN *</label><select class="piui-input" id="media-source-pick"><option value="">Pilih media sumber atau isi UUID manual di samping…</option></select></div>
            <div class="piui-field"><label for="media-source-id">ID media sumber *</label><input class="piui-input" id="media-source-id" name="source_id" required pattern="[a-fA-F0-9-]{36}" placeholder="Terisi otomatis saat memilih media"></div>
            <div class="piui-field"><label for="media-copy-pick">Pilih salinan hasil redaksi CLEAN *</label><select class="piui-input" id="media-copy-pick"><option value="">Pilih berkas CLEAN atau isi UUID manual di samping…</option></select></div>
            <div class="piui-field"><label for="media-copy-id">ID unggahan salinan CLEAN *</label><input class="piui-input" id="media-copy-id" name="sanitized_copy_id" required pattern="[a-fA-F0-9-]{36}" placeholder="Terisi otomatis saat memilih salinan"></div>
            <div class="piui-field"><label for="media-source-version">Versi media sumber *</label><input class="piui-input" id="media-source-version" name="expected_version" type="number" min="1" placeholder="Contoh: 1" required></div>
          </div>
        </fieldset>
        <fieldset class="hd-step-card">
          <legend>Langkah 2 · Target Konten Editorial &amp; Persetujuan</legend>
          <div class="hd-form-grid">
            <div class="piui-field"><label for="media-target-pick">Pilih artikel / halaman tujuan *</label><select class="piui-input" id="media-target-pick"><option value="">Pilih konten editorial M8 atau isi UUID manual…</option></select></div>
            <div class="piui-field"><label for="media-target-id">ID artikel atau halaman tujuan *</label><input class="piui-input" id="media-target-id" name="target_id" required pattern="[a-fA-F0-9-]{36}" placeholder="Terisi otomatis dari pilihan tujuan"></div>
            <div class="piui-field"><label for="media-target-audience">Audience konten tujuan</label><select class="piui-input" id="media-target-audience" name="target_audience"><option value="PUBLIC_GUEST">Publik tanpa login</option><option value="PUBLIC_AUTH">Publik dengan akun</option><option value="ASN_AUTH">ASN sesuai organisasi</option><option value="STAFF_ONLY">Petugas sesuai organisasi</option></select></div>
            <div class="piui-field"><label for="media-approval-id">ID persetujuan server (untuk menghubungkan)</label><input class="piui-input" id="media-approval-id" name="approval_id" placeholder="Klik 'Gunakan ID' dari tabel persetujuan di bawah"></div>
            <div class="piui-field hd-col-full"><label for="media-review-reason">Alasan dan hasil pemeriksaan redaksi *</label><textarea class="piui-input" id="media-review-reason" name="reason" minlength="5" maxlength="2000" required placeholder="Catat hasil tinjauan keamanan/editorial (min. 5 karakter)..."></textarea></div>
          </div>
        </fieldset>
        <div class="hd-form-footer"><button class="piui-btn piui-btn--secondary" type="submit" name="action" value="approve">1. Setujui hasil tinjauan sesuai mandat</button><button class="piui-btn piui-btn--primary" type="submit" name="action" value="reuse">2. Hubungkan salinan yang disetujui</button></div>
        <p data-hd-media-publication-status role="status" tabindex="-1"></p>
      </form>
      <div class="hd-section-bar hd-table-mt">
        <h3>Daftar Persetujuan Media</h3>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-refresh-approvals>Segarkan Persetujuan</button>
      </div>
      <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">ID Persetujuan</th><th scope="col">Sumber &rarr; Tujuan</th><th scope="col">Status</th><th scope="col">Alasan</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-media-approvals-rows></tbody></table></div>
    </section>
    <!-- Filter & Tab Toolbar -->
    <div class="hd-media-toolbar">
      <div class="hd-actions hd-actions--flush" data-hd-media-tabs>
        <button type="button" class="piui-btn piui-btn--primary" data-hd-tab-media="M8">Pustaka Editorial Publik (M8)</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-media="M3">Media Privat Tiket (M3)</button>
      </div>
      <div class="hd-media-filter">
        <label for="hd-media-filter-status">Filter Status:</label>
        <select class="piui-input" id="hd-media-filter-status">
          <option value="ALL">Semua Berkas</option>
          <option value="CLEAN">Hanya Bersih (CLEAN)</option>
          <option value="QUARANTINED">Karantina (QUARANTINED)</option>
        </select>
      </div>
    </div>

    <div data-hd-media-status role="status" class="hd-media-status"></div>
    <div data-hd-media-container class="hd-media-grid"></div>

    <!-- Modal Dialog Detail Teknis Media (WAI-ARIA) -->
    <dialog data-hd-media-detail-dialog class="piui-dialog hd-media-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="hd-media-detail-title">
      <div class="piui-dialog__header hd-dialog-header">
        <h3 id="hd-media-detail-title">Detail Teknis Media</h3>
        <button type="button" class="piui-icon-btn" data-hd-close-media-detail aria-label="Tutup detail media">&times;</button>
      </div>
      <div data-hd-media-detail-body class="hd-media-detail-body"></div>
      <div class="hd-actions">
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-media-detail>Tutup</button>
      </div>
    </dialog>
  </section>

  <dialog data-hd-archive-confirm class="piui-dialog hd-dialog-box" role="dialog" aria-modal="true" aria-labelledby="hd-arch-title">
    <div class="piui-dialog__header hd-dialog-header">
      <h3 id="hd-arch-title" data-hd-arch-title>Konfirmasi Perubahan Status</h3>
      <button type="button" class="piui-icon-btn" data-hd-arch-close aria-label="Tutup dialog konfirmasi">&times;</button>
    </div>
    <form data-hd-arch-form class="hd-dialog-form">
      <p class="hd-dialog-note" data-hd-arch-desc></p>
      <div class="piui-field" data-hd-arch-reason-wrap>
        <label for="hd-arch-reason">Alasan perubahan (minimal 5 karakter)</label>
        <textarea class="piui-input" id="hd-arch-reason" rows="3" maxlength="2000" placeholder="Jelaskan alasan arsip, penonaktifan, atau pencabutan..."></textarea>
      </div>
      <p data-hd-arch-status role="status" class="hd-status-line"></p>
      <div class="hd-actions">
        <button type="submit" class="piui-btn piui-btn--primary" data-hd-arch-submit>Konfirmasi</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-arch-close>Batal</button>
      </div>
    </form>
  </dialog>

  </section></main>`;
 return source.replace(/<title>[\s\S]*?<\/title>/, '<title>Master layanan dan akses · Helpdesk TIK</title>').replace(/<main\b[\s\S]*?<\/main>/, main)
 .replaceAll('id="btn-session-logout"', 'data-hd-logout').replace('budi.sec@piui-zero.internal', 'Memeriksa sesi').replace('Peran: Super Admin &amp; AppSec Lead', 'Sesi ditentukan server')
 .replace('</head>', businessAssets + '</head>');
}
export function adminLoginPage(source) {
 const copy = {
  'Prototipe tanpa autentikasi server. Gunakan data contoh; jangan masukkan kredensial nyata.':'Pilih akun petugas untuk lingkungan lab sintetis. Integrasi identitas kedinasan nyata belum diaktifkan.',
  'Masuk ke Akun Administrator':'Masuk ruang petugas',
  'Buka Formulir Masuk &amp; MFA (Modal Kanan)':'Pilih akun lab',
  'Buka Form Login (Modal Kanan)':'Pilih akun lab',
  'AUTH GATE':'LAB SINTETIS',
  'Masuk Akun Admin':'Masuk petugas',
  'Standar Keamanan Sesi':'Panduan peran petugas',
  'Protokol Transportasi':'Operator','Terenkripsi':'Verifikasi','TLS 1.3 + mTLS':'Laporan masuk',
  'Cookie: HttpOnly; Secure; SameSite=Strict':'Periksa kelengkapan dan sahkan kategori laporan.',
  'Kepatuhan WCAG 2.2 AA':'Teknisi','Kriteria 3.3.8':'Penanganan','Paste Aktif':'Tugas saya',
  'Tanpa blokir tempel dari Password Manager':'Catat pemeriksaan dan kirim hasil kepada pemohon.',
  'Verifikasi Multi-Faktor':'Koordinator','NIST AAL3':'Disposisi','FIDO2 / TOTP':'Antrean tim',
  'Kunci perangkat keras &amp; kode 6 digit':'Pilih penanggung jawab dan koordinasikan tindak lanjut.',
  'Kunci Sesi Otomatis':'Pimpinan','Zero-Trust':'Pengawasan','15 Menit':'Kinerja layanan',
  'Sinkronisasi logout lintas tab':'Pantau capaian layanan dan keputusan yang diperlukan.',
  'Sesi dikunci otomatis setelah 15 menit tidak aktif':'Menu mengikuti hak akses akun Anda.',
 };

 source=source.replace(/Patuh WCAG[^<]+/,'Buka pekerjaan sesuai peran dan hak akses akun Anda.');
 for(const [before,after] of Object.entries(copy))source=source.replaceAll(before,after);
 return source.replace(/<form data-demo-login[\s\S]*?<\/form>/, loginForm(true)).replace(/<title>[\s\S]*?<\/title>/, '<title>Masuk lab · Helpdesk TIK</title>').replace('</head>', businessAssets + '</head>');
}

export function adminDashboard(source, health) {
  const main = `<main id="main-content" class="piui-main" data-hd-page="dashboard">
    <header class="piui-page-header"><div class="piui-page-header__titles"><h1>Dasbor petugas</h1></div></header>
    <section class="piui-card" aria-label="Koneksi dan sesi">
      ${health}
      <p data-hd-session role="status">Memeriksa sesi…</p>
      <a class="piui-btn piui-btn--secondary" href="/admin/auth/login.html" data-hd-dashboard-login>Masuk sebagai petugas</a>
    </section>
    <section class="piui-card hd-work-start" data-admin-work-start hidden aria-labelledby="hd-work-start-title"><h2 id="hd-work-start-title" data-admin-work-title></h2><p data-admin-work-description></p><a class="piui-btn piui-btn--primary" data-admin-work-link></a></section>
    <nav class="hd-actions" aria-label="Tindakan petugas">
      <a class="piui-btn piui-btn--primary" href="/admin/app/tickets/index.html?filter=verification" data-hd-dashboard-grant="ticket.verify" hidden>${queueViews.verification}</a>
      <a class="piui-btn piui-btn--primary" href="/admin/app/tickets/index.html?filter=dispatch" data-hd-dashboard-grant="ticket.dispatch" hidden>${queueViews.dispatch}</a>
      <a class="piui-btn piui-btn--primary" href="/admin/app/tickets/index.html?filter=my-tasks" data-hd-dashboard-grant="ticket.resolve" hidden>${queueViews['my-tasks']}</a>
      ${adminNavLink(adminItems.find(i => i.id === 'reports'), '', 'piui-btn piui-btn--secondary')}
      ${adminNavLink(adminItems.find(i => i.id === 'services'), '', 'piui-btn piui-btn--secondary')}
      ${adminNavLink(adminItems.find(i => i.id === 'memberships'), '', 'piui-btn piui-btn--secondary')}
      ${adminNavLink(adminItems.find(i => i.id === 'articles'), '', 'piui-btn piui-btn--secondary')}
    </nav>
    <section class="piui-card" aria-labelledby="hd-dashboard-heading">
      <h2 id="hd-dashboard-heading">Kinerja tiket</h2>
      <p role="status" data-hd-dashboard-status></p>
      <form class="hd-form-grid" data-hd-dashboard-filter hidden>
        <div class="piui-field"><label for="hd-dashboard-org">Organisasi</label><select class="piui-input" id="hd-dashboard-org" required></select></div>
        <div class="piui-field"><label for="hd-dashboard-period">Periode penerimaan (WIB)</label><select class="piui-input" id="hd-dashboard-period"><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option></select></div>
        <div class="hd-actions"><button type="submit" class="piui-btn piui-btn--primary">Perbarui ringkasan</button></div>
      </form>
      <div data-hd-dashboard-results hidden>
        <div class="piui-kpi-grid">
          <article class="piui-card"><h3>Tiket diterima</h3><p class="piui-card__value" data-hd-dashboard-accepted></p></article>
          <article class="piui-card"><h3>Masih aktif</h3><p class="piui-card__value" data-hd-dashboard-backlog></p></article>
          <article class="piui-card"><h3>Selesai</h3><p class="piui-card__value" data-hd-dashboard-completed></p></article>
          <article class="piui-card"><h3>Selesai tepat waktu</h3><p class="piui-card__value" data-hd-dashboard-rate></p></article>
        </div>
        <p><label for="hd-dashboard-meter">Persentase tepat waktu dari penyelesaian terukur</label></p>
        <meter id="hd-dashboard-meter" min="0" max="100" hidden></meter>
        <div class="hd-table-wrap"><table class="piui-table">
          <caption>Rincian pengukuran SLA</caption>
          <thead><tr><th scope="col">Pengukuran</th><th scope="col">Jumlah tiket</th></tr></thead>
          <tbody data-hd-dashboard-metrics></tbody>
        </table></div>
        <p data-hd-dashboard-watermark></p>
      </div>
    </section>
  </main>`;
  const mainRegion = /^[ \t]*<main\b[^>]*>[\s\S]*?<\/main>/m;
  if (!mainRegion.test(source)) throw new Error('Kontainer utama dashboard PIUI Zero tidak ditemukan');
  return source.replace(/<title>[^<]+<\/title>/, '<title>Dashboard · Helpdesk TIK Kota Depok</title>')
    .replace(mainRegion, main)
    .replace('</head>', businessAssets + '</head>');
}
