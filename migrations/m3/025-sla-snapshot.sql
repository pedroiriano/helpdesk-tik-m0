ALTER TABLE intake.tickets ADD COLUMN sla_snapshot jsonb;
ALTER TABLE intake.tickets ADD COLUMN episode_started_at timestamptz;
ALTER TABLE intake.tickets ADD COLUMN response_due_at timestamptz;
ALTER TABLE intake.tickets ADD COLUMN first_response_at timestamptz;
ALTER TABLE intake.pause_intervals ADD COLUMN episode_id uuid;
CREATE INDEX intake_pauses_by_episode ON intake.pause_intervals(ticket_id,episode_id,starts_at);
