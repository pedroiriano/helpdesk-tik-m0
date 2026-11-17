// Package m9 is the composition boundary for notify_audit.
package m9

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	m1api "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m9/internal/app"
	"helpdesk.local/m0/internal/modules/m9/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool, scope func(context.Context, string, []string) ([]string, error)) *Module {
	st := store.Store{Pool: pool, CheckScope: scope}
	svc := app.NewService(st)
	return &Module{
		pool:    pool,
		service: svc,
	}
}

func (m *Module) ID() string                  { return "M9" }
func (m *Module) Service() *app.Service       { return m.service }
func (m *Module) Consumer() delivery.Consumer { return store.Store{Pool: m.pool} }
func (m *Module) SourceForM3() *delivery.Source {
	return delivery.NewForConsumer(m.pool, "M9", "M3")
}

func (m *Module) Register(mux *http.ServeMux, authPort m1api.Port, origin string) {
	h := app.NewHandler(m.service, authPort, origin)
	h.Register(mux)
}

func (m *Module) EnableLabSink(enabled bool) { m.service.Lab = enabled }
