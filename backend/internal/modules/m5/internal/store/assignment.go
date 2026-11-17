package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/platform/web"
)

type Store struct {
	Pool *pgxpool.Pool
}

func (s Store) FindRule(ctx context.Context, serviceID, level, category string) (api.RoutingRule, error) {
	var r api.RoutingRule
	err := s.Pool.QueryRow(ctx, `SELECT id::text,version,service_id::text,team_id::text,level,required_skills,active,
		coalesce(category_id::text,''),coalesce(target_org_id::text,'') FROM assignment.routing_rules
		WHERE service_id=$1 AND level=$2 AND coalesce(category_id::text,'')=$3 ORDER BY version DESC,id LIMIT 1`, serviceID, level, category).
		Scan(&r.ID, &r.Version, &r.ServiceID, &r.TeamID, &r.Level, &r.RequiredSkills, &r.Active, &r.CategoryID, &r.TargetOrgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return r, web.Fail(404, "Aturan routing tidak ditemukan untuk layanan dan level ini")
		}
		return r, err
	}
	return r, nil
}

func (s Store) EligibleRosters(ctx context.Context, teamID, org string, skills []string) ([]api.RosterEntry, error) {
	rows, err := s.Pool.Query(ctx, `SELECT r.id::text,r.version,r.subject_id::text,r.team_id::text,r.skills,r.available_from,r.available_until,
    (SELECT count(*) FROM assignment.load_projection p WHERE p.assignee_id=r.subject_id AND p.service_owner_org_id=$3 AND p.state IN ('ASSIGNED','IN_PROGRESS')),
    (SELECT max(updated_at) FROM assignment.load_projection WHERE service_owner_org_id=$3)
    FROM assignment.rosters r
    WHERE r.team_id=$1 AND r.available_from<=now() AND r.available_until>now() AND r.skills @> $2::text[]
    ORDER BY 8,r.subject_id,r.id`, teamID, skills, org)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []api.RosterEntry
	for rows.Next() {
		var r api.RosterEntry
		if err := rows.Scan(&r.ID, &r.Version, &r.SubjectID, &r.TeamID, &r.Skills, &r.AvailableFrom, &r.AvailableUntil, &r.ActiveTickets, &r.ProjectionAsOf); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s Store) ListRosterTechnicians(ctx context.Context, teamID string) ([]api.RosterEntry, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT id::text, subject_id::text, team_id::text, skills FROM assignment.rosters WHERE ($1='' OR team_id::text=$1) AND available_from<=now() AND available_until>now() ORDER BY id`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []api.RosterEntry
	for rows.Next() {
		var r api.RosterEntry
		if err := rows.Scan(&r.ID, &r.SubjectID, &r.TeamID, &r.Skills); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
