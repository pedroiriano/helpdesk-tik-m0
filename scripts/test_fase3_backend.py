import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from test_owner_migrations import MigrationGate, ROOT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, default=Path('qa/remediation/rm0-05/fase3-backend.json'))
    args = parser.parse_args()

    out = args.report if args.report.is_absolute() else ROOT / args.report
    out.parent.mkdir(parents=True, exist_ok=True)
    gate = MigrationGate()
    network = gate.name + '-net'
    worker = gate.name + '-go'
    created_network = False
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'suite': 'TestFase3Integration',
        'scope': 'fase3-prod-auth-sso-m9-delivery-retention-purge',
        'command': 'python -X utf8 scripts/test_fase3_backend.py --report ' + args.report.as_posix(),
        'status': 'FAIL',
    }
    try:
        build = subprocess.run(
            ['docker', 'build', '--pull=false', '--target', 'source', '-t', 'helpdesk-m0-fase3-test:0.1.0', '-f', 'infra/docker/backend.Dockerfile', '.'],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding='utf-8',
        )
        if build.returncode:
            raise RuntimeError(build.stderr[-4000:])
        gate.docker('network', 'create', '--internal', '--label', 'helpdesk.scope=fase3-test', network)
        created_network = True
        gate.provision(network)
        gate.apply()
        seed = '\n'.join((ROOT / 'seeds' / file).read_text(encoding='utf-8') for file in ('m0-03-lab.sql', 'rm0-03-sla.sql'))
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        result = gate.docker(
            'run', '--rm', '--pull', 'never', '--name', worker,
            '--label', 'helpdesk.scope=fase3-test',
            '--network', network,
            '-e', 'HELPDESK_FASE3_TEST=1',
            '-e', 'HELPDESK_TEST_DB_HOST=' + gate.name,
            '-e', 'HELPDESK_TEST_PASSWORD=' + gate.password,
            'helpdesk-m0-fase3-test:0.1.0',
            'go', 'test', './internal/bootstrap', '-run', '^TestFase3Integration$', '-count=1', '-v',
            ok=False, timeout=360,
        )
        report['go_output'] = result.stdout + result.stderr
        if result.returncode or '--- PASS: TestFase3Integration' not in result.stdout:
            raise RuntimeError(report['go_output'][-6000:])
        report['result'] = 'PASS'
        report['status'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL', status='FAIL', error=str(error))
        raise
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
            report['cleanup'] = f'FAIL: {error}'
        out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PASS TestFase3Integration ->', args.report.as_posix())


if __name__ == '__main__':
    main()
