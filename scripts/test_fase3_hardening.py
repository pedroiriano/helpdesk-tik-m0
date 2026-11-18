import argparse
import http.client
import json
import ssl
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def generate_test_cert(tls_dir: Path) -> None:
    go_prog = (
        'package main\n'
        'import (\n'
        ' "crypto/rand"; "crypto/rsa"; "crypto/x509"; "crypto/x509/pkix"\n'
        ' "encoding/pem"; "math/big"; "net"; "os"; "time"\n'
        ')\n'
        'func main() {\n'
        ' k, err := rsa.GenerateKey(rand.Reader, 2048); if err != nil { panic(err) }\n'
        ' tmpl := x509.Certificate{\n'
        '  SerialNumber: big.NewInt(1),\n'
        '  Subject: pkix.Name{CommonName: "helpdesk.local"},\n'
        '  NotBefore: time.Now().Add(-time.Hour),\n'
        '  NotAfter: time.Now().Add(24 * time.Hour),\n'
        '  KeyUsage: x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,\n'
        '  ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},\n'
        '  DNSNames: []string{"localhost"},\n'
        '  IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},\n'
        ' }\n'
        ' der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &k.PublicKey, k); if err != nil { panic(err) }\n'
        ' _ = os.WriteFile("/out/tls.crt", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0644)\n'
        ' _ = os.WriteFile("/out/tls.key", pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k)}), 0644)\n'
        '}\n'
    )
    (tls_dir / 'gencert.go').write_text(go_prog, encoding='utf-8', newline='\n')
    res = subprocess.run(
        [
            'docker', 'run', '--rm',
            '--label', 'helpdesk.scope=fase3-hardening',
            '-v', f'{tls_dir.resolve()}:/out',
            'golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280',
            'go', 'run', '/out/gencert.go',
        ],
        capture_output=True,
        text=True,
        encoding='utf-8',
        timeout=120,
    )
    if res.returncode:
        raise RuntimeError(f'failed generating disposable TLS cert: {res.stderr}\n{res.stdout}')
    assert (tls_dir / 'tls.crt').is_file() and (tls_dir / 'tls.key').is_file()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, default=Path('qa/remediation/rm0-05/fase3-hardening.json'))
    args = parser.parse_args()

    out = args.report if args.report.is_absolute() else ROOT / args.report
    out.parent.mkdir(parents=True, exist_ok=True)
    cname = f'helpdesk-m0-nginx-prod-test-{int(time.time())}'
    checks = []
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'suite': 'fase3-tls-hsts-hardening',
        'command': 'python -X utf8 scripts/test_fase3_hardening.py --report ' + args.report.as_posix(),
        'checks': checks,
        'result': 'FAIL',
    }
    try:
        subprocess.run(
            ['docker', 'build', '--pull=false', '-t', 'helpdesk-m0-web:0.1.0', '-f', 'infra/docker/web.Dockerfile', '.'],
            cwd=ROOT,
            check=True,
            timeout=180,
        )
        checks.append({'name': 'build_web_image', 'status': 'PASS'})

        subprocess.run(
            ['docker', 'compose', '-f', 'compose.yaml', '-f', 'compose.prod.yml', 'config', '--quiet'],
            cwd=ROOT,
            check=True,
            timeout=30,
        )
        checks.append({'name': 'compose_prod_config', 'status': 'PASS'})

        with tempfile.TemporaryDirectory() as td:
            tls_dir = Path(td)
            generate_test_cert(tls_dir)
            checks.append({'name': 'generate_ephemeral_tls_cert', 'status': 'PASS'})

            t_res = subprocess.run(
                [
                    'docker', 'run', '--rm',
                    '--label', 'helpdesk.scope=fase3-hardening',
                    '--add-host', 'app:127.0.0.1',
                    '-v', f'{tls_dir.resolve()}:/run/tls:ro',
                    'helpdesk-m0-web:0.1.0',
                    '-t', '-c', '/etc/nginx/nginx.prod.conf',
                ],
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=30,
            )
            if t_res.returncode:
                raise RuntimeError('nginx.prod.conf -t failed: ' + t_res.stderr + '\n' + t_res.stdout)
            checks.append({'name': 'nginx_prod_syntax_test', 'status': 'PASS'})

            subprocess.run(
                [
                    'docker', 'run', '-d',
                    '--name', cname,
                    '--label', 'helpdesk.scope=fase3-hardening',
                    '--read-only',
                    '--tmpfs', '/tmp:size=16m,mode=1777',
                    '--cap-drop', 'ALL',
                    '--security-opt', 'no-new-privileges:true',
                    '--add-host', 'app:127.0.0.1',
                    '-p', '127.0.0.1:0:8080',
                    '-p', '127.0.0.1:0:8443',
                    '-v', f'{tls_dir.resolve()}:/run/tls:ro',
                    'helpdesk-m0-web:0.1.0',
                    '-c', '/etc/nginx/nginx.prod.conf',
                ],
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=30,
            )

            port_http = int(subprocess.check_output(['docker', 'port', cname, '8080/tcp'], text=True).strip().splitlines()[0].rsplit(':', 1)[1])
            port_https = int(subprocess.check_output(['docker', 'port', cname, '8443/tcp'], text=True).strip().splitlines()[0].rsplit(':', 1)[1])

            deadline = time.time() + 15
            while True:
                try:
                    c_http = http.client.HTTPConnection('127.0.0.1', port_http, timeout=2)
                    c_http.request('GET', '/healthz')
                    r_hz = c_http.getresponse()
                    body_hz = r_hz.read().decode('utf-8')
                    c_http.close()
                    if r_hz.status == 200 and 'ok' in body_hz:
                        break
                except Exception:
                    pass
                if time.time() > deadline:
                    raise RuntimeError('nginx prod container did not become ready on :8080/healthz')
                time.sleep(0.25)
            checks.append({'name': 'http_loopback_healthz', 'status': 'PASS'})

            c_redir = http.client.HTTPConnection('127.0.0.1', port_http, timeout=5)
            c_redir.request('GET', '/layanan')
            r_redir = c_redir.getresponse()
            r_redir.read()
            redir_loc = r_redir.getheader('Location', '')
            redir_hsts = r_redir.getheader('Strict-Transport-Security')
            c_redir.close()
            assert r_redir.status == 301 and redir_loc == 'https://127.0.0.1/layanan', f'unexpected HTTP redirect: {r_redir.status} {redir_loc}'
            assert redir_hsts is None, 'HSTS header must not be sent on plain HTTP redirect'
            checks.append({'name': 'http_to_https_301_redirect', 'status': 'PASS'})

            ctx_tls = ssl.create_default_context(cafile=str(tls_dir / 'tls.crt'))
            ctx_tls.minimum_version = ssl.TLSVersion.TLSv1_2
            c_tls = http.client.HTTPSConnection('127.0.0.1', port_https, context=ctx_tls, timeout=5)
            c_tls.request('GET', '/')
            r_root = c_tls.getresponse()
            r_root.read()
            tls_ver = c_tls.sock.version()
            hdrs = {k.lower(): v for k, v in r_root.getheaders()}
            c_tls.close()

            assert r_root.status == 200, f'HTTPS / status={r_root.status}'
            assert tls_ver in ('TLSv1.2', 'TLSv1.3'), f'unexpected TLS protocol version: {tls_ver}'
            assert hdrs.get('strict-transport-security') == 'max-age=31536000; includeSubDomains', f'HSTS mismatch: {hdrs}'
            assert hdrs.get('x-content-type-options') == 'nosniff', f'nosniff mismatch: {hdrs}'
            assert hdrs.get('referrer-policy') == 'no-referrer', f'referrer mismatch: {hdrs}'
            assert hdrs.get('x-frame-options') == 'DENY', f'XFO mismatch: {hdrs}'
            assert 'geolocation=()' in hdrs.get('permissions-policy', ''), f'Permissions-Policy missing: {hdrs}'
            assert "default-src 'self'" in hdrs.get('content-security-policy', ''), f'CSP missing: {hdrs}'
            checks.append({'name': 'https_tls_hsts_security_headers', 'status': 'PASS', 'tls_version': tls_ver})

            c_adm = http.client.HTTPSConnection('127.0.0.1', port_https, context=ctx_tls, timeout=5)
            c_adm.request('GET', '/admin/app/notifications')
            r_adm = c_adm.getresponse()
            r_adm.read()
            assert r_adm.status == 200 and r_adm.getheader('Strict-Transport-Security') is not None
            c_adm.request('GET', '/details/contoh')
            r_blk = c_adm.getresponse()
            r_blk.read()
            c_adm.close()
            assert r_blk.status == 404, f'blocked /details/ returned {r_blk.status}'
            checks.append({'name': 'https_routes_and_template_block', 'status': 'PASS'})

        report['result'] = 'PASS'
    finally:
        subprocess.run(['docker', 'rm', '-f', cname], capture_output=True)
        out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PASS fase3 hardening ->', args.report.as_posix())


if __name__ == '__main__':
    main()
