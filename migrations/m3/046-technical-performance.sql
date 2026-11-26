ALTER TABLE intake.work_logs ADD COLUMN handling_team_id uuid, ADD COLUMN service_owner_org_id uuid;
CREATE INDEX technical_resolution_event ON intake.outbox(aggregate_id, event_type, aggregate_version)
  WHERE event_type IN ('ResolutionProposed','TicketStateChanged');
CREATE INDEX technical_resolution_period ON intake.resolution_attempts(resolved_at, ticket_id);
CREATE INDEX technical_work_log_period ON intake.work_logs(ended_at, ticket_id);
CREATE INDEX technical_reopen_period ON intake.episode_reopens(opened_at, ticket_id);
