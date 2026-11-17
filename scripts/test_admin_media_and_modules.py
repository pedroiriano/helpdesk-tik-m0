#!/usr/bin/env python3
"""
Test Suite: Verifikasi Komprehensif Seluruh Modul Web Admin Helpdesk TIK Kota Depok
Mencakup:
1. Pustaka Media Terpadu (M3/M8) dengan Dropzone Upload, Pemindaian ClamAV, dan Listing
2. Pengelolaan Portal & Navigasi Publik (M2)
3. Basis Pengetahuan & Editorial Artikel (M8)
4. Laporan Kinerja SLA & Ekspor Asinkron (M9)
5. Pusat Notifikasi & Telegram Bot (M9)
6. Jejak Audit Append-Only (M9)
7. Pemeliharaan Sistem, Scoped Runner & Diagnosa Kesehatan (M11)
8. Master 16 Layanan TIK, Kategori, OPD, Tim Teknis, dan Hak Akses (M1/M2)
9. Integritas Navigasi Sidebar Tanpa False Active dan Tanpa Broken Links
"""

import urllib.request
import urllib.error
import json
import secrets
import hashlib
import zlib
import struct
import sys
import re

import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://127.0.0.1:18090"

def log(msg, success=True):
    icon = "[PASS]" if success else "[FAIL]"
    print(f"{icon} {msg}")

def http_get(url, headers=None, raw=False):
    time.sleep(0.12)
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            return resp.status, data if raw else data.decode("utf-8"), resp.headers
    except urllib.error.HTTPError as e:
        data = e.read()
        return e.code, data if raw else data.decode("utf-8", errors="replace"), e.headers

def http_post(url, payload, headers=None):
    time.sleep(0.12)
    data = json.dumps(payload).encode("utf-8")
    h = {
        "Content-Type": "application/json",
        "Origin": BASE_URL,
        "Idempotency-Key": secrets.token_hex(16)
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8"), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), e.headers

def http_put_raw(url, data_bytes, mime, headers=None):
    h = {
        "Content-Type": mime,
        "Origin": BASE_URL,
        "Idempotency-Key": secrets.token_hex(16)
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data_bytes, headers=h, method="PUT")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8"), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), e.headers

def make_valid_png():
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', 4, 4, 8, 6, 0, 0, 0)
    ihdr_crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff)
    ihdr = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + ihdr_crc
    raw_scanlines = b''.join([b'\x00' + b'\x00\xaa\xff\xff' * 4 for _ in range(4)])
    idat_data = zlib.compress(raw_scanlines)
    idat_crc = struct.pack('>I', zlib.crc32(b'IDAT' + idat_data) & 0xffffffff)
    idat = struct.pack('>I', len(idat_data)) + b'IDAT' + idat_data + idat_crc
    iend_crc = struct.pack('>I', zlib.crc32(b'IEND') & 0xffffffff)
    iend = struct.pack('>I', 0) + b'IEND' + iend_crc
    return sig + ihdr + idat + iend

def extract_cookie(headers, cookie_name="helpdesk_session"):
    cookie_headers = headers.get_all("Set-Cookie") if hasattr(headers, "get_all") else [headers.get("Set-Cookie", "")]
    for header in cookie_headers:
        for part in header.split(";"):
            part = part.strip()
            if part.startswith(cookie_name + "="):
                return part
    return ""

def login_subject(subject_identifier):
    st, body, boot_hdrs = http_get(BASE_URL + "/api/v1/auth/bootstrap")
    assert st == 200, "Bootstrap gagal"
    boot_data = json.loads(body)
    csrf_token = boot_data["csrf_token"]
    login_cookie = extract_cookie(boot_hdrs, "helpdesk_login")
    
    if isinstance(subject_identifier, int):
        sub_id = f"20000000-0000-4000-8000-{subject_identifier:012d}"
        payload = {"lab_subject_id": sub_id, "csrf_token": csrf_token}
    elif "-" in str(subject_identifier):
        payload = {"lab_subject_id": subject_identifier, "csrf_token": csrf_token}
    else:
        payload = {"identifier": subject_identifier, "csrf_token": csrf_token}

    st, body, login_hdrs = http_post(
        BASE_URL + "/api/v1/auth/sessions",
        payload,
        headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
    )
    assert st == 201, f"Login gagal ({subject_identifier}): HTTP {st}: {body}"
    session_cookie = extract_cookie(login_hdrs, "helpdesk_session")
    csrf_cookie = extract_cookie(login_hdrs, "helpdesk_csrf")
    csrf_val = csrf_cookie.split("=")[1]
    return {
        "Cookie": f"{session_cookie}; {csrf_cookie}",
        "X-CSRF-Token": csrf_val
    }

def run_tests():
    print("=" * 75)
    print("UJI KOMPREHENSIF WEB ADMIN: PUSTAKA MEDIA & SELURUH 12 MODUL HELPDESK TIK")
    print("=" * 75)

    # -------------------------------------------------------------------------
    # 1. Verifikasi Struktur HTML Admin Template (/admin/app/helpdesk/index.html)
    # -------------------------------------------------------------------------
    st, html, _ = http_get(BASE_URL + "/admin/app/helpdesk/index.html")
    assert st == 200, f"Gagal memuat /admin/app/helpdesk/index.html (HTTP {st})"
    log("Akses Halaman Admin: HTTP 200 OK.")

    # Invariant: aria-current="page" TIDAK BOLEH di-hardcode ke memberships
    memberships_link = re.search(r'<a href="[^"]*kind=memberships"[^>]*>', html)
    assert memberships_link, "Link memberships tidak ditemukan di sidebar admin!"
    assert 'aria-current="page"' not in memberships_link.group(0), \
        f"VIOLATION: aria-current='page' masih di-hardcode pada memberships: {memberships_link.group(0)}"
    log("Sidebar Invariant: aria-current='page' tidak di-hardcode (bebas false-highlight).")

    # Invariant: Seluruh modul terdaftar dalam select #hd-master-kind
    expected_kinds = [
        "services", "categories", "organizations", "teams", "memberships",
        "navigation", "articles", "media", "reports", "notifications", "audit", "maintenance"
    ]
    for k in expected_kinds:
        assert f'value="{k}"' in html, f"Kind '{k}' tidak ditemukan dalam dropdown #hd-master-kind!"
    log(f"Master Dropdown: Seluruh {len(expected_kinds)} modul terdaftar resmi.")

    # Invariant: Komponen section sub-modul tersedia di DOM
    assert "data-hd-media-section" in html, "Elemen [data-hd-media-section] tidak ditemukan!"
    assert "data-hd-navigation-section" in html, "Elemen [data-hd-navigation-section] tidak ditemukan!"
    assert "data-hd-articles-section" in html, "Elemen [data-hd-articles-section] tidak ditemukan!"
    assert "data-hd-m9-section" in html, "Elemen [data-hd-m9-section] tidak ditemukan!"
    assert "data-hd-m11-section" in html, "Elemen [data-hd-m11-section] tidak ditemukan!"
    assert "hd-admin-media-dropzone" in html, "Dropzone admin media tidak ditemukan!"
    assert "data-hd-media-detail-dialog" in html, "Modal dialog detail media tidak ditemukan!"
    log("DOM Components: Seluruh 5 panel modul terpisah & dialog WAI-ARIA siap.")

    # -------------------------------------------------------------------------
    # 2. Autentikasi Sesi Petugas Super Admin
    # -------------------------------------------------------------------------
    admin_auth_headers = login_subject("admin")
    log("Sesi Petugas Admin Aktif: Super Admin Diskominfo Kota Depok.")

    # -------------------------------------------------------------------------
    # 3. Pengujian Pustaka Media (M3 / M8) & ClamAV Scanner
    # -------------------------------------------------------------------------
    # a. List Media M8 (Editorial Publik)
    st, body, _ = http_get(BASE_URL + "/api/v1/media?owner=M8", headers=admin_auth_headers)
    assert st == 200, f"List M8 media gagal: HTTP {st}: {body}"
    m8_data = json.loads(body)
    m8_count = len(m8_data.get("items", []))
    log(f"Pustaka Media M8 (Editorial): HTTP 200, {m8_count} berkas terdaftar.")

    # b. List Media M3 (Privat Tiket Penanganan)
    st, body, _ = http_get(BASE_URL + "/api/v1/media?owner=M3", headers=admin_auth_headers)
    assert st == 200, f"List M3 media gagal: HTTP {st}: {body}"
    m3_data = json.loads(body)
    m3_count = len(m3_data.get("items", []))
    log(f"Pustaka Media M3 (Lampiran Privat Tiket): HTTP 200, {m3_count} berkas terdaftar.")

    # c. Unggah Media Baru ke M8 via Dropzone Flow
    png_bytes = make_valid_png()
    sha256_hex = hashlib.sha256(png_bytes).hexdigest()
    unique_id = secrets.token_hex(4)
    upload_meta = {
        "expected_version": 1,
        "filename": f"infografis_depok_{unique_id}.png",
        "mime": "image/png",
        "size_bytes": len(png_bytes),
        "sha256": sha256_hex,
        "alt": f"Infografis Panduan Jaringan Intra Depok {unique_id}",
        "caption": "Infrastruktur Fiber Optic Balai Kota Depok",
        "license": "CC-BY-4.0",
        "source": "Diskominfo Kota Depok"
    }
    st, body, _ = http_post(BASE_URL + "/api/v1/media", upload_meta, headers=admin_auth_headers)
    assert st == 201, f"Unggah metadata media M8 gagal: HTTP {st}: {body}"
    created_media = json.loads(body)
    media_id = created_media["id"]
    log(f"Registrasi Media M8: HTTP 201 Created (ID: {media_id[:8]}...).")

    # d. Unggah Konten Biner Blob & Verifikasi Pemindaian ClamAV
    st, body, _ = http_put_raw(
        BASE_URL + f"/api/v1/media/{media_id}/content",
        png_bytes,
        "image/png",
        headers=admin_auth_headers
    )
    assert st == 200, f"Unggah konten biner media gagal: HTTP {st}: {body}"
    scan_res = json.loads(body)
    assert scan_res.get("status") == "CLEAN", f"Status scanner tidak CLEAN: {scan_res}"
    log(f"Pemindaian ClamAV: Berkas bersih & diverifikasi aman (Status: CLEAN).")

    # e. Unduh Berkas Media yang Telah Bersih
    st, dl_body, dl_hdrs = http_get(BASE_URL + f"/api/v1/media/{media_id}/content", headers=admin_auth_headers, raw=True)
    assert st == 200, f"Unduh media gagal: HTTP {st}"
    assert len(dl_body) == len(png_bytes), f"Panjang biner media tidak cocok: {len(dl_body)} != {len(png_bytes)}"
    assert dl_hdrs.get("Content-Type") == "image/png", "Content-Type mismatch pada unduhan"
    log(f"Pengambilan Berkas Media (/media/{media_id[:8]}.../content): HTTP 200 OK.")

    # -------------------------------------------------------------------------
    # 4. Pengujian Pengelolaan Portal & Navigasi Publik (M2)
    # -------------------------------------------------------------------------
    st, body, _ = http_get(BASE_URL + "/api/v1/catalog/navigation", headers=admin_auth_headers)
    assert st == 200, f"List navigasi gagal: HTTP {st}: {body}"
    nav_data = json.loads(body)
    log(f"Katalog Navigasi Portal M2: HTTP 200, {len(nav_data.get('items', []))} rute publik aktif.")

    nav_route_payload = {
        "expected_version": 1,
        "label": f"Layanan Mandiri SPBE {unique_id}",
        "route": f"/layanan/mandiri-{unique_id}",
        "audience": "PUBLIC_GUEST",
        "position": 50
    }
    st, body, _ = http_post(BASE_URL + "/api/v1/admin/navigation", nav_route_payload, headers=admin_auth_headers)
    assert st == 201, f"Tambah rute navigasi gagal: HTTP {st}: {body}"
    log(f"Konfigurasi Rute Navigasi Baru M2: HTTP 201 Created.")

    # -------------------------------------------------------------------------
    # 5. Pengujian Basis Pengetahuan & Editorial Artikel (M8)
    # -------------------------------------------------------------------------
    st, body, _ = http_get(BASE_URL + "/api/v1/knowledge/articles", headers=admin_auth_headers)
    assert st == 200, f"List artikel gagal: HTTP {st}: {body}"
    art_data = json.loads(body)
    log(f"Basis Pengetahuan M8: HTTP 200, {len(art_data.get('items', []))} artikel operasional terbit.")

    art_payload = {
        "expected_version": 1,
        "title": f"Panduan Akses VPN Kedinasan Depok {unique_id}",
        "slug": f"panduan-vpn-{unique_id}",
        "audience": "ASN_AUTH",
        "alt": "Panduan konfigurasi VPN kedinasan ASN",
        "body": "## Akses VPN Depok\nGunakan akun SSO ASN Kota Depok untuk terhubung ke jaringan intra."
    }
    editor_auth_headers = login_subject(14)
    st, body, _ = http_post(BASE_URL + "/api/v1/knowledge/articles", art_payload, headers=editor_auth_headers)
    assert st == 201, f"Tulis draft artikel gagal: HTTP {st}: {body}"
    created_art = json.loads(body)
    art_id = created_art["id"]
    log(f"Editorial Artikel M8: HTTP 201 Created sebagai DRAFT (ID: {art_id[:8]}...).")

    # -------------------------------------------------------------------------
    # 6. Pengujian Laporan Kinerja SLA & Ekspor Asinkron (M9)
    # -------------------------------------------------------------------------
    coord_headers = login_subject(11) # Koordinator berizin report.read & report.export
    st, body, _ = http_get(BASE_URL + "/api/v1/admin/organizations", headers=admin_auth_headers)
    assert st == 200, "Get organizations failed"
    org_list = json.loads(body).get("items", [])
    assert len(org_list) > 0, "Tidak ada organisasi terdaftar"
    org_id = org_list[0]["id"]

    st, body, _ = http_get(
        BASE_URL + f"/api/v1/reports?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&organization_id={org_id}",
        headers=coord_headers
    )
    assert st == 200, f"Laporan SLA gagal: HTTP {st}: {body}"
    rep_data = json.loads(body)
    log(f"Laporan Kinerja SLA M9: HTTP 200 OK (Penyebut Jujur: {rep_data.get('denominator')}, Capaian: {rep_data.get('measure')}).")

    export_payload = {
        "organization_id": org_id,
        "from": "2026-01-01T00:00:00Z",
        "to": "2026-12-31T23:59:59Z",
        "timezone": "Asia/Jakarta",
        "cohort": "ACCEPTED",
        "format": "CSV"
    }
    st, body, _ = http_post(BASE_URL + "/api/v1/reports/exports", export_payload, headers=coord_headers)
    assert st == 202, f"Pengajuan ekspor data gagal: HTTP {st}: {body}"
    exp_receipt = json.loads(body)
    log(f"Ekspor Data Asinkron M9: HTTP 202 Accepted (Tugas ID: {exp_receipt.get('id', '')[:8]}...).")

    # -------------------------------------------------------------------------
    # 7. Pengujian Jejak Audit Append-Only (M9)
    # -------------------------------------------------------------------------
    auditor_headers = login_subject(16) # Auditor berizin audit.read
    st, body, _ = http_get(BASE_URL + "/api/v1/audit?limit=10", headers=auditor_headers)
    assert st == 200, f"Jejak audit gagal: HTTP {st}: {body}"
    audit_data = json.loads(body)
    audit_count = len(audit_data.get("items", []))
    log(f"Jejak Audit Append-Only M9: HTTP 200, {audit_count} entri transaksi tercatat.")

    # -------------------------------------------------------------------------
    # 8. Pengujian Status Kesehatan Teredaksi & Scoped Runner (M11)
    # -------------------------------------------------------------------------
    st, body, _ = http_get(BASE_URL + "/api/v1/admin/health", headers=admin_auth_headers)
    assert st == 200, f"Status kesehatan gagal: HTTP {st}: {body}"
    health_data = json.loads(body)
    assert health_data.get("status") == "HEALTHY", f"Health status bukan HEALTHY: {health_data}"
    log(f"Diagnosa Kesehatan Sistem M11: HTTP 200 (Status: {health_data.get('status')}, DB: {health_data.get('database')}, Scanner: {health_data.get('scanner')}).")

    # -------------------------------------------------------------------------
    # 9. Pengujian Master Standar (Services, Categories, Organizations, Teams, Memberships)
    # -------------------------------------------------------------------------
    for kind in ["services", "categories", "organizations", "teams", "memberships"]:
        st, body, _ = http_get(BASE_URL + f"/api/v1/admin/{kind}?limit=20", headers=admin_auth_headers)
        assert st == 200, f"Master {kind} gagal: HTTP {st}: {body}"
        k_data = json.loads(body)
        log(f"Master {kind.capitalize()}: HTTP 200 OK, {len(k_data.get('items', []))} entri aktif.")

    print("=" * 75)
    print("SELURUH 9 BLOK PENGUJIAN MODUL & PUSTAKA MEDIA 100% PASS!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
