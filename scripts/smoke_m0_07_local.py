"""Smoke test M0-07 on live local HTTP/API (loopback lab 18090)."""
import argparse
import datetime
import http.cookiejar
import json
from pathlib import Path
import time
import urllib.request
import urllib.error
import uuid

BASE = 'http://127.0.0.1:18090'


class Client:
    next_request = 0.0

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self):
        return next((c.value for c in self.jar if c.name == 'helpdesk_csrf'), None) or next((c.value for c in self.jar if c.name == 'helpdesk_tracking_csrf'), '')

    def call(self, path, method='GET', body=None, want=200, key=None, token=None, headers=None):
        time.sleep(max(0.0, Client.next_request - time.monotonic()))
        Client.next_request = time.monotonic() + 0.12
        data = None if body is None else json.dumps(body).encode()
        head = {'Origin': BASE}
        if method != 'GET':
            head.update({
                'Content-Type': 'application/json',
                'X-CSRF-Token': self.csrf() if token is None else token,
                'Idempotency-Key': key or str(uuid.uuid4())
            })
        head.update(headers or {})
        req = urllib.request.Request(BASE + '/api/v1' + path, data=data, headers=head, method=method)
        try:
            res = self.http.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            res = error
        with res:
            raw = res.read()
            if res.status != want:
                raise RuntimeError(f'{method} {path}: HTTP {res.status}, expected {want}: {raw.decode("utf-8", errors="ignore")}')
            resp_headers = dict(res.headers)
            body_json = json.loads(raw) if raw else {}
            return body_json, resp_headers

    def bootstrap(self):
        value, _ = self.call('/auth/bootstrap')
        assert value['mode'] == 'SYNTHETIC_LAB'
        return value['csrf_token']

    def login(self, index):
        nonce = self.bootstrap()
        self.call('/auth/sessions', 'POST', {'lab_subject_id': f'20000000-0000-4000-8000-{index:012d}', 'csrf_token': nonce}, 201, token=nonce)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-lab-writes', action='store_true')
    args = parser.parse_args()
    if not args.allow_lab_writes:
        raise SystemExit('NOT_RUN: requires --allow-lab-writes; creates synthetic tickets without deleting existing data')

    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'live loopback synthetic HTTP/API M0-07 vendor case, pause SLA, cross-OPD handoff, revocation, and escalation',
        'command': 'python scripts/smoke_m0_07_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name, detail=''):
        report['checks'].append({'name': name, 'detail': detail, 'result': 'PASS'})

    try:
        public = Client()
        operator = Client()
        tech1 = Client()
        coordA = Client()
        coordB = Client()
        techOPDB = Client()

        public.login(1)
        operator.login(4)
        techOPDB.login(7)
        tech1.login(9)
        coordA.login(11)
        coordB.login(12)

        # 1. Buat tiket sintetis
        service_id = '30000000-0000-4000-8000-000000000001'
        ticket_data = {
            'service_id': service_id,
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Uji Smoke M0-07 ' + uuid.uuid4().hex[:8],
            'description': 'Fixture pengujian smoke M0-07 vendor, jeda SLA, handoff, dan eskalasi.',
            'answers': {'ringkasan': 'Kendala koneksi VPN antar-OPD'}
        }
        res, _ = public.call('/tickets', 'POST', ticket_data, 201)
        ticket_id = res['id']
        version = res['version']
        passed('ticket_created', f'id={ticket_id}')

        # 2. Operator Verifikasi & Dispatch ke Teknisi OPD A (Subjek 9)
        team_id = '50000000-0000-4000-8000-000000000001'
        tech_id = '20000000-0000-4000-8000-000000000009'
        ver_res, _ = operator.call(f'/tickets/{ticket_id}/verify', 'POST', {
            'expected_version': version,
            'category_id': '50000000-0000-4000-8000-000000000001',
            'priority': 'NORMAL',
            'reason': 'Laporan terverifikasi untuk penanganan teknis.',
            'classifier_version': 1,
            'evidence_digest': '0000000000000000000000000000000000000000000000000000000000000000'
        }, 200)
        version = ver_res['version']

        disp_res, _ = operator.call(f'/tickets/{ticket_id}/dispatch', 'POST', {
            'expected_version': version,
            'team_id': team_id,
            'assignee_id': tech_id,
            'proposal_version': 1,
            'reason': 'Disposisi teknisi jaringan OPD A',
            'tier': 'L1'
        }, 200)
        version = disp_res['version']
        passed('verified_and_dispatched')

        # 3. Teknisi mencatat kasus vendor dengan PIC internal aktif
        vend_res, _ = tech1.call(f'/tickets/{ticket_id}/vendor-cases', 'POST', {
            'expected_version': version,
            'vendor_id': '00000000-0000-4000-8000-000000000099',
            'internal_pic_id': tech_id,
            'reference_no': 'SMOKE-VEND-99',
            'summary': 'Koordinasi penanganan fiber optik terputus dengan vendor penyedia'
        }, 201)
        version = vend_res['version']
        passed('vendor_case_recorded', f'version={version}')

        # 4. Koordinator OPD A menyetujui jeda waktu layanan (Pause SLA)
        pause_res, _ = coordA.call(f'/tickets/{ticket_id}/pauses', 'POST', {
            'expected_version': version,
            'reason': 'Menunggu kedatangan teknisi vendor penyedia',
            'duration_minutes': 60
        }, 201)
        version = pause_res['version']
        passed('authorized_pause_approved')

        # 5. Periksa status SLA gross vs net
        sla_data, _ = public.call(f'/tickets/{ticket_id}/sla', 'GET')
        assert 'gross_seconds' in sla_data and 'net_seconds' in sla_data, 'missing SLA fields'
        passed('sla_gross_vs_net_checked', f'gross={sla_data["gross_seconds"]} net={sla_data["net_seconds"]}')

        # 6. Koordinator OPD A mengajukan handoff ke OPD B
        org2_id = '10000000-0000-4000-8000-000000000002'
        team2_id = '50000000-0000-4000-8000-000000000002'
        handoff_res, _ = coordA.call(f'/tickets/{ticket_id}/handoffs', 'POST', {
            'expected_version': version,
            'target_org_id': org2_id,
            'target_team_id': team2_id,
            'reason': 'Pelimpahan wewenang penanganan server aplikasi Bappeda'
        }, 201)
        handoff_id = handoff_res['handoff_id']
        version = handoff_res['version']
        passed('handoff_requested', f'handoff_id={handoff_id}')

        # 7. Koordinator OPD B menerima handoff secara resmi
        acc_res, _ = coordB.call(f'/tickets/{ticket_id}/handoffs/{handoff_id}/accept', 'POST', {
            'expected_version': version,
            'reason': 'Handoff diterima resmi oleh koordinator Bappeda'
        }, 200)
        version = acc_res['version']
        passed('handoff_accepted')

        # 8. Verifikasi pencabutan akses teknisi lama (OPD A)
        try:
            tech1.call(f'/tickets/{ticket_id}', 'GET')
            raise RuntimeError('Tech OPD A still has access to handed-off ticket!')
        except RuntimeError as e:
            if 'HTTP 404' in str(e) or 'HTTP 403' in str(e):
                passed('origin_technician_access_revoked')
            else:
                raise

        # 9. Verifikasi pembacaan tiket oleh Koordinator OPD B (pemilik baru)
        tkt_opdb, _ = coordB.call(f'/tickets/{ticket_id}', 'GET')
        assert tkt_opdb['service_owner_org_id'] == org2_id, 'owner not updated'
        assert tkt_opdb.get('assignee_id') is None, 'assignee not revoked'
        passed('target_opd_ownership_verified')

        # 10. Pengajuan eskalasi berjenjang (respons 202 Accepted & Header Location)
        esc_res, esc_headers = coordB.call(f'/tickets/{ticket_id}/escalations', 'POST', {
            'expected_version': version,
            'level': 'COORDINATOR',
            'reason': 'Eskalasi koordinasi tingkat OPD antar pimpinan'
        }, 202)
        loc = esc_headers.get('Location') or esc_headers.get('location') or ''
        assert '/api/v1/operations/' in loc, f'Invalid Location header: {loc}'
        op_id = esc_res['id']
        passed('escalation_async_accepted_202', f'operation_id={op_id} location={loc}')

        # 11. Pembacaan status operasi asinkron
        op_data, _ = coordB.call(f'/operations/{op_id}', 'GET', want=200)
        assert op_data['id'] == op_id, 'Operation ID mismatch'
        passed('async_operation_read_verified')

        report['result'] = 'PASS'
        report['summary'] = 'All 11 M0-07 live loopback checks passed successfully.'
    except Exception as error:
        report['result'] = 'FAIL'
        report['error'] = str(error)
        raise
    finally:
        out_file = Path('qa/m0-07/smoke_local.json')
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"M0-07 smoke local report written to {out_file} (result: {report['result']})")


if __name__ == '__main__':
    main()
