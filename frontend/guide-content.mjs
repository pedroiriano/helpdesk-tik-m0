import { readFileSync } from 'node:fs';

export const guides = JSON.parse(readFileSync(new URL('./guide-copy.json',import.meta.url),'utf8'));

export function guideRecord(guide) {
  const {title, category, summary} = guide;
  const simulated = category === 'Simulasi';
  const illustration = {Akun:'bantuan-operator', Jaringan:'wifi-jaringan', Aplikasi:'cloud-layanan', Perangkat:'perawatan-tik'}[category] || 'tiket-helpdesk';
  return {
    title, summary, eyebrow: category + ' · Helpdesk TIK',
    image: '/assets/helpdesk/03_Ilustrasi_Pendukung/ilustrasi-' + illustration + '.png',
    alt: 'Ilustrasi bantuan ' + category,
    caption: 'Ilustrasi layanan Helpdesk TIK · ' + category,
    stats: [['Kategori', category], ['Lingkungan','Lokal'], ['Isi','Contoh'], ['Tujuan',simulated ? 'Simulasi' : 'Panduan']],
    specs: [['Layanan','Helpdesk TIK'], ['Kategori',category], ['Data','Sintetis'], ['Tahap','Pengembangan']],
    prose: [summary, simulated ? 'Ubah jumlah laporan dan bobot pada kalkulator untuk membandingkan skenario.' : 'Gunakan data sintetis saat menjelajahi portal lokal. Pelaporan tiket operasional belum dibuka.'],
    steps: simulated ? ['Pilih jumlah laporan per bulan.', 'Tentukan bobot penanganan.', 'Atur frekuensi tindak lanjut.', 'Bandingkan hasil antar skenario.'] :
      ['Kenali layanan yang terdampak.', 'Catat waktu dan gejala kendala.', 'Siapkan bukti yang telah disamarkan.', 'Periksa kembali informasi sebelum dibagikan.'],
  };
}

export function guidePage(file, html) {
  const slug = file.split('/').pop().replace('.html','');
  const data = guideRecord(guides[slug]);
  const filled = (pattern, value) => { html = html.replace(pattern, (_, start, end) => start + value + end); };
  filled(/(<h1\b[^>]*>)[^<]*(<\/h1>)/, data.title);
  filled(/(<span class="vy-detail-hero__index">)[^<]*(<\/span>)/, data.eyebrow);
  filled(/(<p class="vy-detail-summary">)[^<]*(<\/p>)/, data.summary);
  filled(/(<figcaption[^>]*>)[^<]*(<\/figcaption>)/, data.caption);
  filled(/(<p class="vy-detail-context">)[^<]*(<\/p>)/, 'Panduan pengembangan Helpdesk TIK Kota Depok.');
  for (const [id, title] of Object.entries({'context-title':'Keterangan', 'scope-title':'Ringkasan panduan', 'steps-title':'Langkah berikutnya'})) {
    filled(new RegExp('(<h2 id="'+id+'">)[^<]*(</h2>)'), title);
  }
  let pairIndex = 0;
  const pairs = [...data.stats, ...data.specs];
  html = html.replace(/<dt>[^<]*<\/dt><dd>[^<]*<\/dd>/g, () => {
    const [key, value] = pairs[pairIndex++];
    return '<dt>'+key+'</dt><dd>'+value+'</dd>';
  });
  html = html.replace(/<div><p>[^<]*<\/p><p>[^<]*<\/p><\/div>/, '<div>'+data.prose.map(p=>'<p>'+p+'</p>').join('')+'</div>');
  return html.replace(/(<ol class="vy-detail-process">)[\s\S]*?(<\/ol>)/, '$1'+data.steps.map(step=>'<li>'+step+'</li>').join('')+'$2');
}
