"""M0-11 Isolated Database Restore Drill.

Demonstrates isolated backup and restore drill on a temporary lab database
without touching the working helpdesk-m0-db container.
Measures RTO, RPO point-in-time, verifies row counts and ledger checksums.
"""
import datetime
import json
from pathlib import Path
import sys
import time

from test_owner_migrations import MigrationGate, ROOT

SCHEMAS = [
    'identity',
    'catalog',
    'intake',
    'classification',
    'assignment',
    'sla',
    'escalation',
    'knowledge',
    'notify_audit'
]

TABLES_TO_VERIFY = [
    'identity.subjects',
    'identity.organizations',
    'identity.memberships',
    'catalog.services',
    'catalog.categories',
    'migration_control.ledger',
]


def run_drill():
    gate = MigrationGate()
    drill_db = 'helpdesk_restore_drill'
    report = {
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'M0-11 Isolated database backup and restore drill; RTO/RPO verification; zero impact on working DB',
        'command': 'python scripts/drill_m0_11_restore.py',
        'isolated_target': drill_db,
    }

    try:
        # 1. Provision disposable primary PostgreSQL container
        gate.provision()
        gate.apply()

        # 2. Seed synthetic lab data to simulate production-like dataset
        seed = (ROOT / 'seeds/m0-03-lab.sql').read_text(encoding='utf-8')
        gate.sql("BEGIN; SET LOCAL helpdesk.environment='synthetic_lab';" + seed + 'COMMIT;')

        # 3. Capture RPO reference timestamp
        rpo_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
        report['rpo_point_in_time'] = rpo_time

        # 4. Measure primary metrics (row counts and ledger checksums)
        primary_counts = {}
        for tbl in TABLES_TO_VERIFY:
            count_str = gate.sql(f"SELECT count(*) FROM {tbl};")
            primary_counts[tbl] = int(count_str)

        primary_ledger_checksums = gate.sql(
            "SELECT string_agg(id || ':' || checksum, ';' ORDER BY id) FROM migration_control.ledger;"
        )

        # 5. Execute backup dump via pg_dump
        dump_res = gate.docker(
            'exec', '-i', gate.name,
            'pg_dump', '-U', 'postgres', '-d', 'helpdesk',
            '--clean', '--if-exists'
        )
        if dump_res.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {dump_res.stderr}")
        dump_sql = dump_res.stdout

        # 6. Create clean isolated drill target database
        gate.sql(f"CREATE DATABASE {drill_db} OWNER postgres;")

        # 7. Perform restore drill and measure RTO duration
        start_restore = time.time()
        restore_res = gate.docker(
            'exec', '-i', gate.name,
            'psql', '-U', 'postgres', '-d', drill_db,
            '-v', 'ON_ERROR_STOP=1',
            input=dump_sql,
            ok=False
        )
        rto_seconds = time.time() - start_restore
        report['rto_seconds'] = round(rto_seconds, 3)

        if restore_res.returncode != 0:
            raise RuntimeError(f"Restore into {drill_db} failed: {restore_res.stderr}")

        # 8. Verify restore integrity on secondary database
        def sql_drill(query):
            res = gate.docker(
                'exec', '-i', gate.name,
                'psql', '-X', '-U', 'postgres', '-d', drill_db,
                '-qAt', '-v', 'ON_ERROR_STOP=1',
                input=query
            )
            return res.stdout.strip()

        # Check all 9 schemas exist
        schema_query = "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('" + "','".join(SCHEMAS) + "') ORDER BY schema_name;"
        restored_schemas = [s for s in sql_drill(schema_query).splitlines() if s]
        report['schemas_restored'] = restored_schemas
        assert len(restored_schemas) == 9, f"Expected 9 schemas, got: {restored_schemas}"

        # Verify table row counts match exactly
        drill_counts = {}
        for tbl in TABLES_TO_VERIFY:
            drill_counts[tbl] = int(sql_drill(f"SELECT count(*) FROM {tbl};"))
            assert drill_counts[tbl] == primary_counts[tbl], f"Row count mismatch on {tbl}: primary={primary_counts[tbl]}, drill={drill_counts[tbl]}"
        report['row_counts_verified'] = True
        report['row_counts'] = drill_counts

        # Verify schema ledger checksums match 100%
        drill_ledger_checksums = sql_drill(
            "SELECT string_agg(id || ':' || checksum, ';' ORDER BY id) FROM migration_control.ledger;"
        )
        assert drill_ledger_checksums == primary_ledger_checksums, "Ledger checksums mismatch after restore"
        report['checksum_verification'] = "PASS"

        # 9. Clean up drill database
        gate.sql(f"DROP DATABASE {drill_db};")

        report['result'] = 'PASS'
    except Exception as err:
        report['result'] = 'FAIL'
        report['error'] = str(err)
    finally:
        try:
            gate.cleanup()
            report['cleanup'] = 'PASS'
        except Exception as cleanup_err:
            report['cleanup'] = str(cleanup_err)

    out_file = ROOT / 'qa/m0-11/restore_drill.json'
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f"{report['result']} M0-11 restore drill -> {out_file} (RTO: {report.get('rto_seconds', 0)}s)")
    if report['result'] != 'PASS':
        sys.exit(1)


if __name__ == '__main__':
    run_drill()
