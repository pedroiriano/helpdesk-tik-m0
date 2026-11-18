import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PRIVATE_KEY_RE = re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----')
TELEGRAM_TOKEN_RE = re.compile(r'\b[0-9]{8,11}:AA[A-Za-z0-9_-]{30,}\b')


def git_tracked_files():
    out = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True, encoding='utf-8')
    return [line.strip() for line in out.splitlines() if line.strip()]


def check_secrets_and_hygiene(tracked):
    findings = []
    for rel in tracked:
        norm = rel.replace('\\', '/')
        if norm.startswith('.local/') or norm.endswith('.env') or norm.endswith('.pem') or norm.endswith('.key'):
            findings.append(f'sensitive tracked file: {rel}')
            continue
        p = ROOT / rel
        if not p.is_file() or p.stat().st_size > 2_000_000:
            continue
        if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp', '.woff2', '.ttf', '.ico', '.pdf'):
            continue
        try:
            text = p.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        if PRIVATE_KEY_RE.search(text) and 'test' not in norm.lower() and 'runbooks/' not in norm.lower():
            findings.append(f'private key marker in {rel}')
        if TELEGRAM_TOKEN_RE.search(text) and 'test' not in norm.lower():
            findings.append(f'telegram bot token pattern in {rel}')
    return findings


def check_hardening():
    issues = []
    # Dockerfiles must pin images with @sha256: and drop root USER
    for df in sorted((ROOT / 'infra/docker').glob('*.Dockerfile')):
        text = df.read_text(encoding='utf-8')
        froms = [l.strip() for l in text.splitlines() if l.strip().startswith('FROM ')]
        aliases = {'scratch'}
        for f in froms:
            parts = f.split()
            img = parts[1]
            if img not in aliases and '@sha256:' not in img:
                issues.append(f'{df.name}: unpinned FROM {img}')
            if 'AS' in [p.upper() for p in parts]:
                aliases.add(parts[-1])
        if '\nUSER ' not in text and not text.startswith('USER '):
            issues.append(f'{df.name}: missing non-root USER instruction')

    compose_text = (ROOT / 'compose.yaml').read_text(encoding='utf-8')
    prod_text = (ROOT / 'compose.prod.yml').read_text(encoding='utf-8')
    for required in ('HELPDESK_LAB_AUTH: \'0\'', 'CLAMAV_NO_FRESHCLAMD: \'false\'', 'nginx.prod.conf'):
        if required not in prod_text:
            issues.append(f'compose.prod.yml missing hardening setting: {required}')
    for required in ('cap_drop: [ALL]', 'no-new-privileges:true', 'read_only: true', '127.0.0.1:18090:8080'):
        if required not in compose_text:
            issues.append(f'compose.yaml missing container hardening: {required}')

    routes_text = (ROOT / 'infra/nginx/routes.conf').read_text(encoding='utf-8')
    prod_nginx = (ROOT / 'infra/nginx/nginx.prod.conf').read_text(encoding='utf-8')
    if "'unsafe-inline'" in routes_text or "'unsafe-eval'" in routes_text:
        issues.append('infra/nginx/routes.conf allows unsafe CSP directive')
    for req in ('X-Content-Type-Options nosniff', 'X-Frame-Options DENY', 'Referrer-Policy no-referrer', 'Permissions-Policy'):
        if req not in routes_text:
            issues.append(f'infra/nginx/routes.conf missing header: {req}')
    for req in ('TLSv1.2 TLSv1.3', 'Strict-Transport-Security', 'server_tokens off'):
        if req not in prod_nginx:
            issues.append(f'infra/nginx/nginx.prod.conf missing TLS hardening: {req}')

    # Contract & migration checksum integrity
    api = json.loads((ROOT / 'contracts/openapi/business.json').read_text(encoding='utf-8'))
    not_impl = [
        op.get('x-command')
        for methods in api.get('paths', {}).values()
        for op in methods.values()
        if op.get('x-runtime-status') == 'NOT_IMPLEMENTED'
    ]
    if not_impl:
        issues.append(f'OpenAPI NOT_IMPLEMENTED operations remain: {not_impl}')

    lock_files = ['backend/go.sum', 'frontend/package-lock.json', 'migrations/checksums.sha256']
    for lf in lock_files:
        if not (ROOT / lf).is_file():
            issues.append(f'missing lock/checksum file: {lf}')

    return issues


def build_sbom(tracked):
    components = []

    # 1. Container base images pinned by digest
    seen_images = set()
    for rel in ['compose.yaml'] + [p.relative_to(ROOT).as_posix() for p in sorted((ROOT / 'infra/docker').glob('*.Dockerfile'))]:
        for line in (ROOT / rel).read_text(encoding='utf-8').splitlines():
            m = re.search(r'([a-z0-9.-]+(?:/[a-z0-9._-]+)*:[a-z0-9._-]+@sha256:[a-f0-9]{64})', line)
            if m and m.group(1) not in seen_images:
                ref = m.group(1)
                seen_images.add(ref)
                name_tag, digest = ref.split('@', 1)
                name, ver = name_tag.rsplit(':', 1)
                components.append({
                    'type': 'container',
                    'name': name,
                    'version': ver,
                    'hashes': [{'alg': 'SHA-256', 'content': digest.split(':', 1)[1]}],
                    'purl': f'pkg:oci/{name.split("/")[-1]}@{digest}',
                })

    # 2. Direct & indirect Go modules from go.mod / go.sum
    go_mod = (ROOT / 'backend/go.mod').read_text(encoding='utf-8')
    for m in re.finditer(r'^\s*([a-zA-Z0-9._/-]+)\s+(v[0-9]+\.[0-9]+\.[0-9]+[^\s]*)', go_mod, re.M):
        mod, ver = m.group(1), m.group(2)
        if mod == 'go':
            continue
        components.append({
            'type': 'library',
            'name': mod,
            'version': ver,
            'purl': f'pkg:golang/{mod}@{ver}',
        })

    # 3. Node packages from frontend/package-lock.json
    pkg_lock = json.loads((ROOT / 'frontend/package-lock.json').read_text(encoding='utf-8'))
    for pkg_path, meta in sorted(pkg_lock.get('packages', {}).items()):
        if not pkg_path or not isinstance(meta, dict) or 'version' not in meta:
            continue
        name = meta.get('name') or pkg_path.split('node_modules/')[-1]
        entry = {
            'type': 'library',
            'name': name,
            'version': meta['version'],
            'purl': f'pkg:npm/{name}@{meta["version"]}',
        }
        if 'integrity' in meta and meta['integrity'].startswith('sha512-'):
            entry['hashes'] = [{'alg': 'SHA-512', 'content': meta['integrity']}]
        components.append(entry)

    # 4. Contract Python pinned packages
    for req in ('tests/contract/requirements.txt', 'tests/contract/openapi-requirements.txt'):
        for line in (ROOT / req).read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '==' not in line:
                continue
            name, ver = [x.strip() for x in line.split('==', 1)]
            components.append({
                'type': 'library',
                'name': name,
                'version': ver,
                'purl': f'pkg:pypi/{name}@{ver}',
            })

    manifest_hash = hashlib.sha256(json.dumps(tracked).encode('utf-8')).hexdigest()
    return {
        'bomFormat': 'CycloneDX',
        'specVersion': '1.5',
        'version': 1,
        'metadata': {
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'component': {
                'type': 'application',
                'name': 'helpdesk-tik-depok-m0',
                'version': 'rm0-05-rc4',
            },
            'properties': [{'name': 'helpdesk:tracked_file_digest', 'value': manifest_hash}],
        },
        'components': components,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, default=Path('qa/remediation/rm0-05/security-gate.json'))
    parser.add_argument('--sbom', type=Path, default=Path('qa/remediation/rm0-05/sbom-m0.json'))
    args = parser.parse_args()

    tracked = git_tracked_files()
    secret_findings = check_secrets_and_hygiene(tracked)
    hardening_issues = check_hardening()
    sbom = build_sbom(tracked)

    sbom_path = args.sbom if args.sbom.is_absolute() else ROOT / args.sbom
    sbom_path.parent.mkdir(parents=True, exist_ok=True)
    sbom_path.write_text(json.dumps(sbom, indent=2) + '\n', encoding='utf-8')

    all_issues = secret_findings + hardening_issues
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'suite': 'security-and-sbom-local-gate',
        'command': f'python -X utf8 scripts/security_gate.py --report {args.report.as_posix()} --sbom {args.sbom.as_posix()}',
        'tracked_files_audited': len(tracked),
        'sbom_path': args.sbom.as_posix(),
        'sbom_components': len(sbom['components']),
        'secret_findings': secret_findings,
        'hardening_issues': hardening_issues,
        'remote_ci_scanners': 'Trivy container CVE & govulncheck run on GitHub Actions security-and-sbom job (not installed on offline Windows host)',
        'result': 'FAIL' if all_issues else 'PASS',
    }
    report_path = args.report if args.report.is_absolute() else ROOT / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    if all_issues:
        for item in all_issues:
            print('FAIL:', item)
        raise SystemExit(1)
    print(f'PASS security gate ({len(tracked)} files audited, {len(sbom["components"])} SBOM components) -> {args.report.as_posix()}')


if __name__ == '__main__':
    main()
