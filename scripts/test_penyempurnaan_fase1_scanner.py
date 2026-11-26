"""Replay installed signed CVD files through an isolated FreshClam mirror."""
import json
import subprocess
import tempfile
import time
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = "helpdesk-penyempurnaan-fase1-scanner"
CLAM = "clamav/clamav:1.5.4@sha256:7054e3f34308c384ea43cd786ea17abf899bd44af40af9f1b099853d7a5c214e"
NODE = "node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5"
MIRROR_JS = r"""
const fs = require('node:fs');
require('node:http').createServer((req, res) => {
  if (req.url === '/ready') { res.end('ready'); return; }
  const name = req.url.slice(1);
  const file = '/mirror/' + name;
  if (!/^[a-z0-9.-]+\.(cvd|sign)$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404).end(); return;
  }
  const size = fs.statSync(file).size;
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), size-1) : size-1;
  const headers = {'Content-Length': end-start+1, 'Accept-Ranges': 'bytes'};
  if (range) headers['Content-Range'] = 'bytes '+start+'-'+end+'/'+size;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file,{start,end}).pipe(res);
}).listen(8080, '0.0.0.0');
"""
UPDATE = r"""
set -eu
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
mkdir -p /tmp/cvd
chown clamav:clamav /tmp/cvd
printf 'PrivateMirror http://127.0.0.1:8080\nDatabaseDirectory /tmp/cvd\nDatabaseOwner clamav\nConnectTimeout 3\nMaxAttempts 1\n' > /tmp/freshclam-test.conf
freshclam --config-file=/tmp/freshclam-test.conf --stdout
for db in daily main bytecode; do test -s /tmp/cvd/$db.cvd; done
"""

def docker(*args, check=True):
    return subprocess.run(["docker", *args], text=True, capture_output=True, check=check, timeout=120)

def main():
    report = {"result": "FAIL", "scope": "Signed bundled CVD replay using freshclam without external network"}
    name = "helpdesk-fase1-mirror-" + uuid4().hex[:8]
    created = False
    scratch = ROOT / ".local" / "penyempurnaan-fase1"
    try:
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            root = Path(directory)
            data = root / "cvd"
            data.mkdir()
            entry = root / "mirror.cjs"
            entry.write_text(MIRROR_JS, encoding="utf-8")
            docker("cp", f"{FIXTURE}:/var/lib/clamav/.", str(data))
            def update(network):
                return docker("run", "--rm", "--pull", "never", "--network", network,
                              "--entrypoint", "/bin/sh", CLAM, "-c", UPDATE, check=False)
            unavailable = update("none")
            report["without_mirror_exit"] = unavailable.returncode
            if unavailable.returncode == 0 or "Could not connect" not in unavailable.stdout + unavailable.stderr:
                raise RuntimeError("Expected FreshClam to report an unavailable mirror")
            docker("run", "-d", "--pull", "never", "--name", name, "--network", "none",
                   "--mount", f"type=bind,src={data},dst=/mirror,readonly",
                   "--mount", f"type=bind,src={entry},dst=/mirror.cjs,readonly",
                   NODE, "node", "/mirror.cjs")
            created = True
            try:
                for _ in range(15):
                    wait = docker("exec", name, "node", "-e", "fetch('http://127.0.0.1:8080/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))", check=False)
                    if wait.returncode == 0:
                        break
                    time.sleep(.25)
                else:
                    raise RuntimeError("Fixture mirror failed readiness")
                downloaded = update("container:" + name)
                report["with_mirror_exit"] = downloaded.returncode
                report["output"] = (downloaded.stdout + downloaded.stderr).splitlines()[-25:]
                if downloaded.returncode:
                    raise RuntimeError("FreshClam failed against the isolated mirror")
                report["result"] = "PASS"
            finally:
                if created:
                    cleanup = docker("rm", "-f", name, check=False)
                    if cleanup.returncode:
                        report["result"] = "FAIL"
                        raise RuntimeError("Mirror fixture cleanup failed")
    except (RuntimeError, subprocess.SubprocessError, OSError) as err:
        report["error"] = str(err)
    evidence = ROOT / "qa/remediation/rm0-05/penyempurnaan/fase1-scanner-mirror.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(report["result"], report.get("error", "freshclam failure and recovery"), evidence)
    return int(report["result"] != "PASS")

if __name__ == "__main__":
    raise SystemExit(main())

