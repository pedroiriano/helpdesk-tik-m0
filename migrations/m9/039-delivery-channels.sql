-- Fase 3 additive production notification delivery channels & retry scheduling (M9 only).
SET LOCAL timezone = 'UTC';

ALTER TABLE notify_audit.delivery_jobs
  DROP CONSTRAINT IF EXISTS delivery_jobs_channel_check;
ALTER TABLE notify_audit.delivery_jobs
  ADD CONSTRAINT delivery_jobs_channel_check CHECK(channel IN ('SINK','TELEGRAM','EMAIL'));

ALTER TABLE notify_audit.delivery_jobs
  DROP CONSTRAINT IF EXISTS delivery_jobs_state_check;
ALTER TABLE notify_audit.delivery_jobs
  ADD CONSTRAINT delivery_jobs_state_check CHECK(state IN ('PENDING','LEASED','ACKED','FAILED','DEAD_LETTER'));

ALTER TABLE notify_audit.delivery_jobs
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE notify_audit.telegram_bindings
  DROP CONSTRAINT IF EXISTS telegram_bindings_channel_check;
ALTER TABLE notify_audit.telegram_bindings
  ADD CONSTRAINT telegram_bindings_channel_check CHECK(channel IN ('SINK','TELEGRAM'));

ALTER TABLE notify_audit.telegram_bindings
  ADD COLUMN IF NOT EXISTS target_chat_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS delivery_jobs_due_idx
  ON notify_audit.delivery_jobs(state, next_attempt_at, id)
  WHERE state IN ('PENDING','FAILED');

GRANT SELECT, INSERT, UPDATE ON notify_audit.delivery_jobs, notify_audit.telegram_bindings TO helpdesk_m9;
