// frontend/lightbox.js — Lightbox Penampil Galeri Helpdesk TIK Kota Depok
// Dilengkapi navigasi unik Keyboard, Mouse Wheel Zoom, Click & Drag Pan/Swipe, Slideshow, dan WAI-ARIA Focus Trap.

function initLightbox() {
  if (document.documentElement.dataset.lightboxReady === 'true') return;
  document.documentElement.dataset.lightboxReady = 'true';

  const galleryItems = [
    {
      title: 'Akun & Akses Identitas ASN',
      category: 'Akun & Hak Akses',
      tag: 'SSO & Identitas',
      desc: 'Pengelolaan akun SSO, reset kata sandi, aktivasi akun ASN, dan pemulihan izin akses sistem pemerintahan Kota Depok.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-akun-identitas.png'
    },
    {
      title: 'Jaringan Internet & WiFi Pemkot',
      category: 'Jaringan & Konektivitas',
      tag: 'Fiber Optic & WiFi',
      desc: 'Infrastruktur fiber optic, WiFi publik Pemkot Depok, router, VPN dinas, dan pemantauan stabilitas jaringan intranet.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-wifi-jaringan.png'
    },
    {
      title: 'Aplikasi Informatika & SPBE',
      category: 'Aplikasi Digital',
      tag: 'e-Gov & SPBE',
      desc: 'Dukungan sistem e-Office, modul layanan digital terpadu, integrasi API Diskominfo, dan penyelesaian kendala aplikasi.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-aplikasi-digital.png'
    },
    {
      title: 'Perawatan & Pemeliharaan TIK',
      category: 'Perangkat Keras & Lab',
      tag: 'Hardware & Lab',
      desc: 'Inspeksi berkala PC kerja, laptop dinas, printer, scanner, dan perangkat telekonferensi seluruh perangkat daerah.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-perawatan-tik.png'
    },
    {
      title: 'Panduan & Basis Pengetahuan',
      category: 'Panduan Mandiri',
      tag: 'Knowledge Base',
      desc: 'Dokumentasi operasional, SOP penanganan mandiri, video tutorial, serta petunjuk teknis layanan SPBE terstandar.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-panduan-pengetahuan.png'
    },
    {
      title: 'Pelacakan Tiket & SLA Transparan',
      category: 'Manajemen Layanan',
      tag: 'SLA & Transparansi',
      desc: 'Transparansi progres pengerjaan tiket, batas waktu SLA net/gross, dan verifikasi berkas tuntas oleh pemohon.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-pelacakan-sla.png'
    },
    {
      title: 'Keamanan Siber (Depok-CSIRT)',
      category: 'Keamanan Informasi',
      tag: 'CSIRT & Siber',
      desc: 'Mitigasi insiden keamanan siber, tanggap malware, perlindungan data pribadi, dan audit berkala kerentanan portal.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-keamanan-siber.png'
    },
    {
      title: 'Server & Infrastruktur Data Center',
      category: 'Infrastruktur Server',
      tag: 'Data Center',
      desc: 'Pusat data Diskominfo Kota Depok, virtual server cluster, alokasi penyimpanan cloud, dan cadangan data otomatis.',
      src: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-server-infrastruktur.png'
    },
    {
      title: 'Bantuan TIK Terpadu & Ramah Warga',
      category: 'Panorama Pelayanan',
      tag: 'Pelayanan Publik',
      desc: 'Layanan meja bantuan TIK yang inklusif, ramah, dan responsif bagi seluruh masyarakat dan pegawai Kota Depok.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-01-bantuan-tik-terpadu-tanpa-teks.png'
    },
    {
      title: 'Alur Layanan & Pelaporan Terstruktur',
      category: 'Panorama Pelayanan',
      tag: 'Alur Pelaporan',
      desc: 'Kemudahan alur pelaporan mulai dari pemilihan 16 katalog resmi, pengunggahan bukti kendala, hingga konfirmasi tuntas.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-02-tiket-layanan-tanpa-teks.png'
    },
    {
      title: 'Dukungan Teknisi Profesional',
      category: 'Panorama Pelayanan',
      tag: 'Tenaga Ahli TIK',
      desc: 'Tim teknisi terampil dan berdedikasi siap mendampingi penanganan kendala teknis perangkat daerah secara langsung.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-03-dukungan-kinerja-tanpa-teks.png'
    },
    {
      title: 'Layanan Digital Terintegrasi & Andal',
      category: 'Panorama Pelayanan',
      tag: 'Infrastruktur Cerdas',
      desc: 'Integrasi ekosistem teknologi informasi Kota Depok yang aman, tangguh, dan berkesinambungan menuju Smart City.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-04-layanan-terintegrasi-tanpa-teks.png'
    },
    {
      title: 'Pusat Panduan Mandiri & Standar SPBE',
      category: 'Panorama Pelayanan',
      tag: 'Literasi Digital',
      desc: 'Akses mudah ke basis pengetahuan mandiri, regulasi, dan petunjuk teknis aplikasi untuk akselerasi kecakapan digital.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-05-pusat-panduan-mandiri-tanpa-teks.png'
    },
    {
      title: 'Kolaborasi Antar Perangkat Daerah',
      category: 'Panorama Pelayanan',
      tag: 'Sinergi OPD',
      desc: 'Sinergi kuat lintas Organisasi Perangkat Daerah demi percepatan transformasi tata kelola pemerintahan digital terpadu.',
      src: '/assets/helpdesk/02_Hero_Tanpa_Teks/hero-06-kolaborasi-perangkat-daerah-tanpa-teks.png'
    }
  ];

  let modal = document.getElementById('vy-lightbox');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vy-lightbox';
    modal.className = 'vy-lightbox';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Penampil Galeri Lightbox Helpdesk TIK');
    modal.setAttribute('hidden', '');
    modal.innerHTML = `
      <div class="vy-lightbox__backdrop" id="vy-lb-backdrop" aria-hidden="true"></div>
      <div class="vy-lightbox__container" id="vy-lb-container">
        <header class="vy-lightbox__header">
          <div class="vy-lightbox__meta">
            <span class="vy-lightbox__badge" id="vy-lb-tag">Koleksi</span>
            <span class="vy-lightbox__counter" id="vy-lb-counter">1 / 14</span>
            <h3 class="vy-lightbox__title" id="vy-lb-title">Galeri Karya Seni TIK</h3>
          </div>
          <div class="vy-lightbox__tools">
            <button type="button" class="vy-lb-btn" id="vy-lb-zoom-out" title="Perkecil (Pintasan: -)" aria-label="Perkecil">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button type="button" class="vy-lb-btn vy-lb-btn--pill" id="vy-lb-zoom-reset" title="Reset Zoom 100% (Pintasan: 0 atau R)" aria-label="Reset Ukuran">
              <span id="vy-lb-zoom-level">100%</span>
            </button>
            <button type="button" class="vy-lb-btn" id="vy-lb-zoom-in" title="Perbesar (Pintasan: +)" aria-label="Perbesar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button type="button" class="vy-lb-btn" id="vy-lb-slideshow" title="Putar Slideshow Otomatis (Pintasan: Spasi)" aria-label="Putar Slideshow">
              <svg id="vy-lb-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg id="vy-lb-pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" hidden><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button type="button" class="vy-lb-btn" id="vy-lb-fullscreen" title="Layar Penuh (Pintasan: F)" aria-label="Layar Penuh">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <button type="button" class="vy-lb-btn" id="vy-lb-help-toggle" title="Petunjuk Pintasan Keyboard & Mouse" aria-label="Bantuan Navigasi">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
            <button type="button" class="vy-lb-btn vy-lb-btn--close" id="vy-lb-close" title="Tutup Galeri (Pintasan: Esc)" aria-label="Tutup">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <div class="vy-lb-help-panel" id="vy-lb-help-panel" hidden>
          <div class="vy-lb-help-head">
            <h4>🎮 Pintasan Keyboard &amp; Navigasi Mouse</h4>
            <button type="button" id="vy-lb-help-close" class="vy-lb-help-close" aria-label="Tutup bantuan">&times;</button>
          </div>
          <div class="vy-lb-help-grid">
            <div><kbd>&larr;</kbd> / <kbd>&rarr;</kbd> : Gambar Sebelumnya / Berikutnya</div>
            <div><kbd>Spasi</kbd> : Putar / Jeda Slideshow (3.5 Detik)</div>
            <div><kbd>+</kbd> / <kbd>-</kbd> : Perbesar / Perkecil Ukuran</div>
            <div><kbd>0</kbd> / <kbd>R</kbd> : Reset Ukuran &amp; Posisi (100%)</div>
            <div><kbd>Home</kbd> / <kbd>End</kbd> : Lompat ke Gambar Awal / Akhir</div>
            <div><kbd>F</kbd> : Toggle Layar Penuh (Fullscreen)</div>
            <div><kbd>Esc</kbd> : Tutup Penampil Galeri</div>
            <div><kbd>Roda Mouse</kbd> : Zoom In / Out Halus Terpusat Kursor</div>
            <div><kbd>Klik &amp; Geser</kbd> : Geser Gambar (Saat Zoom) / Geser Slide (100%)</div>
            <div><kbd>Dobel Klik</kbd> : Zoom Cepat 200% / Reset 100%</div>
          </div>
        </div>

        <main class="vy-lightbox__stage" id="vy-lb-stage">
          <button type="button" class="vy-lb-nav vy-lb-nav--prev" id="vy-lb-prev" title="Gambar Sebelumnya (Pintasan: &larr;)" aria-label="Sebelumnya">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div class="vy-lightbox__viewport" id="vy-lb-viewport">
            <div class="vy-lightbox__canvas" id="vy-lb-canvas">
              <img id="vy-lb-image" class="vy-lightbox__img" src="" alt="" draggable="false">
            </div>
          </div>

          <button type="button" class="vy-lb-nav vy-lb-nav--next" id="vy-lb-next" title="Gambar Berikutnya (Pintasan: &rarr;)" aria-label="Berikutnya">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </main>

        <footer class="vy-lightbox__footer">
          <div class="vy-lightbox__caption">
            <p id="vy-lb-desc" class="vy-lb-desc"></p>
          </div>
          <div class="vy-lightbox__filmstrip-wrap">
            <div class="vy-lightbox__filmstrip" id="vy-lb-filmstrip" role="tablist" aria-label="Daftar Karya Seni">
            </div>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Element handles
  const backdrop = document.getElementById('vy-lb-backdrop');
  const stage = document.getElementById('vy-lb-stage');
  const viewport = document.getElementById('vy-lb-viewport');
  const canvas = document.getElementById('vy-lb-canvas');
  const image = document.getElementById('vy-lb-image');
  const tagEl = document.getElementById('vy-lb-tag');
  const counterEl = document.getElementById('vy-lb-counter');
  const titleEl = document.getElementById('vy-lb-title');
  const descEl = document.getElementById('vy-lb-desc');
  const zoomLevelEl = document.getElementById('vy-lb-zoom-level');
  const filmstrip = document.getElementById('vy-lb-filmstrip');
  const btnPrev = document.getElementById('vy-lb-prev');
  const btnNext = document.getElementById('vy-lb-next');
  const btnClose = document.getElementById('vy-lb-close');
  const btnZoomIn = document.getElementById('vy-lb-zoom-in');
  const btnZoomOut = document.getElementById('vy-lb-zoom-out');
  const btnZoomReset = document.getElementById('vy-lb-zoom-reset');
  const btnSlideshow = document.getElementById('vy-lb-slideshow');
  const iconPlay = document.getElementById('vy-lb-play-icon');
  const iconPause = document.getElementById('vy-lb-pause-icon');
  const btnFullscreen = document.getElementById('vy-lb-fullscreen');
  const btnHelpToggle = document.getElementById('vy-lb-help-toggle');
  const btnHelpClose = document.getElementById('vy-lb-help-close');
  const helpPanel = document.getElementById('vy-lb-help-panel');

  // State
  let currentIndex = 0;
  let zoomScale = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let isSlideshow = false;
  let slideshowTimer = null;
  let lastFocusedElement = null;

  // Build Filmstrip Thumbnails
  filmstrip.innerHTML = '';
  galleryItems.forEach((item, idx) => {
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'vy-lb-thumb';
    thumbBtn.setAttribute('role', 'tab');
    thumbBtn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    thumbBtn.setAttribute('aria-label', `${idx + 1}. ${item.title}`);
    thumbBtn.setAttribute('data-index', idx);
    thumbBtn.innerHTML = `
      <img src="${item.src}" alt="${item.title}" loading="lazy" width="84" height="52">
      <span class="vy-lb-thumb__seq">${idx + 1}</span>
    `;
    thumbBtn.addEventListener('click', () => {
      goTo(idx);
    });
    filmstrip.appendChild(thumbBtn);
  });

  function updateTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    zoomLevelEl.textContent = `${Math.round(zoomScale * 100)}%`;
    if (zoomScale > 1) {
      canvas.classList.add('is-zoomed');
      viewport.classList.add('is-zoomed');
    } else {
      canvas.classList.remove('is-zoomed');
      viewport.classList.remove('is-zoomed');
    }
  }

  function resetZoom() {
    zoomScale = 1.0;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  function setZoom(newScale) {
    zoomScale = Math.min(4.0, Math.max(1.0, Math.round(newScale * 100) / 100));
    if (zoomScale <= 1.0) {
      panX = 0;
      panY = 0;
    }
    updateTransform();
  }

  function renderSlide() {
    const item = galleryItems[currentIndex];
    if (!item) return;

    resetZoom();
    image.classList.add('is-loading');
    image.src = item.src;
    image.alt = item.title;

    image.onload = () => {
      image.classList.remove('is-loading');
    };

    tagEl.textContent = `${item.category} · ${item.tag}`;
    counterEl.textContent = `${currentIndex + 1} / ${galleryItems.length}`;
    titleEl.textContent = item.title;
    descEl.textContent = item.desc;

    // Update active thumbnail in filmstrip
    const thumbs = filmstrip.querySelectorAll('.vy-lb-thumb');
    thumbs.forEach((t, i) => {
      const active = i === currentIndex;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
  }

  function goTo(index) {
    if (index < 0) index = galleryItems.length - 1;
    if (index >= galleryItems.length) index = 0;
    currentIndex = index;
    renderSlide();
  }

  function nextSlide() {
    goTo(currentIndex + 1);
  }

  function prevSlide() {
    goTo(currentIndex - 1);
  }

  function toggleSlideshow(force) {
    if (typeof force === 'boolean') isSlideshow = force;
    else isSlideshow = !isSlideshow;

    if (isSlideshow) {
      iconPlay.hidden = true;
      iconPause.hidden = false;
      btnSlideshow.setAttribute('aria-label', 'Jeda Slideshow');
      btnSlideshow.classList.add('is-active');
      if (slideshowTimer) clearInterval(slideshowTimer);
      slideshowTimer = setInterval(() => {
        nextSlide();
      }, 3500);
    } else {
      iconPlay.hidden = false;
      iconPause.hidden = true;
      btnSlideshow.setAttribute('aria-label', 'Putar Slideshow');
      btnSlideshow.classList.remove('is-active');
      if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
      }
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (modal.requestFullscreen) modal.requestFullscreen();
      else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function openLightbox(initialIndex = 0) {
    lastFocusedElement = document.activeElement;
    modal.removeAttribute('hidden');
    modal.setAttribute('data-open', 'true');
    document.body.classList.add('vy-lightbox-open');
    currentIndex = (initialIndex >= 0 && initialIndex < galleryItems.length) ? initialIndex : 0;
    renderSlide();
    btnClose.focus();
  }

  function closeLightbox() {
    toggleSlideshow(false);
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch (e) {}
    }
    helpPanel.hidden = true;
    modal.setAttribute('hidden', '');
    modal.removeAttribute('data-open');
    document.body.classList.remove('vy-lightbox-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  // --- BUTTON CLICKS ---
  btnPrev.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });
  btnNext.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
  btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
  backdrop.addEventListener('click', () => closeLightbox());
  btnZoomIn.addEventListener('click', (e) => { e.stopPropagation(); setZoom(zoomScale + 0.25); });
  btnZoomOut.addEventListener('click', (e) => { e.stopPropagation(); setZoom(zoomScale - 0.25); });
  btnZoomReset.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });
  btnSlideshow.addEventListener('click', (e) => { e.stopPropagation(); toggleSlideshow(); });
  btnFullscreen.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
  btnHelpToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    helpPanel.hidden = !helpPanel.hidden;
  });
  btnHelpClose.addEventListener('click', (e) => {
    e.stopPropagation();
    helpPanel.hidden = true;
  });

  // Close when clicking empty space on stage
  stage.addEventListener('click', (e) => {
    if (e.target === stage || e.target === viewport) {
      closeLightbox();
    }
  });

  // --- MOUSE WHEEL ZOOM ---
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    if (delta < 0) {
      setZoom(zoomScale + 0.25);
    } else if (delta > 0) {
      setZoom(zoomScale - 0.25);
    }
  }, { passive: false });

  // --- DOUBLE CLICK TO TOGGLE ZOOM ---
  canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (zoomScale > 1.0) {
      resetZoom();
    } else {
      setZoom(2.0);
    }
  });

  // --- CLICK & DRAG PAN (when zoomed) / SWIPE (when 1x) ---
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    viewport.classList.add('is-grabbing');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (zoomScale > 1.0) {
      panX = startPanX + dx;
      panY = startPanY + dy;
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    } else {
      // Elastic horizontal swipe preview
      canvas.style.transform = `translate(${dx * 0.4}px, 0px) scale(1)`;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove('is-grabbing');

    if (zoomScale <= 1.0) {
      const dx = e.clientX - startX;
      canvas.classList.add('is-swiping-reset');
      canvas.style.transform = 'translate(0px, 0px) scale(1)';
      setTimeout(() => { canvas.classList.remove('is-swiping-reset'); }, 220);

      if (dx > 50) {
        prevSlide();
      } else if (dx < -50) {
        nextSlide();
      }
    }
  });

  // --- KEYBOARD NAVIGATION & FOCUS TRAP ---
  window.addEventListener('keydown', (e) => {
    if (modal.hasAttribute('hidden')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextSlide();
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      prevSlide();
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      goTo(galleryItems.length - 1);
      return;
    }

    if (e.code === 'Space') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement !== btnSlideshow) {
        // let button handle spacebar
      } else {
        e.preventDefault();
        toggleSlideshow();
        return;
      }
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom(zoomScale + 0.25);
      return;
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom(zoomScale - 0.25);
      return;
    }

    if (e.key === '0' || e.key.toLowerCase() === 'r') {
      e.preventDefault();
      resetZoom();
      return;
    }

    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    // Focus Trap
    if (e.key === 'Tab') {
      const focusables = Array.from(modal.querySelectorAll('button:not([disabled]):not([hidden]), [tabindex="0"]'))
        .filter(el => !el.closest('[hidden]'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // --- BIND TRIGGERS IN PAGE ---
  // 1. Grid Cards on Landing Page
  const gridCards = document.querySelectorAll('#vy-gallery-grid .vy-work');
  gridCards.forEach((card, index) => {
    const link = card.querySelector('.vy-work-pic');
    if (link) {
      link.setAttribute('title', 'Klik untuk melihat di Lightbox Galeri');
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      const trigger = (e) => {
        e.preventDefault();
        const img = link.querySelector('img');
        const imgSrc = img ? img.getAttribute('src') : '';
        const foundIdx = galleryItems.findIndex(item => imgSrc && (imgSrc.includes(item.src) || item.src.includes(imgSrc)));
        openLightbox(foundIdx >= 0 ? foundIdx : index);
      };
      link.addEventListener('click', trigger);
      link.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          trigger(e);
        }
      });
    }
  });

  // 2. Open Gallery Lightbox Button in Toolbar
  const openBtn = document.getElementById('btn-open-gallery-lightbox');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const activeFilterBtn = document.querySelector('.vy-groups button[data-filter][aria-pressed="true"]');
      const activeFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
      let startIdx = 0;
      if (activeFilter === 'finishing') startIdx = 0; // Akun
      else if (activeFilter === 'handles') startIdx = 1; // Jaringan
      else if (activeFilter === 'shooting') startIdx = 2; // Aplikasi
      else if (activeFilter === 'footwork') startIdx = 3; // Perangkat
      openLightbox(startIdx);
    });
  }

  // Expose global API
  window.openHelpdeskLightbox = openLightbox;
}
