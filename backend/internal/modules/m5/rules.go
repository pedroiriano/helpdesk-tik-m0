package m5

import (
	"context"

	"helpdesk.local/m0/internal/modules/m5/internal/store"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func (m *Module) ListRules(ctx context.Context) ([]web.RuleView, error) {
	return (store.Store{Pool: m.pool}).ListRules(ctx)
}

func (m *Module) ConfigureRule(ctx context.Context, actorID, key string, in web.RuleWrite) (database.Result, error) {
	return (store.Store{Pool: m.pool}).ConfigureRule(ctx, actorID, key, in)
}
