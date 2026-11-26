// Package m2 is the composition boundary for catalog. Business use cases follow in later slices.
package m2

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/modules/m2/internal/app"
	"helpdesk.local/m0/internal/modules/m2/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module { return &Module{pool: pool} }
func (m *Module) ID() string         { return "M2" }
func NewRuntime(pool *pgxpool.Pool, identity identity.Port) *Module {
	return &Module{pool: pool, service: &app.Service{Store: store.Store{Pool: pool}, Identity: identity}}
}
func (m *Module) Register(mux *http.ServeMux) { m.service.Register(mux) }
func (m *Module) Port() api.Port              { return m.service }
func (m *Module) Source() *delivery.Source    { return delivery.New(m.pool, "M2") }
func (m *Module) Service() *app.Service       { return m.service }

func (m *Module) SearchServices(ctx context.Context, query, kind string, orgs []string, limit int, after string) ([]api.SearchHit, error) {
	return m.service.SearchServices(ctx, query, kind, orgs, limit, after)
}
