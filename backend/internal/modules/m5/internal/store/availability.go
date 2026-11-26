package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/platform/web"
)

const absenceColumns = "id::text,version,starts_at,ends_at,cancelled,updated_at"

func scanAbsence(row pgx.Row) (api.Absence, error) {
	var item api.Absence
	err := row.Scan(&item.ID, &item.Version, &item.StartsAt, &item.EndsAt, &item.Cancelled, &item.UpdatedAt)
	return item, err
}

func (s Store) Absences(ctx context.Context, subject string, page web.Page) ([]api.Absence, error) {
	rows, err := s.Pool.Query(ctx, "SELECT "+absenceColumns+" FROM assignment.technician_absences WHERE subject_id=$1 AND (NULLIF($2,'')::uuid IS NULL OR id>NULLIF($2,'')::uuid) ORDER BY id LIMIT $3", subject, page.Cursor, page.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []api.Absence{}
	for rows.Next() {
		item, err := scanAbsence(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func WriteAbsence(ctx context.Context, tx pgx.Tx, subject, id string, in api.AbsenceInput) (api.Absence, error) {
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "absence:"+subject); err != nil {
		return api.Absence{}, err
	}
	var overlap bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assignment.technician_absences
		WHERE subject_id=$1 AND NOT cancelled AND starts_at<$3 AND ends_at>$2)`, subject, in.StartsAt, in.EndsAt).Scan(&overlap)
	if err != nil {
		return api.Absence{}, err
	}
	if overlap {
		return api.Absence{}, web.Fail(409, "Periode ketidakhadiran bertumpuk")
	}
	return scanAbsence(tx.QueryRow(ctx, "INSERT INTO assignment.technician_absences(id,subject_id,starts_at,ends_at) VALUES($1,$2,$3,$4) RETURNING "+absenceColumns,
		id, subject, in.StartsAt, in.EndsAt))
}

func CancelAbsence(ctx context.Context, tx pgx.Tx, subject, id string, version int64) (api.Absence, error) {
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "absence:"+subject); err != nil {
		return api.Absence{}, err
	}
	item, err := scanAbsence(tx.QueryRow(ctx, "UPDATE assignment.technician_absences SET cancelled=true,version=version+1,updated_at=now() WHERE id=$1 AND subject_id=$2 AND version=$3 AND NOT cancelled RETURNING "+absenceColumns,
		id, subject, version))
	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool
		if err := tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM assignment.technician_absences WHERE id=$1 AND subject_id=$2)", id, subject).Scan(&exists); err != nil {
			return api.Absence{}, err
		}
		if !exists {
			return api.Absence{}, web.Fail(404, "Ketidakhadiran tidak ditemukan")
		}
		return api.Absence{}, web.Fail(409, "Ketidakhadiran berubah. Muat ulang data.")
	}
	return item, err
}

func (s Store) AbsentTechnicians(ctx context.Context, subjects []string, at time.Time) (map[string]bool, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT subject_id::text FROM assignment.technician_absences
      WHERE subject_id=ANY($1::uuid[]) AND NOT cancelled AND starts_at<=$2 AND ends_at>$2`, subjects, at)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

type TechnicianLoad struct {
	WaitingVendor      int
	UnclassifiedActive int
	WaitingReporter    int
	Absent             bool
	Active             int
}

func (s Store) Loads(ctx context.Context, subjects []string, at time.Time) (map[string]TechnicianLoad, error) {
	rows, err := s.Pool.Query(ctx, `SELECT candidate::text,
		EXISTS(SELECT 1 FROM assignment.technician_absences a WHERE a.subject_id=candidate AND NOT a.cancelled AND a.starts_at<=$2 AND a.ends_at>$2),
		stats.active, stats.waiting_vendor, stats.unclassified_active, stats.waiting_reporter
		FROM unnest($1::uuid[]) AS candidate
        CROSS JOIN LATERAL (
          SELECT count(*) FILTER (WHERE state IN ('ASSIGNED','IN_PROGRESS')) AS active,
                 count(*) FILTER (WHERE state IN ('ASSIGNED','IN_PROGRESS') AND awaiting_vendor) AS waiting_vendor,
                 count(*) FILTER (WHERE state IN ('ASSIGNED','IN_PROGRESS') AND awaiting_vendor IS NULL) AS unclassified_active,
                 count(*) FILTER (WHERE state='RESOLVED') AS waiting_reporter
          FROM assignment.load_projection WHERE assignee_id=candidate AND state IN ('ASSIGNED','IN_PROGRESS','RESOLVED')
        ) stats`, subjects, at)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]TechnicianLoad, len(subjects))
	for rows.Next() {
		var id string
		var load TechnicianLoad
		if err := rows.Scan(&id, &load.Absent, &load.Active, &load.WaitingVendor, &load.UnclassifiedActive, &load.WaitingReporter); err != nil {
			return nil, err
		}
		result[id] = load
	}
	return result, rows.Err()
}

func (s Store) AvailabilityRosters(ctx context.Context, teams []string, at time.Time, skill string) ([]api.ManagedRoster, error) {
	rows, err := s.Pool.Query(ctx, "SELECT "+rosterColumns+` FROM assignment.rosters WHERE team_id=ANY($1::uuid[])
		AND active AND available_from<=$2 AND available_until>$2 AND ($3='' OR $3=ANY(skills))`, teams, at, skill)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []api.ManagedRoster{}
	for rows.Next() {
		item, err := scanRoster(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s Store) PersonalRosters(ctx context.Context, subject string, teams []string, page web.Page) ([]api.ManagedRoster, error) {
	rows, err := s.Pool.Query(ctx, "SELECT "+rosterColumns+` FROM assignment.rosters WHERE subject_id=$1 AND team_id=ANY($2::uuid[])
		AND (NULLIF($3,'')::uuid IS NULL OR id>NULLIF($3,'')::uuid) ORDER BY id LIMIT $4`, subject, teams, page.Cursor, page.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []api.ManagedRoster{}
	for rows.Next() {
		item, err := scanRoster(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
