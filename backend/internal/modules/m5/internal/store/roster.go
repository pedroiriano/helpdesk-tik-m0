package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/platform/web"
)

const rosterColumns = "id::text,version,subject_id::text,team_id::text,skills,available_from,available_until,active,capacity,updated_at"

func scanRoster(row pgx.Row) (api.ManagedRoster, error) {
	var v api.ManagedRoster
	err := row.Scan(&v.ID, &v.Version, &v.SubjectID, &v.TeamID, &v.Skills, &v.AvailableFrom, &v.AvailableUntil, &v.Active, &v.Capacity, &v.UpdatedAt)
	return v, err
}

func (s Store) ManagedRosters(ctx context.Context, team string, page web.Page) ([]api.ManagedRoster, error) {
	rows, err := s.Pool.Query(ctx, "SELECT "+rosterColumns+" FROM assignment.rosters WHERE team_id=$1 AND (NULLIF($2,'')::uuid IS NULL OR id>NULLIF($2,'')::uuid) ORDER BY id LIMIT $3",
		team, page.Cursor, page.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]api.ManagedRoster, 0)
	for rows.Next() {
		v, err := scanRoster(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

func WriteRoster(ctx context.Context, tx pgx.Tx, team, id string, in api.RosterInput) (api.ManagedRoster, error) {
	// Serialize overlapping availability windows for the same technician and team.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "roster:"+team+":"+in.SubjectID); err != nil {
		return api.ManagedRoster{}, err
	}
	if in.Active {
		var overlap bool
		err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM assignment.rosters
			WHERE team_id=$1 AND subject_id=$2 AND id<>$3 AND active
			  AND available_from<$5 AND available_until>$4)`, team, in.SubjectID, id, in.AvailableFrom, in.AvailableUntil).Scan(&overlap)
		if err != nil {
			return api.ManagedRoster{}, err
		}
		if overlap {
			return api.ManagedRoster{}, web.Fail(409, "Jadwal aktif teknisi pada tim ini bertumpuk")
		}
	}
	if in.ExpectedVersion == 0 {
		return scanRoster(tx.QueryRow(ctx, `INSERT INTO assignment.rosters
			(id,team_id,subject_id,skills,available_from,available_until,active,capacity)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING `+rosterColumns,
			id, team, in.SubjectID, in.Skills, in.AvailableFrom, in.AvailableUntil, in.Active, in.Capacity))
	}
	v, err := scanRoster(tx.QueryRow(ctx, `UPDATE assignment.rosters
		SET skills=$4, available_from=$5, available_until=$6, active=$7, capacity=COALESCE($9,capacity), version=version+1, updated_at=now()
		WHERE id=$1 AND team_id=$2 AND subject_id=$3 AND version=$8 RETURNING `+rosterColumns,
		id, team, in.SubjectID, in.Skills, in.AvailableFrom, in.AvailableUntil, in.Active, in.ExpectedVersion, in.Capacity))
	if err == pgx.ErrNoRows {
		return api.ManagedRoster{}, web.Fail(409, "Jadwal atau versinya berubah. Muat ulang data.")
	}
	return v, err
}
