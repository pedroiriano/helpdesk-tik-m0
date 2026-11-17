"""Run contract-only gates. Docker migration gate is an explicit separate command."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main(report_path='qa/m0-02/contracts.json'):
    tools = ROOT/'.local/openapi-tools'
    if not tools.is_dir():
        raise SystemExit('NOT_RUN: install tests/contract/openapi-requirements.txt in .local/openapi-tools')
    env = {**os.environ, 'PYTHONPATH': str(tools), 'PYTHONDONTWRITEBYTECODE': '1'}
    commands = [
        [sys.executable,'scripts/build_business_contracts.py','--check'],
        [sys.executable,'scripts/build_owner_migrations.py','--check'],
        [sys.executable,'-m','unittest','discover','-s','tests/contract','-p','test_*.py','-v'],
    ]
    results = []
    for command in commands:
        result = subprocess.run(command,cwd=ROOT,env=env,text=True,capture_output=True)
        results.append({'argv':command,'working_directory':str(ROOT),'exit_code':result.returncode,'output':result.stdout+result.stderr})
        if result.returncode:
            print(result.stdout+result.stderr)
            break
    paths = sorted(set([p for group in ('contracts','migrations','tests/contract') for p in (ROOT/group).rglob('*') if p.is_file() and '__pycache__' not in p.parts] + [Path(__file__),ROOT/'scripts/build_business_contracts.py',ROOT/'scripts/build_owner_migrations.py',ROOT/'scripts/contract_validation.py',ROOT/'scripts/m0_03_contracts.py',ROOT/'scripts/m0_04_contracts.py']))
    report = {'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'shared executable specification regressions; real HTTP/auth enforcement evidence is recorded separately',
              'commands':results,'source_hashes':{str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
              'result':'PASS' if all(r['exit_code']==0 for r in results) else 'FAIL'}
    output = ROOT/report_path
    if not output.resolve().is_relative_to((ROOT/'qa').resolve()):raise SystemExit('invalid QA output target')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(report['result']+' contract gate; report '+report_path)
    return 0 if report['result']=='PASS' else 1


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--report',default='qa/m0-02/contracts.json');args=parser.parse_args()
    sys.exit(main(args.report))
