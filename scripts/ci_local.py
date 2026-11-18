"""Deterministic local CI runner bound to the current Git commit SHA."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
NODE_IMAGE = "node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5"
TEST_GO_IMAGE = "helpdesk-m0-ci-go-test:0.1.0"


def git_info():
    """Return current HEAD commit SHA and clean-tree flag when Git is initialized."""
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    if sha.returncode != 0:
        return None, True
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    return sha.stdout.strip(), bool(dirty.stdout.strip())


def check_unique_adrs():
    """Verify docs/adr four-digit prefixes are unique and sequentially structured."""
    adr_dir = ROOT / "docs/adr"
    seen = {}
    duplicates = []
    for path in sorted(adr_dir.glob("[0-9][0-9][0-9][0-9]-*.md")):
        num = path.name[:4]
        if num in seen:
            duplicates.append(f"{num}: {seen[num]} vs {path.name}")
        else:
            seen[num] = path.name
    if duplicates:
        raise RuntimeError("Duplicate ADR numbers detected: " + "; ".join(duplicates))
    return f"Unique ADR files: {len(seen)} ({', '.join(sorted(seen.keys()))})"


def run_step(name, cmd):
    """Execute one CI step in workspace root and record duration and status."""
    started = time.monotonic()
    res = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    elapsed = round(time.monotonic() - started, 3)
    tail = (res.stdout + "\n" + res.stderr).strip().splitlines()[-12:]
    return {
        "name": name,
        "command": " ".join(cmd),
        "exit_code": res.returncode,
        "duration_s": elapsed,
        "result": "PASS" if res.returncode == 0 else "FAIL",
        "tail": tail,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-live-browser", action="store_true", help="Also verify live gateway routes, links, modals, and Edge CDP suites on 127.0.0.1:18090")
    parser.add_argument("--skip-docker", action="store_true", help="Run host-only static, contract, and package checks without Docker builds or disposable DB")
    args = parser.parse_args()

    commit_sha, is_dirty = git_info()
    steps = []

    try:
        adr_summary = check_unique_adrs()
        steps.append({"name": "adr_unique_numbering", "command": "internal:check_unique_adrs", "exit_code": 0, "duration_s": 0.01, "result": "PASS", "tail": [adr_summary]})
    except Exception as err:
        steps.append({"name": "adr_unique_numbering", "command": "internal:check_unique_adrs", "exit_code": 1, "duration_s": 0.01, "result": "FAIL", "tail": [str(err)]})

    static_cmds = [
        ("package_consistency", [sys.executable, "scripts/verify_package.py"]),
        ("package_validator_tests", [sys.executable, "-m", "unittest", "discover", "-s", "scripts", "-p", "test_verify_package.py"]),
        ("business_contracts_check", [sys.executable, "scripts/build_business_contracts.py", "--check"]),
        ("business_contracts_tests", [sys.executable, "-X", "utf8", "-m", "unittest", "tests/contract/test_business_contracts.py"]),
        ("go_module_boundaries", [sys.executable, "scripts/check_boundaries.py"]),
        ("go_boundary_negative", [sys.executable, "scripts/test_boundaries.py"]),
        ("piui_build_parity", [sys.executable, "scripts/test_piui_build.py"]),
        ("security_and_sbom", [sys.executable, "-X", "utf8", "scripts/security_gate.py"]),
    ]
    for name, cmd in static_cmds:
        steps.append(run_step(name, cmd))

    if not args.skip_docker:
        steps.append(run_step("compose_config_valid", ["docker", "compose", "config", "--quiet"]))
        steps.append(run_step("compose_prod_config_valid", ["docker", "compose", "-f", "compose.yaml", "-f", "compose.prod.yml", "config", "--quiet"]))
        steps.append(run_step("go_127_vet_and_test", ["docker", "build", "--pull=false", "--target", "test", "-t", TEST_GO_IMAGE, "-f", "infra/docker/backend.Dockerfile", "."]))
        subprocess.run(["docker", "image", "rm", TEST_GO_IMAGE], cwd=ROOT, capture_output=True)
        node_cmd = (
            "set -e; "
            "node scripts/test_admin_navigation.mjs; "
            "node scripts/test_admin_profiles.mjs; "
            "node scripts/test_ticket_actions.mjs; "
            "node scripts/test_ux_flow.mjs; "
            "node scripts/test_business_intent.mjs; "
            "node scripts/test_public_cache.mjs"
        )
        steps.append(run_step("node_26_frontend_mjs_suites", ["docker", "run", "--rm", "-v", f"{ROOT}:/work:ro", "-w", "/work", NODE_IMAGE, "sh", "-c", node_cmd]))
        steps.append(run_step("pg_18_disposable_migrations", [sys.executable, "-X", "utf8", "scripts/test_owner_migrations.py", "--report", "qa/remediation/rm0-05/ci-migrations.json"]))

    if args.with_live_browser:
        steps.append(run_step("live_link_audit", [sys.executable, "-X", "utf8", "scripts/test_m0_13_links.py"]))
        steps.append(run_step("live_modal_and_mobile", [sys.executable, "-X", "utf8", "scripts/test_modal_and_mobile.py"]))
        steps.append(run_step("live_edge_cdp_browser", ["node", "scripts/test_rm0_04_browser.mjs"]))

    all_passed = all(s["result"] == "PASS" for s in steps)
    manifest_file = ROOT / "qa/remediation/rm0-05/source-manifest.json"
    manifest_sha = hashlib.sha256(manifest_file.read_bytes()).hexdigest() if manifest_file.is_file() else None

    report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "Reproducible local CI pipeline before/during RM0-05",
        "git_commit": commit_sha,
        "git_working_tree_dirty": is_dirty,
        "source_manifest": "qa/remediation/rm0-05/source-manifest.json" if manifest_sha else None,
        "source_manifest_sha256": manifest_sha,
        "with_live_browser": args.with_live_browser,
        "skip_docker": args.skip_docker,
        "steps": steps,
        "result": "PASS" if all_passed else "FAIL",
    }
    out = ROOT / "qa/remediation/rm0-05/local-ci.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{report['result']} local CI ({len(steps)} steps) -> {out.relative_to(ROOT)} (commit={commit_sha}, dirty={is_dirty})")
    for s in steps:
        print(f"  [{s['result']}] {s['name']} ({s['duration_s']}s)")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
