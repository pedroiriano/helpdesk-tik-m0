package app

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

var skillCode = regexp.MustCompile("^[a-z][a-z0-9_-]{0,39}$")

func routingAuthorized(actor identity.Actor, org, service, tier string) error {
	if !actor.Can("rules.write", org) || !actor.Can("catalog.write", org) {
		return web.Fail(403, "Mandat konfigurasi routing diperlukan")
	}
	if !web.UUID(org) || !web.UUID(service) || (tier != "L1" && tier != "L2") {
		return web.Fail(422, "Layanan atau tingkat routing tidak valid")
	}
	return nil
}

func (s *Service) ReadRouting(ctx context.Context, actor identity.Actor, org, service, tier, category string) (api.RoutingRule, error) {
	if err := routingAuthorized(actor, org, service, tier); err != nil {
		return api.RoutingRule{}, err
	}
	return s.Store.FindRule(ctx, service, tier, category)
}

func (s *Service) WriteRouting(ctx context.Context, actor identity.Actor, org, service, tier, category, key string, in api.RoutingInput) (database.Result, error) {
	if err := routingAuthorized(actor, org, service, tier); err != nil {
		return database.Result{}, err
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if !web.UUID(in.TeamID) || in.ExpectedVersion < 0 || len(in.Reason) < 5 || len(in.Reason) > 2000 || len(in.RequiredSkills) == 0 || len(in.RequiredSkills) > 20 {
		return database.Result{}, web.Fail(422, "Tim, versi, daftar skill dan alasan perubahan wajib valid")
	}
	skills := append([]string(nil), in.RequiredSkills...)
	sort.Strings(skills)
	for i, skill := range skills {
		if !skillCode.MatchString(skill) || (i > 0 && skills[i-1] == skill) {
			return database.Result{}, web.Fail(422, "Kode skill harus valid dan tidak berulang")
		}
	}
	in.RequiredSkills = skills
	target := org
	if in.TargetOrgID != "" {
		if category == "" || in.TargetOrgID == org || !web.UUID(in.TargetOrgID) ||
			!actor.Can("rules.write", in.TargetOrgID) || !actor.Can("catalog.write", in.TargetOrgID) {
			return database.Result{}, web.Fail(403, "Routing lintas OPD memerlukan kategori dan mandat pada kedua OPD")
		}
		target = in.TargetOrgID
	}
	active, err := s.Identity.ActiveTeamInOrg(ctx, in.TeamID, target)
	if err != nil {
		return database.Result{}, err
	}
	if !active {
		return database.Result{}, web.Fail(422, "Tim harus aktif pada organisasi tujuan")
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M5", Actor: actor.ID, Command: "WriteRoutingRule", Target: service, Scope: org,
		Reason: in.Reason, Key: key, Payload: struct {
			Tier, Category string
			Rule           api.RoutingInput
		}{tier, category, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "routing:"+service+":"+tier+":"+category); err != nil {
			return database.Result{}, err
		}
		var version int64
		err := tx.QueryRow(ctx, "SELECT version FROM assignment.routing_rules WHERE service_id=$1 AND level=$2 AND coalesce(category_id::text,'')=$3 ORDER BY version DESC,id LIMIT 1", service, tier, category).Scan(&version)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return database.Result{}, err
		}
		if version != in.ExpectedVersion {
			return database.Result{}, web.Fail(409, "Versi routing berubah. Muat ulang aturan")
		}
		rule := api.RoutingRule{ID: web.ID(), Version: version + 1, ServiceID: service, TeamID: in.TeamID,
			Level: tier, Active: in.Active, RequiredSkills: in.RequiredSkills, CategoryID: category, TargetOrgID: in.TargetOrgID}
		_, err = tx.Exec(ctx, "INSERT INTO assignment.routing_rules(id,version,service_id,team_id,level,required_skills,active,category_id,target_org_id) VALUES($1,$2,$3,$4,$5,$6,$7,nullif($8,'')::uuid,nullif($9,'')::uuid)",
			rule.ID, rule.Version, rule.ServiceID, rule.TeamID, rule.Level, rule.RequiredSkills, rule.Active, category, rule.TargetOrgID)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, rule)
	})
}
