"""Exercise the access profile payload through real HTTP on the disposable lab."""
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
import json
from pathlib import Path
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPCookieProcessor
from uuid import uuid4

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
state = json.loads((HERE / 'browser-lab-state.json').read_text(encoding='utf-8'))
origin = state['url']
url = urlsplit(origin)
if not (state['running'] and state['readiness'] == 200 and url.hostname == '127.0.0.1'
        and url.port and url.port != 18080 and not state['persistent_volumes']):
    raise RuntimeError('Refusing to use a non-disposable target')
label = subprocess.check_output(
    ['docker', 'inspect', state['web'], '--format', '{{index .Config.Labels "helpdesk.scope"}}'],
    text=True).strip()
binding = subprocess.check_output(['docker', 'port', state['web'], '8080/tcp'], text=True).strip()
if label != 'lifecycle-browser-test' or binding != url.netloc:
    raise RuntimeError('Disposable gateway identity mismatch')


class Client:
    def __init__(self):
        self.cookies = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, method, path, expected, payload=None, token=None):
        headers = {'Origin': origin}
        data = None
        if method != 'GET':
            data = json.dumps(payload).encode()
            headers.update({
                'Content-Type': 'application/json',
                'X-CSRF-Token': token or next((c.value for c in self.cookies if c.name == 'helpdesk_csrf'), ''),
                'Idempotency-Key': str(uuid4()),
            })
        try:
            response = self.opener.open(Request(origin + '/api/v1' + path, data, headers, method=method), timeout=15)
        except HTTPError as error:
            response = error
        with response:
            if response.status != expected:
                raise AssertionError(f'{method} {path}: expected HTTP {expected}, got {response.status}')
            return json.loads(response.read())

    def login(self, subject):
        nonce = self.request('GET', '/auth/bootstrap', 200)['csrf_token']
        self.request('POST', '/auth/sessions', 201, {'lab_subject_id': subject, 'csrf_token': nonce}, nonce)
        return self.request('GET', '/auth/me', 200)


def fixture(index):
    return f'20000000-0000-4000-8000-{index:012d}'


admin = Client()
technician = Client()
session = admin.login(fixture(5))
org = session['organization_ids'][0]
subject = fixture(7)  # Technician assigned to the other OPD in the seed.
tech_session = technician.login(subject)
other_org = next(x for x in tech_session['organization_ids'] if x != org)
calculator = """
import { standardAccess } from './frontend/admin-profiles.mjs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { session, org } = JSON.parse(input);
console.log(JSON.stringify(standardAccess(session, org, 'TECHNICIAN')));
"""
permissions = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', calculator],
    cwd=ROOT, input=json.dumps({'session': session, 'org': org}), text=True))
assert 'ticket.resolve' in permissions and 'identity.grant' not in permissions
payload = {
    'subject_id': subject, 'organization_id': org, 'team_id': None, 'permissions': permissions,
    'expires_at': (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(timespec='seconds'),
    'revoked': False, 'reason': 'Bukti akses standar pada lab disposable',
}
path = '/admin/memberships'
admin.request('POST', path, 403, {**payload, 'permissions': [*permissions, 'identity.grant']})
admin.request('POST', path, 404, {**payload, 'organization_id': other_org})
technician.request('POST', path, 404, {**payload, 'organization_id': other_org})
created = admin.request('POST', path, 201, payload)
ident = created['id']


def persisted():
    return next(row for row in admin.request('GET', path + '?limit=100', 200)['items'] if row['id'] == ident)


row = persisted()
assert set(row['permissions']) == set(permissions) and row['version'] == created['version']
tech_session = technician.request('GET', '/auth/me', 200)
assert any(m['organization_id'] == org and 'ticket.resolve' in m['permissions']
           for m in tech_session['actor']['memberships'])
reduced = [p for p in permissions if p != 'ticket.vendor']
updated = admin.request('PUT', path + '/' + ident, 200, {
    **payload, 'permissions': reduced, 'expected_version': row['version'],
})
assert updated['version'] > row['version']
admin.request('PUT', path + '/' + ident, 409, {
    **payload, 'expected_version': row['version'], 'reason': 'Versi lama harus ditolak',
})
after = persisted()
assert set(after['permissions']) == set(reduced) and after['version'] == updated['version']
admin.request('PUT', path + '/' + ident, 200, {
    **payload, 'permissions': reduced, 'expected_version': after['version'],
    'revoked': True, 'reason': 'Uji pencabutan akses sintetis',
})
assert persisted()['revoked']
assert org not in technician.request('GET', '/auth/me', 200)['organization_ids']

report = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'result': 'PASS',
    'scope': 'HTTP against disposable PostgreSQL, same standardAccess function as the UI',
    'cases': [
        'out-of-role permission 403', 'out-of-scope organization 404', 'technician grant attempt 404',
        'standard grant 201 and GET readback', 'technician session sees authorized binding',
        'update 200 and GET readback', 'stale version 409', 'revocation effective on next session read',
    ],
    'standard_permission_count': len(permissions),
    'working_database_writes': False,
}
(HERE / 'membership-http.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('PASS real HTTP grant, readback, edit, revocation and negative guards on disposable PostgreSQL')
