package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

const ticketJobCols = `id::text, ticket_id::text, kind, state, version, expected_version, attempts, due_at, retry_at, last_error_code, attempt_id::text, updated_at`

func scanJobs(rows pgx.Rows) ([]api.TicketJobView, error) {
	defer rows.Close()
	out := []api.TicketJobView{}
	for rows.Next() {
		var j api.TicketJobView
		if err := rows.Scan(&j.ID, &j.TicketID, &j.Kind, &j.State, &j.Version, &j.ExpectedVersion,
			&j.Attempts, &j.DueAt, &j.RetryAt, &j.LastError, &j.AttemptID, &j.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

func (s Store) ListTicketJobs(ctx context.Context, ticketID string, limit int) ([]api.TicketJobView, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.Pool.Query(ctx, `SELECT `+ticketJobCols+` FROM escalation.jobs WHERE ticket_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`, ticketID, limit)
	if err != nil {
		return nil, err
	}
	return scanJobs(rows)
}

func (s Store) ListJobs(ctx context.Context, state string, limit int) ([]api.TicketJobView, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.Pool.Query(ctx, `SELECT `+ticketJobCols+` FROM escalation.jobs
		WHERE ($1='' OR state=$1)
		ORDER BY CASE state WHEN 'DEAD_LETTER' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'LEASED' THEN 2 ELSE 3 END, updated_at DESC, id DESC
		LIMIT $2`, state, limit)
	if err != nil {
		return nil, err
	}
	return scanJobs(rows)
}

func (s Store) ListRules(ctx context.Context) ([]web.RuleView, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, version, code, level, delay_seconds, active FROM escalation.rules ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []web.RuleView{}
	for rows.Next() {
		var r web.RuleView
		var level string
		var delay int
		r.Owner = "M7"
		if err := rows.Scan(&r.ID, &r.Version, &r.Code, &level, &delay, &r.Active); err != nil {
			return nil, err
		}
		r.RuleVersion = r.Version
		r.Summary = fmt.Sprintf("Eskalasi %s (tunda %dd)", level, delay)
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
	err := s.Pool.QueryRow(ctx, `SELECT id::text FROM escalation.rules WHERE id::text=$1 OR code=$1 LIMIT 1`, in.Code).Scan(&existingID)
	if err == nil {
		targetID = existingID
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return database.Result{}, err
	}
	return database.Mutate(ctx, s.Pool, database.Mutation{
		Owner: "M7", Actor: actorID, Command: "ConfigureEscalation", Target: targetID, Key: key, Scope: "global", Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		var r web.RuleView
		var level string
		var delay int
		r.Owner = "M7"
		err := tx.QueryRow(ctx, `SELECT id::text, version, code, level, delay_seconds, active FROM escalation.rules WHERE id::text=$1 OR code=$1 FOR UPDATE`, in.Code).
			Scan(&r.ID, &r.Version, &r.Code, &level, &delay, &r.Active)
		if errors.Is(err, pgx.ErrNoRows) {
			if in.ExpectedVersion != 1 {
				return database.Result{}, web.Fail(404, "Aturan eskalasi tidak ditemukan")
			}
			err = tx.QueryRow(ctx, `INSERT INTO escalation.rules(id,version,code,level,delay_seconds,active)
				VALUES($1,1,$2,'L2',3600,$3) RETURNING id::text, version, code, level, delay_seconds, active`,
				targetID, in.Code, in.Active).Scan(&r.ID, &r.Version, &r.Code, &level, &delay, &r.Active)
			if err != nil {
				return database.Result{}, err
			}
			r.RuleVersion = r.Version
			r.Summary = fmt.Sprintf("Eskalasi %s (tunda %dd)", level, delay)
			return database.Response(201, r)
		}
		if err != nil {
			return database.Result{}, err
		}
		if r.Version != in.ExpectedVersion {
			return database.Result{}, web.Fail(409, "Versi aturan eskalasi berubah; muat ulang")
		}
		err = tx.QueryRow(ctx, `UPDATE escalation.rules SET active=$1, version=version+1, updated_at=now() WHERE id=$2
			RETURNING id::text, version, code, level, delay_seconds, active`, in.Active, r.ID).
			Scan(&r.ID, &r.Version, &r.Code, &level, &delay, &r.Active)
		if err != nil {
			return database.Result{}, err
		}
		r.RuleVersion = r.Version
		r.Summary = fmt.Sprintf("Eskalasi %s (tunda %dd)", level, delay)
		return database.Response(201, r)
	})
}
