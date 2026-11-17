-- M0-04 bounded persisted scan retry metadata.
ALTER TABLE intake.attachments ADD COLUMN scan_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE intake.attachments ADD COLUMN next_scan_at timestamptz NOT NULL DEFAULT now();
