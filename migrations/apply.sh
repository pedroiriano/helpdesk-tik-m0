#!/bin/sh
# One transaction per migration, protected by a database advisory lock and ledger.
set -eu
cd "${MIGRATIONS_ROOT:-/workspace}"
sha256sum -c migrations/checksums.sha256 >/dev/null
psql -X --no-password -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS migration_control;
REVOKE ALL ON SCHEMA migration_control FROM PUBLIC;
CREATE TABLE IF NOT EXISTS migration_control.ledger (
  id text PRIMARY KEY, owner text NOT NULL, path text NOT NULL UNIQUE,
  checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON migration_control.ledger FROM PUBLIC;
SQL
while read -r checksum path; do
  case "$path" in
    infra/postgres/001-foundation.sql) id=001; owner=platform ;;
    migrations/m[1-9]/[0-9][0-9][0-9]-*.sql)
      case "$path" in *[!a-z0-9/.-]*) echo INVALID_MIGRATION_PATH >&2; exit 1 ;; esac
      id="$(basename "$path" | cut -c 1-3)"
      owner="$(echo "$path" | cut -d / -f 2 | tr 'm' 'M')" ;;
    *) echo 'INVALID_MIGRATION_PATH' >&2; exit 1 ;;
  esac
  psql -X --no-password -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(73002001);
DO \$guard\$
BEGIN
  IF EXISTS (SELECT FROM migration_control.ledger WHERE id='$id' AND
     (checksum<>'$checksum' OR path<>'$path' OR owner<>'$owner')) THEN
    RAISE EXCEPTION 'MIGRATION_CHECKSUM_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT FROM migration_control.ledger WHERE id='$id') AND
     EXISTS (SELECT FROM migration_control.ledger WHERE id>'$id') THEN
    RAISE EXCEPTION 'MIGRATION_OUT_OF_ORDER';
  END IF;
END
\$guard\$;
SELECT NOT EXISTS(SELECT FROM migration_control.ledger WHERE id='$id') AS pending \gset
\if :pending
\i $path
INSERT INTO migration_control.ledger(id,owner,path,checksum) VALUES('$id','$owner','$path','$checksum');
\endif
COMMIT;
SQL
done < migrations/checksums.sha256
