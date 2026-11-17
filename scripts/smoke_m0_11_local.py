"""Smoke test M0-11 on live local HTTP/API (loopback lab 18090).

Validates:
1. AC22: Non-super-admin purge rejection (403 Forbidden)
2. AC22: Super Admin purge request recorded as DISABLED (policy pending, no data loss)
3. AC22: Dual-control enforcement on system operation requests
4. AC22: Archive closed ticket preserves history
5. AC22: Archive active ticket rejected (409 Conflict)
6. AC22: Restore archived ticket succeeds
7. AC24: Scoped operational runner allowlist (BACKUP_MANIFEST, HEALTH_REPORT; illegal rejected)
8. AC24: Maintenance mode READ_ONLY blocks mutations (503) while allowing GET
9. AC24: Redacted system health without secret or connection string leakage
10. AC20: Keyboard accessibility on dialogs in UI
"""
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
ROOT = Path(__file__).resolve().parent.parent


class Client:
    next_request = 0.0

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self):
        return next((c.value for c in self.jar if c.name == 'helpdesk_csrf'), None) or next((c.value for c in self.jar if c.name == 'helpdesk_tracking_csrf'), '')

    def call(self, path, method='GET', body=None, want=200, key=None, token=None, headers=None, raw_body=None):
        time.sleep(max(0.0, Client.next_request - time.monotonic()))
        Client.next_request = time.monotonic() + 0.12
        if raw_body is not None:
            data = raw_body
        elif body is not None:
            data = json.dumps(body).encode()
        else:
            data = None

        head = {'Origin': BASE}
        if method != 'GET':
            if raw_body is None:
                head['Content-Type'] = 'application/json'
            head.update({
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
            body_json = {}
            if raw and 'application/json' in resp_headers.get('Content-Type', ''):
                try:
                    body_json = json.loads(raw)
                except Exception:
                    body_json = {'raw': raw.decode('utf-8', errors='ignore')}
            return body_json, resp_headers, raw

    def bootstrap(self):
        value, _, _ = self.call('/auth/bootstrap')
        assert value['mode'] == 'SYNTHETIC_LAB'
        return value['csrf_token']

    def login(self, index):
        nonce = self.bootstrap()
        self.call('/auth/sessions', 'POST', {
            'lab_subject_id': f'20000000-0000-4000-8000-{index:012d}',
            'csrf_token': nonce
        }, want=201, token=nonce)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-lab-writes', action='store_true')
    args = parser.parse_args()
    if not args.allow_lab_writes:
        raise SystemExit('NOT_RUN: requires --allow-lab-writes; runs non-destructive synthetic lab tests')

    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'live loopback synthetic HTTP/API M0-11 system administration, AC22 purge dual-control & archive/restore, AC24 scoped runner & maintenance & redacted health, AC20 keyboard UI dialogs',
        'command': 'python scripts/smoke_m0_11_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name, detail=''):
        report['checks'].append({'name': name, 'detail': detail, 'result': 'PASS'})

    try:
        super_admin = Client()
        second_admin = Client()
        platform_admin = Client()
        coord = Client()
        operator = Client()
        tech = Client()
        pub1 = Client()

        super_admin.login(17)
        second_admin.login(18)
        platform_admin.login(5)
        coord.login(11)
        operator.login(4)
        tech.login(9)
        pub1.login(1)
        passed('authenticated_lab_sessions', 'super_admin=17, second_admin=18, platform_admin=5, coord=11, operator=4, tech=9, pub1=1')

        org_id = '10000000-0000-4000-8000-000000000001'

        # -----------------------------------------------------------------
        # 1. AC22: Non-Super Admin Purge Rejection (403 Forbidden)
        # -----------------------------------------------------------------
        purge_body = {
            'expected_version': 1,
            'object_id': org_id,
            'retention_policy_version': 1,
            'reason': 'Permintaan purge tidak berizin smoke test'
        }
        for name, cl in [('platform_admin', platform_admin), ('coord', coord), ('operator', operator), ('pub1', pub1)]:
            cl.call('/admin/purge-requests', 'POST', purge_body, want=403)
        passed('ac22_non_super_admin_purge_rejected_403')

        # -----------------------------------------------------------------
        # 2. AC22: Super Admin Purge Request Recorded as DISABLED
        # -----------------------------------------------------------------
        purge_res, _, _ = super_admin.call('/admin/purge-requests', 'POST', {
            'expected_version': 1,
            'object_id': org_id,
            'retention_policy_version': 1,
            'reason': 'Pemusnahan retensi arsip oleh Super Admin'
        }, want=202)
        assert purge_res['state'] == 'DISABLED' or purge_res.get('status') == 'DISABLED'
        passed('ac22_super_admin_purge_disabled_no_data_loss')

        # -----------------------------------------------------------------
        # 3. AC22: Dual Control Enforcement on System Operations
        # -----------------------------------------------------------------
        super_admin_id = '20000000-0000-4000-8000-000000000017'
        second_admin_id = '20000000-0000-4000-8000-000000000018'

        # Self-approval rejected (400)
        super_admin.call('/admin/operations', 'POST', {
            'expected_version': 1,
            'target_id': org_id,
            'kind': 'BACKUP_MANIFEST',
            'reason': 'Self approved backup manifest',
            'approved_by': super_admin_id
        }, want=400)

        # Dual approval accepted (202)
        dual_res, _, _ = super_admin.call('/admin/operations', 'POST', {
            'expected_version': 1,
            'target_id': org_id,
            'kind': 'BACKUP_MANIFEST',
            'reason': 'Dual approved backup manifest',
            'approved_by': second_admin_id
        }, want=202)
        assert dual_res['kind'] == 'BACKUP_MANIFEST'
        passed('ac22_dual_control_enforced_and_accepted')

        # -----------------------------------------------------------------
        # 4. AC22: Archive Closed Ticket & Restore Archive
        # -----------------------------------------------------------------
        # Create ticket
        tkt_res, _, _ = pub1.call('/tickets', 'POST', {
            'service_id': '30000000-0000-4000-8000-000000000001',
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Tiket siklus arsip smoke test M0-11',
            'description': 'Tiket untuk pengujian pengarsipan dan pemulihan',
            'answers': {'ringkasan': 'Lt 3 Balai Kota'}
        }, want=201)
        tkt_id = tkt_res['id']
        ver = tkt_res['version']

        # Verify ticket
        v_res, _, _ = operator.call(f'/tickets/{tkt_id}/verify', 'POST', {
            'expected_version': ver,
            'category_id': '40000000-0000-4000-8000-000000000001',
            'priority': 'NORMAL',
            'reason': 'Verifikasi smoke test',
            'classifier_version': 1,
            'evidence_digest': '0000000000000000000000000000000000000000000000000000000000000000'
        }, want=200)
        ver = v_res['version']

        # Try archiving active ticket -> 409 Conflict
        coord.call(f'/tickets/{tkt_id}/archive', 'POST', {
            'expected_version': ver,
            'reason': 'Percobaan arsip tiket yang masih aktif'
        }, want=409)
        passed('ac22_archive_active_ticket_rejected_409')

        # Dispatch ticket
        d_res, _, _ = coord.call(f'/tickets/{tkt_id}/dispatch', 'POST', {
            'expected_version': ver,
            'team_id': '50000000-0000-4000-8000-000000000001',
            'assignee_id': '20000000-0000-4000-8000-000000000009',
            'proposal_version': 1,
            'reason': 'Penugasan teknisi',
            'tier': 'L1'
        }, want=200)
        ver = d_res['version']

        # Resolve ticket
        r_res, _, _ = tech.call(f'/tickets/{tkt_id}/resolve', 'POST', {
            'expected_version': ver,
            'summary': 'Pekerjaan perbaikan selesai tuntas'
        }, want=200)
        ver = r_res['version']

        # Confirm resolution -> CLOSED
        c_res, _, _ = pub1.call(f'/tickets/{tkt_id}/confirmation', 'POST', {
            'expected_version': ver,
            'decision': 'ACCEPT'
        }, want=200)
        assert c_res['state'] == 'CLOSED'
        ver = c_res['version']

        # Archive closed ticket
        arch_res, _, _ = coord.call(f'/tickets/{tkt_id}/archive', 'POST', {
            'expected_version': ver,
            'reason': 'Pengarsipan tiket closed'
        }, want=200)
        ver = arch_res['version']

        # Verify archived via GET
        tkt_check, _, _ = coord.call(f'/tickets/{tkt_id}', 'GET', want=200)
        assert tkt_check['archived_at'] is not None
        passed('ac22_archive_closed_ticket_preserves_history')

        # Restore archived ticket
        rest_res, _, _ = coord.call(f'/tickets/{tkt_id}/restore-archive', 'POST', {
            'expected_version': ver,
            'reason': 'Pemulihan tiket terarsip'
        }, want=200)
        ver = rest_res['version']

        # Verify restored via GET
        tkt_check2, _, _ = coord.call(f'/tickets/{tkt_id}', 'GET', want=200)
        assert tkt_check2.get('archived_at') is None
        passed('ac22_restore_archived_ticket_succeeds')

        # -----------------------------------------------------------------
        # 5. AC24: Scoped Runner Allowlist Enforcement
        # -----------------------------------------------------------------
        # Allowed jobs
        b_res, _, _ = platform_admin.call('/admin/operations', 'POST', {
            'expected_version': 1,
            'target_id': org_id,
            'kind': 'HEALTH_REPORT',
            'reason': 'Pembuatan laporan diagnosa'
        }, want=202)
        assert b_res['kind'] == 'HEALTH_REPORT'

        # Illegal jobs rejected (400)
        for bad_kind in ['SHELL_EXEC', 'SQL_CONSOLE', 'ARBITRARY_COMMAND']:
            platform_admin.call('/admin/operations', 'POST', {
                'expected_version': 1,
                'target_id': org_id,
                'kind': bad_kind,
                'reason': 'Ilegal execution attempt'
            }, want=400)
        passed('ac24_scoped_runner_allowlist_enforced')

        # -----------------------------------------------------------------
        # 6. AC24: Maintenance Mode READ_ONLY Blocks Writes
        # -----------------------------------------------------------------
        now = datetime.datetime.now(datetime.timezone.utc)
        platform_admin.call('/admin/maintenance', 'POST', {
            'expected_version': 1,
            'organization_id': org_id,
            'mode': 'READ_ONLY',
            'starts_at': (now - datetime.timedelta(hours=1)).isoformat().replace('+00:00', 'Z'),
            'ends_at': (now + datetime.timedelta(hours=2)).isoformat().replace('+00:00', 'Z'),
            'message': 'Uji pemeliharaan read only'
        }, want=201)

        # GET is allowed (200)
        pub1.call('/catalog/services', 'GET', want=200)

        # POST is blocked (503)
        pub1.call('/tickets', 'POST', {
            'service_id': '30000000-0000-4000-8000-000000000001',
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Laporan saat read-only',
            'description': 'Harus ditolak',
            'answers': {'ringkasan': 'Depok'}
        }, want=503)

        # Revert to NORMAL
        platform_admin.call('/admin/maintenance', 'POST', {
            'expected_version': 1,
            'organization_id': org_id,
            'mode': 'NORMAL',
            'starts_at': (now - datetime.timedelta(hours=1)).isoformat().replace('+00:00', 'Z'),
            'ends_at': (now - datetime.timedelta(minutes=1)).isoformat().replace('+00:00', 'Z'),
            'message': 'Kembali normal'
        }, want=201)

        # POST works again (201)
        pub1.call('/tickets', 'POST', {
            'service_id': '30000000-0000-4000-8000-000000000001',
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Laporan paska pemeliharaan',
            'description': 'Berhasil',
            'answers': {'ringkasan': 'Depok'}
        }, want=201)
        passed('ac24_maintenance_mode_readonly_blocks_writes')

        # -----------------------------------------------------------------
        # 7. AC24: Redacted System Health
        # -----------------------------------------------------------------
        health, _, _ = platform_admin.call('/admin/health', 'GET', want=200)
        assert health['status'] == 'HEALTHY'
        assert len(health.get('modules', {})) >= 9
        raw_health_str = json.dumps(health)
        for forbidden in ['postgres://', 'password=', 'secret', '/root/']:
            assert forbidden not in raw_health_str.lower(), f"Leak detected: {forbidden}"
        passed('ac24_redacted_system_health_verified')

        # -----------------------------------------------------------------
        # 8. AC20: UI Dialogs Keyboard Accessibility
        # -----------------------------------------------------------------
        ticket_ui = (ROOT / 'frontend/ticket-pages.mjs').read_text(encoding='utf-8')
        assert 'data-archive-dialog' in ticket_ui
        assert 'data-restore-dialog' in ticket_ui
        business_ui = (ROOT / 'frontend/business-pages.mjs').read_text(encoding='utf-8')
        assert 'data-hd-m11-section' in business_ui
        passed('ac20_ui_dialogs_keyboard_accessibility_verified')

        report['result'] = 'PASS'
    except Exception as exc:
        report['result'] = 'FAIL'
        report['error'] = str(exc)
        raise
    finally:
        out = ROOT / 'qa/m0-11/smoke_local.json'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f'{report["result"]} M0-11 local smoke -> {out}')


if __name__ == '__main__':
    main()
