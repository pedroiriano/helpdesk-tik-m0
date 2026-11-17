"""
Test End-to-End Pengajuan Laporan & Unggah Berkas Bukti Kendala (Dropzone M3 Intake)
Helpdesk TIK Kota Depok
"""
import io
import json
import urllib.request
import urllib.parse
import http.cookiejar
import hashlib
import uuid
import time

BASE_URL = "http://127.0.0.1:18090"

def run_e2e_test():
    print("=" * 70)
    print("TEST DROPZONE & FORM UX PENGADUAN LAYANAN TIK KOTA DEPOK")
    print("=" * 70)

    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    def api_call(path, method="GET", body=None, headers=None):
        time.sleep(0.05)
        url = BASE_URL + ("/api/v1" + path if not path.startswith("/api/v1") else path)
        head = {
            "Origin": BASE_URL,
            "User-Agent": "DropzoneE2ETest/1.0"
        }
        if method != "GET":
            head.update({
                "Idempotency-Key": str(uuid.uuid4()),
                "Content-Type": "application/json"
            })
        if headers:
            head.update(headers)
        
        data = None
        if body is not None:
            if isinstance(body, (bytes, bytearray)):
                data = body
            else:
                data = json.dumps(body).encode("utf-8")
        
        req = urllib.request.Request(url, data=data, headers=head, method=method)
        try:
            resp = opener.open(req, timeout=10)
            content = resp.read()
            return resp.status, content, resp.headers
        except urllib.error.HTTPError as error:
            err_body = error.read().decode("utf-8")
            print(f"API ERROR {error.code} on {path}: {err_body}")
            raise

    # 1. Fetch Bootstrap
    print("\n1. Mengambil bootstrap CSRF token...")
    _, content, _ = api_call("/auth/bootstrap")
    boot_data = json.loads(content.decode("utf-8"))
    csrf_token = boot_data["csrf_token"]
    print(f"   [OK] CSRF Token didapatkan: {csrf_token[:16]}...")

    # 2. Ambil layanan publik CSIRT / TIK-SEC-01
    print("\n2. Mengambil katalog layanan publik CSIRT...")
    _, content, _ = api_call("/catalog/services?limit=100")
    services = json.loads(content.decode("utf-8")).get("items", [])
    csirt_service = next((s for s in services if s.get("code") == "TIK-SEC-01"), None)
    assert csirt_service is not None, "Layanan TIK-SEC-01 tidak ditemukan di katalog"
    
    srv_id = csirt_service["id"]
    srv_ver = csirt_service["version"]
    print(f"   [OK] Layanan Terpilih: '{csirt_service['name']}' (Kode: {csirt_service['code']})")

    # 3. Ambil Form & Policy snapshot
    print("\n3. Mengambil snapshot formulir & policy...")
    _, content, _ = api_call(f"/catalog/services/{srv_id}/form")
    form_snap = json.loads(content.decode("utf-8"))
    _, content, _ = api_call(f"/catalog/services/{srv_id}/policy")
    policy_snap = json.loads(content.decode("utf-8"))
    print(f"   [OK] Form Version: {form_snap.get('form_version')}, Policy Version: {policy_snap.get('policy_version')}")

    # 4. Buat Tiket Baru sebagai Pemohon Tamu
    print("\n4. Mengajukan tiket laporan baru (M3 Intake)...")
    import secrets
    guest_key = secrets.token_hex(32)

    ticket_answers = {
        "indikasi_insiden": "Defacement / Perubahan Konten Web",
        "target_sistem": "https://portal-lab.depok.go.id",
        "waktu_terdeteksi": "2026-11-09 09:00 WIB",
        "kontak_pelapor": "081299998888",
        "tindakan_darurat": "Layanan Web Sementara Di-offline-kan"
    }

    ticket_payload = {
        "service_id": srv_id,
        "service_version": srv_ver,
        "form_version": form_snap["form_version"],
        "policy_version": policy_snap["policy_version"],
        "title": "Kendala Keamanan Port Web OPD (Dropzone Upload Test)",
        "description": "Pengujian otomatis komponen drag and drop Dropzone serta alur UX pelaporan tiket baru dengan verifikasi pemindaian ClamAV.",
        "answers": ticket_answers
    }

    status, content, _ = api_call(
        "/tickets",
        method="POST",
        body=ticket_payload,
        headers={
            "X-CSRF-Token": csrf_token,
            "X-Guest-Capability": guest_key
        }
    )
    assert status == 201, f"Expected 201 Created, got {status}"
    ticket_data = json.loads(content.decode("utf-8"))
    ticket_id = ticket_data["id"]
    ticket_number = ticket_data.get("number", "N/A")
    print(f"   [OK] Tiket Berhasil Dibuat: Nomor={ticket_number}, ID={ticket_id}")

    # 4b. Mulai Sesi Pelacakan Tamu Menggunakan Kunci Kriptografis
    print("\n4b. Mengaktifkan sesi pelacakan tamu via Kunci Rahasia...")
    status, content, _ = api_call(
        "/guest/tracking-session",
        method="POST",
        body={"csrf_token": csrf_token},
        headers={
            "X-CSRF-Token": csrf_token,
            "X-Guest-Capability": guest_key
        }
    )
    assert status == 201, f"Expected 201 Created for tracking session, got {status}"
    session_data = json.loads(content.decode("utf-8"))
    print(f"   [OK] Sesi Pelacakan Tamu Aktif: Session ID={session_data.get('id')}")

    tracking_csrf = None
    for cookie in cj:
        if cookie.name == "helpdesk_tracking_csrf":
            tracking_csrf = cookie.value
    assert tracking_csrf is not None, "Cookie helpdesk_tracking_csrf tidak ditemukan"
    print(f"   [OK] Tracking CSRF Token dari cookie: {tracking_csrf[:16]}...")

    # 5. Unggah Berkas Bukti Kendala via Dropzone (Binary Stream Attachment)
    print("\n5. Mengunggah berkas gambar bukti kendala via Dropzone binary octet-stream...")
    import zlib, struct
    def make_png(w=4, h=4):
        raw = b''.join(b'\x00' + b'\x38\x8b\xfd\xff' * w for _ in range(h))
        comp = zlib.compress(raw)
        p = b'\x89PNG\r\n\x1a\n'
        ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
        p += struct.pack('>I', len(ihdr)) + b'IHDR' + ihdr + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr) & 0xffffffff)
        p += struct.pack('>I', len(comp)) + b'IDAT' + comp + struct.pack('>I', zlib.crc32(b'IDAT' + comp) & 0xffffffff)
        p += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND') & 0xffffffff)
        return p

    valid_png_bytes = make_png(4, 4)

    status, content, _ = api_call(
        f"/tickets/{ticket_id}/attachments",
        method="POST",
        body=valid_png_bytes,
        headers={
            "Content-Type": "application/octet-stream",
            "X-Filename": "tangkapan-layar-kendala-csirt.png",
            "X-File-Mime": "image/png",
            "X-Attachment-Audience": "REQUESTER",
            "X-Expected-Version": "1",
            "X-Guest-Capability": guest_key,
            "X-CSRF-Token": tracking_csrf
        }
    )
    assert status == 201, f"Expected 201 Created for attachment, got {status}"
    att_data = json.loads(content.decode("utf-8"))
    att_id = att_data["id"]
    att_status = att_data.get("status", "UNKNOWN")
    print(f"   [OK] Berkas Berhasil Diunggah ke Karantina Tiket:")
    print(f"        Attachment ID : {att_id}")
    print(f"        Nama Berkas    : {att_data.get('name')}")
    print(f"        MIME Type      : {att_data.get('mime')}")
    print(f"        Status Awal    : {att_status} (Karantina / Pemindaian ClamAV)")

    # 6. Verifikasi Pelacakan Tiket Tamu & Lampiran
    print("\n6. Memverifikasi tiket melalui Kunci Pelacakan Tamu...")
    status, content, _ = api_call(
        f"/tickets/{ticket_id}",
        headers={"X-Guest-Capability": guest_key}
    )
    assert status == 200, f"Expected 200 OK, got {status}"
    tracked_ticket = json.loads(content.decode("utf-8"))
    print(f"   [OK] Status Tiket : {tracked_ticket.get('state')}")
    print(f"   [OK] Judul Laporan: {tracked_ticket.get('title')}")

    print("\n" + "=" * 70)
    print("HASIL E2E DROPZONE & FORM UX: PASS (100% SUKSES)")
    print("=" * 70)

if __name__ == "__main__":
    run_e2e_test()
