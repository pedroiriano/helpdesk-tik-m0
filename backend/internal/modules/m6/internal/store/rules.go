package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func (s Store) ListRules(ctx context.Context) ([]web.RuleView, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, version, code, calendar_version, timezone, work_start::text, work_end::text, active
		FROM sla.calendars ORDER BY code, calendar_version DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []web.RuleView{}
	for rows.Next() {
		var r web.RuleView
		var tz, start, end string
		r.Owner = "M6"
		if err := rows.Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &tz, &start, &end, &r.Active); err != nil {
			return nil, err
		}
		r.Summary = fmt.Sprintf("Kalender %s (%s %s-%s)", r.Code, tz, start[:5], end[:5])
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s Store) ConfigureRule(ctx context.Context, actorID, key string, in web.RuleWrite) (database.Result, error) {
	if err := web.ValidateRuleWrite(&in); err != nil {
		return database.Result{}, err
	}
	targetID := web.ID()
	var existingID string
	err := s.Pool.QueryRow(ctx, `SELECT id::text FROM sla.calendars WHERE id::text=$1 OR code=$1 ORDER BY calendar_version DESC LIMIT 1`, in.Code).Scan(&existingID)
	if err == nil {
		targetID = existingID
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return database.Result{}, err
	}
	return database.Mutate(ctx, s.Pool, database.Mutation{
		Owner: "M6", Actor: actorID, Command: "ConfigureSla", Target: targetID, Key: key, Scope: "global", Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		var r web.RuleView
		r.Owner = "M6"
		err := tx.QueryRow(ctx, `SELECT id::text, version, code, calendar_version, active FROM sla.calendars
			WHERE id::text=$1 OR code=$1 ORDER BY calendar_version DESC LIMIT 1 FOR UPDATE`, in.Code).
			Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
		if errors.Is(err, pgx.ErrNoRows) {
			if in.ExpectedVersion != 1 {
				return database.Result{}, web.Fail(404, "Aturan SLA tidak ditemukan")
			}
			err = tx.QueryRow(ctx, `INSERT INTO sla.calendars(id,version,code,calendar_version,timezone,work_days,work_start,work_end,active)
				VALUES($1,1,$2,$3,'Asia/Jakarta','{1,2,3,4,5}','08:00','16:00',$4)
				RETURNING id::text, version, code, calendar_version, active`,
				targetID, in.Code, in.RuleVersion, in.Active).Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
			if err != nil {
				return database.Result{}, err
			}
			r.Summary = "Kalender SLA " + r.Code
			return database.Response(201, r)
		}
		if err != nil {
			return database.Result{}, err
		}
		if r.Version != in.ExpectedVersion {
			return database.Result{}, web.Fail(409, "Versi aturan SLA berubah; muat ulang")
		}
		err = tx.QueryRow(ctx, `UPDATE sla.calendars SET active=$1, version=version+1, updated_at=now() WHERE id=$2
			RETURNING id::text, version, code, calendar_version, active`, in.Active, r.ID).
			Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
		if err != nil {
			return database.Result{}, err
		}
		r.Summary = "Kalender SLA " + r.Code
		return database.Response(201, r)
	})
}
