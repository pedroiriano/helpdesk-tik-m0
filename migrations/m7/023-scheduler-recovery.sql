ALTER TABLE escalation.jobs ADD COLUMN IF NOT EXISTS retry_at timestamptz;
ALTER TABLE escalation.jobs ADD COLUMN IF NOT EXISTS correlation_id uuid;
CREATE INDEX IF NOT EXISTS jobs_auto_close_retry ON escalation.jobs (COALESCE(retry_at, due_at), id)
  WHERE kind = 'AUTO_CLOSE' AND state IN ('PENDING', 'LEASED');
