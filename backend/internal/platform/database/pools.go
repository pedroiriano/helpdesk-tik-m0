package database

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var Schemas = [...]string{"identity", "catalog", "intake", "classification", "assignment", "sla", "escalation", "knowledge", "notify_audit"}

type Pools [9]*pgxpool.Pool

func Open(ctx context.Context, host, secretDir string) (Pools, error) {
	var pools Pools
	for i, schema := range Schemas {
		owner := fmt.Sprintf("m%d", i+1)
		password, err := os.ReadFile(filepath.Join(secretDir, owner))
		if err != nil || len(strings.TrimSpace(string(password))) < 32 {
			pools.Close()
			return pools, fmt.Errorf("missing or invalid secret for %s", owner)
		}
		cfg, err := pgxpool.ParseConfig("postgres://localhost/helpdesk?sslmode=disable")
		if err != nil {
			pools.Close()
			return pools, fmt.Errorf("invalid database config")
		}
		cfg.ConnConfig.Host = host
		cfg.ConnConfig.User = "helpdesk_" + owner
		cfg.ConnConfig.Password = strings.TrimSpace(string(password))
		cfg.ConnConfig.RuntimeParams["search_path"] = "pg_catalog"
		cfg.ConnConfig.RuntimeParams["statement_timeout"] = "5000"
		cfg.ConnConfig.ConnectTimeout = 3 * time.Second
		cfg.MaxConns = 4
		cfg.MinConns = 0
		pools[i], err = pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			pools.Close()
			return pools, fmt.Errorf("pool configuration failed for %s", owner)
		}
		var version int
		err = pools[i].QueryRow(ctx, "SELECT version FROM "+schema+".schema_version WHERE singleton = true").Scan(&version)
		if err != nil || version != 1 {
			pools.Close()
			return pools, fmt.Errorf("schema not ready for %s", owner)
		}
	}
	return pools, nil
}

func (p Pools) Close() {
	for _, pool := range p {
		if pool != nil {
			pool.Close()
		}
	}
}
func (p Pools) ProbeOwner(ctx context.Context, index int) error {
	if p[index] == nil {
		return fmt.Errorf("pool unavailable")
	}
	var version int
	if err := p[index].QueryRow(ctx, "SELECT version FROM "+Schemas[index]+".schema_version WHERE singleton=true").Scan(&version); err != nil || version != 1 {
		return fmt.Errorf("schema unavailable")
	}
	return nil
}

func (p Pools) Ready(ctx context.Context) error {
	for i := range p {
		if err := p.ProbeOwner(ctx, i); err != nil {
			return err
		}
	}
	for i, schema := range Schemas[:2] {
		var version int
		if err := p[i].QueryRow(ctx, "SELECT version FROM "+schema+".domain_version WHERE singleton=true").Scan(&version); err != nil || version != 3 {
			return fmt.Errorf("domain schema unavailable")
		}
	}
	for _, i := range []int{2, 8} {
		var version int
		if err := p[i].QueryRow(ctx, "SELECT version FROM "+Schemas[i]+".domain_version WHERE singleton=true").Scan(&version); err != nil || version != 4 {
			return fmt.Errorf("intake/audit domain schema unavailable")
		}
	}
	for _, i := range []int{0, 7} {
		var version int
		if err := p[i].QueryRow(ctx, "SELECT version FROM "+Schemas[i]+".security_version WHERE singleton=true").Scan(&version); err != nil || version != 1 {
			return fmt.Errorf("security migration unavailable")
		}
	}

	for _, check := range []struct {
		index int
		query string
	}{
		{2, "SELECT EXISTS(SELECT classification_decision FROM intake.tickets WHERE false)"},
		{4, "SELECT EXISTS(SELECT service_owner_org_id FROM assignment.load_projection WHERE false)"},
		{0, "SELECT EXISTS(SELECT execution_receipt FROM identity.system_operation_requests WHERE false)"},
		{2, "SELECT EXISTS(SELECT sla_snapshot FROM intake.tickets WHERE false)"},
		{5, "SELECT EXISTS(SELECT clock_snapshot FROM sla.clock_projection WHERE false)"},
		{6, "SELECT EXISTS(SELECT result_version FROM escalation.job_replays WHERE false)"},
		{8, "SELECT EXISTS(SELECT digest FROM notify_audit.sink_challenges WHERE false)"},
		{0, "SELECT EXISTS(SELECT id FROM identity.divisions WHERE false)"},
		{2, "SELECT EXISTS(SELECT reporting_context,reported_category FROM intake.tickets WHERE false)"},
		{4, "SELECT EXISTS(SELECT category_id,target_org_id FROM assignment.routing_rules WHERE false)"},
		{0, "SELECT EXISTS(SELECT id FROM identity.role_module_policies WHERE false)"},
		{7, "SELECT EXISTS(SELECT id FROM knowledge.hero_publication WHERE false)"},
	} {
		var present bool
		if err := p[check.index].QueryRow(ctx, check.query).Scan(&present); err != nil {
			return fmt.Errorf("required owner migration unavailable")
		}
	}

	return nil
}
