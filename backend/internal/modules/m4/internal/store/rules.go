package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func ListRules(ctx context.Context, pool *pgxpool.Pool) ([]web.RuleView, error) {
	rows, err := pool.Query(ctx, `SELECT id::text, version, code, rule_version, active FROM classification.rules ORDER BY code, rule_version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []web.RuleView{}
	for rows.Next() {
		var r web.RuleView
		r.Owner = "M4"
		if err := rows.Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active); err != nil {
			return nil, err
		}
		r.Summary = "Klasifikasi " + r.Code
		out = append(out, r)
	}
	return out, rows.Err()
}

func ConfigureRule(ctx context.Context, pool *pgxpool.Pool, actorID, key string, in web.RuleWrite) (database.Result, error) {
	if err := web.ValidateRuleWrite(&in); err != nil {
		return database.Result{}, err
	}
	targetID := web.ID()
	var existingID string
	err := pool.QueryRow(ctx, `SELECT id::text FROM classification.rules WHERE id::text=$1 OR code=$1 LIMIT 1`, in.Code).Scan(&existingID)
	if err == nil {
		targetID = existingID
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return database.Result{}, err
	}
	return database.Mutate(ctx, pool, database.Mutation{
		Owner: "M4", Actor: actorID, Command: "ConfigureClassification", Target: targetID, Key: key, Scope: "global", Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		var r web.RuleView
		r.Owner = "M4"
		err := tx.QueryRow(ctx, `SELECT id::text, version, code, rule_version, active FROM classification.rules WHERE id::text=$1 OR code=$1 FOR UPDATE`, in.Code).
			Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
		if errors.Is(err, pgx.ErrNoRows) {
			if in.ExpectedVersion != 1 {
				return database.Result{}, web.Fail(404, "Aturan klasifikasi tidak ditemukan")
			}
			err = tx.QueryRow(ctx, `INSERT INTO classification.rules(id,version,code,rule_version,dictionary,active)
				VALUES($1,1,$2,$3,'{}'::jsonb,$4) RETURNING id::text, version, code, rule_version, active`,
				targetID, in.Code, in.RuleVersion, in.Active).Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
			if err != nil {
				return database.Result{}, err
			}
			r.Summary = "Klasifikasi " + r.Code
			return database.Response(201, r)
		}
		if err != nil {
			return database.Result{}, err
		}
		if r.Version != in.ExpectedVersion {
			return database.Result{}, web.Fail(409, "Versi aturan klasifikasi berubah; muat ulang")
		}
		err = tx.QueryRow(ctx, `UPDATE classification.rules SET rule_version=$1, active=$2, version=version+1, updated_at=now()
			WHERE id=$3 RETURNING id::text, version, code, rule_version, active`,
			in.RuleVersion, in.Active, r.ID).Scan(&r.ID, &r.Version, &r.Code, &r.RuleVersion, &r.Active)
		if err != nil {
			return database.Result{}, err
		}
		r.Summary = "Klasifikasi " + r.Code
		return database.Response(201, r)
	})
}
