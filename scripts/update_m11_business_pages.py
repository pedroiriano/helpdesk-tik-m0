import os

with open('frontend/business-pages.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

target = '    </div>\n  </section>\n\n  </section></main>`;'
replacement = '''    </div>
  </section>

  <section class="piui-card" data-hd-m11-section hidden>
    <h2>Pemeliharaan Sistem, Scoped Runner &amp; Diagnosa (M11)</h2>
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
        <div class="piui-field"><label for="hd-runner-approver">Penyetujui (Dual-Control)</label><input class="piui-input" id="hd-runner-approver" type="text" placeholder="UUID penyetujui yang berbeda dari pemohon (opsional)"></div>
        <div class="hd-actions" style="grid-column:1/-1;">
          <button type="submit" class="piui-btn piui-btn--primary">Jalankan Tugas Operasional</button>
        </div>
      </form>
      <p data-hd-runner-status role="status"></p>
      <div data-hd-runner-result class="piui-card" style="margin-top:1rem;background:#f8f9fa;" hidden>
        <h4>Hasil Eksekusi Runner</h4>
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

  </section></main>`;'''

assert target in content, 'target not found'
new_content = content.replace(target, replacement, 1)
with open('frontend/business-pages.mjs', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Updated frontend/business-pages.mjs successfully')
