/** Mount every public page in the same native PIUI shell. */
export function createPublicUI(landing) {
  const rootLinks = html => html.replace(/href="(?!https?:|mailto:|\/)([^"]*)"/g,
    (_, value) => 'href="' + (value.startsWith('#') ? '/index.html' + value : '/' + value) + '"')
    .replaceAll('href="/pricing.html"','href="/layanan.html"').replaceAll('href="/contact.html"','href="/kontak.html"');
  const header = rootLinks(landing.match(/<header id="vy-topbar_glide_frame">[\s\S]*?<\/header>/)[0])
    .replace(/Simulasi beban/gi, 'Akses layanan')
    .replaceAll('href="/index.html#top"', 'href="/"')
    .replaceAll('href="#top"', 'href="/"');
  const footer = rootLinks(landing.match(/<footer class="vy-footer" id="site-footer">[\s\S]*?<\/footer>/)[0])
    .replaceAll('href="/index.html#top"', 'href="/"')
    .replaceAll('href="/admin/app/helpdesk/index.html"', 'href="/admin/auth/login.html"');

  return html => {
    html = html.replace(/<body\b/, '<body data-helpdesk-public data-public-ui-version="1.1"')
      .replace(/<link rel="stylesheet" href="\/helpdesk\/landing.css">/g, '')
      .replace('</head>', '<link rel="stylesheet" href="/helpdesk/public-ui.css"></head>')
      .replace(/<link rel="icon"[^>]*>/g, '<link rel="icon" type="image/png" href="/assets/helpdesk/05_Brand/logo-favicon.png">');
    // Nginx can serve this shell at nested URLs, so PIUI assets resolve from the origin.
    html = html.replace(/(\s(?:href|src)=")(?=(?:css|js|assets)\/|manifest\.webmanifest(?:[?"#]))/g, '$1/');
    html = /<header id="vy-topbar_glide_frame">/.test(html)
      ? html.replace(/<header id="vy-topbar_glide_frame">[\s\S]*?<\/header>/, header)
      : html.replace(/(<body\b[^>]*>)/, '$1' + header);
    html = /<footer\b/.test(html)
      ? html.replace(/<footer\b[\s\S]*?<\/footer>/, footer)
      : html.replace('</body>', footer + '</body>');
    if (!html.includes('js/modules/navigation.js')) {
      html = html.replace('</body>', '<script src="/js/modules/navigation.js?v=4.3" defer></script></body>');
    }
    if (!html.includes('helpdesk/maintenance-banner.js')) {
      html = html.replace('</body>', '<script src="/helpdesk/maintenance-banner.js" defer></script></body>');
    }
    html = html.replace(/(<main\b[^>]*\bid="main-content")(?![^>]*\btabindex=)/, '$1 tabindex="-1"');
    html = html.replace('>Skip to main content</a>', '>Lewati ke konten utama</a>');
    const images = ['bantuan-operator', 'wifi-jaringan', 'cloud-layanan', 'perawatan-tik'];
    html = html.replace(/<source\b[^>]*ball-0[1-4][^>]*>/g, '');
    html = html.replace(/<img\b[^>]*src="[^"]*ball-0([1-4])[^"]*"[^>]*>/g, (image, number) => {
      const name = images[Number(number) - 1];
      return image.replace(/src="[^"]*"/, 'src="/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-' + name + '.png"')
        .replace(/\s+srcset="[^"]*"/, '')
        .replace(/\s+alt="[^"]*"/, ' alt="Ilustrasi bantuan layanan TIK"')
        .replace(/width="[^"]*"/, 'width="512"').replace(/height="[^"]*"/, 'height="512"');
    });
    return html;
  };
}
