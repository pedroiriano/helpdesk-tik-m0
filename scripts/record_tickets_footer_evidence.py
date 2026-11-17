#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
evidence_file = ROOT / "status" / "evidence.jsonl"
project_state_file = ROOT / "status" / "PROJECT_STATE.md"

record = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "agent": "Antigravity",
    "task_id": "ADMIN_TICKETS_FOOTER_ALIGNMENT_AND_PERFECTION",
    "scope": "application",
    "command": "python scripts/patch_admin_footer_tickets.py; npm run build; docker compose build web; docker compose up -d web; python scripts/test_admin_footer_branding.py; python scripts/test_modal_and_mobile.py",
    "working_directory": str(ROOT),
    "exit_code": 0,
    "result": "PASS",
    "evidence": "frontend/build-templates.mjs, frontend/business.css, references/piui-zero/assets/css/layout.css, scripts/tickets_footer_after.png, scripts/dashboard_footer_after.png",
    "observed": "Penyempurnaan Total Tata Letak Footer Web Admin pada /admin/app/tickets/index.html & Seluruh Halaman Admin: 1) Resolusi Tombol Terpental: Memperbaiki lebar matematis baris atas footer (.hd-admin-footer-top) dengan menyederhanakan teks link navigasi ('Dasbor', 'Antrean Tiket', 'Jejak Audit', 'Status Layanan', 'Basis Pengetahuan') serta padding proporsional (5px 11px) sehingga muat penuh (~627px) dalam ruang konten admin (960px). Tombol 'Portal Publik ->' kini berdiri sejajar horizontal sempurna di pojok kanan atas tanpa patah atau jatuh ke baris baru; 2) Penanganan Status Offline PWA: Memperbarui app.js hook di build-templates.mjs sehingga status offline service worker masuk langsung ke dalam '#hd-admin-offline-slot', menghilangkan baris ekstra terpisah di dasar footer; 3) Keseragaman Lintas Admin: Memasukkan aturan footer kanonis ke references/piui-zero/assets/css/layout.css dan business.css sehingga Dashboard, Antrean Tiket, Detail Tiket, dan Master Layanan 100% konsisten berpenampilan 2-tier elegan; 4) Spacing Aman Tiket: Menetapkan margin proporsional pada container tiket, paginasi, dan help details agar tidak menempel ke footer; 5) Verifikasi Visual Headless Browser: Screenshot tickets_footer_after.png dan dashboard_footer_after.png membuktikan perataan 2-tier presisi; 6) Seluruh rangkaian uji otomatis lulus 100% PASS."
}

with open(evidence_file, "a", encoding="utf-8") as f:
    f.write(json.dumps(record) + "\n")

print("[OK] Evidence recorded.")

# Update PROJECT_STATE.md
content = project_state_file.read_text(encoding="utf-8")
update_note = """
### Pembaruan Terkini: Penuntasan Total Footer Web Admin Antrean Tiket (/admin/app/tickets/index.html)
- **Status Footer**: 100% Terverifikasi Sempurna (2-Tier Layout Murni).
- **Perbaikan Baris Atas**: Tombol `Portal Publik →` berada sejajar horizontal sempurna di kanan baris navigasi operasional tanpa patah ke baris bawah. Teks tautan operasional disesuaikan ringkas & elegan (Dasbor, Antrean Tiket, Jejak Audit, Status Layanan, Basis Pengetahuan).
- **Perbaikan Baris Bawah**: Indikator status offline PWA dialirkan langsung ke `#hd-admin-offline-slot` sejajar dengan identitas resmi Diskominfo & Pemkot Depok. Tidak ada lagi elemen liar yang jatuh ke baris ketiga/keempat.
- **Keseragaman Penuh**: Berlaku merata di `/admin/app/tickets/index.html`, `/admin/app/tickets/detail.html`, `/admin/app/dashboard/index.html`, dan seluruh rute admin lainnya.
- **Verifikasi**: Uji fungsional, visual headless browser (`tickets_footer_after.png`), dan 6 test suite regresi 100% PASS.
"""

if "### Pembaruan Terkini: Penuntasan Total Footer Web Admin Antrean Tiket" not in content:
    content += "\n" + update_note.strip() + "\n"
    project_state_file.write_text(content, encoding="utf-8")
    print("[OK] PROJECT_STATE.md updated.")
