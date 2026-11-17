#!/usr/bin/env python3
"""
Record Evidence for Admin Spacing, Margin, Padding & Anti-Collision System
"""

import json
from datetime import datetime, timezone

entry = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'agent': 'Antigravity',
    'task_id': 'ADMIN_SPACING_MARGIN_PADDING_AND_ANTI_COLLISION',
    'scope': 'application',
    'command': 'python scripts/patch_admin_spacing.py; npm run build; docker compose build web; docker compose up -d web; python scripts/test_admin_spacing.py',
    'working_directory': r'C:\Datas\Proyek\Aplikasi\helpdesk-monolith',
    'exit_code': 0,
    'result': 'PASS',
    'evidence': 'frontend/business-pages.mjs, frontend/business.css, frontend/build-templates.mjs, docs/05_ATURAN_UI_UX_WEB_PUBLIK.md, scripts/test_admin_spacing.py',
    'observed': 'Penataan Proporsional Margin, Padding, Gap & Anti-Tumpang-Tindih Komponen Web Admin (PIUI Zero & Helpdesk Master): 1) Resolusi Tuntas Tata Letak Kartu Sesi Lab (.hd-session): Mengelompokkan elemen menjadi 2 grup terstruktur (.hd-session-inner) yaitu identitas petugas (.hd-session-identity) dan formulir aktivasi peran cepat (.hd-admin-quick-form); 2) Eliminasi Paksaan Lebar Penuh Dropdown: Aturan form[data-hd-login] select dipersempit menjadi :not([data-hd-quick-login]) sehingga dropdown peran (.hd-quick-select-group) memiliki lebar adaptif 240px-360px dan tidak lagi memotong baris tombol; 3) Tombol Aksi Peran Anti-Menempel (.hd-quick-btn-group): Tombol Aktifkan Sesi, Antrean Tiket Petugas, dan Keluar dibungkus dalam container flex dengan gap: 10px teratur (zero touching borders); 4) Standardisasi Sistem Spacing Admin: Kartu admin (.piui-card) diberi padding 24px 28px dan margin-bottom 24px; toolbar aksi (.hd-actions) gap 12px; tombol (.piui-btn) min-height 38px dan padding 8px 16px; tab navigasi modul (M9, M11, Media) gap 10px; form grid gap 18-24px dan field margin 16px; tabel data padding 12px 16px; serta status box pesan admin diberi background elevasi dan margin bernapas; 5) Dokumentasi Kanonis docs/05_ATURAN_UI_UX_WEB_PUBLIK.md diperbarui dengan subseksi Standar Spacing Web Admin; 6) Seluruh pengujian scripts/test_admin_spacing.py (100% PASS) dan regresi (test_admin_media_and_modules.py, test_spacing_and_hero.py, test_public_buttons.py, test_ticket_timeline.py 50/50, test_piui_build.py, test_m0_13_links.py) lulus 100% tanpa celah.'
}

with open('status/evidence.jsonl', 'a', encoding='utf-8') as f:
    f.write(json.dumps(entry, ensure_ascii=False) + '\n')

print('Successfully recorded evidence to status/evidence.jsonl')
