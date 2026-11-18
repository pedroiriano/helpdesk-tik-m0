"""HTTP contract smoke of the local gateway; no business writes."""
import json, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:18090'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

try:
    urllib.request.build_opener(NoRedirect).open(BASE+'/admin', timeout=10)
except urllib.error.HTTPError as redirect:
    with redirect:
        assert redirect.code == 308 and redirect.headers['Location'] == '/admin/', 'admin redirect must preserve gateway port'
else:
    raise AssertionError('expected admin redirect')
for path, expected in [('/',200),('/admin/',200),('/api/v1/health/live',200),('/api/v1/health/ready',200),('/api/v1/admin/tickets',404),('/.env',404),('/references/provenance.json',404),('/unknown',404)]:
    try: response=urllib.request.urlopen(BASE+path,timeout=10)
    except urllib.error.HTTPError as error: response=error
    with response:
        assert response.status==expected,(path,response.status)
        assert response.headers.get('X-Content-Type-Options')=='nosniff'
        assert "frame-ancestors 'none'" in response.headers.get('Content-Security-Policy','')
        data=response.read()
        if path.endswith('/ready'):assert json.loads(data)=={'status':'ready'}
        if path.endswith('/live'):assert json.loads(data)=={'status':'live'}
        if path in ['/','/admin/']:assert b'Helpdesk TIK Kota Depok' in data
# Compare actual gateway bytes with published frontend/dist assets, including public CSS and admin shell assets.
for rel_path in [
    'css/main.css',
    'helpdesk/public-ui.css',
    'helpdesk/business.css',
    'admin/assets/css/main.css',
    'admin/assets/js/components/popup-layer.js',
    'admin/assets/icons/piui-sprite.svg',
]:
    raw = (ROOT/'frontend'/'dist'/rel_path).read_bytes()
    with urllib.request.urlopen(BASE+'/'+rel_path, timeout=10) as response:
        assert response.read() == raw, rel_path
for route, marker in [('/','vy-stage__tabs'),('/admin/','piui-dashboard-workspace'),
                      ('/admin/app/dashboard/index.html','piui-app-shell'),
                      ('/admin/app/helpdesk/index.html','piui-app-shell'),
                      ('/admin/app/tickets/index.html','piui-app-shell'),
                      ('/admin/sw.js','/admin/offline.html')]:
    with urllib.request.urlopen(BASE+route,timeout=10) as response:
        assert marker.encode() in response.read(), route
print('PASS gateway routes, real health, security headers, built dist parity and native PIUI shell')
