#!/bin/sh
set -eu
[ "${HELPDESK_LAB_AUTH:-}" = 1 ] || { echo LAB_SEED_DISABLED >&2; exit 1; }
export PGPASSWORD="$(cat /run/secrets/postgres)"
export PGOPTIONS='-c helpdesk.environment=synthetic_lab'
case "${1:-}" in
  reporting) set -- -f /seeds/reporting-taxonomy-lab.sql ;;
  role-hero) set -- -f /seeds/role-hero-lab.sql ;;
  dashboard) set -- -f /seeds/dashboard-lab.sql ;;
  '') set -- -f /seeds/m0-03-lab.sql -f /seeds/reporting-taxonomy-lab.sql -f /seeds/role-hero-lab.sql -f /seeds/dashboard-lab.sql ;;
  *) echo INVALID_LAB_SEED >&2; exit 1 ;;
esac
exec psql -X --no-password -h db -U postgres -d helpdesk -v ON_ERROR_STOP=1 --single-transaction "$@"
