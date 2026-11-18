package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func (s Store) ListRules(ctx context.Context) ([]web.RuleView, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, version, service_id::text, level, required_skills, active,
		coalesce(category_id::text,''), coalesce(target_org_id::text,'') FROM assignment.routing_rules ORDER BY service_id, level, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []web.RuleView{}
	for rows.Next() {
		var id, serviceID, level, categoryID, targetOrgID string
		var version int64
		var skills []string
		var active bool
		if err := rows.Scan(&id, &version, &serviceID, &level, &skills, &active, &categoryID, &targetOrgID); err != nil {
			return nil, err
		}
		code := serviceID + ":" + level
		if categoryID != "" {
			code += ":" + categoryID
		}
		summary := fmt.Sprintf("Routing %s [%s]", level, strings.Join(skills, ","))
		if targetOrgID != "" {
			summary += " -> OPD " + targetOrgID[:8]
		}
		out = append(out, web.RuleView{
			ID:          id,
			Owner:       "M5",
			Code:        code,
			Version:     version,
			RuleVersion: version,
			Active:      active,
			Summary:     summary,
		})
	}
	return out, rows.Err()
}

func (s Store) ConfigureRule(ctx context.Context, actorID, key string, in web.RuleWrite) (database.Result, error) {
	if err := web.ValidateRuleWrite(&in); err != nil {
		return database.Result{}, err
	}
	var targetID string
	err := s.Pool.QueryRow(ctx, `SELECT id::text FROM assignment.routing_rules
		WHERE id::text=$1 OR (service_id::text || ':' || level || CASE WHEN category_id IS NULL THEN '' ELSE ':' || category_id::text END)=$1
		ORDER BY version DESC LIMIT 1`, in.Code).Scan(&targetID)
	if errors.Is(err, pgx.ErrNoRows) {
		return database.Result{}, web.Fail(404, "Aturan routing tidak ditemukan; pilih aturan yang ada")
	}
	if err != nil {
		return database.Result{}, err
	}
	return database.Mutate(ctx, s.Pool, database.Mutation{
		Owner: "M5", Actor: actorID, Command: "ConfigureRouting", Target: targetID, Key: key, Scope: "global", Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		var ver int64
		var level string
		var serviceID, categoryID string
		err := tx.QueryRow(ctx, `SELECT version, service_id::text, level, coalesce(category_id::text,'') FROM assignment.routing_rules WHERE id=$1 FOR UPDATE`, targetID).
			Scan(&ver, &serviceID, &level, &categoryID)
		if errors.Is(err, pgx.ErrNoRows) {
			return database.Result{}, web.Fail(404, "Aturan routing tidak ditemukan")
		}
		if err != nil {
			return database.Result{}, err
		}
		if ver != in.ExpectedVersion {
			return database.Result{}, web.Fail(409, "Versi aturan routing berubah; muat ulang")
		}
		var newVer int64
		var active bool
		err = tx.QueryRow(ctx, `UPDATE assignment.routing_rules SET active=$1, version=version+1, updated_at=now() WHERE id=$2 RETURNING version, active`,
			in.Active, targetID).Scan(&newVer, &active)
		if err != nil {
			return database.Result{}, err
		}
		code := serviceID + ":" + level
		if categoryID != "" {
			code += ":" + categoryID
		}
		return database.Response(201, web.RuleView{
			ID:          targetID,
			Owner:       "M5",
			Code:        code,
			Version:     newVer,
			RuleVersion: newVer,
			Active:      active,
			Summary:     "Routing " + level,
		})
	})
}
