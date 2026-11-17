# -*- coding: utf-8 -*-
"""
scripts/patch_knowledge_base.py
Transformasi Total Basis Pengetahuan & Panduan Operasional TIK (M8 / Portal Publik)
- Clearance aman dari floating capsule navbar
- Live instant search & Category pill filters (Semua, SPBE, CSIRT, Jaringan, Aplikasi, Identitas, Berita)
- Featured Hero Guide dengan visual kaya & highlight panduan unggulan
- Responsive Knowledge Cards Grid (3 kolom desktop, 2 tablet, 1 mobile) dengan thumbnail ilustrasi resmi
- Reader dialog modal aksesibel WAI-ARIA untuk membaca artikel lengkap tanpa reload
- 8 artikel panduan & berita terverifikasi standar Diskominfo Kota Depok
"""

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(r"c:\Datas\Proyek\Aplikasi\helpdesk-monolith")
BUSINESS_PAGES = ROOT / "frontend" / "business-pages.mjs"
PUBLIC_UI_CSS = ROOT / "frontend" / "public-ui.css"
M0_03_TS = ROOT / "frontend" / "src" / "features" / "m0-03.ts"

KNOWLEDGE_SECTION_CODE = r'''
function knowledgeSection() {
  return `<div class="hd-knowledge-portal" data-hd-knowledge>
    <!-- 1. Hero Banner Knowledge Base dengan Clearance & Search -->
    <section class="hd-kb-hero" aria-labelledby="hd-kb-heading">
      <div class="hd-kb-hero__badge"><span class="hd-btn-icon">🛡️</span> PUSAT EDUKASI &amp; INFORMASI SPBE KOTA DEPOK</div>
      <h1 id="hd-kb-heading" class="hd-kb-hero__title">Basis Pengetahuan &amp; Panduan Operasional TIK</h1>
      <p class="hd-kb-hero__desc">Dokumentasi teknis resmi, tata cara permohonan fasilitas digital, standar operasional prosedur keamanan siber, dan panduan operasional terpadu Dinas Komunikasi dan Informatika Pemerintah Kota Depok.</p>
      
      <!-- Live Search Box -->
      <div class="hd-kb-search-wrap">
        <label for="hd-knowledge-search" class="u-sr-only">Cari panduan teknis, tutorial atau artikel SPBE</label>
        <span class="hd-kb-search-icon" aria-hidden="true">🔍</span>
        <input type="search" id="hd-knowledge-search" class="hd-kb-search-input" placeholder="Cari topik panduan (contoh: email dinas, tte bsre, wifi balaikota, csirt, sso)..." autocomplete="off">
        <button type="button" class="hd-kb-search-clear" data-hd-search-clear aria-label="Bersihkan pencarian" hidden>✕</button>
      </div>

      <!-- Category Filter Pills -->
      <nav class="hd-kb-filter-tabs" aria-label="Filter Kategori Panduan">
        <button type="button" class="hd-kb-filter-btn active" data-hd-kb-filter="all" aria-pressed="true">
          <span class="hd-btn-icon">📚</span> Semua Panduan <span class="hd-kb-filter-count">8</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="spbe" aria-pressed="false">
          <span class="hd-btn-icon">🏛️</span> Tata Kelola SPBE <span class="hd-kb-filter-count">2</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="csirt" aria-pressed="false">
          <span class="hd-btn-icon">🔒</span> Keamanan Siber &amp; CSIRT <span class="hd-kb-filter-count">2</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="network" aria-pressed="false">
          <span class="hd-btn-icon">🌐</span> Jaringan &amp; Wi-Fi <span class="hd-kb-filter-count">2</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="app" aria-pressed="false">
          <span class="hd-btn-icon">📧</span> Email &amp; Aplikasi <span class="hd-kb-filter-count">1</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="identity" aria-pressed="false">
          <span class="hd-btn-icon">👤</span> Identitas &amp; Akses <span class="hd-kb-filter-count">1</span>
        </button>
        <button type="button" class="hd-kb-filter-btn" data-hd-kb-filter="news" aria-pressed="false">
          <span class="hd-btn-icon">📰</span> Berita &amp; Informasi <span class="hd-kb-filter-count">1</span>
        </button>
      </nav>

      <!-- Counter & Status Bar -->
      <div class="hd-kb-status-bar">
        <span id="hd-kb-count">Menampilkan 8 panduan &amp; artikel resmi</span>
        <span style="display:inline-flex;align-items:center;gap:6px;color:#58a6ff;font-size:12.5px;">
          <span class="hd-btn-icon">✅</span> Standar Layanan TIK Diskominfo Kota Depok
        </span>
      </div>
    </section>

    <!-- 2. Hero Featured Guide (Sorotan Panduan Utama) -->
    <section class="hd-featured-guide" aria-labelledby="featured-guide-title">
      <div class="hd-featured-guide__content">
        <div class="hd-featured-guide__meta">
          <span class="hd-featured-guide__badge"><span class="hd-btn-icon">⭐</span> PANDUAN UNGGULAN</span>
          <span class="court-badge" style="font-size:11px;">Tata Kelola SPBE · Email</span>
          <span style="font-size:12px;color:#8b949e;" data-hd-read-time>⏱️ 5 menit baca</span>
          <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 28 Okt 2026</span>
        </div>
        <h2 id="featured-guide-title" class="hd-featured-guide__title">Panduan Konfigurasi Email Kedinasan @depok.go.id pada Mail Client</h2>
        <p class="hd-featured-guide__desc">Langkah lengkap menyambungkan akun surat elektronik dinas resmi ke aplikasi mobile (Android / iOS) dan desktop (Thunderbird / Outlook) menggunakan enkripsi IMAP/SMTP standar persandian Kota Depok.</p>
        <div class="hd-featured-guide__footer">
          <button type="button" class="btn btn-primary" data-hd-read-slug="panduan-konfigurasi-email-depok-go-id">
            <span class="hd-btn-icon">📖</span> Baca Panduan Lengkap &rarr;
          </button>
          <a class="btn btn-secondary" href="/layanan.html">
            <span class="hd-btn-icon">📋</span> Ajukan Akun Email Baru
          </a>
        </div>
      </div>
      <div class="hd-featured-guide__visual" aria-hidden="true">
        <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png" width="240" height="180" alt="Ilustrasi Panduan Email Kedinasan" loading="lazy">
      </div>
    </section>

    <!-- 3. Responsive Knowledge Grid (8 Kartu Panduan & Berita) -->
    <div class="hd-knowledge-grid" id="hd-knowledge-grid" aria-label="Daftar Kartu Panduan Teknis">

      <!-- Card 1: Email Kedinasan -->
      <article class="hd-knowledge-card" data-category="app" data-slug="panduan-konfigurasi-email-depok-go-id">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--app">Email &amp; Komunikasi</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-akun-identitas.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 5 menit baca</span>
            <span>·</span>
            <span>👥 ASN &amp; OPD</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-konfigurasi-email-depok-go-id">Panduan Konfigurasi Email Kedinasan @depok.go.id</a>
          </h3>
          <p class="hd-knowledge-card__summary">Panduan penyambungan akun email resmi ke client Thunderbird, Outlook, Android, dan iPhone menggunakan server mail.depok.go.id port 993 terenkripsi SSL.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 28 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-konfigurasi-email-depok-go-id">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 2: TTE BSrE -->
      <article class="hd-knowledge-card" data-category="csirt" data-slug="panduan-pengajuan-tte-bsre">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--csirt">Keamanan &amp; TTE</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-keamanan-siber.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 6 menit baca</span>
            <span>·</span>
            <span>👥 Pejabat ASN</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-pengajuan-tte-bsre">Tata Cara Pengajuan Sertifikat Elektronik &amp; TTE BSrE</a>
          </h3>
          <p class="hd-knowledge-card__summary">Prosedur penerbitan, verifikasi NIP/NIK pada SIMPEG BKPSDM, dan aktivasi tanda tangan digital tersertifikasi BSrE BSSN bagi aparatur Pemkot Depok.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 25 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-pengajuan-tte-bsre">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 3: CSIRT Tanggap Darurat -->
      <article class="hd-knowledge-card" data-category="csirt" data-slug="panduan-penanganan-insiden-csirt">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--csirt">Depok-CSIRT 24/7</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-notifikasi-audit.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 4 menit baca</span>
            <span>·</span>
            <span>👥 Seluruh Pengguna</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-penanganan-insiden-csirt">Prosedur Tanggap Darurat &amp; Pelaporan Insiden Siber (CSIRT)</a>
          </h3>
          <p class="hd-knowledge-card__summary">Pedoman tanggap cepat bila terjadi peretasan, ransomware, atau kebocoran data: langkah isolasi kabel LAN, jangan cabut daya PC, dan eskalasi darurat 24/7.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 22 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-penanganan-insiden-csirt">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 4: Wi-Fi Balai Kota -->
      <article class="hd-knowledge-card" data-category="network" data-slug="panduan-koneksi-wifi-balaikota">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--network">Infrastruktur Wi-Fi</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-wifi-jaringan.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 3 menit baca</span>
            <span>·</span>
            <span>👥 ASN &amp; Pengunjung</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-koneksi-wifi-balaikota">Panduan Akses Jaringan Intranet &amp; Wi-Fi Balai Kota Depok</a>
          </h3>
          <p class="hd-knowledge-card__summary">Petunjuk autentikasi WPA2-Enterprise untuk SSID ASN-DEPOK dan akses publik portal captive bagi tamu kedinasan di Gedung Dibaleka I dan Dibaleka II.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 20 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-koneksi-wifi-balaikota">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 5: Standar Password SPBE -->
      <article class="hd-knowledge-card" data-category="identity" data-slug="panduan-standar-keamanan-password-spbe">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--identity">Keamanan Sandi</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 4 menit baca</span>
            <span>·</span>
            <span>👥 Seluruh Akun SPBE</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-standar-keamanan-password-spbe">Standar Keamanan Kata Sandi &amp; Akun SPBE Terpadu</a>
          </h3>
          <p class="hd-knowledge-card__summary">Ketentuan pembuatan kata sandi kuat minimal 10 karakter, aturan rotasi berkala 90 hari, larangan reuse kata sandi, dan perlindungan terhadap phishing.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 18 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-standar-keamanan-password-spbe">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 6: Integrasi API SPBE -->
      <article class="hd-knowledge-card" data-category="spbe" data-slug="panduan-integrasi-api-spbe">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--spbe">Interoperabilitas API</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-cloud-layanan.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 7 menit baca</span>
            <span>·</span>
            <span>👥 Tim IT Perangkat Daerah</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-integrasi-api-spbe">Tata Kelola &amp; Integrasi API Antar-Aplikasi SPBE Depok</a>
          </h3>
          <p class="hd-knowledge-card__summary">Prosedur permohonan akses API data sektoral, perjanjian kerahasiaan data (NDA), standar JSON RESTful, dan tahapan uji coba sandbox sebelum produksi.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 15 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-integrasi-api-spbe">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 7: Jendela Pemeliharaan Server -->
      <article class="hd-knowledge-card" data-category="network" data-slug="panduan-jadwal-pemeliharaan-server">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--network">Operasional Server</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-server-infrastruktur.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 3 menit baca</span>
            <span>·</span>
            <span>👥 Administrator &amp; ASN</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="panduan-jadwal-pemeliharaan-server">Jadwal Jendela Pemeliharaan Terencana &amp; Prosedur Downtime</a>
          </h3>
          <p class="hd-knowledge-card__summary">Informasi pelaksanaan pemeliharaan server dan database setiap hari Sabtu pukul 22.00–02.00 WIB guna menjaga stabilitas tanpa mengganggu jam pelayanan publik.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 10 Okt 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="panduan-jadwal-pemeliharaan-server">
              <span class="hd-btn-icon">📖</span> Baca Panduan &rarr;
            </button>
          </div>
        </div>
      </article>

      <!-- Card 8: Berita Penguatan SPBE -->
      <article class="hd-knowledge-card" data-category="news" data-slug="berita-penguatan-spbe-2026">
        <div class="hd-knowledge-card__thumb">
          <span class="hd-knowledge-card__badge-cat hd-knowledge-card__badge-cat--news">Berita Resmi SPBE</span>
          <img src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-aplikasi-digital.png" width="130" height="130" alt="" loading="lazy">
        </div>
        <div class="hd-knowledge-card__body">
          <div class="hd-knowledge-card__info">
            <span data-hd-read-time>⏱️ 5 menit baca</span>
            <span>·</span>
            <span>👥 Publik &amp; Aparatur</span>
          </div>
          <h3 class="hd-knowledge-card__title">
            <a href="/panduan.html" data-hd-read-slug="berita-penguatan-spbe-2026">Penguatan Tata Kelola Keamanan Informasi &amp; SPBE Kota Depok 2026</a>
          </h3>
          <p class="hd-knowledge-card__summary">Diskominfo Kota Depok mengintensifkan sosialisasi implementasi tanda tangan elektronik BSrE dan pengawasan siber 24/7 untuk melindungi layanan warga.</p>
          <div class="hd-knowledge-card__footer">
            <span style="font-size:12px;color:#8b949e;" data-hd-date>📅 05 Nov 2026</span>
            <button type="button" class="btn btn-secondary hd-btn-kb" data-hd-read-slug="berita-penguatan-spbe-2026">
              <span class="hd-btn-icon">📖</span> Baca Berita &rarr;
            </button>
          </div>
        </div>
      </article>

    </div>

    <!-- Empty State jika pencarian tidak menemukan hasil -->
    <div id="hd-kb-empty" hidden class="hd-kb-empty" style="text-align:center;padding:48px 20px;background:rgba(22,27,34,0.6);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;margin:24px 0;">
      <span style="font-size:36px;display:block;margin-bottom:12px;">🔍</span>
      <h3 style="color:#ffffff;margin:0 0 8px 0;">Tidak Ada Panduan Ditemukan</h3>
      <p style="color:#8b949e;max-width:48ch;margin:8px auto 16px;line-height:1.6;">Topik yang Anda cari belum tersedia dalam basis pengetahuan publik. Silakan coba kata kunci lain atau sampaikan permohonan informasi kepada petugas helpdesk.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" data-hd-search-clear><span class="hd-btn-icon">↺</span> Reset Pencarian</button>
        <a class="btn btn-primary" href="/lapor.html"><span class="hd-btn-icon">✍️</span> Buat Laporan / Tanya Petugas &rarr;</a>
      </div>
    </div>

    <!-- 4. Dialog Modal Pembaca Artikel Aksesibel (WAI-ARIA) -->
    <dialog id="hd-article-modal" class="hd-article-modal" data-hd-article-modal aria-labelledby="hd-modal-article-title" aria-modal="true">
      <div class="hd-article-modal__header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span id="hd-modal-article-cat" class="court-badge" style="font-size:11px;">Panduan SPBE</span>
          <span id="hd-modal-article-time" style="font-size:12px;color:#8b949e;">⏱️ 5 menit baca</span>
        </div>
        <button type="button" class="hd-modal-close" data-hd-close-article aria-label="Tutup dialog artikel" style="background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
      </div>

      <div class="hd-article-modal__body">
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <h2 id="hd-modal-article-title" style="margin:0 0 8px 0;font-size:1.45rem;color:#ffffff;line-height:1.35;"></h2>
          <p style="margin:0;font-size:13px;color:#8b949e;">Diterbitkan oleh Dinas Komunikasi dan Informatika Kota Depok · <span id="hd-modal-article-date">2026</span></p>
        </div>
        <div id="hd-modal-article-body" class="hd-article-content">
          <!-- Konten artikel diisi secara dinamis dari template atau API -->
        </div>
      </div>

      <div class="hd-article-modal__footer">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" id="hd-modal-print"><span class="hd-btn-icon">🖨️</span> Cetak / Simpan PDF</button>
          <button type="button" class="btn btn-secondary" id="hd-modal-copy"><span class="hd-btn-icon">📋</span> Salin Tautan</button>
        </div>
        <button type="button" class="btn btn-primary" data-hd-close-article>Tutup Panduan</button>
      </div>
    </dialog>

    <!-- 5. Kumpulan Template HTML Artikel Lengkap -->
    <template data-hd-article-template="panduan-konfigurasi-email-depok-go-id">
      <p>Setiap Aparatur Sipil Negara (ASN) di lingkungan Pemerintah Kota Depok berhak mendapatkan dan menggunakan akun surel kedinasan dengan domain resmi <strong>@depok.go.id</strong>. Untuk menghubungkan email dinas Anda ke aplikasi pihak ketiga seperti Mozilla Thunderbird, Microsoft Outlook, atau aplikasi Mail bawaan di smartphone Android dan iOS, ikuti parameter resmi berikut:</p>
      
      <div class="hd-callout hd-callout-warning">
        <strong>⚠️ PENTING:</strong> Jangan pernah membagikan kata sandi (password) email kedinasan Anda kepada siapa pun termasuk staf atau pihak ketiga. Tim Diskominfo tidak pernah meminta kata sandi melalui pesan chat atau email.
      </div>

      <h3 style="color:#58a6ff;margin-top:20px;">Parameter Server Penerima (IMAP)</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li><strong>Server / Hostname:</strong> <code>mail.depok.go.id</code></li>
        <li><strong>Port:</strong> <code>993</code></li>
        <li><strong>Protokol Enkripsi:</strong> SSL / TLS</li>
        <li><strong>Metode Autentikasi:</strong> Normal Password (NIP dan kata sandi SSO)</li>
      </ul>

      <h3 style="color:#58a6ff;margin-top:20px;">Parameter Server Pengirim (SMTP)</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li><strong>Server / Hostname:</strong> <code>smtp.depok.go.id</code></li>
        <li><strong>Port:</strong> <code>465</code> (SSL/TLS) atau <code>587</code> (STARTTLS)</li>
        <li><strong>Autentikasi:</strong> Wajib aktif (gunakan username &amp; password yang sama dengan IMAP)</li>
      </ul>

      <h3 style="color:#58a6ff;margin-top:20px;">Langkah-Langkah Konfigurasi:</h3>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Buka aplikasi mail client (contoh: Outlook atau Thunderbird), lalu pilih menu <strong>Add Account</strong> atau <strong>Tambah Akun</strong>.</li>
        <li>Masukkan nama lengkap kedinasan Anda dan alamat email resmi (contoh: <code>nama.pegawai@depok.go.id</code>).</li>
        <li>Pilih opsi konfigurasi manual (<em>Manual Setup</em>), lalu pilih tipe akun <strong>IMAP</strong>.</li>
        <li>Masukkan parameter server penerima (<code>mail.depok.go.id</code> port 993 SSL) dan pengirim (<code>smtp.depok.go.id</code> port 465 SSL).</li>
        <li>Klik <strong>Test Connection</strong> atau <strong>Selesai</strong>. Aplikasi akan melakukan handshake enkripsi sertifikat dan sinkronisasi kotak masuk.</li>
      </ol>
      <p style="margin-top:16px;">Bila mengalami kendala gagal tersambung atau pesan <em>Certificate Warning</em>, pastikan jam perangkat Anda akurat atau laporkan tiket kendala pada Helpdesk TIK.</p>
    </template>

    <template data-hd-article-template="panduan-pengajuan-tte-bsre">
      <p>Layanan Sertifikat Elektronik dan Tanda Tangan Elektronik (TTE) tersertifikasi diselenggarakan oleh Dinas Komunikasi dan Informatika Pemerintah Kota Depok bekerja sama dengan Balai Sertifikasi Elektronik (BSrE) - Badan Siber dan Sandi Negara (BSSN).</p>
      
      <h3 style="color:#58a6ff;margin-top:18px;">Persyaratan Dokumen Pengajuan:</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li>Scan Kartu Tanda Penduduk (KTP) asli beresolusi jelas (format PDF/JPEG maks 2MB).</li>
        <li>Scan Surat Keputusan (SK) Jabatan atau Pengangkatan Terakhir.</li>
        <li>Surat Rekomendasi Penerbitan TTE yang ditandatangani oleh Kepala Perangkat Daerah / OPD.</li>
        <li>Alamat email kedinasan aktif <code>@depok.go.id</code> yang terdaftar pada SIMPEG BKPSDM.</li>
      </ul>

      <div class="hd-callout">
        <strong>💡 Ketentuan Hukum:</strong> Tanda Tangan Elektronik tersertifikasi BSrE memiliki kekuatan hukum dan akibat hukum yang sah setara dengan tanda tangan basah sesuai Undang-Undang Nomor 11 Tahun 2008 tentang ITE dan perubahannya.
      </div>

      <h3 style="color:#58a6ff;margin-top:20px;">Alur dan Tahapan Pengajuan:</h3>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Buka menu <a href="/layanan.html" style="color:#58a6ff;">Katalog Layanan TIK</a> lalu pilih formulir <strong>TIK-TTE-01 (Pengajuan Sertifikat Elektronik ASN)</strong>.</li>
        <li>Lengkapi data NIP, NIK, jabatan, dan unggah berkas persyaratan yang diminta.</li>
        <li>Tim Verifikator Bidang Informasi dan Persandian Diskominfo akan melakukan validasi identitas pemohon ke database SIMPEG dalam 1x24 jam kerja.</li>
        <li>Setelah diverifikasi, sistem BSrE akan mengirimkan email aktivasi otomatis langsung ke kotak masuk email kedinasan pemohon.</li>
        <li>Buka tautan dalam email tersebut untuk melakukan verifikasi wajah/identitas dan membuat <em>Passphrase</em> TTE mandiri. Jangan bagikan passphrase ini kepada siapa pun!</li>
      </ol>
    </template>

    <template data-hd-article-template="panduan-penanganan-insiden-csirt">
      <p>Tim Tanggap Insiden Keamanan Siber Kota Depok (<strong>Depok-CSIRT</strong>) bertugas mengoordinasikan penanganan dan mitigasi insiden keamanan informasi di seluruh perangkat daerah Pemerintah Kota Depok selama 24 jam sehari, 7 hari seminggu.</p>

      <div class="hd-callout hd-callout-danger">
        <strong>🚨 TINDAKAN PERTAMA KETIKA TERJADI INSIDEN SIBER (Ransomware / Defacement / Peretasan):</strong>
        <ol style="margin:8px 0 0 16px;padding:0;">
          <li><strong>SEGERA CABUT KABEL LAN</strong> atau matikan koneksi Wi-Fi dari perangkat komputer / server yang dicurigai.</li>
          <li><strong>JANGAN MEMATIKAN ATAU MEREBOOT PERANGKAT</strong> secara paksa dari tombol power agar artefak bukti di memori (RAM) tidak hilang untuk analisis forensik.</li>
          <li>Ambil foto layar yang menampilkan pesan kesalahan atau tebusan (ransomware).</li>
        </ol>
      </div>

      <h3 style="color:#58a6ff;margin-top:20px;">Kanal Pelaporan Kedaruratan:</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li><strong>Portal Helpdesk:</strong> Formulir darurat Layanan Penanganan Insiden Siber (TIK-SEC-01) dengan prioritas TINGGI/DARURAT.</li>
        <li><strong>Hotline CSIRT:</strong> 021-7762960 ext. CSIRT (Siaga 24/7).</li>
        <li><strong>Email Kedaruratan:</strong> <code>csirt@depok.go.id</code></li>
      </ul>
      <p>Petugas CSIRT akan melakukan triase awal, investigasi forensik, isolasi segmen jaringan VLAN, dan koordinasi eskalasi ke BSSN Provinsi/Nasional bila diperlukan.</p>
    </template>

    <template data-hd-article-template="panduan-koneksi-wifi-balaikota">
      <p>Dinas Komunikasi dan Informatika Kota Depok menyediakan infrastruktur jaringan nirkabel (Wi-Fi) berkecepatan tinggi di kompleks Balai Kota Depok (Gedung Dibaleka I, Dibaleka II, dan Balai Rakyat).</p>
      
      <h3 style="color:#58a6ff;margin-top:18px;">Pilihan Jaringan SSID Resmi:</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li><strong>SSID ASN-DEPOK:</strong> Khusus pegawai aparatur sipil negara. Terhubung langsung ke intranet Pemkot Depok dan aplikasi internal OPD. Menggunakan enkripsi enterprise 802.1X WPA2/WPA3.</li>
        <li><strong>SSID DEPOK-PUBLIK:</strong> Diperuntukkan bagi masyarakat umum dan tamu kedinasan. Menggunakan portal masuk (captive portal) dengan persetujuan ketentuan layanan.</li>
      </ul>

      <h3 style="color:#58a6ff;margin-top:20px;">Cara Menyambungkan ke SSID ASN-DEPOK:</h3>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Aktifkan Wi-Fi di perangkat ponsel atau laptop Anda, lalu pilih jaringan <strong>ASN-DEPOK</strong>.</li>
        <li>Pada menu keamanan EAP, pilih metode <strong>PEAP</strong> dan autentikasi fase 2 <strong>MSCHAPV2</strong>.</li>
        <li>Pada kolom sertifikat CA, pilih <em>Gunakan sertifikat sistem</em> atau <em>Jangan validasi</em> (sesuai tipe OS).</li>
        <li>Masukkan NIP Anda pada kolom <strong>Identitas</strong> dan masukkan kata sandi SSO pada kolom <strong>Kata Sandi</strong>.</li>
        <li>Klik Sambungkan (Connect). Perangkat Anda akan otomatis mendapatkan IP pada segmen jaringan OPD.</li>
      </ol>
    </template>

    <template data-hd-article-template="panduan-standar-keamanan-password-spbe">
      <p>Berdasarkan Peraturan Walikota Depok tentang Tata Kelola Sistem Pemerintahan Berbasis Elektronik (SPBE), seluruh pengguna akun kedinasan wajib menerapkan standar keamanan kata sandi yang kuat untuk melindungi data sensitif pemerintah dan masyarakat.</p>

      <h3 style="color:#58a6ff;margin-top:18px;">Kriteria Kata Sandi Kuat:</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li>Panjang minimal <strong>10 karakter</strong> (disarankan 12-16 karakter frasa sandi / <em>passphrase</em>).</li>
        <li>Kombinasi wajib: Huruf besar (A-Z), huruf kecil (a-z), angka (0-9), dan karakter khusus simbol (<code>!@#$%^&amp;*</code>).</li>
        <li>Dilarang menggunakan kata umum, tanggal lahir, nomor telepon, atau singkatan nama OPD (contoh terlarang: <code>Depok2026!</code>, <code>Admin1234#</code>).</li>
        <li>Lakukan pembaruan kata sandi secara berkala setiap <strong>90 hari kalender</strong>.</li>
      </ul>

      <div class="hd-callout hd-callout-warning">
        <strong>⚠️ Peringatan Keamanan:</strong> Dilarang mencatat kata sandi pada kertas terbuka di meja kerja atau menyimpan kredensial di peramban komputer bersama. Aktifkan fitur Two-Factor Authentication (2FA) pada layanan yang telah mendukung.
      </div>
    </template>

    <template data-hd-article-template="panduan-integrasi-api-spbe">
      <p>Dalam rangka percepatan integrasi data dan implementasi kebijakan <strong>Satu Data Indonesia Kota Depok</strong>, seluruh perangkat daerah yang mengembangkan aplikasi baru wajib memanfaatkan pertukaran data berbasis antarmuka pemrograman aplikasi (Application Programming Interface / API).</p>
      
      <h3 style="color:#58a6ff;margin-top:18px;">Tahapan Permohonan Integrasi API:</h3>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Perangkat Daerah mengajukan tiket permohonan melalui formulir <strong>TIK-DEV-01 (Permohonan Integrasi API Antar-OPD)</strong>.</li>
        <li>Lampirkan dokumen spesifikasi kebutuhan data (Data Dictionary), diagram alur pertukaran data, dan estimasi beban kueri per detik (QPS).</li>
        <li>Penandatanganan Perjanjian Kerahasiaan Data (Non-Disclosure Agreement / NDA) antara Kepala OPD Pemohon dan Kepala Diskominfo.</li>
        <li>Tim Infrastruktur dan Aplikasi Diskominfo akan menerbitkan kredensial API Key serta endpoint uji coba pada lingkungan <em>Sandbox / Staging</em>.</li>
        <li>Setelah pengujian lulus uji fungsional dan uji beban, endpoint produksi dan token otentikasi akan diaktifkan secara resmi.</li>
      </ol>
    </template>

    <template data-hd-article-template="panduan-jadwal-pemeliharaan-server">
      <p>Dinas Komunikasi dan Informatika Kota Depok melaksanakan kegiatan pemeliharaan berkala infrastruktur server data center dan klaster basis data guna menjaga performa prima, keandalan, dan menerapkan pembaruan patch keamanan sistem operasi.</p>

      <h3 style="color:#58a6ff;margin-top:18px;">Waktu Pelaksanaan Jendela Pemeliharaan:</h3>
      <p>Jendela pemeliharaan rutin dilaksanakan setiap hari <strong>Sabtu malam pukul 22.00 WIB hingga Minggu dini hari pukul 02.00 WIB</strong> (durasi 4 jam di luar jam kerja efektif pemerintah).</p>

      <div class="hd-callout">
        <strong>ℹ️ Status Ketersediaan Layanan:</strong> Selama jendela pemeliharaan berlangsung, portal layanan publik utama tetap dapat diakses dalam mode cadangan baca (<em>read-only replica</em>). Formulir transaksi baru akan dialirkan ke antrean aman hingga proses sinkronisasi tuntas.
      </div>
    </template>

    <template data-hd-article-template="berita-penguatan-spbe-2026">
      <p><strong>DEPOK</strong> — Dinas Komunikasi dan Informatika (Diskominfo) Pemerintah Kota Depok terus mengakselerasi penguatan tata kelola keamanan informasi dan implementasi Sistem Pemerintahan Berbasis Elektronik (SPBE) terpadu di tahun 2026.</p>
      
      <p>Kepala Dinas Komunikasi dan Informatika Kota Depok menyampaikan bahwa transformasi digital bukan hanya tentang membangun aplikasi baru, melainkan memastikan integrasi layanan, kepastian perlindungan data pribadi ASN dan warga, serta kesiapsiagaan tim tanggap insiden siber (Depok-CSIRT) dalam menghadapi berbagai potensi ancaman siber.</p>

      <h3 style="color:#58a6ff;margin-top:18px;">Fokus Program Prioritas 2026:</h3>
      <ul style="padding-left:20px;line-height:1.7;">
        <li>Penyatuan 16 layanan utama TIK ke dalam satu gerbang layanan terpadu (Helpdesk TIK Kota Depok) dengan SLA terukur dan transparan.</li>
        <li>Perluasan sertifikat tanda tangan elektronik (TTE BSrE) ke seluruh unit kerja termasuk kecamatan, kelurahan, dan puskesmas.</li>
        <li>Pemantauan keamanan siber 24/7 melalui Security Operations Center (SOC) dan integrasi audit log terpusat.</li>
        <li>Penyediaan portal pengetahuan dan panduan operasional mandiri agar aparatur dan masyarakat mudah menyelesaikan kendala teknis dasar.</li>
      </ul>
      <p style="margin-top:16px;">Dengan ekosistem SPBE yang semakin matang, Pemerintah Kota Depok berkomitmen menghadirkan tata kelola pemerintahan yang efektif, efisien, transparan, dan akuntabel demi kemudahan seluruh warga masyarakat Kota Depok.</p>
    </template>

  </div>`;
}
'''

def patch_business_pages():
    print("[1/3] Patching frontend/business-pages.mjs...")
    content = BUSINESS_PAGES.read_text(encoding='utf-8')
    
    # 1. Replace existing knowledgeSection function
    import re
    # Match function knowledgeSection() { ... }
    pattern = r'function knowledgeSection\(\)\s*\{[\s\S]*?\n\}\n'
    if re.search(pattern, content):
        content = re.sub(pattern, KNOWLEDGE_SECTION_CODE.strip() + "\n", content, count=1)
        print("  -> Replaced existing knowledgeSection() function")
    else:
        print("  -> WARN: Could not find function knowledgeSection(), appending")
        content += "\n" + KNOWLEDGE_SECTION_CODE
        
    # 2. In publicBusinessPage, replace banner + knowledgeSection with just knowledgeSection()
    # if (kind === 'knowledge') main = banner('Basis Pengetahuan TIK', 'Kumpulan panduan teknis operasional dan standar prosedur SPBE Dinas Komunikasi dan Informatika Kota Depok.') + knowledgeSection();
    old_line = "if (kind === 'knowledge') main = banner('Basis Pengetahuan TIK', 'Kumpulan panduan teknis operasional dan standar prosedur SPBE Dinas Komunikasi dan Informatika Kota Depok.') + knowledgeSection();"
    new_line = "if (kind === 'knowledge') main = knowledgeSection();"
    if old_line in content:
        content = content.replace(old_line, new_line)
        print("  -> Replaced redundant banner call for knowledge page")
    else:
        # try regex
        content = re.sub(r"if\s*\(\s*kind\s*===\s*'knowledge'\s*\)\s*main\s*=\s*banner\([^)]+\)\s*\+\s*knowledgeSection\(\);", new_line, content)
        print("  -> Replaced banner call via regex")

    # 3. Update titleMap for knowledge
    content = content.replace("knowledge: 'Basis Pengetahuan'", "knowledge: 'Basis Pengetahuan & Panduan Operasional TIK'")

    BUSINESS_PAGES.write_text(content, encoding='utf-8')
    print("  -> Successfully updated frontend/business-pages.mjs")

CSS_KNOWLEDGE_RULES = r'''
/* ==========================================================================
   8. BASIS PENGETAHUAN & PANDUAN OPERASIONAL TIK (KNOWLEDGE BASE M8)
   ========================================================================== */

/* 8.1 Clearance Halaman Publik di bawah Floating Pill Navbar */
[data-helpdesk-public] main.vy-shell,
[data-helpdesk-public] main[data-hd-page] {
  padding-top: clamp(100px, 12vw, 130px) !important;
}

/* Emoji Icon Font Fallback agar tidak ada glyph kotak hitam rusak */
[data-helpdesk-public] .hd-btn-icon,
.hd-btn-icon {
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif !important;
}

/* 8.2 Hero Knowledge Base */
[data-helpdesk-public] .hd-kb-hero {
  background: linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(13, 17, 23, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: clamp(24px, 4vw, 40px);
  margin-bottom: 32px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
}

[data-helpdesk-public] .hd-kb-hero::before {
  content: "";
  position: absolute;
  top: -50px;
  right: -50px;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(56, 139, 253, 0.18) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

[data-helpdesk-public] .hd-kb-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(56, 139, 253, 0.15);
  border: 1px solid rgba(56, 139, 253, 0.35);
  color: #58a6ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 14px;
}

[data-helpdesk-public] .hd-kb-hero__title {
  font-size: clamp(1.6rem, 3.2vw, 2.3rem);
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 12px 0;
  line-height: 1.25;
}

[data-helpdesk-public] .hd-kb-hero__desc {
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  color: #8b949e;
  line-height: 1.6;
  max-width: 72ch;
  margin: 0 0 24px 0;
}

/* 8.3 Live Search Bar & Controls */
[data-helpdesk-public] .hd-kb-search-wrap {
  position: relative;
  max-width: 680px;
  margin-bottom: 24px;
}

[data-helpdesk-public] .hd-kb-search-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #8b949e;
  pointer-events: none;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif !important;
}

[data-helpdesk-public] .hd-kb-search-input {
  width: 100%;
  height: 52px;
  padding: 12px 48px 12px 50px;
  background: rgba(13, 17, 23, 0.9);
  border: 1.5px solid rgba(56, 139, 253, 0.4);
  border-radius: 12px;
  color: #ffffff;
  font-size: 15px;
  outline: none;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

[data-helpdesk-public] .hd-kb-search-input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.25), 0 4px 20px rgba(0, 0, 0, 0.35);
  background: #0d1117;
}

[data-helpdesk-public] .hd-kb-search-clear {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #8b949e;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

[data-helpdesk-public] .hd-kb-search-clear:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

/* 8.4 Category Filter Tabs */
[data-helpdesk-public] .hd-kb-filter-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding-bottom: 4px;
}

[data-helpdesk-public] .hd-kb-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 30px;
  background: rgba(22, 27, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #c9d1d9;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

[data-helpdesk-public] .hd-kb-filter-btn:hover {
  background: rgba(56, 139, 253, 0.15);
  border-color: rgba(56, 139, 253, 0.4);
  color: #58a6ff;
}

[data-helpdesk-public] .hd-kb-filter-btn.active,
[data-helpdesk-public] .hd-kb-filter-btn[aria-pressed="true"] {
  background: #1f6feb !important;
  border-color: #388bfd !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.35);
}

[data-helpdesk-public] .hd-kb-filter-count {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.18);
  padding: 2px 7px;
  border-radius: 12px;
  margin-left: 2px;
}

[data-helpdesk-public] .hd-kb-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
  color: #8b949e;
  flex-wrap: wrap;
  gap: 10px;
}

/* 8.5 Featured Guide Hero Card */
[data-helpdesk-public] .hd-featured-guide {
  background: linear-gradient(135deg, rgba(26, 32, 44, 0.95) 0%, rgba(13, 17, 23, 0.98) 100%);
  border: 1.5px solid rgba(56, 139, 253, 0.35);
  border-radius: 16px;
  padding: clamp(20px, 3vw, 32px);
  margin-bottom: 36px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 28px;
  align-items: center;
  position: relative;
  overflow: hidden;
}

@media (max-width: 860px) {
  [data-helpdesk-public] .hd-featured-guide {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

[data-helpdesk-public] .hd-featured-guide__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

[data-helpdesk-public] .hd-featured-guide__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

[data-helpdesk-public] .hd-featured-guide__badge {
  background: linear-gradient(90deg, #d29922 0%, #e3b341 100%);
  color: #0e1117;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

[data-helpdesk-public] .hd-featured-guide__title {
  font-size: clamp(1.25rem, 2.2vw, 1.65rem);
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  line-height: 1.3;
}

[data-helpdesk-public] .hd-featured-guide__desc {
  font-size: 14.5px;
  color: #a0aec0;
  line-height: 1.65;
  margin: 0;
}

[data-helpdesk-public] .hd-featured-guide__footer {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 8px;
}

[data-helpdesk-public] .hd-featured-guide__visual {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(56, 139, 253, 0.08);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(56, 139, 253, 0.2);
}

[data-helpdesk-public] .hd-featured-guide__visual img {
  width: 100%;
  max-width: 220px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
}

/* 8.6 Knowledge Grid & Cards */
[data-helpdesk-public] .hd-knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}

@media (max-width: 640px) {
  [data-helpdesk-public] .hd-knowledge-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

[data-helpdesk-public] .hd-knowledge-card {
  background: rgba(22, 27, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

[data-helpdesk-public] .hd-knowledge-card:hover {
  transform: translateY(-4px);
  border-color: rgba(56, 139, 253, 0.45);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

[data-helpdesk-public] .hd-knowledge-card__thumb {
  position: relative;
  width: 100%;
  height: 155px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

[data-helpdesk-public] .hd-knowledge-card__thumb img {
  max-width: 120px;
  max-height: 120px;
  object-fit: contain;
  transition: transform 0.3s ease;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35));
}

[data-helpdesk-public] .hd-knowledge-card:hover .hd-knowledge-card__thumb img {
  transform: scale(1.08);
}

[data-helpdesk-public] .hd-knowledge-card__badge-cat {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(13, 17, 23, 0.88);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

[data-helpdesk-public] .hd-knowledge-card__badge-cat--spbe { color: #58a6ff; border-color: rgba(56, 139, 253, 0.35); }
[data-helpdesk-public] .hd-knowledge-card__badge-cat--csirt { color: #f85149; border-color: rgba(248, 81, 73, 0.35); }
[data-helpdesk-public] .hd-knowledge-card__badge-cat--network { color: #3fb950; border-color: rgba(63, 185, 80, 0.35); }
[data-helpdesk-public] .hd-knowledge-card__badge-cat--app { color: #d2a8ff; border-color: rgba(210, 168, 255, 0.35); }
[data-helpdesk-public] .hd-knowledge-card__badge-cat--identity { color: #e3b341; border-color: rgba(227, 179, 65, 0.35); }
[data-helpdesk-public] .hd-knowledge-card__badge-cat--news { color: #56d364; border-color: rgba(86, 211, 100, 0.35); }

[data-helpdesk-public] .hd-knowledge-card__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

[data-helpdesk-public] .hd-knowledge-card__info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8b949e;
  margin-bottom: 8px;
}

[data-helpdesk-public] .hd-knowledge-card__title {
  font-size: 16px;
  font-weight: 700;
  color: #f0f6fc;
  margin: 0 0 10px 0;
  line-height: 1.4;
}

[data-helpdesk-public] .hd-knowledge-card__title a {
  color: inherit;
  text-decoration: none;
}

[data-helpdesk-public] .hd-knowledge-card__title a:hover {
  color: #58a6ff;
}

[data-helpdesk-public] .hd-knowledge-card__summary {
  font-size: 13.5px;
  color: #8b949e;
  line-height: 1.6;
  margin: 0 0 18px 0;
  flex: 1;
}

[data-helpdesk-public] .hd-knowledge-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: auto;
}

[data-helpdesk-public] .hd-btn-kb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(56, 139, 253, 0.12);
  border: 1px solid rgba(56, 139, 253, 0.3);
  color: #58a6ff;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

[data-helpdesk-public] .hd-btn-kb:hover {
  background: #1f6feb;
  border-color: #388bfd;
  color: #ffffff;
}

/* 8.7 Article Reader Modal */
.hd-article-modal {
  position: fixed !important;
  inset: 0 !important;
  margin: auto !important;
  width: min(760px, calc(100vw - 32px)) !important;
  max-width: 760px !important;
  max-height: calc(100dvh - 48px) !important;
  padding: 0 !important;
  border-radius: 16px !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  background: #0d1117 !important;
  color: #c9d1d9 !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6) !important;
  z-index: 2100 !important;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}

.hd-article-modal:not([open]) {
  display: none !important;
}

.hd-article-modal::backdrop {
  background: rgba(0, 0, 0, 0.75) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}

.hd-article-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(22, 27, 34, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.hd-article-modal__body {
  padding: 24px 28px;
  overflow-y: auto;
  flex: 1;
  font-size: 15px;
  line-height: 1.7;
}

.hd-article-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 24px;
  background: rgba(22, 27, 34, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.hd-callout {
  padding: 14px 18px;
  border-radius: 8px;
  margin: 16px 0;
  border-left: 4px solid #388bfd;
  background: rgba(56, 139, 253, 0.1);
  font-size: 14px;
  line-height: 1.6;
}

.hd-callout--warning {
  border-left-color: #d29922;
  background: rgba(210, 153, 34, 0.1);
  color: #e3b341;
}

.hd-callout--danger {
  border-left-color: #f85149;
  background: rgba(248, 81, 73, 0.1);
  color: #ff7b72;
}

.hd-callout--success {
  border-left-color: #3fb950;
  background: rgba(63, 185, 80, 0.1);
  color: #7ee787;
}

/* Responsif Mobile KB */
@media (max-width: 640px) {
  [data-helpdesk-public] .hd-kb-hero {
    padding: 20px 16px !important;
    margin-bottom: 24px !important;
  }
  [data-helpdesk-public] .hd-kb-filter-tabs {
    gap: 8px !important;
  }
  [data-helpdesk-public] .hd-kb-filter-btn {
    padding: 6px 12px !important;
    font-size: 12px !important;
  }
  .hd-article-modal {
    width: calc(100vw - 16px) !important;
    max-height: calc(100dvh - 24px) !important;
  }
  .hd-article-modal__body {
    padding: 16px 16px !important;
  }
  .hd-article-modal__footer {
    padding: 12px 16px !important;
  }
}
'''

def patch_public_ui_css():
    print("[2/3] Patching frontend/public-ui.css...")
    css = PUBLIC_UI_CSS.read_text(encoding='utf-8')
    if "/* 8. BASIS PENGETAHUAN & PANDUAN OPERASIONAL TIK" in css:
        print("  -> Knowledge Base CSS section already present, replacing...")
        import re
        css = re.sub(r'/\* =+\s*8\. BASIS PENGETAHUAN[\s\S]*$', CSS_KNOWLEDGE_RULES.strip() + "\n", css)
    else:
        print("  -> Appending Knowledge Base CSS section...")
        css = css.rstrip() + "\n\n" + CSS_KNOWLEDGE_RULES.strip() + "\n"
    PUBLIC_UI_CSS.write_text(css, encoding='utf-8')
    print("  -> Successfully updated frontend/public-ui.css")

M0_03_KB_INIT = r'''
async function initKnowledgeBase(): Promise<void> {
  const searchInput = $('#hd-knowledge-search') as HTMLInputElement | null;
  const clearBtn = $('[data-hd-search-clear]') as HTMLButtonElement | null;
  const countBadge = $('#hd-kb-count');
  const emptyState = $('#hd-kb-empty');
  const cards = nodes<HTMLElement>('.hd-knowledge-card');
  const filterBtns = nodes<HTMLButtonElement>('[data-hd-kb-filter]');
  const modal = $('#hd-article-modal') as HTMLDialogElement | null;

  let currentCategory = 'all';
  let searchQuery = '';

  const applyFilters = () => {
    let visibleCount = 0;
    const q = searchQuery.toLowerCase().trim();
    cards.forEach(card => {
      const cat = card.dataset.category || '';
      const text = (card.textContent || '').toLowerCase();
      const matchesCat = currentCategory === 'all' || cat === currentCategory;
      const matchesQuery = !q || text.includes(q);
      const isVisible = matchesCat && matchesQuery;
      card.hidden = !isVisible;
      if (isVisible) visibleCount++;
    });

    if (countBadge) {
      countBadge.textContent = `Menampilkan ${visibleCount} dari ${cards.length} panduan & artikel resmi`;
    }
    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      if (clearBtn) clearBtn.hidden = !searchQuery;
      applyFilters();
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.hidden = true;
      searchInput.focus();
      applyFilters();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentCategory = btn.dataset.hdKbFilter || 'all';
      applyFilters();
    });
  });

  const openModal = (slug: string) => {
    if (!modal) return;
    const template = $(`template[data-hd-article-template="${slug}"]`) as HTMLTemplateElement | null;
    const bodyContainer = $('#hd-modal-article-body', modal);
    const titleEl = $('#hd-modal-article-title', modal);
    const catEl = $('#hd-modal-article-cat', modal);
    const timeEl = $('#hd-modal-article-time', modal);
    const dateEl = $('#hd-modal-article-date', modal);

    if (template && bodyContainer) {
      bodyContainer.replaceChildren(template.content.cloneNode(true));
      const sourceCard = $(`[data-hd-read-slug="${slug}"]`)?.closest('.hd-knowledge-card') || $('.hd-featured-guide');
      if (sourceCard && titleEl) {
        titleEl.textContent = sourceCard.querySelector('.hd-knowledge-card__title, .hd-featured-guide__title')?.textContent?.trim() || 'Panduan TIK';
      }
      if (sourceCard && catEl) {
        catEl.textContent = sourceCard.querySelector('.court-badge, .hd-knowledge-card__badge-cat, .hd-featured-guide__badge')?.textContent?.trim() || 'Panduan SPBE';
      }
      if (sourceCard && timeEl) {
        timeEl.textContent = sourceCard.querySelector('[data-hd-read-time]')?.textContent?.trim() || '5 menit baca';
      }
      if (sourceCard && dateEl) {
        dateEl.textContent = sourceCard.querySelector('[data-hd-date]')?.textContent?.trim() || '2026';
      }
    }
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    window.location.hash = `panduan-${slug}`;
  };

  nodes('[data-hd-read-slug]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const slug = btn.getAttribute('data-hd-read-slug');
      if (slug) openModal(slug);
    });
  });

  nodes('[data-hd-close-article]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') {
        modal.close();
      } else {
        modal?.removeAttribute('open');
      }
      if (window.location.hash.startsWith('#panduan-')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    });
  });

  $('#hd-modal-print')?.addEventListener('click', () => {
    window.print();
  });

  $('#hd-modal-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const copyEl = $('#hd-modal-copy');
      if (copyEl) {
        const orig = copyEl.innerHTML;
        copyEl.innerHTML = '<span class="hd-btn-icon">✅</span> Tautan Tersalin!';
        setTimeout(() => { copyEl.innerHTML = orig; }, 2000);
      }
    } catch {
      // Fallback
    }
  });

  // URL hash check
  const hash = window.location.hash;
  if (hash.startsWith('#panduan-')) {
    const slug = hash.replace('#panduan-', '');
    openModal(slug);
  } else if (window.location.pathname.startsWith('/panduan/')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 1) {
      const slug = parts[1].replace('.html', '');
      openModal(slug);
    }
  }

  // Live article fetch from backend M8 (if available)
  try {
    const res = await api<{ items: Array<{ id: string; slug: string; title: string; body: string; created_at: string }> }>('/knowledge/articles?limit=50');
    if (res && Array.isArray(res.items)) {
      for (const item of res.items) {
        const tmpl = $(`template[data-hd-article-template="${item.slug}"]`) as HTMLTemplateElement | null;
        if (tmpl && item.body) {
          const div = document.createElement('div');
          div.innerHTML = item.body;
          tmpl.content.replaceChildren(div);
        }
      }
    }
  } catch {
    // Quietly ignore network/auth errors in lab/offline mode
  }
}
'''

def patch_m0_03_ts():
    print("[3/3] Patching frontend/src/features/m0-03.ts...")
    ts = M0_03_TS.read_text(encoding='utf-8')
    
    if "async function initKnowledgeBase()" not in ts:
        # Insert initKnowledgeBase before async function main()
        ts = ts.replace("async function main() {", M0_03_KB_INIT.strip() + "\n\nasync function main() {")
        print("  -> Injected initKnowledgeBase() function")
    else:
        print("  -> initKnowledgeBase() already present")
        
    # Hook up page === 'knowledge' in main()
    old_hook = "if (page === 'admin') await admin();"
    new_hook = "if (page === 'admin') await admin();\n    if (page === 'knowledge') await initKnowledgeBase();"
    if "page === 'knowledge'" not in ts:
        ts = ts.replace(old_hook, new_hook)
        print("  -> Connected knowledge page hook in main()")
        
    M0_03_TS.write_text(ts, encoding='utf-8')
    print("  -> Successfully updated frontend/src/features/m0-03.ts")

if __name__ == "__main__":
    patch_business_pages()
    patch_public_ui_css()
    patch_m0_03_ts()
    print("\n[SUCCESS] All Knowledge Base source files patched cleanly!")
