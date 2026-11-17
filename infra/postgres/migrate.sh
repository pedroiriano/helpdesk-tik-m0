#!/bin/sh
set -eu
export PGPASSWORD="$(cat /run/secrets/postgres)"
export M1_PASSWORD="$(cat /run/secrets/m1)"
export M2_PASSWORD="$(cat /run/secrets/m2)"
export M3_PASSWORD="$(cat /run/secrets/m3)"
export M4_PASSWORD="$(cat /run/secrets/m4)"
export M5_PASSWORD="$(cat /run/secrets/m5)"
export M6_PASSWORD="$(cat /run/secrets/m6)"
export M7_PASSWORD="$(cat /run/secrets/m7)"
export M8_PASSWORD="$(cat /run/secrets/m8)"
export M9_PASSWORD="$(cat /run/secrets/m9)"
export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-helpdesk}"
exec sh /workspace/migrations/apply.sh
