"""Smoke test M0-05 on live local HTTP/API (loopback lab 18090)."""
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
        'scope': 'live loopback synthetic HTTP/API M0-05 verification and dispatch',
        'command': 'python scripts/smoke_m0_05_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name):
        report['checks'].append({'name': name, 'result': 'PASS'})

    try:
        public, operator, tech1, tech2 = Client(), Client(), Client(), Client()
        public.login(1)
        operator.login(4)
        tech1.login(9)
        tech2.login(10)

        # 1. Buat tiket sintetis
        service_id = '30000000-0000-4000-8000-000000000001'
        ticket_data = {
            'service_id': service_id,
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Uji Smoke M0-05 ' + uuid.uuid4().hex[:8],
            'description': 'Fixture pengujian smoke M0-05 pada loopback lokal.',
            'answers': {'ringkasan': 'Printer lab offline'}
        }
        res = public.call('/tickets', 'POST', ticket_data, 201)
        ticket_id = res['id']
        passed('authenticated_ticket_created')

        # 2. AC04 Guard: Dispatch sebelum verifikasi ditolak 409 TICKET_NOT_VERIFIED
        team_id = '50000000-0000-4000-8000-000000000001'
        tech1_id = '20000000-0000-4000-8000-000000000009'
        tech2_id = '20000000-0000-4000-8000-000000000010'

        operator.call(f'/tickets/{ticket_id}/dispatch', 'POST', {
            'expected_version': 1,
            'team_id': team_id,
            'assignee_id': tech1_id,
            'proposal_version': 1,
            'reason': 'Coba dispatch langsung'
        }, 409)
        passed('AC04_guard_unverified_dispatch_rejected_409')

        # 3. AC04 / AC13: Operator verifikasi dengan override beralasan
        verify_body = {
            'expected_version': 1,
            'category_id': '50000000-0000-4000-8000-000000000002',
            'priority': 'HIGH',
            'classifier_version': 1,
            'evidence_digest': '0000000000000000000000000000000000000000000000000000000000000001',
            'reason': 'Kategori dialihkan ke infrastruktur fisik laboratorium'
        }
        v_res = operator.call(f'/tickets/{ticket_id}/verify', 'POST', verify_body, 200)
        assert v_res['verification'] == 'VERIFIED'
        passed('AC04_AC13_operator_verified_with_override')

        # 4. AC13: Dispatch ke Teknisi L1 (Subjek 9)
        dispatch_body = {
            'expected_version': 2,
            'team_id': team_id,
            'assignee_id': tech1_id,
            'tier': 'L1',
            'proposal_version': 1,
            'reason': 'Disposisi penanganan teknisi L1'
        }
        d_res = operator.call(f'/tickets/{ticket_id}/dispatch', 'POST', dispatch_body, 200)
        assert d_res['state'] == 'ASSIGNED'
        passed('AC13_dispatched_to_l1_technician')

        # 5. Antrean teknisi L1 memuat tiket ini
        tasks = tech1.call('/technician/queue/my-tasks', 'GET', want=200)
        task_ids = [it['id'] for it in tasks.get('items', [])]
        assert ticket_id in task_ids
        passed('technician_queue_contains_assigned_ticket')

        # 6. Antrean teknisi L2 TIDAK memuat tiket ini
        tasks2 = tech2.call('/technician/queue/my-tasks', 'GET', want=200)
        task2_ids = [it['id'] for it in tasks2.get('items', [])]
        assert ticket_id not in task2_ids
        passed('technician_queue_isolation')

        # 7. CAS Guard: Dispatch dengan versi usang (expected_version: 2 padahal sudah versi 3) ditolak 409
        operator.call(f'/tickets/{ticket_id}/dispatch', 'POST', {
            'expected_version': 2,
            'team_id': team_id,
            'assignee_id': tech2_id,
            'tier': 'L2',
            'proposal_version': 1,
            'reason': 'Coba dispatch versi usang'
        }, 409)
        passed('AC13_CAS_stale_version_rejected_409')

        report['result'] = 'PASS'
        print('PASS M0-05 live local HTTP/API smoke checks (all 7 assertions passed)')
    except Exception as e:
        report.update(result='FAIL', error=str(e))
        print('FAIL M0-05 live local HTTP/API smoke checks:', e)

    dest = Path('qa/m0-05/smoke_local.json')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
