#!/usr/bin/env python3
"""
Test Suite: Autentikasi & Registrasi Mandiri Global (Pelapor & Petugas/Admin)
Helpdesk TIK Kota Depok - Standar Pengujian M0
"""
import urllib.request
import urllib.error
import json
import secrets
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:18090"

def log(msg, success=True):
    sym = "✅" if success else "❌"
    print(f"{sym} {msg}")

def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8"), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), e.headers

def http_post(url, payload, headers=None):
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

def extract_cookie(headers, cookie_name="helpdesk_session"):
    cookie_header = headers.get("Set-Cookie", "")
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith(cookie_name + "="):
            return part
    return ""

def run_tests():
    print("=" * 70)
    print("Pengujian Alur Registrasi & Login Global Helpdesk TIK Kota Depok")
    print("=" * 70)

    # 1. Uji Halaman Publik Pendaftaran & Login
    pages_to_test = [
        ("/daftar.html", "data-hd-register", "Pendaftaran Akun Warga"),
        ("/daftar", "data-hd-register", "Pendaftaran Akun Warga (clean url)"),
        ("/register", "data-hd-register", "Pendaftaran Akun Warga (alias)"),
        ("/akses.html", "data-auth-tab", "Login Publik Terpadu 2-Tab"),
        ("/masuk", "data-auth-tab", "Login Publik (clean url)"),
        ("/login", "data-auth-tab", "Login Publik (alias)"),
        ("/admin/auth/login.html", "data-quick-login", "Login Petugas Kedinasan")
    ]

    for path, expected_attr, label in pages_to_test:
        status, body, _ = http_get(BASE_URL + path)
        if status == 200 and expected_attr in body:
            log(f"Halaman {label} [{path}]: HTTP 200 & elemen '{expected_attr}' ditemukan.")
        else:
            log(f"Halaman {label} [{path}]: Gagal! Status {status}, expected '{expected_attr}' in body.", success=False)
            sys.exit(1)

    # 2. Uji Bootstrap CSRF Token
    status, body, boot_headers = http_get(BASE_URL + "/api/v1/auth/bootstrap")
    assert status == 200, f"Bootstrap gagal: status {status}"
    boot_data = json.loads(body)
    csrf_token = boot_data.get("csrf_token")
    login_cookie = extract_cookie(boot_headers, "helpdesk_login")
    assert csrf_token, "CSRF token tidak ditemukan di bootstrap!"
    log(f"Bootstrap API: CSRF token ({csrf_token[:16]}...) & Cookie helpdesk_login didapatkan.")

    # 3. Uji Registrasi Mandiri Warga Baru
    unique_num = secrets.randbelow(899999) + 100000
    nik = f"327601{unique_num:06d}0001"
    email = f"warga.depok.{unique_num}@testing.internal"
    phone = f"0812{unique_num:06d}"
    password = "KataSandiWarga2026!"
    name = f"Warga Terdaftar {unique_num}"

    reg_payload = {
        "nik": nik,
        "name": name,
        "email": email,
        "phone": phone,
        "password": password,
        "csrf_token": csrf_token
    }

    status, body, headers = http_post(
        BASE_URL + "/api/v1/auth/register",
        reg_payload,
        headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
    )
    if status == 201:
        log(f"Registrasi Mandiri Warga ({email}): HTTP 201 Created.")
    else:
        log(f"Registrasi Mandiri Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    reg_data = json.loads(body)
    reg_session_id = reg_data.get("id")
    reg_cookie = extract_cookie(headers)
    assert reg_session_id, "Session ID tidak ditemukan di hasil registrasi!"
    log(f"Sesi Registrasi Baru: ID {reg_session_id}, Cookie: {reg_cookie[:32]}...")

    # 4. Uji Verifikasi Sesi Registrasi via /api/v1/auth/me
    status, body, _ = http_get(BASE_URL + "/api/v1/auth/me", headers={"Cookie": reg_cookie, "X-CSRF-Token": csrf_token})
    if status == 200:
        me_data = json.loads(body)
        assert me_data.get("actor", {}).get("name") == name, f"Nama actor mismatch: {me_data}"
        assert me_data.get("actor", {}).get("kind") == "PUBLIC", f"Actor kind mismatch: {me_data}"
        log(f"Verifikasi Sesi Warga (/auth/me): Aktor '{me_data['actor']['name']}' Role '{me_data['actor']['kind']}' terdaftar dan aktif.")
    else:
        log(f"Verifikasi Sesi Warga Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    # 5. Uji Login Warga dengan Kredensial Baru (Email & Password)
    login_payload = {
        "identifier": email,
        "password": password,
        "csrf_token": csrf_token
    }
    status, body, headers = http_post(
        BASE_URL + "/api/v1/auth/sessions",
        login_payload,
        headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
    )
    if status == 201:
        warga_login_cookie = extract_cookie(headers)
        log(f"Login Kredensial Warga (Email + Password): HTTP 201 Created. Cookie aktif.")
    else:
        log(f"Login Kredensial Warga Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    # 6. Uji Login Warga dengan NIK & Password
    login_nik_payload = {
        "identifier": nik,
        "password": password,
        "csrf_token": csrf_token
    }
    status, body, _ = http_post(
        BASE_URL + "/api/v1/auth/sessions",
        login_nik_payload,
        headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
    )
    if status == 201:
        log(f"Login Kredensial Warga (NIK + Password): HTTP 201 Created.")
    else:
        log(f"Login NIK Warga Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    # 7. Uji Login Petugas / Admin dengan Identifier Role
    staff_roles = [
        ("admin", "SUPER_ADMIN", "Super Admin Diskominfo"),
        ("operator", "OPERATOR", "Operator Verifikasi Front Desk"),
        ("koordinator", "KOORDINATOR", "Koordinator Layanan TIK"),
        ("teknisi", "TECHNICIAN", "Teknisi Penanganan Gangguan"),
        ("kadis", "LEAD", "Kepala Dinas (Pimpinan)"),
        ("auditor", "AUDITOR", "Auditor Tata Kelola SPBE Inspektorat")
    ]

    for identifier, expected_role, label in staff_roles:
        staff_payload = {
            "identifier": identifier,
            "csrf_token": csrf_token
        }
        status, body, headers = http_post(
            BASE_URL + "/api/v1/auth/sessions",
            staff_payload,
            headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
        )
        if status == 201:
            staff_session = json.loads(body)
            actor = staff_session.get("actor", {})
            actor_kind = actor.get("kind")
            log(f"Login Petugas {label} ('{identifier}'): HTTP 201 Created, Role '{actor_kind}'.")
        else:
            log(f"Login Petugas {label} Gagal: HTTP {status}: {body}", success=False)
            sys.exit(1)

    # 8. Uji Hak Akses Master Layanan & Organisasi untuk Super Admin
    admin_payload = {"identifier": "admin", "csrf_token": csrf_token}
    _, _, admin_headers = http_post(
        BASE_URL + "/api/v1/auth/sessions",
        admin_payload,
        headers={"Cookie": login_cookie, "X-CSRF-Token": csrf_token}
    )
    admin_cookie = extract_cookie(admin_headers)

    status, body, _ = http_get(BASE_URL + "/api/v1/admin/services?limit=20", headers={"Cookie": admin_cookie, "X-CSRF-Token": csrf_token})
    if status == 200:
        services_data = json.loads(body)
        service_count = len(services_data.get("items", []))
        log(f"Akses Master Layanan Admin (/admin/services): HTTP 200, {service_count} layanan resmi aktif.")
    else:
        log(f"Akses Master Layanan Admin Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    status, body, _ = http_get(BASE_URL + "/api/v1/admin/organizations?limit=20", headers={"Cookie": admin_cookie, "X-CSRF-Token": csrf_token})
    if status == 200:
        orgs_data = json.loads(body)
        org_count = len(orgs_data.get("items", []))
        log(f"Akses Master OPD Admin (/admin/organizations): HTTP 200, {org_count} organisasi terdaftar.")
    else:
        log(f"Akses Master OPD Admin Gagal: HTTP {status}: {body}", success=False)
        sys.exit(1)

    print("=" * 70)
    print("SELURUH PENGUJIAN AUTENTIKASI & REGISTRASI GLOBAL 100% PASS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
