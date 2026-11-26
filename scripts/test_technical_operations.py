"""Verify one technical-operations slice against an isolated PostgreSQL seeded from the lab baseline."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from test_owner_migrations import ROOT, MigrationGate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("suite", choices=("TestTechnicalAvailability", "TestTechnicalDispatch", "TestTechnicalPerformance"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = {"suite":args.suite,"timestamp":datetime.now(timezone.utc).isoformat(),"result":"FAIL","baseline_migration":"043","target":"disposable PostgreSQL"}
    gate = MigrationGate()
    network = gate.name + "-net"
    gate.docker("network", "create", "--internal", "--label", "helpdesk.scope=technical-operations-test", network)
    try:
        gate.provision(network)
        # Apply the recorded baseline first and retain seeded records through the upgrade.
        checksums = (ROOT / "migrations/checksums.sha256").read_text(encoding="utf-8").splitlines()
        baseline = [line for line in checksums if int(Path(line.split()[1]).name[:3]) <= 43]
        gate.docker("exec", "-i", gate.name, "sh", "-ec", "tr -d '\\r' > /workspace/migrations/checksums.sha256",
                    input="\n".join(baseline) + "\n")
        gate.apply()
        seed = (ROOT / "seeds" / "m0-03-lab.sql").read_text(encoding="utf-8")
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';\n" + seed + "\nCOMMIT;")
        gate.docker("cp", str(ROOT / "migrations" / "checksums.sha256"), gate.name + ":/workspace/migrations/checksums.sha256")
        gate.apply()
        result = gate.docker("run", "--rm", "--pull", "never", "--network", network,
            "--mount", f"type=bind,src={ROOT / 'backend'},dst=/src/backend,readonly",
            "--mount", f"type=bind,src={ROOT / 'configs'},dst=/src/configs,readonly",
            "-e", "GOPROXY=off",
            "-e", "HELPDESK_TECHNICAL_TEST=1",
            "-e", "HELPDESK_TEST_DB_HOST=" + gate.name,
            "-e", "HELPDESK_TEST_PASSWORD=" + gate.password,
            "helpdesk-m0-technical-test:local", "go", "test", "./internal/bootstrap",
            "-run", "^" + args.suite + "$", "-count=1", "-v", timeout=420, ok=False)
        report["output"] = (result.stdout + result.stderr)[-4000:].rstrip()
        print(report["output"])
        if result.returncode or "--- PASS: " + args.suite not in result.stdout:
            raise SystemExit(1)
        report["result"] = "PASS"
    finally:
        try:
            gate.cleanup()
            gate.docker("network", "rm", network)
        finally:
            if args.report:
                args.report.parent.mkdir(parents=True,exist_ok=True)
                with args.report.open("x",encoding="utf-8") as output:
                    json.dump(report,output,ensure_ascii=False,indent=2)
                    output.write("\n")


if __name__ == "__main__":
    main()
