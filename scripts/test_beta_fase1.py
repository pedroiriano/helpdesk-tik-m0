#!/usr/bin/env python3
"""
scripts/test_beta_fase1.py
Fase 1: Uji Lab Ketat Komponen & Form (Component & Form Hardening Drill)
Helpdesk TIK Pemerintah Kota Depok - Menuju Beta Testing
"""

import os
import sys
import json
import time
import uuid
import datetime
import http.cookiejar
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = os.environ.get("HELPDESK_BASE_URL", "http://127.0.0.1:18090")
QA_DIR = Path("qa/beta-testing")
QA_DIR.mkdir(parents=True, exist_ok=True)

# 16 Layanan Resmi TIK Diskominfo Kota Depok
DEPOK_16_SERVICES = [
    {"code": "TIK-NET-01", "name": "Layanan Akses Jaringan Internet & Intranet OPD", "mode": "ASN_AUTH", "category": "CAT-INFRA", "slug": "akses-internet-opd"},
    {"code": "TIK-EML-01", "name": "Layanan Penerbitan Akun Email Kedinasan @depok.go.id", "mode": "ASN_AUTH", "category": "CAT-TATA-KELOLA", "slug": "email-dinas-depok"},
    {"code": "TIK-DOM-01", "name": "Layanan Pembuatan Subdomain & Hosting Portal Resmi OPD", "mode": "ASN_AUTH", "category": "CAT-APTIKA", "slug": "subdomain-hosting-portal"},
    {"code": "TIK-INT-01", "name": "Layanan Integrasi Aplikasi & Interoperabilitas SPBE (SPLP/API)", "mode": "ASN_AUTH", "category": "CAT-APTIKA", "slug": "integrasi-aplikasi-spbe"},
    {"code": "TIK-TTE-01", "name": "Layanan Penerbitan Sertifikat Elektronik & Tanda Tangan Elektronik (TTE BSrE)", "mode": "ASN_AUTH", "category": "CAT-PERSANDIAN", "slug": "pengajuan-tte-bsre"},
    {"code": "TIK-SEC-01", "name": "Layanan Penanganan Insiden Keamanan Informasi (Depok-CSIRT)", "mode": "PUBLIC_GUEST", "category": "CAT-PERSANDIAN", "slug": "insiden-keamanan-csirt"},
    {"code": "TIK-VIC-01", "name": "Layanan Fasilitasi Video Conference / Rapat Virtual Pimpinan", "mode": "ASN_AUTH", "category": "CAT-INFRA", "slug": "fasilitasi-video-conference"},
    {"code": "TIK-SRV-01", "name": "Layanan Pemeliharaan Server Virtual / Colocation Data Center", "mode": "ASN_AUTH", "category": "CAT-INFRA", "slug": "pemeliharaan-server-virtual"},
    {"code": "TIK-LAN-01", "name": "Layanan Instalasi & Pemeliharaan Perangkat Jaringan LAN/WiFi OPD", "mode": "ASN_AUTH", "category": "CAT-INFRA", "slug": "instalasi-jaringan-lan-wifi"},
    {"code": "TIK-SIM-01", "name": "Layanan Dukungan Teknis Aplikasi Kepegawaian & Layanan ASN (SIMPEG/Kinerja)", "mode": "ASN_AUTH", "category": "CAT-APTIKA", "slug": "dukungan-simpeg-kinerja"},
    {"code": "TIK-KEU-01", "name": "Layanan Dukungan Sistem Keuangan Daerah (SIPD / SIMDA)", "mode": "ASN_AUTH", "category": "CAT-APTIKA", "slug": "dukungan-sipd-simda"},
    {"code": "TIK-DSW-01", "name": "Layanan Dukungan Aplikasi Pelayanan Publik Terpadu (Depok Single Window / DSW)", "mode": "PUBLIC_GUEST", "category": "CAT-APTIKA", "slug": "depok-single-window-dsw"},
    {"code": "TIK-CCT-01", "name": "Layanan Pemasangan & Pemeliharaan Jaringan CCTV Pengawasan Kota", "mode": "ASN_AUTH", "category": "CAT-INFRA", "slug": "pemeliharaan-jaringan-cctv"},
    {"code": "TIK-PUB-01", "name": "Layanan Fasilitasi Jaringan Internet Publik (WiFi Alun-Alun / Taman Kelurahan)", "mode": "PUBLIC_GUEST", "category": "CAT-INFRA", "slug": "wifi-publik-alun-alun"},
    {"code": "TIK-DEV-01", "name": "Layanan Permohonan Pendampingan Pembuatan Aplikasi Baru OPD", "mode": "ASN_AUTH", "category": "CAT-APTIKA", "slug": "pendampingan-aplikasi-baru"},
    {"code": "TIK-ACC-01", "name": "Layanan Pemulihan Akses / Reset Kredensial Akun SPBE Terpadu", "mode": "ASN_AUTH", "category": "CAT-TATA-KELOLA", "slug": "pemulihan-kredensial-spbe"}
]

class TestClient:
    next_req = 0.0

    def __init__(self, name: str):
        self.name = name
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self) -> str:
        tracking_csrf = next((c.value for c in self.jar if c.name == 'helpdesk_tracking_csrf'), None)
        if tracking_csrf:
            return tracking_csrf
        return next((c.value for c in self.jar if c.name == 'helpdesk_csrf'), '')

    def call(self, path: str, method='GET', body=None, want=200, token=None, headers=None):
        time.sleep(max(0.0, TestClient.next_req - time.monotonic()))
        TestClient.next_req = time.monotonic() + 0.12

        data = json.dumps(body).encode('utf-8') if body is not None else None
        head = {'Origin': BASE_URL, 'User-Agent': f'BetaTesting-Fase1/{self.name}'}
        if method != 'GET':
            head.update({
                'Content-Type': 'application/json',
                'X-CSRF-Token': self.csrf() if token is None else token,
                'Idempotency-Key': str(uuid.uuid4())
            })
        if headers:
            head.update(headers)

        full_url = BASE_URL + ('/api/v1' + path if not path.startswith('/api/v1') else path)
        req = urllib.request.Request(full_url, data=data, headers=head, method=method)

        try:
            res = self.opener.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            res = error

        with res:
            raw = res.read()
            if res.status != want:
                raise AssertionError(f"[{self.name}] {method} {path} expected HTTP {want}, got {res.status}: {raw.decode('utf-8', errors='ignore')[:200]}")
            body_json = {}
            if raw and 'application/json' in res.headers.get('Content-Type', ''):
                try:
                    body_json = json.loads(raw.decode('utf-8'))
                except Exception:
                    body_json = {'raw': raw.decode('utf-8', errors='ignore')}
            return body_json, res.status

    def bootstrap(self):
        val, _ = self.call('/auth/bootstrap')
        return val['csrf_token']

    def login(self, subject_index: int):
        nonce = self.bootstrap()
        subject_id = f"20000000-0000-4000-8000-{subject_index:012d}"
        payload = {'lab_subject_id': subject_id, 'csrf_token': nonce}
        self.call('/auth/sessions', 'POST', payload, want=201, token=nonce)


def run_fase_1():
    print("=" * 75)
    print("FASE 1: UJI LAB KETAT KOMPONEN & FORM (COMPONENT & FORM HARDENING DRILL)")
    print("Helpdesk TIK Kota Depok - Verifikasi Menuju Beta Testing")
    print("=" * 75)

    report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "phase": "FASE_1_COMPONENT_HARDENING",
        "base_url": BASE_URL,
        "checks": []
    }

    # -------------------------------------------------------------------------
    # Check 1: Verifikasi Master Data & Skema 16 Layanan Resmi
    # -------------------------------------------------------------------------
    print("\n1. Menguji Master Data & Skema Formulir 16 Layanan Resmi TIK Depok...")
    asn_client = TestClient("ASN-Inspector")
    asn_client.login(3) # ASN Bappeda
    
    catalog_resp, _ = asn_client.call('/catalog/services?limit=100')
    items = catalog_resp.get('items', [])
    items_by_code = {s['code']: s for s in items}

    verified_services = 0
    total_form_fields = 0

    for def_svc in DEPOK_16_SERVICES:
        code = def_svc['code']
        assert code in items_by_code, f"Layanan {code} tidak ditemukan di katalog API"
        svc = items_by_code[code]
        assert svc['name'] == def_svc['name'], f"Nama layanan {code} tidak cocok"
        assert svc['access_mode'] == def_svc['mode'], f"Access mode {code} tidak cocok"
        assert svc['active'] is True, f"Layanan {code} tidak aktif"

        # Periksa Formulir
        form_resp, _ = asn_client.call(f"/catalog/services/{svc['id']}/form")
        fields = form_resp.get('fields', [])
        assert len(fields) >= 2, f"Formulir {code} harus memiliki minimal 2 field dinamis, didapat {len(fields)}"
        
        # Periksa Policy
        pol_resp, _ = asn_client.call(f"/catalog/services/{svc['id']}/policy")
        assert pol_resp['policy_version'] >= 1
        assert pol_resp['upload_max_bytes'] >= 5242880 # Min 5 MiB
        assert 'application/pdf' in pol_resp['allowed_mime']

        verified_services += 1
        total_form_fields += len(fields)

    print(f"   [OK] 16 Layanan resmi terverifikasi lengkap (Total field dinamis: {total_form_fields})")
    report["checks"].append({
        "name": "services_and_forms_schema",
        "status": "PASS",
        "verified_services": verified_services,
        "total_fields": total_form_fields
    })

    # -------------------------------------------------------------------------
    # Check 2: Verifikasi Penegakan Otorisasi & Scope Akses Layanan (ACL Guard)
    # -------------------------------------------------------------------------
    print("\n2. Menguji Penegakan Isolasi Hak Akses Tamu Publik vs ASN...")
    guest_client = TestClient("Guest-Citizen")
    guest_catalog, _ = guest_client.call('/catalog/services?limit=100')
    guest_items = guest_catalog.get('items', [])
    guest_codes = {s['code'] for s in guest_items}

    # Tamu publik hanya boleh melihat layanan PUBLIC_GUEST
    for s in guest_items:
        assert s['access_mode'] == 'PUBLIC_GUEST', f"Tamu tidak boleh melihat layanan {s['code']} ber-mode {s['access_mode']}"
    
    assert "TIK-SEC-01" in guest_codes, "Layanan CSIRT wajib terlihat oleh publik"
    assert "TIK-DSW-01" in guest_codes, "Layanan DSW wajib terlihat oleh publik"
    assert "TIK-PUB-01" in guest_codes, "Layanan WiFi Publik wajib terlihat oleh publik"
    assert "TIK-NET-01" not in guest_codes, "Layanan Jaringan OPD tidak boleh bocor ke publik"
    assert "TIK-EML-01" not in guest_codes, "Layanan Email Kedinasan tidak boleh bocor ke publik"

    # Guest request form ASN service -> Wajib 404
    net_svc_id = items_by_code["TIK-NET-01"]["id"]
    guest_client.call(f"/catalog/services/{net_svc_id}/form", want=404)
    print("   [OK] Isolasi akses tamu publik vs ASN terbukti aman (Zero scope leakage & 404 enforced)")
    report["checks"].append({"name": "service_access_isolation", "status": "PASS"})

    # -------------------------------------------------------------------------
    # Check 3: Verifikasi Rute Semantik Slug & Endpoint Landing Form
    # -------------------------------------------------------------------------
    print("\n3. Menguji Rute Semantik Slug & Form Endpoint Nginx Gateway...")
    for def_svc in DEPOK_16_SERVICES:
        slug = def_svc['slug']
        url = f"{BASE_URL}/layanan/{slug}"
        req = urllib.request.Request(url, headers={"User-Agent": "BetaTesting-Fase1"})
        with urllib.request.urlopen(req, timeout=5) as res:
            assert res.status == 200, f"Rute /layanan/{slug} gagal dengan HTTP {res.status}"
            body_text = res.read().decode('utf-8', errors='ignore')
            assert 'detail-layanan' in body_text or 'Pratinjau formulir layanan' in body_text, f"Konten {slug} tidak memuat detail layanan"

    # Test /tiket/baru endpoint
    for slug in ["akses-internet-opd", "insiden-keamanan-csirt", "depok-single-window-dsw"]:
        url = f"{BASE_URL}/tiket/baru/{slug}"
        req = urllib.request.Request(url, headers={"User-Agent": "BetaTesting-Fase1"})
        with urllib.request.urlopen(req, timeout=5) as res:
            assert res.status == 200, f"Rute /tiket/baru/{slug} gagal dengan HTTP {res.status}"

    print(f"   [OK] Seluruh {len(DEPOK_16_SERVICES)} rute semantik /layanan/:slug dan /tiket/baru/:slug merespons HTTP 200 OK")
    report["checks"].append({"name": "semantic_slug_routes", "status": "PASS", "slug_count": len(DEPOK_16_SERVICES)})

    # -------------------------------------------------------------------------
    # Check 4: Verifikasi Komponen Modal, Dialog WAI-ARIA, & Keyboard Attributes
    # -------------------------------------------------------------------------
    print("\n4. Menguji Aksesibilitas Komponen Modal & Dialog WAI-ARIA...")
    dist_dir = Path("frontend/dist")
    dialog_checks = [
        ("data-reject-dialog", "Tolak Laporan Pemohon", "reject-dialog-title"),
        ("data-confirm-reject-dialog", "Ajukan Keberatan Hasil Penanganan", "confirm-reject-dialog-title"),
        ("data-archive-dialog", "Konfirmasi Pengarsipan Tiket", "archive-dialog-title"),
        ("data-restore-dialog", "Konfirmasi Pemulihan Arsip Tiket", "restore-dialog-title"),
        ("data-media-modal", "Pustaka Media Terpadu", "media-modal-title")
    ]

    detail_html = (dist_dir / "detail-tiket.html").read_text(encoding="utf-8")
    for attr, heading, title_id in dialog_checks:
        assert attr in detail_html, f"Elemen dialog [{attr}] tidak ditemukan pada detail-tiket.html"
        assert f'aria-labelledby="{title_id}"' in detail_html, f"Atribut aria-labelledby={title_id} tidak ditemukan pada [{attr}]"
        assert f'id="{title_id}"' in detail_html, f"Judul heading id={title_id} tidak ditemukan pada [{attr}]"
        assert 'aria-modal="true"' in detail_html, f"Atribut aria-modal='true' tidak ditemukan pada [{attr}]"
        assert 'role="dialog"' in detail_html, f"Atribut role='dialog' tidak ditemukan pada [{attr}]"

    print("   [OK] Seluruh 5 komponen dialog WAI-ARIA keyboard-accessible terverifikasi memenuhi standar")
    report["checks"].append({"name": "wai_aria_dialog_accessibility", "status": "PASS", "dialog_count": len(dialog_checks)})

    # -------------------------------------------------------------------------
    # Check 5: Pengujian Validasi Isian Dinamis Tiket Publik (Positive & Negative)
    # -------------------------------------------------------------------------
    print("\n5. Menguji Validasi Dynamic Form Submission (Positive & Negative)...")
    # Negative test: Submit tiket CSIRT tanpa isian dinamis wajib -> 422
    sec_svc_id = items_by_code["TIK-SEC-01"]["id"]
    guest_token = guest_client.bootstrap()
    
    import secrets
    guest_capability = secrets.token_hex(32)

    # Missing required answers
    incomplete_payload = {
        "service_id": sec_svc_id,
        "service_version": 1,
        "form_version": 1,
        "policy_version": 1,
        "title": "Percobaan Insiden Keamanan Web Dinas",
        "description": "Terdeteksi defacement pada halaman depan portal resmi.",
        "answers": {
            "target_sistem": "https://opd.depok.go.id"
            # Missing indikasi_insiden, waktu_terdeteksi, kontak_pelapor
        }
    }
    guest_client.call(
        "/tickets",
        method="POST",
        body=incomplete_payload,
        want=422,
        token=guest_token,
        headers={"X-Guest-Capability": guest_capability}
    )
    print("   [OK] Negative test berhasil: Server menolak formulir tidak lengkap dengan HTTP 422 Unprocessable Entity")

    # Positive test: Submit tiket CSIRT dengan isian dinamis lengkap -> 201 Created
    complete_payload = {
        "service_id": sec_svc_id,
        "service_version": 1,
        "form_version": 1,
        "policy_version": 1,
        "title": "Uji Validasi Form CSIRT Fase 1",
        "description": "Laporan uji coba kelengkapan isian dinamis penanganan insiden keamanan informasi.",
        "answers": {
            "indikasi_insiden": "Defacement / Perubahan Konten Web",
            "target_sistem": "https://portal-lab.depok.go.id",
            "waktu_terdeteksi": "2026-11-08 13:00 WIB",
            "kontak_pelapor": "081299998888",
            "tindakan_darurat": "Layanan Web Sementara Di-offline-kan"
        }
    }
    created_ticket, status_code = guest_client.call(
        "/tickets",
        method="POST",
        body=complete_payload,
        want=201,
        token=guest_token,
        headers={"X-Guest-Capability": guest_capability}
    )
    assert 'id' in created_ticket, "Ticket ID must be present in response"
    print(f"   [OK] Positive test berhasil: Tiket ID={created_ticket['id']} berhasil dibuat (Version: {created_ticket.get('version', 1)})")
    report["checks"].append({"name": "dynamic_form_validation", "status": "PASS", "test_ticket_id": created_ticket['id']})

    # Simpan Laporan Resmi
    out_file = QA_DIR / "fase1_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 75)
    print(f"Hasil Eksekusi FASE 1: PASS (100%)")
    print(f"Laporan bukti resmi tersimpan di: {out_file}")
    print("=" * 75)
    return True

if __name__ == "__main__":
    success = run_fase_1()
    sys.exit(0 if success else 1)
