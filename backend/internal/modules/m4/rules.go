package m4

import (
	"context"

	"helpdesk.local/m0/internal/modules/m4/internal/store"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func (m *Module) Source() *delivery.Source { return delivery.New(m.pool, "M4") }

func (m *Module) ListRules(ctx context.Context) ([]web.RuleView, error) {
	return store.ListRules(ctx, m.pool)
}

func (m *Module) ConfigureRule(ctx context.Context, actorID, key string, in web.RuleWrite) (database.Result, error) {
	return store.ConfigureRule(ctx, m.pool, actorID, key, in)
}
