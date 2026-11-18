"""Fase 2 Go/HTTP/PostgreSQL integration verification on an isolated Docker network."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess
import sys

from test_owner_migrations import MigrationGate, ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, default=Path('qa/remediation/rm0-05/fase2-backend.json'))
    args = parser.parse_args()
    gate = MigrationGate()
    network = gate.name + '-net'
    worker = gate.name + '-go'
    created_network = False
    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'Fase 2 HTTP/PostgreSQL operational completion, bulk ACL/CAS, scheduler listing, and M4-M7 rule endpoints on isolated PG 18.7',
        'command': 'python -X utf8 scripts/test_fase2_backend.py --report ' + args.report.as_posix(),
    }
    try:
        build = subprocess.run(
            ['docker', 'build', '--pull=false', '--target', 'source', '-t', 'helpdesk-m0-fase2-test:0.1.0', '-f', 'infra/docker/backend.Dockerfile', '.'],
            cwd=ROOT, capture_output=True, text=True, timeout=360
        )
        if build.returncode:
            raise RuntimeError(build.stderr[-4000:])
        gate.docker('network', 'create', '--internal', '--label', 'helpdesk.scope=fase2-test', network)
        created_network = True
        gate.provision(network)
        gate.apply()
        seed = '\n'.join((ROOT / 'seeds' / file).read_text(encoding='utf-8') for file in ('m0-03-lab.sql', 'rm0-03-sla.sql'))
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        result = gate.docker(
            'run', '--rm', '--pull', 'never', '--name', worker,
            '--label', 'helpdesk.scope=fase2-test',
            '--network', network, '--cpus', '1', '--memory', '1024m',
            '-e', 'HELPDESK_FASE2_TEST=1',
            '-e', 'HELPDESK_TEST_DB_HOST=' + gate.name,
            '-e', 'HELPDESK_TEST_PASSWORD=' + gate.password,
            'helpdesk-m0-fase2-test:0.1.0',
            'go', 'test', './internal/bootstrap', '-run', '^TestFase2Integration$', '-count=1', '-v',
            ok=False, timeout=360
        )
        report['go_output'] = result.stdout + result.stderr
        if result.returncode or '--- PASS: TestFase2Integration' not in result.stdout:
            raise RuntimeError(report['go_output'][-6000:])
        report['result'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL', error=str(error))
    finally:
        try:
            current = gate.docker('inspect', worker, ok=False)
            if current.returncode == 0:
                gate.docker('rm', '-f', worker)
            gate.cleanup()
            if created_network:
                gate.docker('network', 'rm', network)
            report['cleanup'] = 'PASS'
        except Exception as error:
            report.update(result='FAIL', cleanup=str(error))
        dest = ROOT / args.report
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"{report['result']} Fase 2 backend integration -> {dest}")
        if report['result'] != 'PASS':
            sys.exit(1)


if __name__ == '__main__':
    main()
