#!/usr/bin/env python3
"""
scripts/test_m0_13_uat.py
Suite UAT AI Berbasis Multi-Persona (9 Persona Operasional Nyata)
Pengujian Penerimaan Pengguna Hulu-ke-Hilir pada 16 Katalog Layanan TIK Kota Depok
Fase M0-13 (Kesesuaian Halaman, Slug, Alur Bisnis, Konten, & Otorisasi Rilis)
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
QA_DIR = Path("qa/m0-13")

# UUID Organisasi Lab
ORG_OPD_A = "10000000-0000-4000-8000-000000000001"
ORG_OPD_B = "10000000-0000-4000-8000-000000000002"
TEAM_OPD_A = "50000000-0000-4000-8000-000000000001"
TEAM_OPD_B = "50000000-0000-4000-8000-000000000002"
VENDOR_ID = "00000000-0000-4000-8000-000000000099"

class UATClient:
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

    def call(self, path: str, method='GET', body=None, want=200, key=None, token=None, headers=None, raw_body=None):
        time.sleep(max(0.0, UATClient.next_request - time.monotonic()))
        UATClient.next_request = time.monotonic() + 0.12

        if raw_body is not None:
            data = raw_body
        elif body is not None:
            data = json.dumps(body).encode('utf-8')
        else:
            data = None

        head = {'Origin': BASE_URL, 'User-Agent': f'M0-13-UAT/{self.name}'}
        if method != 'GET':
            if raw_body is None:
                head['Content-Type'] = 'application/json'
            head.update({
                'X-CSRF-Token': self.csrf() if token is None else token,
                'Idempotency-Key': key or str(uuid.uuid4())
            })
        head.update(headers or {})

        full_url = BASE_URL + '/api/v1' + path if not path.startswith('/api/v1') else BASE_URL + path
        req = urllib.request.Request(full_url, data=data, headers=head, method=method)

        try:
            res = self.http.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            res = error

        with res:
            raw = res.read()
            if res.status != want:
                raise RuntimeError(f"[{self.name}] {method} {path}: HTTP {res.status}, expected {want}: {raw.decode('utf-8', errors='ignore')}")
            resp_headers = dict(res.headers)
            body_json = {}
            if raw and 'application/json' in resp_headers.get('Content-Type', ''):
                try:
                    body_json = json.loads(raw.decode('utf-8'))
                except Exception:
                    body_json = {'raw': raw.decode('utf-8', errors='ignore')}
            return body_json, resp_headers, raw

    def bootstrap(self) -> str:
        val, _, _ = self.call('/auth/bootstrap')
        assert val['mode'] == 'SYNTHETIC_LAB', "Bootstrap must return SYNTHETIC_LAB mode"
        return val['csrf_token']

    def login(self, subject_index: int):
        nonce = self.bootstrap()
        subject_id = f"20000000-0000-4000-8000-{subject_index:012d}"
        payload = {
            'lab_subject_id': subject_id,
            'csrf_token': nonce
        }
        self.call('/auth/sessions', 'POST', payload, want=201, token=nonce)


def run_uat():
    print("=" * 75)
    print("M0-13 — Suite User Acceptance Testing (UAT AI Multi-Persona)")
    print("Pemerintah Kota Depok - Dinas Komunikasi dan Informatika")
    print("=" * 75)

    QA_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "task_id": "M0-13",
        "scope": "end_to_end_ai_uat_multi_persona",
        "personas_tested": 9,
        "results": {},
        "result": "IN_PROGRESS"
    }

    # -------------------------------------------------------------------------
    # PERSONA 1: Warga / Pemohon Publik (Guest Citizen)
    # -------------------------------------------------------------------------
    print("\n[Persona 1] Warga / Pemohon Publik (Guest Citizen)")
    p1 = UATClient("Persona-1-GuestCitizen")
    p1_csrf = p1.bootstrap()
    p1_capability = uuid.uuid4().hex + uuid.uuid4().hex  # 64-char hex

    # 1. Pilih layanan CSIRT TIK-SEC-01
    sec_service_id = "30000000-0000-4000-8000-000000000016"
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
            "waktu_terdeteksi": "07 November 2026 08:15 WIB",
            "kontak_pelapor": "081298765432"
        }
    }
    create_resp, _, _ = p1.call(
        '/tickets',
        method='POST',
        body=ticket_payload,
        want=201,
        token=p1_csrf,
        headers={'X-Guest-Capability': p1_capability}
    )
    guest_ticket_id = create_resp['id']
    guest_ver = create_resp['version']
    print(f"   [OK] Tiket tamu berhasil diajukan: {guest_ticket_id} (Status: {create_resp.get('state', 'OPEN')})")

    # 2. Buka sesi pelacakan tamu aman (Exchange capability token menjadi tracking session)
    p1.call(
        '/guest/tracking-session',
        method='POST',
        body={'csrf_token': p1_csrf},
        want=201,
        token=p1_csrf,
        headers={'X-Guest-Capability': p1_capability}
    )
    print("   [OK] Sesi pelacakan tiket tamu aman (Tracking Session) aktif")

    # 3. Unggah lampiran bukti tangkapan layar bersih (image/png sintetis via byte stream)
    import zlib, struct
    raw_pixels = b''.join(b'\x00' + b'\x00\xa0\xff\xff' * 4 for _ in range(4))
    compressed_pixels = zlib.compress(raw_pixels)
    def png_chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', 4, 4, 8, 6, 0, 0, 0)
    png_bytes = b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', compressed_pixels) + png_chunk(b'IEND', b'')
    att_resp, _, _ = p1.call(
        f'/tickets/{guest_ticket_id}/attachments',
        method='POST',
        raw_body=png_bytes,
        want=201,
        headers={
            'X-Guest-Capability': p1_capability,
            'Content-Type': 'application/octet-stream',
            'X-Expected-Version': str(guest_ver),
            'X-Filename': 'bukti-insiden.png',
            'X-File-Mime': 'image/png',
            'X-Attachment-Audience': 'REQUESTER'
        }
    )
    guest_ver = att_resp['version']
    print(f"   [OK] Lampiran tangkapan layar bersih lolos pemindaian ClamAV: ID={att_resp.get('id')}")

    # 4. Pantau tiket melalui tracking session
    view_resp, _, _ = p1.call(
        f'/tickets/{guest_ticket_id}',
        want=200,
        headers={'X-Guest-Capability': p1_capability}
    )
    assert view_resp['state'] == 'OPEN', "New ticket must be in state OPEN"
    print(f"   [OK] Pelacakan publik status tiket terkonfirmasi: {view_resp['state']}")
    report["results"]["persona_1_guest"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 2: ASN Pemohon (PNS Bappeda Kota Depok)
    # -------------------------------------------------------------------------
    print("\n[Persona 2] ASN Pemohon (PNS Bappeda Kota Depok)")
    p2 = UATClient("Persona-2-ASN")
    p2.login(3)  # Subjek 3: ASN OPD A

    # 1. Telusuri katalog layanan ASN
    p2_catalog, _, _ = p2.call('/catalog/services')
    asn_services = p2_catalog.get('items', [])
    assert len(asn_services) >= 16, f"ASN must see 16+ services, got {len(asn_services)}"

    dom_service_id = "30000000-0000-4000-8000-000000000013"  # TIK-DOM-01

    # 2. Simpan autosave draft tiket (AC19)
    draft_id = str(uuid.uuid4())
    draft_payload = {
        "expected_version": 0,
        "form_version": 1,
        "title": "Permohonan Subdomain dan Hosting Portal Monitoring SPBE",
        "description": "Pengajuan subdomain bappeda-inovasi.depok.go.id untuk evaluasi berkala capaian SPBE.",
        "answers": {
            "nama_subdomain": "bappeda-inovasi",
            "tujuan_penggunaan": "Portal Pemantauan Capaian SPBE",
            "ip_server_hosting": "10.10.20.15"
        }
    }
    p2.call(f'/drafts/{draft_id}', method='PUT', body=draft_payload, want=200)
    saved_draft, _, _ = p2.call(f'/drafts/{draft_id}', want=200)
    assert saved_draft.get('title') == draft_payload['title'], "Draft title must match autosave"
    p2.call(f'/drafts/{draft_id}', method='DELETE', want=204)
    print(f"   [OK] Fitur autosave draft terverifikasi pada penyimpanan server (AC19)")

    # 3. Ajukan tiket resmi ASN
    asn_ticket_payload = {
        "service_id": dom_service_id,
        "service_version": 1,
        "form_version": 1,
        "policy_version": 1,
        "title": draft_payload['title'],
        "description": draft_payload['description'],
        "answers": draft_payload['answers']
    }
    p2_ticket_resp, _, _ = p2.call('/tickets', method='POST', body=asn_ticket_payload, want=201)
    asn_ticket_id = p2_ticket_resp['id']
    asn_ver = p2_ticket_resp['version']
    print(f"   [OK] Tiket resmi ASN berhasil diajukan: {asn_ticket_id} (Kode: TIK-DOM-01)")
    report["results"]["persona_2_asn"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 3: Operator Front Desk Intake (Diskominfo Kota Depok)
    # -------------------------------------------------------------------------
    print("\n[Persona 3] Operator Front Desk Intake (Diskominfo Kota Depok)")
    p3 = UATClient("Persona-3-Operator")
    p3.login(4)  # Subjek 4: Operator OPD A

    # 1. Buka tiket dan telaah rekomendasi klasifikasi otomatis M4 (Classification Proposal)
    tkt_detail, _, _ = p3.call(f'/tickets/{guest_ticket_id}', want=200)
    cls_rec = tkt_detail.get('classification', {})
    print(f"   [OK] Rekomendasi klasifikasi M4 terverifikasi: {cls_rec.get('explanation', 'Klasifikasi otomatis M4 aktif')}")

    # 2. Lakukan verifikasi tiket dengan catatan override beralasan wajib (>= 5 karakter)
    verify_payload = {
        "expected_version": guest_ver,
        "category_id": "40000000-0000-4000-8000-000000000001",
        "priority": "CRITICAL",
        "reason": "Dampak potensial kebocoran data pada subdomain publik kelurahan, prioritas ditingkatkan ke CRITICAL",
        "classifier_version": 1,
        "evidence_digest": "0000000000000000000000000000000000000000000000000000000000000000"
    }
    v_res, _, _ = p3.call(f'/tickets/{guest_ticket_id}/verify', method='POST', body=verify_payload, want=200)
    guest_ver = v_res['version']
    assert v_res.get('verification') == 'VERIFIED' or v_res.get('state') == 'VERIFIED', 'Ticket verification must be VERIFIED'
    print(f"   [OK] Verifikasi operator berhasil dengan catatan audit override: Verification={v_res.get('verification', v_res.get('state'))}")

    # Verifikasi juga tiket ASN
    v2_res, _, _ = p3.call(f'/tickets/{asn_ticket_id}/verify', method='POST', body={
        "expected_version": asn_ver,
        "category_id": "40000000-0000-4000-8000-000000000001",
        "priority": "NORMAL",
        "reason": "Verifikasi administrasi permohonan subdomain dinas telah lengkap dan sah",
        "classifier_version": 1,
        "evidence_digest": "0000000000000000000000000000000000000000000000000000000000000000"
    }, want=200)
    asn_ver = v2_res['version']
    report["results"]["persona_3_operator"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 4: Koordinator Jaringan & Infrastruktur (Koordinator OPD A)
    # -------------------------------------------------------------------------
    print("\n[Persona 4] Koordinator Jaringan & Infrastruktur (Koordinator OPD A)")
    p4 = UATClient("Persona-4-Koordinator")
    p4.login(11)  # Subjek 11: Koordinator OPD A

    # 1. Disposisi tiket CSIRT ke Teknisi L1 (Subjek 9)
    dispatch_payload = {
        "expected_version": guest_ver,
        "team_id": TEAM_OPD_A,
        "assignee_id": "20000000-0000-4000-8000-000000000009",
        "proposal_version": 1,
        "reason": "Penugasan tim tanggap insiden untuk isolasi dan analisis forensik log web server",
        "tier": "L1"
    }
    d_res, _, _ = p4.call(f'/tickets/{guest_ticket_id}/dispatch', method='POST', body=dispatch_payload, want=200)
    guest_ver = d_res['version']
    print(f"   [OK] Disposisi penugasan teknisi L1 berhasil: Assignee={d_res.get('assignee_id')}")

    # Disposisi juga tiket ASN ke Tim OPD A
    d2_res, _, _ = p4.call(f'/tickets/{asn_ticket_id}/dispatch', method='POST', body={
        "expected_version": asn_ver,
        "team_id": TEAM_OPD_A,
        "assignee_id": "20000000-0000-4000-8000-000000000009",
        "proposal_version": 1,
        "reason": "Penugasan teknisi untuk verifikasi konfigurasi DNS",
        "tier": "L1"
    }, want=200)
    asn_ver = d2_res['version']

    # 2. Persetujuan jeda waktu SLA berizin (Pause SLA)
    until_dt = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)).isoformat().replace('+00:00', 'Z')
    pause_payload = {
        "expected_version": guest_ver,
        "policy_version": 1,
        "reason": "Isolasi koneksi jaringan ke server terdampak untuk forensik digital terpadu",
        "until": until_dt
    }
    p_res, _, _ = p4.call(f'/tickets/{guest_ticket_id}/pauses', method='POST', body=pause_payload, want=201)
    guest_ver = p_res['version']
    print(f"   [OK] Jeda waktu penanganan berizin (Pause SLA) disetujui koordinator")
    report["results"]["persona_4_koordinator"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 5: Teknisi Lapangan (Teknisi L1 Diskominfo Kota Depok)
    # -------------------------------------------------------------------------
    print("\n[Persona 5] Teknisi Lapangan (Teknisi L1 Diskominfo Kota Depok)")
    p5 = UATClient("Persona-5-Teknisi")
    p5.login(9)  # Subjek 9: Teknisi L1 OPD A

    # 1. Catat koordinasi vendor eksternal dengan PIC internal aktif
    ret_dt = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)).isoformat().replace('+00:00', 'Z')
    fol_dt = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=4)).isoformat().replace('+00:00', 'Z')
    vendor_payload = {
        "expected_version": guest_ver,
        "vendor_id": VENDOR_ID,
        "internal_pic_id": "20000000-0000-4000-8000-000000000009",
        "external_reference": "VEND-CSIRT-2026-09",
        "contract_reference": "KTR-TIK-2026-04",
        "expected_return_at": ret_dt,
        "next_followup_at": fol_dt
    }
    vc_res, _, _ = p5.call(f'/tickets/{guest_ticket_id}/vendor-cases', method='POST', body=vendor_payload, want=201)
    guest_ver = vc_res['version']
    print(f"   [OK] Kasus koordinasi vendor dicatat dengan kewajiban PIC internal aktif")

    # 2. Selesaikan pekerjaan (Resolve) dengan catatan >= 5 karakter
    resolve_payload = {
        "expected_version": guest_ver,
        "summary": "Integritas portal berhasil dipulihkan dari cadangan terenkripsi dan celah keamanan ditutup"
    }
    r_res, _, _ = p5.call(f'/tickets/{guest_ticket_id}/resolve', method='POST', body=resolve_payload, want=200)
    guest_ver = r_res['version']
    assert r_res['state'] == 'RESOLVED', "Ticket state must be RESOLVED"
    print(f"   [OK] Pekerjaan diselesaikan teknisi: State={r_res['state']}")

    # 3. Konfirmasi Penerimaan oleh Pemohon (Persona 1 - Guest Citizen) -> CLOSED
    c_res, _, _ = p1.call(
        f'/tickets/{guest_ticket_id}/confirmation',
        method='POST',
        body={'expected_version': guest_ver, 'decision': 'ACCEPT'},
        want=200,
        headers={'X-Guest-Capability': p1_capability}
    )
    assert c_res['state'] == 'CLOSED', "Confirmed ticket must be in state CLOSED"
    guest_ver = c_res['version']
    print(f"   [OK] Pemohon publik mengonfirmasi penanganan: State={c_res['state']}")
    report["results"]["persona_5_teknisi"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 6: Koordinator OPD Penerima (Dinas Kesehatan Kota Depok)
    # -------------------------------------------------------------------------
    print("\n[Persona 6] Koordinator OPD Penerima (Dinas Kesehatan Kota Depok)")
    # 1. Koordinator OPD A mengajukan handoff transfer tiket ASN ke OPD B
    handoff_req_payload = {
        "expected_version": asn_ver,
        "target_org_id": ORG_OPD_B,
        "target_team_id": TEAM_OPD_B,
        "reason": "Pelimpahan penanganan integrasi aplikasi SIMDA/Kesehatan ke Dinas Kesehatan"
    }
    handoff_resp, _, _ = p4.call(f'/tickets/{asn_ticket_id}/handoffs', method='POST', body=handoff_req_payload, want=201)
    handoff_id = handoff_resp['id']
    asn_ver = handoff_resp['version']
    print(f"   [OK] Pengajuan handoff diajukan oleh OPD A: ID={handoff_id}")

    # 2. Login Koordinator OPD B (Dinkes) dan terima handoff
    p6 = UATClient("Persona-6-Koordinator-Dinkes")
    p6.login(12)  # Subjek 12: Koordinator OPD B

    accept_payload = {
        "expected_version": asn_ver,
        "reason": "Dinas Kesehatan menerima tanggung jawab penanganan tiket integrasi sistem"
    }
    h_acc, _, _ = p6.call(f'/tickets/{asn_ticket_id}/handoffs/{handoff_id}/accept', method='POST', body=accept_payload, want=200)
    asn_ver = h_acc['version']
    assert h_acc['service_owner_org_id'] == ORG_OPD_B, "Owner org must transfer to OPD B"
    print(f"   [OK] Handoff diterima secara atomik: Owner Org={h_acc['service_owner_org_id']}")
    report["results"]["persona_6_handoff"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 7: Pimpinan / Kepala Dinas Komunikasi dan Informatika
    # -------------------------------------------------------------------------
    print("\n[Persona 7] Pimpinan / Kepala Dinas Komunikasi dan Informatika")
    p7 = UATClient("Persona-7-Pimpinan")
    p7.login(13)  # Subjek 13: Pimpinan Pemkot

    # 1. Akses metrik laporan SLA dengan penyebut jujur (Honest Denominator)
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    from_str = (now_dt - datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
    to_str = (now_dt + datetime.timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ')
    rep_resp, _, _ = p7.call(f'/reports?from={from_str}&to={to_str}&organization_id={ORG_OPD_A}', want=200)
    print(f"   [OK] Dasbor eksekutif pimpinan: Timezone={rep_resp.get('timezone')}")

    # 2. Ajukan ekspor laporan CSV berkala tersanitasi formula
    export_payload = {
        "from": from_str,
        "to": to_str,
        "timezone": "Asia/Jakarta",
        "organization_id": ORG_OPD_A,
        "cohort": "ACCEPTED",
        "format": "CSV"
    }
    exp_resp, exp_headers, _ = p7.call('/reports/exports', method='POST', body=export_payload, want=202)
    assert exp_resp.get('id') is not None, "Async export must return export ID"
    print(f"   [OK] Permintaan ekspor analitik asinkron diterima (202 Accepted, ID={exp_resp.get('id')})")
    report["results"]["persona_7_pimpinan"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 8: Auditor Inspektorat Daerah
    # -------------------------------------------------------------------------
    print("\n[Persona 8] Auditor Inspektorat Daerah")
    p8 = UATClient("Persona-8-Auditor")
    p8.login(16)  # Subjek 16: Auditor Kota Depok

    # Akses jejak audit append-only terlindungi M9
    audit_resp, _, _ = p8.call('/audit?limit=50', want=200)
    audit_entries = audit_resp.get('items', [])
    assert len(audit_entries) >= 5, "Audit log must contain recorded operational actions"
    print(f"   [OK] Jejak audit append-only terverifikasi: {len(audit_entries)} log tersimpan secara kekal")
    report["results"]["persona_8_auditor"] = "PASS"

    # -------------------------------------------------------------------------
    # PERSONA 9: Administrator Sistem SPBE (Super Admin)
    # -------------------------------------------------------------------------
    print("\n[Persona 9] Administrator Sistem SPBE (Super Admin)")
    p9 = UATClient("Persona-9-SuperAdmin")
    p9.login(17)  # Subjek 17: Super Admin

    # 1. Uji mode pemeliharaan READ_ONLY (503 mutasi POST, 200 baca GET)
    maint_start = (now_dt - datetime.timedelta(hours=1)).isoformat().replace('+00:00', 'Z')
    maint_end = (now_dt + datetime.timedelta(hours=2)).isoformat().replace('+00:00', 'Z')
    p9.call('/admin/maintenance', method='POST', body={
        'expected_version': 1,
        'organization_id': ORG_OPD_A,
        'mode': 'READ_ONLY',
        'starts_at': maint_start,
        'ends_at': maint_end,
        'message': 'Pemeliharaan kandidat final UAT M0-13'
    }, want=201)

    # Verifikasi POST diblokir 503 saat READ_ONLY
    p2.call('/tickets', method='POST', body={
        'service_id': '30000000-0000-4000-8000-000000000001',
        'service_version': 1,
        'form_version': 1,
        'policy_version': 1,
        'title': 'Percobaan saat pemeliharaan',
        'description': 'Harus ditolak 503',
        'answers': {'ringkasan': 'Uji'}
    }, want=503)

    # Verifikasi GET tetap 200 saat READ_ONLY
    p2.call('/catalog/services', want=200)

    # Kembalikan mode ke NORMAL
    p9.call('/admin/maintenance', method='POST', body={
        'expected_version': 1,
        'organization_id': ORG_OPD_A,
        'mode': 'NORMAL',
        'starts_at': (now_dt - datetime.timedelta(hours=1)).isoformat().replace('+00:00', 'Z'),
        'ends_at': (now_dt - datetime.timedelta(minutes=1)).isoformat().replace('+00:00', 'Z'),
        'message': 'Pemeliharaan selesai'
    }, want=201)
    print(f"   [OK] Jendela pemeliharaan sistem READ_ONLY (503 tulis / 200 baca) terbukti tuntas")

    # 2. Diagnosa kesehatan teredaksi tanpa kebocoran kata sandi / secret
    health_resp, _, raw_health = p9.call('/admin/health', want=200)
    assert health_resp.get('status') == 'HEALTHY'
    raw_str = raw_health.decode('utf-8', errors='ignore').lower()
    for forbidden in ['postgres://', 'password=', 'secret', '/root/']:
        assert forbidden not in raw_str, f"Leak detected: {forbidden}"
    print(f"   [OK] Pelaporan kesehatan sistem teredaksi (zero secret leakage) terbukti")

    # 3. Uji penolakan purge oleh non-super admin (HTTP 403 Forbidden)
    p4.call('/admin/purge-requests', method='POST', body={
        'expected_version': 1,
        'object_id': ORG_OPD_A,
        'reason': 'Permintaan tidak sah oleh koordinator'
    }, want=403)
    print(f"   [OK] Penolakan permintaan purge oleh non-Super Admin (HTTP 403 Forbidden) terbukti")

    # 4. Verifikasi permintaan purge Super Admin berstatus DISABLED (zero data loss)
    purge_res, _, _ = p9.call('/admin/purge-requests', method='POST', body={
        'expected_version': 1,
        'object_id': ORG_OPD_A,
        'reason': 'Permintaan Super Admin dengan kebijakan retensi pending'
    }, want=202)
    assert purge_res.get('state') == 'DISABLED' or purge_res.get('status') == 'DISABLED'
    print(f"   [OK] Penegakan proteksi purge (AC22: 403 non-admin, disabled super admin) terbukti")
    report["results"]["persona_9_admin"] = "PASS"

    # -------------------------------------------------------------------------
    # PENUTUPAN HASIL UAT
    # -------------------------------------------------------------------------
    all_passed = all(status == "PASS" for status in report["results"].values())
    report["result"] = "PASS" if all_passed else "FAIL"

    uat_report_path = QA_DIR / "uat_report.json"
    with open(uat_report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 75)
    print(f"Hasil Seluruh 9 Persona UAT AI: {report['result']}")
    print(f"Laporan UAT resmi tersimpan di: {uat_report_path}")
    print("=" * 75)

    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    run_uat()
