"""Real PostgreSQL role/DDL/ledger integration in a new isolated disposable container.

No compose up, host port, persistent volume, working DB, or existing container writes.
Only the container created by this invocation is cleaned up, after label verification.
"""
import csv
import datetime
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'postgres:18.7-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015'


class MigrationGate:
    def __init__(self):
        self.name = 'helpdesk-m0-contract-'+uuid.uuid4().hex[:10]
        self.password = secrets.token_hex(24)
        self.checks = []
        self.created = False

    def docker(self, *args, input=None, ok=True, timeout=60):
        try:
            result = subprocess.run(['docker',*args],input=input,text=True,capture_output=True,timeout=timeout)
        except subprocess.TimeoutExpired:
            raise RuntimeError(f'Docker command timed out after {timeout}s; arguments redacted') from None
        if ok and result.returncode:
            # Arguments/environment/passwords never logged.
            raise RuntimeError(result.stderr[-1800:])
        return result

    def sql(self, text, error=None):
        result = self.docker('exec','-i',self.name,'psql','-X','-U','postgres','-d','helpdesk','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate',input=text,ok=False)
        if error:
            assert result.returncode != 0 and error in result.stderr, result.stderr
        else:
            assert result.returncode == 0,result.stderr
        return result.stdout.strip()

    def apply(self, fail=None):
        env = ['PGHOST=127.0.0.1','PGDATABASE=helpdesk','PGUSER=postgres','PGPASSWORD='+self.password]
        env += [f'M{i}_PASSWORD='+self.password for i in range(1,10)]
        args = ['exec']
        for item in env:
            args += ['-e',item]
        result = self.docker(*args,self.name,'sh','/workspace/migrations/apply.sh',ok=False)
        if fail:
            assert result.returncode != 0 and fail in result.stdout+result.stderr,result.stderr
        else:
            assert result.returncode == 0,result.stderr

    def check(self, name, fn):
        fn()
        self.checks.append({'name':name,'result':'PASS'})

    def wrapper(self):
        # Fixture secrets live only inside this disposable container, never source/logs.
        self.docker('exec',self.name,'sh','-c',"mkdir -p /run/secrets; for owner in postgres m1 m2 m3 m4 m5 m6 m7 m8 m9; do printf '%s' '"+self.password+"' > /run/secrets/$owner; done")
        self.docker('exec','-e','PGHOST=127.0.0.1',self.name,'sh','/workspace/infra/postgres/migrate.sh')

    def provision(self, network="none"):
        result = self.docker('run','--detach','--rm','--pull','never','--name',self.name,'--label','helpdesk.scope=m0-02-contract-test','--network',network,'--tmpfs','/var/lib/postgresql:rw,size=512m','--memory','768m','--cpus','1','-e','POSTGRES_DB=helpdesk','-e','POSTGRES_PASSWORD='+self.password,IMAGE)
        self.created = True
        info = json.loads(self.docker('inspect',self.name).stdout)[0]
        assert info['HostConfig']['NetworkMode']==network and not info['HostConfig'].get('PortBindings')
        assert not any(m['Type']=='volume' for m in info['Mounts'])
        for _ in range(100):
            if self.docker('exec',self.name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','helpdesk',ok=False).returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('disposable PostgreSQL readiness timeout')
        self.docker('exec',self.name,'mkdir','-p','/workspace/infra/postgres','/workspace/migrations')
        self.docker('cp',str(ROOT/'infra/postgres')+'/.',self.name+':/workspace/infra/postgres/')
        self.docker('cp',str(ROOT/'migrations')+'/.',self.name+':/workspace/migrations/')

    def run(self):
        self.provision()
        self.check('fresh_apply_manifest_migrations',self.apply)
        before = self.sql('SELECT id,checksum,applied_at FROM migration_control.ledger ORDER BY id;')
        assert len(before.splitlines()) == len(json.loads((ROOT/'migrations/manifest.json').read_text())['migrations'])
        self.check('idempotent_reapply_through_compose_entrypoint',self.wrapper)
        assert before == self.sql('SELECT id,checksum,applied_at FROM migration_control.ledger ORDER BY id;')
        self.check('nine_owner_roles_real_connections_and_isolation',self.roles)
        self.check('domain_constraints_and_private_media',self.constraints)
        self.check('local_FK_only',self.local_fks)
        self.check('same_owner_event_and_idempotency_constraints',self.events)
        self.check('checksum_lock_and_applied_ledger_drift_rejected',self.drift)
        self.check('failed_migration_rolls_back_DDL_and_ledger',self.rollback)
        self.check('out_of_order_migration_rejected',self.out_of_order)

    def roles(self):
        rows = list(csv.DictReader((ROOT/'contracts/module_registry.csv').open(encoding='utf-8-sig')))
        for row in rows:
            role = 'helpdesk_'+row['module_id'].lower()
            schema = row['schema']
            result = self.docker('exec','-e','PGPASSWORD='+self.password,self.name,'psql','-X','-h','127.0.0.1','-U',role,'-d','helpdesk','-qAt','-c',f'SELECT current_user,version FROM {schema}.schema_version;')
            assert result.stdout.strip() == role+'|1'
            # Every pair checked through actual PostgreSQL role privileges.
            for target in rows:
                visible = self.sql(f"SET ROLE {role}; SELECT has_schema_privilege(current_user,'{target['schema']}','USAGE');")
                assert visible == ('t' if schema==target['schema'] else 'f')
            for statement in (f'CREATE TABLE {schema}.forbidden(id int)', 'SELECT * FROM migration_control.ledger', f'UPDATE {schema}.outbox SET event_type=event_type', f'DELETE FROM {schema}.audit_intents', f'UPDATE {schema}.schema_version SET version=2'):
                self.sql(f'SET ROLE {role}; {statement};',error='42501')
        self.sql('SET ROLE helpdesk_m3; SELECT * FROM identity.subjects;',error='42501')
        self.sql('SET ROLE helpdesk_m9; UPDATE intake.tickets SET version=2;',error='42501')
        self.sql('SET ROLE helpdesk_m9; UPDATE notify_audit.audit_entries SET reason=reason;',error='42501')

    def constraints(self):
        tid = '00000000-0000-4000-8000-000000000001'
        insert = f"INSERT INTO intake.tickets(id,number,service_id,form_version,policy_version,requester_kind,requester_id,service_owner_org_id,state,verification,title,description,accepted_at,episode_id) VALUES('{tid}','LAB-1','{tid}',1,1,'PUBLIC','{tid}','{tid}','OPEN','PENDING','lab','lab','2026-11-04T03:00:00Z','{tid}');"
        self.sql('SET ROLE helpdesk_m3; '+insert)
        self.sql(f"SET ROLE helpdesk_m3; UPDATE intake.tickets SET state='ASSIGNED' WHERE id='{tid}';",error='23514')
        self.sql(f"SET ROLE helpdesk_m3; INSERT INTO intake.resolution_attempts(id,ticket_id,episode_id,resolved_by,summary,resolved_at,confirmation_due_at,outcome) VALUES('{tid}','{tid}','{tid}','{tid}','fixed','2026-11-04T03:00:00Z','2026-11-05T03:00:01Z','PENDING');",error='23514')
        self.sql(f"SET ROLE helpdesk_m3; INSERT INTO intake.confirmation_notifications(id,ticket_id,attempt_id,notification_id,event_id,stored_at) VALUES('{tid}','{tid}','{tid}','{tid}','{tid}',now());",error='23503')
        self.sql(f"SET ROLE helpdesk_m3; INSERT INTO intake.attachments(id,principal_id,storage_key,status,visibility,mime,size_bytes,sha256,alt,license) VALUES('{tid}','{tid}','fixture','CLEAN','PUBLIC','image/png',10,decode(repeat('aa',32),'hex'),'alt','lab');",error='23514')
        self.sql('SET ROLE helpdesk_m3; DELETE FROM intake.tickets;',error='42501')

    def local_fks(self):
        count = self.sql("SELECT count(*) FROM pg_constraint c JOIN pg_class a ON c.conrelid=a.oid JOIN pg_class b ON c.confrelid=b.oid WHERE c.contype='f' AND a.relnamespace<>b.relnamespace;")
        assert count == '0'

    def events(self):
        ident = '00000000-0000-4000-8000-000000000002'
        insert = f"INSERT INTO intake.outbox VALUES('{ident}','TicketCreated',1,'{ident}',1,now(),'{ident}','{{}}',decode(repeat('aa',32),'hex'));"
        self.sql('SET ROLE helpdesk_m3; '+insert)
        self.sql('SET ROLE helpdesk_m3; '+insert,error='23505')
        self.sql(f"SET ROLE helpdesk_m3; INSERT INTO intake.outbox_delivery(event_id,consumer_id,state) VALUES('{ident}','M9','ACKED');",error='23514')
        record = f"INSERT INTO intake.idempotency_records VALUES('scope','CreateTicket','new','1234567890123456',decode(repeat('aa',32),'hex'),201,'{{}}',now(),now()+interval '1 day');"
        self.sql('SET ROLE helpdesk_m3; '+record)
        self.sql('SET ROLE helpdesk_m3; '+record,error='23505')

    def drift(self):
        path = 'migrations/m3/004-contracts.sql'
        original = hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
        self.docker('exec',self.name,'sh','-c',"printf '\n-- deliberate fixture drift\n' >> /workspace/"+path)
        self.apply(fail='did NOT match')
        self.docker('exec',self.name,'sh','-c',f"cd /workspace; changed=$(sha256sum {path} | cut -d ' ' -f 1); sed -i \"s/{original}/$changed/\" migrations/checksums.sha256")
        self.apply(fail='MIGRATION_CHECKSUM_MISMATCH')
        self.docker('cp',str(ROOT/'migrations')+'/.',self.name+':/workspace/migrations/')

    def add_migration(self, id, sql):
        path = f'migrations/m3/{id}-contracts.sql'
        self.docker('exec','-i',self.name,'sh','-c','cat > /workspace/'+path,input=sql)
        # Hash actual container bytes; Windows text stdin can normalize newlines.
        self.docker('exec',self.name,'sh','-c',f"cd /workspace; sha256sum {path} >> migrations/checksums.sha256")

    def rollback(self):
        next_id=f"{max(int(m['id']) for m in json.loads((ROOT/'migrations/manifest.json').read_text())['migrations'])+1:03d}"
        self.add_migration(next_id,'CREATE TABLE intake.rollback_probe(id int); SELECT 1/0;\n')
        self.apply(fail='division by zero')
        assert self.sql("SELECT to_regclass('intake.rollback_probe') IS NULL;") == 't'
        assert self.sql(f"SELECT count(*) FROM migration_control.ledger WHERE id='{next_id}';") == '0'
        self.docker('cp',str(ROOT/'migrations/checksums.sha256'),self.name+':/workspace/migrations/checksums.sha256')

    def out_of_order(self):
        self.add_migration('000','SELECT 1;\n')
        self.apply(fail='MIGRATION_OUT_OF_ORDER')

    def cleanup(self):
        if not self.created:
            return
        label = self.docker('inspect','--format','{{index .Config.Labels "helpdesk.scope"}}',self.name).stdout.strip()
        if label != 'm0-02-contract-test':
            raise RuntimeError('cleanup refused: container label changed')
        self.docker('rm','--force',self.name)


def main(report_path='qa/m0-02/migrations.json'):
    gate = MigrationGate()
    report = {'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'disposable PostgreSQL DDL/ledger/role integration only','image':IMAGE,'container':gate.name,'host_ports':[],'persistent_volumes':[],'command':'python scripts/test_owner_migrations.py'}
    try:
        gate.run()
        report['result'] = 'PASS'
    except Exception as error:
        report.update(result='FAIL',error=str(error))
    finally:
        try:
            gate.cleanup()
            report['cleanup'] = 'PASS' if gate.created else 'NOT_CREATED'
        except Exception as error:
            report.update(result='FAIL',cleanup=str(error))
        report['checks'] = gate.checks
        paths = ['migrations/manifest.json','migrations/checksums.sha256','migrations/apply.sh','infra/postgres/001-foundation.sql','infra/postgres/migrate.sh','compose.yaml','scripts/test_owner_migrations.py']
        paths += [m['path'] for m in json.loads((ROOT/'migrations/manifest.json').read_text())['migrations']]
        report['source_hashes'] = {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
        output = ROOT/report_path
        if not output.resolve().is_relative_to((ROOT/'qa').resolve()):raise RuntimeError('invalid QA output target')
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(report['result']+' isolated migrations; report '+report_path)
    if report['result'] != 'PASS':
        print(report.get('error', report.get('cleanup')))
    return 0 if report['result']=='PASS' else 1


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--report',default='qa/m0-02/migrations.json');args=parser.parse_args()
    sys.exit(main(args.report))
