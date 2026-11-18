-- Fase 3 additive retention & legal hold guard on archived tickets (M3 only).
SET LOCAL timezone = 'UTC';

ALTER TABLE intake.tickets
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_reason text NOT NULL DEFAULT '';

GRANT SELECT, INSERT, UPDATE ON intake.tickets TO helpdesk_m3;
GRANT DELETE ON intake.attachments TO helpdesk_m3;
