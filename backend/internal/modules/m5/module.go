// Package m5 is the composition boundary for assignment. Business use cases follow in later slices.
package m5

import (
	"github.com/jackc/pgx/v5/pgxpool"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/modules/m5/internal/app"
	"helpdesk.local/m0/internal/modules/m5/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module {
	return &Module{pool: pool}
}

func NewRuntime(pool *pgxpool.Pool, idPort identity.Port) *Module {
	return &Module{
		pool:    pool,
		service: &app.Service{Store: store.Store{Pool: pool}, Identity: idPort},
	}
}

func (m *Module) ID() string {
	return "M5"
}

func (m *Module) Port() api.Port {
	if m.service != nil {
		return m.service
	}
	return nil
}

func (m *Module) Consumer() delivery.Consumer {
	if m.service != nil {
		return m.service
	}
	return nil
}

func (m *Module) Source() *delivery.Source { return delivery.New(m.pool, "M5") }
