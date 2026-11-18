-- Fase 2 additive operational completion (M3 only; historical migrations stay immutable).
SET LOCAL timezone = 'UTC';
ALTER TABLE intake.vendor_cases
  ADD COLUMN state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','CLOSED')),
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_by uuid,
  ADD COLUMN resolution_note text NOT NULL DEFAULT '',
  ADD CONSTRAINT vendor_cases_closed_check CHECK((state='CLOSED')=(closed_at IS NOT NULL AND closed_by IS NOT NULL));

ALTER TABLE intake.pause_intervals
  ADD COLUMN resumed_early_at timestamptz,
  ADD COLUMN resumed_by uuid,
  ADD COLUMN resume_reason text NOT NULL DEFAULT '',
  ADD CONSTRAINT pause_intervals_resume_check CHECK((resumed_early_at IS NULL)=(resumed_by IS NULL));

ALTER TABLE intake.handoff_requests DROP CONSTRAINT handoff_requests_state_check;
ALTER TABLE intake.handoff_requests
  ADD CONSTRAINT handoff_requests_state_check CHECK(state IN ('PENDING','ACCEPTED','REJECTED','CANCELLED')),
  ADD COLUMN responded_by uuid,
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN response_reason text NOT NULL DEFAULT '';

CREATE INDEX handoff_requests_target_pending_idx ON intake.handoff_requests (target_org_id, created_at DESC) WHERE state='PENDING';
CREATE INDEX vendor_cases_ticket_created_idx ON intake.vendor_cases (ticket_id, created_at DESC);
CREATE INDEX pause_intervals_ticket_starts_idx ON intake.pause_intervals (ticket_id, starts_at DESC);
CREATE INDEX work_logs_ticket_started_idx ON intake.work_logs (ticket_id, started_at DESC);
