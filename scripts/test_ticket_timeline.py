"""
Test Suite: Verifikasi UI/UX Progres Laporan & Timeline Penanganan Interaktif (M3/M4/M5/M6)
Memvalidasi:
1. Integritas struktur HTML detail tiket (publik & admin) dengan kelas .hd-timeline-feed
2. Kelengkapan CSS styling di public-ui.css dan business.css
3. Keberadaan komponen JavaScript di bundel m0-04.js (Executive Progress Card, Stepper 5-Tahap, Timeline Vertikal, Resolusi)
4. Uji Fungsional & E2E Live Loopback di port 18090:
   - Pembuatan tiket baru oleh pemohon tamu (Guest Citizen)
   - Alur verifikasi operator M3/M4 (Subjek 4)
   - Alur disposisi penugasan teknisi M5 (Subjek 11 ke Subjek 9)
   - Resolusi pekerjaan teknisi M3 (Subjek 9)
   - Kelengkapan parameter: Judul Laporan, Penanganan, Progres, Tanggal & Waktu WIB, SLA Countdown/Status, Nama Petugas PIC
"""

import sys
import json
import time
import uuid
import http.cookiejar
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:18090"
passed = 0
failed = 0

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"[PASS] {name}" + (f" - {detail}" if detail else ""))
    else:
        failed += 1
        print(f"[FAIL] {name}" + (f" - {detail}" if detail else ""))

class TestClient:
    next_request = 0.0

    def __init__(self, name: str):
        self.name = name
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self) -> str:
        tracking_csrf = next((c.value for c in self.jar if c.name == 'helpdesk_tracking_csrf'), None)
        if tracking_csrf:
            return tracking_csrf
        return next((c.value for c in self.jar if c.name == 'helpdesk_csrf'), '')

    def call(self, path: str, method='GET', body=None, want=200, token=None, headers=None):
        time.sleep(max(0.0, TestClient.next_request - time.monotonic()))
        TestClient.next_request = time.monotonic() + 0.12

        data = None
        if body is not None:
            data = json.dumps(body).encode('utf-8')

        head = {'Origin': BASE_URL, 'User-Agent': f'TimelineTest/{self.name}'}
        if method != 'GET':
            head['Content-Type'] = 'application/json'
            head.update({
                'X-CSRF-Token': self.csrf() if token is None else token,
                'Idempotency-Key': str(uuid.uuid4())
            })
        if headers:
            head.update(headers)

        full_url = BASE_URL + '/api/v1' + path if not path.startswith('/api/v1') else BASE_URL + path
        req = urllib.request.Request(full_url, data=data, headers=head, method=method)

        try:
            res = self.http.open(req, timeout=15)
        except urllib.error.HTTPError as err:
            res = err

        with res:
            raw = res.read()
            if res.status != want:
                print(f"[{self.name}] {method} {path}: HTTP {res.status}, expected {want}: {raw.decode('utf-8', errors='ignore')[:250]}")
            body_json = {}
            if raw and 'application/json' in res.headers.get('Content-Type', ''):
                try:
                    body_json = json.loads(raw.decode('utf-8'))
                except Exception:
                    body_json = {'raw': raw.decode('utf-8', errors='ignore')}
            return res.status, body_json, dict(res.headers), raw

    def bootstrap(self) -> str:
        status, val, _, _ = self.call('/auth/bootstrap')
        if status == 200:
            return val.get('csrf_token', '')
        return ''

    def login(self, subject_index: int):
        nonce = self.bootstrap()
        subject_id = f"20000000-0000-4000-8000-{subject_index:012d}"
        payload = {
            'lab_subject_id': subject_id,
            'csrf_token': nonce
        }
        status, body, _, _ = self.call('/auth/sessions', 'POST', payload, want=201, token=nonce)
        return status == 201

def simple_get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "TimelineTest/Static"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)

print("=== 1. VERIFIKASI STRUKTUR HTML DETAIL TIKET (PUBLIK & ADMIN) ===")
# 1.1 Publik detail-tiket.html
code, html_str = simple_get("/detail-tiket.html")
check("HTML Detail Tiket Publik HTTP 200", code == 200)
check("HTML Publik memuat ol.hd-timeline-feed", 'data-ticket-history class="hd-timeline-feed"' in html_str)
check("HTML Publik memuat Header Timeline", 'Timeline Penanganan &amp; Jejak Progres' in html_str or 'Timeline Penanganan & Jejak Progres' in html_str)
check("HTML Publik memuat Subtitle Kronologi", 'Kronologi Rekam Jejak Kedinasan' in html_str)
check("HTML Publik memuat data-ticket-detail", 'data-ticket-detail' in html_str)

# 1.2 Admin detail.html
code_adm, adm_str = simple_get("/admin/app/tickets/detail.html")
check("HTML Detail Tiket Admin HTTP 200", code_adm == 200)
check("HTML Admin memuat ol.hd-timeline-feed", 'data-ticket-history class="hd-timeline-feed"' in adm_str)
check("HTML Admin memuat Header Timeline", 'Timeline Penanganan &amp; Jejak Progres' in adm_str or 'Timeline Penanganan & Jejak Progres' in adm_str)

print("\n=== 2. VERIFIKASI STYLESHEET CSS (PUBLIC-UI & BUSINESS) ===")
code_css, css_str = simple_get("/helpdesk/public-ui.css")
check("CSS public-ui.css HTTP 200", code_css == 200)
check("public-ui.css memuat .hd-progress-card", '.hd-progress-card' in css_str)
check("public-ui.css memuat .hd-progress-meta-grid", '.hd-progress-meta-grid' in css_str)
check("public-ui.css memuat .hd-stepper-progress", '.hd-stepper-progress' in css_str)
check("public-ui.css memuat .hd-timeline-feed", '.hd-timeline-feed' in css_str)
check("public-ui.css memuat .hd-timeline-item", '.hd-timeline-item' in css_str)
check("public-ui.css memuat .hd-timeline-node", '.hd-timeline-node' in css_str)
check("public-ui.css memuat .hd-sla-pill", '.hd-sla-pill' in css_str)
check("public-ui.css memuat .hd-resolution-highlight", '.hd-resolution-highlight' in css_str)

code_bcss, bcss_str = simple_get("/helpdesk/business.css")
check("CSS business.css HTTP 200", code_bcss == 200)
check("business.css memuat .hd-progress-card", '.hd-progress-card' in bcss_str)
check("business.css memuat .hd-timeline-feed", '.hd-timeline-feed' in bcss_str)
check("business.css memuat .hd-stepper-progress", '.hd-stepper-progress' in bcss_str)

print("\n=== 3. VERIFIKASI BUNDLE JAVASCRIPT CLIENT (m0-04.js) ===")
code_js, js_str = simple_get("/helpdesk/m0-04.js")
check("Bundle m0-04.js HTTP 200", code_js == 200)
check("m0-04.js memuat renderExecutiveTicketProgress", 'renderExecutiveTicketProgress' in js_str or 'hd-progress-card' in js_str)
check("m0-04.js memuat renderTimelineItem", 'renderTimelineItem' in js_str or 'hd-timeline-item' in js_str)
check("m0-04.js memuat kelas status SLA", 'hd-sla-pill--on-track' in js_str and 'hd-sla-pill--breached' in js_str)
check("m0-04.js memuat Stepper 5-Tahap", 'Pengajuan' in js_str and 'Verifikasi' in js_str)
check("m0-04.js memuat highlight resolusi teknisi", 'hd-resolution-highlight' in js_str)

print("\n=== 4. UJI INTEGRASI END-TO-END TIKET & TIMELINE LIVE LOOPBACK ===")
# 4.1 Inisialisasi Klien Tamu & Dapatkan Layanan
guest = TestClient("GuestRequester")
guest_csrf = guest.bootstrap()
guest_cap = uuid.uuid4().hex + uuid.uuid4().hex

# Menggunakan Layanan CSIRT TIK-SEC-01 yang terdaftar
sec_service_id = "30000000-0000-4000-8000-000000000016"

# 4.2 Buat Tiket Baru oleh Pemohon Tamu
ticket_payload = {
    "service_id": sec_service_id,
    "service_version": 1,
    "form_version": 1,
    "policy_version": 1,
    "title": "Laporan Dugaan Defacement Portal Layanan Kelurahan",
    "description": "Tampilan halaman beranda kelurahan berubah menjadi halaman tidak dikenal sejak pukul 08.00 WIB.",
    "answers": {
        "indikasi_insiden": "Defacement / Perubahan Konten Web",
        "target_sistem": "https://bejitimur.depok.go.id",
        "waktu_terdeteksi": "09 November 2026 08:15 WIB",
        "kontak_pelapor": "081298765432"
    }
}
status_tkt, tkt_data, _, _ = guest.call(
    "/tickets",
    method="POST",
    body=ticket_payload,
    want=201,
    token=guest_csrf,
    headers={"X-Guest-Capability": guest_cap}
)
check("Buat Tiket Baru HTTP 201", status_tkt == 201)
ticket_id = tkt_data.get("id", "")
current_ver = tkt_data.get("version", 1)

# 4.3 Aktifkan Sesi Pelacakan Tamu
status_track, _, _, _ = guest.call(
    "/guest/tracking-session",
    method="POST",
    body={"csrf_token": guest_csrf},
    want=201,
    token=guest_csrf,
    headers={"X-Guest-Capability": guest_cap}
)
check("Aktivasi Sesi Pelacakan Tamu HTTP 201", status_track == 201)

# Ambil detail awal tiket untuk mendapatkan nomor tiket
status_init, ticket_init, _, _ = guest.call(f"/tickets/{ticket_id}")
ticket_num = ticket_init.get("number", "")
check("Nomor Tiket Dihasilkan", bool(ticket_num), f"Nomor: {ticket_num}")

# 4.4 Verifikasi Riwayat Awal Tiket (CreateTicket)
status_h1, h1_data, _, _ = guest.call(f"/tickets/{ticket_id}/history")
check("Ambil Riwayat Awal Tiket HTTP 200", status_h1 == 200)
h1_items = h1_data.get("items", [])
check("Riwayat Awal Memuat Entri Dibuat", len(h1_items) >= 1)

# 4.5 Login Operator Front Desk (Subject ID 4: Operator OPD A)
operator = TestClient("OperatorFrontDesk")
op_logged = operator.login(4)
check("Login Operator Lab (Subjek 4) HTTP 201", op_logged)

# 4.6 Operator Verifikasi Tiket
if op_logged and ticket_id:
    verify_payload = {
        "expected_version": current_ver,
        "category_id": "40000000-0000-4000-8000-000000000001",
        "priority": "CRITICAL",
        "reason": "Dampak potensial kebocoran data pada subdomain publik kelurahan, prioritas ditingkatkan ke CRITICAL",
        "classifier_version": 1,
        "evidence_digest": "0000000000000000000000000000000000000000000000000000000000000000"
    }
    status_vrf, vrf_data, _, _ = operator.call(f"/tickets/{ticket_id}/verify", method="POST", body=verify_payload, want=200)
    check("Operator Verifikasi Tiket HTTP 200", status_vrf == 200)
    if status_vrf == 200:
        current_ver = vrf_data.get("version", current_ver + 1)

# 4.7 Login Koordinator Layanan TIK (Subject ID 11: Koordinator OPD A)
coordinator = TestClient("CoordinatorTIK")
coord_logged = coordinator.login(11)
check("Login Koordinator Lab (Subjek 11) HTTP 201", coord_logged)

# 4.8 Koordinator Disposisi ke Teknisi L1 (Subject ID 9: Teknisi L1 OPD A)
if coord_logged and ticket_id:
    dispatch_payload = {
        "expected_version": current_ver,
        "team_id": "50000000-0000-4000-8000-000000000001",
        "assignee_id": "20000000-0000-4000-8000-000000000009",
        "proposal_version": 1,
        "reason": "Penugasan tim tanggap insiden untuk isolasi dan analisis forensik log web server",
        "tier": "L1"
    }
    status_dsp, dsp_data, _, _ = coordinator.call(f"/tickets/{ticket_id}/dispatch", method="POST", body=dispatch_payload, want=200)
    check("Koordinator Disposisi Teknisi HTTP 200", status_dsp == 200)
    if status_dsp == 200:
        current_ver = dsp_data.get("version", current_ver + 1)

# 4.9 Login Teknisi Penanganan (Subject ID 9: Teknisi L1 OPD A)
technician = TestClient("TechnicianPIC")
tech_logged = technician.login(9)
check("Login Teknisi Lab (Subjek 9) HTTP 201", tech_logged)

if tech_logged and ticket_id:
    res_payload = {
        "expected_version": current_ver,
        "summary": "Tindakan isolasi web dan pembersihan webshell telah diselesaikan. File sistem dipulihkan dari cadangan terverifikasi."
    }
    status_res, res_data, _, _ = technician.call(f"/tickets/{ticket_id}/resolve", method="POST", body=res_payload, want=200)
    check("Teknisi Selesaikan Tiket HTTP 200", status_res == 200)
    if status_res == 200:
        current_ver = res_data.get("version", current_ver + 1)

# 4.10 Ambil Detail Tiket Lengkap & Evaluasi Parameter Kebutuhan Pengguna
status_dtl, ticket_final, _, _ = guest.call(f"/tickets/{ticket_id}")
check("Ambil Detail Tiket Akhir HTTP 200", status_dtl == 200)

check("1. Judul Laporan Tersedia & Sesuai", ticket_final.get("title") == ticket_payload["title"], f"Judul: {ticket_final.get('title')}")
check("2. Status Penanganan (State) = RESOLVED", ticket_final.get("state") == "RESOLVED", f"State: {ticket_final.get('state')}")
check("3. Waktu Pembuatan (Tanggal & Waktu) Valid", bool(ticket_final.get("accepted_at")), f"Dibuat: {ticket_final.get('accepted_at')}")
check("4. Target SLA (Resolution Due At) Tersedia", bool(ticket_final.get("resolution_due_at")), f"Due: {ticket_final.get('resolution_due_at')}")
check("5. Petugas Penanggung Jawab (Assignee ID) Tercatat", bool(ticket_final.get("assignee_id")), f"Assignee: {ticket_final.get('assignee_id')}")

# 4.11 Ambil Timeline Riwayat Lengkap & Verifikasi Alur Kronologis
status_hf, hf_data, _, _ = guest.call(f"/tickets/{ticket_id}/history")
check("Ambil Kronologi Riwayat Akhir HTTP 200", status_hf == 200)
hf_items = hf_data.get("items", [])
check("Riwayat Memuat Multiple Action Items", len(hf_items) >= 4, f"Total entri riwayat: {len(hf_items)}")

actions = [item.get("action") for item in hf_items]
check("Riwayat Memuat CreateTicket / TICKET_CREATED (Pengajuan)", any("Create" in a or "CREATE" in a for a in actions))
check("Riwayat Memuat VerifyTicket / TICKET_VERIFIED (Verifikasi Operator)", any("Verify" in a or "VERIFY" in a for a in actions))
check("Riwayat Memuat DispatchTicket / ASSIGNMENT_CHANGED (Disposisi Teknisi)", any("Dispatch" in a or "ASSIGN" in a for a in actions))
check("Riwayat Memuat ResolveTicket / RESOLUTION_PROPOSED (Penyelesaian Teknisi)", any("Resolve" in a or "RESOLV" in a for a in actions))

print(f"\n==========================================")
print(f"HASIL AKHIR UJI TIMELINE: {passed} PASS, {failed} FAIL")
print(f"==========================================")

if failed > 0:
    sys.exit(1)
sys.exit(0)
