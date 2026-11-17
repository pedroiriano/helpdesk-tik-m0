"""Regenerate the Go role ceiling snapshot from canonical policy; never updates DB grants."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
    roles=json.loads((ROOT/'contracts/policy/permissions.v1.json').read_text(encoding='utf-8'))['roles']
    source='// Code generated from contracts/policy/permissions.v1.json; DO NOT EDIT.\npackage domain\n\nvar RolePermissions = map[string][]string{\n'
    source+=''.join(json.dumps(name)+': {'+','.join(json.dumps(v) for v in role['permissions'])+'},\n' for name,role in roles.items())+'}\n'
    formatted=subprocess.run(['gofmt'],input=source,capture_output=True,text=True,check=True).stdout
    target=ROOT/'backend/internal/modules/m1/internal/domain/permissions_generated.go'
    if args.write:target.write_text(formatted,encoding='utf-8',newline='\n')
    elif target.read_text(encoding='utf-8')!=formatted:raise SystemExit('FAIL canonical Go role snapshot drift; review policy and run --write')
    print('PASS canonical Go role snapshot')
