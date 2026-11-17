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
  return `<form class="vy-contact-form" data-hd-register data-local-mutation data-local-ready style="max-width:540px;margin:1.5rem auto 0 auto;">
    <div style="background:#eef6ff;border:1px solid #b6d4fe;border-radius:8px;padding:14px 18px;margin-bottom:1.5rem;">
      <p style="margin:0;font-size:14px;color:#084298;line-height:1.5;">
        <strong>Pendaftaran akun warga di lab.</strong> Isi data sintetis dengan format yang benar. Verifikasi identitas dan pemberitahuan ke nomor telepon belum aktif.
      </p>
    </div>
    <div class="vy-input-group">
      <label for="reg-nik">NIK Uji (16 Digit) <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-nik" name="nik" type="text" pattern="[0-9]{16}" inputmode="numeric" maxlength="16" placeholder="16 digit angka sintetis" required autocomplete="off">
    </div>
    <div class="vy-input-group">
      <label for="reg-name">Nama Uji <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-name" name="name" type="text" maxlength="200" placeholder="Nama sintetis" required autocomplete="name">
    </div>
    <div class="vy-input-group">
      <label for="reg-email">Alamat Email Uji <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-email" name="email" type="email" maxlength="254" placeholder="contoh@example.invalid" required autocomplete="email">
    </div>
    <div class="vy-input-group">
      <label for="reg-phone">Nomor Telepon Uji <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-phone" name="phone" type="tel" maxlength="16" placeholder="Contoh: 081234567890" required autocomplete="tel">
    </div>
    <div class="vy-input-group">
      <label for="reg-password">Kata Sandi Baru <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-password" name="password" type="password" minlength="8" placeholder="Minimal 8 karakter" required autocomplete="new-password">
    </div>
    <div class="vy-input-group">
      <label for="reg-password-confirm">Konfirmasi Kata Sandi <span style="color:#d93025;">*</span></label>
      <input class="vy-input" id="reg-password-confirm" name="password_confirm" type="password" minlength="8" placeholder="Ulangi kata sandi" required autocomplete="new-password">
    </div>
    <div style="margin:1rem 0;">
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4;cursor:pointer;">
        <input type="checkbox" name="agreement" required style="margin-top:2px;">
        <span>Saya hanya menggunakan data sintetis untuk pengujian lab.</span>
      </label>
    </div>
    <p data-hd-register-status role="status" tabindex="-1" style="font-size:14px;margin:8px 0;"></p>
    <div class="hd-actions" style="margin-top:1.5rem;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <button class="btn btn-primary" type="submit" style="flex:1;"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru &rarr;</button>
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
        <p class="piui-demo-notice" style="margin-bottom:14px;font-size:13px;">
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
        <p data-hd-login-status role="status" tabindex="-1" style="font-size:13px;margin:10px 0;"></p>
        <div style="margin-top:16px;display:flex;gap:10px;">
          <button class="piui-btn piui-btn--primary" type="submit" style="flex:1;">Masuk Konsol Petugas</button>
          <a class="piui-btn piui-btn--secondary" href="/">Portal Publik</a>
        </div>
        
        <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #d0d7de;">
          <p style="font-size:12px;font-weight:700;color:#57606a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">
            Aktivasi Cepat Peran Lab (1-Klik Tanpa Mengetik):
          </p>
          <div class="hd-lab-role-grid">
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="admin" style="font-size:12px;justify-content:flex-start;text-align:left;">
              👑 Super Admin (Diskominfo)
            </button>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="operator" style="font-size:12px;justify-content:flex-start;text-align:left;">
              🔍 Operator (Verifikasi laporan)
            </button>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="koordinator" style="font-size:12px;justify-content:flex-start;text-align:left;">
              📋 Koordinator Layanan
            </button>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="teknisi" style="font-size:12px;justify-content:flex-start;text-align:left;">
              🔧 Teknisi (Penanganan)
            </button>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="kadis" style="font-size:12px;justify-content:flex-start;text-align:left;">
              🏛️ Kepala Dinas (Pimpinan)
            </button>
            <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" disabled data-quick-login="auditor" style="font-size:12px;justify-content:flex-start;text-align:left;">
              ⚖️ Auditor Inspektorat
            </button>
          </div>
          <div class="piui-field" style="margin-top:12px;">
            <label for="hd-subject" style="font-size:12px;">Atau pilih akun lab dari server:</label>
            <select class="piui-input" id="hd-subject" name="subject" disabled style="font-size:12px;padding:4px 8px;">
              <option value="">Memuat identitas lab…</option>
            </select>
            <button type="button" class="piui-btn piui-btn--secondary" data-hd-lab-select disabled>Masuk sebagai identitas lab terpilih</button>
            <p role="status" tabindex="-1" data-hd-lab-status></p>
          </div>
        </div>
      </div>
    </form>`;
  }

  // Publik (Warga & ASN)
  return `<div class="vy-contact-form" style="max-width:540px;margin:1.5rem auto 0 auto;">
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
      <p class="vy-form-privacy" style="margin-bottom:1rem;">
        Mode lab sintetis. Masuk menggunakan NIK atau email akun lab terdaftar untuk menyampaikan permohonan dan memantau status tiket.
      </p>
      <div class="vy-input-group">
        <label for="hd-warga-identifier">NIK / Email <span style="color:#d93025;">*</span></label>
        <input class="vy-input" id="hd-warga-identifier" name="identifier" type="text" placeholder="NIK 16 digit atau email aktif" required autocomplete="username">
      </div>
      <div class="vy-input-group">
        <label for="hd-warga-password">Kata Sandi <span style="color:#d93025;">*</span></label>
        <input class="vy-input" id="hd-warga-password" name="password" type="password" placeholder="Masukkan kata sandi" required autocomplete="current-password">
      </div>
      <p data-hd-login-status role="status" tabindex="-1" style="font-size:14px;margin:8px 0;"></p>
      <div class="hd-actions" style="margin-top:1.25rem;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary" type="submit" style="flex:1;"><span class="hd-btn-icon">🔓</span> Masuk sebagai Warga &rarr;</button>
        <a class="btn btn-secondary" href="/daftar.html"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru</a>
      </div>
    </form>

    <!-- Panel ASN -->
    <form data-hd-login data-hd-auth-mode="asn" id="auth-panel-asn" role="tabpanel" aria-labelledby="auth-tab-asn" hidden data-local-mutation data-local-ready>
      <div style="background:#f6f8fa;border-left:4px solid #0366d6;padding:12px 16px;border-radius:4px;margin-bottom:1rem;">
        <strong style="color:#0366d6;font-size:13px;display:block;margin-bottom:4px;">Akses ASN — lingkungan lab sintetis</strong>
        <p style="margin:0;font-size:13px;color:#57606a;line-height:1.4;">Integrasi SSO kedinasan belum diaktifkan. Gunakan pemilih ASN sintetis di bawah; jangan masukkan kata sandi kedinasan.</p>
      </div>
      <div class="vy-input-group">
        <label for="hd-asn-identifier">NIK / Email Akun Lab <span style="color:#d93025;">*</span></label>
        <input class="vy-input" id="hd-asn-identifier" name="identifier" type="text" placeholder="NIK atau email akun lab terdaftar" required autocomplete="username">
      </div>
      <div class="vy-input-group">
        <label for="hd-asn-password">Kata Sandi Akun Lab <span style="color:#d93025;">*</span></label>
        <input class="vy-input" id="hd-asn-password" name="password" type="password" placeholder="Kata sandi akun lab terdaftar" required autocomplete="current-password">
      </div>
      <p data-hd-login-status role="status" tabindex="-1" style="font-size:14px;margin:8px 0;"></p>
      <div class="hd-actions" style="margin-top:1.25rem;">
        <button class="btn btn-primary" type="submit" style="width:100%;"><span class="hd-btn-icon">🏛️</span> Masuk dengan akun ASN (lab) Depok &rarr;</button>
      </div>
    </form>

    <!-- Opsi Uji Cepat Lab Penguji -->
    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px dashed #d0d7de;">
      <p style="font-size:12px;font-weight:700;color:#57606a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">
        ⚡ Mode Uji Cepat Penguji / Evaluator (1-Klik):
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" class="btn btn-secondary" disabled data-quick-login="warga" style="font-size:13px;padding:6px 12px;flex:1;"><span class="hd-btn-icon">👤</span> Warga Mandiri (Publik A)</button>
        <button type="button" class="btn btn-secondary" disabled data-quick-login="asn" style="font-size:13px;padding:6px 12px;flex:1;"><span class="hd-btn-icon">🏛️</span> ASN Pemohon (Bappeda)</button>
      </div>
      <div class="vy-input-group" style="margin-bottom:0;">
        <label for="hd-subject" style="font-size:12px;">Atau pilih dari seluruh akun sintetis server:</label>
        <select class="vy-input" id="hd-subject" name="subject" disabled style="font-size:13px;padding:6px 10px;">
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
  return `<section class="vy-contact-form" style="margin-top:1.5rem;">
    <h2>Pertanyaan Umum &amp; Solusi Cepat (FAQ)</h2>
    <p>Temukan jawaban langsung untuk pertanyaan umum seputar layanan teknologi informasi dan komunikasi Pemerintah Kota Depok.</p>
    <div class="hd-faq-list" style="margin-top:1rem;display:flex;flex-direction:column;gap:12px;">
      <details class="hd-faq-item" name="hd-faq" style="border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;background:#fff;">
        <summary style="font-weight:600;cursor:pointer;color:#0366d6;">Bagaimana cara mengajukan akun email resmi @depok.go.id?</summary>
        <p style="margin-top:8px;line-height:1.6;">Permohonan akun email kedinasan dapat diajukan oleh ASN melalui menu <strong>Katalog Layanan &rarr; Layanan Penerbitan Akun Email Kedinasan</strong>. Lampirkan Surat Keputusan (SK) Pengangkatan atau Surat Tugas resmi dari Kepala OPD yang bersangkutan.</p>
      </details>
      <details class="hd-faq-item" name="hd-faq" style="border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;background:#fff;">
        <summary style="font-weight:600;cursor:pointer;color:#0366d6;">Berapa lama target waktu penyelesaian laporan gangguan jaringan (SLA)?</summary>
        <p style="margin-top:8px;line-height:1.6;">Sesuai Standar Operasional Prosedur (SOP) Diskominfo Kota Depok, laporan gangguan koneksi internet/intranet memiliki target respon maksimal 1 jam dan target resolusi 4 hingga 8 jam kerja (Senin–Jumat 08.00–16.00 WIB).</p>
      </details>
      <details class="hd-faq-item" name="hd-faq" style="border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;background:#fff;">
        <summary style="font-weight:600;cursor:pointer;color:#0366d6;">Bagaimana prosedur pelaporan insiden keamanan siber ke Depok-CSIRT?</summary>
        <p style="margin-top:8px;line-height:1.6;">Insiden keamanan (seperti defacement, ransomware, atau peretasan akun) dapat dilaporkan baik oleh masyarakat maupun ASN melalui layanan <strong>Penanganan Insiden Keamanan Informasi (Depok-CSIRT)</strong> atau melalui Call Center Kedaruratan 112 dengan kalender layanan darurat 24 jam / 7 hari (CAL-247).</p>
      </details>
      <details class="hd-faq-item" name="hd-faq" style="border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;background:#fff;">
        <summary style="font-weight:600;cursor:pointer;color:#0366d6;">Bagaimana cara masyarakat melacak laporan tanpa memiliki akun ASN?</summary>
        <p style="margin-top:8px;line-height:1.6;">Masyarakat yang mengajukan permohonan melalui layanan publik akan menerima <strong>Kunci Pelacakan Rahasia (Capability Token)</strong> 64-karakter hex. Kunci tersebut dimasukkan pada halaman <strong>Lacak Tiket Tamu</strong> untuk melihat status dan berkomunikasi langsung dengan petugas tanpa login.</p>
      </details>
      <details class="hd-faq-item" name="hd-faq" style="border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;background:#fff;">
        <summary style="font-weight:600;cursor:pointer;color:#0366d6;">Apakah permohonan sertifikat Tanda Tangan Elektronik (TTE) membutuhkan verifikasi tatap muka?</summary>
        <p style="margin-top:8px;line-height:1.6;">Penerbitan TTE bekerja sama dengan Balai Sertifikasi Elektronik (BSrE) BSSN. Verifikasi identitas kependudukan dan biometrik dilakukan secara elektronik melalui sistem terintegrasi, dengan konfirmasi akhir dari Verifikator Diskominfo Kota Depok.</p>
      </details>
    </div>
    <div class="hd-actions" style="margin-top:1.5rem;">
      <a class="btn btn-primary" href="/layanan.html"><span class="hd-btn-icon">📋</span> Buka Katalog Layanan &rarr;</a>
      <a class="btn btn-secondary" href="/panduan.html"><span class="hd-btn-icon">📖</span> Lihat Panduan Lengkap</a>
    </div>
  </section>`;
}

function statusSection() {
  return `<section class="vy-contact-form" style="margin-top:1.5rem;">
    <h2>Status Operasional Layanan &amp; Infrastruktur SPBE</h2>
    <p>Pemantauan langsung ketersediaan infrastruktur jaringan, server, dan aplikasi terpadu Kota Depok.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-top:1rem;">
      <div style="border:1px solid #28a745;background:#f6fff8;padding:16px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#28a745;"></span><strong>Jaringan Intranet &amp; Internet OPD</strong></div>
        <p style="margin:8px 0 0;font-size:14px;color:#2c3e50;">Kondisi: <strong>Normal / Operasional</strong><br>Uptime 30 hari: 99.85%</p>
      </div>
      <div style="border:1px solid #28a745;background:#f6fff8;padding:16px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#28a745;"></span><strong>Pusat Data &amp; Server Balai Kota</strong></div>
        <p style="margin:8px 0 0;font-size:14px;color:#2c3e50;">Kondisi: <strong>Normal / Operasional</strong><br>Beban CPU Rata-rata: 24%</p>
      </div>
      <div style="border:1px solid #28a745;background:#f6fff8;padding:16px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#28a745;"></span><strong>Portal Satu Data &amp; SPLP Depok</strong></div>
        <p style="margin:8px 0 0;font-size:14px;color:#2c3e50;">Kondisi: <strong>Normal / Operasional</strong><br>Interoperabilitas: Aktif</p>
      </div>
      <div style="border:1px solid #28a745;background:#f6fff8;padding:16px;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#28a745;"></span><strong>Depok-CSIRT &amp; Monitoring Kemanan</strong></div>
        <p style="margin:8px 0 0;font-size:14px;color:#2c3e50;">Kondisi: <strong>Siaga Penuh 24/7</strong><br>Ancaman Terkini: Termitigasi</p>
      </div>
    </div>
    <div style="margin-top:1.5rem;padding:16px;border:1px solid #e1e4e8;border-radius:8px;background:#f8f9fa;">
      <h3 style="margin-top:0;">Jadwal Jendela Pemeliharaan Terencana</h3>
      <p style="font-size:14px;margin-bottom:0;">Pemeliharaan rutin infrastruktur server dan basis data dilaksanakan setiap hari <strong>Sabtu pukul 22.00–02.00 WIB</strong> untuk memastikan stabilitas dan keamanan tanpa mengganggu jam kerja pelayanan publik.</p>
    </div>
  </section>`;
}

function knowledgeSection() {
  return `<div class="hd-knowledge-portal" data-hd-knowledge>
    <section class="hd-kb-hero" aria-labelledby="hd-kb-heading" data-hd-kb-list>
      <h1 id="hd-kb-heading" class="hd-kb-hero__title">Basis Pengetahuan TIK</h1>
      <p>Temukan panduan layanan dan penanganan kendala TIK Kota Depok.</p>
      <form data-hd-kb-search action="/panduan.html" method="get">
        <label for="hd-knowledge-search">Cari panduan</label>
        <div class="hd-kb-query">
          <input type="search" name="q" id="hd-knowledge-search" class="vy-input" maxlength="100" placeholder="Judul atau topik panduan">
          <button class="btn btn-secondary" type="submit">Cari</button>
        </div>
      </form>
    </section>
    <p data-hd-kb-status role="status" tabindex="-1">Memuat panduan…</p>
    <button type="button" class="btn btn-secondary" data-hd-kb-retry hidden>Coba lagi</button>
    <section class="hd-featured-guide" aria-labelledby="hd-kb-featured-title" data-hd-kb-featured hidden>
      <div class="hd-featured-guide__content">
        <h2 id="hd-kb-featured-title" class="hd-featured-guide__title"></h2>
        <p class="hd-featured-guide__desc" data-hd-kb-featured-summary></p>
        <a class="btn btn-primary" data-hd-kb-featured-link>Baca panduan</a>
      </div>
      <div class="hd-featured-guide__visual">
        <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png" width="480" height="270" alt="">
      </div>
    </section>
    <div class="hd-knowledge-grid" data-hd-kb-cards aria-label="Daftar panduan"></div>
    <nav class="hd-actions hd-pager-nav" data-hd-kb-pager aria-label="Halaman panduan" hidden>
      <button class="btn btn-secondary" type="button" data-hd-kb-prev>Sebelumnya</button>
      <button class="btn btn-secondary" type="button" data-hd-kb-next>Berikutnya</button>
    </nav>
    <section data-hd-kb-detail hidden>
      <p><a href="/panduan.html">Kembali ke daftar panduan</a></p>
      <article class="vy-contact-form" data-hd-kb-reader hidden>
        <h1 data-hd-kb-title></h1>
        <p class="hd-kb-metadata" data-hd-kb-meta></p>
        <div class="hd-kb-body" data-hd-kb-body></div>
      </article>
    </section>
    <noscript><p>Aktifkan JavaScript untuk membuka panduan yang tersedia saat ini.</p></noscript>
  </div>`;
}

export function publicBusinessPage(source, kind) {
 let main = '';
 if (kind === 'register') main = banner('Pendaftaran Akun Warga', 'Registrasi lingkungan lab sintetis. Gunakan data uji; validasi format NIK belum merupakan verifikasi identitas Dukcapil.') + registerForm();
 if (kind === 'login') main = banner('Akses Layanan TIK', 'Akses akun lab atau identitas sintetis untuk mencoba layanan. Integrasi SSO dan verifikasi identitas nyata belum diaktifkan.') + loginForm();
 if (kind === 'catalog') main = banner('Katalog Layanan TIK', 'Pilih dari 16 layanan resmi Dinas Komunikasi dan Informatika Kota Depok. Ketersediaan formulir disesuaikan dengan hak akses dan kewenangan Anda.') + session + '<div class="hd-search-box" data-hd-search-wrap><label for="hd-public-search" class="u-sr-only">Cari layanan atau panduan</label><div class="vy-input-group hd-search-input"><input type="search" maxlength="100" id="hd-public-search" class="vy-input" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="hd-search-suggestions" aria-activedescendant="" placeholder="Cari layanan, panduan, atau informasi TIK..." autocomplete="off"><ul id="hd-search-suggestions" class="hd-suggestions-list" role="listbox" aria-label="Saran layanan dan panduan" hidden></ul></div><p id="hd-search-status" role="status"></p></div><p data-hd-status role="status" tabindex="-1">Memuat katalog…</p><div class="hd-catalog" data-hd-catalog></div><nav class="hd-actions hd-pager-nav" aria-label="Halaman katalog"><button class="btn hd-btn-pager" data-hd-prev disabled><span aria-hidden="true">←</span> Halaman Sebelumnya</button><button class="btn hd-btn-pager" data-hd-next disabled>Halaman Berikutnya <span aria-hidden="true">→</span></button></nav>';
 if (kind === 'detail') main = banner('Detail Spesifikasi Layanan', 'Periksa parameter SLA, persyaratan teknis, dan formulir permohonan sebelum mengajukan tiket.') + session + '<p data-hd-status role="status" tabindex="-1">Memuat layanan…</p><article class="vy-contact-form" data-hd-detail hidden><h2 data-hd-service-name></h2><p data-hd-service-meta></p><h3>Pratinjau formulir layanan</h3><div data-hd-fields></div><p data-hd-policy></p><p class="vy-form-privacy">Isian di atas adalah pratinjau. Gunakan tombol Buat laporan untuk mengisi dan mengirim tiket melalui formulir operasional.</p></article>';
 if (kind === 'faq') main = banner('Tanya Jawab (FAQ)', 'Pertanyaan yang sering diajukan seputar layanan TIK, permohonan fasilitas, dan penanganan kendala SPBE Kota Depok.') + faqSection();
 if (kind === 'status') main = banner('Status Layanan TIK', 'Informasi ketersediaan real-time infrastruktur jaringan, server, dan aplikasi SPBE Kota Depok.') + statusSection();
 if (kind === 'knowledge') main = knowledgeSection();

 const titleMap = {
   register: 'Daftar Akun Warga',
    login: 'Akses Layanan',
   catalog: 'Katalog Layanan',
   detail: 'Detail Layanan',
   faq: 'Tanya Jawab (FAQ)',
   status: 'Status Layanan',
   knowledge: 'Basis Pengetahuan & Panduan Operasional TIK'
 };

 return source.replace(/<title>[\s\S]*?<\/title>/, '<title>Helpdesk TIK · ' + (titleMap[kind] || 'Layanan TIK') + '</title>')
 .replace(/<main\b[\s\S]*?<\/main>/, '<main id="main-content" class="vy-shell u-pb-96" data-hd-page="' + kind + '">' + main + '</main>')
 .replace(/<script\b[^>]*contact\.js[^>]*><\/script>/g, '').replace('</head>', businessAssets + '</head>');
}
const field = (label, name, type = 'text') => `<div class="piui-field" data-hd-field="${name}"><label for="hd-${name}">${label}</label><input class="piui-input" id="hd-${name}" name="${name}" type="${type}" maxlength="200"></div>`;
const select = (label, name, options = '') => `<div class="piui-field" data-hd-field="${name}"><label for="hd-${name}">${label}</label><select class="piui-input" id="hd-${name}" name="${name}">${options}</select></div>`;
export function adminBusinessPage(source) {
 const main = `<main id="main-content" class="piui-main" data-hd-page="admin">
 <div class="piui-page-header"><div class="piui-page-header__titles"><h1>Master layanan dan akses</h1><p class="piui-page-subtitle">Kelola master sesuai mandat organisasi. Perubahan disimpan pada server.</p></div></div>
 <div class="piui-card hd-session"><div class="hd-session-inner"><div class="hd-session-identity"><p data-hd-session role="status" class="hd-session-name">Memeriksa sesi…</p><span class="hd-session-desc">Lingkungan lab sintetis Helpdesk TIK Kota Depok.</span></div><div class="hd-actions"><a class="piui-btn piui-btn--secondary piui-btn--sm" href="/admin/auth/login.html" data-admin-account-switch>Masuk petugas</a><button class="piui-btn piui-btn--secondary piui-btn--sm" data-admin-logout hidden type="button">Keluar akun</button></div></div><p data-hd-login-status role="status" tabindex="-1"></p></div>
 <p data-hd-status role="status" tabindex="-1"></p>
 <section data-hd-admin hidden>
 <div class="piui-card"><div class="court-badge" style="background:#f3e8fd;color:#581c87;display:block;margin-bottom:14px;padding:12px 16px;border-radius:6px;font-size:13px;line-height:1.5;text-align:left;"><strong>Konsol Administrator Helpdesk TIK Kota Depok:</strong> Pilih halaman pengelolaan sesuai tugas Anda. Periksa isian sebelum menyimpan perubahan.</div><div class="piui-field"><label for="hd-master-kind">Halaman pengelolaan</label><select class="piui-input" id="hd-master-kind" disabled>${renderMasterOptions()}</select></div>
 <div class="hd-actions"><button class="piui-btn piui-btn--primary" data-hd-new>Tambah data</button><button class="piui-btn piui-btn--secondary" data-hd-refresh>Muat ulang</button></div>
 <div class="hd-table-wrap"><table class="piui-table"><caption data-hd-caption>Daftar master</caption><thead><tr><th scope="col">Data</th><th scope="col">Organisasi</th><th scope="col">Status / versi</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-rows></tbody></table></div>
 <nav class="hd-actions" aria-label="Halaman master"><button class="piui-btn piui-btn--secondary" data-hd-prev disabled>Sebelumnya</button><button class="piui-btn piui-btn--secondary" data-hd-next disabled>Berikutnya</button></nav></div>
 <form class="piui-card" data-hd-master-form data-local-mutation data-local-ready><h2 data-hd-editor-title>Tambah layanan</h2><p data-hd-editor-version>Data baru</p><div class="hd-form-grid">
 ${field('Kode', 'code')}${field('Nama', 'name')}${select('Organisasi', 'org')}${select('Kategori', 'category', '<option value="">Tanpa kategori</option>')}
 ${select('Audience layanan', 'access', '<option value="PUBLIC_GUEST">Publik tanpa login</option><option value="PUBLIC_AUTH">Publik dengan akun</option><option value="ASN_AUTH">ASN sesuai organisasi</option><option value="STAFF_ONLY">Petugas sesuai organisasi</option>')}
 ${select('Subject lab', 'member-subject')}${select('Tim', 'team', '<option value="">Tanpa tim</option>')}${field('Berlaku sampai (WIB)', 'expires', 'datetime-local')}
 <div class="piui-field" data-hd-field="permissions"><label for="hd-permissions">Permission yang diberikan (pisahkan dengan koma)</label><textarea class="piui-input" id="hd-permissions" name="permissions" rows="3"></textarea><small>Hanya permission dalam grant ceiling dan peran subject yang akan diterima server.</small></div>
 ${field('Alasan perubahan akses', 'reason')}
 <div class="piui-field" data-hd-field="active"><label><input name="active" type="checkbox" checked> Aktif</label></div><div class="piui-field" data-hd-field="revoked"><label><input name="revoked" type="checkbox"> Cabut membership</label></div>
 </div><p data-hd-save-status role="status" tabindex="-1"></p><button class="piui-btn piui-btn--primary" type="submit" disabled>Simpan ke server</button></form>
 <section class="piui-card" data-hd-service-editors hidden><h2>Formulir dan kebijakan layanan</h2><p>Versi lama dipertahankan. Simpan satu perubahan, lalu gunakan versi terbaru dari server.</p>
 <form data-hd-form-editor data-local-mutation data-local-ready><h3>Field formulir</h3><div data-hd-form-fields></div><div class="hd-actions"><button class="piui-btn piui-btn--secondary" data-hd-add-field type="button">Tambah field</button><button class="piui-btn piui-btn--primary" type="submit">Simpan versi formulir baru</button></div><p data-hd-form-status role="status" tabindex="-1"></p></form>
 <form data-hd-policy-editor data-local-mutation data-local-ready><h3>Kebijakan unggahan dan audience</h3><div class="hd-form-grid">${field('Ukuran maksimum (byte, maksimal 10485760)', 'upload', 'number')}<div class="piui-field"><label for="hd-mime">MIME yang diizinkan</label><select class="piui-input" id="hd-mime" name="mime" multiple><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="application/pdf">PDF</option></select></div><div class="piui-field"><label for="hd-audience">Organisasi audience tambahan</label><select class="piui-input" id="hd-audience" name="audience" multiple></select><small>Gunakan Ctrl/Command untuk memilih lebih dari satu.</small></div></div><button class="piui-btn piui-btn--primary" type="submit">Simpan versi kebijakan baru</button><p data-hd-policy-status role="status" tabindex="-1"></p></form></section>
 
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
      <div data-hd-report-summary class="piui-summary-card" style="margin-top:1rem;padding:1rem;border:1px solid #ccc;border-radius:4px;" hidden>
        <p><strong>Metrik Kepatuhan:</strong> <span data-hd-rep-measure>-</span></p>
        <p><strong>Penyelesaian dengan target terukur:</strong> <span data-hd-rep-denominator>0</span></p>
        <p><strong>Jumlah Memenuhi Target:</strong> <span data-hd-rep-count>0</span></p>
        <p data-hd-rep-cohort></p>
        <p><strong>Fakta terbaru:</strong> <span data-hd-rep-watermark>-</span></p>
      </div>
    </div>

    <!-- Dialog Modal Ekspor (AC20 Accessible) -->
    <dialog data-hd-export-dialog class="piui-dialog" role="dialog" aria-modal="true" aria-labelledby="hd-export-title" style="max-width:500px;padding:1.5rem;border:1px solid #333;border-radius:8px;">
      <div class="piui-dialog__header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 id="hd-export-title">Ekspor Data Laporan (M9)</h3>
        <button type="button" class="piui-icon-btn" data-hd-close-export aria-label="Tutup dialog ekspor">&times;</button>
      </div>
      <form data-hd-export-form style="margin-top:1rem;">
        <div class="piui-field"><label for="hd-export-cohort">Cohort Tiket</label><select class="piui-input" id="hd-export-cohort"><option value="ACCEPTED">Diterima (ACCEPTED)</option><option value="RESOLVED">Selesai (RESOLVED)</option><option value="OPEN">Terbuka (OPEN)</option></select></div>
        <div class="piui-field"><label for="hd-export-format">Format Berkas</label><select class="piui-input" id="hd-export-format"><option value="CSV">CSV (Comma-Separated Values tersanitasi)</option><option value="JSON">JSON Terstruktur</option></select></div>
        <p data-hd-export-status role="status" style="font-size:0.9rem;margin:0.5rem 0;"></p>
        <div class="hd-actions" style="margin-top:1rem;">
          <button type="submit" class="piui-btn piui-btn--primary">Mulai Ekspor</button>
          <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-export>Batal</button>
        </div>
        <div data-hd-download-area style="margin-top:1rem;" hidden>
          <a data-hd-download-link class="piui-btn piui-btn--primary" href="/admin/app/helpdesk/index.html#download-file" download>Unduh Berkas Ekspor</a>
        </div>
      </form>
    </dialog>

    <!-- Panel Telegram & Notifikasi -->
    <div data-hd-panel="notifications" class="piui-panel" hidden>
      <h3>Pengikatan notifikasi sink lab</h3>
      <form data-hd-telegram-form class="hd-form-grid">
        <div class="piui-field"><label for="hd-tg-org">Organisasi Scope</label><select class="piui-input" id="hd-tg-org"></select></div>
        <div class="piui-field"><label for="hd-tg-code">Kode sekali pakai</label><input class="piui-input" id="hd-tg-code" type="text" autocomplete="off" readonly required></div>
        <div class="hd-actions">
          <button type="button" class="piui-btn piui-btn--secondary" data-hd-tg-challenge>Terbitkan kode sink</button>
          <button type="submit" class="piui-btn piui-btn--primary" data-hd-tg-bind>Hubungkan sink</button>
        </div>
      </form>
      <div class="hd-actions" data-hd-sink-bound hidden><button type="button" class="piui-btn piui-btn--secondary" data-hd-tg-revoke>Cabut pengikatan</button></div>
      <p data-hd-telegram-status role="status"></p>
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
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-m11="health">Status Redacted</button>
    </div>

    <!-- Panel Mode Pemeliharaan -->
    <div data-hd-panel-m11="maintenance" class="piui-panel">
      <h3>Konfigurasi Jendela Pemeliharaan Sistem (M1)</h3>
      <form data-hd-maintenance-form class="hd-form-grid" data-local-mutation>
        <div class="piui-field"><label for="hd-maint-org">Organisasi Scope</label><select class="piui-input" id="hd-maint-org"></select></div>
        <div class="piui-field"><label for="hd-maint-mode">Mode Pemeliharaan</label><select class="piui-input" id="hd-maint-mode"><option value="NORMAL">Normal (Semua Operasi Aktif)</option><option value="READ_ONLY">Read Only (Blokir Mutasi Tulis)</option><option value="DRAIN">Drain (Blokir Pembuatan Tiket Baru)</option></select></div>
        <div class="piui-field"><label for="hd-maint-start">Waktu Mulai (WIB)</label><input class="piui-input" type="datetime-local" id="hd-maint-start"></div>
        <div class="piui-field"><label for="hd-maint-end">Waktu Selesai (WIB)</label><input class="piui-input" type="datetime-local" id="hd-maint-end"></div>
        <div class="piui-field" style="grid-column:1/-1;"><label for="hd-maint-reason">Pesan / Alasan Pemeliharaan</label><textarea class="piui-input" id="hd-maint-reason" rows="2" placeholder="Pemberitahuan kepada pengguna saat pemeliharaan aktif..."></textarea></div>
        <div class="hd-actions" style="grid-column:1/-1;">
          <button type="submit" class="piui-btn piui-btn--primary">Terapkan Kebijakan Pemeliharaan</button>
        </div>
      </form>
      <p data-hd-maint-status role="status"></p>
    </div>

    <!-- Panel Scoped Operational Runner -->
    <div data-hd-panel-m11="runner" class="piui-panel" hidden>
      <h3>Scoped Operational Runner (AC24)</h3>
      <p class="piui-demo-notice">Runner sistem beroperasi dengan daftar tindakan terbatas (allowlist). Eksekusi shell bebas, perintah sistem arbitrer, atau konsol SQL tidak diizinkan.</p>
      <form data-hd-runner-form class="hd-form-grid" data-local-mutation>
        <div class="piui-field"><label for="hd-runner-org">Organisasi Scope</label><select class="piui-input" id="hd-runner-org"></select></div>
        <div class="piui-field"><label for="hd-runner-kind">Jenis Tugas Operasional</label><select class="piui-input" id="hd-runner-kind"><option value="BACKUP_MANIFEST">Manifest Backup (BACKUP_MANIFEST)</option><option value="HEALTH_REPORT">Laporan Diagnosa (HEALTH_REPORT)</option><option value="PURGE_REQUEST">Permintaan Purge [DISABLED - Policy Pending] (PURGE_REQUEST)</option></select></div>
        <div class="piui-field"><label for="hd-runner-reason">Alasan Operasi</label><input class="piui-input" id="hd-runner-reason" type="text" placeholder="Justifikasi operasional..." required></div>
        <div class="hd-actions" style="grid-column:1/-1;">
          <button type="submit" class="piui-btn piui-btn--primary">Ajukan pekerjaan</button>
        </div>
      </form>
      <form data-hd-review-job class="hd-form-grid">
        <div class="piui-field"><label for="hd-runner-job">ID pekerjaan</label><input class="piui-input" id="hd-runner-job" required></div>
        <div class="piui-field"><label for="hd-runner-approval-reason">Alasan persetujuan</label><input class="piui-input" id="hd-runner-approval-reason" maxlength="500"></div>
        <div class="hd-actions"><button type="submit" class="piui-btn">Lihat status</button><button type="submit" class="piui-btn piui-btn--secondary" data-hd-approve-job>Setujui sebagai petugas kedua</button></div>
      </form>
      <p data-hd-runner-status role="status"></p>
      <div data-hd-runner-result class="piui-card" style="margin-top:1rem;background:#f8f9fa;" hidden>
        <h4>Rincian pekerjaan</h4>
        <pre data-hd-runner-output style="white-space:pre-wrap;font-size:0.85rem;"></pre>
      </div>
    </div>

    <!-- Panel Status Redacted -->
    <div data-hd-panel-m11="health" class="piui-panel" hidden>
      <h3>Status Kesehatan Sistem Teredaksi (AC24)</h3>
      <div class="hd-actions"><button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-health>Periksa Kesehatan Sistem</button></div>
      <p data-hd-health-status role="status"></p>
      <div class="hd-table-wrap" style="margin-top:1rem;"><table class="piui-table" data-hd-health-table><thead><tr><th>Komponen</th><th>Status</th><th>Keterangan</th></tr></thead><tbody data-hd-health-rows></tbody></table></div>
    </div>
  </section>

  <!-- Pengelolaan Portal & Navigasi Publik (M2) -->
  <section class="piui-card" data-hd-navigation-section hidden>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
      <div>
        <h2 style="margin:0 0 4px 0;">Pengelolaan Portal &amp; Navigasi Publik (M2)</h2>
        <p style="margin:0;color:var(--piui-text-secondary,#a1a1aa);font-size:0.9rem;">Konfigurasi hierarki menu navigasi portal publik dan pembatasan wewenang audience SPBE Kota Depok.</p>
      </div>
      <div class="hd-actions" style="margin:0;">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-new-nav>+ Tambah Rute Navigasi</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-nav>Muat Ulang</button>
      </div>
    </div>
    <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Label Menu</th><th scope="col">Rute URL</th><th scope="col">Target Audience</th><th scope="col">Posisi</th><th scope="col">Status</th></tr></thead><tbody data-hd-nav-rows></tbody></table></div>
    <form class="piui-card" data-hd-nav-form style="margin-top:20px;border:1px solid #0d6efd;" hidden>
      <h3 data-hd-nav-form-title style="margin:0 0 14px 0;">Tambah Rute Navigasi Baru</h3>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-nav-label">Label Menu</label><input class="piui-input" id="hd-nav-label" name="label" required maxlength="100" placeholder="Contoh: Layanan Aplikasi SPBE"></div>
        <div class="piui-field"><label for="hd-nav-route">Rute Kanonikal (harus diawali /)</label><input class="piui-input" id="hd-nav-route" name="route" required maxlength="200" placeholder="Contoh: /layanan/aplikasi"></div>
        <div class="piui-field"><label for="hd-nav-audience">Target Audience</label><select class="piui-input" id="hd-nav-audience" name="audience"><option value="PUBLIC_GUEST">Publik tanpa login (PUBLIC_GUEST)</option><option value="PUBLIC_AUTH">Publik dengan akun (PUBLIC_AUTH)</option><option value="ASN_AUTH">Khusus ASN Kota Depok (ASN_AUTH)</option><option value="STAFF_ONLY">Internal Petugas Diskominfo (STAFF_ONLY)</option></select></div>
        <div class="piui-field"><label for="hd-nav-position">Urutan Tampilan</label><input class="piui-input" id="hd-nav-position" name="position" type="number" value="10" min="1" max="999"></div>
      </div>
      <p data-hd-nav-status role="status" style="margin:10px 0;"></p>
      <div class="hd-actions">
        <button type="submit" class="piui-btn piui-btn--primary">Simpan Rute Navigasi</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-nav-form>Batal</button>
      </div>
    </form>
  </section>

  <!-- Basis Pengetahuan & Editorial Artikel (M8) -->
  <section class="piui-card" data-hd-articles-section hidden>
    <div class="hd-editorial-toolbar">
      <div>
        <h2>Basis Pengetahuan &amp; Editorial Artikel (M8)</h2>
        <p>Manajemen siklus hidup artikel panduan dan standar operasional SPBE Kota Depok (DRAFT &rarr; REVIEW &rarr; PUBLISHED &rarr; ARCHIVED).</p>
      </div>
      <div class="hd-actions">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-new-article>+ Tulis Artikel Baru</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-articles>Muat Ulang</button>
      </div>
    </div>
    <div class="hd-table-wrap"><table class="piui-table"><thead><tr><th scope="col">Judul Artikel</th><th scope="col">Slug URL</th><th scope="col">Audience</th><th scope="col">Status Editorial</th><th scope="col">Versi</th><th scope="col">Tindakan</th></tr></thead><tbody data-hd-articles-rows></tbody></table></div>
    <p data-hd-editorial-status role="status"></p>
    <nav class="hd-actions" aria-label="Halaman editorial">
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-editorial-prev disabled>Sebelumnya</button>
      <button type="button" class="piui-btn piui-btn--secondary" data-hd-editorial-next disabled>Berikutnya</button>
    </nav>
    <form class="piui-card" data-hd-article-form method="post" data-local-mutation hidden>
      <h3 data-hd-article-form-title>Tulis Artikel Panduan Baru</h3>
      <div class="hd-form-grid">
        <div class="piui-field"><label for="hd-art-title">Judul Panduan</label><input class="piui-input" id="hd-art-title" name="title" required maxlength="200" placeholder="Contoh: Panduan Akses Jaringan Intra Pemerintah Daerah"></div>
        <div class="piui-field"><label for="hd-art-slug">Slug URL</label><input class="piui-input" id="hd-art-slug" name="slug" required maxlength="100" placeholder="Contoh: panduan-akses-jaringan-intra"></div>
        <div class="piui-field"><label for="hd-art-audience">Audience</label><select class="piui-input" id="hd-art-audience" name="audience"><option value="PUBLIC_GUEST">Publik (PUBLIC_GUEST)</option><option value="PUBLIC_AUTH">Publik Terdaftar (PUBLIC_AUTH)</option><option value="ASN_AUTH">Khusus ASN (ASN_AUTH)</option><option value="STAFF_ONLY">Internal Petugas (STAFF_ONLY)</option></select></div>
        <div class="piui-field"><label for="hd-art-alt">Ringkasan / Alt Deskripsi</label><input class="piui-input" id="hd-art-alt" name="alt" maxlength="200" placeholder="Ringkasan singkat isi panduan..."></div>
        <div class="piui-field hd-editorial-body"><label for="hd-art-body">Isi panduan (teks atau HTML dasar)</label><textarea class="piui-input" id="hd-art-body" name="body" rows="6" required placeholder="Tuliskan isi panduan operasional..."></textarea></div>
      </div>
      <p data-hd-article-status role="status"></p>
      <div class="hd-actions">
        <button type="submit" class="piui-btn piui-btn--primary">Simpan Draft Artikel</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-art-form>Batal</button>
      </div>
    </form>
  </section>

  <!-- Pustaka Media Terpadu Dua Owner (M3/M8) -->
  <section class="piui-card" data-hd-media-section hidden>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
      <div>
        <h2 style="margin:0 0 4px 0;">Pustaka Media Terpadu (M3/M8)</h2>
        <p style="margin:0;color:var(--piui-text-secondary,#a1a1aa);font-size:0.9rem;">Pustaka media dua-owner memisahkan berkas privat tiket penanganan (M3) dari media editorial publik portal pengetahuan (M8). Terproteksi pemindaian antivirus ClamAV.</p>
      </div>
      <div class="hd-actions" style="margin:0;">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-toggle-upload>+ Unggah Media Editorial (M8)</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-media>Muat Ulang Berkas</button>
      </div>
    </div>

    <!-- Panel Form Unggah Dropzone M8 -->
    <div data-hd-media-upload-panel class="piui-card" style="margin:16px 0;border:1px solid #0d6efd;background:var(--piui-bg-subtle, rgba(13,110,253,0.03));" hidden>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:1.05rem;">Unggah Media Editorial Publik Baru (M8)</h3>
        <button type="button" class="piui-btn piui-btn--secondary piui-btn--sm" data-hd-close-upload>Batal / Tutup</button>
      </div>
      <form data-hd-media-upload-form><div class="piui-field"><label for="media-upload-org">Organisasi pemilik media</label><select class="piui-input" id="media-upload-org" name="organization_id" required></select></div>
        <div class="hd-dropzone" id="hd-admin-media-dropzone" tabindex="0" role="button" aria-label="Dropzone unggah media editorial">
          <input type="file" id="hd-admin-media-file" class="hd-dropzone-input" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf">
          <span class="hd-dropzone__icon">📤</span>
          <p class="hd-dropzone__title">Tarik &amp; lepas gambar/dokumen ke sini, atau <mark style="background:none;color:#58a6ff;text-decoration:underline;">jelajahi berkas</mark></p>
          <p class="hd-dropzone__hint">Mendukung format PNG, JPEG, WebP, SVG, PDF. Ukuran maks 10 MB per berkas.</p>
          <div class="hd-dropzone__badges">
            <span class="hd-dropzone__badge">Maks 10 MB</span>
            <span class="hd-dropzone__badge" style="color:#3fb950;border-color:rgba(46,160,67,0.4);">🛡️ Pemindaian ClamAV Aktif</span>
            <span class="hd-dropzone__badge">Owner M8 Publik</span>
          </div>
        </div>
        
        <!-- Pratinjau Berkas Terpilih -->
        <div data-hd-media-preview-box style="display:none;align-items:center;gap:12px;padding:12px;border:1px solid #444;border-radius:8px;margin-bottom:14px;background:var(--piui-bg-elevated,#27272a);">
          <div data-hd-media-preview-thumb style="width:64px;height:64px;border-radius:6px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:24px;">📄</span>
          </div>
          <div style="flex:1;min-width:0;">
            <p data-hd-media-preview-name style="margin:0;font-weight:600;font-size:0.9rem;word-break:break-all;"></p>
            <p data-hd-media-preview-size style="margin:4px 0 0 0;font-size:0.8rem;color:#888;"></p>
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
        <p data-hd-media-upload-status role="status" tabindex="-1" style="margin:10px 0;font-size:0.9rem;"></p>
        <div class="hd-actions" style="margin-top:12px;">
          <button type="submit" class="piui-btn piui-btn--primary" data-hd-media-submit>Unggah &amp; Pindai Antivirus ClamAV</button>
        </div>
      </form>
    </div>

    <section class="piui-card" aria-labelledby="media-publication-title">
      <h2 id="media-publication-title">Tinjauan dan publikasi salinan media</h2>
      <p>Unggahan baru tersimpan privat. Editor menyiapkan berkas hasil redaksi yang berbeda. Penerbit lain meninjau sumber M8; untuk lampiran tiket M3, peninjau harus berhak membaca tiket dan melakukan reuse pada organisasi yang sama. Peninjau berbeda dari pengunggah salinan. Berkas tersedia untuk pembaca setelah konten tujuan diterbitkan sesuai haknya.</p>
      <form data-hd-media-publication>
        <div class="piui-field"><label for="media-source-id">ID media sumber yang berhak Anda baca</label><input class="piui-input" id="media-source-id" name="source_id" required pattern="[a-fA-F0-9-]{36}"></div>
        <div class="piui-field"><label for="media-source-version">Versi media sumber</label><input class="piui-input" id="media-source-version" name="expected_version" type="number" min="1" required></div>
        <div class="piui-field"><label for="media-copy-id">ID unggahan hasil redaksi yang sudah CLEAN</label><input class="piui-input" id="media-copy-id" name="sanitized_copy_id" required pattern="[a-fA-F0-9-]{36}"></div>
        <div class="piui-field"><label for="media-target-id">ID artikel atau halaman tujuan</label><input class="piui-input" id="media-target-id" name="target_id" required pattern="[a-fA-F0-9-]{36}"></div>
        <div class="piui-field"><label for="media-target-audience">Audience konten tujuan</label><select class="piui-input" id="media-target-audience" name="target_audience"><option value="PUBLIC_GUEST">Publik tanpa login</option><option value="PUBLIC_AUTH">Publik dengan akun</option><option value="ASN_AUTH">ASN sesuai organisasi</option><option value="STAFF_ONLY">Petugas sesuai organisasi</option></select></div>
        <div class="piui-field"><label for="media-review-reason">Alasan dan hasil pemeriksaan redaksi</label><textarea class="piui-input" id="media-review-reason" name="reason" minlength="5" maxlength="2000" required></textarea></div>
        <div class="piui-field"><label for="media-approval-id">ID persetujuan server untuk menghubungkan salinan</label><input class="piui-input" id="media-approval-id" name="approval_id"></div>
        <div class="hd-actions"><button class="piui-btn piui-btn--secondary" type="submit" name="action" value="approve">Setujui hasil tinjauan sesuai mandat</button><button class="piui-btn piui-btn--primary" type="submit" name="action" value="reuse">Hubungkan salinan yang disetujui</button></div>
        <p data-hd-media-publication-status role="status" tabindex="-1"></p>
      </form>
    </section>
    <!-- Filter & Tab Toolbar -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin:16px 0;padding-bottom:12px;border-bottom:1px solid var(--piui-border-subtle, #333);">
      <div class="hd-actions" data-hd-media-tabs style="margin:0;">
        <button type="button" class="piui-btn piui-btn--primary" data-hd-tab-media="M8">Pustaka Editorial Publik (M8)</button>
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-tab-media="M3">Media Privat Tiket (M3)</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <label for="hd-media-filter-status" style="font-size:0.85rem;white-space:nowrap;">Filter Status:</label>
        <select class="piui-input" id="hd-media-filter-status" style="min-height:36px;padding:4px 8px;font-size:0.85rem;">
          <option value="ALL">Semua Berkas</option>
          <option value="CLEAN">Hanya Bersih (CLEAN)</option>
          <option value="QUARANTINED">Karantina (QUARANTINED)</option>
        </select>
      </div>
    </div>

    <div data-hd-media-status role="status" style="margin:10px 0;font-size:13px;color:var(--piui-text-secondary,#a1a1aa);"></div>
    <div data-hd-media-container class="hd-media-grid"></div>

    <!-- Modal Dialog Detail Teknis Media (WAI-ARIA) -->
    <dialog data-hd-media-detail-dialog class="piui-dialog" role="dialog" aria-modal="true" aria-labelledby="hd-media-detail-title" style="max-width:560px;padding:1.5rem;border:1px solid #444;border-radius:10px;background:var(--piui-bg-surface,#18181b);color:var(--piui-text-primary,#fafafa);">
      <div class="piui-dialog__header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 id="hd-media-detail-title" style="margin:0;font-size:1.1rem;">Detail Teknis Media</h3>
        <button type="button" class="piui-icon-btn" data-hd-close-media-detail aria-label="Tutup detail media">&times;</button>
      </div>
      <div data-hd-media-detail-body style="display:flex;flex-direction:column;gap:10px;font-size:0.85rem;"></div>
      <div class="hd-actions" style="margin-top:16px;justify-content:flex-end;">
        <button type="button" class="piui-btn piui-btn--secondary" data-hd-close-media-detail>Tutup</button>
      </div>
    </dialog>
  </section>

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
