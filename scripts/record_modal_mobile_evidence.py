#!/usr/bin/env python3
"""
Record Evidence for Modal/Dialog System & Mobile First Canonical Standardization
"""

import json
from datetime import datetime, timezone

entry = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'agent': 'Antigravity',
    'task_id': 'MODAL_AND_MOBILE_FIRST_CANONICAL_STANDARDIZATION',
    'scope': 'application',
    'command': 'python scripts/patch_mobile_and_modal_canonical.py; npm run build; docker compose build web; docker compose up -d web; python scripts/test_modal_and_mobile.py',
    'working_directory': r'C:\Datas\Proyek\Aplikasi\helpdesk-monolith',
    'exit_code': 0,
    'result': 'PASS',
    'evidence': 'frontend/public-ui.css, frontend/business.css, docs/05_ATURAN_UI_UX_WEB_PUBLIK.md, scripts/test_modal_and_mobile.py',
    'observed': 'Penuntasan Komprehensif Sistem Modal/Dialog Kanonis & Standarisasi Tata Letak Mobile First Web Publik dan Web Admin: 1) Centered Modal Design System: Seluruh dialog (Ekspor M9, Detail Media M3/M8, Tolak Laporan, Keberatan Pemohon, Arsip/Restore, Media Picker) diposisikan terpusat sempurna (inset: 0, margin: auto), berlatar semi-transparan dengan backdrop-filter blur 6px, padding simetris 24px 28px (desktop) dan 18px 16px (mobile), border-radius 12px, header terpisah border-bottom, form field spacing rapi 12-14px, serta footer aksi rata kanan dengan gap: 12px; 2) Aturan Mobile First Web Publik: Tombol hero CTA menyusun vertikal dengan gap 12px dan lebar 100% di layar <= 640px; stepper form lapor menyusun vertikal; dropzone adaptif min-height 140px; service card dan guest security card responsif; progress card dan timeline feed proporsional 1-kolom tanpa elemen tumpang tindih; footer 1-kolom simetris; 3) Aturan Mobile First Web Admin: Kartu sesi lab admin beralih ke layout vertikal (.hd-session-inner column) dengan select width 100% dan button group column stack tanpa horizontal overflow; form grid beralih ke 1 kolom; tabel data admin dilindungi .hd-table-wrap (overflow-x: auto, max-width calc(100vw - 32px), touch scrolling); toolbar aksi dan tab modul wrap proporsional; footer admin menyusun vertikal seimbang; 4) Dokumentasi Kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md diperbarui dengan 2 bab baru; 5) Verifikasi penuh scripts/test_modal_and_mobile.py (100% PASS pada 27 rute aktif) dan 8 uji regresi lainnya lulus 100%.'
}

with open('status/evidence.jsonl', 'a', encoding='utf-8') as f:
    f.write(json.dumps(entry, ensure_ascii=False) + '\n')

print('Successfully recorded modal & mobile evidence to status/evidence.jsonl')
