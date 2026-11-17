"""
scripts/patch_public_buttons.py
Penyeragaman Tombol Aksi Web Publik (Canonical Action Buttons & Affordance)
"""
import re
import sys

def patch_ticket_pages():
    path = "frontend/ticket-pages.mjs"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Nav bar
    old_nav = "const nav='<nav class=\"hd-actions\" aria-label=\"Navigasi tiket\"><a class=\"btn\" href=\"/layanan.html\">Katalog layanan</a><a class=\"btn\" href=\"/tiket.html\">Daftar tiket</a><a class=\"btn\" href=\"/lacak.html\">Lacak tiket tamu</a><a class=\"btn\" href=\"/akses.html\">Masuk SSO ASN</a></nav>';"
    new_nav = "const nav='<nav class=\"hd-actions hd-ticket-nav\" aria-label=\"Navigasi tiket\"><a class=\"btn hd-btn-nav\" href=\"/layanan.html\"><span class=\"hd-btn-icon\">📋</span> Katalog Layanan</a><a class=\"btn hd-btn-nav\" href=\"/tiket.html\"><span class=\"hd-btn-icon\">📑</span> Daftar Tiket</a><a class=\"btn hd-btn-nav\" href=\"/lacak.html\"><span class=\"hd-btn-icon\">🔍</span> Lacak Tiket Tamu</a><a class=\"btn hd-btn-nav\" href=\"/akses.html\"><span class=\"hd-btn-icon\">🔐</span> Masuk SSO ASN</a></nav>';"
    if old_nav in content:
        content = content.replace(old_nav, new_nav)
        print("Patched nav in ticket-pages.mjs")
    else:
        print("Warning: old_nav not found in ticket-pages.mjs")

    # 2. Pager
    old_pager = "const pager=name=>`<nav class=\"hd-actions\" aria-label=\"Halaman ${name}\"><button class=\"btn\" data-ticket-prev=\"${name}\" disabled>Sebelumnya</button><button class=\"btn\" data-ticket-next=\"${name}\" disabled>Berikutnya</button></nav>`;"
    new_pager = "const pager=name=>`<nav class=\"hd-actions hd-pager-nav\" aria-label=\"Halaman ${name}\"><button class=\"btn hd-btn-pager\" data-ticket-prev=\"${name}\" disabled><span aria-hidden=\"true\">←</span> Sebelumnya</button><button class=\"btn hd-btn-pager\" data-ticket-next=\"${name}\" disabled>Berikutnya <span aria-hidden=\"true\">→</span></button></nav>`;"
    if old_pager in content:
        content = content.replace(old_pager, new_pager)
        print("Patched pager in ticket-pages.mjs")
    else:
        print("Warning: old_pager not found in ticket-pages.mjs")

    # 3. Media Modal buttons
    content = content.replace(
        '<button type="button" class="btn" data-close-media-modal aria-label="Tutup dialog pustaka media">✕</button>',
        '<button type="button" class="btn btn-secondary hd-btn-close" data-close-media-modal aria-label="Tutup dialog pustaka media">✕</button>'
    )
    content = content.replace(
        '<button type="button" class="btn" data-media-tab="M3" aria-selected="true">Media Tiket (M3)</button><button type="button" class="btn" data-media-tab="M8" aria-selected="false">Pustaka Editorial (M8)</button>',
        '<button type="button" class="btn btn-secondary" data-media-tab="M3" aria-selected="true"><span class="hd-btn-icon">📁</span> Media Tiket (M3)</button><button type="button" class="btn btn-secondary" data-media-tab="M8" aria-selected="false"><span class="hd-btn-icon">📚</span> Pustaka Editorial (M8)</button>'
    )
    content = content.replace(
        '<button type="button" class="btn" data-media-cancel>Batal</button><button type="button" class="btn" data-media-confirm disabled style="background:#0d6efd;color:#fff;">Gunakan Media Ini</button>',
        '<button type="button" class="btn btn-secondary" data-media-cancel>Batal</button><button type="button" class="btn btn-primary" data-media-confirm disabled><span class="hd-btn-icon">✓</span> Gunakan Media Ini</button>'
    )

    # 4. kind === 'create'
    content = content.replace(
        '<button class="btn" data-draft-restore type="button">Pulihkan Draft</button><button class="btn" data-draft-discard type="button">Buang Draft</button>',
        '<button class="btn btn-primary" data-draft-restore type="button"><span class="hd-btn-icon">📋</span> Pulihkan Draft</button><button class="btn btn-secondary" data-draft-discard type="button"><span class="hd-btn-icon">🗑️</span> Buang Draft</button>'
    )
    content = content.replace(
        '<button class="btn" data-draft-reload-server type="button">Muat Versi Server</button><button class="btn" data-draft-overwrite type="button">Gunakan Versi Ini (Timpa)</button>',
        '<button class="btn btn-primary" data-draft-reload-server type="button"><span class="hd-btn-icon">🔄</span> Muat Versi Server</button><button class="btn btn-secondary" data-draft-overwrite type="button"><span class="hd-btn-icon">⚠️</span> Gunakan Versi Ini (Timpa)</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#0366d6;color:#ffffff;font-weight:600;padding:12px 28px;border-radius:8px;font-size:14.5px;box-shadow:0 3px 12px rgba(3,102,214,0.35);">🚀 Kirim Laporan Sekarang</button>',
        '<button class="btn btn-primary" type="submit" style="font-weight:600;padding:12px 28px;border-radius:8px;font-size:14.5px;"><span class="hd-btn-icon">🚀</span> Kirim Laporan Sekarang</button>'
    )

    # 5. kind === 'list'
    old_filters = '<div class="hd-actions" data-queue-filters hidden style="margin-bottom:12px;gap:8px;flex-wrap:wrap;"><button class="btn" data-queue-filter="all">Semua Tiket</button><button class="btn" data-queue-filter="verification">Antrean Verifikasi (Operator)</button><button class="btn" data-queue-filter="dispatch">Antrean Disposisi (Pimpinan / Koordinator)</button><button class="btn" data-queue-filter="my-tasks">Tugas Saya (Teknisi)</button></div>'
    new_filters = '<div class="hd-actions hd-queue-filters" data-queue-filters hidden style="margin-bottom:14px;gap:8px;flex-wrap:wrap;"><button class="btn hd-btn-filter is-active" data-queue-filter="all"><span class="hd-btn-icon">📁</span> Semua Tiket</button><button class="btn hd-btn-filter" data-queue-filter="verification"><span class="hd-btn-icon">🔍</span> Antrean Verifikasi (Operator)</button><button class="btn hd-btn-filter" data-queue-filter="dispatch"><span class="hd-btn-icon">👷</span> Antrean Disposisi (Pimpinan / Koordinator)</button><button class="btn hd-btn-filter" data-queue-filter="my-tasks"><span class="hd-btn-icon">🛠️</span> Tugas Saya (Teknisi)</button></div>'
    if old_filters in content:
        content = content.replace(old_filters, new_filters)
        print("Patched filters in ticket-pages.mjs")

    # 6. kind === 'track'
    old_track_btn = '<button class="btn" type="submit">Buka pelacakan</button>'
    new_track_btn = '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">🔍</span> Buka Pelacakan Tiket</button>'
    if old_track_btn in content:
        content = content.replace(old_track_btn, new_track_btn)
        print("Patched track button in ticket-pages.mjs")

    # 7. kind === 'ticket'
    old_detail_act = '<div class="hd-actions"><button class="btn" data-ticket-refresh>Muat ulang tiket</button><button class="btn" data-tracking-logout hidden>Keluar dari pelacakan</button><button class="btn" data-tracking-revoke hidden>Cabut kunci pelacakan</button></div>'
    new_detail_act = '<div class="hd-actions hd-detail-actions"><button class="btn btn-secondary hd-btn-refresh" data-ticket-refresh><span class="hd-btn-icon">🔄</span> Muat Ulang Tiket</button><button class="btn btn-secondary" data-tracking-logout hidden><span class="hd-btn-icon">🚪</span> Keluar dari Pelacakan</button><button class="btn btn-danger" data-tracking-revoke hidden><span class="hd-btn-icon">🚫</span> Cabut Kunci Pelacakan</button></div>'
    if old_detail_act in content:
        content = content.replace(old_detail_act, new_detail_act)
        print("Patched detail actions in ticket-pages.mjs")

    content = content.replace(
        '<button class="btn" data-conflict-reload type="button">Muat Ulang Tiket</button>',
        '<button class="btn btn-secondary" data-conflict-reload type="button"><span class="hd-btn-icon">🔄</span> Muat Ulang Tiket</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#0d6efd;color:#fff;">Sahkan Verifikasi</button><button class="btn" type="button" data-btn-reject aria-haspopup="dialog" style="background:#dc3545;color:#fff;">Tolak Laporan</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">✓</span> Sahkan Verifikasi</button><button class="btn btn-danger" type="button" data-btn-reject aria-haspopup="dialog"><span class="hd-btn-icon">✕</span> Tolak Laporan</button>'
    )
    content = content.replace(
        '<button type="submit" class="btn" style="background:#dc3545;color:#fff;">Konfirmasi Tolak Laporan</button><button type="button" class="btn" data-close-reject-dialog>Batal</button>',
        '<button type="submit" class="btn btn-danger"><span class="hd-btn-icon">✕</span> Konfirmasi Tolak Laporan</button><button type="button" class="btn btn-secondary" data-close-reject-dialog>Batal</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#198754;color:#fff;">Tugaskan Teknisi</button>',
        '<button class="btn btn-success" type="submit"><span class="hd-btn-icon">👷</span> Tugaskan Teknisi</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#0d6efd;color:#fff;">Selesaikan Tiket</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">✅</span> Selesaikan Tiket</button>'
    )
    content = content.replace(
        '<button class="btn" type="button" data-btn-confirm-accept style="background:#198754;color:#fff;">Setuju / Selesai</button><button class="btn" type="button" data-btn-confirm-reject aria-haspopup="dialog" style="background:#dc3545;color:#fff;">Belum Selesai / Ajukan Keberatan</button>',
        '<button class="btn btn-success" type="button" data-btn-confirm-accept><span class="hd-btn-icon">👍</span> Setuju / Selesai</button><button class="btn btn-danger" type="button" data-btn-confirm-reject aria-haspopup="dialog"><span class="hd-btn-icon">⚠️</span> Belum Selesai / Ajukan Keberatan</button>'
    )
    content = content.replace(
        '<button type="submit" class="btn" style="background:#dc3545;color:#fff;">Kirim Keberatan</button><button type="button" class="btn" data-close-confirm-reject-dialog>Batal</button>',
        '<button type="submit" class="btn btn-danger"><span class="hd-btn-icon">⚠️</span> Kirim Keberatan</button><button type="button" class="btn btn-secondary" data-close-confirm-reject-dialog>Batal</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit">Catat Kasus Vendor</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">🏢</span> Catat Kasus Vendor</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#ffc107;color:#000;">Setujui Jeda Layanan</button>',
        '<button class="btn btn-warning" type="submit"><span class="hd-btn-icon">⏸️</span> Setujui Jeda Layanan</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#6f42c1;color:#fff;">Ajukan Handoff OPD</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">🔄</span> Ajukan Handoff OPD</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#2e7d32;color:#fff;">Terima Handoff OPD</button>',
        '<button class="btn btn-success" type="submit"><span class="hd-btn-icon">📥</span> Terima Handoff OPD</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit" style="background:#fd7e14;color:#fff;">Eskalasi Tiket</button>',
        '<button class="btn btn-warning" type="submit"><span class="hd-btn-icon">⚡</span> Eskalasi Tiket</button>'
    )
    content = content.replace(
        '<button type="button" class="btn" data-btn-archive aria-haspopup="dialog" style="background:#6c757d;color:#fff;">Arsipkan Tiket</button><button type="button" class="btn" data-btn-restore-archive aria-haspopup="dialog" style="background:#198754;color:#fff;" hidden>Pulihkan dari Arsip</button>',
        '<button type="button" class="btn btn-secondary" data-btn-archive aria-haspopup="dialog"><span class="hd-btn-icon">📦</span> Arsipkan Tiket</button><button type="button" class="btn btn-success" data-btn-restore-archive aria-haspopup="dialog" hidden><span class="hd-btn-icon">♻️</span> Pulihkan dari Arsip</button>'
    )
    content = content.replace(
        '<button type="submit" class="btn" style="background:#dc3545;color:#fff;">Konfirmasi Arsip</button><button type="button" class="btn" data-close-archive-dialog>Batal</button>',
        '<button type="submit" class="btn btn-danger"><span class="hd-btn-icon">📦</span> Konfirmasi Arsip</button><button type="button" class="btn btn-secondary" data-close-archive-dialog>Batal</button>'
    )
    content = content.replace(
        '<button type="submit" class="btn" style="background:#198754;color:#fff;">Konfirmasi Pemulihan</button><button type="button" class="btn" data-close-restore-dialog>Batal</button>',
        '<button type="submit" class="btn btn-success"><span class="hd-btn-icon">♻️</span> Konfirmasi Pemulihan</button><button type="button" class="btn btn-secondary" data-close-restore-dialog>Batal</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit">Kirim komentar</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">💬</span> Kirim Komentar</button>'
    )
    content = content.replace(
        '<button class="btn" data-open-media-picker type="button" aria-haspopup="dialog">Buka Pustaka Media</button>',
        '<button class="btn btn-secondary" data-open-media-picker type="button" aria-haspopup="dialog"><span class="hd-btn-icon">🖼️</span> Buka Pustaka Media</button>'
    )
    content = content.replace(
        '<button class="btn" type="submit">Unggah lampiran</button>',
        '<button class="btn btn-primary" type="submit"><span class="hd-btn-icon">📤</span> Unggah Lampiran</button>'
    )

    # 8. Admin transform regex in line 13 & 14
    content = content.replace(
        "body.replaceAll('class=\"btn\"','class=\"piui-btn piui-btn--secondary\"')",
        "body.replace(/class=\"btn(\\s+[^\"]+)?\"/g,'class=\"piui-btn piui-btn--secondary$1\"')"
    )
    content = content.replace(
        "nav.replaceAll('class=\"btn\"','class=\"piui-btn piui-btn--secondary\"')",
        "nav.replace(/class=\"btn(\\s+[^\"]+)?\"/g,'class=\"piui-btn piui-btn--secondary$1\"')"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated frontend/ticket-pages.mjs successfully.")


def patch_business_pages():
    path = "frontend/business-pages.mjs"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. session
    old_session = "const session = '<div class=\"hd-session\" aria-label=\"Sesi pengguna\"><p data-hd-session role=\"status\">Memeriksa sesi…</p><div class=\"hd-actions\"><a class=\"btn\" href=\"/akses.html\">Masuk akun lab</a><a class=\"btn\" href=\"/layanan.html\">Katalog layanan</a><a class=\"btn\" href=\"/tiket.html\">Tiket saya</a><a class=\"btn\" href=\"/lacak.html\">Lacak tiket tamu</a><a class=\"btn\" href=\"/admin/app/helpdesk/index.html\">Master admin</a><button class=\"btn\" data-hd-logout type=\"button\" hidden>Keluar</button></div></div>';"
    new_session = "const session = '<div class=\"hd-session\" aria-label=\"Sesi pengguna\"><p data-hd-session role=\"status\">Memeriksa sesi…</p><div class=\"hd-actions hd-ticket-nav\"><a class=\"btn hd-btn-nav\" href=\"/akses.html\"><span class=\"hd-btn-icon\">🔐</span> Masuk Akun Lab</a><a class=\"btn hd-btn-nav\" href=\"/layanan.html\"><span class=\"hd-btn-icon\">📋</span> Katalog Layanan</a><a class=\"btn hd-btn-nav\" href=\"/tiket.html\"><span class=\"hd-btn-icon\">📑</span> Tiket Saya</a><a class=\"btn hd-btn-nav\" href=\"/lacak.html\"><span class=\"hd-btn-icon\">🔍</span> Lacak Tiket Tamu</a><a class=\"btn hd-btn-nav\" href=\"/admin/app/helpdesk/index.html\"><span class=\"hd-btn-icon\">⚙️</span> Master Admin</a><button class=\"btn btn-danger\" data-hd-logout type=\"button\" hidden><span class=\"hd-btn-icon\">🚪</span> Keluar</button></div></div>';"
    if old_session in content:
        content = content.replace(old_session, new_session)
        print("Patched session in business-pages.mjs")

    # 2. catalog pager
    old_cat_pager = '<nav class="hd-actions" aria-label="Halaman katalog"><button class="btn" data-hd-prev disabled>Halaman sebelumnya</button><button class="btn" data-hd-next disabled>Halaman berikutnya</button></nav>'
    new_cat_pager = '<nav class="hd-actions hd-pager-nav" aria-label="Halaman katalog"><button class="btn hd-btn-pager" data-hd-prev disabled><span aria-hidden="true">←</span> Halaman Sebelumnya</button><button class="btn hd-btn-pager" data-hd-next disabled>Halaman Berikutnya <span aria-hidden="true">→</span></button></nav>'
    if old_cat_pager in content:
        content = content.replace(old_cat_pager, new_cat_pager)
        print("Patched catalog pager in business-pages.mjs")

    # 3. registerForm
    content = content.replace(
        '<button class="btn btn--lime" type="submit" style="flex:1;">Daftar Akun Baru &rarr;</button>\n      <a class="btn" href="/akses.html">Sudah Punya Akun? Masuk</a>',
        '<button class="btn btn-primary" type="submit" style="flex:1;"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru &rarr;</button>\n      <a class="btn btn-secondary" href="/akses.html"><span class="hd-btn-icon">🔐</span> Sudah Punya Akun? Masuk</a>'
    )

    # 4. loginForm
    content = content.replace(
        '<button class="btn btn--lime" type="submit" style="flex:1;">Masuk sebagai Warga &rarr;</button>\n        <a class="btn" href="/daftar.html">Daftar Akun Baru</a>',
        '<button class="btn btn-primary" type="submit" style="flex:1;"><span class="hd-btn-icon">🔓</span> Masuk sebagai Warga &rarr;</button>\n        <a class="btn btn-secondary" href="/daftar.html"><span class="hd-btn-icon">✍️</span> Daftar Akun Baru</a>'
    )
    content = content.replace(
        '<button class="btn btn--lime" type="submit" style="width:100%;">Masuk dengan SSO ASN Depok &rarr;</button>',
        '<button class="btn btn-primary" type="submit" style="width:100%;"><span class="hd-btn-icon">🏛️</span> Masuk dengan SSO ASN Depok &rarr;</button>'
    )
    content = content.replace(
        '<button type="button" class="btn" data-quick-login="warga" style="font-size:13px;padding:6px 12px;flex:1;">\n          👤 Warga Mandiri (Publik A)\n        </button>\n        <button type="button" class="btn" data-quick-login="asn" style="font-size:13px;padding:6px 12px;flex:1;">\n          🏛️ ASN Pemohon (Bappeda)\n        </button>',
        '<button type="button" class="btn btn-secondary" data-quick-login="warga" style="font-size:13px;padding:6px 12px;flex:1;"><span class="hd-btn-icon">👤</span> Warga Mandiri (Publik A)</button>\n        <button type="button" class="btn btn-secondary" data-quick-login="asn" style="font-size:13px;padding:6px 12px;flex:1;"><span class="hd-btn-icon">🏛️</span> ASN Pemohon (Bappeda)</button>'
    )

    # 5. faqSection
    content = content.replace(
        '<a class="btn" href="/layanan.html">Buka Katalog Layanan &rarr;</a>\n      <a class="btn" href="/panduan.html">Lihat Panduan Lengkap</a>',
        '<a class="btn btn-primary" href="/layanan.html"><span class="hd-btn-icon">📋</span> Buka Katalog Layanan &rarr;</a>\n      <a class="btn btn-secondary" href="/panduan.html"><span class="hd-btn-icon">📖</span> Lihat Panduan Lengkap</a>'
    )

    # 6. knowledgeSection
    content = content.replace(
        '<a class="btn" href="/panduan.html">Baca Selengkapnya &rarr;</a>',
        '<a class="btn btn-secondary" href="/panduan.html"><span class="hd-btn-icon">📖</span> Baca Selengkapnya &rarr;</a>'
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated frontend/business-pages.mjs successfully.")


def patch_features():
    # m0-04.ts
    path04 = "frontend/src/features/m0-04.ts"
    with open(path04, "r", encoding="utf-8") as f:
        c04 = f.read()

    # ticketLink
    old_tl = "const a = el('a', text, 'btn') as HTMLAnchorElement;"
    new_tl = "const a = el('a', '', 'btn btn-secondary hd-btn-detail') as HTMLAnchorElement;\n  a.innerHTML = `<span class=\"hd-btn-icon\">👁️</span> ${text}`;"
    if old_tl in c04:
        c04 = c04.replace(old_tl, new_tl)
        print("Patched ticketLink in m0-04.ts")

    # guest logout
    old_guest_logout = "const btn = el('button', 'Keluar akun untuk pelacakan tamu', 'btn') as HTMLButtonElement;"
    new_guest_logout = "const btn = el('button', '', 'btn btn-secondary') as HTMLButtonElement;\n    btn.innerHTML = '<span class=\"hd-btn-icon\">🚪</span> Keluar akun untuk pelacakan tamu';"
    if old_guest_logout in c04:
        c04 = c04.replace(old_guest_logout, new_guest_logout)
        print("Patched guest logout in m0-04.ts")

    with open(path04, "w", encoding="utf-8") as f:
        f.write(c04)

    # m0-03.ts
    path03 = "frontend/src/features/m0-03.ts"
    with open(path03, "r", encoding="utf-8") as f:
        c03 = f.read()

    # catalog cards
    old_lapor = "const btnLapor = element('a', 'Ajukan Laporan →', 'btn');\n        btnLapor.href = '/lapor.html?id=' + encodeURIComponent(service.id);\n        btnLapor.style.cssText = 'background:#0366d6;color:#fff;font-weight:600;padding:8px 14px;font-size:13px;border-radius:6px;text-decoration:none;';"
    new_lapor = "const btnLapor = element('a', '', 'btn btn-primary');\n        btnLapor.innerHTML = '<span class=\"hd-btn-icon\">🚀</span> Ajukan Laporan →';\n        btnLapor.href = '/lapor.html?id=' + encodeURIComponent(service.id);"
    if old_lapor in c03:
        c03 = c03.replace(old_lapor, new_lapor)
        print("Patched btnLapor in m0-03.ts")

    old_detail = "const btnDetail = element('a', 'Detail Layanan', 'btn');\n        btnDetail.href = '/detail-layanan.html?id=' + encodeURIComponent(service.id);\n        btnDetail.style.cssText = 'background:#f6f8fa;border:1px solid #d0d7de;color:#24292f;padding:8px 14px;font-size:13px;border-radius:6px;text-decoration:none;';"
    new_detail = "const btnDetail = element('a', '', 'btn btn-secondary');\n        btnDetail.innerHTML = '<span class=\"hd-btn-icon\">ℹ️</span> Detail Layanan';\n        btnDetail.href = '/detail-layanan.html?id=' + encodeURIComponent(service.id);"
    if old_detail in c03:
        c03 = c03.replace(old_detail, new_detail)
        print("Patched btnDetail in m0-03.ts")

    # detail page top & bottom buttons
    old_top = "const btnCreateTop = element('a', 'Ajukan Permohonan / Buat Tiket Sekarang →', 'btn');\n  btnCreateTop.href = '/lapor.html?id=' + encodeURIComponent(id);\n  btnCreateTop.style.cssText = 'background:#0366d6;color:#fff;font-weight:600;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;';"
    new_top = "const btnCreateTop = element('a', '', 'btn btn-primary');\n  btnCreateTop.innerHTML = '<span class=\"hd-btn-icon\">🚀</span> Ajukan Permohonan / Buat Tiket Sekarang →';\n  btnCreateTop.href = '/lapor.html?id=' + encodeURIComponent(id);"
    if old_top in c03:
        c03 = c03.replace(old_top, new_top)
        print("Patched btnCreateTop in m0-03.ts")

    old_bottom = "const btnCreateBottom = element('a', 'Lanjutkan Mengisi Formulir Tiket →', 'btn');\n  btnCreateBottom.href = '/lapor.html?id=' + encodeURIComponent(id);\n  btnCreateBottom.style.cssText = 'background:#0366d6;color:#fff;font-weight:600;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block;margin-top:16px;';"
    new_bottom = "const btnCreateBottom = element('a', '', 'btn btn-primary');\n  btnCreateBottom.innerHTML = '<span class=\"hd-btn-icon\">🚀</span> Lanjutkan Mengisi Formulir Tiket →';\n  btnCreateBottom.href = '/lapor.html?id=' + encodeURIComponent(id);"
    if old_bottom in c03:
        c03 = c03.replace(old_bottom, new_bottom)
        print("Patched btnCreateBottom in m0-03.ts")

    with open(path03, "w", encoding="utf-8") as f:
        f.write(c03)
    print("Updated features successfully.")


def patch_business_css():
    path = "frontend/business.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Ensure base .btn rule is present in business.css
    if "/* Base button reset for PIUI/Helpdesk */" not in content:
        base_btn_css = """
/* Base button reset for PIUI/Helpdesk */
.btn,
button.btn,
a.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 9px 18px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.4;
  text-transform: none !important;
  letter-spacing: 0.01em;
  text-decoration: none !important;
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #f0f6fc !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.btn:hover,
button.btn:hover,
a.btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.35);
  color: #ffffff !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.btn:active,
button.btn:active,
a.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.btn:disabled,
button.btn:disabled,
.btn[disabled] {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
  box-shadow: none !important;
  transform: none !important;
}

.btn-primary,
.hd-btn-primary {
  background: linear-gradient(135deg, #1f6feb 0%, #0d419d 100%) !important;
  border: 1px solid #388bfd !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px rgba(31, 111, 235, 0.35) !important;
}

.btn-primary:hover,
.hd-btn-primary:hover {
  background: linear-gradient(135deg, #388bfd 0%, #1f6feb 100%) !important;
  border-color: #58a6ff !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(56, 139, 253, 0.5) !important;
}

.btn-secondary,
.hd-btn-secondary {
  background: rgba(33, 38, 45, 0.85) !important;
  border: 1px solid rgba(240, 246, 252, 0.22) !important;
  color: #e6edf3 !important;
}

.btn-secondary:hover,
.hd-btn-secondary:hover {
  background: rgba(48, 54, 61, 0.95) !important;
  border-color: rgba(240, 246, 252, 0.45) !important;
  color: #ffffff !important;
}

.btn-success,
.hd-btn-success {
  background: linear-gradient(135deg, #238636 0%, #196127 100%) !important;
  border: 1px solid #2ea043 !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px rgba(35, 134, 54, 0.35) !important;
}

.btn-success:hover,
.hd-btn-success:hover {
  background: linear-gradient(135deg, #2ea043 0%, #238636 100%) !important;
  border-color: #3fb950 !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(46, 160, 67, 0.5) !important;
}

.btn-danger,
.hd-btn-danger {
  background: linear-gradient(135deg, #da3633 0%, #a40e26 100%) !important;
  border: 1px solid #f85149 !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px rgba(218, 54, 51, 0.35) !important;
}

.btn-danger:hover,
.hd-btn-danger:hover {
  background: linear-gradient(135deg, #f85149 0%, #da3633 100%) !important;
  border-color: #ff7b72 !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(248, 81, 73, 0.5) !important;
}

.btn-warning,
.hd-btn-warning {
  background: linear-gradient(135deg, #d29922 0%, #9e6a03 100%) !important;
  border: 1px solid #e3b341 !important;
  color: #ffffff !important;
}

.btn-warning:hover,
.hd-btn-warning:hover {
  background: linear-gradient(135deg, #e3b341 0%, #d29922 100%) !important;
  border-color: #f2cc60 !important;
  color: #ffffff !important;
}
"""
        content += base_btn_css
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated frontend/business.css with base .btn rules.")

if __name__ == "__main__":
    patch_ticket_pages()
    patch_business_pages()
    patch_features()
    patch_business_css()
    print("All patches completed successfully!")
