package store

import (
	"context"
	"time"

	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (s Store) DashboardPaused(ctx context.Context, org string, ids []string, asOf time.Time) (map[string]bool, error) {
	rows, err := s.Pool.Query(ctx, `
 SELECT t.id::text FROM intake.tickets t
 WHERE t.service_owner_org_id=$1 AND t.id=ANY($2::uuid[])
 AND EXISTS (SELECT 1 FROM intake.pause_intervals p
   WHERE p.ticket_id=t.id AND p.policy_version=t.policy_version
   AND (p.episode_id=t.episode_id OR (p.episode_id IS NULL AND NOT EXISTS (
     SELECT 1 FROM intake.episode_reopens r WHERE r.episode_id=t.episode_id AND r.ticket_id=t.id)))
   AND p.starts_at <= $3 AND p.ends_at > $3)`, org, ids, asOf)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

func (s Store) DashboardTickets(ctx context.Context, scope Scope, ids []string, q string, page web.Page) ([]api.DashboardTicket, error) {
	rows, err := s.Pool.Query(ctx, `
 SELECT t.id::text,t.number,t.title FROM intake.tickets t
 WHERE `+visible+` AND t.service_owner_org_id=$5 AND t.id=ANY($6::uuid[])
 AND ($7='' OR strpos(lower(t.number),lower($7))>0 OR strpos(lower(t.title),lower($7))>0)
 AND ($8='' OR t.id::text>$8)
 ORDER BY t.id LIMIT $9`, scope.ID, scope.TicketID, scope.Orgs, scope.Role, page.Organization, ids, q, page.Cursor, page.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]api.DashboardTicket, 0)
	for rows.Next() {
		var item api.DashboardTicket
		if err := rows.Scan(&item.ID, &item.Number, &item.Title); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
