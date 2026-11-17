"""Backup/restore proof using disposable, label-verified DBs and private fixture blobs."""

import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from test_owner_migrations import MigrationGate, ROOT

IMAGE = 'helpdesk-m0-rm003-test:0.1.0'
TICKET = '91000000-0000-4000-8000-000000000001'
BLOB = '91000000-0000-4000-8000-000000000002'
ATTACHMENT = '91000000-0000-4000-8000-000000000003'
EPISODE = '91000000-0000-4000-8000-000000000004'
JOB = '91000000-0000-4000-8000-000000000005'
EVENT = '91000000-0000-4000-8000-000000000006'
ATTEMPT = '91000000-0000-4000-8000-000000000007'
OWNER = '10000000-0000-4000-8000-000000000001'
REQUESTER = '20000000-0000-4000-8000-000000000001'
SERVICE = '30000000-0000-4000-8000-000000000001'
LABEL = 'rm0-03-recovery'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prime(source, size, digest):
    source.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" +
               (ROOT / 'seeds/m0-03-lab.sql').read_text(encoding='utf-8') + "COMMIT;")
    return source.sql(f"""
      INSERT INTO intake.tickets(id,number,service_id,form_version,policy_version,requester_kind,requester_id,
        service_owner_org_id,state,title,description,accepted_at,episode_id,resolution_due_at)
      VALUES('{TICKET}','HD-RM003-RECOVERY','{SERVICE}',1,1,'PUBLIC','{REQUESTER}',
        '{OWNER}','OPEN','Fixture recovery','Rekaman sintetis',now(),'{EPISODE}',now()+interval '1 day');
      INSERT INTO intake.attachments(id,ticket_id,principal_id,storage_key,status,mime,size_bytes,sha256,alt,license)
      VALUES('{ATTACHMENT}','{TICKET}','{REQUESTER}','{BLOB}','CLEAN','application/pdf',{size},
        decode('{digest}','hex'),'Fixture recovery','SYNTHETIC');
      INSERT INTO escalation.jobs(id,ticket_id,attempt_id,expected_version,kind,idempotency_key,due_at,state)
      VALUES('{JOB}','{TICKET}','{ATTEMPT}',1,'AUTO_CLOSE','rm003-restore-fixture',now()+interval '1 day','PENDING');
      INSERT INTO intake.outbox(event_id,event_type,schema_version,aggregate_id,aggregate_version,occurred_at,correlation_id,payload,digest)
      VALUES('{EVENT}','RecoveryFixture',1,'{TICKET}',1,now(),'{EVENT}','{{}}',decode(repeat('00',32),'hex'));
      SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
    """)


def db_probe(gate):
    return gate.sql(f"""
      SELECT id,checksum FROM migration_control.ledger ORDER BY id;
      SELECT id,episode_id,service_owner_org_id,state,version,service_snapshot FROM intake.tickets WHERE id='{TICKET}';
      SELECT id,storage_key,size_bytes,encode(sha256,'hex') FROM intake.attachments WHERE id='{ATTACHMENT}';
      SELECT id,state,attempts,expected_version FROM escalation.jobs WHERE id='{JOB}';
      SELECT event_id,aggregate_id,aggregate_version,digest FROM intake.outbox WHERE event_id='{EVENT}';
    """)


def main():
    source, target = MigrationGate(), MigrationGate()
    network = source.name + '-recovery'
    created = False
    report = {'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'scope': 'Two Docker tmpfs PostgreSQL instances, one synthetic ticket/private blob/event/job; no working DB',
              'host_ports': [], 'persistent_volumes': []}
    try:
        result = subprocess.run(['docker','build','--pull=false','--target','source','-t',IMAGE,
                                 '-f','infra/docker/backend.Dockerfile','.'], cwd=ROOT, capture_output=True, text=True, timeout=360)
        if result.returncode:
            raise RuntimeError(result.stderr[-1400:])
        source.docker('network', 'create', '--internal', '--label', 'helpdesk.scope='+LABEL, network)
        created = True
        source.provision(network)
        source.apply()
        target.provision(network)
        target.apply()
        with tempfile.TemporaryDirectory(prefix='helpdesk-rm003-recovery-') as work:
            root = Path(work)
            original = root / 'source-private'
            restored = root / 'restore-private'
            original.mkdir()
            restored.mkdir()
            fixture = b'%PDF-1.4\n% Synthetic recovery fixture\n%%EOF\n'
            (original / BLOB).write_bytes(fixture)
            digest = sha(original / BLOB)
            checkpoint_ms = int(prime(source, len(fixture), digest))
            expected = db_probe(source)
            source.docker('exec',source.name,'pg_dump','-U','postgres','-d','helpdesk','-Fc','-f','/tmp/rm003.backup')
            dump = root / 'metadata.dump'
            source.docker('cp',source.name+':/tmp/rm003.backup',str(dump))
            backup = root / 'blob.backup'
            backup.write_bytes((original / BLOB).read_bytes())
            dump_sha, blob_sha = sha(dump), sha(backup)
            report['backup_manifest'] = {
                'metadata_sha256': dump_sha, 'metadata_bytes': dump.stat().st_size,
                'blob_sha256': blob_sha, 'blob_bytes': backup.stat().st_size,
                'migration_manifest_sha256': sha(ROOT/'migrations/manifest.json'),
                'config_sha256': {name: sha(ROOT/name) for name in ('compose.yaml','planning/technology-lock.json')},
            }
            source.docker('cp',str(dump),target.name+':/tmp/rm003.backup')
            copied_sha = target.docker('exec',target.name,'sha256sum','/tmp/rm003.backup').stdout.split()[0]
            assert copied_sha == dump_sha
            restore_start = time.monotonic()
            # The target was provisioned above with tmpfs and has no host port. Restore into a new database.
            target.docker('exec',target.name,'createdb','-U','postgres','rm003_restore')
            target.docker('exec',target.name,'pg_restore','--exit-on-error','-U','postgres',
                          '-d','rm003_restore','/tmp/rm003.backup',timeout=120)
            target.docker('exec',target.name,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1',
                          '-c','ALTER DATABASE helpdesk RENAME TO migration_fixture',
                          '-c','ALTER DATABASE rm003_restore RENAME TO helpdesk')
            (restored / BLOB).write_bytes(backup.read_bytes())
            assert sha(restored / BLOB) == blob_sha
            assert db_probe(target) == expected
            report['rpo_fixture_missing_commits'] = 0
            report['source_latest_fixture_commit_ms'] = checkpoint_ms
            for attempt in (1, 2):
                result = target.docker('run','--rm','--pull','never','--network',network,'--cpus','1','--memory','1024m',
                  '--label','helpdesk.scope='+LABEL,
                  '--mount',f'type=bind,source={restored},target=/restore-fixture,readonly',
                  '-e','HELPDESK_RM003_RECOVERY=1','-e','HELPDESK_TEST_DB_HOST='+target.name,
                  '-e','HELPDESK_TEST_PASSWORD='+target.password,'-e','HELPDESK_TEST_BLOB_DIGEST='+blob_sha,
                  IMAGE,'go','test','./internal/bootstrap','-run','^TestRM003RecoveryRead$','-count=1','-v',
                  ok=False,timeout=360)
                if result.returncode:
                    raise RuntimeError(result.stdout[-2000:]+result.stderr[-1000:])
                report[f'fresh_app_process_{attempt}'] = 'PASS'
                if attempt == 1:
                    report['rto_seconds_to_first_http_read'] = round(time.monotonic()-restore_start,3)
            report['result'] = 'PASS'
    except Exception as e:
        report.update(result='FAIL',error=str(e))
    finally:
        try:
            target.cleanup()
            source.cleanup()
            if created:
                info=json.loads(source.docker('network','inspect',network).stdout)[0]
                if info['Labels'].get('helpdesk.scope') != LABEL:
                    raise RuntimeError('recovery network label mismatch')
                source.docker('network','rm',network)
            report['cleanup']='PASS'
        except Exception as e:
            report.update(result='FAIL',cleanup=str(e))
    dest = ROOT/'qa/remediation/rm0-03/recovery.json'
    dest.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f"{report['result']} RM0-03 recovery -> {dest}")
    return report['result'] == 'PASS'


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
