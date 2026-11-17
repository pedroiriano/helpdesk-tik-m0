"""M0-09 Go/HTTP/PostgreSQL integration, on a new internal Docker network only."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from test_owner_migrations import MigrationGate, ROOT


def main():
    gate = MigrationGate()
    network = gate.name + '-net'
    worker = gate.name + '-go'
    created_network = False
    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'M0-09 Portal content editorial transitions, server-side content sanitization, ContentPublished outbox delivery, portal navigation no implicit permissions (AC24), scope-safe multi-owner search and dynamic revocation anti-leakage (AC23), and keyboard-accessible search combobox (AC20); real HTTP and PostgreSQL; no working DB writes',
        'command': 'python scripts/test_m0_09.py',
        'host_ports': [],
        'persistent_volumes': []
    }
    try:
        build = subprocess.run(
            ['docker', 'build', '--pull=false', '--target', 'source', '-t', 'helpdesk-m0-m009-test:0.1.0', '-f', 'infra/docker/backend.Dockerfile', '.'],
            cwd=ROOT, capture_output=True, text=True, timeout=120
        )
        if build.returncode:
            raise RuntimeError(build.stderr[-4000:])
        gate.docker('network', 'create', '--internal', '--label', 'helpdesk.scope=m0-09-test', network)
        created_network = True
        gate.docker('network', 'connect', network, 'helpdesk-m0-scanner')
        gate.provision(network)
        gate.apply()
        seed = (ROOT / 'seeds/m0-03-lab.sql').read_text(encoding='utf-8')
        gate.sql('BEGIN;' + seed + 'COMMIT;', error='P0001')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        result = gate.docker(
            'run', '--rm', '--pull', 'never', '--name', worker,
            '--label', 'helpdesk.scope=m0-09-test',
            '--network', network, '--cpus', '1', '--memory', '1024m',
            '-e', 'HELPDESK_M009_TEST=1',
            '-e', 'HELPDESK_TEST_SCANNER=helpdesk-m0-scanner:3310',
            '-e', 'HELPDESK_TEST_DB_HOST=' + gate.name,
            '-e', 'HELPDESK_TEST_PASSWORD=' + gate.password,
            'helpdesk-m0-m009-test:0.1.0',
            'go', 'test', './internal/bootstrap', '-run', '^TestM009Integration$', '-count=1', '-v',
            ok=False, timeout=240
        )
        report['go_output'] = result.stdout + result.stderr
        if result.returncode or '--- PASS: TestM009Integration' not in result.stdout:
            raise RuntimeError(report['go_output'][-6000:])
        report['result'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL', error=str(error))
    finally:
        try:
            current = gate.docker('inspect', worker, ok=False)
            if current.returncode == 0:
                info = json.loads(current.stdout)[0]
                if info['Config']['Labels'].get('helpdesk.scope') != 'm0-09-test':
                    raise RuntimeError('worker cleanup label mismatch')
                gate.docker('rm', '-f', worker)
            gate.cleanup()
            if created_network:
                gate.docker('network', 'disconnect', network, 'helpdesk-m0-scanner', ok=False)
                info = json.loads(gate.docker('network', 'inspect', network).stdout)[0]
                if info['Labels'].get('helpdesk.scope') != 'm0-09-test':
                    raise RuntimeError('network cleanup label mismatch')
                gate.docker('network', 'rm', network)
            report['cleanup'] = 'PASS'
        except Exception as error:
            report.update(result='FAIL', cleanup=str(error))
        files = [p for group in ('backend', 'migrations', 'seeds') for p in (ROOT / group).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
        files += [Path(__file__), ROOT / 'scripts/test_owner_migrations.py']
        report['source_hashes'] = {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        dest = ROOT / 'qa/m0-09/integration.json'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"{report['result']} M0-09 integration gate -> {dest}")
        if report['result'] != 'PASS':
            sys.exit(1)


if __name__ == '__main__':
    main()
