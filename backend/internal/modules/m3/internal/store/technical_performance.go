package store

import (
	"context"

	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
)

// TechnicalFacts exports bounded, scope-filtered facts for M9 aggregation. No report reads private rows directly.
func (s Store) TechnicalFacts(ctx context.Context, scope api.TechnicalPerformanceScope) ([]api.TechnicalFact, error) {
	const limit = 10000
	rows, err := s.Pool.Query(ctx, `
WITH visible AS (
 SELECT id FROM intake.tickets WHERE service_owner_org_id=$1 AND purged_at IS NULL
),
attempt_facts AS (
 SELECT a.ticket_id,a.id attempt_id,a.resolved_by subject_id,x.kind,x.event_at
 FROM visible t JOIN intake.resolution_attempts a ON a.ticket_id=t.id
 CROSS JOIN LATERAL (VALUES ('RESOLVED',a.resolved_at),
  (CASE a.outcome WHEN 'ACCEPTED' THEN 'CONFIRMED' WHEN 'AUTO_NO_RESPONSE' THEN 'AUTO_CLOSED' END,a.updated_at)) x(kind,event_at)
 WHERE x.kind IS NOT NULL AND x.event_at >= $2 AND x.event_at < $3
 UNION ALL
 SELECT r.ticket_id,a.id,a.resolved_by,'REOPENED',r.opened_at
 FROM visible t JOIN intake.episode_reopens r ON r.ticket_id=t.id
 JOIN LATERAL (
  SELECT id,resolved_by FROM intake.resolution_attempts
  WHERE ticket_id=r.ticket_id AND episode_id=r.previous_episode_id AND outcome IN ('ACCEPTED','AUTO_NO_RESPONSE')
  ORDER BY resolved_at DESC,id DESC LIMIT 1
 ) a ON true WHERE r.opened_at >= $2 AND r.opened_at < $3
),
facts AS (
 SELECT f.ticket_id,f.kind,f.event_at,0::bigint AS seconds,
  (snapshot.payload->>'resolution_due_at')::timestamptz AS due,
  (snapshot.payload->>'resolution_endpoint')::timestamptz AS endpoint,
  (snapshot.payload->>'gross_seconds')::bigint AS gross,
  (snapshot.payload->>'net_seconds')::bigint AS net,
  (snapshot.payload->>'handling_team_id')::uuid AS team_id,
  (snapshot.payload->>'service_owner_org_id')::uuid AS event_org
 FROM attempt_facts f
 LEFT JOIN LATERAL (
  SELECT state.payload FROM intake.outbox attempt
  JOIN intake.outbox state ON state.aggregate_id=attempt.aggregate_id
      AND state.aggregate_version=attempt.aggregate_version AND state.event_type='TicketStateChanged'
  WHERE attempt.aggregate_id=f.ticket_id AND attempt.event_type='ResolutionProposed'
      AND attempt.payload->>'attempt_id'=f.attempt_id::text
  ORDER BY state.event_id LIMIT 1
 ) snapshot ON true
 WHERE (NULLIF($4,'')::uuid IS NULL OR f.subject_id=NULLIF($4,'')::uuid)
 UNION ALL
 SELECT w.ticket_id,'WORK_LOG',w.ended_at,EXTRACT(EPOCH FROM w.ended_at-w.started_at)::bigint,
  NULL,NULL,NULL,NULL,
  COALESCE(w.handling_team_id,(prior.payload->>'handling_team_id')::uuid),
  COALESCE(w.service_owner_org_id,(prior.payload->>'service_owner_org_id')::uuid)
 FROM visible t JOIN intake.work_logs w ON w.ticket_id=t.id
 LEFT JOIN LATERAL (
  SELECT snapshot.payload FROM intake.outbox snapshot
  WHERE w.service_owner_org_id IS NULL AND snapshot.aggregate_id=w.ticket_id
    AND snapshot.event_type='TicketStateChanged' AND snapshot.occurred_at<=w.created_at
  ORDER BY snapshot.aggregate_version DESC,snapshot.event_id LIMIT 1
 ) prior ON true
 WHERE w.ended_at >= $2 AND w.ended_at < $3 AND (NULLIF($4,'')::uuid IS NULL OR w.actor_id=NULLIF($4,'')::uuid)
)
SELECT ticket_id::text,kind,event_at,seconds,due,endpoint,gross,net
FROM facts WHERE (event_org IS NULL OR event_org=$1)
 AND ($5::uuid[] IS NULL OR team_id=ANY($5::uuid[]))
LIMIT $6`, scope.OrganizationID, scope.From, scope.To, scope.SubjectID, scope.TeamIDs, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	facts := make([]api.TechnicalFact, 0)
	for rows.Next() {
		if len(facts) == limit {
			return nil, web.Fail(422, "Persempit periode laporan kinerja")
		}
		var f api.TechnicalFact
		if err := rows.Scan(&f.TicketID, &f.Kind, &f.At, &f.Seconds, &f.Due, &f.Endpoint, &f.Gross, &f.Net); err != nil {
			return nil, err
		}
		facts = append(facts, f)
	}
	return facts, rows.Err()
}
