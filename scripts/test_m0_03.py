"""M0-03 Go/HTTP/PostgreSQL integration, on a new internal Docker network only."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from test_owner_migrations import MigrationGate, ROOT


def main(report_path='qa/m0-03/integration.json'):
    gate=MigrationGate()
    network=gate.name+'-net'
    worker=gate.name+'-go'
    created_network=False
    report={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'isolated M1/M2 use cases, real HTTP and PostgreSQL; no working DB writes','command':'python scripts/test_m0_03.py','host_ports':[],'persistent_volumes':[]}
    try:
        build=subprocess.run(['docker','build','--pull=false','--target','source','-t','helpdesk-m0-m003-test:0.1.0','-f','infra/docker/backend.Dockerfile','.'],cwd=ROOT,capture_output=True,text=True,timeout=120)
        if build.returncode:raise RuntimeError(build.stderr[-4000:])
        gate.docker('network','create','--internal','--label','helpdesk.scope=m0-03-test',network);created_network=True
        gate.provision(network)
        gate.apply()
        seed=(ROOT/'seeds/m0-03-lab.sql').read_text(encoding='utf-8')
        gate.sql('BEGIN;'+seed+'COMMIT;',error='P0001')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';"+seed+'COMMIT;')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';"+seed+'COMMIT;')
        result=gate.docker('run','--rm','--pull','never','--name',worker,'--label','helpdesk.scope=m0-03-test','--network',network,'--cpus','1','--memory','1024m','-e','HELPDESK_M003_TEST=1','-e','HELPDESK_TEST_DB_HOST='+gate.name,'-e','HELPDESK_TEST_PASSWORD='+gate.password,'helpdesk-m0-m003-test:0.1.0','go','test','./internal/bootstrap','-run','^TestM003Integration$','-count=1','-v',ok=False,timeout=180)
        report['go_output']=result.stdout+result.stderr
        if result.returncode or '--- PASS: TestM003Integration' not in result.stdout:raise RuntimeError(report['go_output'][-6000:])
        report['result']='PASS'
    except Exception as error:
        report.update(result='FAIL',error=str(error))
    finally:
        try:
            current=gate.docker('inspect',worker,ok=False)
            if current.returncode==0:
                info=json.loads(current.stdout)[0]
                if info['Config']['Labels'].get('helpdesk.scope')!='m0-03-test':raise RuntimeError('worker cleanup label mismatch')
                gate.docker('rm','-f',worker)
            gate.cleanup()
            if created_network:
                info=json.loads(gate.docker('network','inspect',network).stdout)[0]
                if info['Labels'].get('helpdesk.scope')!='m0-03-test':raise RuntimeError('network cleanup label mismatch')
                gate.docker('network','rm',network)
            report['cleanup']='PASS'
        except Exception as error:report.update(result='FAIL',cleanup=str(error))
        files=[p for group in ('backend','migrations','seeds') for p in (ROOT/group).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
        files += [Path(__file__),ROOT/'scripts/test_owner_migrations.py']
        report['source_hashes']={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        dest=ROOT/report_path;
        if not dest.resolve().is_relative_to((ROOT/'qa').resolve()):raise RuntimeError('invalid QA report path')
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(report['result']+' M0-03 isolated Go/HTTP/PostgreSQL integration')
    if report['result']!='PASS':print(report.get('error',report.get('cleanup')))
    return 0 if report['result']=='PASS' else 1


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--report',default='qa/m0-03/integration.json');args=parser.parse_args();sys.exit(main(args.report))
