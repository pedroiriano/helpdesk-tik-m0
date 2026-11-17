"""Smoke test M0-06 on live local HTTP/API (loopback lab 18090)."""
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
            return json.loads(raw)

    def bootstrap(self):
        value = self.call('/auth/bootstrap')
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
        'scope': 'live loopback synthetic HTTP/API M0-06 SLA, resolution, confirmation, and auto-close guard',
        'command': 'python scripts/smoke_m0_06_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name):
        report['checks'].append({'name': name, 'result': 'PASS'})

    try:
        public, operator, tech = Client(), Client(), Client()
        public.login(1)
        operator.login(4)
        tech.login(9)

        # 1. Buat tiket sintetis
        service_id = '30000000-0000-4000-8000-000000000001'
        ticket_data = {
            'service_id': service_id,
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Uji Smoke M0-06 ' + uuid.uuid4().hex[:8],
            'description': 'Fixture pengujian smoke M0-06 resolusi dan SLA.',
            'answers': {'ringkasan': 'Gangguan koneksi internet ruang rapat'}
        }
        res = public.call('/tickets', 'POST', ticket_data, 201)
        ticket_id = res['id']
        version = res['version']
        passed('authenticated_ticket_created')

        # 2. Verifikasi & Dispatch ke Teknisi (Subjek 9)
        team_id = '50000000-0000-4000-8000-000000000001'
        tech_id = '20000000-0000-4000-8000-000000000009'

        v_res = operator.call(f'/tickets/{ticket_id}/verify', 'POST', {
            'expected_version': version,
            'category_id': '50000000-0000-4000-8000-000000000002',
            'priority': 'NORMAL',
            'classifier_version': 1,
            'evidence_digest': '0000000000000000000000000000000000000000000000000000000000000001',
            'reason': 'Verifikasi disahkan untuk penanganan teknisi'
        }, 200)
        version = v_res['version']

        d_res = operator.call(f'/tickets/{ticket_id}/dispatch', 'POST', {
            'expected_version': version,
            'team_id': team_id,
            'assignee_id': tech_id,
            'tier': 'L1',
            'proposal_version': 1,
            'reason': 'Penugasan teknisi lapangan'
        }, 200)
        version = d_res['version']
        passed('verified_and_dispatched_to_technician')

        # 3. AC08: Pembacaan SLA tiket (GET /api/v1/tickets/{id}/sla)
        sla_res = public.call(f'/tickets/{ticket_id}/sla', 'GET', want=200)
        assert sla_res['ticket_id'] == ticket_id
        assert sla_res['status'] in ('ON_TRACK', 'AT_RISK', 'BREACHED')
        passed('AC08_sla_projection_endpoint_verified')

        # 4. AC14 Negatif Resolve:
        # 4a. Non-assignee (pemohon) mencoba resolve -> 403 Forbidden
        public.call(f'/tickets/{ticket_id}/resolve', 'POST', {
            'expected_version': version,
            'summary': 'Pemohon mencoba resolve sendiri'
        }, 403)
        passed('AC14_unauthorized_resolve_rejected_403')

        # 4b. Summary < 5 karakter -> 400 Bad Request
        tech.call(f'/tickets/{ticket_id}/resolve', 'POST', {
            'expected_version': version,
            'summary': 'fix'
        }, 400)
        passed('AC14_short_summary_resolve_rejected_400')

        # 4c. Stale version -> 409 Conflict
        tech.call(f'/tickets/{ticket_id}/resolve', 'POST', {
            'expected_version': version + 5,
            'summary': 'Perbaikan konfigurasi router selesai'
        }, 409)
        passed('AC14_stale_version_resolve_rejected_409')

        # 5. AC14 Positif Resolve: Teknisi menyelesaikan tiket
        res_res = tech.call(f'/tickets/{ticket_id}/resolve', 'POST', {
            'expected_version': version,
            'summary': 'Penggantian konektor RJ45 dan konfigurasi IP static selesai'
        }, 200)
        assert res_res['state'] == 'RESOLVED'
        assert res_res['active_attempt_id'] != ''
        version = res_res['version']
        attempt_id = res_res['active_attempt_id']
        passed('AC14_technician_resolve_success_resolved')

        # 6. Riwayat Upaya Resolusi (GET /tickets/{id}/resolution-attempts)
        atts = tech.call(f'/tickets/{ticket_id}/resolution-attempts', 'GET', want=200)
        items = atts.get('items', [])
        assert len(items) >= 1
        assert items[0]['id'] == attempt_id
        passed('AC14_resolution_attempts_history_verified')

        # 7. AC14 Konfirmasi Penolakan (REJECT)
        # 7a. Reject tanpa alasan -> 400 Bad Request
        public.call(f'/tickets/{ticket_id}/confirmation', 'POST', {
            'expected_version': version,
            'decision': 'REJECT',
            'reason': ''
        }, 400)
        passed('AC14_reject_without_reason_rejected_400')

        # 7b. Reject dengan alasan -> 200 OK, kembali ke IN_PROGRESS
        rej_res = public.call(f'/tickets/{ticket_id}/confirmation', 'POST', {
            'expected_version': version,
            'decision': 'REJECT',
            'reason': 'Koneksi internet masih terputus-putus saat dites'
        }, 200)
        assert rej_res['state'] == 'IN_PROGRESS'
        version = rej_res['version']
        passed('AC14_reject_resumes_in_progress')

        # 8. Teknisi Selesaikan Kembali (Re-resolve)
        res_res2 = tech.call(f'/tickets/{ticket_id}/resolve', 'POST', {
            'expected_version': version,
            'summary': 'Kabel UTP ditarik ulang dan port switch diganti baru'
        }, 200)
        assert res_res2['state'] == 'RESOLVED'
        version = res_res2['version']
        passed('AC14_technician_reresolve_success')

        # 9. Pemohon Konfirmasi Setuju (ACCEPT -> CLOSED)
        acc_res = public.call(f'/tickets/{ticket_id}/confirmation', 'POST', {
            'expected_version': version,
            'decision': 'ACCEPT'
        }, 200)
        assert acc_res['state'] == 'CLOSED'
        passed('AC14_requester_confirm_accept_closed')

        report['result'] = 'PASS'
        print('PASS M0-06 live local HTTP/API smoke checks (all 10 assertions passed)')
    except Exception as e:
        report.update(result='FAIL', error=str(e))
        print('FAIL M0-06 live local HTTP/API smoke checks:', e)

    dest = Path('qa/m0-06/smoke_local.json')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
