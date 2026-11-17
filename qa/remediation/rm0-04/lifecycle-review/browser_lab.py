"""Disposable localhost UI lab. All database and upload state is ephemeral."""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'scripts'))
from test_owner_migrations import MigrationGate

HERE = Path(__file__).resolve().parent
STATE = HERE / 'browser-lab-state.json'
LABEL = 'helpdesk.scope=lifecycle-browser-test'


def docker(*args, input=None):
    result = subprocess.run(['docker', *args], input=input, text=True, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Docker lab operation failed; details omitted to protect fixture secrets')
    return result.stdout.strip()


def stop(state):
    # Only remove positively identified disposable resources from this invocation.
    for name in [state.get('web'), state.get('app'), state.get('database')]:
        if not name:
            continue
        found = subprocess.run(['docker', 'inspect', name, '--format', '{{index .Config.Labels "helpdesk.scope"}}'], capture_output=True, text=True)
        if found.returncode:
            continue
        expected = 'm0-02-contract-test' if name == state.get('database') else 'lifecycle-browser-test'
        if found.stdout.strip() != expected:
            raise RuntimeError('Refusing cleanup: resource label mismatch')
        docker('rm', '-f', name)
    network = state.get('network')
    for network in [state.get('network'), state.get('edge')]:
        if not network:
            continue
        found = subprocess.run(['docker', 'network', 'inspect', network, '--format', '{{index .Labels "helpdesk.scope"}}'], capture_output=True, text=True)
        if found.returncode == 0:
            if found.stdout.strip() != 'lifecycle-browser-test':
                raise RuntimeError('Refusing cleanup: network label mismatch')
            docker('network', 'rm', network)
    state['running'] = False
    state['cleanup'] = 'PASS'
    STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')


def start():
    if STATE.exists() and json.loads(STATE.read_text())['running']:
        raise RuntimeError('Existing lab is active; stop that exact lab first')
    gate = MigrationGate()
    state = {'running': True, 'network': gate.name + '-ui-net', 'database': gate.name,
             'app': gate.name + '-ui-app', 'web': gate.name + '-ui-web', 'edge': gate.name + '-ui-edge',
             'host_binding': '127.0.0.1 only', 'persistent_volumes': []}
    STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
    try:
        build = subprocess.run(['docker', 'build', '--pull=false', '--target', 'build', '-t',
                                'helpdesk-m0-lifecycle-browser:0.1.0', '-f', 'infra/docker/backend.Dockerfile', '.'],
                               cwd=ROOT, capture_output=True, text=True, timeout=360)
        if build.returncode:
            raise RuntimeError('Browser lab application build failed')
        docker('network', 'create', '--internal', '--label', LABEL, state['network'])
        docker('network', 'create', '--label', LABEL, state['edge'])
        gate.provision(state['network'])
        gate.apply()
        seed = (ROOT / 'seeds/m0-03-lab.sql').read_text(encoding='utf-8')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        ip = docker('inspect', gate.name, '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
        # Resolve the application dynamically so nginx can allocate a localhost port first.
        conf = (ROOT / 'infra/nginx/nginx.conf').read_text(encoding='utf-8')
        conf = conf.replace('    listen 8080;', '    listen 8080;\n    resolver 127.0.0.11 valid=1s;\n    set $lab_upstream ' + state['app'] + ';')
        conf = conf.replace('proxy_pass http://app:8080;', 'proxy_pass http://$lab_upstream:8080;')
        (HERE / 'browser-nginx.conf').write_text(conf, encoding='utf-8')
        docker('run', '-d', '--name', state['web'], '--label', LABEL, '--network', state['edge'],
               '--cpus', '0.4', '--memory', '768m', '--read-only', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp', '-p', '127.0.0.1::8080',
               '-v', str(ROOT / 'frontend/dist') + ':/usr/share/nginx/html:ro',
               '-v', str(HERE / 'browser-nginx.conf') + ':/etc/nginx/nginx.conf:ro',
               'helpdesk-m0-web:0.1.0')
        docker('network', 'connect', state['network'], state['web'])
        state['url'] = 'http://' + docker('port', state['web'], '8080/tcp')
        STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
        # Passwords exist only in stdin and tmpfs inside this disposable container.
        init = "umask 077\nmkdir -p /run/secrets\n"
        for owner in range(1, 10):
            init += f"printf '%s' '{gate.password}' > /run/secrets/m{owner}\n"
        init += "printf '%s' 'synthetic-lifecycle-browser-session-key-only' > /run/secrets/session_key\ntouch /tmp/helpdesk-start\n"
        docker('run', '-d', '-i', '--name', state['app'], '--label', LABEL, '--network', state['network'],
               '--add-host', 'db:' + ip, '--cpus', '1', '--memory', '1024m', '--read-only',
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp',
               '--tmpfs', '/run/secrets', '--tmpfs', '/private/uploads',
               '-v', str(ROOT / 'configs') + ':/app/configs:ro', '-w', '/app',
               '-e', 'HELPDESK_LAB_AUTH=1', '-e', 'HELPDESK_PUBLIC_ORIGIN=' + state['url'],
               '-e', 'HELPDESK_UPLOAD_ROOT=/private/uploads', '-e', 'HELPDESK_SCANNER=127.0.0.1:1',
               'helpdesk-m0-lifecycle-browser:0.1.0', '/bin/sh', '-ec',
               'while [ ! -f /tmp/helpdesk-start ]; do sleep .1; done; exec /out/helpdesk')
        docker('exec', '-i', state['app'], '/bin/sh', '-s', input=init.replace('\n', ';'))
        deadline = time.monotonic() + 45
        while True:
            try:
                with urlopen(state['url'] + '/readyz', timeout=3) as response:
                    if response.status == 200:
                        break
            except Exception:
                if time.monotonic() > deadline:
                    raise RuntimeError('Disposable browser lab readiness failed')
                time.sleep(1)
        state['readiness'] = 200
        STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
        print('PASS disposable browser lab ready at ' + state['url'])
    except Exception:
        for kind in ['app', 'web']:
            logs = subprocess.run(['docker','logs','--tail','4',state[kind]], capture_output=True, text=True)
            state[kind + '_diagnostic'] = (logs.stdout + logs.stderr).replace(gate.password, '[REDACTED]')[-1200:]
        stop(state)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop'])
    args = parser.parse_args()
    if args.action == 'start':
        start()
    else:
        stop(json.loads(STATE.read_text(encoding='utf-8')))
        print('PASS disposable browser lab cleaned up')
