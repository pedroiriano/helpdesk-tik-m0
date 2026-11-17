"""RM0-04 editorial and media HTTP checks on a disposable PostgreSQL network."""
import hashlib
import json
from pathlib import Path
import subprocess

from test_owner_migrations import MigrationGate, ROOT


def main():
    gate = MigrationGate()
    network = gate.name + '-net'
    image = 'helpdesk-m0-rm004-test:0.1.0'
    output = ROOT / 'qa/remediation/rm0-04/editorial-integration.json'
    input_paths = sorted(
        path for folder in ('backend', 'migrations', 'seeds')
        for path in (ROOT / folder).rglob('*') if path.is_file() and '__pycache__' not in path.parts
    ) + [Path(__file__), ROOT / 'scripts/test_owner_migrations.py']

    def source_hashes():
        return {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in input_paths}

    captured = source_hashes()
    report = {
        'command': 'python -X utf8 scripts/test_rm0_04_editorial.py',
        'cwd': str(ROOT),
        'source_hashes': captured,
        'host_ports': [],
        'persistent_volumes': [],
    }
    network_created = False
    try:
        subprocess.run(
            ['docker', 'build', '--pull=false', '--target', 'source', '-t', image,
             '-f', 'infra/docker/backend.Dockerfile', '.'],
            cwd=ROOT, capture_output=True, text=True, timeout=360, check=True,
        )
        gate.docker('network', 'create', '--internal', network)
        network_created = True
        gate.provision(network)
        gate.apply()
        seed = (ROOT / 'seeds/m0-03-lab.sql').read_text(encoding='utf-8')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')
        gate.sql("""
            INSERT INTO knowledge.media
                (id, principal_id, org_id, storage_key, status, visibility, mime,
                 size_bytes, sha256, alt, caption, license, source)
            SELECT id::uuid, '20000000-0000-4000-8000-000000000014',
                   '10000000-0000-4000-8000-000000000001',
                   id, status, 'PRIVATE', 'image/png', 8,
                   decode(repeat('01', 32), 'hex'), alt, caption, 'TEST', 'synthetic lab'
            FROM (VALUES
                ('84000000-0000-4000-8000-000000000001', 'CLEAN', 'media-rm004 a', 'fixture'),
                ('84000000-0000-4000-8000-000000000002', 'QUARANTINED', 'media-rm004 b', 'karantina-rm004'),
                ('84000000-0000-4000-8000-000000000003', 'CLEAN', 'media-rm004 c', 'fixture')
            ) AS fixture(id, status, alt, caption);
        """)
        result = gate.docker(
            'run', '--rm', '--pull', 'never', '--network', network,
            '--cpus', '1', '--memory', '1024m', '-e', 'HELPDESK_RM004_TEST=1',
            '-e', 'HELPDESK_TEST_DB_HOST=' + gate.name,
            '-e', 'HELPDESK_TEST_PASSWORD=' + gate.password,
            image, 'go', 'test', './internal/bootstrap', '-run', '^TestRM004Editorial$', '-v',
            '-count=1', ok=False, timeout=360,
        )
        report['go_output'] = result.stdout + result.stderr
        if result.returncode or '--- PASS: TestRM004Editorial' not in result.stdout:
            raise RuntimeError('Editorial integration failed')
        if source_hashes() != captured:
            raise RuntimeError('Source changed during editorial integration')
        report['result'] = 'PASS'
    except subprocess.CalledProcessError as error:
        report.update(result='FAIL', error=error.stderr[-3000:])
    except Exception as error:
        report.update(result='FAIL', error=str(error).replace(gate.password, '[REDACTED]'))
    finally:
        try:
            gate.cleanup()
            if network_created:
                gate.docker('network', 'rm', network)
            report['cleanup'] = 'PASS'
        except Exception as error:
            report.update(result='FAIL', cleanup=str(error).replace(gate.password, '[REDACTED]'))
        output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(report['result'], 'RM0-04 editorial integration')
    if report['result'] != 'PASS':
        print(report.get('go_output', report.get('error', ''))[-3000:])
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
