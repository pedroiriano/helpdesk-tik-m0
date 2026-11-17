"""M0-12 End-to-End Go/HTTP/PostgreSQL integration across all 9 modules, on disposable Docker network."""
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
        'scope': 'M0-12 End-to-end integration across all 9 modules (M1-M9), guest lifecycle, CAS concurrency collision, search & dynamic revocation, inter-OPD handoff & escalation, maintenance mode, scoped runner, purge protection, reports analytics & CSV sanitization, readiness & liveness probes; real HTTP and PostgreSQL; zero working DB writes',
        'command': 'python scripts/test_m0_12.py',
        'host_ports': [],
        'persistent_volumes': []
    }
    try:
        build = subprocess.run(
            ['docker', 'build', '--pull=false', '--target', 'source', '-t', 'helpdesk-m0-m012-test:0.1.0', '-f', 'infra/docker/backend.Dockerfile', '.'],
            cwd=ROOT, capture_output=True, text=True, timeout=120
        )
        if build.returncode:
            raise RuntimeError(build.stderr[-4000:])
        gate.docker('network', 'create', '--internal', '--label', 'helpdesk.scope=m0-12-test', network)
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
            '--label', 'helpdesk.scope=m0-12-test',
            '--network', network, '--cpus', '1', '--memory', '1024m',
            '-e', 'HELPDESK_M012_TEST=1',
            '-e', 'HELPDESK_TEST_SCANNER=helpdesk-m0-scanner:3310',
            '-e', 'HELPDESK_TEST_DB_HOST=' + gate.name,
            '-e', 'HELPDESK_TEST_PASSWORD=' + gate.password,
            'helpdesk-m0-m012-test:0.1.0',
            'go', 'test', './internal/bootstrap', '-run', '^TestM012Integration$', '-count=1', '-v',
            ok=False, timeout=240
        )
        report['go_output'] = result.stdout + result.stderr
        if result.returncode or '--- PASS: TestM012Integration' not in result.stdout:
            raise RuntimeError(report['go_output'][-6000:])
        report['result'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL', error=str(error))
    finally:
        try:
            current = gate.docker('inspect', worker, ok=False)
            if current.returncode == 0:
                gate.docker('rm', '-f', worker, ok=False)
        except Exception:
            pass
        try:
            if created_network:
                gate.docker('network', 'disconnect', network, 'helpdesk-m0-scanner', ok=False)
        except Exception:
            pass
        try:
            gate.cleanup()
            report['cleanup'] = 'PASS'
        except Exception as error:
            report['cleanup'] = f'FAIL: {error}'
        try:
            if created_network:
                gate.docker('network', 'rm', network, ok=False)
        except Exception:
            pass

    sources = {}
    for path in sorted((ROOT / 'backend').glob('**/*')):
        if path.is_file() and not any(part in {'.git', 'dist', 'tmp'} for part in path.parts):
            sources[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    report['source_hashes'] = sources
    out = ROOT / 'qa/m0-12/integration.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'{report["result"]} M0-12 integration gate -> {out}')
    if report['result'] != 'PASS':
        sys.exit(1)


if __name__ == '__main__':
    main()
