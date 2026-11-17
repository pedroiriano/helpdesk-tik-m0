"""Read-only comparison of the local UX build with the served candidate."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[4]
dist = root / 'frontend/dist'
paths = [
    'index.html', 'layanan.html', 'akses.html', 'admin/index.html',
    'admin/auth/login.html', 'admin/app/dashboard/index.html',
    'admin/app/helpdesk/index.html', 'admin/app/tickets/index.html',
    'admin/app/tickets/detail.html', 'helpdesk/business.css',
    'helpdesk/m0-03.js', 'helpdesk/m0-04.js',
    'admin/assets/js/components/cmd-palette.js',
    'admin/assets/js/components/feature-registry.js',
]
paths += [p.name for p in dist.glob('*.js') if p.name != 'sw.js']
result = {'timestamp': datetime.now(timezone.utc).isoformat(),
          'base_url': 'http://127.0.0.1:18080', 'assets': {}}
with urlopen(result['base_url'] + '/readyz', timeout=15) as response:
    result['readiness'] = response.status
assert result['readiness'] == 200
for path in paths:
    expected = hashlib.sha256((dist / path).read_bytes()).hexdigest()
    with urlopen(result['base_url'] + '/' + path, timeout=15) as response:
        actual = hashlib.sha256(response.read()).hexdigest()
        assert actual == expected, path
        result['assets'][path] = {'sha256': actual, 'status': response.status,
                                 'content_type': response.headers.get_content_type()}
# Query only image ID and health, without exposing container environment.
result['web_image'] = subprocess.check_output([
    'docker', 'inspect', 'helpdesk-m0-nginx', '--format', '{{.Image}}'], cwd=root, text=True).strip()
result['health'] = subprocess.check_output([
    'docker', 'inspect', 'helpdesk-m0-nginx', '--format', '{{.State.Health.Status}}'], cwd=root, text=True).strip()
assert result['health'] == 'healthy'
result['app_image'] = subprocess.check_output(['docker','inspect','helpdesk-m0','--format','{{.Image}}'],cwd=root,text=True).strip()
result['app_health'] = subprocess.check_output(['docker','inspect','helpdesk-m0','--format','{{.State.Health.Status}}'],cwd=root,text=True).strip()
assert result['app_health'] == 'healthy'
Path(__file__).with_name('gateway.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'PASS gateway readiness, healthy web and {len(paths)} exact served asset hashes')
