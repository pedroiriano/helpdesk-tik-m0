"""Inspect resolved Go imports; enforce module ports and platform isolation."""
import json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'helpdesk.local/m0/internal/'

def check(packages, edges):
    errors = []
    for package in packages:
        source = package['ImportPath'].removeprefix(PREFIX)
        own = re.match(r'modules/(m[1-9])(?:/|$)', source)
        for dependency in package.get('Imports', []) + package.get('TestImports', []) + package.get('XTestImports', []):
            target = dependency.removeprefix(PREFIX)
            other = re.match(r'modules/(m[1-9])(?:/(.*))?$', target)
            if source.startswith('platform/') and other:
                errors.append(f'{source}: platform imports business module')
            if own:
                if target.startswith('bootstrap'):
                    errors.append(f'{source}: reverse bootstrap dependency')
                if other and own[1] != other[1]:
                    if other[2] != 'api' or other[1].upper() not in edges[own[1].upper()]:
                        errors.append(f'{source}: forbidden dependency {target}')
                if '/api' in source and other and '/internal/' in target:
                    errors.append(f'{source}: public API imports private implementation')
    if errors:
        raise ValueError('\n'.join(errors))

def main():
    result = subprocess.run(['go','list','-json','./...'],cwd=ROOT/'backend',capture_output=True,text=True,check=True)
    decoder = json.JSONDecoder(); data=result.stdout.strip(); packages=[]
    while data:
        item,end=decoder.raw_decode(data);packages.append(item);data=data[end:].lstrip()
    edges=json.loads((ROOT/'contracts/dependencies.json').read_text())['sync_business_ports']
    check(packages,edges)
    print(f'PASS module boundaries ({len(packages)} Go packages)')

if __name__ == '__main__':
    main()
