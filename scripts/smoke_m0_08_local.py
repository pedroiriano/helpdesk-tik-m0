"""Smoke test M0-08 on live local HTTP/API (loopback lab 18090)."""
import argparse
import datetime
import hashlib
import http.cookiejar
import json
from pathlib import Path
import time
import urllib.request
import urllib.error
import uuid

BASE = 'http://127.0.0.1:18090'
VALID_PNG = bytes.fromhex('89504e470d0a1a0a0000000d494844520000000a0000000a08060000008d32cfbd0000001549444154789c626220128c2aa4b34240000000ffff133800152def5f0f0000000049454e44ae426082')


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
        self.call('/auth/sessions', 'POST', {'lab_subject_id': f'20000000-0000-4000-8000-{index:012d}', 'csrf_token': nonce}, 201, token=nonce)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-lab-writes', action='store_true')
    args = parser.parse_args()
    if not args.allow_lab_writes:
        raise SystemExit('NOT_RUN: requires --allow-lab-writes; creates synthetic tickets/drafts/media without deleting existing data')

    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'live loopback synthetic HTTP/API M0-08 two-owner media, attachment ACL, sanitized reuse, draft autosave, competing tabs 409 conflict, and isolation',
        'command': 'python scripts/smoke_m0_08_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name, detail=''):
        report['checks'].append({'name': name, 'detail': detail, 'result': 'PASS'})

    try:
        public = Client()
        other = Client()
        editor = Client()

        public.login(1)
        other.login(2)
        editor.login(14)
        passed('authenticated_lab_sessions', 'public=1, other=2, editor=14')

        # 1. Draft Lifecycle & Autosave (Creation version 1)
        draft_id = str(uuid.uuid4())
        draft_create = {
            'expected_version': 0,
            'form_version': 1,
            'title': 'Draft Permohonan Jaringan Internet ' + draft_id[:6],
            'description': 'Uraian pengajuan kebutuhan akses internet dinas',
            'answers': {'lokasi': 'Gedung Dibaleka Lantai 3'}
        }
        res_create, _, _ = public.call(f'/drafts/{draft_id}', 'PUT', draft_create, 200)
        assert res_create.get('version') == 1, f"expected draft version 1, got {res_create.get('version')}"
        passed('draft_created', f'id={draft_id} version=1')

        # 2. Draft Read
        res_read, _, _ = public.call(f'/drafts/{draft_id}', 'GET', want=200)
        assert res_read.get('title') == draft_create['title'], 'draft title mismatch'
        passed('draft_read_verified')

        # 3. Draft Update (Version 2)
        draft_update = {
            'expected_version': 1,
            'form_version': 1,
            'title': 'Draft Permohonan Jaringan Internet (Revisi)',
            'description': 'Uraian pengajuan kebutuhan akses internet dinas diperbarui',
            'answers': {'lokasi': 'Gedung Dibaleka Lantai 3 Ruang Command Center'}
        }
        res_update, _, _ = public.call(f'/drafts/{draft_id}', 'PUT', draft_update, 200)
        assert res_update.get('version') == 2, f"expected draft version 2, got {res_update.get('version')}"
        passed('draft_updated', 'version=2')

        # 4. Competing Tabs CAS Concurrency Protection (409 Conflict)
        draft_stale = {
            'expected_version': 1,  # Stale version from competing browser tab
            'form_version': 1,
            'title': 'Draft dari Tab Bersaing yang Terlambat',
            'description': 'Uraian tab bersaing',
            'answers': {'lokasi': 'Lantai 3'}
        }
        public.call(f'/drafts/{draft_id}', 'PUT', draft_stale, want=409)
        passed('competing_tab_conflict_guarded_409')

        # 5. Draft Privacy & Account Switch Isolation
        other.call(f'/drafts/{draft_id}', 'GET', want=404)
        drafts_list, _, _ = other.call('/drafts', 'GET', want=200)
        items = drafts_list.get('items', [])
        assert all(d.get('id') != draft_id for d in items), 'Draft leakage to different account!'
        passed('account_switch_draft_isolated')

        # 6. Draft Deletion after Submission
        public.call(f'/drafts/{draft_id}', 'DELETE', want=204)
        public.call(f'/drafts/{draft_id}', 'GET', want=404)
        passed('draft_deleted_cleanly')

        # 7. Media Library M3 vs M8 Listing
        m3_list, _, _ = public.call('/media?owner=M3', 'GET', want=200)
        m8_list, _, _ = editor.call('/media?owner=M8', 'GET', want=200)
        m3_items = m3_list.get("items") or []
        m8_items = m8_list.get("items") or []
        passed('two_owner_media_listed', f'm3_count={len(m3_items)} m8_count={len(m8_items)}')

        # 8. M8 Media Upload & Content Stream
        m8_meta = {
            'expected_version': 1,
            'filename': 'loopback_server.png',
            'mime': 'image/png',
            'size_bytes': len(VALID_PNG),
            'sha256': hashlib.sha256(VALID_PNG).hexdigest(),
            'alt': 'Foto Dokumentasi Server Loopback ' + draft_id[:6],
            'caption': 'Server Utama Diskominfotik',
            'license': 'CC-BY-SA-4.0',
            'source': 'Diskominfotik Kota Depok'
        }
        m8_create_res, _, _ = editor.call('/media', 'POST', m8_meta, 201)
        m8_media_id = m8_create_res['id']
        passed('m8_media_metadata_created', f'id={m8_media_id}')

        editor.call(
            f'/media/{m8_media_id}/content', 'PUT',
            raw_body=VALID_PNG,
            headers={'Content-Type': 'image/png'},
            want=200
        )
        passed('m8_media_binary_stored')

        # 9. Attachment ACL & Quarantined Protection on Tickets
        service_id = '30000000-0000-4000-8000-000000000001'
        ticket_payload = {
            'service_id': service_id,
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': 'Tiket Smoke Test M0-08 ' + draft_id[:6],
            'description': 'Pengujian penegakan lampiran privat dan reuse tersanitasi.',
            'answers': {'ringkasan': 'Uji lampiran privat'}
        }
        ticket_res, _, _ = public.call('/tickets', 'POST', ticket_payload, 201)
        ticket_id = ticket_res['id']

        att_res, _, _ = public.call(
            f'/tickets/{ticket_id}/attachments', 'POST',
            raw_body=VALID_PNG,
            headers={
                'Content-Type': 'application/octet-stream',
                'X-File-Mime': 'image/png',
                'X-Filename': 'lampiran-privat.png',
                'X-Attachment-Audience': 'REQUESTER',
                'X-Expected-Version': '1'
            },
            want=201
        )
        att_list, _, _ = public.call(f'/tickets/{ticket_id}/attachments', 'GET')
        att_items = att_list.get('items') or []
        assert len(att_items) > 0, f"no attachments found on ticket {ticket_id}: {att_list}"
        att_id = att_items[0]['id']
        passed('private_attachment_uploaded', f'ticket_id={ticket_id} att_id={att_id}')

        # Attachment download oleh pengguna lain ditolak
        other.call(f'/tickets/{ticket_id}/attachments/{att_id}/download', 'GET', want=404)
        passed('attachment_acl_unauthorized_download_denied')

        # 10. Direct Reuse Illegal Check & Sanitized Reuse with Provenance
        illegal_reuse = {
            'expected_version': 1,
            'target_owner': 'M8',
            'target_id': str(uuid.uuid4()),
            'target_audience': 'PUBLIC_GUEST',
            'reason': 'Coba direct reuse ilegal tanpa persetujuan'
        }
        editor.call(f'/media/{att_id}/reuse', 'POST', illegal_reuse, want=403)
        passed('illegal_direct_reuse_forbidden_403')

        sanitized_copy_id = str(uuid.uuid4())
        approval_id = str(uuid.uuid4())
        valid_reuse = {
            'expected_version': 1,
            'target_owner': 'M8',
            'target_id': str(uuid.uuid4()),
            'target_audience': 'PUBLIC_GUEST',
            'sanitized_copy_id': sanitized_copy_id,
            'approval_id': approval_id,
            'reason': 'Salinan tersanitasi untuk artikel panduan portal publik'
        }
        reuse_res, _, _ = editor.call(f'/media/{att_id}/reuse', 'POST', valid_reuse, want=200)
        assert reuse_res.get('id') == sanitized_copy_id, f'expected id {sanitized_copy_id}, got {reuse_res.get("id")}'
        passed('sanitized_reuse_provenance_created', f'sanitized_id={sanitized_copy_id}')

        report['result'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL', error=str(error))
    finally:
        dest = Path('qa/m0-08/smoke_local.json')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"{report['result']} M0-08 smoke loopback -> {dest}")
        if report['result'] != 'PASS':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
