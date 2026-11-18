-- Fase 2 additive SLA rule active toggle (M6 only; preserves existing calendars and snapshots).
SET LOCAL timezone = 'UTC';
ALTER TABLE sla.calendars ADD COLUMN active boolean NOT NULL DEFAULT true;
