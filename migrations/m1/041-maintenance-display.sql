-- Additive maintenance schedule kind & public Under Maintenance display mode (M1 only).
SET LOCAL timezone = 'UTC';

ALTER TABLE identity.maintenance_policies
  ADD COLUMN IF NOT EXISTS schedule_kind text NOT NULL DEFAULT 'UNSCHEDULED' CHECK(schedule_kind IN ('SCHEDULED','UNSCHEDULED')),
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'BANNER' CHECK(display_mode IN ('BANNER','FULL_SCREEN'));

CREATE INDEX IF NOT EXISTS maintenance_policies_window_idx
  ON identity.maintenance_policies (ends_at DESC, starts_at ASC);

GRANT SELECT, INSERT, UPDATE ON identity.maintenance_policies TO helpdesk_m1;
