-- RM0-02 additive lifecycle facts. No historical ticket status is rewritten.
ALTER TABLE intake.tickets ADD COLUMN classification_decision jsonb;
CREATE TABLE intake.episode_reopens (
  episode_id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES intake.tickets(id),
  previous_episode_id uuid NOT NULL,
  opened_at timestamptz NOT NULL,
  actor_id uuid NOT NULL,
  reason text NOT NULL,
  CHECK (episode_id <> previous_episode_id)
);
GRANT SELECT, INSERT ON intake.episode_reopens TO helpdesk_m3;
CREATE INDEX tickets_operator_state_idx ON intake.tickets (service_owner_org_id, state, id) WHERE archived_at IS NULL;

-- Preserve confirmation for the exact legacy default grant. Custom scopes stay unchanged.
UPDATE intake.guest_capabilities SET scopes=array_append(scopes,'ticket.confirm')
 WHERE scopes=ARRAY['ticket.read','ticket.comment','ticket.attach'] AND revoked_at IS NULL AND expires_at>now();
