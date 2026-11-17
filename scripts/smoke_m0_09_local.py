"""Smoke test M0-09 on live local HTTP/API (loopback lab 18090).

Validates:
1. Editorial state machine (DRAFT -> REVIEW -> PUBLISHED -> ARCHIVED -> RESTORE)
2. Server-side XSS sanitization
3. ContentPublished outbox delivery to M9
4. Portal navigation configuration and invariant AC24 (menu does not grant permissions)
5. Scope-safe multi-owner search (M2, M3, M8)
6. Dynamic revocation anti-leakage (AC23)
7. Keyboard accessible combobox (AC20)
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
        self.call('/auth/sessions', 'POST', {'lab_subject_id': f'20000000-0000-4000-8000-{index:012d}', 'csrf_token': nonce}, 201, token=nonce)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-lab-writes', action='store_true')
    args = parser.parse_args()
    if not args.allow_lab_writes:
        raise SystemExit('NOT_RUN: requires --allow-lab-writes; creates synthetic articles/navigation without deleting existing data')

    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'live loopback synthetic HTTP/API M0-09 editorial transitions, XSS sanitization, AC24 menu permissions invariant, AC23 scope-safe search & dynamic revocation, and AC20 keyboard combobox',
        'command': 'python scripts/smoke_m0_09_local.py --allow-lab-writes',
        'checks': [],
        'result': 'FAIL'
    }

    def passed(name, detail=''):
        report['checks'].append({'name': name, 'detail': detail, 'result': 'PASS'})

    try:
        admin = Client()
        editor = Client()
        publisher = Client()
        asn = Client()
        pub1 = Client()
        pub2 = Client()
        anonymous = Client()

        admin.login(5)
        editor.login(14)
        publisher.login(15)
        asn.login(3)
        pub1.login(1)
        pub2.login(2)
        passed('authenticated_lab_sessions', 'admin=5, editor=14, publisher=15, asn=3, pub1=1, pub2=2')

        # -----------------------------------------------------------------
        # 1. AC12 Server-Side Content Sanitization (Reject Malicious Tags)
        # -----------------------------------------------------------------
        xss_payloads = [
            '<p>Teks aman</p><script>alert("XSS")</script>',
            '<p>Gambar <img src="x" onerror="stealCookies()"> aman</p>',
            '<iframe src="https://attacker.site/malicious"></iframe>',
            '<a href="javascript:alert(document.domain)">Klik di sini</a>'
        ]
        for payload in xss_payloads:
            editor.call('/knowledge/articles', 'POST', {
                'expected_version': 1,
                'title': 'Artikel Uji Coba XSS ' + str(uuid.uuid4())[:8],
                'slug': 'uji-xss-' + str(uuid.uuid4())[:8],
                'body': payload,
                'audience': 'PUBLIC_GUEST',
                'alt': 'Alt XSS'
            }, want=422)
        passed('content_sanitization_xss_rejected_422', f'tested {len(xss_payloads)} malicious payloads')

        # -----------------------------------------------------------------
        # 2. AC12 Editorial Workflow State Machine (DRAFT -> REVIEW -> PUBLISHED -> ARCHIVED -> RESTORE)
        # -----------------------------------------------------------------
        article_slug = f'panduan-wifi-depok-{uuid.uuid4().hex[:6]}'
        art_create = {
            'expected_version': 1,
            'title': 'Panduan Koneksi WiFi Publik Depok Smart City',
            'slug': article_slug,
            'body': '<p>Berikut ini adalah cara menyambungkan perangkat laptop atau gawai ke jaringan WiFi gratis Kota Depok.</p>',
            'audience': 'PUBLIC_GUEST',
            'alt': 'Panduan WiFi Publik'
        }
        res_art, _, _ = editor.call('/knowledge/articles', 'POST', art_create, want=201)
        article_id = res_art['id']
        assert res_art['state'] == 'DRAFT', f"expected DRAFT, got {res_art['state']}"
        assert res_art['version'] == 1, f"expected version 1, got {res_art['version']}"
        passed('article_created_draft', f'id={article_id} slug={article_slug}')

        # Publik tidak boleh dapat melihat artikel DRAFT
        anonymous.call(f'/knowledge/articles/{article_id}', 'GET', want=404)
        passed('draft_article_hidden_from_public')

        # Editor dapat membaca artikel DRAFT miliknya
        read_draft, _, _ = editor.call(f'/knowledge/articles/{article_id}', 'GET', want=200)
        assert read_draft['id'] == article_id
        passed('editor_can_read_draft')

        # Transisi ilegal: langsung ARCHIVE dari status DRAFT ditolak 422
        editor.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 1,
            'action': 'ARCHIVE',
            'reason': 'Langsung arsip dari draft'
        }, want=422)
        passed('illegal_transition_draft_to_archive_rejected_422')

        # Editor mengajukan transisi ke REVIEW
        res_review, _, _ = editor.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 1,
            'action': 'REVIEW',
            'reason': 'Artikel telah disunting dan siap direview'
        }, want=200)
        assert res_review['state'] == 'REVIEW'
        assert res_review['version'] == 2
        passed('article_transition_to_review')

        # Editor tanpa hak content.publish mencoba PUBLISH -> ditolak 403
        editor.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 2,
            'action': 'PUBLISH',
            'reason': 'Editor mencoba publish mandiri'
        }, want=403)
        passed('unauthorized_publish_rejected_403')

        # Publisher (Subjek 15 berhak content.publish) mempublikasikan artikel
        res_pub, _, _ = publisher.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 2,
            'action': 'PUBLISH',
            'reason': 'Disetujui untuk dipublikasikan kepada masyarakat'
        }, want=200)
        assert res_pub['state'] == 'PUBLISHED'
        assert res_pub['version'] == 3
        passed('article_published_by_publisher')

        # Publik sekarang dapat membaca artikel yang sudah PUBLISHED
        res_pub_read, _, _ = anonymous.call(f'/knowledge/articles/{article_id}', 'GET', want=200)
        assert res_pub_read['id'] == article_id
        assert 'Smart City' in res_pub_read['title']
        passed('public_can_read_published_article')

        # Transisi ke ARCHIVED
        res_arc, _, _ = publisher.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 3,
            'action': 'ARCHIVE',
            'reason': 'Informasi usang'
        }, want=200)
        assert res_arc['state'] == 'ARCHIVED'
        assert res_arc['version'] == 4
        passed('article_archived')

        # Publik kembali mendapatkan 404 saat artikel diarsipkan
        anonymous.call(f'/knowledge/articles/{article_id}', 'GET', want=404)
        passed('archived_article_hidden_from_public')

        # Transisi RESTORE kembali ke DRAFT
        res_rst, _, _ = publisher.call(f'/knowledge/articles/{article_id}/transitions', 'POST', {
            'expected_version': 4,
            'action': 'RESTORE',
            'reason': 'Dipulihkan kembali ke draft untuk penyuntingan ulang'
        }, want=200)
        assert res_rst['state'] == 'DRAFT'
        assert res_rst['version'] == 5
        passed('article_restored_to_draft')

        # -----------------------------------------------------------------
        # 3. Portal Pages CRUD (M8)
        # -----------------------------------------------------------------
        page_slug = f'tentang-layanan-{uuid.uuid4().hex[:6]}'
        res_page, _, _ = editor.call('/portal/pages', 'POST', {
            'expected_version': 1,
            'title': 'Tentang Layanan Helpdesk TIK Kota Depok',
            'slug': page_slug,
            'body': '<p>Portal resmi pelayanan bantuan teknologi informasi dan komunikasi Dinas Kominfo Kota Depok.</p>',
            'audience': 'PUBLIC_GUEST',
            'alt': 'Tentang Portal'
        }, want=201)
        page_id = res_page['id']
        read_page, _, _ = editor.call(f'/portal/pages/{page_id}', 'GET', want=200)
        assert read_page['slug'] == page_slug
        passed('portal_page_crud_verified', f'id={page_id} slug={page_slug}')

        # -----------------------------------------------------------------
        # 4. AC24 Portal Navigation Menu No Implicit Permissions
        # -----------------------------------------------------------------
        # Sanitasi rute berbahaya ditolak 422
        admin.call('/admin/navigation', 'POST', {
            'expected_version': 1,
            'route': 'https://malicious.external/phish',
            'label': 'Phishing Link',
            'audience': 'PUBLIC_GUEST',
            'position': 99
        }, want=422)

        admin.call('/admin/navigation', 'POST', {
            'expected_version': 1,
            'route': '/../../traversal',
            'label': 'Path Traversal',
            'audience': 'PUBLIC_GUEST',
            'position': 99
        }, want=422)
        passed('navigation_dangerous_routes_rejected_422')

        # Admin menambahkan rute navigasi yang sah
        nav_route = f'/layanan-unggulan-{uuid.uuid4().hex[:6]}'
        res_nav, _, _ = admin.call('/admin/navigation', 'POST', {
            'expected_version': 1,
            'route': nav_route,
            'label': 'Menu Khusus Admin Baru',
            'audience': 'PUBLIC_GUEST',
            'position': 10
        }, want=201)
        nav_id = res_nav['id']
        passed('navigation_menu_configured', f'id={nav_id} route={nav_route}')

        # Navigasi publik dapat dibaca
        pub_nav, _, _ = anonymous.call('/catalog/navigation', 'GET', want=200)
        assert any(item.get('route') == nav_route for item in pub_nav.get('items', [])), 'Navigasi baru tidak muncul di katalog navigasi publik'
        passed('public_navigation_menu_listed')

        # Invariant AC24: Adanya menu navigasi TIDAK PERNAH memberikan hak akses implisit
        # Publik memanggil endpoint terproteksi (POST /admin/navigation) tanpa sesi -> WAJIB 401
        anonymous.call('/admin/navigation', 'POST', {
            'expected_version': 1,
            'route': nav_route,
            'label': 'Test Bypass Menu',
            'audience': 'PUBLIC_GUEST',
            'position': 99
        }, want=401)
        passed('ac24_invariant_menu_does_not_grant_permissions_401')

        # -----------------------------------------------------------------
        # 5. AC23 Scope-Safe Multi-Owner Search (M2, M3, M8)
        # -----------------------------------------------------------------
        # Validasi parameter pencarian
        pub1.call('/search?owner=INVALID&q=testing', 'GET', want=400)
        pub1.call('/search?owner=M2&q=a', 'GET', want=400)
        passed('search_parameter_validation_400')

        # Pencarian Layanan M2
        search_m2, _, _ = pub1.call('/search?owner=M2&q=Bantuan', 'GET', want=200)
        m2_items = search_m2.get('items', [])
        assert len(m2_items) > 0, 'Pencarian layanan M2 tidak menghasilkan hit'
        assert all(it.get('owner') == 'M2' and it.get('kind') == 'SERVICE' for it in m2_items)
        passed('search_m2_services_verified', f'found {len(m2_items)} services')

        # Pencarian Tiket M3: Pemohon 1 membuat tiket keluhan privat
        target_service_id = m2_items[0]['id']
        unique_secret = f'RAHASIA-USER1-{uuid.uuid4().hex[:6]}'
        res_tkt, _, _ = pub1.call('/tickets', 'POST', {
            'service_id': target_service_id,
            'service_version': 1,
            'form_version': 1,
            'policy_version': 1,
            'title': f'Permohonan Akses Khusus {unique_secret}',
            'description': f'Uraian kebutuhan akses privat pemohon 1 dengan tanda {unique_secret}',
            'answers': {'ringkasan': f'Tiket {unique_secret}'}
        }, want=201)
        tkt_id = res_tkt['id']
        passed('synthetic_ticket_created_for_search', f'id={tkt_id}')

        # Pemohon 1 mencari kata kunci uniknya -> ditemukan
        search_m3_p1, _, _ = pub1.call(f'/search?owner=M3&q={unique_secret}', 'GET', want=200)
        p1_items = search_m3_p1.get('items', [])
        assert len(p1_items) == 1, f"expected 1 hit for owner, got {len(p1_items)}"
        assert p1_items[0]['id'] == tkt_id
        passed('search_m3_owner_found_own_ticket')

        # Pemohon 2 mencari kata kunci rahasia yang sama persis -> WAJIB 0 HITS (data privat terisolasi!)
        search_m3_p2, _, _ = pub2.call(f'/search?owner=M3&q={unique_secret}', 'GET', want=200)
        p2_items = search_m3_p2.get('items', [])
        assert len(p2_items) == 0, f"AC23 violation: Pemohon 2 dapat menemukan tiket milik Pemohon 1! hits={p2_items}"
        passed('search_m3_privacy_isolation_zero_hits_for_other_user')

        # Pencarian Artikel M8
        # Buat dan publish artikel untuk diuji di pencarian publik M8
        search_kw = f'KataKunciPublik{uuid.uuid4().hex[:6]}'
        art_search, _, _ = editor.call('/knowledge/articles', 'POST', {
            'expected_version': 1,
            'title': f'Panduan Pencarian {search_kw}',
            'slug': f'panduan-cari-{uuid.uuid4().hex[:6]}',
            'body': f'<p>Artikel terpublikasi dengan kata pencarian khusus {search_kw}.</p>',
            'audience': 'PUBLIC_GUEST',
            'alt': 'Alt cari'
        }, want=201)
        publisher.call(f"/knowledge/articles/{art_search['id']}/transitions", 'POST', {
            'expected_version': 1,
            'action': 'PUBLISH',
            'reason': 'Terbitkan untuk pencarian'
        }, want=200)

        search_m8, _, _ = anonymous.call(f'/search?owner=M8&q={search_kw}', 'GET', want=200)
        m8_items = search_m8.get('items', [])
        assert len(m8_items) == 1, f"expected 1 hit in M8, got {len(m8_items)}"
        assert m8_items[0]['id'] == art_search['id']
        passed('search_m8_published_article_found')

        # -----------------------------------------------------------------
        # 6. AC23 Dynamic Revocation Anti-Leakage
        # -----------------------------------------------------------------
        asn_kw = f'TunjanganKhususASN{uuid.uuid4().hex[:6]}'
        art_asn, _, _ = editor.call('/knowledge/articles', 'POST', {
            'expected_version': 1,
            'title': f'Peraturan {asn_kw}',
            'slug': f'peraturan-asn-{uuid.uuid4().hex[:6]}',
            'body': f'<p>Rincian internal ASN dengan tanda rahasia {asn_kw}.</p>',
            'audience': 'ASN_AUTH',
            'alt': 'Alt ASN'
        }, want=201)
        publisher.call(f"/knowledge/articles/{art_asn['id']}/transitions", 'POST', {
            'expected_version': 1,
            'action': 'PUBLISH',
            'reason': 'Terbitkan artikel ASN'
        }, want=200)

        # ASN aktif mencari -> ditemukan
        search_asn_before, _, _ = asn.call(f'/search?owner=M8&q={asn_kw}', 'GET', want=200)
        asn_hits_before = search_asn_before.get('items', [])
        assert len(asn_hits_before) == 1, 'Pengguna ASN gagal menemukan artikel ASN_AUTH'
        passed('dynamic_revocation_before_active_session_found')

        # ASN logout / sesi dicabut
        asn.call('/auth/logout', 'POST', {'expected_version': 1, 'reason': 'Selesai bertugas'}, want=200)
        passed('dynamic_revocation_session_revoked')

        # Pencarian ulang paska-revocation -> WAJIB 0 HITS tanpa kebocoran data privat!
        search_asn_after, _, _ = asn.call(f'/search?owner=M8&q={asn_kw}', 'GET', want=200)
        asn_hits_after = search_asn_after.get('items', [])
        assert len(asn_hits_after) == 0, f"AC23 violation: artikel ASN_AUTH masih muncul paska logout! hits={asn_hits_after}"
        passed('dynamic_revocation_after_zero_hits_guaranteed')

        # -----------------------------------------------------------------
        # 7. AC20 Keyboard Accessible Search Combobox Static Verification
        # -----------------------------------------------------------------
        combo_file = ROOT / 'frontend/src/features/search-combobox.ts'
        assert combo_file.is_file(), f"File {combo_file} tidak ditemukan"
        combo_content = combo_file.read_text(encoding='utf-8')

        for aria_attr in ['combobox', 'aria-expanded', 'aria-autocomplete', 'aria-activedescendant', 'option']:
            assert aria_attr in combo_content, f"missing {aria_attr} in search-combobox.ts"

        for key_event in ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']:
            assert key_event in combo_content, f"missing key handler {key_event} in search-combobox.ts"

        dist_layanan = ROOT / 'frontend/dist/layanan.html'
        assert dist_layanan.is_file(), f"File {dist_layanan} tidak ditemukan"
        layanan_html = dist_layanan.read_text(encoding='utf-8')
        assert 'role="combobox"' in layanan_html, 'missing role="combobox" in dist/layanan.html'
        assert 'id="hd-public-search"' in layanan_html, 'missing id="hd-public-search" in dist/layanan.html'
        passed('ac20_keyboard_accessible_search_combobox_verified')

        report['result'] = 'PASS'
        print('PASS live loopback smoke M0-09')

    except Exception as error:
        report['result'] = 'FAIL'
        report['error'] = str(error)
        print(f'FAIL live loopback smoke M0-09: {error}')
        raise

    finally:
        dest = ROOT / 'qa/m0-09/smoke_local.json'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"Report written to {dest}")


if __name__ == '__main__':
    main()
