# Script to update frontend/business-pages.mjs for M0-10 UI components
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
target_file = ROOT / 'frontend' / 'business-pages.mjs'
content = target_file.read_text(encoding='utf-8')

target_option = '<option value="articles">Artikel konten (M8)</option>'
replacement_option = '<option value="articles">Artikel konten (M8)</option><option value="notifications">Pusat Notifikasi &amp; Telegram (M9)</option><option value="reports">Laporan dan Ekspor SLA (M9)</option><option value="audit">Jejak Audit Append-Only (M9)</option>'

if target_option in content and 'Pusat Notifikasi' not in content:
    content = content.replace(target_option, replacement_option, 1)

m9_section = '''
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
        <p><strong>Denominator (Total Kasus):</strong> <span data-hd-rep-denominator>0</span></p>
        <p><strong>Jumlah Memenuhi Target:</strong> <span data-hd-rep-count>0</span></p>
        <p><strong>Watermark:</strong> <span data-hd-rep-watermark>-</span></p>
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
          <a data-hd-download-link class="piui-btn piui-btn--primary" href="#" download>Unduh Berkas Ekspor</a>
        </div>
      </form>
    </dialog>

    <!-- Panel Telegram & Notifikasi -->
    <div data-hd-panel="notifications" class="piui-panel" hidden>
      <h3>Pengikatan Saluran Telegram (SINK Lab)</h3>
      <form data-hd-telegram-form class="hd-form-grid">
        <div class="piui-field"><label for="hd-tg-org">Organisasi Scope</label><select class="piui-input" id="hd-tg-org"></select></div>
        <div class="piui-field"><label for="hd-tg-code">Kode Verifikasi / Chat Reference</label><input class="piui-input" id="hd-tg-code" type="text" placeholder="Contoh: 12345678:ABCDEF" required></div>
        <div class="hd-actions">
          <button type="submit" class="piui-btn piui-btn--primary" data-hd-tg-bind>Hubungkan Telegram</button>
        </div>
      </form>
      <p data-hd-telegram-status role="status"></p>
    </div>

    <!-- Panel Audit -->
    <div data-hd-panel="audit" class="piui-panel" hidden>
      <h3>Jejak Audit Append-Only (AC20)</h3>
      <div class="hd-actions"><button type="button" class="piui-btn piui-btn--secondary" data-hd-refresh-audit>Segarkan Jejak Audit</button></div>
      <div class="hd-table-wrap"><table class="piui-table" data-hd-audit-table><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Objek</th><th>Hasil</th><th>Alasan</th></tr></thead><tbody data-hd-audit-rows></tbody></table></div>
    </div>
  </section>
'''

target_end = '</section></main>'
if target_end in content and 'data-hd-m9-section' not in content:
    content = content.replace(target_end, m9_section + '\n  ' + target_end, 1)

target_file.write_text(content, encoding='utf-8')
print("Successfully updated frontend/business-pages.mjs")
